// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interface/MDX/IBSCPool.sol";
import "./utils/SafeToken.sol";

// Wrapperd BSC Pool
contract WBSCPool is Ownable, IBSCPool {
    using SafeToken for address;
    using SafeMath for uint256;

    struct GoblinInfo {
        address token;
        uint256 pid;
        uint256 amount;
        uint256 reserved;
    }

    mapping(address => GoblinInfo) public goblinInfo;
    IBSCPool public bscPool;
    address public mdx;

    constructor(IBSCPool _bscPool, address _mdx) public {
        bscPool = _bscPool;
        mdx = _mdx;
    }

    function pending(uint256 _pid, address /* _user */) external view override returns (uint256, uint256) {
        return bscPool.pending(_pid, address(this));
    }

    function deposit(uint256 pid, uint256 amount) external override {
        require(goblinInfo[msg.sender].pid == pid, "Goblin haven't set yet, or pid is different.");

        address token = goblinInfo[msg.sender].token;
        token.safeTransferFrom(msg.sender, address(this), amount);
        goblinInfo[msg.sender].amount = goblinInfo[msg.sender].amount.add(amount);
        bscPool.deposit(pid, token.myBalance());    // deposit all token in this contract.

        // Then bsc pool may send back some pending lp reward, which will be regarded as reserved.
        goblinInfo[msg.sender].reserved = goblinInfo[msg.sender].reserved.add(token.myBalance());
        mdx.safeTransfer(msg.sender, mdx.myBalance());
    }

    function withdraw(uint256 pid, uint256 amount) external override {
        require(goblinInfo[msg.sender].pid == pid, "Goblin haven't set yet, or pid is different.");
        require(goblinInfo[msg.sender].amount >= amount, "Goblin don't have enough amount");

        address token = goblinInfo[msg.sender].token;
        bscPool.withdraw(pid, amount); 
        token.safeTransfer(msg.sender, amount);
        mdx.safeTransfer(msg.sender, mdx.myBalance());
        goblinInfo[msg.sender].amount = goblinInfo[msg.sender].amount.sub(amount);

        // The left token are lp rewards, which will be regarded as reserved.
        goblinInfo[msg.sender].reserved = goblinInfo[msg.sender].reserved.add(token.myBalance());
    }

    function setGoblinInfo(address _goblin, uint256 _pid, address _token) external onlyOwner {
        require(goblinInfo[_goblin].token == address(0), "Goblin already set.");
        require(_token != address(0), "Token cannot be BNB, replace it with WBNB address");
        // 100% trust in the bsc pool
        _token.safeApprove(address(bscPool), uint256(-1));

        goblinInfo[_goblin].token = _token;
        goblinInfo[_goblin].pid = _pid;
        goblinInfo[_goblin].amount = 0;
        goblinInfo[_goblin].reserved = 0;
    }

    function withdrawReserved(address _goblin, uint256 _amount) external onlyOwner {
        require(goblinInfo[_goblin].reserved >= _amount, "Reserved token not enough.");
        address token = goblinInfo[_goblin].token;
        uint256 beforeAmount = token.myBalance();
        if (beforeAmount < _amount) {
            bscPool.withdraw(goblinInfo[_goblin].pid, _amount.sub(beforeAmount));
        }
        uint256 afterAmount = token.myBalance();

        token.safeTransfer(msg.sender, afterAmount);
        goblinInfo[_goblin].reserved = goblinInfo[msg.sender].reserved.sub(afterAmount);

    }
}