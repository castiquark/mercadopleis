// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MarketplaceEscrowV3} from "../src/MarketplaceEscrowV3.sol";
import {MockBlacklistUSDC} from "./mocks/MockBlacklistUSDC.sol";

/// @notice Regression tests for the QuillShield findings M1-M3 on the v3 draft (f13bf0f). They only use the v2-compatible
///         interface plus a low-level read of `withdrawable`, so they compile against f13bf0f too, where they fail.
contract MarketplaceEscrowV3FixesTest is Test {
    MarketplaceEscrowV3 escrow;
    MockBlacklistUSDC usdc;
    address owner = makeAddr("owner");
    address feeRecipient = makeAddr("fee");
    address arbitrator = makeAddr("arbitrator");
    address buyer = makeAddr("buyer");
    address seller = makeAddr("seller");
    uint256 constant AMOUNT = 100e6;
    bytes32 constant H = keccak256("deliverable");

    function setUp() public {
        usdc = new MockBlacklistUSDC();
        escrow = new MarketplaceEscrowV3(owner, feeRecipient, arbitrator);
        vm.prank(owner);
        escrow.setAcceptedToken(address(usdc), true);
        usdc.mint(buyer, 1_000e6);
        vm.prank(buyer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function _fund(uint256 days_) internal returns (uint256 id) {
        vm.prank(buyer);
        id = escrow.createAndFundOrder(seller, address(usdc), AMOUNT, days_);
    }

    function _deliver(uint256 id) internal {
        vm.prank(seller);
        escrow.submitDelivery(id, H);
    }

    function _status(uint256 id) internal view returns (uint8 s) {
        MarketplaceEscrowV3.OrderStatus st;
        (,,,,,,, st) = escrow.orders(id);
        s = uint8(st);
    }

    /// Wallet balance plus whatever the escrow has credited to `who` (0 on versions without pull payments).
    function _owed(address who) internal view returns (uint256) {
        (bool ok, bytes memory data) =
            address(escrow).staticcall(abi.encodeWithSignature("withdrawable(address,address)", address(usdc), who));
        uint256 credit = ok && data.length == 32 ? abi.decode(data, (uint256)) : 0;
        return usdc.balanceOf(who) + credit;
    }

    // --- M1: the default outcome depends on the order, not on who opened the dispute ---

    function test_M1_BuyerDisputesGoodDelivery_TimeoutPaysSeller() public {
        uint256 id = _fund(1);
        _deliver(id);
        vm.prank(buyer);
        escrow.openDispute(id);
        vm.warp(block.timestamp + 30 days);
        escrow.claimDisputeTimeout(id);
        assertEq(_owed(seller), 97e6);
        assertEq(_owed(feeRecipient), 3e6);
        assertEq(_owed(buyer), 1_000e6 - AMOUNT);
    }

    function test_M1_SellerCanDeliverDuringFundedDispute_TimeoutPaysSeller() public {
        uint256 id = _fund(3);
        vm.prank(buyer);
        escrow.openDispute(id); // before any delivery
        _deliver(id); // seller still delivers before the deadline
        vm.warp(block.timestamp + 30 days);
        escrow.claimDisputeTimeout(id);
        assertEq(_owed(seller), 97e6);
        assertEq(_owed(buyer), 1_000e6 - AMOUNT);
    }

    function test_M1_NoDeliveryAndDeadlinePassed_TimeoutRefundsBuyer() public {
        uint256 id = _fund(1);
        vm.prank(buyer);
        escrow.openDispute(id);
        vm.warp(block.timestamp + 30 days);
        escrow.claimDisputeTimeout(id);
        assertEq(_owed(buyer), 1_000e6);
        assertEq(_owed(seller), 0);
    }

    // --- M2: a blacklisted party cannot freeze an order or the other parties' money ---

    function test_M2_BlacklistedSeller_ReleaseStillSettlesAndFeeIsPaid() public {
        uint256 id = _fund(1);
        _deliver(id);
        usdc.setBlacklisted(seller, true);
        vm.prank(buyer);
        escrow.approveDelivery(id);
        assertEq(_status(id), uint8(MarketplaceEscrowV3.OrderStatus.Released));
        assertEq(_owed(feeRecipient), 3e6);
    }

    function test_M2_BlacklistedSeller_DisputeTimeoutStillEnds() public {
        uint256 id = _fund(1);
        _deliver(id);
        vm.prank(seller);
        escrow.openDispute(id);
        usdc.setBlacklisted(seller, true);
        vm.warp(block.timestamp + 30 days);
        escrow.claimDisputeTimeout(id);
        assertEq(_status(id), uint8(MarketplaceEscrowV3.OrderStatus.Resolved));
    }

    function test_M2_BlacklistedFeeRecipient_DoesNotBlockRelease() public {
        uint256 id = _fund(1);
        _deliver(id);
        usdc.setBlacklisted(feeRecipient, true);
        vm.prank(buyer);
        escrow.approveDelivery(id);
        assertEq(_owed(seller), 97e6);
    }

    // --- M3: deadlines do not run while the escrow is paused ---

    function test_M3_PauseExtendsDeliveryDeadline() public {
        uint256 id = _fund(1);
        vm.warp(block.timestamp + 12 hours);
        vm.prank(owner);
        escrow.pause();
        vm.warp(block.timestamp + 10 days);
        vm.prank(owner);
        escrow.unpause();

        // 12 h of the deadline were left when the pause started: the buyer cannot refund yet, the seller can deliver
        vm.prank(buyer);
        vm.expectRevert();
        escrow.claimTimeoutRefund(id);
        _deliver(id);
        assertEq(_status(id), uint8(MarketplaceEscrowV3.OrderStatus.Delivered));
    }

    function test_M3_PauseExtendsReviewWindow() public {
        uint256 id = _fund(1);
        _deliver(id);
        vm.prank(owner);
        escrow.pause();
        vm.warp(block.timestamp + 10 days);
        vm.prank(owner);
        escrow.unpause();
        // the buyer still has the full 5-day review window
        vm.expectRevert();
        escrow.claimAutoRelease(id);
        vm.prank(buyer);
        escrow.openDispute(id);
    }
}
