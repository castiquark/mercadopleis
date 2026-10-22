// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MarketplaceEscrow} from "../src/MarketplaceEscrow.sol";
import {MarketplaceEscrowV3} from "../src/MarketplaceEscrowV3.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

interface IEscrowLike {
    function createAndFundOrder(address seller, address token, uint256 amount, uint256 deliveryDays) external returns (uint256);
    function submitDelivery(uint256 orderId, bytes32 deliveryHash) external;
    function approveDelivery(uint256 orderId) external;
    function claimAutoRelease(uint256 orderId) external;
    function claimTimeoutRefund(uint256 orderId) external;
    function openDispute(uint256 orderId) external;
    function resolveDispute(uint256 orderId, uint256 sellerAmount, uint256 buyerRefund) external;
    function claimDisputeTimeout(uint256 orderId) external; // v3 only
    function setAcceptedToken(address token, bool allowed) external;
    function pause() external;
    function orders(uint256 id) external view returns (address, address, address, uint256, uint256, uint256, bytes32, uint8);
}

/// @notice The behaviour that KupiaSec's report says the escrow must have. It is written once and run against v3
///         (must pass) and against v2 (must fail, which is how the findings were confirmed).
abstract contract KupiaSpec is Test {
    IEscrowLike escrow;
    MockUSDC usdc;
    address owner = makeAddr("owner");
    address arbitrator = makeAddr("arbitrator");
    address buyer = makeAddr("buyer");
    address seller = makeAddr("seller");
    uint256 constant AMOUNT = 100e6;
    bytes32 constant H = keccak256("deliverable");

    function _deploy() internal virtual returns (IEscrowLike);

    function setUp() public virtual {
        usdc = new MockUSDC();
        escrow = _deploy();
        vm.prank(owner);
        escrow.setAcceptedToken(address(usdc), true);
        usdc.mint(buyer, AMOUNT * 10);
        vm.prank(buyer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function _fund() internal returns (uint256 id) {
        vm.prank(buyer);
        id = escrow.createAndFundOrder(seller, address(usdc), AMOUNT, 1);
    }

    function _status(uint256 id) internal view returns (uint8 s) {
        (,,,,,,, s) = escrow.orders(id);
    }

    // Finding 1: a seller cannot deliver after the deadline, so the buyer's refund cannot be blocked.
    function test_Finding1_LateDeliveryIsRejectedAndBuyerRefunds() public {
        uint256 id = _fund();
        vm.warp(block.timestamp + 2 days);

        vm.prank(seller);
        vm.expectRevert();
        escrow.submitDelivery(id, bytes32(uint256(1)));

        vm.prank(buyer);
        escrow.claimTimeoutRefund(id);
        assertEq(_status(id), 4); // Refunded
        assertEq(usdc.balanceOf(buyer), AMOUNT * 10);
    }

    // Finding 2a: the seller cannot dispute an order that has not been delivered.
    function test_Finding2_SellerCannotDisputeFundedOrder() public {
        uint256 id = _fund();
        vm.prank(seller);
        vm.expectRevert();
        escrow.openDispute(id);
        assertEq(_status(id), 1); // still Funded
    }

    // Finding 2b: a dispute always ends. After the timeout anyone applies the default outcome.
    function test_Finding2_DisputeEndsByTimeout() public {
        uint256 id = _fund();
        vm.prank(buyer);
        escrow.openDispute(id);

        vm.warp(block.timestamp + 31 days);
        escrow.claimDisputeTimeout(id); // anyone
        assertEq(_status(id), 6); // Resolved
        assertEq(usdc.balanceOf(buyer), AMOUNT * 10);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    // Finding 3: pausing also stops the arbitrator from moving funds.
    function test_Finding3_PauseStopsResolveDispute() public {
        uint256 id = _fund();
        vm.prank(buyer);
        escrow.openDispute(id);
        vm.prank(owner);
        escrow.pause();

        vm.prank(arbitrator);
        vm.expectRevert();
        escrow.resolveDispute(id, AMOUNT, 0);
        assertEq(_status(id), 5); // still Disputed
    }
}

contract KupiaSpecV3 is KupiaSpec {
    function _deploy() internal override returns (IEscrowLike) {
        return IEscrowLike(address(new MarketplaceEscrowV3(owner, makeAddr("fee"), arbitrator)));
    }
}

/// @dev Documents that v2 fails the spec. Skipped by default so `forge test` stays green:
///      RUN_V2_SPEC=true forge test --match-contract KupiaSpecV2 (expect 4 failures).
contract KupiaSpecV2 is KupiaSpec {
    function _deploy() internal override returns (IEscrowLike) {
        return IEscrowLike(address(new MarketplaceEscrow(owner, makeAddr("fee"), arbitrator)));
    }

    function setUp() public override {
        vm.skip(!vm.envOr("RUN_V2_SPEC", false));
        super.setUp();
    }
}
