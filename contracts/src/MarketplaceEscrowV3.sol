// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice ERC-792-style callback: the `arbitrator` rules on a dispute (disputeId == orderId).
///         Ruling 0 = refused to rule (default outcome applies), 1 = buyer wins, 2 = seller wins.
interface IArbitrable {
    event Ruling(address indexed arbitrator, uint256 indexed disputeId, uint256 ruling);

    function rule(uint256 disputeId, uint256 ruling) external;
}

/**
 * @title MarketplaceEscrowV3
 * @author mercadopleis
 * @notice Non-custodial escrow for a service marketplace. v3 fixes the issues reported against v2:
 *         - a delivery can only be submitted before the deadline (the buyer can extend it);
 *         - only the buyer can dispute an order that has not been delivered;
 *         - every dispute ends: after DISPUTE_TIMEOUT anyone can apply a default outcome, which depends on the
 *           order (delivered: seller is paid; not delivered and deadline passed: buyer is refunded), not on who
 *           opened the dispute;
 *         - payouts are pull payments: settling an order credits `withdrawable` and each party calls `withdraw`,
 *           so a blacklisted address (USDC) cannot block an order or the other parties;
 *         - pause stops new exposure and every payout that depends on a third party, but never the buyer's own exits
 *           (timeout refund, dispute, approval) or withdrawals; time does not run for any order while paused
 *           (deadline, review window and dispute timeout are extended by the paused time).
 * @dev    The protocol fee is a constant (FEE_BPS = 3%) charged on the amount paid to the seller. A full
 *         refund to the buyer carries no fee. The `orders` getter has the same layout as v2 so integrators
 *         keep reading it unchanged, but its `deadline` and `autoReleaseTime` exclude pauses that happened since the
 *         order last changed status: read `effectiveDeadline` / `effectiveAutoReleaseTime` / `disputeTimeoutAt`.
 *         Dispute data lives in `disputes`. Admin functions match v2, so EscrowAdmin (timelock plus guardian) can
 *         own this contract unchanged.
 *         Only plain ERC-20 tokens (USDC) may be whitelisted: fee-on-transfer or rebasing tokens break the accounting.
 *         Invariant: token.balanceOf(this) == sum(amount of Funded/Delivered/Disputed orders) + totalWithdrawable[token].
 */
