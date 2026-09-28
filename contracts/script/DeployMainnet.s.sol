// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MarketplaceEscrow} from "../src/MarketplaceEscrow.sol";

contract DeployMainnet is Script {
    // Official native Circle USDC on Base Mainnet (Chain ID 8453)
    address public constant BASE_MAINNET_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    uint256 public constant INITIAL_FEE_BPS = 300; // 3%

    function run() external returns (MarketplaceEscrow escrow) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        address arbitrator = vm.envOr("ARBITRATOR", deployer);
        address usdc = vm.envOr("MAINNET_USDC_ADDRESS", BASE_MAINNET_USDC);

        console.log("==================================================");
        console.log("Deploying MarketplaceEscrow to BASE MAINNET (8453)");
        console.log("==================================================");
        console.log("Deployer / Owner:", deployer);
        console.log("Fee Recipient:   ", feeRecipient);
        console.log("Arbitrator:      ", arbitrator);
        console.log("Official USDC:   ", usdc);
        console.log("Initial Fee:     3.00% (300 bps)");

        vm.startBroadcast(deployerPrivateKey);

        escrow = new MarketplaceEscrow(
            deployer,
            feeRecipient,
            arbitrator,
            INITIAL_FEE_BPS
        );

        escrow.setAcceptedToken(usdc, true);

        vm.stopBroadcast();

        console.log("--------------------------------------------------");
        console.log("MarketplaceEscrow deployed at:", address(escrow));
        console.log("--------------------------------------------------");
    }
}
