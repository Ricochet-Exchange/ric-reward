# RicReward, A Ricochet super token liquidity staking contract

**STATUS:** Under Review

## Getting Started

Clone the repo:

```bash
git clone https://github.com/Ricochet-Exchange/ric-reward.git
```

Install dependencies:

```bash
yarn
```

Test with Gas Report:

```bash
yarn test
```

Test Coverage Report (note that the coverage will skew the gas report):

```bash
yarn coverage
```

## Overview

The system consists of a single contract, `RicReward.sol`, using the Ricochet Token, liquidity
tokens from Sushi, and the Superfluid protocol to enable a novel liquidity staking protocol.

## Deposit / Withdrawal Pattern

For depositing, the `approve` and `transferFrom` method is implemented, since LP tokens will be
ERC20 tokens, not ERC777. Note that only tokens that are explicitly enabled can be deposited with
the `deposit` function. Tokens can still be `transfer`ed to the contract, and in the interest of
security, no recovery method will be available.

For withdrawing, the tokens are moved via `transfer` to the caller. If the caller does not have a
sufficient deposit amount, the contract will revert before this transfer occurs.

## ReentrancyGuard

The `RicReward` contract inherits the Open Zeppelin `ReentrancyGuard` contract for reentrancy
protection. While the `token` to be transferred can be reasonably assumed to be safe code, however,
a Super App could potentially reenter the contract on either of the public state-mutating functions.
While no breaking exploits were found for the current implementation, a `nonReentrant` modifier has
been added to the `deposit` and `withdraw` functions in the interest of security.

## Ownable

The `RicReward` contract inherits the Open Zeppelin `Ownable` contract for access control, ideally
pointing to a multisig smart wallet for security reasons.

The owner-specific functions are marked with "MUST be contract owner" in the natspec developer
documentation in the source file.

The owner may:

-   Call `setRewardActive`, which adds or removes a token to or from the rewards list.

## Superfluid Integration

The Superfluid protocol is integrated in such a way that when an address's deposit is updated, a
flow of Ricochet tokne worth 20% of the deposit is created, updated, or deleted.

If a user makes a deposit, a flow is created.

If a user makes two deposits, a flow is created on the first and is increased on the second.

If a user deposits then withdraws a portion of the deposit, a flow is created on the deposit then
decreased on the withdrawal.

If a user deposits then withdraws all of the deposit, a flow is created on the deposit and deleted
on the withdrawal.
