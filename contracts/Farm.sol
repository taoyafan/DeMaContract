pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./Interface/IFarm.sol";
import "./Interface/IDEMA.sol";
import "./interface/IUserProfile.sol";


contract Farm is IFarm, Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    struct PoolInfo {
        // Need to be set
        uint256 leftPeriodTimes;        // 0 means stop.
        uint256 periodDuration;         // Each period duration time.
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

    struct UserStakeInfo {
        uint256 rewards;                    // Earned rewards.
        uint256 userRewardPerTokenPaid;     // Rewards per token paid.
        uint256 shares;                     // Stake shares.
        uint256 lastUpdateTime;
    }

    struct InviterBonus {
        uint256 rewards;                    // Earned rewards.
        uint256 userRewardPerTokenPaid;     // Rewards per token paid.
        uint256 shares;                     // Earned bounse share as an inviter.
        uint256 lastUpdateTime;
    }

    // Bouns earned as a invitee.
    struct Bouns {
        uint256 rewards;                    // Earned rewards.
        uint256 userRewardPerTokenPaid;     // Rewards per token paid.
        uint256 shares;                     // Earned bounse share as an invitee.
        uint256 lastUpdateTime;
    }

    IDEMA DEMA;
    IUserProfile userProfile;

    mapping(uint256 => PoolInfo) public poolInfo;
    uint256 nextPoolId = 0;

    mapping(uint256 => mapping(address => UserStakeInfo)) public userStakeInfo; // TODO Check user
    mapping(uint256 => mapping(address => InviterBonus)) public inviterBonus;   // TODO Check user
    mapping(uint256 => mapping(address => Bouns)) public bonus;                 // TODO Check user

    using EnumerableSet for EnumerableSet.UintSet;
    mapping(address => EnumerableSet.UintSet) internal userStakedPools;         // TODO Check user
    mapping(address => EnumerableSet.UintSet) internal inviterBonusPools;       // TODO Check user
    mapping(address => EnumerableSet.UintSet) internal bonusPools;         // invitee's bonus pool. TODO Check user.

    // For inviting
    uint256 inviterBounseRatio; // Inviters' bonus ratio, will divide 10000, 500 means 5%
    uint256 bonusRatio;         // Invitees' bonus ratio, will divide 10000, 500 means 5%

    /* ========== CONSTRUCTOR ========== */

    constructor(
        IUserProfile _userProfile,
        IDEMA _rewardsToken,
        uint256 _inviterBounseRatio,
        uint256 _bonusRatio
    ) Ownable() public {
        userProfile = _userProfile;
        DEMA = _rewardsToken;
        inviterBounseRatio = _inviterBounseRatio;
        bonusRatio = _bonusRatio;
    }

    /* ==================================== Read ==================================== */

    // Elapsed time of the last / current period should be rewarded.
    function lastTimeRewardApplicable(uint256 poolId) public view override checkPoolId(poolId) returns (uint256) {
        return Math.min(block.timestamp, poolInfo[poolId].periodFinish);
    }

    // TODO update these info for bonus.

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

    function earnedPerPool(uint256 poolId, address account) public view override checkPoolId(poolId) returns (uint256) {
        UserInfo storage user = userInfoPerPool[poolId][account];
        return user.totalShares.mul(rewardPerToken(poolId).sub(user.userRewardPerTokenPaid)).div(1e18).add(user.rewards);
    }

    function earned(address account) public view override returns (uint256) {
        uint256 totalEarned = 0;
        for (uint256 index = 0; index < _userPoolsLength(account); ++index) {
            totalEarned = totalEarned.add(earnedPerPool(_userPoolsId(account, index), account));
        }
        return totalEarned;
    }

    function totalSharesPerPool(uint256 poolId) public view override checkPoolId(poolId) returns (uint256) {
        return poolInfo[poolId].totalShares;
    }

    function totalShares() external view override returns (uint256) {
        uint256 total = 0;
        for (uint256 poolId = 0; poolId < nextPoolId; ++poolId) {
            total = total.add(totalSharesPerPool(poolId));
        }
        return total;
    }

    function sharesOfPerPool(uint256 poolId, address account) public view override checkPoolId(poolId) returns (uint256) {
        UserInfo storage user = userInfoPerPool[poolId][account];
        return user.totalShares;
    }

    function sharesOf(address account) external view override returns (uint256) {
        uint256 total = 0;
        for (uint256 index = 0; index < _userPoolsLength(account); ++index) {
            total = total.add(sharesOfPerPool(_userPoolsId(account, index), account));
        }
        return total;
    }

    /* ==================================== Write ==================================== */

    // TODO Add function for bonus rewards
    function getRewardsPerPool(uint256 poolId, address account)
        public
        override
        nonReentrant
        checkPoolId(poolId)
        updateRewards(poolId, account)      // TODO Remember change to others
        checkhalve(poolId)
    {
        PoolInfo storage pool = poolInfo[poolId];
        UserInfo storage user = userInfoPerPool[poolId][account];

        if (user.rewards > 0) {
            _safeRewardsTransfer(account, user.rewards);
            pool.rewardsPaid = pool.rewardsPaid.add(user.rewards);
            user.rewards = 0;
            emit RewardPaid(poolId, account, user.rewards);

            // Delete pool
            if (user.totalShares == 0) {
                EnumerableSet.remove(userStakedPools[account], poolId);
            }
        }
    }

    function getRewards(address account)
        public
        override
        nonReentrant
    {
        for (uint256 index = 0; index < _userPoolsLength(account); ++index) {
            getRewardsPerPool(_userPoolsId(account, index), account);
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
        UserInfo storage user = userInfoPerPool[poolId][account];

        user.shares = user.shares.add(amount);
        pool.totalShares = pool.totalShares.add(amount);
        EnumerableSet.add(userStakedPools[account], poolId);

        // If user haven't been registered, inviter is address(0);
        address inviterAccount = userProfile.inviteBuffEnable() ?
            userProfile.inviter(account) : address(0);
        
        // If there is a inviter, update bonus and bonus pool info.
        if (inviterAccount != address(0)) {
            InviterBonus storage inviter = inviterBonus[poolId][inviterAccount];
            Bonus storage userBonus = bonus[poolId][account];

            _updateInviterBonus(poolId, inviterAccount);
            _updateBonus(poolId, account);

            uint256 bonusShare = amount.mul(bounseRatio).div(10000);
            uint256 inviterBonusShare = amount.mul(inviterBounseRatio).div(10000);

            // Update user info
            userBonus.shares = user.invitedShares.add(bonusShare);

            // Update inviter info
            inviter.shares = inviter.earnedShares.add(inviterBonusShare);

            emit EarnedSharesIncreased(poolId, inviterAccount, inviterBonusShare);

            // Update pool info
            pool.totalShares = pool.totalShares.add(bonusShare).add(inviterBonusShare);

            EnumerableSet.add(bonusPools[account], poolId);
            EnumerableSet.add(inviterBonusPools[inviterAccount], poolId);
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

        UserInfo storage user = userInfoPerPool[poolId][account];
        PoolInfo storage pool = poolInfo[poolId];

        // TODO update info to bonus. remember to update bonus pool.

        // If user haven't been registered, inviter is address(0);
        address inviterAccount = userProfile.inviter(account);

        if (inviterAccount == address(0)) {
            // no inviter
            require(user.invitedShares == 0, "Should specific inviter which can not be 0");
            require(user.normalShares >= amount, "Not enough share to withdraw");

            // Update user info
            user.totalShares = user.totalShares.sub(amount);
            user.normalShares = user.normalShares.sub(amount);

            // Update pool info
            pool.totalShares = pool.totalShares.sub(amount);
        } else {
            // If there is a inviter
            UserInfo storage inviter = userInfoPerPool[poolId][inviterAccount];

            // If user have normal shares, withdraw it first.
            if (user.normalShares > 0) {
                // How many normal shares can be withdraw
                uint256 normalAmount = user.normalShares > amount ? amount : user.normalShares;

                // Withdraw normal shares
                user.totalShares = user.totalShares.sub(normalAmount);
                user.normalShares = user.normalShares.sub(normalAmount);
                pool.totalShares = pool.totalShares.sub(normalAmount);

                // How many amount left
                amount = amount.sub(normalAmount);
            }

            // If normal shares is not enough, then withdraw invited shares.
            if (amount > 0) {

                uint256 inviterShareEquivalent = amount.mul(pool.invitedFactor).div(10000);
                uint256 earnedShareEquivalent = amount.mul(pool.earnedFactor).div(10000);

                // Withdraw user invited shares
                user.invitedShares = user.invitedShares.sub(amount);
                user.totalShares = user.totalShares.sub(inviterShareEquivalent);

                // Withdraw inviter earned shares
                inviter.earnedShares = inviter.earnedShares.sub(amount);
                inviter.totalShares = inviter.totalShares.sub(earnedShareEquivalent);
                emit EarnedSharesDecreased(poolId, inviterAccount, earnedShareEquivalent);

                // Update pool info
                pool.totalShares = pool.totalShares.sub(inviterShareEquivalent).sub(earnedShareEquivalent);
            }
        }
        emit Withdrawn(poolId, account, amount);
    }

    /* ==================================== Internal ==================================== */

    // TODO Remove these function to Bank. And it should be public.

    function _userPoolsLength(address account) internal view returns (uint256) {
        return EnumerableSet.length(userStakedPools[account]);
    }

    function _userPoolsId(address account, uint256 index) internal view returns (uint256) {
        return EnumerableSet.at(userStakedPools[account], index);
    }

    // Safe Token transfer function, just in case if rounding error causes pool to not have enough token.
    function _safeRewardsTransfer(address _to, uint256 _amount) internal {
        uint256 rewardsBal = DEMA.balanceOf(address(this));
        if (_amount > rewardsBal) {
            DEMA.transfer(_to, rewardsBal);
        } else {
            DEMA.transfer(_to, _amount);
        }
    }

    function _addInviterShares(
        UserInfo storage inviter,
        uint256 earnedShares,
        uint256 earnedShareEquivalent
    ) internal {
        inviter.earnedShares = inviter.earnedShares.add(earnedShares);
        inviter.totalShares = inviter.totalShares.add(earnedShareEquivalent);
    }

    // TODO Check if we update these pools. When change bonus
    // Update invitees bonus rewards
    function _updateBonus(uint256 poolId, address account) internal {
        require(poolId < nextPoolId, "Don't have a pool");
        uint256 time = lastTimeRewardApplicable(poolId);

        PoolInfo storage pool = poolInfo[poolId];
        if (pool.lastUpdateTime != time) {
            pool.rewardPerTokenStored = rewardPerToken(poolId);
            pool.lastUpdateTime = time;
        }

        UserInfo storage invitee = bonus[poolId][account];
        if (account != address(0) && time != invitee.lastUpdateTime) {
            invitee.rewards = earnedPerPool(poolId, account);
            invitee.userRewardPerTokenPaid = pool.rewardPerTokenStored;
            invitee.lastUpdateTime = time;
        }
    }

    // Update inviters bonus rewards
    function _updateInviterBonus(uint256 poolId, address account) internal {
        require(poolId < nextPoolId, "Don't have a pool");
        uint256 time = lastTimeRewardApplicable(poolId);
        
        PoolInfo storage pool = poolInfo[poolId];
        if (pool.lastUpdateTime != time) {
            pool.rewardPerTokenStored = rewardPerToken(poolId);
            pool.lastUpdateTime = time;
        }

        UserInfo storage inviter = inviterBonus[poolId][account];
        if (account != address(0) && time != inviter.lastUpdateTime) {
            inviter.rewards = earnedPerPool(poolId, account);
            inviter.userRewardPerTokenPaid = pool.rewardPerTokenStored;
            inviter.lastUpdateTime = time;
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

        // TODO check users' update time in others file. 
        PoolInfo storage pool = poolInfo[poolId];
        if (pool.lastUpdateTime != time) {
            pool.rewardPerTokenStored = rewardPerToken(poolId);
            pool.lastUpdateTime = time;
        }

        UserInfo storage user = userStakeInfo[poolId][account];
        if (account != address(0) && time != user.lastUpdateTime) {
            user.rewards = earnedPerPool(poolId, account);
            user.userRewardPerTokenPaid = pool.rewardPerTokenStored;
            user.lastUpdateTime = time;
        }
        _;
    }

    modifier checkhalve(uint256 poolId) {
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
            pool.rewardsNextPeriod =  pool.leftPeriodTimes > 0 ? pool.rewardsNextPeriod.mul(70).div(100) : 0;

            emit RewardAdded(poolId, reward, pool.leftPeriodTimes);
        }
        _;
    }

    /* ==================================== Only owner ==================================== */

    function notifyRewardsAmount(uint256 poolId, uint256 reward, uint256 leftPeriodTimes)
        external
        override
        onlyOwner
        checkPoolId(poolId)
        updateRewards(poolId, address(0))
    {
        PoolInfo storage pool = poolInfo[poolId];

        if (block.timestamp >= pool.periodFinish) {
            // If reward period finished
            pool.rewardRate = reward.div(pool.periodDuration);
        } else {
            // If reward period doesn't finished, added the remain reward.
            uint256 remaining = pool.periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(pool.rewardRate);
            pool.rewardRate = reward.add(leftover).div(pool.periodDuration);
        }

        DEMA.mint(address(this), reward);
        pool.rewardsed = reward;
        pool.rewardsNextPeriod = pool.rewardsed.mul(70).div(100);
        pool.leftPeriodTimes = leftPeriodTimes;
        pool.lastUpdateTime = block.timestamp;
        pool.periodFinish = block.timestamp.add(pool.periodDuration);

        emit RewardAdded(poolId, reward, pool.leftPeriodTimes);
    }

    function addPool(
        uint256 rewardFirstPeriod,
        uint256 leftPeriodTimes,
        uint256 periodDuration,
        address operator
    )
        external
        override
        onlyOwner
    {
        PoolInfo storage pool = poolInfo[nextPoolId];
        nextPoolId += 1;

        pool.leftPeriodTimes = leftPeriodTimes;
        pool.periodDuration = periodDuration;
        pool.operator = operator;

        // Mint reward and update related variables
        DEMA.mint(address(this), rewardFirstPeriod);
        pool.rewardsed = rewardFirstPeriod;
        pool.rewardsNextPeriod = pool.rewardsed.mul(70).div(100);
        pool.rewardRate = rewardFirstPeriod.div(periodDuration);
        pool.lastUpdateTime = block.timestamp;
        pool.periodFinish = block.timestamp.add(periodDuration);

        // Init variables
        pool.rewardPerTokenStored = 0;
        pool.rewardsPaid = 0;
        pool.totalShares = 0;
    }

    function burn(uint256 poolId, uint256 amount) external override onlyOwner {
        PoolInfo storage pool = poolInfo[poolId];

        pool.leftPeriodTimes = 0;
        pool.rewardsNextPeriod = 0;
        pool.periodFinish = block.timestamp;
        DEMA.burn(address(this), amount);
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
