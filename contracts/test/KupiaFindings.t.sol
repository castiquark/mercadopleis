// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MarketplaceEscrow} from "../src/MarketplaceEscrow.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @notice Reproduces the KupiaSec findings on MarketplaceEscrow v2 (Oct 2026). These tests pass while the
///         v2 behavior is present; a v3 that fixes the findings must make them fail (then invert them).
contract KupiaFindingsTest is Test {
    MarketplaceEscrow escrow;
    MockUSDC usdc;
    address owner = makeAddr("owner");
    address arbitrator = makeAddr("arbitrator");
    address buyer = makeAddr("buyer");
    address seller = makeAddr("seller");
    uint256 constant AMOUNT = 100e6;

    function setUp() public {
        vm.startPrank(owner);
        usdc = new MockUSDC();
        escrow = new MarketplaceEscrow(owner, makeAddr("fee"), arbitrator);
        escrow.setAcceptedToken(address(usdc), true);
        vm.stopPrank();
        usdc.mint(buyer, AMOUNT);
        vm.prank(buyer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function _fund() internal returns (uint256 id) {
        vm.prank(buyer);
        id = escrow.createAndFundOrder(seller, address(usdc), AMOUNT, 1);
    }

    function _status(uint256 id) internal view returns (uint8 s) {
        (,,,,,,, MarketplaceEscrow.OrderStatus st) = escrow.orders(id);
        s = uint8(st);
    }

    /// Finding 1: a late seller delivers a junk hash after the deadline, blocks the refund and gets paid after 5 days.
    function test_Finding1_LateDeliveryBlocksRefundAndPaysSeller() public {
        uint256 id = _fund();
        vm.warp(block.timestamp + 3 days); // deadline (1 day) passed, buyer has not claimed yet

        vm.prank(seller);
        escrow.submitDelivery(id, bytes32(uint256(1))); // accepted: no deadline check, any non-zero hash
        assertEq(_status(id), 2); // Delivered

        vm.prank(buyer);
        vm.expectRevert(); // InvalidStatus(Delivered, Funded)
        escrow.claimTimeoutRefund(id);

        vm.warp(block.timestamp + 5 days);
        escrow.claimAutoRelease(id); // anyone
        assertEq(_status(id), 3); // Released
        assertEq(usdc.balanceOf(seller), AMOUNT * 97 / 100);
        assertEq(usdc.balanceOf(buyer), 0);
    }

    /// Finding 2: the seller disputes a Funded order, which blocks the timeout refund with no time limit.
    function test_Finding2_SellerDisputeOnFundedBlocksRefundForever() public {
        uint256 id = _fund();
        vm.prank(seller);
        escrow.openDispute(id);
        assertEq(_status(id), 5); // Disputed

        vm.warp(block.timestamp + 365 days);
        vm.prank(buyer);
        vm.expectRevert();
        escrow.claimTimeoutRefund(id);
        assertEq(_status(id), 5); // still Disputed: only the arbitrator can move it
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
    }

    /// Finding 3: pause() does not stop resolveDispute (arbitrator) while it stops the buyer's refund.
    function test_Finding3_PauseDoesNotBlockResolveDispute() public {
        uint256 id = _fund();
        vm.prank(buyer);
        escrow.openDispute(id);
        vm.prank(owner);
        escrow.pause();

        vm.prank(arbitrator);
        escrow.resolveDispute(id, AMOUNT, 0); // still works while paused
        assertEq(_status(id), 6); // Resolved
    }
}
