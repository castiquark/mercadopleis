// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MarketplaceEscrow} from "../src/MarketplaceEscrow.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";

/// @notice Deploys the escrow on a new test network together with a mintable 6-decimal test stablecoin, and
///         whitelists it. Same contract code and constructor as the Base deployments.
///
///   BOT Chain testnet (Bohr), from contracts/:
///     forge script script/DeployEscrowTestnet.s.sol --rpc-url bohr --broadcast --legacy \
///       --verify --verifier blockscout --verifier-url https://scan.bohr.life/api/
///
///   Env: DEPLOYER_PRIVATE_KEY (required), FEE_RECIPIENT / ARBITRATOR (default: deployer),
///        TEST_TOKEN_NAME / TEST_TOKEN_SYMBOL (default: "Mercadopleis Test USD" / "tUSD"),
///        EXTRA_ACCEPTED_TOKEN (optional, e.g. an existing test stablecoin on that network).
contract DeployEscrowTestnet is Script {
    function run() external returns (MarketplaceEscrow escrow, MockStablecoin token) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        address arbitrator = vm.envOr("ARBITRATOR", deployer);
        string memory tokenName = vm.envOr("TEST_TOKEN_NAME", string("Mercadopleis Test USD"));
        string memory tokenSymbol = vm.envOr("TEST_TOKEN_SYMBOL", string("tUSD"));
        address extraToken = vm.envOr("EXTRA_ACCEPTED_TOKEN", address(0));

        // Guard against broadcasting this test setup to a mainnet by mistake.
        require(block.chainid != 8453 && block.chainid != 677 && block.chainid != 1, "testnets only");

        console.log("Chain id:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Fee recipient:", feeRecipient);
        console.log("Arbitrator:", arbitrator);

        vm.startBroadcast(deployerPrivateKey);
        token = new MockStablecoin(tokenName, tokenSymbol);
        escrow = new MarketplaceEscrow(deployer, feeRecipient, arbitrator);
        escrow.setAcceptedToken(address(token), true);
        if (extraToken != address(0)) escrow.setAcceptedToken(extraToken, true);
        vm.stopBroadcast();

        console.log("Test token:", address(token));
        console.log("MarketplaceEscrow:", address(escrow));
        console.log("Deploy block:", block.number);
    }
}
