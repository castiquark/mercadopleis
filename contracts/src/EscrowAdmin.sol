// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

interface IMarketplaceEscrowAdmin {
    function pause() external;
    function unpause() external;
    function setArbitrator(address newArbitrator) external;
    function setFeeRecipient(address newRecipient) external;
    function setAcceptedToken(address token, bool allowed) external;
    function transferOwnership(address newOwner) external;
    function acceptOwnership() external;
}

/**
 * @title EscrowAdmin
 * @notice Owner of MarketplaceEscrow that splits its powers in two:
 *         - the guardian can only pause, immediately, in an emergency;
 *         - everything else (unpause, arbitrator, fee recipient, accepted tokens, a future owner) can only be
 *           called by the timelock, so every change is announced on-chain and can be seen before it happens.
 * @dev There is deliberately no way to renounce the escrow's ownership through this contract: a renounced
 *      owner could leave a paused escrow (and the funds in it) frozen forever. The fee rate is a constant in
 *      the escrow and no admin can change it.
 */
contract EscrowAdmin {
    IMarketplaceEscrowAdmin public immutable escrow;
    address public immutable timelock;
    address public guardian;

    event GuardianUpdated(address indexed previousGuardian, address indexed newGuardian);

    error Unauthorized();
    error InvalidAddress();

    modifier onlyTimelock() {
        if (msg.sender != timelock) revert Unauthorized();
        _;
    }

    constructor(address _escrow, address _timelock, address _guardian) {
        if (_escrow == address(0) || _timelock == address(0) || _guardian == address(0)) revert InvalidAddress();
        escrow = IMarketplaceEscrowAdmin(_escrow);
        timelock = _timelock;
        guardian = _guardian;
        emit GuardianUpdated(address(0), _guardian);
    }

    /// @notice Completes the two-step ownership transfer once the current owner has nominated this contract.
    ///         Anyone may call it: it can only accept an ownership that was already offered to this contract.
    function acceptEscrowOwnership() external {
        escrow.acceptOwnership();
    }

    /// @notice Emergency stop. The guardian (or the timelock) can pause; only the timelock can unpause.
    function pause() external {
        if (msg.sender != guardian && msg.sender != timelock) revert Unauthorized();
        escrow.pause();
    }

    function unpause() external onlyTimelock {
        escrow.unpause();
    }

    function setArbitrator(address newArbitrator) external onlyTimelock {
        escrow.setArbitrator(newArbitrator);
    }

    function setFeeRecipient(address newRecipient) external onlyTimelock {
        escrow.setFeeRecipient(newRecipient);
    }

    function setAcceptedToken(address token, bool allowed) external onlyTimelock {
        escrow.setAcceptedToken(token, allowed);
    }

    /// @notice Starts handing the escrow to a new owner (for example a new admin contract). Two-step, timelocked.
    function transferEscrowOwnership(address newOwner) external onlyTimelock {
        if (newOwner == address(0)) revert InvalidAddress();
        escrow.transferOwnership(newOwner);
    }

    function setGuardian(address newGuardian) external onlyTimelock {
        if (newGuardian == address(0)) revert InvalidAddress();
        emit GuardianUpdated(guardian, newGuardian);
        guardian = newGuardian;
    }
}
