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
 *         - every dispute ends: after DISPUTE_TIMEOUT anyone can apply a default outcome;
 *         - pause stops new exposure and every payout that depends on a third party, but never the
 *           buyer's own exits (timeout refund, dispute, approval).
 * @dev    The protocol fee is a constant (FEE_BPS = 3%) charged on the amount paid to the seller. A full
 *         refund to the buyer carries no fee. The `orders` getter has the same layout as v2 so integrators
 *         keep reading it unchanged; dispute data lives in `disputes`. Admin functions match v2, so
 *         EscrowAdmin (timelock plus guardian) can own this contract unchanged.
 */
contract MarketplaceEscrowV3 is IArbitrable, ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    // --- Constants ---
    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant FEE_BPS = 300; // 3% protocol fee, immutable and not configurable
    uint256 public constant AUTO_RELEASE_DURATION = 5 days; // buyer review window after a delivery
    uint256 public constant DISPUTE_TIMEOUT = 30 days; // after this, anyone can apply the default outcome
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

    // --- Events ---
    event OrderFunded(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount,
        uint256 deadline
    );
    event DeliverySubmitted(uint256 indexed orderId, address indexed seller, bytes32 deliveryHash, uint256 autoReleaseTime);
    event DeadlineExtended(uint256 indexed orderId, uint256 oldDeadline, uint256 newDeadline);
    event OrderReleased(uint256 indexed orderId, uint256 sellerPayout, uint256 platformFee);
    event OrderRefunded(uint256 indexed orderId, address indexed buyer, uint256 refundAmount);
    event DisputeOpened(uint256 indexed orderId, address indexed openedBy);
    event DisputeResolved(uint256 indexed orderId, uint256 sellerPayout, uint256 buyerRefund, uint256 platformFee);
    event DisputeTimeoutClaimed(uint256 indexed orderId, address indexed caller);
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

        emit OrderFunded(orderId, msg.sender, seller, token, amount, deadline);

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Buyer agrees to give the seller more time. Only moves the deadline forward.
    function extendDeadline(uint256 orderId, uint256 newDeadline) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Funded) revert InvalidStatus(order.status, OrderStatus.Funded);
        if (msg.sender != order.buyer) revert Unauthorized();
        if (newDeadline <= order.deadline || newDeadline > block.timestamp + MAX_DEADLINE_DAYS * 1 days) {
            revert InvalidDeadline();
        }

        uint256 oldDeadline = order.deadline;
        order.deadline = newDeadline;
        emit DeadlineExtended(orderId, oldDeadline, newDeadline);
    }

    /// @notice Registers delivery. Only the seller, only while the order is Funded and the deadline has not passed.
    function submitDelivery(uint256 orderId, bytes32 deliveryHash) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Funded) revert InvalidStatus(order.status, OrderStatus.Funded);
        if (msg.sender != order.seller) revert Unauthorized();
        if (block.timestamp > order.deadline) revert DeadlinePassed();
        if (deliveryHash == bytes32(0)) revert InvalidAmount();

        uint256 autoRelease = block.timestamp + AUTO_RELEASE_DURATION;
        order.status = OrderStatus.Delivered;
        order.deliveryHash = deliveryHash;
        order.autoReleaseTime = autoRelease;

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
        if (block.timestamp < order.autoReleaseTime) revert AutoReleaseNotReady();

        _executeRelease(orderId, order);
    }

    /// @notice Full refund to the buyer if nothing was delivered before the deadline. Not blocked by pause.
    function claimTimeoutRefund(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Funded) revert InvalidStatus(order.status, OrderStatus.Funded);
        if (msg.sender != order.buyer) revert Unauthorized();
        if (block.timestamp <= order.deadline) revert DeadlineNotPassed();

        order.status = OrderStatus.Refunded;
        uint256 refundAmount = order.amount;

        emit OrderRefunded(orderId, order.buyer, refundAmount);

        IERC20(order.token).safeTransfer(order.buyer, refundAmount);
    }

    /// @notice Opens a dispute. The buyer can dispute a Funded or Delivered order; the seller only a Delivered one.
    ///         Not blocked by pause.
    function openDispute(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        bool delivered = order.status == OrderStatus.Delivered;
        if (!delivered && order.status != OrderStatus.Funded) {
            revert InvalidStatus(order.status, OrderStatus.Delivered);
        }
        if (msg.sender != order.buyer && !(delivered && msg.sender == order.seller)) revert Unauthorized();

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

    /// @notice After DISPUTE_TIMEOUT without a ruling anyone can apply the default outcome: a dispute opened before any
    ///         delivery refunds the buyer in full; one opened after a delivery splits the amount 50/50.
    function claimDisputeTimeout(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Disputed) revert InvalidStatus(order.status, OrderStatus.Disputed);
        if (block.timestamp < uint256(disputes[orderId].openedAt) + DISPUTE_TIMEOUT) revert DisputeTimeoutNotReached();

        emit DisputeTimeoutClaimed(orderId, msg.sender);
        _applyDefaultOutcome(orderId, order);
    }

    // --- Internal helpers ---

    function _applyDefaultOutcome(uint256 orderId, Order storage order) internal {
        if (disputes[orderId].fromDelivered) {
            uint256 sellerAmount = order.amount / 2;
            _settleDispute(orderId, order, sellerAmount, order.amount - sellerAmount);
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

        if (buyerRefund > 0) IERC20(order.token).safeTransfer(order.buyer, buyerRefund);
        if (sellerPayout > 0) IERC20(order.token).safeTransfer(order.seller, sellerPayout);
        if (fee > 0) IERC20(order.token).safeTransfer(feeRecipient, fee);
    }

    function _executeRelease(uint256 orderId, Order storage order) internal {
        order.status = OrderStatus.Released;

        uint256 total = order.amount;
        uint256 fee = (total * FEE_BPS) / FEE_DENOMINATOR;
        uint256 sellerPayout = total - fee;

        emit OrderReleased(orderId, sellerPayout, fee);

        if (sellerPayout > 0) IERC20(order.token).safeTransfer(order.seller, sellerPayout);
        if (fee > 0) IERC20(order.token).safeTransfer(feeRecipient, fee);
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

    function setAcceptedToken(address token, bool allowed) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        acceptedTokens[token] = allowed;
        emit TokenWhitelisted(token, allowed);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
