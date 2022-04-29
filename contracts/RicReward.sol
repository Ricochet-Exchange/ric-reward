// SPDX-License-Identifier: AGPLv3
pragma solidity ^0.8.0;

import {ISuperfluid, ISuperToken} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {IConstantFlowAgreementV1} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IRicReward} from "./interfaces/IRicReward.sol";

/// @notice Thrown when rewards are not active for a given token
error RicReward__RewardsInactive();

/// @notice Thrown when rewards are active for a given token
error RicReward__RewardsActive();

/// @notice Thrown when `batchWithdrawFor` array lengths do not match
error RicReward__ArrayMismatch();

/// @title A Ricochet liquidity staking incentive contract
/// @author Rex Force
/// @notice Depositing relevant tokens here trigger a stream of Ricochet Tokens via the Superfluid
/// protocol. Withdrawing the relevant tokens here will decrease or delete the stream as appropriate
contract RicReward is IRicReward, Ownable {
	/// @dev Emitted when a token is added or removed to or from the rewards program
	/// @param token ERC20 token to be staked
	event RewardUpdate(address indexed token, bool active);

	/// @dev Emitted when token stake gets updated
	/// @param staker Address of staker
	/// @param token ERC20 token being staked
	/// @param amount Amount staked
	event StakeUpdate(address indexed token, address indexed staker, uint256 amount);

	ISuperfluid internal immutable _host;
	IConstantFlowAgreementV1 internal immutable _cfa;
	ISuperToken internal immutable _ric;

	/// @dev Internal accounting for deposits. `deposit = deposits[account][token]`
	mapping(address => mapping(IERC20 => uint256)) public deposits;

	/// @dev Tokens available for rewards
	mapping(IERC20 => bool) public rewardActive;

	/// @dev Flow rate to deposit ratio divided by 10.
	uint256 public constant flowRateDepositRatio = 2;

	constructor(
		ISuperfluid host,
		IConstantFlowAgreementV1 cfa,
		ISuperToken ric
	) {
		_host = host;

		_cfa = cfa;

		_ric = ric;
	}

	// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
	// EXTERNAL FUNCTIONS
	// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

	/// @notice Deposits active rewards token with `approve/transferFrom` pattern, then either
	/// creates or updates the flow as appropriate to reflect the `flowRateDepositRatio`.
	/// @param token Token to deposit
	/// @param amount Amount to deposit
	/// @dev Throws `RicReward__RewardsInactive` if token is inactive. Emits `StakeUpdate`
	function deposit(IERC20 token, uint256 amount) external {
		// Safe to assume all 'token's contain trusted code
		if (!rewardActive[token]) revert RicReward__RewardsInactive();

		token.transferFrom(msg.sender, address(this), amount);

		uint256 senderDeposit = deposits[msg.sender][token] + amount;

		deposits[msg.sender][token] = senderDeposit;

		// TODO check if super app can attack with reentrancy
		_flowUpdate(msg.sender, _flowRate(senderDeposit));

		emit StakeUpdate(address(token), msg.sender, amount);
	}

	/// @notice Withdraws tokens, then either updates or deletes the flow as appropriate to reflect
	/// the `flowRateDepositRatio`
	/// @param token Token to withdraw
	/// @param amount Amount to withdraw
	/// @dev Emits `StakeUpdate`
	function withdraw(IERC20 token, uint256 amount) external {
		uint256 newDeposit = deposits[msg.sender][token] - amount;

		deposits[msg.sender][token] = newDeposit;

		// only call `.flow` if the flow exists. Ensures liquidations do not stop withdrawals.
		(, int96 flowRate, , ) = _cfa.getFlow(_ric, address(this), msg.sender);

		if (flowRate > 0) _flowUpdate(msg.sender, _flowRate(newDeposit));

		emit StakeUpdate(address(token), msg.sender, newDeposit);

		token.transfer(msg.sender, amount);
	}

	// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
	// OWNER ONLY
	// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

	/// @notice Sets a new token to be active
	/// @param token New Token to add to rewards list
	/// @dev MUST be contract owner. Emits `RewardUpdate`
	function setRewardActive(IERC20 token, bool active) external onlyOwner {
		rewardActive[token] = active;

		emit RewardUpdate(address(token), active);
	}

	// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
	// INTERNALS
	// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

	/// @dev Convenience function to abstract away numeric type casting hell.
	/// @param amount Amount to adjust
	function _flowRate(uint256 amount) internal pure returns (int96) {
		return int96(int256(((amount * flowRateDepositRatio) / 100) / 30 days));
	}

	/// @dev Calls appropriate agreement based on old flow rate and desired new flow rate
	/// @param receiver Receiver of stream
	/// @param newFlowRate Desired new flow rate
	function _flowUpdate(address receiver, int96 newFlowRate) internal {
		(, int96 oldFlowRate, , ) = _cfa.getFlow(_ric, address(this), receiver);

		bytes memory agreementData;

		if (oldFlowRate == 0) {
			// if old AND new flow rates are zero, then the caller is likely trying to recover
			// tokens. DO NOT revert.
			if (newFlowRate == 0) return;

			// create flow
			agreementData = abi.encodeWithSelector(
				_cfa.createFlow.selector,
				_ric,
				receiver,
				newFlowRate,
				new bytes(0)
			);
		} else if (newFlowRate > 0) {
			// update flow
			agreementData = abi.encodeWithSelector(
				_cfa.updateFlow.selector,
				_ric,
				receiver,
				newFlowRate,
				new bytes(0)
			);
		} else {
			// newFlowRate == 0 && oldFlowRate > 0

			// delete flow
			agreementData = abi.encodeWithSelector(
				_cfa.deleteFlow.selector,
				_ric,
				address(this),
				receiver,
				new bytes(0)
			);
		}

		// call agreement
		_host.callAgreement(_cfa, agreementData, new bytes(0));
	}
}
