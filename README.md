# DeMac Contract Introduction
## Features

There are two main features.

1. Lending platform.
2. High leverage liquitity mining.

### Lending platform

User can deposit money in Lending platform.

The money in Lending platform can be safely borrowed by products in high leverage liquitity mining.

Lending platform user can earn interest from the borrowed money.

In the early days of the launch of this feature, user will earn extra token which used in our DAO to continue maintaining and update this project as rewards.

Admin controls the types of tokens, interest model and token rewards rates.

### High leverage liquitity mining

User can deposit money in each product and can be allowed to borrow some money in bank.

All of this money will be added to the liquidity pool in DEX(Decentralized EXchange).

The DEX will return the equivalent LP token which will be stake in Liquidity mining pool.

The users will also earn some extra token of our project as rewards.

## Interface

 User will interact directly with two contract, `Bank` and `StackingRewards`.

### Bank

Both feature's entrypoint are all in `Bank`.

Lending platform user can call function `deposit` and `withdraw` to deposit money and withdraw money.

High leverage liquitity mining will call function `opPosition` to borrow token to mining, replenishment, withdraw and repay.

### StackingRewards

This contract is used to reward the project token to user.

Two features will use two independent contracts.

User can call function `getRewards` to get all token reward in one feature.

## Code structure

There are many other contracts including `BankConfig`, `TripleSlopeModel`, `MdxGoblin`, `MdxStrategyAddTwoSidesOptimal`, `MdxStrategyWithdrawMinimizeTrading`

The whole structure can be found in `diagrams/ClassDiagram.drawio`, it can be open using a VScode plugin Draw.io Intergration.

The diagram update is lagging, the details are subject to the code.

And the code is continually update.
