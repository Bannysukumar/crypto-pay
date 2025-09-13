// Send Money Page JavaScript
class SendMoneyPage {
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
        // loadCurrentBalances and loadRecentTransfers will be called after user profile is loaded
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('send-money-form').addEventListener('submit', (e) => this.handleSendMoney(e));
        
        // Quick transfer items
        document.querySelectorAll('.quick-transfer-item').forEach(item => {
            item.addEventListener('click', () => this.handleQuickTransfer(item));
        });
        
        // Search user button
        document.getElementById('search-user-btn').addEventListener('click', () => this.searchUser());
        
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
            // Now that user profile is loaded, load recent transfers
            await this.loadRecentTransfers();
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.showNotification('Error loading profile', 'error');
        }
    }

    loadCurrentBalances() {
        if (!this.userProfile) return;
        
        document.getElementById('current-inr').textContent = `₹${this.userProfile.inrBalance.toFixed(2)}`;
        document.getElementById('current-btc').textContent = this.userProfile.cryptoBalances.BTC.toFixed(8);
        document.getElementById('current-usdt').textContent = this.userProfile.cryptoBalances.USDT.toFixed(2);
        document.getElementById('current-bxc').textContent = this.userProfile.cryptoBalances.BXC.toFixed(2);
    }

    handleQuickTransfer(item) {
        const amount = parseFloat(item.dataset.amount);
        const currency = item.dataset.currency;
        
        document.getElementById('send-amount').value = amount;
        document.getElementById('currency-type').value = currency;
        
        // Update conversion info
        this.updateConversionInfo();
        
        // Scroll to form
        document.getElementById('send-money-form').scrollIntoView({ behavior: 'smooth' });
    }

    async searchUser() {
        const recipient = document.getElementById('recipient').value.trim();
        
        if (!recipient) {
            this.showNotification('Please enter recipient email or User ID', 'error');
            return;
        }
        
        try {
            // Search for user by email or ID
            let userQuery;
            if (recipient.includes('@')) {
                // Search by email
                userQuery = await db.collection('users').where('email', '==', recipient).get();
            } else {
                // Search by User ID
                userQuery = await db.collection('users').doc(recipient).get();
            }
            
            if (userQuery.empty && !userQuery.exists) {
                this.showNotification('User not found', 'error');
                return;
            }
            
            this.showNotification('User found!', 'success');
            
        } catch (error) {
            console.error('Search error:', error);
            this.showNotification('Error searching for user', 'error');
        }
    }

    updateConversionInfo() {
        const currency = document.getElementById('currency-type').value;
        const amount = parseFloat(document.getElementById('send-amount').value) || 0;
        
        if (currency && amount > 0) {
            if (currency === 'INR') {
                document.getElementById('send-conversion-info').textContent = `Sending ₹${amount.toFixed(2)}`;
            } else {
                const inrValue = amount * this.cryptoPrices[currency];
                document.getElementById('send-conversion-info').textContent = `≈ ₹${inrValue.toFixed(2)}`;
            }
        } else {
            document.getElementById('send-conversion-info').textContent = 'Select currency first';
        }
    }

    async handleSendMoney(e) {
        e.preventDefault();
        
        const recipient = document.getElementById('recipient').value.trim();
        const currency = document.getElementById('currency-type').value;
        const amount = parseFloat(document.getElementById('send-amount').value);
        const message = document.getElementById('send-message').value.trim();
        
        if (!recipient || !currency || !amount || amount <= 0) {
            this.showNotification('Please fill in all required fields with valid values', 'error');
            return;
        }
        
        // Validate balance
        if (currency === 'INR' && amount > this.userProfile.inrBalance) {
            this.showNotification('Insufficient INR balance', 'error');
            return;
        }
        
        if (currency !== 'INR' && amount > this.userProfile.cryptoBalances[currency]) {
            this.showNotification(`Insufficient ${currency} balance`, 'error');
            return;
        }
        
        try {
            await this.processSendMoney(recipient, currency, amount, message);
        } catch (error) {
            console.error('Send money error:', error);
            this.showNotification('Error sending money', 'error');
        }
    }

    async processSendMoney(recipient, currency, amount, message) {
        try {
            this.showNotification('Processing transfer...', 'info');
            
            // Find recipient user
            let recipientUser;
            if (recipient.includes('@')) {
                // Search by email
                const userQuery = await db.collection('users').where('email', '==', recipient).get();
                if (userQuery.empty) {
                    throw new Error('Recipient not found');
                }
                recipientUser = userQuery.docs[0].data();
            } else {
                // Search by User ID
                const userDoc = await db.collection('users').doc(recipient).get();
                if (!userDoc.exists) {
                    throw new Error('Recipient not found');
                }
                recipientUser = userDoc.data();
            }
            
            // Process the transfer
            if (currency === 'INR') {
                await this.processInrTransfer(amount, recipientUser);
            } else {
                await this.processCryptoTransfer(currency, amount, recipientUser);
            }
            
            // Log transaction for sender
            await this.logTransaction('send', amount, currency, `To: ${recipientUser.email}`, message);
            
            // Log transaction for receiver
            await this.logTransactionForReceiver('receive', amount, currency, `From: ${this.userProfile.email}`, message, recipientUser.userId);
            
            // Refresh transaction history if available
            if (window.refreshTransactionHistory) {
                window.refreshTransactionHistory();
            }
            
            this.showNotification(`Successfully sent ${amount} ${currency} to ${recipientUser.email}`, 'success');
            
            // Reset form
            document.getElementById('send-money-form').reset();
            
            // Reload profile
            await this.loadUserProfile();
            
        } catch (error) {
            console.error('Process send money error:', error);
            throw error;
        }
    }

    async processInrTransfer(amount, recipientUser) {
        // Deduct from sender
        const newSenderBalance = this.userProfile.inrBalance - amount;
        await db.collection('users').doc(this.currentUser.uid).update({
            inrBalance: newSenderBalance,
            updatedAt: new Date()
        });
        
        // Add to recipient
        const newRecipientBalance = (recipientUser.inrBalance || 0) + amount;
        await db.collection('users').doc(recipientUser.userId).update({
            inrBalance: newRecipientBalance,
            updatedAt: new Date()
        });
        
        // Update local profile
        this.userProfile.inrBalance = newSenderBalance;
    }

    async processCryptoTransfer(currency, amount, recipientUser) {
        // Deduct from sender
        const newSenderBalance = this.userProfile.cryptoBalances[currency] - amount;
        await db.collection('users').doc(this.currentUser.uid).update({
            [`cryptoBalances.${currency}`]: newSenderBalance,
            updatedAt: new Date()
        });
        
        // Add to recipient
        const newRecipientBalance = (recipientUser.cryptoBalances?.[currency] || 0) + amount;
        await db.collection('users').doc(recipientUser.userId).update({
            [`cryptoBalances.${currency}`]: newRecipientBalance,
            updatedAt: new Date()
        });
        
        // Update local profile
        this.userProfile.cryptoBalances[currency] = newSenderBalance;
    }

    async logTransaction(type, amount, currency, description, message = '') {
        try {
            await db.collection('transactions').add({
                userId: this.currentUser.uid,
                type: type,
                amount: amount,
                currency: currency,
                description: description,
                message: message,
                timestamp: new Date(),
                status: 'completed'
            });
            
            // Refresh the recent transfers after logging a new transaction
            this.loadRecentTransfers();
        } catch (error) {
            console.error('Error logging transaction:', error);
        }
    }

    async logTransactionForReceiver(type, amount, currency, description, message = '', receiverUserId) {
        try {
            await db.collection('transactions').add({
                userId: receiverUserId,
                type: type,
                amount: amount,
                currency: currency,
                description: description,
                message: message,
                timestamp: new Date(),
                status: 'completed'
            });
        } catch (error) {
            console.error('Error logging receiver transaction:', error);
        }
    }
    
    // Load recent transfers from Firebase
    async loadRecentTransfers() {
        try {
            const historyContainer = document.getElementById('transfer-history');
            if (!historyContainer) return;
            
            // Show loading state
            historyContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading recent transfers...</p>
                </div>
            `;
            
            // Fetch recent transfer transactions
            const snapshot = await db.collection('transactions')
                .where('userId', '==', this.currentUser.uid)
                .where('type', '==', 'send')
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
                        <i class="fas fa-paper-plane"></i>
                        <h3>No transfers yet</h3>
                        <p>Your transfer history will appear here once you send money to other users.</p>
                    </div>
                `;
                return;
            }
            
            // Build transaction list
            let transactionsHTML = '';
            snapshot.forEach(doc => {
                const transaction = doc.data();
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
                            <h4>Sent ${transaction.currency}</h4>
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
            console.error('Error loading recent transfers:', error);
            const historyContainer = document.getElementById('transfer-history');
            if (historyContainer) {
                historyContainer.innerHTML = `
                    <div class="no-transactions">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Error loading transfers</h3>
                        <p>Unable to load recent transfers. Please try again later.</p>
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
        const messageMap = {
            'completed': 'fas fa-check',
            'pending': 'fas fa-clock',
            'failed': 'fas fa-times',
            'processing': 'fas fa-spinner fa-spin'
        };
        return messageMap[status] || 'fas fa-clock';
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

// Initialize the send money page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const sendMoneyPage = new SendMoneyPage();
    
    // Make loadRecentTransfers available globally for integration
    window.loadRecentTransfers = () => sendMoneyPage.loadRecentTransfers();
});
