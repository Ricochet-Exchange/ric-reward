# RicReward, A Ricochet super token liquidity staking contract

__STATUS:__ In Development

## Overview

The system consists of a single contract, `RicReward.sol`, using the Ricochet Token, liquidity
tokens from Sushi, and the Superfluid protocol to enable a novel liquidity staking protocol.

## Ownable

The `RicReward` contract inherits the Open Zeppelin `Ownable` contract for access control, ideally
pointing to a multisig smart wallet for security reasons.

The owner-specific functions are marked with "MUST be contract owner" in the natspec developer
documentation in the source file.

The owner may:

-   Call `setRewardActive`, which adds or removes a token to or from the rewards list.

-   Call `withdrawFor`, which withdraws a token on another account's behalf and updates their flow.

-   Call `batchWithdrawFor`, which does the same as `withdrawFor`, but in batch.

The last two, `withdrawFor` and `batchWithdrawFor` are to be used _only_ in emergencies, for example
if liquidity tokens need to be withdrawn immediately and the user cannot be reached, or if invalid
tokens are sent to the contract that need to be withdrawn immediately and the user cannot be
reached.

## Superfluid Integration

The Superfluid protocol is integrated in such a way that when an address's deposit is updated, a
flow of Ricochet tokne worth 20% of the deposit is created, updated, or deleted.

If a user makes a deposit, a flow is created.

If a user makes two deposits, a flow is created on the first and is increased on the second.

If a user deposits then withdraws a portion of the deposit, a flow is created on the deposit then
decreased on the withdrawal.

If a user deposits then withdraws all of the deposit, a flow is created on the deposit and deleted
on the withdrawal.

The `CFAv1Library` is used to keep the flow updates simple for readability.
