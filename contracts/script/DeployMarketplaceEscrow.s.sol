// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MarketplaceEscrow} from "../src/MarketplaceEscrow.sol";

contract DeployMarketplaceEscrow is Script {
    // Base Sepolia Circle test USDC
    address public constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    // Mintable test USDC used by the app's /faucet and the e2e scripts
    address public constant BASE_SEPOLIA_MOCK_USDC = 0x6Fa1279f6c760fA993B7f9aC75de5a141d7D2D8A;

    function run() external returns (MarketplaceEscrow escrow) {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        address deployer = deployerPrivateKey != 0 
            ? vm.addr(deployerPrivateKey) 
            : msg.sender;

        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        address arbitrator = vm.envOr("ARBITRATOR", deployer);
        address usdc = vm.envOr("USDC_ADDRESS", BASE_SEPOLIA_USDC);

        console.log("Deploying MarketplaceEscrow to Base Sepolia...");
        console.log("Deployer:", deployer);
        console.log("Fee Recipient:", feeRecipient);
        console.log("Arbitrator:", arbitrator);
        console.log("USDC:", usdc);

        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        escrow = new MarketplaceEscrow(
            deployer,
            feeRecipient,
            arbitrator
        );

        escrow.setAcceptedToken(usdc, true);
        escrow.setAcceptedToken(BASE_SEPOLIA_MOCK_USDC, true);

        vm.stopBroadcast();

        console.log("MarketplaceEscrow deployed at:", address(escrow));
    }
}
