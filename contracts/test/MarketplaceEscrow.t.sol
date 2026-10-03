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

    uint256 public constant FEE_BPS = 300; // 3% fixed protocol fee
    uint256 public constant ORDER_AMOUNT = 100 * 1e6; // 100 USDC (6 decimals)
    uint256 public constant DELIVERY_DAYS = 7;

    function setUp() public {
        vm.startPrank(owner);
        usdc = new MockUSDC();
        escrow = new MarketplaceEscrow(owner, feeRecipient, arbitrator);
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
        uint256 expectedFee = (ORDER_AMOUNT * FEE_BPS) / 10_000; // 3 * 1e6
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

        uint256 expectedFee = (ORDER_AMOUNT * FEE_BPS) / 10_000;
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

        uint256 expectedFee = (sellerAmount * FEE_BPS) / 10_000; // 3% of 60 = 1.8 USDC
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

    /// @dev The fee is exactly 3% of the total at the end of the escrow: no more, no less, for any amount.
    function testFuzz_FeeIsExactlyThreePercent(uint256 amount) public {
        amount = bound(amount, 1e6, 1_000_000 * 1e6); // Between 1 USDC and 1,000,000 USDC

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

        assertEq(feeGained, (amount * 300) / 10_000); // exactly 3% (integer division, rounds down by less than 1e-6 USDC)
        assertEq(sellerGained, amount - feeGained); // the seller receives everything else
        assertEq(sellerGained + feeGained, amount); // nothing is lost or created
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function testFuzz_FinancialInvariant(uint256 amount) public {
        amount = bound(amount, 1e6, 1_000_000 * 1e6);
        usdc.mint(buyer, amount);

        vm.prank(buyer);
        uint256 orderId = escrow.createAndFundOrder(seller, address(usdc), amount, 3);
        vm.prank(seller);
        escrow.submitDelivery(orderId, keccak256("fuzz_test_delivery"));
        vm.prank(buyer);
        escrow.approveDelivery(orderId);

        assertEq(usdc.balanceOf(seller) + usdc.balanceOf(feeRecipient), amount);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    // --- Fixed fee guarantees ---

    function test_FeeIsFixedAtThreePercent() public view {
        assertEq(escrow.FEE_BPS(), 300);
        assertEq(escrow.feeBps(), 300); // compatibility getter
        assertEq(escrow.FEE_DENOMINATOR(), 10_000);
    }

    function test_NoFunctionCanChangeTheFee() public {
        bytes[3] memory attempts = [
            abi.encodeWithSignature("setFeeBps(uint256)", uint256(1_000)),
            abi.encodeWithSignature("setFeeBps(uint256)", uint256(0)),
            abi.encodeWithSignature("setFee(uint256)", uint256(500))
        ];
        for (uint256 i = 0; i < attempts.length; i++) {
            vm.prank(owner);
            (bool ok, ) = address(escrow).call(attempts[i]);
            assertFalse(ok, "no fee setter must exist, not even for the owner");
        }
        assertEq(escrow.feeBps(), 300);
    }

    function test_OwnerCannotChangeTheFeeOfAnOrderInFlight() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createAndFundOrder(seller, address(usdc), ORDER_AMOUNT, DELIVERY_DAYS);
        vm.prank(seller);
        escrow.submitDelivery(orderId, keccak256("work"));

        vm.prank(owner);
        (bool ok, ) = address(escrow).call(abi.encodeWithSignature("setFeeBps(uint256)", uint256(1_000)));
        assertFalse(ok);

        vm.prank(buyer);
        escrow.approveDelivery(orderId);

        assertEq(usdc.balanceOf(feeRecipient), 3 * 1e6); // exactly 3% of 100 USDC
        assertEq(usdc.balanceOf(seller), 97 * 1e6);
    }

    function test_TimeoutRefundChargesNoFee() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createAndFundOrder(seller, address(usdc), ORDER_AMOUNT, DELIVERY_DAYS);
        vm.warp(block.timestamp + (DELIVERY_DAYS * 1 days) + 1);
        vm.prank(buyer);
        escrow.claimTimeoutRefund(orderId);

        assertEq(usdc.balanceOf(feeRecipient), 0);
        assertEq(usdc.balanceOf(seller), 0);
    }

    function test_DisputeAwardedEntirelyToSellerChargesExactlyThreePercentOfTotal() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createAndFundOrder(seller, address(usdc), ORDER_AMOUNT, DELIVERY_DAYS);
        vm.prank(seller);
        escrow.submitDelivery(orderId, keccak256("work"));
        vm.prank(buyer);
        escrow.openDispute(orderId);

        vm.prank(arbitrator);
        escrow.resolveDispute(orderId, ORDER_AMOUNT, 0);

        assertEq(usdc.balanceOf(feeRecipient), 3 * 1e6);
        assertEq(usdc.balanceOf(seller), 97 * 1e6);
    }

    function test_DisputeRefundedEntirelyToBuyerChargesNoFee() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createAndFundOrder(seller, address(usdc), ORDER_AMOUNT, DELIVERY_DAYS);
        vm.prank(seller);
        escrow.submitDelivery(orderId, keccak256("work"));
        vm.prank(buyer);
        escrow.openDispute(orderId);

        uint256 buyerBefore = usdc.balanceOf(buyer);
        vm.prank(arbitrator);
        escrow.resolveDispute(orderId, 0, ORDER_AMOUNT);

        assertEq(usdc.balanceOf(feeRecipient), 0);
        assertEq(usdc.balanceOf(buyer), buyerBefore + ORDER_AMOUNT);
    }

    function testFuzz_DisputeFeeIsThreePercentOfTheSellerPortion(uint256 amount, uint256 sellerShareBps) public {
        amount = bound(amount, 1e6, 1_000_000 * 1e6);
        sellerShareBps = bound(sellerShareBps, 0, 10_000);
        uint256 sellerAmount = (amount * sellerShareBps) / 10_000;
        uint256 buyerRefund = amount - sellerAmount;

        usdc.mint(buyer, amount);
        vm.prank(buyer);
        uint256 orderId = escrow.createAndFundOrder(seller, address(usdc), amount, 3);
        vm.prank(seller);
        escrow.submitDelivery(orderId, keccak256("work"));
        vm.prank(buyer);
        escrow.openDispute(orderId);

        uint256 buyerBefore = usdc.balanceOf(buyer);
        vm.prank(arbitrator);
        escrow.resolveDispute(orderId, sellerAmount, buyerRefund);

        uint256 expectedFee = (sellerAmount * 300) / 10_000;
        assertEq(usdc.balanceOf(feeRecipient), expectedFee);
        assertEq(usdc.balanceOf(seller), sellerAmount - expectedFee);
        assertEq(usdc.balanceOf(buyer), buyerBefore + buyerRefund);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }
}
