// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./abstract/AStrategyAddTwoSidesOptimal.sol";
import "./interface/MDX/IMdexRouter.sol";
import "./interface/MDX/ISwapMining.sol";
import "./utils/SafeToken.sol";

contract MdxStrategyAddTwoSidesOptimal is AStrategyAddTwoSidesOptimal {
    using SafeToken for address;
    using SafeMath for uint256;

    /// @dev Create a new add two-side optimal strategy instance for mdx.
    /// @param _router The mdx router smart contract.
    constructor(address _router) public AStrategyAddTwoSidesOptimal(_router) {
        wBNB = IMdexRouter(_router).WBNB();
    }

    /// @dev Compute optimal deposit amount helper, A is much more than B,
    ///      and we need to swap some A for B.
    /// @param amtA amount of token A desired to deposit
    /// @param amtB amonut of token B desired to deposit
    /// @param resA amount of token A in reserve
    /// @param resB amount of token B in reserve
    function _optimalDepositA(
        uint256 amtA,
        uint256 amtB,
        uint256 resA,
        uint256 resB
    ) internal pure override returns (uint256) {
        require(amtA.mul(resB) >= amtB.mul(resA), "Reversed");

        uint256 a = 9970;
        uint256 b = uint256(19970).mul(resA);
        uint256 _c = (amtA.mul(resB)).sub(amtB.mul(resA));
        uint256 c = _c.mul(10000).div(amtB.add(resB)).mul(resA);

        uint256 d = a.mul(c).mul(4);
        uint256 e = Math.sqrt(b.mul(b).add(d));

        uint256 numerator = e.sub(b);
        uint256 denominator = a.mul(2);

        return numerator.div(denominator);
    }

    function withdrawRewards() external onlyOwner {
        ISwapMining _swapMining = ISwapMining(IMdexRouter(router).swapMining());
        _swapMining.takerWithdraw();

        // Send MDX back to owner.
        address mdx = _swapMining.mdx();
        mdx.safeTransfer(msg.sender, mdx.myBalance());
    }
}
