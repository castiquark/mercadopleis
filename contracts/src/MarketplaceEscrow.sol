// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title MarketplaceEscrow
 * @author mercadopleis
 * @notice Non-custodial escrow contract for crypto service marketplace.
 *         Operates with single-milestone orders, auto-release timeout,
 *         timeout refund protections, and flexible dispute resolution.
 */
contract MarketplaceEscrow is ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    // --- Constants ---
    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant MAX_FEE_BPS = 1_000; // 10% hard cap in basis points
    uint256 public constant AUTO_RELEASE_DURATION = 5 days; // 120 hours window for buyer review

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

    // --- State Variables ---
    uint256 public feeBps;
    address public feeRecipient;
    address public arbitrator;
    uint256 public orderCount;

    mapping(uint256 => Order) public orders;
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

    event DeliverySubmitted(
        uint256 indexed orderId,
        address indexed seller,
        bytes32 deliveryHash,
        uint256 autoReleaseTime
    );

    event OrderReleased(
        uint256 indexed orderId,
        uint256 sellerPayout,
        uint256 platformFee
    );

    event OrderRefunded(
        uint256 indexed orderId,
        address indexed buyer,
        uint256 refundAmount
    );

    event DisputeOpened(
        uint256 indexed orderId,
        address indexed openedBy
    );

    event DisputeResolved(
        uint256 indexed orderId,
        uint256 sellerPayout,
        uint256 buyerRefund,
        uint256 platformFee
    );

    event FeeBpsUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    event ArbitratorUpdated(address oldArbitrator, address newArbitrator);
    event TokenWhitelisted(address indexed token, bool allowed);

    // --- Errors ---
    error InvalidAddress();
    error InvalidAmount();
    error InvalidFee();
    error TokenNotAccepted();
    error InvalidDeadline();
    error OrderNotFound();
    error InvalidStatus(OrderStatus current, OrderStatus expected);
    error Unauthorized();
    error DeadlineNotPassed();
    error AutoReleaseNotReady();
    error DisputeMathMismatch();

    // --- Modifiers ---
    modifier onlyArbitrator() {
        if (msg.sender != arbitrator) revert Unauthorized();
        _;
    }

    /**
     * @param initialOwner Address of contract administrator
     * @param _feeRecipient Address collecting protocol fees
     * @param _arbitrator Address authorized to resolve formal disputes
     * @param _initialFeeBps Initial protocol fee in basis points (e.g. 300 = 3%)
     */
    constructor(
        address initialOwner,
        address _feeRecipient,
        address _arbitrator,
        uint256 _initialFeeBps
    ) Ownable(initialOwner) {
        if (initialOwner == address(0) || _feeRecipient == address(0) || _arbitrator == address(0)) {
            revert InvalidAddress();
        }
        if (_initialFeeBps > MAX_FEE_BPS) revert InvalidFee();

        feeRecipient = _feeRecipient;
        arbitrator = _arbitrator;
        feeBps = _initialFeeBps;
    }

    // --- External / User Functions ---

    /**
     * @notice Creates and funds an escrow order in a single transaction.
     * @param seller Address of service provider
     * @param token ERC20 token address (e.g., USDC)
     * @param amount Total gross amount in token smallest units
     * @param deliveryDays Agreed delivery timeframe in days
     * @return orderId Unique identifier of created order
     */
    function createAndFundOrder(
        address seller,
        address token,
        uint256 amount,
        uint256 deliveryDays
    ) external nonReentrant whenNotPaused returns (uint256 orderId) {
        if (seller == address(0) || seller == msg.sender) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (deliveryDays == 0 || deliveryDays > 365) revert InvalidDeadline();
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

        // Pull payment from buyer into escrow
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice Registers delivery of service by seller.
     * @param orderId Identifier of order
     * @param deliveryHash Cryptographic hash (SHA256/Keccak256) of deliverables
     */
    function submitDelivery(
        uint256 orderId,
        bytes32 deliveryHash
    ) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Funded) {
            revert InvalidStatus(order.status, OrderStatus.Funded);
        }
        if (msg.sender != order.seller) revert Unauthorized();
        if (deliveryHash == bytes32(0)) revert InvalidAmount();

        uint256 autoRelease = block.timestamp + AUTO_RELEASE_DURATION;
        order.status = OrderStatus.Delivered;
        order.deliveryHash = deliveryHash;
        order.autoReleaseTime = autoRelease;

        emit DeliverySubmitted(orderId, msg.sender, deliveryHash, autoRelease);
    }

    /**
     * @notice Buyer approves delivery and releases funds to seller minus protocol fee.
     * @param orderId Identifier of order
     */
    function approveDelivery(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Delivered) {
            revert InvalidStatus(order.status, OrderStatus.Delivered);
        }
        if (msg.sender != order.buyer) revert Unauthorized();

        _executeRelease(orderId, order);
    }

    /**
     * @notice Releases funds after the 5-day review window passes without dispute.
     *         Can be executed by seller or any participant.
     * @param orderId Identifier of order
     */
    function claimAutoRelease(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Delivered) {
            revert InvalidStatus(order.status, OrderStatus.Delivered);
        }
        if (block.timestamp < order.autoReleaseTime) {
            revert AutoReleaseNotReady();
        }

        _executeRelease(orderId, order);
    }

    /**
     * @notice Direct refund to buyer if seller fails to submit delivery before deadline.
     *         Guarantees buyer funds cannot remain hostage.
     * @param orderId Identifier of order
     */
    function claimTimeoutRefund(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Funded) {
            revert InvalidStatus(order.status, OrderStatus.Funded);
        }
        if (msg.sender != order.buyer) revert Unauthorized();
        if (block.timestamp <= order.deadline) revert DeadlineNotPassed();

        order.status = OrderStatus.Refunded;
        uint256 refundAmount = order.amount;

        emit OrderRefunded(orderId, order.buyer, refundAmount);

        IERC20(order.token).safeTransfer(order.buyer, refundAmount);
    }

    /**
     * @notice Opens a dispute, freezing funds until arbitrator resolution.
     * @param orderId Identifier of order
     */
    function openDispute(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Funded && order.status != OrderStatus.Delivered) {
            revert InvalidStatus(order.status, OrderStatus.Delivered);
        }
        if (msg.sender != order.buyer && msg.sender != order.seller) {
            revert Unauthorized();
        }

        order.status = OrderStatus.Disputed;
        emit DisputeOpened(orderId, msg.sender);
    }

    /**
     * @notice Arbitrator settles dispute by dividing funds flexibly.
     *         Protocol fee applies strictly on seller payout portion.
     * @param orderId Identifier of order
     * @param sellerAmount Gross portion awarded to seller
     * @param buyerRefund Portion refunded to buyer
     */
    function resolveDispute(
        uint256 orderId,
        uint256 sellerAmount,
        uint256 buyerRefund
    ) external nonReentrant onlyArbitrator {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Disputed) {
            revert InvalidStatus(order.status, OrderStatus.Disputed);
        }
        if (sellerAmount + buyerRefund != order.amount) {
            revert DisputeMathMismatch();
        }

        order.status = OrderStatus.Resolved;

        uint256 fee = 0;
        uint256 sellerPayout = 0;

        if (sellerAmount > 0) {
            fee = (sellerAmount * feeBps) / FEE_DENOMINATOR;
            sellerPayout = sellerAmount - fee;
        }

        emit DisputeResolved(orderId, sellerPayout, buyerRefund, fee);

        if (buyerRefund > 0) {
            IERC20(order.token).safeTransfer(order.buyer, buyerRefund);
        }
        if (sellerPayout > 0) {
            IERC20(order.token).safeTransfer(order.seller, sellerPayout);
        }
        if (fee > 0) {
            IERC20(order.token).safeTransfer(feeRecipient, fee);
        }
    }

    // --- Internal Helpers ---

    function _executeRelease(uint256 orderId, Order storage order) internal {
        order.status = OrderStatus.Released;

        uint256 total = order.amount;
        uint256 fee = (total * feeBps) / FEE_DENOMINATOR;
        uint256 sellerPayout = total - fee;

        emit OrderReleased(orderId, sellerPayout, fee);

        if (sellerPayout > 0) {
            IERC20(order.token).safeTransfer(order.seller, sellerPayout);
        }
        if (fee > 0) {
            IERC20(order.token).safeTransfer(feeRecipient, fee);
        }
    }

    // --- Admin / Configuration Functions ---

    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert InvalidFee();
        uint256 oldFeeBps = feeBps;
        feeBps = newFeeBps;
        emit FeeBpsUpdated(oldFeeBps, newFeeBps);
    }

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
