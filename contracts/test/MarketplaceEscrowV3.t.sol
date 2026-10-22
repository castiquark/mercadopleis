// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {MarketplaceEscrowV3} from "../src/MarketplaceEscrowV3.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract MarketplaceEscrowV3Test is Test {
    MarketplaceEscrowV3 escrow;
    MockUSDC usdc;
    address owner = makeAddr("owner");
    address feeRecipient = makeAddr("fee");
    address arbitrator = makeAddr("arbitrator");
    address buyer = makeAddr("buyer");
    address seller = makeAddr("seller");
    uint256 constant AMOUNT = 100e6;
    bytes32 constant H = keccak256("deliverable");

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new MarketplaceEscrowV3(owner, feeRecipient, arbitrator);
        vm.prank(owner);
        escrow.setAcceptedToken(address(usdc), true);
        usdc.mint(buyer, 1_000e6);
        vm.prank(buyer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function _fund() internal returns (uint256 id) {
        vm.prank(buyer);
        id = escrow.createAndFundOrder(seller, address(usdc), AMOUNT, 1);
    }

    function _status(uint256 id) internal view returns (MarketplaceEscrowV3.OrderStatus s) {
        (,,,,,,, s) = escrow.orders(id);
    }

    function _deliver(uint256 id) internal {
        vm.prank(seller);
        escrow.submitDelivery(id, H);
    }

    // --- happy path and fee ---

    function test_HappyPath_ChargesThreePercentToSeller() public {
        uint256 id = _fund();
        _deliver(id);
        vm.prank(buyer);
        escrow.approveDelivery(id);
        assertEq(usdc.balanceOf(seller), 97e6);
        assertEq(usdc.balanceOf(feeRecipient), 3e6);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_DeliveryOnTheDeadlineIsAccepted() public {
        uint256 id = _fund();
        (,,,, uint256 deadline,,,) = escrow.orders(id);
        vm.warp(deadline);
        _deliver(id);
        assertEq(uint8(_status(id)), uint8(MarketplaceEscrowV3.OrderStatus.Delivered));
    }

    function test_AutoReleaseAfterWindowOnly() public {
        uint256 id = _fund();
        _deliver(id);
        vm.expectRevert(MarketplaceEscrowV3.AutoReleaseNotReady.selector);
        escrow.claimAutoRelease(id);
        vm.warp(block.timestamp + 5 days);
        escrow.claimAutoRelease(id);
        assertEq(usdc.balanceOf(seller), 97e6);
    }

    // --- deadline extension ---

    function test_BuyerCanExtendDeadlineAndSellerThenDelivers() public {
        uint256 id = _fund();
        vm.warp(block.timestamp + 2 days);
        vm.prank(seller);
        vm.expectRevert(MarketplaceEscrowV3.DeadlinePassed.selector);
        escrow.submitDelivery(id, H);

        vm.prank(buyer);
        escrow.extendDeadline(id, block.timestamp + 3 days);
        _deliver(id);
        assertEq(uint8(_status(id)), uint8(MarketplaceEscrowV3.OrderStatus.Delivered));
    }

    function test_OnlyBuyerExtendsAndOnlyForward() public {
        uint256 id = _fund();
        (,,,, uint256 deadline,,,) = escrow.orders(id);
        vm.prank(seller);
        vm.expectRevert(MarketplaceEscrowV3.Unauthorized.selector);
        escrow.extendDeadline(id, deadline + 1 days);
        vm.prank(buyer);
        vm.expectRevert(MarketplaceEscrowV3.InvalidDeadline.selector);
        escrow.extendDeadline(id, deadline);
        vm.prank(buyer);
        vm.expectRevert(MarketplaceEscrowV3.InvalidDeadline.selector);
        escrow.extendDeadline(id, block.timestamp + 366 days);
    }

    // --- disputes ---

    function test_SellerCanDisputeDeliveredOrderButNotFunded() public {
        uint256 a = _fund();
        vm.prank(seller);
        vm.expectRevert(MarketplaceEscrowV3.Unauthorized.selector);
        escrow.openDispute(a);

        _deliver(a);
        vm.prank(seller);
        escrow.openDispute(a);
        assertEq(uint8(_status(a)), uint8(MarketplaceEscrowV3.OrderStatus.Disputed));
    }

    function test_StrangerCannotDispute() public {
        uint256 id = _fund();
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(MarketplaceEscrowV3.Unauthorized.selector);
        escrow.openDispute(id);
    }

    function test_TimeoutNotReachedReverts() public {
        uint256 id = _fund();
        vm.prank(buyer);
        escrow.openDispute(id);
        vm.warp(block.timestamp + 30 days - 1);
        vm.expectRevert(MarketplaceEscrowV3.DisputeTimeoutNotReached.selector);
        escrow.claimDisputeTimeout(id);
    }

    function test_TimeoutAfterDelivery_SplitsFiftyFiftyWithFeeOnSellerHalf() public {
        uint256 id = _fund();
        _deliver(id);
        vm.prank(buyer);
        escrow.openDispute(id);
        vm.warp(block.timestamp + 30 days);
        escrow.claimDisputeTimeout(id);
        assertEq(usdc.balanceOf(seller), 485e5); // 50 - 3% of 50 = 48.5
        assertEq(usdc.balanceOf(feeRecipient), 15e5);
        assertEq(usdc.balanceOf(buyer), 1_000e6 - AMOUNT + 50e6);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_ArbitratorSplitStillWorks() public {
        uint256 id = _fund();
        _deliver(id);
        vm.prank(buyer);
        escrow.openDispute(id);
        vm.prank(arbitrator);
        escrow.resolveDispute(id, 60e6, 40e6);
        assertEq(usdc.balanceOf(seller), 582e5);
        assertEq(usdc.balanceOf(feeRecipient), 18e5);
        vm.prank(arbitrator);
        vm.expectRevert();
        escrow.resolveDispute(id, 60e6, 40e6); // already resolved
    }

    function test_ResolveDisputeRejectsBadMath() public {
        uint256 id = _fund();
        vm.prank(buyer);
        escrow.openDispute(id);
        vm.prank(arbitrator);
        vm.expectRevert(MarketplaceEscrowV3.DisputeMathMismatch.selector);
        escrow.resolveDispute(id, 60e6, 41e6);
    }

    function test_OnlyArbitratorResolves() public {
        uint256 id = _fund();
        vm.prank(buyer);
        escrow.openDispute(id);
        vm.expectRevert(MarketplaceEscrowV3.Unauthorized.selector);
        escrow.resolveDispute(id, AMOUNT, 0);
        vm.expectRevert(MarketplaceEscrowV3.Unauthorized.selector);
        escrow.rule(id, 1);
    }

    // --- ERC-792-style rule() ---

    function test_Rule_BuyerSellerAndRefused() public {
        uint256 a = _fund();
        vm.prank(buyer);
        escrow.openDispute(a);
        vm.prank(arbitrator);
        escrow.rule(a, 1);
        assertEq(usdc.balanceOf(buyer), 1_000e6);

        uint256 b = _fund();
        _deliver(b);
        vm.prank(buyer);
        escrow.openDispute(b);
        vm.prank(arbitrator);
        escrow.rule(b, 2);
        assertEq(usdc.balanceOf(seller), 97e6);

        uint256 c = _fund();
        _deliver(c);
        vm.prank(buyer);
        escrow.openDispute(c);
        vm.prank(arbitrator);
        escrow.rule(c, 0); // refused: default outcome for a delivered order = 50/50
        assertEq(usdc.balanceOf(seller), 97e6 + 485e5);

        uint256 d = _fund();
        vm.prank(buyer);
        escrow.openDispute(d);
        vm.prank(arbitrator);
        vm.expectRevert(MarketplaceEscrowV3.InvalidRuling.selector);
        escrow.rule(d, 3);
    }

    // --- pause semantics ---

    function test_PauseKeepsBuyerExitsOpenAndBlocksTheRest() public {
        uint256 delivered = _fund();
        _deliver(delivered);
        uint256 funded = _fund();
        uint256 toDispute = _fund();
        vm.prank(owner);
        escrow.pause();

        // blocked
        vm.prank(buyer);
        vm.expectRevert();
        escrow.createAndFundOrder(seller, address(usdc), AMOUNT, 1);
        vm.prank(seller);
        vm.expectRevert();
        escrow.submitDelivery(funded, H);
        vm.warp(block.timestamp + 5 days);
        vm.expectRevert();
        escrow.claimAutoRelease(delivered);

        // open: buyer exits
        vm.prank(buyer);
        escrow.claimTimeoutRefund(funded);
        vm.prank(buyer);
        escrow.openDispute(toDispute);
        vm.prank(buyer);
        escrow.approveDelivery(delivered);

        // arbitrator paths blocked while paused, work again after unpause
        vm.prank(arbitrator);
        vm.expectRevert();
        escrow.resolveDispute(toDispute, 0, AMOUNT);
        vm.warp(block.timestamp + 30 days);
        vm.expectRevert();
        escrow.claimDisputeTimeout(toDispute);
        vm.prank(owner);
        escrow.unpause();
        escrow.claimDisputeTimeout(toDispute);
        assertEq(uint8(_status(toDispute)), uint8(MarketplaceEscrowV3.OrderStatus.Resolved));
    }

    // --- layout compatibility with v2 readers ---

    function test_OrdersGetterKeepsV2Layout() public {
        uint256 id = _fund();
        (address b, address s, address t, uint256 amount, uint256 deadline, uint256 ar, bytes32 dh, MarketplaceEscrowV3.OrderStatus st) =
            escrow.orders(id);
        assertEq(b, buyer);
        assertEq(s, seller);
        assertEq(t, address(usdc));
        assertEq(amount, AMOUNT);
        assertEq(deadline, block.timestamp + 1 days);
        assertEq(ar, 0);
        assertEq(dh, bytes32(0));
        assertEq(uint8(st), 1);
    }

    // --- fuzz: funds are conserved ---

    function testFuzz_ArbitratorSplitConservesFunds(uint96 amount, uint96 sellerPart) public {
        amount = uint96(bound(amount, 1, 500e6));
        sellerPart = uint96(bound(sellerPart, 0, amount));
        vm.prank(buyer);
        uint256 id = escrow.createAndFundOrder(seller, address(usdc), amount, 1);
        vm.prank(buyer);
        escrow.openDispute(id);
        vm.prank(arbitrator);
        escrow.resolveDispute(id, sellerPart, amount - sellerPart);

        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(usdc.balanceOf(buyer) + usdc.balanceOf(seller) + usdc.balanceOf(feeRecipient), 1_000e6);
        assertEq(usdc.balanceOf(feeRecipient), (uint256(sellerPart) * 300) / 10_000);
    }

    function testFuzz_DefaultOutcomeConservesFunds(uint96 amount, bool delivered) public {
        amount = uint96(bound(amount, 1, 500e6));
        vm.prank(buyer);
        uint256 id = escrow.createAndFundOrder(seller, address(usdc), amount, 1);
        if (delivered) _deliver(id);
        vm.prank(buyer);
        escrow.openDispute(id);
        vm.warp(block.timestamp + 30 days);
        escrow.claimDisputeTimeout(id);

        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(usdc.balanceOf(buyer) + usdc.balanceOf(seller) + usdc.balanceOf(feeRecipient), 1_000e6);
        if (!delivered) assertEq(usdc.balanceOf(buyer), 1_000e6); // no delivery: full refund, no fee
    }

    function testFuzz_ReleaseConservesFunds(uint96 amount) public {
        amount = uint96(bound(amount, 1, 500e6));
        vm.prank(buyer);
        uint256 id = escrow.createAndFundOrder(seller, address(usdc), amount, 1);
        _deliver(id);
        vm.warp(block.timestamp + 5 days);
        escrow.claimAutoRelease(id);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(usdc.balanceOf(seller) + usdc.balanceOf(feeRecipient), amount);
    }
}

/// @dev Random sequence of actions; the escrow balance must always equal the sum of the open orders.
contract EscrowHandler is Test {
    MarketplaceEscrowV3 public escrow;
    MockUSDC public usdc;
    address public buyer = address(0xB0B);
    address public seller = address(0x5E11);
    address public arbitrator;

    constructor(MarketplaceEscrowV3 _e, MockUSDC _u, address _arb) {
        escrow = _e;
        usdc = _u;
        arbitrator = _arb;
    }

    function fund(uint96 amount) external {
        amount = uint96(bound(amount, 1, 100e6));
        vm.prank(buyer);
        escrow.createAndFundOrder(seller, address(usdc), amount, 1);
    }

    function _id(uint256 seed) internal view returns (uint256) {
        uint256 n = escrow.orderCount();
        return n == 0 ? 0 : (seed % n) + 1;
    }

    function deliver(uint256 seed) external {
        uint256 id = _id(seed);
        vm.prank(seller);
        try escrow.submitDelivery(id, bytes32(uint256(7))) {} catch {}
    }

    function approve(uint256 seed) external {
        uint256 id = _id(seed);
        vm.prank(buyer);
        try escrow.approveDelivery(id) {} catch {}
    }

    function refund(uint256 seed) external {
        uint256 id = _id(seed);
        vm.prank(buyer);
        try escrow.claimTimeoutRefund(id) {} catch {}
    }

    function dispute(uint256 seed, bool bySeller) external {
        uint256 id = _id(seed);
        vm.prank(bySeller ? seller : buyer);
        try escrow.openDispute(id) {} catch {}
    }

    function resolve(uint256 seed, uint96 part) external {
        uint256 id = _id(seed);
        (,,, uint256 amount,,,,) = escrow.orders(id);
        part = uint96(bound(part, 0, amount));
        vm.prank(arbitrator);
        try escrow.resolveDispute(id, part, amount - part) {} catch {}
    }

    function timeoutDispute(uint256 seed) external {
        uint256 id = _id(seed);
        try escrow.claimDisputeTimeout(id) {} catch {}
    }

    function autoRelease(uint256 seed) external {
        uint256 id = _id(seed);
        try escrow.claimAutoRelease(id) {} catch {}
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 0, 40 days));
    }

    function openAmount() external view returns (uint256 total) {
        uint256 n = escrow.orderCount();
        for (uint256 i = 1; i <= n; i++) {
            (,,, uint256 amount,,,, MarketplaceEscrowV3.OrderStatus st) = escrow.orders(i);
            if (
                st == MarketplaceEscrowV3.OrderStatus.Funded || st == MarketplaceEscrowV3.OrderStatus.Delivered
                    || st == MarketplaceEscrowV3.OrderStatus.Disputed
            ) total += amount;
        }
    }
}

