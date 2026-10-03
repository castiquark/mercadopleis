// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {MarketplaceEscrow} from "../src/MarketplaceEscrow.sol";
import {EscrowAdmin} from "../src/EscrowAdmin.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract EscrowAdminTest is Test {
    uint256 constant DELAY = 72 hours;

    MarketplaceEscrow escrow;
    TimelockController timelock;
    EscrowAdmin admin;
    MockUSDC usdc;

    address deployer = makeAddr("deployer");
    address multisig = makeAddr("multisig"); // proposer and executor of the timelock
    address guardian = makeAddr("guardian");
    address feeRecipient = makeAddr("feeRecipient");
    address arbitrator = makeAddr("arbitrator");
    address attacker = makeAddr("attacker");
    address buyer = makeAddr("buyer");
    address seller = makeAddr("seller");

    function setUp() public {
        usdc = new MockUSDC();
        vm.startPrank(deployer);
        escrow = new MarketplaceEscrow(deployer, feeRecipient, arbitrator);
        escrow.setAcceptedToken(address(usdc), true);

        address[] memory roles = new address[](1);
        roles[0] = multisig;
        // No extra admin: the timelock administers itself, so its own rules also go through the delay.
        timelock = new TimelockController(DELAY, roles, roles, address(0));
        admin = new EscrowAdmin(address(escrow), address(timelock), guardian);

        // Two-step handover: the current owner nominates the admin contract, which accepts.
        escrow.transferOwnership(address(admin));
        vm.stopPrank();
        admin.acceptEscrowOwnership();
    }

    // --- helpers ---

    function _schedule(bytes memory data, bytes32 salt) internal {
        vm.prank(multisig);
        timelock.schedule(address(admin), 0, data, bytes32(0), salt, DELAY);
    }

    function _execute(bytes memory data, bytes32 salt) internal {
        vm.prank(multisig);
        timelock.execute(address(admin), 0, data, bytes32(0), salt);
    }

    // --- ownership ---

    function test_AdminOwnsTheEscrowAfterHandover() public view {
        assertEq(escrow.owner(), address(admin));
        assertEq(escrow.pendingOwner(), address(0));
    }

    function test_PreviousOwnerLostAllPowers() public {
        vm.startPrank(deployer);
        vm.expectRevert();
        escrow.setArbitrator(deployer);
        vm.expectRevert();
        escrow.pause();
        vm.expectRevert();
        escrow.renounceOwnership();
        vm.stopPrank();
    }

    function test_NobodyCanRenounceTheEscrowOwnership() public {
        // EscrowAdmin has no renounce function, and the escrow only accepts calls from its owner.
        (bool ok, ) = address(admin).call(abi.encodeWithSignature("renounceOwnership()"));
        assertFalse(ok);
        vm.prank(address(timelock));
        vm.expectRevert();
        escrow.renounceOwnership();
        assertEq(escrow.owner(), address(admin));
    }

    // --- guardian: pause only ---

    function test_GuardianPausesImmediately() public {
        vm.prank(guardian);
        admin.pause();
        assertTrue(escrow.paused());
    }

    function test_GuardianCannotUnpauseOrChangeSettings() public {
        vm.prank(guardian);
        admin.pause();

        vm.startPrank(guardian);
        vm.expectRevert(EscrowAdmin.Unauthorized.selector);
        admin.unpause();
        vm.expectRevert(EscrowAdmin.Unauthorized.selector);
        admin.setArbitrator(guardian);
        vm.expectRevert(EscrowAdmin.Unauthorized.selector);
        admin.setFeeRecipient(guardian);
        vm.expectRevert(EscrowAdmin.Unauthorized.selector);
        admin.setGuardian(guardian);
        vm.stopPrank();
    }

    function test_StrangersCannotDoAnything() public {
        vm.startPrank(attacker);
        vm.expectRevert(EscrowAdmin.Unauthorized.selector);
        admin.pause();
        vm.expectRevert(EscrowAdmin.Unauthorized.selector);
        admin.setArbitrator(attacker);
        vm.expectRevert(EscrowAdmin.Unauthorized.selector);
        admin.transferEscrowOwnership(attacker);
        vm.stopPrank();
    }

    // --- timelocked changes ---

    function test_ArbitratorChangeNeedsTheFullDelay() public {
        address newArbitrator = makeAddr("newArbitrator");
        bytes memory data = abi.encodeCall(EscrowAdmin.setArbitrator, (newArbitrator));
        _schedule(data, "arb");

        // Not executable before 72 hours.
        vm.warp(block.timestamp + DELAY - 1);
        vm.expectRevert();
        _execute(data, "arb");
        assertEq(escrow.arbitrator(), arbitrator);

        vm.warp(block.timestamp + 1);
        _execute(data, "arb");
        assertEq(escrow.arbitrator(), newArbitrator);
    }

    function test_OnlyTheMultisigCanSchedule() public {
        bytes memory data = abi.encodeCall(EscrowAdmin.setFeeRecipient, (attacker));
        vm.prank(attacker);
        vm.expectRevert();
        timelock.schedule(address(admin), 0, data, bytes32(0), "x", DELAY);
    }

    function test_MultisigCannotSkipTheDelay() public {
        bytes memory data = abi.encodeCall(EscrowAdmin.setFeeRecipient, (multisig));
        vm.prank(multisig);
        vm.expectRevert();
        timelock.schedule(address(admin), 0, data, bytes32(0), "fast", DELAY - 1);
    }

    function test_UnpauseGoesThroughTheTimelock() public {
        vm.prank(guardian);
        admin.pause();

        bytes memory data = abi.encodeCall(EscrowAdmin.unpause, ());
        _schedule(data, "unpause");
        vm.warp(block.timestamp + DELAY);
        _execute(data, "unpause");
        assertFalse(escrow.paused());
    }

    function test_GuardianCanBeReplacedThroughTheTimelock() public {
        address newGuardian = makeAddr("newGuardian");
        bytes memory data = abi.encodeCall(EscrowAdmin.setGuardian, (newGuardian));
        _schedule(data, "guardian");
        vm.warp(block.timestamp + DELAY);
        _execute(data, "guardian");
        assertEq(admin.guardian(), newGuardian);

        vm.prank(guardian);
        vm.expectRevert(EscrowAdmin.Unauthorized.selector);
        admin.pause();
    }

    function test_OwnershipCanMoveToANewAdminThroughTheTimelock() public {
        address next = makeAddr("nextAdmin");
        bytes memory data = abi.encodeCall(EscrowAdmin.transferEscrowOwnership, (next));
        _schedule(data, "move");
        vm.warp(block.timestamp + DELAY);
        _execute(data, "move");
        assertEq(escrow.pendingOwner(), next);
        vm.prank(next);
        escrow.acceptOwnership();
        assertEq(escrow.owner(), next);
    }

    // --- the escrow keeps working for users, and the fee stays fixed ---

    function test_OrdersWorkUnderTheAdminAndTheFeeIsStill3Percent() public {
        usdc.mint(buyer, 100e6);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), 100e6);
        uint256 id = escrow.createAndFundOrder(seller, address(usdc), 100e6, 3);
        vm.stopPrank();
        vm.prank(seller);
        escrow.submitDelivery(id, keccak256("work"));
        vm.prank(buyer);
        escrow.approveDelivery(id);
        assertEq(usdc.balanceOf(seller), 97e6);
        assertEq(usdc.balanceOf(feeRecipient), 3e6);
        assertEq(escrow.FEE_BPS(), 300);
    }

    function test_ArbitratorStillResolvesWhilePaused() public {
        usdc.mint(buyer, 50e6);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), 50e6);
        uint256 id = escrow.createAndFundOrder(seller, address(usdc), 50e6, 3);
        escrow.openDispute(id);
        vm.stopPrank();

        vm.prank(guardian);
        admin.pause();
        vm.prank(arbitrator);
        escrow.resolveDispute(id, 20e6, 30e6);
        assertEq(usdc.balanceOf(buyer), 30e6);
    }

    function test_ConstructorRejectsZeroAddresses() public {
        vm.expectRevert(EscrowAdmin.InvalidAddress.selector);
        new EscrowAdmin(address(0), address(timelock), guardian);
        vm.expectRevert(EscrowAdmin.InvalidAddress.selector);
        new EscrowAdmin(address(escrow), address(0), guardian);
        vm.expectRevert(EscrowAdmin.InvalidAddress.selector);
        new EscrowAdmin(address(escrow), address(timelock), address(0));
    }
}
