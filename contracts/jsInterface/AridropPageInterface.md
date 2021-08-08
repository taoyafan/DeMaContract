# Airdrop page interface

In this page, we left 4 operations or information need to interact with contract. 

The following are listed as the order in the page from top to bottom. without specific, the interface is define in contract Farm.

## Pending Rewards:

(1) Read paid rewards from each pool.

function definition: `totalPaidRewards() external view returns (uint256)`

(2) Then the pending rewards is 

`100000 - 0.1 * totalPaidRewards`

## Invited Fund:

(1) Get farm pools id and shares of inviterBonus.

function definition: `inviterBonusSharesAndIds(address account) external view returns (uint256[] memory, uint256[] memory)`

The 1st returned value is an array shares, and 2nd is an array of ids.

(2) Get the tokens value.

According the id, we can acquire what token it is from file. 

If it is the lp token, the share is same as the amount of lp.

If it is a single token, the amount can be calculate by 

`amount = shares * (banks.totalVal - banks.totalReserve) / banks.totalShares`

Noted that banks information are read from contract Bank. 

The value of single token or lp token can be acquired from DEX.

(3) Get invited fund.

`invited fund = 20 * sum(values obtained above)`

## Participation Rewards

Can be obtained from interface `bonusEarned(address account) public view override returns (uint256)`

## Claim Participation Rewards

Call the write interface `getBonusRewards(address account)`

## Invitation Rewards

Can be obtained from interface `inviterBonusEarned(address account) public view override returns (uint256)`

## Claim Invitation Rewards

Call the write interface `getInviterRewards(address account)`