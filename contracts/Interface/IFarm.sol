// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.8.0;

// Inheritance
interface IFarm {

    /* ==================================== Read ==================================== */
    
    /* ----------------- Pool Info ----------------- */

    function lastTimeRewardApplicable(uint256 poolId) external view returns (uint256);

    function rewardPerToken(uint256 poolId) external view returns (uint256);

    function getRewardForDuration(uint256 poolId) external view returns (uint256);

    /* ----------------- User Staked Info ----------------- */

    // Rewards amount for user in one pool.
    function stakeEarnedPerPool(uint256 poolId, address account) external view returns (uint256);

    /* ----------------- User Bonus Info  ----------------- */

    // Rewards amount for bonus in one pool.
    function bonusEarnedPerPool(uint256 poolId, address account) external view returns (uint256);

    // Rewards amount for bonus in all pools.
    function bonusEarned(address account) external view returns (uint256);

    /* ----------------- Inviter Bonus Info  ----------------- */

    // Rewards amount for inviter bonus in one pool.
    function inviterBonusEarnedPerPool(uint256 poolId, address account) external view returns (uint256);

    // Rewards amount for inviter bonus in all pools.
    function inviterBonusEarned(address account) external view returns (uint256);


    /* ==================================== Write ==================================== */

   
    /* ----------------- For Staked ----------------- */

    // Send rewards from the target pool directly to users' account
    function getStakeRewardsPerPool(uint256 poolId, address account) external;

    /* ----------------- For Bonus ----------------- */

    function getBonusRewardsPerPool(uint256 poolId, address account) external;

    function getBonusRewards(address account) external;

    /* ----------------- For Inviter Bonus ----------------- */

    function getInviterBonusRewardsPerPool(uint256 poolId, address account) external;

    function getInviterRewards(address account) external;


    /* ==================================== Only operator ==================================== */

    // Inviter is address(0), when there is no inviter.
    function stake(uint256 poolId, address account, uint256 amount) external;

    // Must indicate the inviter once the user have has one. 
    function withdraw(uint256 poolId, address account, uint256 amount) external;   
}