// Deposit Page JavaScript
class DepositPage {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthState();
        this.setupMobileMenu();
        // loadRecentDeposits will be called after user profile is loaded
    }

    setupEventListeners() {
        // Copy address buttons
        document.getElementById('copy-btc-btn').addEventListener('click', () => this.copyAddress('btc-address'));
        document.getElementById('copy-usdt-btn').addEventListener('click', () => this.copyAddress('usdt-address'));
        document.getElementById('copy-bxc-btn').addEventListener('click', () => this.copyAddress('bxc-address'));
        
        // INR deposit button
        document.getElementById('deposit-inr-btn').addEventListener('click', () => this.handleInrDeposit());
        
        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());
    }

    // Add refresh balances function
    async refreshCryptoBalances() {
        try {
            if (window.web3Manager && window.web3Manager.refreshAllBalances) {
                await window.web3Manager.refreshAllBalances();
            } else {
                this.showNotification('Web3 Manager not available', 'error');
            }
        } catch (error) {
            console.error('Error refreshing balances:', error);
            this.showNotification('Failed to refresh balances', 'error');
        }
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
            }
            
            // Set current user in web3Manager for balance updates
            if (window.web3Manager) {
                window.web3Manager.setCurrentUser(this.currentUser);
            }
            
            // Set deposit addresses dynamically (no hardcoded demo values)
            try {
                const contractAddr = window.CONTRACT_CONFIG?.contracts?.cryptoWallet || '';
                const usdtInput = document.getElementById('usdt-address');
                const bxcInput = document.getElementById('bxc-address');
                const btcInput = document.getElementById('btc-address');
                if (usdtInput && contractAddr) usdtInput.value = contractAddr;
                if (bxcInput && contractAddr) bxcInput.value = contractAddr;
                if (btcInput) btcInput.placeholder = 'BTC deposits not supported on Sepolia';
            } catch (e) {
                console.warn('Could not set deposit addresses:', e);
            }
            
            // Now that user profile is loaded, load recent deposits
            await this.loadRecentDeposits();
            await this.loadRecentCryptoDeposits();
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.showNotification('Error loading profile', 'error');
        }
    }

    copyAddress(inputId) {
        const input = document.getElementById(inputId);
        input.select();
        input.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            this.showNotification('Address copied to clipboard!', 'success');
        } catch (err) {
            // Fallback for modern browsers
            navigator.clipboard.writeText(input.value).then(() => {
                this.showNotification('Address copied to clipboard!', 'success');
            }).catch(() => {
                this.showNotification('Failed to copy address', 'error');
            });
        }
    }

    async handleInrDeposit() {
        const amount = parseFloat(document.getElementById('inr-amount').value);
        
        if (!amount || amount < 100) {
            this.showNotification('Please enter a valid amount (minimum ₹100)', 'error');
            return;
        }

        try {
            console.log('Starting INR deposit process...');
            console.log('Cashfree manager available:', !!window.cashfreeManager);
            
            // Wait for Cashfree manager to be available
            let attempts = 0;
            const maxAttempts = 20; // Increased attempts
            
            while (!window.cashfreeManager && attempts < maxAttempts) {
                console.log(`Waiting for Cashfree manager... Attempt ${attempts + 1}/${maxAttempts}`);
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            console.log('Final check - Cashfree manager:', !!window.cashfreeManager);
            
            if (window.cashfreeManager && typeof window.cashfreeManager.createPayment === 'function') {
                console.log('Calling Cashfree createPayment...');
                
                // Check if Cashfree manager is ready
                if (!window.cashfreeManager.isReady()) {
                    console.log('Cashfree manager not ready, waiting...');
                    this.showNotification('Initializing payment service...', 'info');
                    
                    // Wait a bit more for initialization
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    if (!window.cashfreeManager.isReady()) {
                        // Try to reinitialize
                        console.log('Attempting to reinitialize Cashfree manager...');
                        this.showNotification('Reinitializing payment service...', 'info');
                        
                        // Wait a bit more
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        if (!window.cashfreeManager.isReady()) {
                            throw new Error('Payment service unavailable. Please check your internet connection and refresh the page.');
                        }
                    }
                }
                
                // Use Cashfree for INR deposits
                await window.cashfreeManager.createPayment(
                    amount, 
                    this.currentUser.email, 
                    this.currentUser.displayName || 'User', 
                    this.currentUser.uid
                );
            } else {
                // Only fallback if Cashfree is truly not available
                this.showNotification('Payment service not ready. Please refresh the page and try again.', 'error');
                console.error('Cashfree manager not available or createPayment method missing');
                console.error('Cashfree manager:', window.cashfreeManager);
            }
        } catch (error) {
            console.error('Deposit error:', error);
            this.showNotification('Error processing deposit: ' + error.message, 'error');
        }
    }

    // Removed simulateInrDeposit method - now using real Cashfree integration

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
            
            // Refresh the recent deposits after logging a new transaction
            this.loadRecentDeposits();
            this.loadRecentCryptoDeposits(); // Refresh crypto deposits
        } catch (error) {
            console.error('Error logging transaction:', error);
        }
    }
    
    // Load recent deposits from Firebase
    async loadRecentDeposits() {
        try {
            const historyContainer = document.getElementById('deposit-history');
            if (!historyContainer) return;
            
            // Show loading state
            historyContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading recent deposits...</p>
                </div>
            `;
            
            // Fetch recent deposit transactions
            const snapshot = await db.collection('transactions')
                .where('userId', '==', this.currentUser.uid)
                .where('type', '==', 'deposit')
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
                        <i class="fas fa-inbox"></i>
                        <h3>No deposits yet</h3>
                        <p>Your deposit history will appear here once you make your first deposit.</p>
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
                            <h4>${transaction.currency} Deposit</h4>
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
            console.error('Error loading recent deposits:', error);
            const historyContainer = document.getElementById('deposit-history');
            if (historyContainer) {
                historyContainer.innerHTML = `
                    <div class="no-transactions">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Error loading deposits</h3>
                        <p>Unable to load recent deposits. Please try again later.</p>
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

    async loadRecentCryptoDeposits() {
        try {
            const historyContainer = document.getElementById('crypto-deposit-history');
            if (!historyContainer) return;
            
            // Show loading state
            historyContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading recent crypto deposits...</p>
                </div>
            `;
            
            const snapshot = await db.collection('transactions')
                .where('userId', '==', this.currentUser.uid)
                .where('type', '==', 'deposit')
                .limit(20)
                .get();
            
            const transactions = [];
            snapshot.forEach(doc => {
                const t = { id: doc.id, ...doc.data() };
                if (t.currency === 'USDT' || t.currency === 'BXC') transactions.push(t);
            });
            
            transactions.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());
            const recent = transactions.slice(0, 5);
            
            if (recent.length === 0) {
                historyContainer.innerHTML = `
                    <div class="no-transactions">
                        <i class="fas fa-inbox"></i>
                        <h3>No crypto deposits yet</h3>
                        <p>Your crypto deposit history will appear here once detected on-chain.</p>
                    </div>
                `;
                return;
            }
            
            let html = '';
            recent.forEach(tx => {
                const iconClass = this.getCurrencyIconClass(tx.currency);
                const formattedAmount = this.formatAmount(tx.amount, tx.currency);
                const formattedDate = this.formatDate(tx.timestamp);
                const statusClass = this.getStatusClass(tx.status);
                const hashPart = tx.txHash ? ` <a href="${(window.CONTRACT_CONFIG?.networks?.sepolia?.explorer || 'https://sepolia.etherscan.io')}/tx/${tx.txHash}" target="_blank">View</a>` : '';
                html += `
                    <div class="history-item">
                        <div class="history-icon ${iconClass}">
                            <i class="${this.getCurrencyIcon(tx.currency)}"></i>
                        </div>
                        <div class="history-details">
                            <h4>${tx.currency} Deposit</h4>
                            <p>${formattedAmount}</p>
                            <small>${formattedDate}${hashPart ? ' • ' + hashPart : ''}</small>
                        </div>
                        <div class="history-status ${statusClass}">
                            <i class="${this.getStatusIcon(tx.status)}"></i>
                            <span>${this.getStatusText(tx.status)}</span>
                        </div>
                    </div>
                `;
            });
            
            historyContainer.innerHTML = html;
        } catch (error) {
            console.error('Error loading crypto deposits:', error);
        }
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

// Global function for refresh button
async function refreshCryptoBalances() {
    try {
        if (window.web3Manager && window.web3Manager.refreshAllBalances) {
            await window.web3Manager.refreshAllBalances();
        } else {
            console.error('Web3 Manager not available');
        }
    } catch (error) {
        console.error('Error refreshing balances:', error);
    }
}

// Initialize the deposit page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const depositPage = new DepositPage();
    
    // Make loadRecentDeposits available globally for Cashfree integration
    window.loadRecentDeposits = () => depositPage.loadRecentDeposits();
});
