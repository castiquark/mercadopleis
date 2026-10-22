// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockUSDC} from "./MockUSDC.sol";

/// @dev USDC-like blacklist: transfers to or from a blacklisted address revert.
contract MockBlacklistUSDC is MockUSDC {
    mapping(address => bool) public blacklisted;

    function setBlacklisted(address who, bool value) external {
        blacklisted[who] = value;
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!blacklisted[from] && !blacklisted[to], "Blacklistable: account is blacklisted");
        super._update(from, to, value);
    }
}