contract MarketplaceEscrowV3InvariantTest is StdInvariant, Test {
    MarketplaceEscrowV3 escrow;
    MockUSDC usdc;
    EscrowHandler handler;
    address feeRecipient = address(0xFEE);
    uint256 constant SUPPLY = 1_000_000e6; // minted to the handler's buyer

    function setUp() public {
        address arbitrator = address(0xA7B);
        usdc = new MockUSDC();
        escrow = new MarketplaceEscrowV3(address(this), feeRecipient, arbitrator);
        escrow.setAcceptedToken(address(usdc), true);
        handler = new EscrowHandler(escrow, usdc, arbitrator);
        usdc.mint(handler.buyer(), SUPPLY);
        vm.prank(handler.buyer());
        usdc.approve(address(escrow), type(uint256).max);
        targetContract(address(handler));
    }

    /// The escrow holds exactly the sum of its open orders (nothing is created, lost or stuck).
    function invariant_EscrowBalanceEqualsOpenOrders() public view {
        assertEq(usdc.balanceOf(address(escrow)), handler.openAmount());
    }

    /// Money is only moved between the four parties.
    function invariant_TotalSupplyIsConserved() public view {
        uint256 total = usdc.balanceOf(address(escrow)) + usdc.balanceOf(handler.buyer()) + usdc.balanceOf(handler.seller())
            + usdc.balanceOf(feeRecipient);
        assertEq(total, SUPPLY + 0);
    }
}