contract MarketplaceEscrowV3 is IArbitrable, ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    // --- Constants ---
    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant FEE_BPS = 300; // 3% protocol fee, immutable and not configurable
    uint256 public constant AUTO_RELEASE_DURATION = 5 days; // buyer review window after a delivery
    uint256 public constant DISPUTE_TIMEOUT = 14 days; // after this, anyone can apply the default outcome
    uint256 public constant MAX_DEADLINE_DAYS = 365;

    // --- Enums ---
    enum OrderStatus {
        None,
        Funded,
        Delivered,
        Released,
        Refunded,
        Disputed,
        Resolved
    }

    // --- Structs ---
    struct Order {
        address buyer;
        address seller;
        address token;
        uint256 amount;
        uint256 deadline;
        uint256 autoReleaseTime;
        bytes32 deliveryHash;
        OrderStatus status;
    }

    struct DisputeInfo {
        uint64 openedAt;
        bool fromDelivered; // true if the order had a delivery when the dispute was opened
    }

    // --- State Variables ---
    address public feeRecipient;
    address public arbitrator;
    uint256 public orderCount;

    mapping(uint256 => Order) public orders;
    mapping(uint256 => DisputeInfo) public disputes;
    mapping(address => bool) public acceptedTokens;

    /// @notice Settled funds waiting to be withdrawn, per token and account.
    mapping(address => mapping(address => uint256)) public withdrawable;
    /// @notice Sum of `withdrawable` per token.
    mapping(address => uint256) public totalWithdrawable;

    /// @dev Paused seconds accumulated by finished pauses, and the start of the current one.
    uint256 private _pausedTotal;
    uint256 private _pausedAt;
    /// @notice pausedTime() when the order's current timer was set; the timer is extended by pausedTime() - snapshot.
    mapping(uint256 => uint256) public pauseSnapshot;

    // --- Events ---
    event OrderFunded(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount,
        uint256 deadline
    );
    /// @dev autoReleaseTime is 0 when the delivery is submitted during a dispute (the order stays Disputed).
    event DeliverySubmitted(uint256 indexed orderId, address indexed seller, bytes32 deliveryHash, uint256 autoReleaseTime);
    event DeadlineExtended(uint256 indexed orderId, uint256 oldDeadline, uint256 newDeadline);
    event OrderReleased(uint256 indexed orderId, uint256 sellerPayout, uint256 platformFee);
    event OrderRefunded(uint256 indexed orderId, address indexed buyer, uint256 refundAmount);
    event DisputeOpened(uint256 indexed orderId, address indexed openedBy);
    event DisputeResolved(uint256 indexed orderId, uint256 sellerPayout, uint256 buyerRefund, uint256 platformFee);
    event DisputeTimeoutClaimed(uint256 indexed orderId, address indexed caller);
    event Credited(uint256 indexed orderId, address indexed token, address indexed account, uint256 amount);
    event Withdrawn(address indexed token, address indexed account, address to, uint256 amount);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    event ArbitratorUpdated(address oldArbitrator, address newArbitrator);
    event TokenWhitelisted(address indexed token, bool allowed);

    // --- Errors ---
    error InvalidAddress();
    error InvalidAmount();
    error TokenNotAccepted();
    error InvalidDeadline();
    error InvalidStatus(OrderStatus current, OrderStatus expected);
    error Unauthorized();
    error DeadlineNotPassed();
    error DeadlinePassed();
    error AutoReleaseNotReady();
    error DisputeTimeoutNotReached();
    error DisputeMathMismatch();
    error InvalidRuling();
    error NothingToWithdraw();
    error RenounceDisabled();

    // --- Modifiers ---
    modifier onlyArbitrator() {
        if (msg.sender != arbitrator) revert Unauthorized();
        _;
    }

    constructor(address initialOwner, address _feeRecipient, address _arbitrator) Ownable(initialOwner) {
        if (initialOwner == address(0) || _feeRecipient == address(0) || _arbitrator == address(0)) {
            revert InvalidAddress();
        }
        feeRecipient = _feeRecipient;
        arbitrator = _arbitrator;
    }

    /// @notice Protocol fee in basis points. Always 300 (3%).
    function feeBps() external pure returns (uint256) {
        return FEE_BPS;
    }

    // --- Time views (pauses extend every timer) ---

    /// @notice Total seconds the escrow has been paused, including the current pause.
    function pausedTime() public view returns (uint256) {
        return paused() ? _pausedTotal + (block.timestamp - _pausedAt) : _pausedTotal;
    }

    function _pauseExtension(uint256 orderId) internal view returns (uint256) {
        return pausedTime() - pauseSnapshot[orderId];
    }

    /// @notice Delivery deadline including pauses. Meaningful while the order is Funded or Disputed.
    function effectiveDeadline(uint256 orderId) public view returns (uint256) {
        return orders[orderId].deadline + _pauseExtension(orderId);
    }

    /// @notice End of the review window including pauses. Meaningful while the order is Delivered.
    function effectiveAutoReleaseTime(uint256 orderId) public view returns (uint256) {
        return orders[orderId].autoReleaseTime + _pauseExtension(orderId);
    }

    /// @notice When claimDisputeTimeout becomes possible, including pauses. Meaningful while the order is Disputed.
    function disputeTimeoutAt(uint256 orderId) public view returns (uint256) {
        return uint256(disputes[orderId].openedAt) + DISPUTE_TIMEOUT + _pauseExtension(orderId);
    }

    // --- Buyer / seller functions ---

    /// @notice Creates and funds an escrow order in a single transaction.
    function createAndFundOrder(
        address seller,
        address token,
        uint256 amount,
        uint256 deliveryDays
    ) external nonReentrant whenNotPaused returns (uint256 orderId) {
        if (seller == address(0) || seller == msg.sender) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (deliveryDays == 0 || deliveryDays > MAX_DEADLINE_DAYS) revert InvalidDeadline();
        if (!acceptedTokens[token]) revert TokenNotAccepted();

        orderCount++;
        orderId = orderCount;

        uint256 deadline = block.timestamp + (deliveryDays * 1 days);

        orders[orderId] = Order({
            buyer: msg.sender,
            seller: seller,
            token: token,
            amount: amount,
            deadline: deadline,
            autoReleaseTime: 0,
            deliveryHash: bytes32(0),
            status: OrderStatus.Funded
        });
        pauseSnapshot[orderId] = _pausedTotal;

        emit OrderFunded(orderId, msg.sender, seller, token, amount, deadline);

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Buyer agrees to give the seller more time. Only moves the deadline forward.
    function extendDeadline(uint256 orderId, uint256 newDeadline) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Funded) revert InvalidStatus(order.status, OrderStatus.Funded);
        if (msg.sender != order.buyer) revert Unauthorized();
        uint256 oldDeadline = effectiveDeadline(orderId);
        if (newDeadline <= oldDeadline || newDeadline > block.timestamp + MAX_DEADLINE_DAYS * 1 days) {
            revert InvalidDeadline();
        }

        order.deadline = newDeadline;
        pauseSnapshot[orderId] = _pausedTotal;
        emit DeadlineExtended(orderId, oldDeadline, newDeadline);
    }

    /// @notice Registers delivery. Only the seller, only before the deadline, while the order is Funded or while a
    ///         dispute the buyer opened before any delivery is pending (the order then stays Disputed and the delivery
    ///         counts for the default outcome).
    function submitDelivery(uint256 orderId, bytes32 deliveryHash) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        bool inDispute = order.status == OrderStatus.Disputed && order.deliveryHash == bytes32(0);
        if (order.status != OrderStatus.Funded && !inDispute) revert InvalidStatus(order.status, OrderStatus.Funded);
        if (msg.sender != order.seller) revert Unauthorized();
        if (block.timestamp > effectiveDeadline(orderId)) revert DeadlinePassed();
        if (deliveryHash == bytes32(0)) revert InvalidAmount();

        order.deliveryHash = deliveryHash;
        if (inDispute) {
            emit DeliverySubmitted(orderId, msg.sender, deliveryHash, 0);
            return;
        }

        uint256 autoRelease = block.timestamp + AUTO_RELEASE_DURATION;
        order.status = OrderStatus.Delivered;
        order.autoReleaseTime = autoRelease;
        pauseSnapshot[orderId] = _pausedTotal;

        emit DeliverySubmitted(orderId, msg.sender, deliveryHash, autoRelease);
    }

    /// @notice Buyer approves the delivery and releases funds to the seller minus the protocol fee.
    ///         Not blocked by pause: it is the buyer's own decision.
    function approveDelivery(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Delivered) revert InvalidStatus(order.status, OrderStatus.Delivered);
        if (msg.sender != order.buyer) revert Unauthorized();

        _executeRelease(orderId, order);
    }

    /// @notice Releases funds after the review window passes without a dispute. Anyone can call it.
    function claimAutoRelease(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Delivered) revert InvalidStatus(order.status, OrderStatus.Delivered);
        if (block.timestamp < effectiveAutoReleaseTime(orderId)) revert AutoReleaseNotReady();

        _executeRelease(orderId, order);
    }

    /// @notice Full refund to the buyer if nothing was delivered before the deadline. Not blocked by pause, but the
    ///         deadline does not run while paused.
    function claimTimeoutRefund(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Funded) revert InvalidStatus(order.status, OrderStatus.Funded);
        if (msg.sender != order.buyer) revert Unauthorized();
        if (block.timestamp <= effectiveDeadline(orderId)) revert DeadlineNotPassed();

        order.status = OrderStatus.Refunded;
        uint256 refundAmount = order.amount;

        emit OrderRefunded(orderId, order.buyer, refundAmount);

        _credit(orderId, order.token, order.buyer, refundAmount);
    }

    /// @notice Opens a dispute. The buyer can dispute a Funded or Delivered order; the seller only a Delivered one.
    ///         Not blocked by pause. Any other status reverts InvalidStatus(current, Delivered).
    function openDispute(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        bool delivered = order.status == OrderStatus.Delivered;
        if (!delivered && order.status != OrderStatus.Funded) {
            revert InvalidStatus(order.status, OrderStatus.Delivered);
        }
        if (msg.sender != order.buyer && !(delivered && msg.sender == order.seller)) revert Unauthorized();

        // Fold the pauses so far into the deadline, then restart the pause clock for the dispute timeout.
        if (!delivered) order.deadline = effectiveDeadline(orderId);
        pauseSnapshot[orderId] = pausedTime();

        order.status = OrderStatus.Disputed;
        disputes[orderId] = DisputeInfo({openedAt: uint64(block.timestamp), fromDelivered: delivered});
        emit DisputeOpened(orderId, msg.sender);
    }

    // --- Dispute resolution ---

    /// @notice The arbitrator splits the order amount. The fee applies to the seller part only.
    function resolveDispute(
        uint256 orderId,
        uint256 sellerAmount,
        uint256 buyerRefund
    ) external nonReentrant whenNotPaused onlyArbitrator {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Disputed) revert InvalidStatus(order.status, OrderStatus.Disputed);
        if (sellerAmount + buyerRefund != order.amount) revert DisputeMathMismatch();

        _settleDispute(orderId, order, sellerAmount, buyerRefund);
    }

    /// @inheritdoc IArbitrable
    function rule(uint256 disputeId, uint256 ruling) external nonReentrant whenNotPaused onlyArbitrator {
        Order storage order = orders[disputeId];
        if (order.status != OrderStatus.Disputed) revert InvalidStatus(order.status, OrderStatus.Disputed);
        if (ruling > 2) revert InvalidRuling();

        emit Ruling(msg.sender, disputeId, ruling);

        if (ruling == 1) {
            _settleDispute(disputeId, order, 0, order.amount);
        } else if (ruling == 2) {
            _settleDispute(disputeId, order, order.amount, 0);
        } else {
            _applyDefaultOutcome(disputeId, order);
        }
    }

    /// @notice After DISPUTE_TIMEOUT without a ruling anyone can apply the default outcome: if the seller delivered
    ///         (before the dispute or during it), the seller is paid; if not, the buyer is refunded once the deadline
    ///         has also passed. Not blocked by pause (the outcome needs no third-party decision), but the timeout and
    ///         the deadline do not run while paused.
    function claimDisputeTimeout(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Disputed) revert InvalidStatus(order.status, OrderStatus.Disputed);
        if (block.timestamp < disputeTimeoutAt(orderId)) revert DisputeTimeoutNotReached();
        if (order.deliveryHash == bytes32(0) && block.timestamp <= effectiveDeadline(orderId)) revert DeadlineNotPassed();

        emit DisputeTimeoutClaimed(orderId, msg.sender);
        _applyDefaultOutcome(orderId, order);
    }

    // --- Withdrawals ---

    /// @notice Withdraws all settled funds of the caller in `token` to `to`. Never blocked by pause. A blacklisted
    ///         account can send its balance to another address.
    function withdraw(address token, address to) external nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        uint256 amount = withdrawable[token][msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        withdrawable[token][msg.sender] = 0;
        totalWithdrawable[token] -= amount;
        emit Withdrawn(token, msg.sender, to, amount);

        IERC20(token).safeTransfer(to, amount);
    }

    // --- Internal helpers ---

    function _applyDefaultOutcome(uint256 orderId, Order storage order) internal {
        if (order.deliveryHash != bytes32(0)) {
            _settleDispute(orderId, order, order.amount, 0);
        } else {
            _settleDispute(orderId, order, 0, order.amount);
        }
    }

    function _settleDispute(uint256 orderId, Order storage order, uint256 sellerAmount, uint256 buyerRefund) internal {
        order.status = OrderStatus.Resolved;

        uint256 fee = 0;
        uint256 sellerPayout = 0;
        if (sellerAmount > 0) {
            fee = (sellerAmount * FEE_BPS) / FEE_DENOMINATOR;
            sellerPayout = sellerAmount - fee;
        }

        emit DisputeResolved(orderId, sellerPayout, buyerRefund, fee);

        _credit(orderId, order.token, order.buyer, buyerRefund);
        _credit(orderId, order.token, order.seller, sellerPayout);
        _credit(orderId, order.token, feeRecipient, fee);
    }

    function _executeRelease(uint256 orderId, Order storage order) internal {
        order.status = OrderStatus.Released;

        uint256 total = order.amount;
        uint256 fee = (total * FEE_BPS) / FEE_DENOMINATOR;
        uint256 sellerPayout = total - fee;

        emit OrderReleased(orderId, sellerPayout, fee);

        _credit(orderId, order.token, order.seller, sellerPayout);
        _credit(orderId, order.token, feeRecipient, fee);
    }

    function _credit(uint256 orderId, address token, address account, uint256 amount) internal {
        if (amount == 0) return;
        withdrawable[token][account] += amount;
        totalWithdrawable[token] += amount;
        emit Credited(orderId, token, account, amount);
    }

    // --- Admin / configuration (same as v2, so EscrowAdmin works unchanged) ---

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert InvalidAddress();
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    function setArbitrator(address newArbitrator) external onlyOwner {
        if (newArbitrator == address(0)) revert InvalidAddress();
        address oldArbitrator = arbitrator;
        arbitrator = newArbitrator;
        emit ArbitratorUpdated(oldArbitrator, newArbitrator);
    }

    /// @notice Only plain ERC-20 tokens (USDC): fee-on-transfer or rebasing tokens break the escrow accounting.
    function setAcceptedToken(address token, bool allowed) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        acceptedTokens[token] = allowed;
        emit TokenWhitelisted(token, allowed);
    }

    function pause() external onlyOwner {
        _pausedAt = block.timestamp;
        _pause();
    }

    function unpause() external onlyOwner {
        _pausedTotal += block.timestamp - _pausedAt;
        _unpause();
    }

    /// @dev Disabled: without an owner a paused escrow could never be unpaused.
    function renounceOwnership() public pure override {
        revert RenounceDisabled();
    }
}
