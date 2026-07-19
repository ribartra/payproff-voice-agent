// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PaymentManager {
    IERC20 public immutable usdc;

    event PaymentExecuted(
        address indexed from,
        address indexed to,
        uint256 amount
    );

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function pay(address receiver, uint256 amount) external {
        require(
            usdc.transferFrom(msg.sender, receiver, amount),
            "Transfer failed"
        );

        emit PaymentExecuted(msg.sender, receiver, amount);
    }
}
