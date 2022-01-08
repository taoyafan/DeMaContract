// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./interface/IUserProfile.sol";
import "./interface/IPlugin.sol";

contract UserProfile is IUserProfile, Ownable {

    /// @notice Events
    event Register(address account, bytes setName, uint256 setId, uint256 inviterId);
    event ChangeName(address account, bytes setName);

    /// @notice Mutable state variables
    mapping(address => bytes) public override name;
    mapping(address => address) public override inviter;
    mapping(address => uint256) public override registerDate;
    mapping(address => uint256) public override userId;
    mapping(address => address[]) invitees;

    // Get address from id
    mapping(uint256 => address) public override idToAddress;

    address[] allUsers;

    mapping(address => bool) public pluginsOk;

    bool public override inviteBuffEnable = true;

    constructor () public { 
        name[msg.sender] = bytes("Creator");
        inviter[msg.sender] = msg.sender;       // The creator's inviter is it self.
        registerDate[msg.sender] = block.timestamp;
        userId[msg.sender] = 0;
        
        // Add idToAddress
        idToAddress[0] = msg.sender;

        // Set inviter info
        invitees[msg.sender].push(msg.sender);
        allUsers.push(msg.sender);
    }

    /* ==================================== Read ==================================== */

    // Get invitees
    function getUserInviteesNum(address account) external view override returns (uint256) {
        return invitees[account].length;
    }

    function getUserInvitee(address account, uint256 index) external view override returns (address) {
        return invitees[account][index];
    }

    function getUserAllInvitees(address account) external view returns (address[] memory) {
        return invitees[account];
    }

    // Get users
    function getUsersNum() external view  returns (uint256) {
        return allUsers.length;
    }

    function getUser(uint256 index) external view returns (address) {
        return allUsers[index];
    }

    function getAllUsers() external view returns (address[] memory) {
        return allUsers;
    }

    /* ==================================== Write ==================================== */

    function register(bytes calldata setName, uint256 setId, uint256 inviterId) external override {
        require(registerDate[msg.sender] == 0, "User already registered.");
        require(idToAddress[setId] == address(0), "setId already existed.");

        address inviterAccount = idToAddress[inviterId];
        require(inviterAccount != address(0), "inviterId not correct.");

        // Set user info
        name[msg.sender] = setName;
        inviter[msg.sender] = idToAddress[inviterId];
        registerDate[msg.sender] = block.timestamp;
        userId[msg.sender] = setId;

        // Add idToAddress
        idToAddress[setId] = msg.sender;

        // Set inviter info
        invitees[inviterAccount].push(msg.sender);

        allUsers.push(msg.sender);

        emit Register(msg.sender, setName, setId, inviterId);
    }

    function changeName(bytes calldata setName) external override {
        require(registerDate[msg.sender] != 0, "User haven't registered.");
        name[msg.sender] = setName;

        emit ChangeName(msg.sender, setName);
    }

    function extendWrite(bytes calldata data) external payable override {
        (address plugin, bytes memory ext) = abi.decode(data, (address, bytes));
        require(pluginsOk[plugin], "Unapproved work plugin");
        IPlugin(plugin).write{value: msg.value}(ext);
    } 

    function extendRead(bytes calldata data) external override returns (bytes memory) {
        (address plugin, bytes memory ext) = abi.decode(data, (address, bytes));
        require(pluginsOk[plugin], "Unapproved work plugin");
        return IPlugin(plugin).read(ext);
    } 


    /* ==================================== Only Owner ==================================== */

    
    /**
     * @dev Set the given strategies' approval status.
     * @param plugins The plugins addresses.
     * @param isOk Whether to approve or unapprove the given strategies.
     */
    function setPluginsOk(address[] calldata plugins, bool isOk) external onlyOwner {
        uint256 len = plugins.length;
        for (uint256 idx = 0; idx < len; idx++) {
            pluginsOk[plugins[idx]] = isOk;
        }
    }

    function setInviteBuffEnable(bool enable) external onlyOwner {
        inviteBuffEnable = enable;
    }
}