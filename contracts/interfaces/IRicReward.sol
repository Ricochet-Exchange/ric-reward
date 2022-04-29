// SPDX-License-Identifier: AGPLv3
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRicReward {
    function deposits(address account, IERC20 token) external returns (uint256);

    function rewardActive(IERC20 token) external returns (bool);

    function deposit(IERC20 token, uint256 amount) external;

    function withdraw(IERC20 token, uint256 amount) external;

    function setRewardActive(IERC20 token, bool active) external;
}
