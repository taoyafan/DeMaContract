pragma solidity >=0.5.0 <0.8.0;

// Inheritance
interface IFarm {

    /* ==================================== Read ==================================== */
    
    /* ----------------- Pool Info ----------------- */

    function lastTimeRewardApplicable(uint256 poolId) external view returns (uint256);

    function rewardPerToken(uint256 poolId) external view returns (uint256);

    function getRewardForDuration(uint256 poolId) external view returns (uint256);

    function totalShares() external view returns (uint256);

    /* ----------------- User Staked Info ----------------- */

    // Rewards amount for user in one pool.
    function stakeEarnedPerPool(uint256 poolId, address account) external view returns (uint256);

    /* ----------------- User Bonus Info  ----------------- */

    // Rewards amount for bonus in one pool.
    function bonusEarnedPerPool(uint256 poolId, address account) external view returns (uint256);

    // Rewards amount for bonus in all pools.
    function bonusEarned(address account) external view returns (uint256);

    // Total shares of bonus.
    function bonusShares(address account) external view returns (uint256);

    /* ----------------- Inviter Bonus Info  ----------------- */

    // Rewards amount for inviter bonus in one pool.
    function inviterBonusEarnedPerPool(uint256 poolId, address account) external view returns (uint256);

    // Rewards amount for inviter bonus in all pools.
    function inviterBonusEarned(address account) external view returns (uint256);

    // Total shares of inviter shares.
    function inviterBonusShares(address account) external view returns (uint256);


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


    /* ==================================== Only owner ==================================== */

    function notifyRewardsAmount(uint256 poolId, uint256 reward, uint256 leftPeriodTimes) external;    

    function addPool(
        uint256 rewardFirstPeriod,      // Rewards will be minted in the first period
        uint256 leftPeriodTimes,        // Left period times, 0 means only one period.
        uint256 periodDuration,         // One period duration time.
        uint256 leftRatioNextPeriod,    // Next period left rewards, will divide 100, 90 means left 90%
        address operator                // Who can stake and withdraw.
    ) external; 

    // Stop the pool
    function stop(uint256 poolId) external;    

    // Burn the left rewards after call stop function.
    // Require total share is 0
    function burn(uint256 poolId) external;          

}