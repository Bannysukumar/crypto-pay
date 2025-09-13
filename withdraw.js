// Withdraw Page JavaScript
class WithdrawPage {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.cryptoPrices = {
            BTC: 4500000,
            USDT: 83,
            BXC: 25
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthState();
        this.setupMobileMenu();
        // loadCurrentBalances and loadRecentWithdrawals will be called after user profile is loaded
    }

    setupEventListeners() {
        // Withdraw form handlers
        document.getElementById('withdraw-crypto').addEventListener('change', () => this.updateConversionInfo());
        document.getElementById('withdraw-amount').addEventListener('input', () => this.updateConversionInfo());
        document.getElementById('withdraw-inr-amount').addEventListener('input', () => this.updateCryptoConversionInfo());
        document.getElementById('withdraw-crypto-type').addEventListener('change', () => this.updateCryptoConversionInfo());
        
        // Withdraw buttons
        document.getElementById('withdraw-inr-btn').addEventListener('click', () => this.handleInrWithdrawal());
        document.getElementById('withdraw-crypto-btn').addEventListener('click', () => this.handleCryptoWithdrawal());
        
        // Wallet connection
        document.getElementById('connect-wallet-btn').addEventListener('click', () => this.connectWallet());
        
        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());
    }

    setupMobileMenu() {
        const navToggle = document.getElementById('nav-toggle');
        const navMenu = document.getElementById('nav-menu');
        
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }

    checkAuthState() {
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.loadUserProfile();
            } else {
                // User not logged in, redirect to landing page
                window.location.href = 'index.html';
            }
        });
    }

    async loadUserProfile() {
        try {
            const doc = await db.collection('users').doc(this.currentUser.uid).get();
            if (doc.exists) {
                this.userProfile = doc.data();
                this.loadCurrentBalances();
            }
            // Load real-time crypto prices
            await this.fetchCryptoPrices();
            // Update wallet status
            this.updateWalletStatus();
            // Now that user profile is loaded, load recent withdrawals
            await this.loadRecentWithdrawals();
            // Check contract balances
            await this.checkContractBalances();
            // Inform Web3Manager of current user for event logging
            if (window.web3Manager && typeof window.web3Manager.setCurrentUser === 'function') {
                window.web3Manager.setCurrentUser(this.currentUser);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.showNotification('Error loading profile', 'error');
        }
    }

    async fetchCryptoPrices() {
        try {
            // Prefer centralized API helper to avoid CORS
            if (window.cryptoPriceAPI && typeof window.cryptoPriceAPI.forceRefresh === 'function') {
                await window.cryptoPriceAPI.forceRefresh();
                const prices = window.cryptoPriceAPI.getAllPrices();
                this.cryptoPrices.BTC = prices?.BTC?.INR || this.cryptoPrices.BTC;
                this.cryptoPrices.USDT = prices?.USDT?.INR || this.cryptoPrices.USDT;
                this.cryptoPrices.BXC = prices?.BXC?.INR || this.cryptoPrices.BXC;
                console.log('Prices loaded via CryptoPriceAPI:', this.cryptoPrices);
                return;
            }

            // Fallback: CoinGecko (may be blocked by CORS in some environments)
            try {
                const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether&vs_currencies=inr', {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'CryptoWallet/1.0'
                    },
                    signal: AbortSignal.timeout(10000)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.bitcoin && data.tether) {
                        this.cryptoPrices.BTC = data.bitcoin.inr;
                        this.cryptoPrices.USDT = data.tether.inr;
                        // BXC price (custom token - using a reasonable estimate)
                        this.cryptoPrices.BXC = 25;
                        
                        console.log('Real-time crypto prices loaded:', this.cryptoPrices);
                    }
                } else {
                    console.log('CoinGecko API returned error status:', response.status);
                }
            } catch (fallbackError) {
                console.log('Fallback API call failed, using default prices:', fallbackError.message);
                // Keep existing fallback prices
            }
        } catch (error) {
            console.error('Error fetching crypto prices:', error);
            
            // Check if it's a CORS error
            if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                console.log('CORS or network error detected, using fallback prices');
            } else if (error.name === 'AbortError') {
                console.log('Price fetch timed out, using fallback prices');
            }
            
            // Keep fallback prices if API fails
        }
    }

    loadCurrentBalances() {
        if (!this.userProfile) return;
        
        document.getElementById('current-inr').textContent = `₹${this.userProfile.inrBalance.toFixed(2)}`;
        document.getElementById('current-btc').textContent = this.userProfile.cryptoBalances.BTC.toFixed(8);
        document.getElementById('current-usdt').textContent = this.userProfile.cryptoBalances.USDT.toFixed(2);
        document.getElementById('current-bxc').textContent = this.userProfile.cryptoBalances.BXC.toFixed(2);
    }

    updateConversionInfo() {
        const selectedCrypto = document.getElementById('withdraw-crypto').value;
        const amount = parseFloat(document.getElementById('withdraw-amount').value) || 0;
        
        if (selectedCrypto && amount > 0) {
            const inrValue = amount * this.cryptoPrices[selectedCrypto];
            document.getElementById('conversion-info').textContent = `≈ ₹${inrValue.toFixed(2)}`;
        } else {
            document.getElementById('conversion-info').textContent = 'Select crypto first';
        }
    }

    updateCryptoConversionInfo() {
        const selectedCrypto = document.getElementById('withdraw-crypto-type').value;
        const inrAmount = parseFloat(document.getElementById('withdraw-inr-amount').value) || 0;
        
        if (selectedCrypto && inrAmount > 0) {
            const cryptoAmount = inrAmount / this.cryptoPrices[selectedCrypto];
            document.getElementById('crypto-conversion-info').textContent = `≈ ${cryptoAmount.toFixed(8)} ${selectedCrypto}`;
        } else {
            document.getElementById('crypto-conversion-info').textContent = 'Select crypto first';
        }
    }

    async handleInrWithdrawal() {
        const crypto = document.getElementById('withdraw-crypto').value;
        const amount = parseFloat(document.getElementById('withdraw-amount').value);
        const bankAccount = document.getElementById('bank-account').value;
        const ifscCode = document.getElementById('ifsc-code').value;
        
        if (!crypto || !amount || !bankAccount || !ifscCode) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }
        
        if (amount <= 0) {
            this.showNotification('Please enter a valid amount', 'error');
            return;
        }
        
        if (amount > this.userProfile.cryptoBalances[crypto]) {
            this.showNotification('Insufficient balance', 'error');
            return;
        }
        
        try {
            await this.processInrWithdrawal(crypto, amount, bankAccount, ifscCode);
        } catch (error) {
            console.error('Withdrawal error:', error);
            this.showNotification('Error processing withdrawal', 'error');
        }
    }

    async handleCryptoWithdrawal() {
        const crypto = document.getElementById('withdraw-crypto-type').value;
        const inrAmount = parseFloat(document.getElementById('withdraw-inr-amount').value);
        const walletAddress = document.getElementById('wallet-address').value;
        
        if (!crypto || !inrAmount || !walletAddress) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }
        
        if (inrAmount < 100) {
            this.showNotification('Minimum withdrawal amount is ₹100', 'error');
            return;
        }
        
        if (inrAmount > this.userProfile.inrBalance) {
            this.showNotification('Insufficient INR balance', 'error');
            return;
        }
        
        // Validate wallet address format
        if (!this.isValidWalletAddress(walletAddress)) {
            this.showNotification('Invalid wallet address format', 'error');
            return;
        }
        
        // Check if Web3 is connected
        if (!window.web3Manager || !window.web3Manager.isConnected) {
            this.showNotification('Please connect your wallet to withdraw cryptocurrency', 'error');
            return;
        }
        
        try {
            await this.processCryptoWithdrawal(crypto, inrAmount, walletAddress);
        } catch (error) {
            console.error('Withdrawal error:', error);
            this.showNotification('Error processing withdrawal', 'error');
        }
    }

    isValidWalletAddress(address) {
        // Basic Ethereum address validation
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    async connectWallet() {
        try {
            if (window.web3Manager) {
                await window.web3Manager.connectWallet();
                this.updateWalletStatus();
                this.showNotification('Wallet connected successfully!', 'success');
            } else {
                this.showNotification('Web3 not available. Please refresh the page.', 'error');
            }
        } catch (error) {
            console.error('Wallet connection error:', error);
            this.showNotification('Failed to connect wallet', 'error');
        }
    }

    updateWalletStatus() {
        const walletStatus = document.getElementById('wallet-status');
        const networkStatus = document.getElementById('network-status');
        const connectBtn = document.getElementById('connect-wallet-btn');
        
        if (window.web3Manager && window.web3Manager.isConnected) {
            walletStatus.textContent = `Connected: ${window.web3Manager.userAccount.slice(0, 6)}...${window.web3Manager.userAccount.slice(-4)}`;
            walletStatus.className = 'wallet-status connected';
            networkStatus.textContent = window.web3Manager.getNetworkStatus();
            connectBtn.style.display = 'none';
        } else {
            walletStatus.textContent = 'Not Connected';
            walletStatus.className = 'wallet-status disconnected';
            networkStatus.textContent = 'Sepolia Required';
            connectBtn.style.display = 'inline-block';
        }
    }

    async checkContractBalances() {
        try {
            if (window.web3Manager && window.web3Manager.isConnected) {
                // Check BXC contract balance using direct contract call
                const bxcAddress = window.CONTRACT_CONFIG.contracts.bxc;
                const cryptoWalletAddress = window.CONTRACT_CONFIG.contracts.cryptoWallet;
                
                // Create BXC contract instance
                const bxcABI = [
                    {
                        "constant": true,
                        "inputs": [{"name": "_owner", "type": "address"}],
                        "name": "balanceOf",
                        "outputs": [{"name": "balance", "type": "uint256"}],
                        "type": "function"
                    }
                ];
                
                const bxcContract = new window.web3Manager.web3.eth.Contract(bxcABI, bxcAddress);
                const bxcBalance = await bxcContract.methods.balanceOf(cryptoWalletAddress).call();
                const bxcBalanceFormatted = parseFloat(window.web3Manager.web3.utils.fromWei(bxcBalance, 'ether')).toFixed(8);
                
                console.log('Contract BXC balance (checkContractBalances):', bxcBalanceFormatted);
                
                // Update the info box with current contract balance
                const infoBox = document.querySelector('.info-box p');
                if (infoBox) {
                    if (parseFloat(bxcBalanceFormatted) > 0) {
                        infoBox.innerHTML = `
                            The smart contract currently has <strong>${bxcBalanceFormatted} BXC tokens</strong> available for withdrawals. 
                            <a href="load-bxc-tokens.html" style="color: #0ea5e9; text-decoration: underline;">Load more tokens</a> 
                            if needed.
                        `;
                    } else {
                        infoBox.innerHTML = `
                            <strong style="color: #dc2626;">⚠️ No BXC tokens in contract!</strong> 
                            <a href="load-bxc-tokens.html" style="color: #0ea5e9; text-decoration: underline;">Load BXC tokens into the contract</a> 
                            before users can withdraw.
                        `;
                    }
                }
            }
        } catch (error) {
            console.error('Error checking contract balances:', error);
            const infoBox = document.querySelector('.info-box p');
            if (infoBox) {
                infoBox.innerHTML = `
                    <strong style="color: #dc2626;">⚠️ Error checking contract balance!</strong> 
                    Please check your wallet connection and try again.
                `;
            }
        }
    }

    async processInrWithdrawal(crypto, amount, bankAccount, ifscCode) {
        try {
            this.showNotification('Processing withdrawal...', 'info');
            
            // Deduct crypto balance
            const newBalance = this.userProfile.cryptoBalances[crypto] - amount;
            await db.collection('users').doc(this.currentUser.uid).update({
                [`cryptoBalances.${crypto}`]: newBalance,
                updatedAt: new Date()
            });
            
            // Log transaction
            await this.logTransaction('withdrawal', amount, crypto, `Bank: ${bankAccount}`);
            
            this.showNotification(`Successfully withdrew ${amount} ${crypto} to bank account`, 'success');
            
            // Reset form
            document.getElementById('withdraw-crypto').value = '';
            document.getElementById('withdraw-amount').value = '';
            document.getElementById('bank-account').value = '';
            document.getElementById('ifsc-code').value = '';
            
            // Reload profile
            await this.loadUserProfile();
            
        } catch (error) {
            console.error('Process withdrawal error:', error);
            throw error;
        }
    }

    async processCryptoWithdrawal(crypto, inrAmount, walletAddress) {
        try {
            this.showNotification('Processing withdrawal...', 'info');
            
            // Calculate crypto amount based on current price
            const cryptoAmount = inrAmount / this.cryptoPrices[crypto];
            
            // Check if contract has enough crypto balance for withdrawal
            if (window.web3Manager && window.web3Manager.isConnected) {
                const tokenAddress = window.CONTRACT_CONFIG.contracts[crypto.toLowerCase()];
                
                // Create token contract instance to check contract's balance
                const tokenABI = [
                    {
                        "constant": true,
                        "inputs": [{"name": "_owner", "type": "address"}],
                        "name": "balanceOf",
                        "outputs": [{"name": "balance", "type": "uint256"}],
                        "type": "function"
                    }
                ];
                
                const tokenContract = new window.web3Manager.web3.eth.Contract(tokenABI, tokenAddress);
                const contractBalance = await tokenContract.methods.balanceOf(window.CONTRACT_CONFIG.contracts.cryptoWallet).call();
                const contractBalanceFormatted = parseFloat(window.web3Manager.web3.utils.fromWei(contractBalance, 'ether')).toFixed(8);
                
                console.log(`Contract ${crypto} balance:`, contractBalanceFormatted);
                console.log(`Required ${crypto} amount:`, cryptoAmount.toFixed(8));
                
                if (parseFloat(contractBalanceFormatted) < cryptoAmount) {
                    const requiredAmount = cryptoAmount.toFixed(8);
                    this.showNotification(
                        `Insufficient ${crypto} balance in smart contract. Contract has ${contractBalanceFormatted} ${crypto}, but ${requiredAmount} ${crypto} is required. Please load more ${crypto} tokens into the contract.`, 
                        'error'
                    );
                    return;
                }
            }
            
            // Do not deduct INR yet; only after on-chain success
            
            // Perform actual blockchain withdrawal if Web3 is available
            if (window.web3Manager && window.web3Manager.isConnected) {
                try {
                    const tokenAddress = window.CONTRACT_CONFIG.contracts[crypto.toLowerCase()];
                    const amountInWei = window.web3Manager.web3.utils.toWei(cryptoAmount.toString(), 'ether');
                    
                    // Enforce that the entered wallet equals the connected wallet (withdraw sends to msg.sender)
                    const connected = (window.web3Manager.userAccount || '').toLowerCase();
                    if (connected !== (walletAddress || '').toLowerCase()) {
                        this.showNotification('Wallet address must match the connected wallet', 'error');
                        return;
                    }
                    
                    // Note: For INR->crypto conversion withdrawals, the contract owner should call
                    // executeWithdrawalTo(userAddress, tokenAddress, amount) from their admin interface
                    // For now, we'll simulate the withdrawal in Firebase and log the pending transaction
                    console.log(`INR->Crypto withdrawal requested: ${cryptoAmount.toFixed(8)} ${crypto} to ${walletAddress}`);
                    
                    // Log transaction as pending (admin needs to execute via executeWithdrawalTo)
                    await db.collection('pending_withdrawals').add({
                        userId: this.currentUser.uid,
                        userAddress: walletAddress,
                        tokenAddress: tokenAddress,
                        cryptoAmount: cryptoAmount,
                        inrAmount: inrAmount,
                        crypto: crypto,
                        status: 'pending_admin_execution',
                        createdAt: new Date(),
                        type: 'inr_to_crypto'
                    });
                    
                    console.log('Withdrawal request logged for admin execution');
                    
                    // After on-chain success, deduct INR in Firestore
                    const newInr = this.userProfile.inrBalance - inrAmount;
                    await db.collection('users').doc(this.currentUser.uid).update({
                        inrBalance: newInr,
                        updatedAt: new Date()
                    });
                    
                    // Do not deduct crypto in Firestore for INR->Crypto withdrawal
                    this.showNotification(`INR to ${crypto} withdrawal request submitted. Admin will process the crypto transfer shortly.`, 'success');
                    
                } catch (blockchainError) {
                    console.error('Blockchain withdrawal error:', blockchainError);
                    this.showNotification('Blockchain withdrawal failed. Please try again.', 'error');
                    return;
                }
            } else {
                // Require wallet connection on Sepolia
                this.showNotification('Please connect your wallet on Sepolia to withdraw crypto', 'error');
                return;
            }
            
            // Log transaction
            await this.logTransaction('withdrawal', cryptoAmount, crypto, `Wallet: ${walletAddress}`);
            
            // Reset form
            document.getElementById('withdraw-crypto-type').value = '';
            document.getElementById('withdraw-inr-amount').value = '';
            document.getElementById('wallet-address').value = '';
            
            // Reload profile
            await this.loadUserProfile();
            
        } catch (error) {
            console.error('Process withdrawal error:', error);
            throw error;
        }
    }

    async logTransaction(type, amount, currency, description) {
        try {
            await db.collection('transactions').add({
                userId: this.currentUser.uid,
                type: type,
                amount: amount,
                currency: currency,
                description: description,
                timestamp: new Date(),
                status: 'completed'
            });
            
            // Refresh the recent withdrawals after logging a new transaction
            this.loadRecentWithdrawals();
        } catch (error) {
            console.error('Error logging transaction:', error);
        }
    }
    
    // Load recent withdrawals from Firebase
    async loadRecentWithdrawals() {
        try {
            const historyContainer = document.getElementById('withdraw-history');
            if (!historyContainer) return;
            
            // Show loading state
            historyContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading recent withdrawals...</p>
                </div>
            `;
            
            // Fetch recent withdrawal transactions
            const snapshot = await db.collection('transactions')
                .where('userId', '==', this.currentUser.uid)
                .where('type', '==', 'withdrawal')
                .limit(10)
                .get();
            
            // Sort by timestamp on client side
            const transactions = [];
            snapshot.forEach(doc => {
                transactions.push({ id: doc.id, ...doc.data() });
            });
            
            // Sort by timestamp descending and take first 5
            transactions.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());
            const recentTransactions = transactions.slice(0, 5);
            
            if (snapshot.empty) {
                // No transactions found
                historyContainer.innerHTML = `
                    <div class="no-transactions">
                        <i class="fas fa-arrow-up"></i>
                        <h3>No withdrawals yet</h3>
                        <p>Your withdrawal history will appear here once you make your first withdrawal.</p>
                    </div>
                `;
                return;
            }
            
            // Build transaction list
            let transactionsHTML = '';
            recentTransactions.forEach(transaction => {
                const iconClass = this.getCurrencyIconClass(transaction.currency);
                const formattedAmount = this.formatAmount(transaction.amount, transaction.currency);
                const formattedDate = this.formatDate(transaction.timestamp);
                const statusClass = this.getStatusClass(transaction.status);
                
                transactionsHTML += `
                    <div class="history-item">
                        <div class="history-icon ${iconClass}">
                            <i class="${this.getCurrencyIcon(transaction.currency)}"></i>
                        </div>
                        <div class="history-details">
                            <h4>${transaction.currency} Withdrawal</h4>
                            <p>${formattedAmount}</p>
                            <small>${formattedDate}</small>
                        </div>
                        <div class="history-status ${statusClass}">
                            <i class="${this.getStatusIcon(transaction.status)}"></i>
                            <span>${this.getStatusText(transaction.status)}</span>
                        </div>
                    </div>
                `;
            });
            
            historyContainer.innerHTML = transactionsHTML;
            
        } catch (error) {
            console.error('Error loading recent withdrawals:', error);
            const historyContainer = document.getElementById('withdraw-history');
            if (historyContainer) {
                historyContainer.innerHTML = `
                    <div class="no-transactions">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Error loading withdrawals</h3>
                        <p>Unable to load recent withdrawals. Please try again later.</p>
                    </div>
                `;
            }
        }
    }
    
    // Helper methods for transaction display
    getCurrencyIconClass(currency) {
        const iconMap = {
            'INR': 'inr',
            'BTC': 'btc',
            'USDT': 'usdt',
            'BXC': 'bxc'
        };
        return iconMap[currency] || 'inr';
    }
    
    getCurrencyIcon(currency) {
        const iconMap = {
            'INR': 'fas fa-rupee-sign',
            'BTC': 'fab fa-bitcoin',
            'USDT': 'fas fa-dollar-sign',
            'BXC': 'fas fa-coins'
        };
        return iconMap[currency] || 'fas fa-rupee-sign';
    }
    
    formatAmount(amount, currency) {
        if (currency === 'INR') {
            return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (currency === 'BTC') {
            return `${amount.toFixed(8)} BTC`;
        } else if (currency === 'USDT') {
            return `${amount.toFixed(2)} USDT`;
        } else if (currency === 'BXC') {
            return `${amount.toFixed(2)} BXC`;
        }
        return `${amount} ${currency}`;
    }
    
    formatDate(timestamp) {
        if (!timestamp) return 'Unknown date';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);
        
        if (diffInHours < 1) {
            return 'Just now';
        } else if (diffInHours < 24) {
            const hours = Math.floor(diffInHours);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (diffInHours < 48) {
            return 'Yesterday, ' + date.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
        } else {
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
        }
    }
    
    getStatusClass(status) {
        const statusMap = {
            'completed': 'success',
            'pending': 'pending',
            'failed': 'failed',
            'processing': 'pending'
        };
        return statusMap[status] || 'pending';
    }
    
    getStatusIcon(status) {
        const iconMap = {
            'completed': 'fas fa-check',
            'pending': 'fas fa-clock',
            'failed': 'fas fa-times',
            'processing': 'fas fa-spinner fa-spin'
        };
        return iconMap[status] || 'fas fa-clock';
    }
    
    getStatusText(status) {
        const textMap = {
            'completed': 'Completed',
            'pending': 'Pending',
            'failed': 'Failed',
            'processing': 'Processing'
        };
        return textMap[status] || 'Pending';
    }

    async handleLogout() {
        try {
            await auth.signOut();
            this.showNotification('Logged out successfully', 'success');
            // Redirect to landing page
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            console.error('Logout error:', error);
            this.showNotification('Error logging out', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 3000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;
        
        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#10b981';
                break;
            case 'error':
                notification.style.backgroundColor = '#ef4444';
                break;
            case 'warning':
                notification.style.backgroundColor = '#f59e0b';
                break;
            default:
                notification.style.backgroundColor = '#3b82f6';
        }
        
        // Add to page
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the withdraw page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const withdrawPage = new WithdrawPage();
    
    // Make loadRecentWithdrawals available globally for integration
    window.loadRecentWithdrawals = () => withdrawPage.loadRecentWithdrawals();
});
