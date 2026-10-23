// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MarketplaceEscrowV3} from "../src/MarketplaceEscrowV3.sol";

/// @notice Deploys MarketplaceEscrowV3 and whitelists the given tokens. Base Mainnet needs ALLOW_MAINNET=true (approved by
///         the user on 22 Oct 2026); other mainnets are refused.
///
///   Base Sepolia, from contracts/:
///     forge script script/DeployEscrowV3.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast --verify
///
///   Env: DEPLOYER_PRIVATE_KEY (required; the deployer becomes the owner), ARBITRATOR (default: DEFAULT_ARBITRATOR,
///        a wallet separate from the owner), FEE_RECIPIENT (default: deployer),
///        ACCEPTED_TOKENS (comma-separated; default: USDC of the chain, Circle test USDC on Base Sepolia),
///        ALLOW_MAINNET (required for Base Mainnet).
contract DeployEscrowV3 is Script {
    address constant DEFAULT_ARBITRATOR = 0x5642984a118D7251A7eE8b31D8cBc60E0bF5e2Bb;
    address constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant BASE_MAINNET_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external returns (MarketplaceEscrowV3 escrow) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        address arbitrator = vm.envOr("ARBITRATOR", DEFAULT_ARBITRATOR);
        address[] memory defaultTokens = new address[](1);
        defaultTokens[0] = block.chainid == 8453 ? BASE_MAINNET_USDC : BASE_SEPOLIA_USDC;
        address[] memory tokens = vm.envOr("ACCEPTED_TOKENS", ",", defaultTokens);

        require(block.chainid != 677 && block.chainid != 1, "unsupported mainnet");
        require(block.chainid != 8453 || vm.envOr("ALLOW_MAINNET", false), "Base Mainnet needs ALLOW_MAINNET=true");
        require(arbitrator != deployer, "arbitrator must not be the owner");

        console.log("Chain id:", block.chainid);
        console.log("Owner (deployer):", deployer);
        console.log("Fee recipient:", feeRecipient);
        console.log("Arbitrator:", arbitrator);

        vm.startBroadcast(deployerPrivateKey);
        escrow = new MarketplaceEscrowV3(deployer, feeRecipient, arbitrator);
        for (uint256 i = 0; i < tokens.length; i++) {
            escrow.setAcceptedToken(tokens[i], true);
        }
        vm.stopBroadcast();

        console.log("MarketplaceEscrowV3:", address(escrow));
        console.log("Deploy block:", block.number);
    }
}
