// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {MarketplaceEscrow} from "../src/MarketplaceEscrow.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract MarketplaceEscrowTest is Test {
    MarketplaceEscrow public escrow;
    MockUSDC public usdc;

    address public owner = makeAddr("owner");
    address public feeRecipient = makeAddr("feeRecipient");
    address public arbitrator = makeAddr("arbitrator");
    address public buyer = makeAddr("buyer");
    address public seller = makeAddr("seller");

    uint256 public constant INITIAL_FEE_BPS = 300; // 3%
    uint256 public constant ORDER_AMOUNT = 100 * 1e6; // 100 USDC (6 decimals)
    uint256 public constant DELIVERY_DAYS = 7;

    function setUp() public {
        vm.startPrank(owner);
        usdc = new MockUSDC();
        escrow = new MarketplaceEscrow(owner, feeRecipient, arbitrator, INITIAL_FEE_BPS);
        escrow.setAcceptedToken(address(usdc), true);
        vm.stopPrank();

        // Mint USDC to buyer and approve escrow
        usdc.mint(buyer, 10_000 * 1e6);
        vm.prank(buyer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function test_CreateAndFundOrder_Success() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createAndFundOrder(seller, address(usdc), ORDER_AMOUNT, DELIVERY_DAYS);

        assertEq(orderId, 1);
        assertEq(usdc.balanceOf(address(escrow)), ORDER_AMOUNT);

        (
            address orderBuyer,
            address orderSeller,
            address orderToken,
            uint256 orderAmount,
            uint256 deadline,
            uint256 autoReleaseTime,
            bytes32 deliveryHash,
            MarketplaceEscrow.OrderStatus status
        ) = escrow.orders(orderId);

        assertEq(orderBuyer, buyer);
        assertEq(orderSeller, seller);
        assertEq(orderToken, address(usdc));
        assertEq(orderAmount, ORDER_AMOUNT);
        assertEq(deadline, block.timestamp + (DELIVERY_DAYS * 1 days));
        assertEq(autoReleaseTime, 0);
        assertEq(deliveryHash, bytes32(0));
        assertTrue(status == MarketplaceEscrow.OrderStatus.Funded);
    }

    function test_HappyPath_DeliverAndApprove() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createAndFundOrder(seller, address(usdc), ORDER_AMOUNT, DELIVERY_DAYS);

        bytes32 mockHash = keccak256("final_deliverable_v1.zip");

        // Seller submits delivery
        vm.prank(seller);
        escrow.submitDelivery(orderId, mockHash);

        // Buyer approves delivery
        vm.prank(buyer);
        escrow.approveDelivery(orderId);

        // Expected payouts: 3% of 100 USDC = 3 USDC fee, 97 USDC to seller
        uint256 expectedFee = (ORDER_AMOUNT * INITIAL_FEE_BPS) / 10_000; // 3 * 1e6
        uint256 expectedSellerPayout = ORDER_AMOUNT - expectedFee; // 97 * 1e6

        assertEq(usdc.balanceOf(seller), expectedSellerPayout);
        assertEq(usdc.balanceOf(feeRecipient), expectedFee);
        assertEq(usdc.balanceOf(address(escrow)), 0);

        (, , , , , , , MarketplaceEscrow.OrderStatus status) = escrow.orders(orderId);
        assertTrue(status == MarketplaceEscrow.OrderStatus.Released);
    }

    function test_AutoRelease_After5Days() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createAndFundOrder(seller, address(usdc), ORDER_AMOUNT, DELIVERY_DAYS);

        bytes32 mockHash = keccak256("landing_page_source.zip");

        vm.prank(seller);
        escrow.submitDelivery(orderId, mockHash);

        // Fast forward 5 days (120 hours)
        vm.warp(block.timestamp + 5 days);

        // Anyone (or seller) triggers auto-release
        escrow.claimAutoRelease(orderId);

        uint256 expectedFee = (ORDER_AMOUNT * INITIAL_FEE_BPS) / 10_000;
        uint256 expectedSellerPayout = ORDER_AMOUNT - expectedFee;

        assertEq(usdc.balanceOf(seller), expectedSellerPayout);
        assertEq(usdc.balanceOf(feeRecipient), expectedFee);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_TimeoutRefund_WhenSellerFailsToDeliver() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createAndFundOrder(seller, address(usdc), ORDER_AMOUNT, DELIVERY_DAYS);

        uint256 buyerBalanceBefore = usdc.balanceOf(buyer);

        // Fast forward past deadline (7 days + 1 second)
        vm.warp(block.timestamp + (DELIVERY_DAYS * 1 days) + 1);

        // Buyer claims 100% refund
        vm.prank(buyer);
        escrow.claimTimeoutRefund(orderId);

        assertEq(usdc.balanceOf(buyer), buyerBalanceBefore + ORDER_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);

        (, , , , , , , MarketplaceEscrow.OrderStatus status) = escrow.orders(orderId);
        assertTrue(status == MarketplaceEscrow.OrderStatus.Refunded);
    }

    function test_DisputeResolution_FlexibleSplit() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createAndFundOrder(seller, address(usdc), ORDER_AMOUNT, DELIVERY_DAYS);

        bytes32 mockHash = keccak256("partial_deliverable.zip");
        vm.prank(seller);
        escrow.submitDelivery(orderId, mockHash);

        // Buyer opens dispute
        vm.prank(buyer);
        escrow.openDispute(orderId);

        // Arbitrator splits: 60 USDC to seller, 40 USDC refund to buyer
        uint256 sellerAmount = 60 * 1e6;
        uint256 buyerRefund = 40 * 1e6;

        uint256 expectedFee = (sellerAmount * INITIAL_FEE_BPS) / 10_000; // 3% of 60 = 1.8 USDC
        uint256 expectedSellerPayout = sellerAmount - expectedFee; // 58.2 USDC

        vm.prank(arbitrator);
        escrow.resolveDispute(orderId, sellerAmount, buyerRefund);

        assertEq(usdc.balanceOf(buyer), 9900 * 1e6 + buyerRefund);
        assertEq(usdc.balanceOf(seller), expectedSellerPayout);
        assertEq(usdc.balanceOf(feeRecipient), expectedFee);
        assertEq(usdc.balanceOf(address(escrow)), 0); // Strictly zero remaining

        (, , , , , , , MarketplaceEscrow.OrderStatus status) = escrow.orders(orderId);
        assertTrue(status == MarketplaceEscrow.OrderStatus.Resolved);
    }

    function testFuzz_FinancialInvariant(uint256 amount, uint16 feeBps) public {
        vm.assume(amount >= 1e6 && amount <= 1_000_000 * 1e6); // Between 1 USDC and 1,000,000 USDC
        vm.assume(feeBps <= 1_000); // Up to 10% hard cap

        vm.prank(owner);
        escrow.setFeeBps(feeBps);

        usdc.mint(buyer, amount);

        vm.prank(buyer);
        uint256 orderId = escrow.createAndFundOrder(seller, address(usdc), amount, 3);

        vm.prank(seller);
        escrow.submitDelivery(orderId, keccak256("fuzz_test_delivery"));

        uint256 sellerBefore = usdc.balanceOf(seller);
        uint256 feeRecipientBefore = usdc.balanceOf(feeRecipient);

        vm.prank(buyer);
        escrow.approveDelivery(orderId);

        uint256 sellerGained = usdc.balanceOf(seller) - sellerBefore;
        uint256 feeGained = usdc.balanceOf(feeRecipient) - feeRecipientBefore;

        // Mathematical invariant: seller payout + platform fee == total amount paid
        assertEq(sellerGained + feeGained, amount);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }
}
