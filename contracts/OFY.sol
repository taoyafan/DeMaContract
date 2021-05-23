pragma solidity ^0.6.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./Interface/IOFY.sol";

contract OFY is IOFY {
    using Address for address;
    using SafeMath for uint256;

    /// @notice Immutable variables -----------

    string private constant _name = "DeMac Coin";
    string private constant _symbol = "DEMA";
    uint8 private constant _decimals = 18;
    uint256 private constant _cap = 100000000 * 1e18;  // 1e8 * 1e18
    
    // Dead address used to burn
    address public constant dead = address(0x000000000000000000000000000000000000dEaD);     
    
    /// @notice Mutable variables -----------
    
    uint256 private _totalShares;       // Shares
    uint256 private _totalSupply;       // Amount

    address public governance;
    mapping (address => bool) public minters;

    mapping (address => uint256) private _shares;
    mapping (address => mapping (address => uint256)) private _allowances;      // Shares

    uint256 public burnRatio = 100;     // Will divided 10000, Burn 1%
    uint256 public bonusRatio = 100;    // Will divided 10000, Share 1% to others

    /* ==================================== Constructor ==================================== */

    constructor () public {
        governance = tx.origin;
    }

    /* ==================================== Modifier ==================================== */

    modifier onlyGovernance() {
        require(msg.sender == governance, "!governance");
        _;
    }

    /* ==================================== Only Minters ==================================== */

    function mint(address account, uint256 amount) external override {
        require(minters[msg.sender], "!minter");
        _mint(account, amount);
    }

    /* ==================================== Only Governance ==================================== */

    function setGovernance(address _governance) external onlyGovernance {
        governance = _governance;
    }

    function addMinter(address _minter) external onlyGovernance {
        minters[_minter] = true;
    }

    function removeMinter(address _minter) external onlyGovernance {
        minters[_minter] = false;
    }

    function setBurnRatio(uint256 _ratio) external onlyGovernance {
        require(_ratio < 10000, "Burn ratio should less than 10000");
        burnRatio = _ratio;
    }

    function setBonusRatio(uint256 _ratio) external onlyGovernance {
        require(_ratio < 10000, "Bonus ratio should less than 10000");
        bonusRatio = _ratio;
    }

    // Burn tokens in dead address
    function burnDead(uint256 amount) external onlyGovernance {
        _burn(dead, amount);
    }

    /* ==================================== Read ==================================== */

    /**
     * @dev Returns the cap on the token's total supply.
     */
    function cap() public pure returns (uint256) {
        return _cap;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public pure returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public pure returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5,05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the value {ERC20} uses, unless {_setupDecimals} is
     * called.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public pure returns (uint8) {
        return _decimals;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account) public view override returns (uint256) {
        return _shareToAmount(_shares[account]);
    }

    /* ==================================== Write ==================================== */

    function burn(address account, uint256 amount) external override {
        require(msg.sender == account, "!burn");
        _burn(account, amount);
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address recipient, uint256 amount) public override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender) public view override returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20}.
     *
     * Requirements:
     *
     * - `sender` and `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     * - the caller must have allowance for ``sender``'s tokens of at least
     * `amount`.
     */
    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, _allowances[sender][msg.sender].sub(amount, "ERC20: transfer amount exceeds allowance"));
        return true;
    }

    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].add(addedValue));
        return true;
    }

    /**
     * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));
        return true;
    }

    /* ==================================== Internal ==================================== */

    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        uint256 shares = _amountToShare(amount);
        uint256 sharesBurn = shares.mul(burnRatio).div(10000);
        uint256 sharesBonuse = shares.mul(bonusRatio).div(10000);

        _shares[sender] = _shares[sender].sub(shares, "ERC20: transfer amount exceeds balance");
        _shares[dead] = _shares[dead].add(sharesBurn);

        uint256 leftShares = shares.sub(sharesBurn).sub(sharesBonuse);
        _shares[recipient] = _shares[recipient].add(leftShares);

        _totalShares = _totalShares.sub(sharesBonuse);      // Decrease total shares means increase amount/shares.

        emit Transfer(sender, recipient, amount);
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");
        require(totalSupply().add(amount) <= _cap, "ERC20Capped: cap exceeded");

        uint256 shares = _amountToShare(amount);

        _totalSupply = _totalSupply.add(amount);
        _shares[account] = _shares[account].add(shares);
        _totalShares = _totalShares.add(shares);

        emit Transfer(address(0), account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: burn from the zero address");
        uint256 shares = _amountToShare(amount);

        _shares[account] = _shares[account].sub(shares, "ERC20: burn amount exceeds balance");
        _totalShares = _totalSupply.sub(shares);
        _totalSupply = _totalSupply.sub(amount);

        emit Transfer(account, address(0), amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = _amountToShare(amount);
        emit Approval(owner, spender, amount);
    }

    function _amountToShare(uint256 amount) internal view returns (uint256) {
        if (_totalSupply == 0) {
            return amount;
        } else {
            return amount.mul(_totalShares).div(_totalSupply);
        }
    }

    function _shareToAmount(uint256 share) internal view returns (uint256 ){
        if (_totalShares == 0) {
            return share;
        } else {
            return share.mul(_totalSupply).div(_totalShares);
        }
    }
}