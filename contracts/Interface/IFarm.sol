pragma solidity >=0.5.0 <0.8.0;

// Inheritance
interface IFarm {

    /* ==================================== Read ==================================== */

    function lastTimeRewardApplicable(uint256 poolId) external view returns (uint256);

    function rewardPerToken(uint256 poolId) external view returns (uint256);

    function getRewardForDuration(uint256 poolId) external view returns (uint256);

    // Return the user expect reward for one pool or all pools.
    function earnedPerPool(uint256 poolId, address account) external view returns (uint256);
    function earned(address account) external view returns (uint256);

    // Include the equivalent share. For one pool or all pools.
    function totalSharesPerPool(uint256 poolId) external view returns (uint256);
    function totalShares() external view returns (uint256);

    // User share of one pool or all pools.
    function sharesOfPerPool(uint256 poolId, address account) external view returns (uint256);
    function sharesOf(address account) external view returns (uint256);


    /* ==================================== Write ==================================== */

    function getRewardsPerPool(uint256 poolId, address account) external;
    function getRewards(address account) external;                      // Get rewards of all pools.


    /* ==================================== Only operator ==================================== */

    // Inviter is address(0), when there is no inviter.
    function stake(uint256 poolId, address account, uint256 amount) external;

    // Must indicate the inviter once the user have has one. 
    function withdraw(uint256 poolId, address account, uint256 amount) external;


    /* ==================================== Only owner ==================================== */

    function notifyRewardsAmount(uint256 poolId, uint256 reward, uint256 leftPeriodTimes) external;    

    function addPool(
        uint256 rewardFirstPeriod,      // Rewards will be minted in the first period
        uint256 leftPeriodTimes,        // Left period times.
        uint256 periodDuration,         // One period duration time.
        uint256 earnedFactor,           // Will divide 10000, should less than 10000, 500 means 5%
        uint256 invitedFactor,          // Will divide 10000, should lager than 10000, 10500 means 105%
        address operator                // Who can stake and withdraw.
    ) external; 

    // If amount is 0, it just stop to reward.
    function burn(uint256 poolId, uint256 amount) external;          

}