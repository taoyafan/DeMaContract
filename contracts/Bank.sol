// Bank: 0xD42Ef222d33E3cB771DdA783f48885e15c9D5CeD

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

    struct TokenBank {
        address tokenAddr;
        bool isOpen;
        bool canDeposit;
        bool canWithdraw;
        uint256 poolId;

        uint256 totalVal;           // Left balance
        uint256 totalShares;        // Stake shares
        uint256 totalDebt;          // Debts balance
        uint256 totalDebtShares;    // Debts shares
        uint256 totalReserve;       // TODO Need to check this part of codes.
        uint256 lastInterestTime;
    }

    struct Production {
        address[2] borrowToken;
        bool isOpen;
        bool[2] canBorrow;

        IGoblin goblin;
        uint256[2] minDebt;
        uint256 openFactor;         // When open: (debts / total) should < (openFactor / 10000)
        uint256 liquidateFactor;    // When liquidate: (debts / total) should > (liquidateFactor / 10000)
    }

    struct Position {
        address owner;
        uint256 productionId;
        uint256[2] debtShare;
    }

    // Used in opProduction
    struct WorkAmount {
        uint256 sendBSC;
        uint256[2] beforeToken;      // How many token in the pool after borrow before goblin work
        uint256[2] debts;
        bool[2] isBorrowBSC;
        uint256[2] backToken;
        bool borrowed;
    }

    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;

    struct UserBankInfo {
        mapping(address => uint256) sharesPerToken;     // Shares per token pool
        EnumerableSet.AddressSet banksAddress;          // Stored banks' address.
    }

    struct UserPPInfo {
        EnumerableSet.UintSet posId;                    // position id
        EnumerableSet.UintSet prodId;                   // production id
        mapping(uint256 => uint256) posNum;             // position num of each production(id)
    }

    IBankConfig public config;

    /* ----------------- Banks Info ----------------- */

    mapping(address => TokenBank) public banks;                     // Token address => TokenBank
    mapping(address => EnumerableSet.AddressSet) userBankInfo;      // User account address => Bank address.

    /* -------- Productions / Positions Info -------- */

    mapping(address => UserPPInfo) userPPInfo;      // User Productions, Positions Info.

    mapping(uint256 => Production) public productions;
    uint256 public currentPid = 1;

    mapping(uint256 => Position) public positions;
    uint256 public currentPos = 1;

    IFarm Farm;

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

    /* ---- User Positions Info ---- */

    function userPosNum(address account) public view returns (uint256) {
        return EnumerableSet.length(userInfo[account].posId);
    }

    function userPosId(address account, uint256 index) public view returns (uint256) {
        return EnumerableSet.at(userInfo[account].posId, index);
    }

    /* ---- User Productions Info ---- */

    function userProdNum(address account) public view returns (uint256) {
        return EnumerableSet.length(userInfo[account].prodId);
    }

    function userProdId(address account, uint256 index) public view returns (uint256) {
        return EnumerableSet.at(userInfo[account].prodId, index);
    }

    function userSharesPreTokoen(address account, address token) external view returns (uint256) {
        return userBankInfo[account].sharesPerToken[token];
    }

    /* ==================================== Write ==================================== */

    function deposit(address token, uint256 amount) public nonReentrant {
        TokenBank storage bank = banks[token];
        UserPPInfo storage user = userBankInfo[msg.sender];
        require(bank.isOpen && bank.canDeposit, 'Token not exist or cannot deposit');

        _calInterest(token);

        if (token != address(0)) {
            // Token is not eth
            SafeToken.safeTransferFrom(token, msg.sender, address(this), amount);
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
        UserPPInfo storage user = userBankInfo[msg.sender];
        require(bank.isOpen && bank.canWithdraw, 'Token not exist or cannot withdraw');

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
        UserPPInfo storage user = userInfo[msg.sender];
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

        uint256[2] memory debts = _removeDebt(pos, production);

        uint256[2] memory health = production.goblin.health(posId, production.borrowToken, debts);

        require((health[0].mul(production.liquidateFactor) <= debts[0].mul(10000)) &&
                (health[1].mul(production.liquidateFactor) <= debts[1].mul(10000)), "can't liquidate");

        bool[2] memory isBSC;
        uint256[2] memory before;

        // Save before amount
        uint256 i;
        for (i = 0; i < 2; ++i) {
            isBSC[i] = production.borrowToken[i] == address(0);
            before[i] = isBSC[i] ? address(this).balance : SafeToken.myBalance(production.borrowToken[0]);
        }

        production.goblin.liquidate(posId, pos.owner, production.borrowToken, debts);

        // TODO move it to a function to prevent stack too deep
        // Delete the pos from owner, posNum -= 1.
        UserPPInfo storage owner = userInfo[pos.owner];
        EnumerableSet.remove(owner.posId, posId);
        owner.posNum[pos.productionId] = owner.posNum[pos.productionId].sub(1);

        // Check back amount. Send reward to sender, and send rest token back to pos.owner.
        uint256 back;   // To save memory.
        uint256 rest;   // To save memory.

        uint256[2] memory prize;
        uint256[2] memory left;

        for (i = 0; i < 2; ++i) {
            back = isBSC[i] ? address(this).balance: SafeToken.myBalance(production.borrowToken[i]);
            back = back.sub(before[i]);

            prize[i] = back.mul(config.getLiquidateBps()).div(10000);
            rest = back.sub(prize[i]);
            left[i] = 0;

            // Send reward to sender
            if (prize[i] > 0) {
                isBSC[i] ?
                    SafeToken.safeTransferETH(msg.sender, prize[i]) :
                    SafeToken.safeTransfer(production.borrowToken[i], msg.sender, prize[i]);
            }

            // Send rest token to pos.owner.
            if (rest > debts[i]) {
                left[i] = rest.sub(debts[i]);
                isBSC[i] ?
                    SafeToken.safeTransferETH(pos.owner, left[i]) :
                    SafeToken.safeTransfer(production.borrowToken[i], pos.owner, left[i]);
            } else {
                banks[production.borrowToken[i]].totalVal = banks[production.borrowToken[i]].totalVal.sub(debts[i]).add(rest);
            }
        }

        emit Liquidate(posId, msg.sender, prize, left);
    }

    /* ----------------- Get rewards ----------------- */

    // Send earned DEMA per token to user.
    function getBankRewardsPerToken(address token) public {
        TokenBank storage bank = banks[token];
        Farm.getRewardsPerPool(bank.poolId, msg.sender);
        // TODO remove empty bank.
    }

    // Send earned DEMA from all tokens to user.
    // TODO Move dynamic staked bool info update from farm to bank.
    function getBankRewards() public {
        for (uint256 index = 0; index < userBanksNum(msg.sender); ++index) {
            getBankRewardsPerToken(userBankAddress(msg.sender, index), msg.sender);
        }
    }

    // Get MDX and DEMA rewards of per production
    // TODO separate MDX and DEMA in goblin
    function getRewardsPerProd(uint256 prodId) public {
        productions[prodId].goblin.getAllRewards(msg.sender);

        UserPPInfo storage user = userInfo[msg.sender];
        if (user.posNum[prodId] == 0) {
            EnumerableSet.remove(user.prodId, prodId);
        }

    }

    // Get MDX and DEMA rewards of all productions
    // TODO separate MDX and DEMA in goblin
    function getRewardsAllProd() public {
        for (uint256 i = 0; i < userProdNum(msg.sender); ++i) {
            getRewardsPerProd(userProdId(msg.sender, i));
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

            uint256 ratePerSec = config.getInterestRate(totalDebt, totalBalance);
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
        bank.canWithdraw = true;
        bank.poolId = poolId;

        bank.totalVal = 0;
        bank.totalShares = 0;
        bank.totalDebt = 0;
        bank.totalDebtShares = 0;
        bank.totalReserve = 0;
        bank.lastInterestTime = now;
    }

    function updateToken(address token, bool canDeposit, bool canWithdraw) external onlyOwner {
        TokenBank storage bank = banks[token];
        require(bank.isOpen, 'token not exists');

        bank.canDeposit = canDeposit;
        bank.canWithdraw = canWithdraw;
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
        require(bank.isOpen, 'token not exists');

        uint balance = token == address(0)? address(this).balance: SafeToken.myBalance(token);
        if(balance >= bank.totalVal.add(value)) {
            //非deposit存入
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

    fallback() external {
        require(false, "Error call");
    }

    receive() external payable {
        deposit(address(0), msg.value);
    }
}
