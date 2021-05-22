pragma solidity ^0.6.0;

interface IUserProfile {

    /* ==================================== Read ==================================== */

    function name(address account) external view returns (bytes memory);

    function inviter(address inviterAccount) external view returns (address);

    function registerDate(address account) external view returns (uint256);

    function userId(address account) external view returns (uint256);

    function idToAddress(uint256 id) external view returns (address);

    // Get invitees

    function getUserInviteesNum(address account) external view returns (uint256);

    function getUserInvitee(address account, uint256 index) external view returns (address);

    /* ==================================== Write ==================================== */

    function register(bytes calldata setName, uint256 setId, uint256 inviterId) external;

    function changeName(bytes calldata setName) external;

    function extendWrite(bytes calldata data) external payable;
    
    function extendRead(bytes calldata data) external payable returns (bytes memory);
}