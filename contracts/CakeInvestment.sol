// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interface/Pancake/ICakeinvestment.sol";
import "./interface/Pancake/ICakeVault.sol";
import "./utils/SafeToken.sol";


contract CakeInvestment is Ownable, ICakeinvestment {
    /// @notice Libraries
    using SafeToken for address;
    using SafeMath for uint256;

    /// @notice Events
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    address cake;
    ICakeVault public cakeVault;

    /// @notice Mutable state variables

    struct GlobalInfo {
        uint256 totalShares; // number of shares 
        uint256 lastDepositedTime; // keeps track of deposited time for potential penalty
        uint256 cakeAtLastUserAction; // keeps track of cake deposited at the last user action
        uint256 lastUserActionTime; // keeps track of the last user action time
        uint256 accCakePerShare;
        uint256 totalDepositedCake;
        uint256 totalRewards;
        uint256 lastUpdateTime;
    }

    struct UserInfo {
        uint256 shares; // number of shares for a user
        uint256 lastDepositedTime; // keeps track of deposited time for potential penalty
        uint256 cakeAtLastUserAction; // keeps track of cake deposited at the last user action
        uint256 lastUserActionTime; // keeps track of the last user action time
        uint256 accCakePerShareStored;
        uint256 totalDepositedCake;
        uint256 totalRewards;
        uint256 lastUpdateTime;
    }

    mapping(address => UserInfo) public userInfo;
    GlobalInfo public globalInfo;
    uint256 public override reservedRatio;       // Reserved share ratio. will divide by 10000, 0 means not reserved.
    bool public isReinvestStop;

    constructor(
        ICakeVault _cakeVault,
        address _cake,
        uint256 _reserveRatio           // will divide by 10000, 0 means not reserved.
    ) public {
        cakeVault = _cakeVault;
        cake = _cake;
        reservedRatio = _reserveRatio;

        cake.safeApprove(address(cakeVault), uint256(-1));
    }

    /* ==================================== Read ==================================== */
    
    // 合约在cakeVault池子中的Cake数量
    function totalPoolCakes() public view returns (uint256) {
        if(isReinvestStop) {
            return globalInfo.cakeAtLastUserAction;
        } else {
            (uint256 shares, , , ) = cakeVault.userInfo(address(this));
            return cakeVault.balanceOf().mul(shares).div(cakeVault.totalShares());
        }
        
    }

    // 合约在cakeVault池子中的Cake数量减去所有用户存入合约中的cake
    function totalRewards() public view returns (uint256) {
        return totalPoolCakes().sub(globalInfo.totalDepositedCake);
    }

    // 合约中每个share获得的奖励.
    function rewardsPerShare() public view  returns (uint256) {
        if( totalRewards() != 0){
            return totalRewards().div(globalInfo.totalShares);
        } else {
            return uint256(0);
        }
    }

    // 用户所拥有的cake
    function userTotalCakes(address account) public view returns(uint256) {
        return totalPoolCakes().mul(userInfo[account].shares);
    }

    /// @notice Goblin is the user.
    function userEarnedAmount(address account) public view override returns (uint256) {
        return userTotalCakes(account).sub(userInfo[account].totalDepositedCake);
    }

    // 用户拥有的shares
    function userShares(address account) public view returns(uint256) {
        return userInfo[account].shares;
    }



    /* ==================================== Write ==================================== */

    // Deposit CAKE.
    function deposit(uint256 amount) external override {
        require(!isReinvestStop, "Cake reinvestment has been stop");
        require(amount >0, "Deposited amount must be over 0!!");
        require(amount <= cake.balanceOf(msg.sender), "Deposited amount exceed cake balance!!");

        // 转账CAKE到合约
        cake.safeTransfer(address(this), amount);
        // 充值到cakeVault
        cakeVault.deposit(amount);
        
        // 当前时间戳
        uint256 nowTime = block.timestamp;       
        
        // 所有用户充值到合约的CAKE
        globalInfo.totalDepositedCake = globalInfo.totalDepositedCake.add(amount);

        // 计算当前充值CAKE 转换得到的shares
        uint256 currentShares = 0;
        if (globalInfo.totalShares != 0) {
            currentShares = (amount.mul(globalInfo.totalShares)).div(globalInfo.totalDepositedCake);
        } else {
            currentShares = amount;
        }

        // 保存当前合约的shares总量
        globalInfo.totalShares =  globalInfo.totalShares.add(currentShares);
        globalInfo.lastDepositedTime = nowTime;

       // 计算当前用户和合约所有者的shares 和 CAKE 数量
        uint256 ownerShares = 0;
        uint256 ownerAmount = 0;

        if(reservedRatio != 0 && msg.sender != owner()){
            // 合约所有者的shares 数量
            ownerShares = currentShares.mul(reservedRatio).div(10000);
            // 合约所有者的CAKE数量
            ownerAmount = amount.mul(reservedRatio).div(1000);

            userInfo[owner()].shares = userInfo[owner()].shares.add(ownerShares);
            userInfo[owner()].totalDepositedCake = userInfo[owner()].totalDepositedCake.add(ownerAmount);
            userInfo[owner()].lastDepositedTime = nowTime;

            // Calculate the left shares
            currentShares = currentShares.sub(ownerShares);
            amount -= ownerAmount;
        }

        // 充值用户的shares 和 CAKE 数量
        userInfo[msg.sender].totalDepositedCake = userInfo[msg.sender].totalDepositedCake.add(amount);
        userInfo[msg.sender].shares = userInfo[msg.sender].shares.add(currentShares);
        userInfo[msg.sender].lastDepositedTime = nowTime;
        
    }

    // Withdraw CAKE to sender.
    function withdraw(uint256 amount) external override {
        require(amount >0, "Withdraw amount must be over 0!!");
        require(amount <= userTotalCakes(msg.sender) || amount <= userInfo[msg.sender].totalDepositedCake , "Withdraw amount exceed cake balance!!");

        if(isReinvestStop && cake.balanceOf(address(this)) >= amount) {
            uint256 rate = globalInfo.totalDepositedCake.div(totalPoolCakes());
            uint256 withdrawCake = amount.mul(rate);
            uint256 shares = amount.div(userInfo[msg.sender].totalDepositedCake).mul(userInfo[msg.sender].shares);

            cake.safeTransfer( msg.sender, amount);

            uint256 nowTime = block.timestamp;

            globalInfo.totalDepositedCake = globalInfo.totalDepositedCake.sub(withdrawCake);
            globalInfo.cakeAtLastUserAction = globalInfo.cakeAtLastUserAction.sub(amount);
            globalInfo.totalShares = globalInfo.totalShares.sub(shares);
            globalInfo.lastUserActionTime = nowTime;

            
            userInfo[msg.sender].totalDepositedCake = userInfo[msg.sender].totalDepositedCake.sub(withdrawCake);
            userInfo[msg.sender].shares = userInfo[msg.sender].shares.sub(shares);
            userInfo[msg.sender].lastUserActionTime = nowTime;

        } else {
            uint256 rate = globalInfo.totalDepositedCake.div(totalPoolCakes());
            uint256 cakeVaultShares = amount.mul(rewardsPerShare());
            uint256 withdrawCake = amount.mul(rate);
            uint256 shares = withdrawCake.div(userInfo[msg.sender].totalDepositedCake).mul(userInfo[msg.sender].shares);


            cakeVault.withdraw(cakeVaultShares);
            cake.safeTransfer( msg.sender, amount);

            uint256 nowTime = block.timestamp;

            globalInfo.totalDepositedCake = globalInfo.totalDepositedCake.sub(withdrawCake);
            globalInfo.totalShares = globalInfo.totalShares.sub(shares);
            globalInfo.lastUserActionTime = nowTime;
            
            userInfo[msg.sender].totalDepositedCake = userInfo[msg.sender].totalDepositedCake.sub(withdrawCake);
            userInfo[msg.sender].shares = userInfo[msg.sender].shares.sub(shares);
            userInfo[msg.sender].lastUserActionTime = nowTime;
        }
    }

    // 用户复投
    function reinvest() external {
        require(!isReinvestStop, "Cake reinvestment has been stop");
        uint256 amounts =  userTotalCakes(msg.sender);
        this.withdraw(amounts);
        this.deposit(amounts);
    }


    /* ==================================== Only Owner ==================================== */
    // 管理员 harvest
    function harvest() external onlyOwner {
        cakeVault.harvest();
    }

    // 重启复投
    function restartReinvest() external onlyOwner {
        cakeVault.deposit(globalInfo.totalDepositedCake);
        globalInfo.cakeAtLastUserAction = 0;
        globalInfo.lastUserActionTime = block.timestamp;
        isReinvestStop = false;
    }

    // 终止复投
    function stopReinvest() external onlyOwner {
        // cakeVault池子中当前合约所有shares
        (uint256 shares, , ,  )= cakeVault.userInfo(address(this));
        // 当前合约取回cakeVault前所有cake
        uint256 beforeWidthdraw = cake.balanceOf(address(this));
        if (shares > 0) {
            cakeVault.withdraw(shares);
        }
        // 当前合约取回cakeVault后所有cake
        uint256 afterWidthdraw = cake.balanceOf(address(this));
        // 归属于所有用户充值cake投入cakeVault 终止投入后退回的所有cake ， 包括本金以及利润
        globalInfo.cakeAtLastUserAction = afterWidthdraw.sub(beforeWidthdraw);
        isReinvestStop = true;
    }

    /**
     * @notice Withdraw unexpected tokens sent to the Cake Vault
     * 管理员取出用户误存到此合约的非cake代币资产
     */
    function inCaseTokensGetStuck(address _token) external onlyOwner {
        require(_token != address(cake), "Token cannot be same as deposit token");
        // require(_token != address(receiptToken), "Token cannot be same as receipt token");

        uint256 amount = _token.balanceOf(address(this));
        _token.safeTransfer(msg.sender, amount);
    }
}