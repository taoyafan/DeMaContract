pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./Interface/IFarm.sol";
import "./Interface/IDEMA.sol";
import "./interface/IUserProfile.sol";

// Check all the div params MUST not be 0;
contract Farm is IFarm, Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    struct PoolInfo {
        // Need to be set
        uint256 leftPeriodTimes;        // 0 means stop.
        uint256 periodDuration;         // Each period duration time.
        uint256 leftRatioNextPeriod;    // Next period left rewards, will divide 100, 90 means left 90%
        address operator;               // Who can stake and withdraw.

        // Auto calculated
        uint256 rewardsNextPeriod;
        uint256 lastUpdateTime;
        uint256 periodFinish;           // Current period finished time
        uint256 rewardRate;             // Rewards for a second
        uint256 rewardPerTokenStored;

        // States
        uint256 rewardsPaid;    // Total paided rewards.
        uint256 rewardsed;      // Total minted rewards.
        uint256 totalShares;    // Total staked shares, include equivalent share.
    }

    struct UserInfo {
        uint256 rewards;                    // Earned rewards.
        uint256 userRewardPerTokenPaid;     // Rewards per token paid.
        uint256 shares;                     // Stake shares.
        uint256 lastUpdateTime;
    }

    IDEMA DEMA;
    IUserProfile userProfile;

    mapping(uint256 => PoolInfo) public poolInfo;
    uint256 public nextPoolId = 0;

    mapping(uint256 => mapping(address => UserInfo)) public userStakeInfo;  // User stake info per pool.
    mapping(uint256 => mapping(address => UserInfo)) public inviterBonus;   // Inviter's bonus per pool.
    mapping(uint256 => mapping(address => UserInfo)) public bonus;          // invitee's bonus per pool.

    using EnumerableSet for EnumerableSet.UintSet;

    // The stake pool should only be dynamic updated by operator.
    mapping(address => EnumerableSet.UintSet) internal inviterBonusPools;       // inviter's bonus pool.
    mapping(address => EnumerableSet.UintSet) internal bonusPools;              // invitee's bonus pool.

    // For inviting
    uint256 inviterBonusRatio; // Inviters' bonus ratio, will divide 10000, 500 means 5%
    uint256 bonusRatio;         // Invitees' bonus ratio, will divide 10000, 500 means 5%

    /* ========== CONSTRUCTOR ========== */

    constructor(
        IUserProfile _userProfile,
        IDEMA _rewardsToken,
        uint256 _inviterBonusRatio,
        uint256 _bonusRatio
    ) Ownable() public {
        userProfile = _userProfile;
        DEMA = _rewardsToken;
        inviterBonusRatio = _inviterBonusRatio;
        bonusRatio = _bonusRatio;
    }

    /* ==================================== Read ==================================== */

    /* ----------------- Pool Info  ----------------- */

    // Elapsed time of the last / current period should be rewarded.
    function lastTimeRewardApplicable(uint256 poolId) public view override checkPoolId(poolId) returns (uint256) {
        return Math.min(block.timestamp, poolInfo[poolId].periodFinish);
    }

    // Total rewards already mint in one pool including unwithdrawn rewards.
    function rewardPerToken(uint256 poolId) public view override checkPoolId(poolId) returns (uint256) {
        PoolInfo storage pool = poolInfo[poolId];

        if (pool.totalShares == 0) {
            return pool.rewardPerTokenStored;
        }
        return
            pool.rewardPerTokenStored.add(
                lastTimeRewardApplicable(poolId).sub(pool.lastUpdateTime).mul(pool.rewardRate).mul(1e18).div(pool.totalShares)
            );
    }

    function getRewardForDuration(uint256 poolId) external view override checkPoolId(poolId) returns (uint256) {
        PoolInfo storage pool = poolInfo[poolId];
        return pool.rewardRate.mul(pool.periodDuration);
    }

    function totalPaidRewards() external view returns (uint256) {
        uint256 totalPaid = 0;

        for (uint256 i = 0; i < nextPoolId; ++i) {
            PoolInfo storage pool = poolInfo[i];
            totalPaid = totalPaid.add(pool.rewardsPaid);
        }

        return totalPaid;
    }

    /* ----------------- User Staked Info ----------------- */

    // Rewards amount for user in one pool.
    function stakeEarnedPerPool(uint256 poolId, address account) public view override checkPoolId(poolId) returns (uint256) {
        UserInfo storage user = userStakeInfo[poolId][account];
        return user.shares.mul(rewardPerToken(poolId).sub(user.userRewardPerTokenPaid)).div(1e18).add(user.rewards);
    }

    /* ----------------- User Bonus Info  ----------------- */

    function bonusPoolsLength(address account) public view returns (uint256) {
        return EnumerableSet.length(bonusPools[account]);
    }

    function bonusPoolsId(address account, uint256 index) public view returns (uint256) {
        return EnumerableSet.at(bonusPools[account], index);
    }

    // Rewards amount for bonus in one pool.
    function bonusEarnedPerPool(uint256 poolId, address account) public view override checkPoolId(poolId) returns (uint256) {
        UserInfo storage user = bonus[poolId][account];
        return user.shares.mul(rewardPerToken(poolId).sub(user.userRewardPerTokenPaid)).div(1e18).add(user.rewards);
    }

    // Rewards amount for bonus in all pools.
    function bonusEarned(address account) external view override returns (uint256) {
        uint256 totalEarned = 0;
        for (uint256 index = 0; index < bonusPoolsLength(account); ++index) {
            totalEarned = totalEarned.add(bonusEarnedPerPool(bonusPoolsId(account, index), account));
        }
        return totalEarned;
    }

    /* ----------------- Inviter Bonus Info  ----------------- */

    function inviterBonusPoolsLength(address account) public view returns (uint256) {
        return EnumerableSet.length(inviterBonusPools[account]);
    }

    function inviterBonusPoolsId(address account, uint256 index) public view returns (uint256) {
        return EnumerableSet.at(inviterBonusPools[account], index);
    }

    // Rewards amount for inviter bonus in one pool.
    function inviterBonusEarnedPerPool(uint256 poolId, address account) public view override checkPoolId(poolId) returns (uint256) {
        UserInfo storage user = inviterBonus[poolId][account];
        return user.shares.mul(rewardPerToken(poolId).sub(user.userRewardPerTokenPaid)).div(1e18).add(user.rewards);
    }

    // Rewards amount for inviter bonus in all pools.
    function inviterBonusEarned(address account) external view override returns (uint256) {
        uint256 totalEarned = 0;
        for (uint256 index = 0; index < inviterBonusPoolsLength(account); ++index) {
            totalEarned = totalEarned.add(inviterBonusEarnedPerPool(inviterBonusPoolsId(account, index), account));
        }
        return totalEarned;
    }

    // Total shares of inviter shares.
    function inviterBonusSharesAndIds(address account) external view returns (uint256[] memory, uint256[] memory) {
        uint256 len = inviterBonusPoolsLength(account);
        
        uint256[] memory shares = new uint256[](len);
        uint256[] memory ids = new uint256[](len);

        for (uint256 index = 0; index < len; ++index) {
            uint256 poolId = inviterBonusPoolsId(account, index);
            ids[index] = poolId;
            shares[index] = inviterBonus[poolId][account].shares;
        }

        return (shares, ids);
    }


    /* ==================================== Write ==================================== */

    /* ----------------- For Staked ----------------- */

    // Send rewards from the target pool directly to users' account
    function getStakeRewardsPerPool(uint256 poolId, address account)
        public
        override
        nonReentrant
        checkPoolId(poolId)
        updateRewards(poolId, account)
        checkhalve(poolId)
    {
        PoolInfo storage pool = poolInfo[poolId];
        UserInfo storage user = userStakeInfo[poolId][account];

        if (user.rewards > 0) {
            _safeRewardsTransfer(account, user.rewards);
            pool.rewardsPaid = pool.rewardsPaid.add(user.rewards);
            emit RewardPaid(poolId, account, user.rewards);
            user.rewards = 0;
        }
    }

    /* ----------------- For Bonus ----------------- */

    function getBonusRewardsPerPool(uint256 poolId, address account)
        public
        override
        checkPoolId(poolId)
    {
        _updateBonus(poolId, account);
        _checkhalve(poolId);

        PoolInfo storage pool = poolInfo[poolId];
        UserInfo storage user = bonus[poolId][account];

        if (user.rewards > 0) {
            _safeRewardsTransfer(account, user.rewards);
            pool.rewardsPaid = pool.rewardsPaid.add(user.rewards);
            emit RewardPaid(poolId, account, user.rewards);
            user.rewards = 0;

            // Delete pool
            if (user.shares == 0) {
                EnumerableSet.remove(bonusPools[account], poolId);
            }
        }
    }

    function getBonusRewards(address account)
        external
        override
        nonReentrant
    {
        for (uint256 index = bonusPoolsLength(account); index > 0; --index) {
            getBonusRewardsPerPool(bonusPoolsId(account, index - 1), account);
        }
    }

    /* ----------------- For Inviter Bonus ----------------- */

    function getInviterBonusRewardsPerPool(uint256 poolId, address account)
        public
        override
        checkPoolId(poolId)
    {
        _updateInviterBonus(poolId, account);
        _checkhalve(poolId);

        PoolInfo storage pool = poolInfo[poolId];
        UserInfo storage user = inviterBonus[poolId][account];

        if (user.rewards > 0) {
            _safeRewardsTransfer(account, user.rewards);
            pool.rewardsPaid = pool.rewardsPaid.add(user.rewards);
            user.rewards = 0;
            emit RewardPaid(poolId, account, user.rewards);

            // Delete pool
            if (user.shares == 0) {
                EnumerableSet.remove(inviterBonusPools[account], poolId);
            }
        }
    }

    function getInviterRewards(address account)
        external
        override
        nonReentrant
    {
        for (uint256 index = inviterBonusPoolsLength(account); index > 0; --index) {
            getInviterBonusRewardsPerPool(inviterBonusPoolsId(account, index - 1), account);
        }
    }

    /* ==================================== Only operator ==================================== */

    function stake(uint256 poolId, address account, uint256 amount)
        external
        override
        nonReentrant
        updateRewards(poolId, account)
        checkhalve(poolId)
    {
        require(amount > 0, "Cannot stake 0");
        require(msg.sender == poolInfo[poolId].operator, "Not operator");

        PoolInfo storage pool = poolInfo[poolId];
        UserInfo storage user = userStakeInfo[poolId][account];

        user.shares = user.shares.add(amount);
        pool.totalShares = pool.totalShares.add(amount);

        // If user haven't been registered, inviter is address(0);
        address inviterAccount = userProfile.inviteBuffEnable() ?
            userProfile.inviter(account) : address(0);

        // If there is a inviter, update bonus and bonus pool info.
        if (inviterAccount != address(0)) {
            _mintBonus(poolId, account, inviterAccount, amount);
        }

        emit Staked(poolId, account, amount);
    }

    function withdraw(uint256 poolId, address account, uint256 amount)
        external
        override
        nonReentrant
        updateRewards(poolId, account)
        checkhalve(poolId)
    {
        require(amount > 0, "Cannot withdraw 0");
        require(msg.sender == poolInfo[poolId].operator, "Not operator");

        UserInfo storage user = userStakeInfo[poolId][account];
        PoolInfo storage pool = poolInfo[poolId];

        // Update shares of user and pool.
        user.shares = user.shares.sub(amount);
        pool.totalShares = pool.totalShares.sub(amount);

        // If user haven't been registered, inviter is address(0);
        address inviterAccount = userProfile.inviter(account);

        // If there is a inviter, remove bonus if staked amount is not enough.
        if (inviterAccount != address(0)) {
            _burnBonus(poolId, account, inviterAccount);
        }

        emit Withdrawn(poolId, account, amount);
    }

    /* ==================================== Internal ==================================== */

    // Safe Token transfer function, just in case if rounding error causes pool to not have enough token.
    function _safeRewardsTransfer(address _to, uint256 _amount) internal {
        uint256 rewardsBal = DEMA.balanceOf(address(this));
        if (_amount > rewardsBal) {
            DEMA.mint(address(this), _amount.sub(rewardsBal));
            DEMA.transfer(_to, DEMA.balanceOf(address(this)));
        } else {
            DEMA.transfer(_to, _amount);
        }
    }

    /* ----------------- Update Pool or User ----------------- */

    function _updateGlobal(uint256 time, uint256 poolId) internal {
        PoolInfo storage pool = poolInfo[poolId];
        if (pool.lastUpdateTime != time) {
            pool.rewardPerTokenStored = rewardPerToken(poolId);
            pool.lastUpdateTime = time;
        }
    }

    // Pool info MUST just be updated.
    function _updateUser(
        uint256 time,
        uint256 poolId,
        address account,
        UserInfo storage user
    ) internal {
        PoolInfo storage pool = poolInfo[poolId];
        if (account != address(0) && time != user.lastUpdateTime) {
            user.rewards = user.shares.mul(pool.rewardPerTokenStored.sub(
                user.userRewardPerTokenPaid)).div(1e18).add(user.rewards);

            user.userRewardPerTokenPaid = pool.rewardPerTokenStored;
            user.lastUpdateTime = time;
        }
    }

    // Update invitees bonus rewards
    function _updateBonus(uint256 poolId, address account) internal {
        require(poolId < nextPoolId, "Don't have a pool");
        uint256 time = lastTimeRewardApplicable(poolId);
        _updateGlobal(time, poolId);
        _updateUser(time, poolId, account, bonus[poolId][account]);
    }

    // Update inviters bonus rewards
    function _updateInviterBonus(uint256 poolId, address account) internal {
        require(poolId < nextPoolId, "Don't have a pool");
        uint256 time = lastTimeRewardApplicable(poolId);
        _updateGlobal(time, poolId);
        _updateUser(time, poolId, account, inviterBonus[poolId][account]);
    }

    function _checkhalve(uint256 poolId) internal {
        PoolInfo storage pool = poolInfo[poolId];

        if (block.timestamp >= pool.periodFinish && pool.leftPeriodTimes > 0) {
            // When last period is finished.
            pool.leftPeriodTimes = pool.leftPeriodTimes.sub(1);

            // Calculate new rewards and mint.
            uint256 reward = pool.leftPeriodTimes == 0 ? 0 : pool.rewardsNextPeriod;
            DEMA.mint(address(this), reward);

            // Update pool info
            pool.rewardsed =    pool.rewardsed.add(reward);
            pool.rewardRate =   reward.div(pool.periodDuration);
            pool.periodFinish = block.timestamp.add(pool.periodDuration);
            pool.rewardsNextPeriod =  pool.leftPeriodTimes > 0 ?
                pool.rewardsNextPeriod.mul(pool.leftRatioNextPeriod).div(100) : 0;

            emit RewardAdded(poolId, reward, pool.leftPeriodTimes);
        }
    }

    function _mintBonus(uint256 poolId, address account, address inviterAccount, uint256 amount) internal {
        UserInfo storage inviter = inviterBonus[poolId][inviterAccount];
        UserInfo storage userBonus = bonus[poolId][account];

        // MUST update rewards before updating shares.
        _updateInviterBonus(poolId, inviterAccount);
        _updateBonus(poolId, account);

        uint256 bonusShare = amount.mul(bonusRatio).div(10000);
        uint256 inviterBonusShare = amount.mul(inviterBonusRatio).div(10000);

        // Update user info
        userBonus.shares = userBonus.shares.add(bonusShare);

        // Update inviter info
        inviter.shares = inviter.shares.add(inviterBonusShare);

        emit EarnedSharesIncreased(poolId, inviterAccount, inviterBonusShare);

        // Update pool info
        poolInfo[poolId].totalShares = poolInfo[poolId].totalShares.add(
            bonusShare).add(inviterBonusShare);

        EnumerableSet.add(bonusPools[account], poolId);
        EnumerableSet.add(inviterBonusPools[inviterAccount], poolId);
    }

    function _burnBonus(uint256 poolId, address account, address inviterAccount) internal {
        // User's bonus.shares must less than maxBonusShares.
        uint256 maxBonusShares = userStakeInfo[poolId][account].shares.mul(bonusRatio).div(10000);
        UserInfo storage userBonus = bonus[poolId][account];

        // Need decrease bonus.
        if (userBonus.shares > maxBonusShares) {
            uint256 bonusReduction = userBonus.shares.sub(maxBonusShares);
            uint256 inviterBonusReduction = bonusRatio == inviterBonusRatio ?
                bonusReduction : bonusReduction.mul(inviterBonusRatio).div(bonusRatio);

            // MUST update rewards before updating shares.
            _updateBonus(poolId, account);
            _updateInviterBonus(poolId, inviterAccount);

            userBonus.shares = maxBonusShares;

            // Update inviter's bonus.
            UserInfo storage inviter = inviterBonus[poolId][inviterAccount];
            inviter.shares = inviter.shares.sub(inviterBonusReduction);
            emit EarnedSharesDecreased(poolId, inviterAccount, inviterBonusReduction);

            // Update pool's total shares.
            poolInfo[poolId].totalShares = poolInfo[poolId].totalShares.sub(
                bonusReduction).sub(inviterBonusReduction);
        }
    }

    /* ==================================== MODIFIERS ==================================== */

    modifier checkPoolId(uint256 poolId) {
        require(poolId < nextPoolId, "Don't have a pool");
        _;
    }

    // Update user staked rewards.
    modifier updateRewards(uint256 poolId, address account) {
        require(poolId < nextPoolId, "Don't have a pool");
        uint256 time = lastTimeRewardApplicable(poolId);
        _updateGlobal(time, poolId);
        _updateUser(time, poolId, account, userStakeInfo[poolId][account]);
        _;
    }

    modifier checkhalve(uint256 poolId) {
        _checkhalve(poolId);
        _;
    }

    /* ==================================== Only owner ==================================== */

    function notifyRewardsAmount(
        uint256 poolId,
        uint256 reward,
        uint256 leftPeriodTimes,
        uint256 periodDuration,
        uint256 leftRatioNextPeriod
    )
        external
        onlyOwner
        checkPoolId(poolId)
        updateRewards(poolId, address(0))
    {
        PoolInfo storage pool = poolInfo[poolId];

        if (block.timestamp >= pool.periodFinish) {
            // If reward period finished
            pool.rewardRate = reward.div(periodDuration);
        } else {
            // If reward period doesn't finished, added the remain reward.
            uint256 remaining = pool.periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(pool.rewardRate);
            pool.rewardRate = reward.add(leftover).div(periodDuration);
        }

        DEMA.mint(address(this), reward);
        pool.rewardsed = pool.rewardsed.add(reward);
        pool.rewardsNextPeriod = reward.mul(leftRatioNextPeriod).div(100);
        pool.leftPeriodTimes = leftPeriodTimes;
        pool.lastUpdateTime = block.timestamp;
        pool.periodFinish = block.timestamp.add(periodDuration);
        pool.periodDuration = periodDuration;
        pool.leftRatioNextPeriod = leftRatioNextPeriod;

        emit RewardAdded(poolId, reward, pool.leftPeriodTimes);
    }

    function addPool(
        uint256 rewardFirstPeriod,
        uint256 leftPeriodTimes,        // 1 means twice
        uint256 periodDuration,
        uint256 leftRatioNextPeriod,
        address operator
    )
        external
        onlyOwner
    {
        PoolInfo storage pool = poolInfo[nextPoolId];
        nextPoolId += 1;

        pool.leftPeriodTimes = leftPeriodTimes;
        pool.periodDuration = periodDuration;
        pool.leftRatioNextPeriod = leftRatioNextPeriod;
        pool.operator = operator;

        // Mint reward and update related variables
        DEMA.mint(address(this), rewardFirstPeriod);
        pool.rewardsed = rewardFirstPeriod;
        pool.rewardsNextPeriod = pool.rewardsed.mul(leftRatioNextPeriod).div(100);
        pool.rewardRate = rewardFirstPeriod.div(periodDuration);
        pool.lastUpdateTime = block.timestamp;
        pool.periodFinish = block.timestamp.add(periodDuration);

        // Init variables
        pool.rewardPerTokenStored = 0;
        pool.rewardsPaid = 0;
        pool.totalShares = 0;
    }

    function stop(uint256 poolId) external onlyOwner {
        PoolInfo storage pool = poolInfo[poolId];

        // Burn the leftover amount.
        uint256 remaining = pool.periodFinish.sub(block.timestamp);
        uint256 leftover = remaining.mul(pool.rewardRate);
        DEMA.burn(address(this), leftover);
        pool.rewardsed = pool.rewardsed.sub(leftover);

        pool.leftPeriodTimes = 0;
        pool.rewardsNextPeriod = 0;
        pool.periodFinish = block.timestamp;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 poolId, uint256 reward, uint256 leftPeriodTimes);
    event Staked(uint256 poolId, address indexed user, uint256 amount);
    event EarnedSharesIncreased(uint256 poolId, address indexed inviter, uint256 earnedShareEquivalent);
    event Withdrawn(uint256 poolId, address indexed user, uint256 amount);
    event EarnedSharesDecreased(uint256 poolId, address indexed inviter, uint256 earnedShareEquivalent);
    event RewardPaid(uint256 poolId, address indexed user, uint256 reward);
    event Burn(uint256 poolId, uint256 amount);
}
