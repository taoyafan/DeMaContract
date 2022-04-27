// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./../interface/IReinvestment.sol";
import "./../utils/SafeToken.sol";


abstract contract AReinvestment is Ownable, IReinvestment, ReentrancyGuard {
    /// @notice Libraries
    using SafeToken for address;
    using SafeMath for uint256;

    /// @notice Events
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Reinvest();
    event StopReinvest();
    event RecoverReinvest();

    /// @notice Mutable state variables
    address public dexToken;

    mapping(address => uint256) public userShares;
    uint256 public totalShares;
    uint256 public override reservedRatio;       // Reserved share ratio. will divide by 10000, 0 means not reserved.
    bool public canReinvest = true;

    constructor(
        address _dexContract,
        address _dexToken,
        uint256 _reserveRatio           // will divide by 10000, 0 means not reserved.
    ) public {
        dexToken = _dexToken;
        reservedRatio = _reserveRatio;
        dexToken.safeApprove(_dexContract, uint256(-1));
    }

    /* ==================================== Read ==================================== */

    function totalAmount() public view returns (uint256) {
        return dexToken.myBalance().add(_dexDepositAmount()).add(_dexPendingRewards());
    }

    /// @notice Goblin is the user.
    function userAmount(address account) public view override returns (uint256) {
        return shareToAmount(userShares[account]);
    }

    function amountToShare(uint256 _amount, uint256 _totalAmount) public view returns (uint256) {
        return (_totalAmount == 0 || totalShares == 0) ?
            _amount : _amount.mul(totalShares).div(_totalAmount);
    }

    function shareToAmount(uint256 _shares) public view returns (uint256) {
        return totalShares == 0 ? 0 : _shares.mul(totalAmount()).div(totalShares);
    }

    /* ==================================== Write ==================================== */

    // Deposit method when migrating. There MUST be no reserved amount
    function migrateDeposit(uint256 amount) external override nonReentrant {
        if (amount > 0) {
            require(userShares[msg.sender] == 0, 'User share must be 0');
            
            dexToken.safeTransferFrom(msg.sender, address(this), amount);
            uint256 shares = amountToShare(amount, totalAmount().sub(amount));
            
            totalShares = totalShares.add(shares);
            userShares[msg.sender] = userShares[msg.sender].add(shares);

            emit Deposit(msg.sender, amount);
        }
    }

    // Deposit dexToken.
    function deposit(uint256 amount) external override nonReentrant {
        if (amount > 0) {
            dexToken.safeTransferFrom(msg.sender, address(this), amount);
            uint256 shares = amountToShare(amount, totalAmount().sub(amount));
            totalShares = totalShares.add(shares);

            // If there are some reserved shares
            if (reservedRatio != 0) {
                // Reserve some shares to owner
                uint256 ownerShares = shares.mul(reservedRatio).div(10000);
                userShares[owner()] = userShares[owner()].add(ownerShares);

                // Calculate the left shares
                shares = shares.sub(ownerShares);
            }

            userShares[msg.sender] = userShares[msg.sender].add(shares);

            emit Deposit(msg.sender, amount);
        }
    }

    // Withdraw dexToken to sender.
    /// @notice Input param is amount rather than shares. Amount can be get from userAmount()
    function withdraw(uint256 amount) external override nonReentrant {
        if (amount > 0) {
            uint256 shares = amountToShare(amount, totalAmount());

            // Check the max shares and amount can be withdraw
            if (shares > userShares[msg.sender]) {
                shares = userShares[msg.sender];
                amount = shareToAmount(shares);
            }

            if (dexToken.myBalance() < amount) {
                // If balance is not enough, withdraw from board room first.
                _tryToWithdraw(amount - dexToken.myBalance());
                // Check again, If there don't has enough, withdraw all left.
                if (dexToken.myBalance() < amount) {
                    amount = dexToken.myBalance();
                }
            }

            dexToken.safeTransfer(msg.sender, amount);

            // Update left shares.
            totalShares = totalShares.sub(shares);
            userShares[msg.sender] = userShares[msg.sender].sub(shares);

            emit Withdraw(msg.sender, amount);
        }
    }

    function reinvest() external nonReentrant {
        require(canReinvest, "Stop reinvested");
        _tryToWithdraw(0);
        _dexDeposit(dexToken.myBalance());

        emit Reinvest();
    }

    /* ==================================== Internal ==================================== */

    // ------------------ The following are virtual function ------------------

    function _dexDepositAmount() internal view virtual returns (uint256);

    function _dexPendingRewards() internal view virtual returns (uint256);

    function _dexDeposit(uint256 amount) internal virtual;

    function _dexWithdraw(uint256 amount) internal virtual;

    function _recoverCheck(address token) internal virtual;

    // ------------------------------------------------------------------------

    /// @dev try to withdraw dexToken with amount from board room.
    /// @notice if withdraw all, amount can be type(uint256).max
    /// @return Whether withdrawn
    function _tryToWithdraw(uint256 amount) internal returns (bool) {
        uint256 deposited = _dexDepositAmount();
        if (deposited > 0) {
            // Can withdraw
            if (amount > deposited) {
                amount = deposited;
            }
            _dexWithdraw(amount);
            return true;
        } else {
            return false;
        }
    }

    /* ==================================== Only Owner ==================================== */

    // Recover ERC20 tokens (Rather than dexToken) that were accidentally sent to this smart contract.
    function recover(address token, address to, uint256 value) external onlyOwner nonReentrant {
        _recoverCheck(token);
        
        if (token == address(0)) {
            SafeToken.safeTransferETH(to, value);
        } else {
            SafeToken.safeTransfer(token, to, value);
        }
    }

    // Used when DEX is closed.
    function stopReinvest() external onlyOwner nonReentrant {
        _tryToWithdraw(type(uint256).max);
        canReinvest = false;
        emit StopReinvest();
    }

    function recoverReinvest() external onlyOwner nonReentrant {
        _dexDeposit(dexToken.myBalance());
        canReinvest = true;
        emit RecoverReinvest();
    }

    function setReservedRatio(uint256 ratio) external onlyOwner {
        require(ratio <= 10000, "Reserved ratio cannot lager than 10000");
        reservedRatio = ratio;
    }
}