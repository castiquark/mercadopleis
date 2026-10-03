// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {EscrowAdmin} from "../src/EscrowAdmin.sol";

interface IOwnable2Step {
    function owner() external view returns (address);
    function pendingOwner() external view returns (address);
    function transferOwnership(address newOwner) external;
}

/**
 * Governance stage D1 (docs/DISPUTE_RESOLUTION.md, section 5): deploys a TimelockController and an EscrowAdmin,
 * and optionally hands the escrow over to the admin.
 *
 * Required env:  ESCROW_ADDRESS, MULTISIG (proposer and executor of the timelock), GUARDIAN (can only pause)
 * Optional env:  TIMELOCK_DELAY (seconds, default 72 hours, minimum 24 hours)
 *                HANDOVER=true  -> the broadcaster must be the current escrow owner; it nominates the admin and
 *                                  the admin accepts in the same run. Without it, only the contracts are deployed.
 *
 * The timelock has no extra admin: it administers itself, so changing its own rules also waits for the delay.
 */
contract DeployEscrowAdmin is Script {
    function run() external returns (TimelockController timelock, EscrowAdmin admin) {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address escrow = vm.envAddress("ESCROW_ADDRESS");
        address multisig = vm.envAddress("MULTISIG");
        address guardian = vm.envAddress("GUARDIAN");
        uint256 delay = vm.envOr("TIMELOCK_DELAY", uint256(72 hours));
        bool handover = vm.envOr("HANDOVER", false);
        require(delay >= 24 hours, "TIMELOCK_DELAY below 24 hours");
        require(multisig != address(0) && guardian != address(0), "MULTISIG and GUARDIAN are required");

        address[] memory roles = new address[](1);
        roles[0] = multisig;

        console.log("Escrow:          ", escrow);
        console.log("Current owner:   ", IOwnable2Step(escrow).owner());
        console.log("Multisig:        ", multisig);
        console.log("Guardian:        ", guardian);
        console.log("Delay (seconds): ", delay);

        vm.startBroadcast(key);
        timelock = new TimelockController(delay, roles, roles, address(0));
        admin = new EscrowAdmin(escrow, address(timelock), guardian);
        if (handover) {
            require(IOwnable2Step(escrow).owner() == vm.addr(key), "HANDOVER needs the current escrow owner key");
            IOwnable2Step(escrow).transferOwnership(address(admin));
            admin.acceptEscrowOwnership();
        }
        vm.stopBroadcast();

        console.log("TimelockController:", address(timelock));
        console.log("EscrowAdmin:       ", address(admin));
        if (handover) {
            require(IOwnable2Step(escrow).owner() == address(admin), "handover failed");
            console.log("Escrow owner is now the EscrowAdmin.");
        } else {
            console.log("Handover not done. Current owner must call transferOwnership(EscrowAdmin), then acceptEscrowOwnership().");
        }
    }
}
