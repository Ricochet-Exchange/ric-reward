# UI Specification

## User Flow

User deposits RIC/USDC or RIC/MATIC tokens to Sushi (external)

User visits dapp.

User approves `contracts/RicReward.sol:RicReward` to spend the LP token on their behalf.

User calls `contracts/RicReward.sol:RicReward.deposit(address,uint256)` with the LP Token address
and amount.

User should see stream of RIC.

## Required Components

-   Form
    -   Address (dropdown since it's only two?), (blockies for address visualization?)
    -   Amount
-   Submit Buttons
    -   Approve (only active if `LPToken.allowance(userAddress, RicRewardAddress)` lt `amount`)
-   RIC Balance Ticker
-   Deposit Tracker

## Relevant ABI

Format is `ethers.js` [human readable ABI](https://docs.ethers.io/v5/api/utils/abi/formats/#abi-formats--human-readable-abi)

```js
// ERC20
const lPTokenAbi = [
	'function allowance(address,address) view returns (uint256)',
	'function approve(address,uint256) returns (bool)'
]

// RicReward
const ricRewardAbi = [
	'function deposits(address,address) view returns (uint256)',
	'function deposit(address,uint256)'
]
```
