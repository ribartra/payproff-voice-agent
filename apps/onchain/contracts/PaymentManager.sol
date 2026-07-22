// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PaymentManager {
    using SafeERC20 for IERC20;

    mapping(bytes32 => bool) public executedPayments;

    event PaymentExecuted(
        bytes32 indexed paymentId,
        bytes32 indexed mandateHash,
        address indexed payer,
        address token,
        address recipient,
        uint256 amount
    );

    mapping(address => bool) public allowedTokens;
    mapping(bytes32 => bool) public executedPaymentIds;

    constructor(address[] memory tokens) {
        require(tokens.length > 0, "No tokens");
        for (uint256 index = 0; index < tokens.length; index++) {
            require(tokens[index] != address(0), "Token zero");
            allowedTokens[tokens[index]] = true;
        }
    }

    function pay(
        bytes32 paymentId,
        bytes32 mandateHash,
        address token,
        address recipient,
        uint256 amount
    ) external {
        require(paymentId != bytes32(0), "Payment id zero");
        require(mandateHash != bytes32(0), "Mandate hash zero");
        require(allowedTokens[token], "Token not allowed");
        require(!executedPaymentIds[paymentId], "Payment already executed");
        require(recipient != address(0), "Recipient zero");
        require(amount > 0, "Amount zero");

        executedPaymentIds[paymentId] = true;
        IERC20(token).safeTransferFrom(msg.sender, recipient, amount);

        emit PaymentExecuted(
            paymentId,
            mandateHash,
            msg.sender,
            token,
            recipient,
            amount
        );
    }
}