// Bank: 0xD42Ef222d33E3cB771DdA783f48885e15c9D5CeD
// File: openzeppelin-solidity-2.3.0/contracts/utils/ReentrancyGuard.sol

pragma solidity ^0.6.0;

// import "@openzeppelin/contracts/access/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
// import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./Interface/IBankConfig.sol";
import "./Interface/IStakingRewards.sol";
import "./Interface/IGoblin.sol";


interface ERC20Interface {
    function balanceOf(address user) external view returns (uint256);
}

library SafeToken {
    function myBalance(address token) internal view returns (uint256) {
        return ERC20Interface(token).balanceOf(address(this));
    }

    function balanceOf(address token, address user) internal view returns (uint256) {
        return ERC20Interface(token).balanceOf(user);
    }

    function safeApprove(address token, address to, uint256 value) internal {
        // bytes4(keccak256(bytes('approve(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "!safeApprove");
    }

    function safeTransfer(address token, address to, uint256 value) internal {
        // bytes4(keccak256(bytes('transfer(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "!safeTransfer");
    }

    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
        // bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "!safeTransferFrom");
    }

    function safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call.value(value)(new bytes(0));
        require(success, "!safeTransferETH");
    }
}

contract Bank is Ownable, ReentrancyGuard {
    using SafeToken for address;
    using SafeMath for uint256;

    event OpPosition(uint256 indexed id, uint256 debt, uint back);
    event Liquidate(uint256 indexed id, address indexed killer, uint256 prize, uint256 left);

    struct TokenBank {
        address tokenAddr;
        bool isOpen;
        bool canDeposit;
        bool canWithdraw;
        uint256 poolId;

        uint256 totalVal;           // Left balance
        uint256 totalShares;        // Stake shares
        uint256 totalDebt;          // Debt balance
        uint256 totalDebtShares;    // Debt shares
        uint256 totalReserve;
        uint256 lastInterestTime;
    }

    struct Production {
        address[2] borrowToken;
        bool isOpen;
        bool[2] canBorrow;
        
        IGoblin goblin;
        uint256[2] minDebt;
        uint256 openFactor;         // When open: leftAmount * openFactor/10000 should > debt
        uint256 liquidateFactor;    // When liquidate: leftAmount * liquidateFactor/10000 should < debt
    }

    struct Position {
        address owner;
        uint256 productionId;
        uint256[2] debtShare;
    }

    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;

    struct UserInfo {
        mapping(address => uint256) sharesPerToken;     // per token pool
        EnumerableSet.UintSet posId;                    // position id 
        address inviter;                 
        EnumerableSet.AddressSet invitees;
    }

    bool canInvite = true;

    IBankConfig public config;

    mapping(address => UserInfo) internal userInfo;

    mapping(address => TokenBank) public banks;

    mapping(uint256 => Production) public productions;
    uint256 public currentPid = 1;

    mapping(uint256 => Position) public positions;
    uint256 public currentPos = 1;

    IStakingRewards stakingRewards;

    modifier onlyEOA() {
        require(msg.sender == tx.origin, "not eoa");
        _;
    }

    constructor(address _stakingRewards) public {
        stakingRewards = IStakingRewards(_stakingRewards);
    }

    /* ==================================== Read ==================================== */

    function positionInfo(uint256 posId) public view returns (uint256, uint256, uint256, address) {
        Position storage pos = positions[posId];
        Production storage prod = productions[pos.productionId];

        return (pos.productionId, prod.goblin.health(posId, prod.borrowToken),
            debtShareToVal(prod.borrowToken, pos.debtShare), pos.owner);
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

    function getUserInviteeNum(address account) external view returns (uint256) {
        return EnumerableSet.length(userInfo[account].invitees);
    }

    function getUserInvitee(address account, uint256 index) external view returns (address) {
        return EnumerableSet.at(userInfo[account].invitees, index);
    }

    function getUserPosNum(address account) external view returns (uint256) {
        return EnumerableSet.length(userInfo[account].posId);
    }

    function getUserPosId(address account, uint256 index) external view returns (uint256) {
        return EnumerableSet.at(userInfo[account].posId, index);
    }

    function getUserSharesPreTokoen(address account, address token) external view returns (uint256) {
        return userInfo[account].sharesPerToken[token];
    }

    function getUserInviter(address account) external view returns (address) {
        return userInfo[account].inviter;
    }

    /* ==================================== Write ==================================== */

    function setInviter(address inviterAccount) external {
        // require(inviterAccount != msg.sender, "Inviter can not be itself");
        require(inviterAccount != address(0), "Inviter cannot be 0");
        require(userInfo[msg.sender].inviter == address(0), "Inviter already exists");
        
        userInfo[msg.sender].inviter = inviterAccount;                                  // Add inviter
        EnumerableSet.AddressSet.add(userInfo[inviterAccount].invitees, msg.sender);    // Add invitees for inviter
    }

    function deposit(address token, uint256 amount) public nonReentrant {
        TokenBank storage bank = banks[token];
        UserInfo storage user = userInfo[msg.sender];
        require(bank.isOpen && bank.canDeposit, 'Token not exist or cannot deposit');

        _calInterest(token);

        if (token != address(0)) { 
            // Token is not eth
            SafeToken.safeTransferFrom(token, msg.sender, address(this), amount);
        }

        bank.totalVal = bank.totalVal.add(amount);
        uint256 total = totalToken(token).sub(amount);

        uint256 newShares = (total == 0 || bank.totalShares == 0) ? amount: amount.mul(bank.totalShares).div(total);

        bank.totalShares = bank.totalShares.add(newShares);
        user.sharesPerToken[token] = user.sharesPerToken[token].add(newShares);

        if(canInvite) {
            stakingRewards.stake(bank.poolId, msg.sender, newShares, user.inviter);
        } else {
            stakingRewards.stake(bank.poolId, msg.sender, newShares, address(0));   // 0 means no inviter
        }
    }

    function withdraw(address token, uint256 withdrawShares) external nonReentrant {
        TokenBank storage bank = banks[token];
        UserInfo storage user = userInfo[msg.sender];
        require(bank.isOpen && bank.canWithdraw, 'Token not exist or cannot withdraw');

        _calInterest(token);

        uint256 amount = withdrawShares.mul(totalToken(token)).div(bank.totalShares);
        bank.totalVal = bank.totalVal.sub(amount);

        bank.totalShares = bank.totalShares.sub(withdrawShares);
        user.sharesPerToken[token] = user.sharesPerToken[token].sub(withdrawShares);

        stakingRewards.withdraw(bank.poolId, msg.sender, withdrawShares, user.inviter);

        if (token == address(0)) {//BSC
            SafeToken.safeTransferETH(msg.sender, amount);
        } else {
            SafeToken.safeTransfer(token, msg.sender, amount);
        }
    }

    ///@dev Create position: 
    // opPosition(0, productionId, [borrow0, borrow1], 
    //     [addLpStrategyAddress, _token0, _token1, token0Amount, token1Amount, _minLPAmount] )
    // @note: if token is BSC, token address should be address(0);

    ///@dev Replenishment:
    // opPosition(posId, productionId, [0, 0], 
    //     [addLpStrategyAddress, _token0, _token1, token0Amount, token1Amount, _minLPAmount] )

    ///@dev Withdraw:
    // opPosition(posId, productionId, [0, 0], [withdrawStrategyAddress, token0, token1, rate, whichWantBack] )
    // @note: rate means how many LP will be removed liquidity. max rate is 10000 means 100%.
    //        The amount of repaid debt is the same rate of total debt.
    //        whichWantBack = 0(token0), 1(token1), 2(token what surplus).

    ///@dev Repay:
    // opPosition(posId, productionId, [0, 0], [withdrawStrategyAddress, token0, token1, rate, 3] )
    // @note: rate means how many LP will be removed liquidity. max rate is 10000 means 100%.
    //        All withdrawn LP will used to repay debt.
    function opPosition(uint256 posId, uint256 pid, uint256[2] calldata borrow, bytes calldata data)
        external 
        payable 
        onlyEOA 
        nonReentrant 
    {
        if (posId == 0) {
            // Create a new position
            posId = currentPos;
            currentPos ++;
            positions[posId].owner = msg.sender;
            positions[posId].productionId = pid;

            EnumerableSet.UintSet.add(userInfo[msg.sender], posId);
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

        uint256 sendBSC = msg.value;
        uint256[2] memory beforeToken;      // How many token in the pool after borrow before goblin work
        uint256[2] memory debt = _removeDebt(positions[posId], production);
        bool[2] memory isBorrowBSC;

        for (uint256 i = 0; i < 2; ++i) {
            debt[i] = debt[i].add(borrow[i]);  
            isBorrowBSC[i] = production.borrowToken[i] == address(0);

            // Save the amount of borrow token after borrowing before goblin work.
            if (isBorrowBSC) {
                sendBSC = sendBSC.add(borrow[i]);
                require(sendBSC <= address(this).balance && debt <= banks[production.borrowToken[i]].totalVal,
                    "insufficient BSC in the bank");
                beforeToken[i] = address(this).balance.sub(sendBSC);

            } else {
                beforeToken[i] = SafeToken.myBalance(production.borrowToken[i]);
                require(borrow[i] <= beforeToken[i] && debt <= banks[production.borrowToken].totalVal,
                    "insufficient borrowToken in the bank");
                beforeToken[i] = beforeToken[i].sub(borrow[i]);
                SafeToken.safeApprove(production.borrowToken[i], production.goblin, borrow[i]);
            }
        }

        production.goblin.work.value(sendBSC)(posId, msg.sender, production.borrowToken, borrow, debt, data);
        
        uint256[2] memory backToken;
        bool borrowed = false;

        // Calculate the back token amount
        for (uint256 i = 0; i < 2; ++i) {
            backToken[i] = isBorrowBSC? (address(this).balance.sub(beforeToken[i])) :
                SafeToken.myBalance(production.borrowToken[i]).sub(beforeToken[i]);

            if(backToken[i] > debt[i]) { 
                // backToken are much more than debt, so send back backToken-debt.
                backToken[i] = backToken[i].sub(debt[i]);
                debt[i] = 0;

                isBorrowBSC? SafeToken.safeTransferETH(msg.sender, backToken[i]):
                    SafeToken.safeTransfer(production.borrowToken[i], msg.sender, backToken[i]);

            } else if (debt[i] > backToken[i]) {
                // There are some borrow token
                borrowed = true;
                debt[i] = debt[i].sub(backToken[i]);
                backToken[i] = 0;

                require(debt[i] >= production.minDebt, "too small debt size");
            }
        }

        if (borrowed) {
            // Return the amount of each borrow token can be withdrawn with the given borrow amount rate.
            uint256[2] memory health = production.goblin.health(posId, production.borrowToken);
            
            require(health[0].mul(production.openFactor) >= debt[0].mul(10000), "bad work factor");
            require(health[1].mul(production.openFactor) >= debt[1].mul(10000), "bad work factor");
            
            _addDebt(positions[posId], production, debt);
        }

        emit OpPosition(posId, debt[0], debt[1], backToken[0], backToken[1]);
    }

    function liquidate(uint256 posId) external payable onlyEOA nonReentrant {
        Position storage pos = positions[posId];
        require(pos.debtShare > 0, "no debt");
        Production storage production = productions[pos.productionId];

        uint256 debt = _removeDebt(pos, production);

        uint256 health = production.goblin.health(posId, production.borrowToken);
        require(health.mul(production.liquidateFactor) < debt.mul(10000), "can't liquidate");

        bool isBSC = production.borrowToken == address(0);
        uint256 before = isBSC? address(this).balance: SafeToken.myBalance(production.borrowToken);

        production.goblin.liquidate(posId, pos.owner, production.borrowToken);

        uint256 back = isBSC? address(this).balance: SafeToken.myBalance(production.borrowToken);
        back = back.sub(before);

        uint256 prize = back.mul(config.getLiquidateBps()).div(10000);
        uint256 rest = back.sub(prize);
        uint256 left = 0;

        if (prize > 0) {
            isBSC? SafeToken.safeTransferETH(msg.sender, prize): SafeToken.safeTransfer(production.borrowToken, msg.sender, prize);
        }
        if (rest > debt) {
            left = rest.sub(debt);
            isBSC? SafeToken.safeTransferETH(pos.owner, left): SafeToken.safeTransfer(production.borrowToken, pos.owner, left);
        } else {
            banks[production.borrowToken].totalVal = banks[production.borrowToken].totalVal.sub(debt).add(rest);
        }
        emit Liquidate(posId, msg.sender, prize, left);
    }

    /* ==================================== Internal ==================================== */

    function _addDebt(Position storage pos, Production storage production, uint256[2] memory debtVal) internal {
        for (uint256 i = 0; i < 2; ++i) {
            if (debtVal[i] == 0) {
                continue;
            }

            TokenBank storage bank = banks[production.borrowToken[i]];

            uint256 debtShare = debtValToShare(production.borrowToken[i], debtVal[i]);
            pos.debtShare = pos.debtShare.add(debtShare);

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

                bank.totalVal = bank.totalVal.add(debtVal);
                bank.totalDebtShares = bank.totalDebtShares.sub(debtShare);
                bank.totalDebt = bank.totalDebt.sub(debtVal);
            } else {
                debtVal[i] = 0;
            }
        }

        return debtVal;
    }

    function _calInterest(address token) public {
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

    function setInviteEnable(bool _canInvite) external onlyOwner {
        canInvite = _canInvite;
    }

    function updateConfig(IBankConfig _config) external onlyOwner {
        config = _config;
    }

    function addToken(address token, address poolId) external onlyOwner {
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
        production.goblin = goblin;

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

    fallback() external payable {
        deposit(address(0), msg.value);
    }

    receive() external payable {
        deposit(address(0), msg.value);
    }
}
