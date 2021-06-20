pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interface/IBankConfig.sol";
import "./interface/IFarm.sol";
import "./interface/IGoblin.sol";
import "./utils/SafeToken.sol";

contract Bank is Ownable, ReentrancyGuard {
    using SafeToken for address;
    using SafeMath for uint256;

    event OpPosition(uint256 indexed id, uint256[2] debts, uint[2] back);
    event Liquidate(uint256 indexed id, address indexed killer, uint256[2] prize, uint256[2] left);

    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;

    /* ----------------- Banks Info ----------------- */

    struct TokenBank {
        address tokenAddr;
        bool isOpen;
        bool canDeposit;
        uint256 poolId;

        uint256 totalVal;           // Left balance, including reserved
        uint256 totalShares;        // Stake shares
        uint256 totalDebt;          // Debts balance
        uint256 totalDebtShares;    // Debts shares
        uint256 totalReserve;       // Reserved amount.
        uint256 lastInterestTime;
    }

    struct UserBankInfo {
        mapping(address => uint256) sharesPerToken;     // Shares per token pool
        EnumerableSet.AddressSet banksAddress;          // Stored banks' address.
    }

    mapping(address => TokenBank) public banks;         // Token address => TokenBank
    mapping(address => UserBankInfo) userBankInfo;      // User account address => Bank address.

    /* -------- Productions / Positions Info -------- */

    struct Production {
        address[2] borrowToken;
        bool isOpen;
        bool[2] canBorrow;

        IGoblin goblin;
        uint256[2] minDebt;
        uint256 openFactor;         // When open: (debts / total) should < (openFactor / 10000)
        uint256 liquidateFactor;    // When liquidate: new health should < (liquidateFactor / 10000)
    }

    struct Position {
        address owner;
        uint256 productionId;
        uint256[2] debtShare;
    }

    struct UserPPInfo {
        EnumerableSet.UintSet posId;                    // position id
        EnumerableSet.UintSet prodId;                   // production id
        mapping(uint256 => uint256) posNum;             // position num of each production(id)
    }

    mapping(address => UserPPInfo) userPPInfo;      // User Productions, Positions Info.

    mapping(uint256 => Production) public productions;
    uint256 public currentPid = 1;

    mapping(uint256 => Position) public positions;
    uint256 public currentPos = 1;

    /* ----------------- Others ----------------- */

    IBankConfig public config;
    IFarm Farm;

    /* ----------------- Temp ----------------- */

    // Used in opProduction to prevent stack over deep
    struct WorkAmount {
        uint256 sendBSC;
        uint256[2] beforeToken;      // How many token in the pool after borrow before goblin work
        uint256[2] debts;
        uint256[2] backToken;
        bool[2] isBorrowBSC;
        bool borrowed;
    }

    // Used in liquidate to prevent stack over deep
    struct liqTemp {
        uint256[2] debts;
        uint256 health;
        uint256[2] before;
        uint256 back;           // Only one item is to save memory.
        uint256 rest;           // Only one item is to save memory.
        uint256[2] prize;
        uint256[2] left;
        bool[2] isBSC;
    }

    modifier onlyEOA() {
        require(msg.sender == tx.origin, "not eoa");
        _;
    }

    constructor(address _stakingRewards) public {
        Farm = IFarm(_stakingRewards);
    }

    /* ==================================== Read ==================================== */

    function positionInfo(uint256 posId)
        public
        view
        returns (uint256, uint256[2] memory, uint256[2] memory, address)
    {
        Position storage pos = positions[posId];
        Production storage prod = productions[pos.productionId];

        uint256 debt0 = debtShareToVal(prod.borrowToken[0], pos.debtShare[0]);
        uint256 debt1 = debtShareToVal(prod.borrowToken[1], pos.debtShare[1]);

        return (pos.productionId, prod.goblin.health(posId, prod.borrowToken, [debt0, debt1]),
            [debt0, debt1], pos.owner);
    }

    // Total amount, not including reserved
    function totalToken(address token) public view returns (uint256) {
        TokenBank storage bank = banks[token];
        require(bank.isOpen, 'token not exists');

        uint balance = token == address(0)? address(this).balance: SafeToken.myBalance(token);
        balance = bank.totalVal < balance? bank.totalVal: balance;

        return balance.add(bank.totalDebt).sub(bank.totalReserve);
    }

    function debtShareToVal(address token, uint256 debtShare) public view returns (uint256) {
        TokenBank storage bank = banks[token];
        require(bank.isOpen, 'token not exists');

        if (bank.totalDebtShares == 0) return debtShare;
        return debtShare.mul(bank.totalDebt).div(bank.totalDebtShares);
    }

    function debtValToShare(address token, uint256 debtVal) public view returns (uint256) {
        TokenBank storage bank = banks[token];
        require(bank.isOpen, 'token not exists');

        if (bank.totalDebt == 0) return debtVal;
        return debtVal.mul(bank.totalDebtShares).div(bank.totalDebt);
    }

    /* ----------------- Get user info ----------------- */

    /* ---- User Banks Info ---- */

    function userBanksNum(address account) public view returns (uint256) {
        return EnumerableSet.length(userBankInfo[account].banksAddress);
    }

    // Bank address is same as token address store in bank.
    function userBankAddress(address account, uint256 index) public view returns (address) {
        return EnumerableSet.at(userBankInfo[account].banksAddress, index);
    }

    function userSharesPreTokoen(address account, address token) external view returns (uint256) {
        return userBankInfo[account].sharesPerToken[token];
    }

    function earnPertoken(address account, address token) public view returns (uint256) {
        TokenBank storage bank = banks[token];
        return Farm.stakeEarnedPerPool(bank.poolId, account);
    }

    function earn(address account) external view returns (uint256) {
        uint256 totalEarn = 0;
        for (uint256 index = 0; index < userBanksNum(account); ++index) {
            totalEarn = totalEarn.add(earnPertoken(account, userBankAddress(account, index)));
        }
        return totalEarn;
    }

    /* ---- User Positions Info ---- */

    function userPosNum(address account) public view returns (uint256) {
        return EnumerableSet.length(userPPInfo[account].posId);
    }

    function userPosId(address account, uint256 index) public view returns (uint256) {
        return EnumerableSet.at(userPPInfo[account].posId, index);
    }

    /* ---- User Productions Info ---- */

    function userProdNum(address account) public view returns (uint256) {
        return EnumerableSet.length(userPPInfo[account].prodId);
    }

    function userProdId(address account, uint256 index) public view returns (uint256) {
        return EnumerableSet.at(userPPInfo[account].prodId, index);
    }

    /* ==================================== Write ==================================== */

    function deposit(address token, uint256 amount) public payable nonReentrant {
        TokenBank storage bank = banks[token];
        UserBankInfo storage user = userBankInfo[msg.sender];
        require(bank.isOpen && bank.canDeposit, 'Token not exist or cannot deposit');

        _calInterest(token);

        if (token != address(0)) {
            // Token is not bnb
            SafeToken.safeTransferFrom(token, msg.sender, address(this), amount);
        } else {
            amount = msg.value;
        }

        bank.totalVal = bank.totalVal.add(amount);
        uint256 total = totalToken(token).sub(amount);

        uint256 newShares = (total == 0 || bank.totalShares == 0) ? amount: amount.mul(bank.totalShares).div(total);

        // Update bank info
        bank.totalShares = bank.totalShares.add(newShares);

        // Update user info
        user.sharesPerToken[token] = user.sharesPerToken[token].add(newShares);
        EnumerableSet.add(user.banksAddress, token);

        Farm.stake(bank.poolId, msg.sender, newShares);
    }

    function withdraw(address token, uint256 withdrawShares) external nonReentrant {
        TokenBank storage bank = banks[token];
        UserBankInfo storage user = userBankInfo[msg.sender];
        require(bank.isOpen, 'Token not exist');

        _calInterest(token);

        uint256 amount = withdrawShares.mul(totalToken(token)).div(bank.totalShares);
        bank.totalVal = bank.totalVal.sub(amount);

        bank.totalShares = bank.totalShares.sub(withdrawShares);
        user.sharesPerToken[token] = user.sharesPerToken[token].sub(withdrawShares);

        Farm.withdraw(bank.poolId, msg.sender, withdrawShares);

        // get DEMA rewards
        getBankRewards();

        if (token == address(0)) {//BSC
            SafeToken.safeTransferETH(msg.sender, amount);
        } else {
            SafeToken.safeTransfer(token, msg.sender, amount);
        }
    }

    /**
     * @dev Create position:
     * opPosition(0, productionId, [borrow0, borrow1],
     *     [addLpStrategyAddress, _token0, _token1, token0Amount, token1Amount, _minLPAmount] )
     * note: if token is BSC, token address should be address(0);
     *
     * @dev Replenishment:
     * opPosition(posId, productionId, [0, 0],
     *     [addLpStrategyAddress, _token0, _token1, token0Amount, token1Amount, _minLPAmount] )
     *
     * @dev Withdraw:
     * opPosition(posId, productionId, [0, 0], [withdrawStrategyAddress, token0, token1, rate, whichWantBack] )
     * note: rate means how many LP will be removed liquidity. max rate is 10000 means 100%.
     *        The amount of repaid debts is the same rate of total debts.
     *        whichWantBack = 0(token0), 1(token1), 2(token what surplus).
     *
     * @dev Repay:
     * opPosition(posId, productionId, [0, 0], [withdrawStrategyAddress, token0, token1, rate, 3] )
     * note: rate means how many LP will be removed liquidity. max rate is 10000 means 100%.
     *       All withdrawn LP will used to repay debts.
     */
    function opPosition(uint256 posId, uint256 pid, uint256[2] calldata borrow, bytes calldata data)
        external
        payable
        onlyEOA
        nonReentrant
    {
        UserPPInfo storage user = userPPInfo[msg.sender];
        if (posId == 0) {
            // Create a new position
            posId = currentPos;
            currentPos ++;
            positions[posId].owner = msg.sender;
            positions[posId].productionId = pid;

            EnumerableSet.add(user.posId, posId);
            EnumerableSet.add(user.prodId, pid);
            user.posNum[pid] = user.posNum[pid].add(1);

        } else {
            require(posId < currentPos, "bad position id");
            require(positions[posId].owner == msg.sender, "not position owner");

            pid = positions[posId].productionId;
        }

        Production storage production = productions[pid];

        require(production.isOpen, 'Production not exists');

        require((borrow[0] == 0 || production.canBorrow[0]) &&
            (borrow[1] == 0 || production.canBorrow[1]) , "Production can not borrow");

        _calInterest(production.borrowToken[0]);
        _calInterest(production.borrowToken[1]);

        WorkAmount memory amount;
        amount.sendBSC = msg.value;
        amount.debts = _removeDebt(positions[posId], production);
        uint256 i;

        for (i = 0; i < 2; ++i) {
            amount.debts[i] = amount.debts[i].add(borrow[i]);
            amount.isBorrowBSC[i] = production.borrowToken[i] == address(0);

            // Save the amount of borrow token after borrowing before goblin work.
            if (amount.isBorrowBSC[i]) {
                amount.sendBSC = amount.sendBSC.add(borrow[i]);
                require(amount.sendBSC <= address(this).balance && amount.debts[i] <= banks[production.borrowToken[i]].totalVal,
                    "insufficient BSC in the bank");
                amount.beforeToken[i] = address(this).balance.sub(amount.sendBSC);

            } else {
                amount.beforeToken[i] = SafeToken.myBalance(production.borrowToken[i]);
                require(borrow[i] <= amount.beforeToken[i] && amount.debts[i] <= banks[production.borrowToken[i]].totalVal,
                    "insufficient borrowToken in the bank");
                amount.beforeToken[i] = amount.beforeToken[i].sub(borrow[i]);
                SafeToken.safeApprove(production.borrowToken[i], address(production.goblin), borrow[i]);
            }
        }

        production.goblin.work{value: amount.sendBSC}(
            posId,
            msg.sender,
            production.borrowToken,
            borrow,
            amount.debts,
            data
        );

        amount.borrowed = false;

        // Calculate the back token amount
        for (i = 0; i < 2; ++i) {
            amount.backToken[i] = amount.isBorrowBSC[i] ? (address(this).balance.sub(amount.beforeToken[i])) :
                SafeToken.myBalance(production.borrowToken[i]).sub(amount.beforeToken[i]);

            if(amount.backToken[i] > amount.debts[i]) {
                // backToken are much more than debts, so send back backToken-debts.
                amount.backToken[i] = amount.backToken[i].sub(amount.debts[i]);
                amount.debts[i] = 0;

                amount.isBorrowBSC[i] ? SafeToken.safeTransferETH(msg.sender, amount.backToken[i]):
                    SafeToken.safeTransfer(production.borrowToken[i], msg.sender, amount.backToken[i]);

            } else if (amount.debts[i] > amount.backToken[i]) {
                // There are some borrow token
                amount.borrowed = true;
                amount.debts[i] = amount.debts[i].sub(amount.backToken[i]);
                amount.backToken[i] = 0;

                require(amount.debts[i] >= production.minDebt[i], "too small debts size");
            }
        }

        if (amount.borrowed) {
            // Return the amount of each borrow token can be withdrawn with the given borrow amount rate.
            uint256[2] memory health = production.goblin.health(posId, production.borrowToken, amount.debts);

            require(health[0].mul(production.openFactor) >= amount.debts[0].mul(10000), "bad work factor");
            require(health[1].mul(production.openFactor) >= amount.debts[1].mul(10000), "bad work factor");

            _addDebt(positions[posId], production, amount.debts);
        }
        // Then user may withdraw some or repay. get rewards of all pos.
        else {
            // Get all rewards.
            getRewardsAllProd();
            // If the lp amount in current pos is 0, delete the pos.
            if (production.goblin.posLPAmount(posId) == 0) {
                EnumerableSet.remove(user.posId, posId);
                user.posNum[pid] = user.posNum[pid].add(1);
            }
        }

        emit OpPosition(posId, amount.debts, amount.backToken);
    }

    function liquidate(uint256 posId) external payable onlyEOA nonReentrant {
        Position storage pos = positions[posId];

        require(pos.debtShare[0] > 0 || pos.debtShare[1] > 0, "no debts");
        Production storage production = productions[pos.productionId];
        liqTemp memory temp;

        temp.debts = _removeDebt(pos, production);

        temp.health = production.goblin.newHealth(posId, production.borrowToken, temp.debts);
        require(temp.health < production.liquidateFactor, "can't liquidate");

        temp.isBSC;
        temp.before;

        // Save before amount
        uint256 i;
        for (i = 0; i < 2; ++i) {
            temp.isBSC[i] = production.borrowToken[i] == address(0);
            temp.before[i] = temp.isBSC[i] ? address(this).balance : SafeToken.myBalance(production.borrowToken[0]);
        }

        production.goblin.liquidate(posId, pos.owner, production.borrowToken, temp.debts);

        // Delete the pos from owner, posNum -= 1.
        UserPPInfo storage owner = userPPInfo[pos.owner];
        EnumerableSet.remove(owner.posId, posId);
        owner.posNum[pos.productionId] = owner.posNum[pos.productionId].sub(1);

        // Check back amount. Send reward to sender, and send rest token back to pos.owner.
        temp.back;   // To save memory.
        temp.rest;   // To save memory.

        temp.prize;
        temp.left;

        for (i = 0; i < 2; ++i) {
            temp.back = temp.isBSC[i] ? address(this).balance: SafeToken.myBalance(production.borrowToken[i]);
            temp.back = temp.back.sub(temp.before[i]);

            temp.prize[i] = temp.back.mul(config.getLiquidateBps()).div(10000);
            temp.rest = temp.back.sub(temp.prize[i]);
            temp.left[i] = 0;

            // Send reward to sender
            if (temp.prize[i] > 0) {
                temp.isBSC[i] ?
                    SafeToken.safeTransferETH(msg.sender, temp.prize[i]) :
                    SafeToken.safeTransfer(production.borrowToken[i], msg.sender, temp.prize[i]);
            }

            // Send rest token to pos.owner.
            if (temp.rest > temp.debts[i]) {
                temp.left[i] = temp.rest.sub(temp.debts[i]);
                temp.isBSC[i] ?
                    SafeToken.safeTransferETH(pos.owner, temp.left[i]) :
                    SafeToken.safeTransfer(production.borrowToken[i], pos.owner, temp.left[i]);
            } else {
                banks[production.borrowToken[i]].totalVal =
                    banks[production.borrowToken[i]].totalVal.sub(temp.debts[i]).add(temp.rest);
            }
        }

        emit Liquidate(posId, msg.sender, temp.prize, temp.left);
    }

    /* ----------------- Get rewards ----------------- */

    // Send earned DEMA from per token bank to user.
    function getBankRewardsPerToken(address token) public {
        TokenBank storage bank = banks[token];
        Farm.getStakeRewardsPerPool(bank.poolId, msg.sender);

        // Delete pool if no left shares
        UserBankInfo storage user = userBankInfo[msg.sender];
        if (user.sharesPerToken[token] == 0) {
            EnumerableSet.remove(user.banksAddress, token);
        }
    }

    // Send earned DEMA from all tokens to user.
    function getBankRewards() public {
        for (uint256 index = userBanksNum(msg.sender); index > 0; --index) {
            getBankRewardsPerToken(userBankAddress(msg.sender, index - 1));
        }
    }

    // Get MDX and DEMA rewards of per production
    function getRewardsPerProd(uint256 prodId) public {
        productions[prodId].goblin.getAllRewards(msg.sender);

        // Delete pool if no left pos.
        UserPPInfo storage user = userPPInfo[msg.sender];
        if (user.posNum[prodId] == 0) {
            EnumerableSet.remove(user.prodId, prodId);
        }

    }

    // Get MDX and DEMA rewards of all productions
    function getRewardsAllProd() public {
        for (uint256 i = userProdNum(msg.sender); i > 0; --i) {
            getRewardsPerProd(userProdId(msg.sender, i-1));
        }
    }

    /* ==================================== Internal ==================================== */

    function _addDebt(Position storage pos, Production storage production, uint256[2] memory debtVal) internal {
        for (uint256 i = 0; i < 2; ++i) {
            if (debtVal[i] == 0) {
                continue;
            }

            TokenBank storage bank = banks[production.borrowToken[i]];

            uint256 debtShare = debtValToShare(production.borrowToken[i], debtVal[i]);
            pos.debtShare[i] = pos.debtShare[i].add(debtShare);

            bank.totalVal = bank.totalVal.sub(debtVal[i]);
            bank.totalDebtShares = bank.totalDebtShares.add(debtShare);
            bank.totalDebt = bank.totalDebt.add(debtVal[i]);
        }
    }

    function _removeDebt(Position storage pos, Production storage production) internal returns (uint256[2] memory) {
        uint256[2] memory debtVal;

        for (uint256 i = 0; i < 2; ++i) {
            // For each borrow token
            TokenBank storage bank = banks[production.borrowToken[i]];

            uint256 debtShare = pos.debtShare[i];
            if (debtShare > 0) {
                debtVal[i] = debtShareToVal(production.borrowToken[i], debtShare);
                pos.debtShare[i] = 0;

                bank.totalVal = bank.totalVal.add(debtVal[i]);
                bank.totalDebtShares = bank.totalDebtShares.sub(debtShare);
                bank.totalDebt = bank.totalDebt.sub(debtVal[i]);
            } else {
                debtVal[i] = 0;
            }
        }

        return debtVal;
    }

    function _calInterest(address token) internal {
        TokenBank storage bank = banks[token];
        require(bank.isOpen, 'token not exists');

        if (now > bank.lastInterestTime) {
            uint256 timePast = now.sub(bank.lastInterestTime);
            uint256 totalDebt = bank.totalDebt;
            uint256 totalBalance = totalToken(token);

            uint256 ratePerSec = config.getInterestRate(totalDebt, totalBalance, token);
            uint256 interest = ratePerSec.mul(timePast).mul(totalDebt).div(1e18);

            uint256 toReserve = interest.mul(config.getReserveBps()).div(10000);
            bank.totalReserve = bank.totalReserve.add(toReserve);
            bank.totalDebt = bank.totalDebt.add(interest);
            bank.lastInterestTime = now;
        }
    }

    /* ==================================== Only owner ==================================== */

    function updateConfig(IBankConfig _config) external onlyOwner {
        config = _config;
    }

    function addToken(address token, uint256 poolId) external onlyOwner {
        TokenBank storage bank = banks[token];
        require(!bank.isOpen, 'token already exists');

        bank.isOpen = true;
        bank.tokenAddr = token;
        bank.canDeposit = true;
        bank.poolId = poolId;

        bank.totalVal = 0;
        bank.totalShares = 0;
        bank.totalDebt = 0;
        bank.totalDebtShares = 0;
        bank.totalReserve = 0;
        bank.lastInterestTime = now;
    }

    function updateToken(address token, bool canDeposit) external onlyOwner {
        TokenBank storage bank = banks[token];
        require(bank.isOpen, 'token not exists');

        bank.canDeposit = canDeposit;
    }

    function opProduction(
        uint256 pid,
        bool isOpen,
        bool[2] calldata canBorrow,
        address[2] calldata borrowToken,
        address goblin,
        uint256[2] calldata minDebt,
        uint256 openFactor,
        uint256 liquidateFactor
    )
        external
        onlyOwner
    {
        require(borrowToken[0] != borrowToken[1], "Borrow tokens cannot be same");
        require(canBorrow[0] || minDebt[0]==0, "Token 0 can borrow or min debt should be 0");
        require(canBorrow[1] || minDebt[1]==0, "Token 1 can borrow or min debt should be 0");

        if(pid == 0){
            pid = currentPid;
            currentPid ++;
        } else {
            require(pid < currentPid, "bad production id");
        }

        Production storage production = productions[pid];
        production.isOpen = isOpen;
        production.canBorrow = canBorrow;

        // Don't change it once set it. We can add new production.
        production.borrowToken = borrowToken;
        production.goblin = IGoblin(goblin);

        production.minDebt = minDebt;
        production.openFactor = openFactor;
        production.liquidateFactor = liquidateFactor;
    }

    function withdrawReserve(address token, address to, uint256 value)
        external
        onlyOwner
        nonReentrant
    {
        TokenBank storage bank = banks[token];

        uint256 balance = token == address(0)? address(this).balance: SafeToken.myBalance(token);
        if((bank.isOpen == false) || balance >= bank.totalVal.add(value)) {
            // Received not by deposit
        } else {
            bank.totalReserve = bank.totalReserve.sub(value);
            bank.totalVal = bank.totalVal.sub(value);
        }

        if (token == address(0)) {
            SafeToken.safeTransferETH(to, value);
        } else {
            SafeToken.safeTransfer(token, to, value);
        }
    }
}
