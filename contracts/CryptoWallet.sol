// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CryptoWallet
 * @dev A secure cryptocurrency wallet contract with support for multiple tokens
 * @dev Version: 2.0.0
 * @dev Features: Pausable, ReentrancyGuard, SafeERC20, Custom Errors
 */
contract CryptoWallet is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // Custom errors for better gas efficiency and error handling
    error InvalidAmount();
    error UnsupportedToken();
    error InsufficientUserBalance();
    error InsufficientContractBalance();
    error InvalidRecipient();
    error InvalidUserAddress();
    error ZeroAddress();
    error TransferFailed();
    error ContractPaused();
    error NotOwner();

    // Token addresses
    address public immutable usdtToken;
    address public immutable bxcToken;

    // User balances mapping
    mapping(address => mapping(address => uint256)) public userCryptoBalances;
    mapping(address => uint256) public userInrBalance;

    // Events
    event Deposit(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event Withdraw(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event Transfer(address indexed from, address indexed to, address indexed token, uint256 amount, uint256 timestamp);
    event InrDeposit(address indexed user, uint256 amount, uint256 timestamp);
    event InrWithdraw(address indexed user, uint256 amount, uint256 timestamp);
    event CryptoWithdrawalExecuted(address indexed user, address indexed token, uint256 amount, uint256 timestamp);

    // Modifiers
    modifier validAmount(uint256 amount) {
        if (amount == 0) revert InvalidAmount();
        _;
    }

    modifier validToken(address token) {
        if (token != usdtToken && token != bxcToken) revert UnsupportedToken();
        _;
    }

    modifier notZeroAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress();
        _;
    }

    modifier onlyWhenNotPaused() {
        if (paused()) revert ContractPaused();
        _;
    }

    /**
     * @dev Constructor sets token addresses
     * @param _usdtToken USDT token contract address
     * @param _bxcToken BXC token contract address
     */
    constructor(address _usdtToken, address _bxcToken) {
        if (_usdtToken == address(0)) revert ZeroAddress();
        if (_bxcToken == address(0)) revert ZeroAddress();
        
        usdtToken = _usdtToken;
        bxcToken = _bxcToken;
    }

    /**
     * @dev Deposit cryptocurrency into the wallet
     * @param token Token address to deposit
     * @param amount Amount to deposit
     */
    function depositCrypto(address token, uint256 amount) 
        external 
        whenNotPaused 
        validToken(token) 
        validAmount(amount) 
    {
        // Transfer tokens from user to contract
        try IERC20(token).safeTransferFrom(msg.sender, address(this), amount) {
            // Update user balance
            userCryptoBalances[msg.sender][token] += amount;
            
            emit Deposit(msg.sender, token, amount, block.timestamp);
        } catch {
            revert TransferFailed();
        }
    }

    /**
     * @dev Withdraw cryptocurrency from the wallet
     * @param token Token address to withdraw
     * @param amount Amount to withdraw
     */
    function withdrawCrypto(address token, uint256 amount) 
        external 
        whenNotPaused 
        validToken(token) 
        validAmount(amount) 
    {
        // Check user balance
        if (userCryptoBalances[msg.sender][token] < amount) {
            revert InsufficientUserBalance();
        }

        // Check contract balance
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        if (contractBalance < amount) {
            revert InsufficientContractBalance(token, amount, contractBalance);
        }

        // Update user balance first (prevent reentrancy)
        userCryptoBalances[msg.sender][token] -= amount;

        // Transfer tokens to user
        try IERC20(token).safeTransfer(msg.sender, amount) {
            emit Withdraw(msg.sender, token, amount, block.timestamp);
        } catch {
            // Revert state change if transfer fails
            userCryptoBalances[msg.sender][token] += amount;
            revert TransferFailed();
        }
    }

    /**
     * @dev Transfer cryptocurrency between users
     * @param recipient Recipient address
     * @param token Token address to transfer
     * @param amount Amount to transfer
     */
    function transferCrypto(address recipient, address token, uint256 amount) 
        external 
        whenNotPaused 
        validToken(token) 
        validAmount(amount) 
        notZeroAddress(recipient) 
    {
        if (msg.sender == recipient) revert InvalidRecipient();
        if (userCryptoBalances[msg.sender][token] < amount) revert InsufficientUserBalance();

        // Update balances
        userCryptoBalances[msg.sender][token] -= amount;
        userCryptoBalances[recipient][token] += amount;

        emit Transfer(msg.sender, recipient, token, amount, block.timestamp);
    }

    /**
     * @dev Deposit INR (off-chain balance)
     * @param user User address
     * @param amount INR amount
     */
    function depositInr(address user, uint256 amount) 
        external 
        whenNotPaused 
        notZeroAddress(user) 
        validAmount(amount) 
    {
        userInrBalance[user] += amount;
        emit InrDeposit(user, amount, block.timestamp);
    }

    /**
     * @dev Withdraw INR (off-chain balance)
     * @param user User address
     * @param amount INR amount
     */
    function withdrawInr(address user, uint256 amount) 
        external 
        whenNotPaused 
        notZeroAddress(user) 
        validAmount(amount) 
    {
        if (userInrBalance[user] < amount) revert InsufficientUserBalance();
        
        userInrBalance[user] -= amount;
        emit InrWithdraw(user, amount, block.timestamp);
    }

    /**
     * @dev Execute crypto withdrawal for INR conversion (admin only)
     * @param user User address
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function executeWithdrawalTo(address user, address token, uint256 amount)
        external
        onlyOwner
        nonReentrant
        onlyWhenNotPaused
        validToken(token)
        validAmount(amount)
        notZeroAddress(user)
    {
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        
        if (contractBalance < amount) {
            revert InsufficientContractBalance(token, amount, contractBalance);
        }
        
        // Transfer tokens directly to user with try-catch
        try IERC20(token).safeTransfer(user, amount) returns (bool success) {
            if (!success) revert TransferFailed();
        } catch {
            revert TransferFailed();
        }
        
        emit CryptoWithdrawalExecuted(user, token, amount, block.timestamp);
    }

    /**
     * @dev Pause contract (emergency stop)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Get contract's token balance
     * @param token Token address
     * @return Contract's balance of the token
     */
    function getContractBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @dev Check if token is supported
     * @param token Token address
     * @return True if token is supported
     */
    function isTokenSupported(address token) external view returns (bool) {
        return token == usdtToken || token == bxcToken;
    }

    /**
     * @dev Get all supported tokens
     * @return Array of supported token addresses
     */
    function getSupportedTokens() external view returns (address[] memory) {
        address[] memory tokens = new address[](2);
        tokens[0] = usdtToken;
        tokens[1] = bxcToken;
        return tokens;
    }

    /**
     * @dev Get all user balances
     * @param user User address
     * @return usdtBalance USDT balance
     * @return bxcBalance BXC balance
     * @return inrBalance INR balance
     */
    function getUserBalances(address user) 
        external 
        view 
        notZeroAddress(user) 
        returns (uint256 usdtBalance, uint256 bxcBalance, uint256 inrBalance) 
    {
        usdtBalance = userCryptoBalances[user][usdtToken];
        bxcBalance = userCryptoBalances[user][bxcToken];
        inrBalance = userInrBalance[user];
    }

    /**
     * @dev Get contract information
     * @return version Contract version
     * @return isPaused Pause status
     * @return contractOwner Contract owner
     * @return usdtAddress USDT token address
     * @return bxcAddress BXC token address
     */
    function getContractInfo() 
        external 
        view 
        returns (
            string memory version,
            bool isPaused,
            address contractOwner,
            address usdtAddress,
            address bxcAddress
        ) 
    {
        version = "2.0.0";
        isPaused = paused();
        contractOwner = owner();
        usdtAddress = usdtToken;
        bxcAddress = bxcToken;
    }

    /**
     * @dev Emergency recovery function (owner only)
     * @param token Token address to recover
     * @param amount Amount to recover
     * @param recipient Recipient address
     */
    function emergencyRecover(address token, uint256 amount, address recipient)
        external
        onlyOwner
        validAmount(amount)
        notZeroAddress(recipient)
    {
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        if (contractBalance < amount) revert InsufficientContractBalance(token, amount, contractBalance);

        try IERC20(token).safeTransfer(recipient, amount) {
            // Success
        } catch {
            revert TransferFailed();
        }
    }

    /**
     * @dev Get user's crypto balance for a specific token
     * @param user User address
     * @param token Token address
     * @return User's balance of the token
     */
    function getUserCryptoBalance(address user, address token) 
        external 
        view 
        validToken(token) 
        returns (uint256) 
    {
        return userCryptoBalances[user][token];
    }

    /**
     * @dev Get user's INR balance
     * @param user User address
     * @return User's INR balance
     */
    function getUserInrBalance(address user) external view returns (uint256) {
        return userInrBalance[user];
    }
}
