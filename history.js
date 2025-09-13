// History Page JavaScript
class HistoryPage {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.transactions = [];
        this.filteredTransactions = [];
        this.currentPage = 1;
        this.transactionsPerPage = 10;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthState();
        this.setupMobileMenu();
    }

    setupEventListeners() {
        // Filter controls
        document.getElementById('apply-filters-btn').addEventListener('click', () => this.applyFilters());
        
        // Search
        document.getElementById('search-transactions').addEventListener('input', () => this.handleSearch());
        
        // Refresh
        document.getElementById('refresh-btn').addEventListener('click', () => this.refreshTransactionHistory());
        
        // Export
        document.getElementById('export-btn').addEventListener('click', () => this.exportToCSV());
        
        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => this.previousPage());
        document.getElementById('next-page').addEventListener('click', () => this.nextPage());
        
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
                this.loadTransactions();
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
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.showNotification('Error loading profile', 'error');
        }
    }

    async loadTransactions() {
        try {
            // Load all transactions for the current user
            const querySnapshot = await db.collection('transactions')
                .where('userId', '==', this.currentUser.uid)
                .get();
            
            this.transactions = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp.toDate()
            }))
            .sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp descending
            
            this.filteredTransactions = [...this.transactions];
            this.updateStatistics();
            this.renderTransactions();
            this.updatePagination();
            this.updateTransactionCount();
            
        } catch (error) {
            console.error('Error loading transactions:', error);
            this.showNotification('Error loading transactions', 'error');
        }
    }

    updateStatistics() {
        const stats = {
            deposits: 0,
            withdrawals: 0,
            sent: 0,
            received: 0
        };
        
        this.transactions.forEach(transaction => {
            if (transaction.type === 'deposit') {
                stats.deposits += transaction.amount;
            } else if (transaction.type === 'withdrawal') {
                stats.withdrawals += transaction.amount;
            } else if (transaction.type === 'send') {
                stats.sent += transaction.amount;
            } else if (transaction.type === 'receive') {
                stats.received += transaction.amount;
            }
        });
        
        // Format amounts based on currency
        document.getElementById('total-deposits').textContent = this.formatStatAmount(stats.deposits);
        document.getElementById('total-withdrawals').textContent = this.formatStatAmount(stats.withdrawals);
        document.getElementById('total-sent').textContent = this.formatStatAmount(stats.sent);
        document.getElementById('total-received').textContent = this.formatStatAmount(stats.received);
    }

    formatStatAmount(amount) {
        // For now, assume all amounts are in INR for statistics
        // In a real app, you'd want to convert crypto amounts to INR
        return `₹${amount.toFixed(2)}`;
    }

    applyFilters() {
        const typeFilter = document.getElementById('transaction-type').value;
        const currencyFilter = document.getElementById('currency-filter').value;
        const dateRange = document.getElementById('date-range').value;
        const statusFilter = document.getElementById('status-filter').value;
        
        this.filteredTransactions = this.transactions.filter(transaction => {
            // Type filter
            if (typeFilter && transaction.type !== typeFilter) return false;
            
            // Currency filter
            if (currencyFilter && transaction.currency !== currencyFilter) return false;
            
            // Status filter
            if (statusFilter && transaction.status !== statusFilter) return false;
            
            // Date range filter
            if (dateRange && dateRange !== 'all') {
                const daysAgo = parseInt(dateRange);
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
                
                if (transaction.timestamp < cutoffDate) return false;
            }
            
            return true;
        });
        
        this.currentPage = 1;
        this.renderTransactions();
        this.updatePagination();
        this.updateTransactionCount();
    }

    handleSearch() {
        const searchTerm = document.getElementById('search-transactions').value.toLowerCase();
        
        if (!searchTerm) {
            this.filteredTransactions = [...this.transactions];
        } else {
            this.filteredTransactions = this.transactions.filter(transaction => {
                return (
                    transaction.description.toLowerCase().includes(searchTerm) ||
                    transaction.currency.toLowerCase().includes(searchTerm) ||
                    transaction.type.toLowerCase().includes(searchTerm) ||
                    transaction.amount.toString().includes(searchTerm)
                );
            });
        }
        
        this.currentPage = 1;
        this.renderTransactions();
        this.updatePagination();
        this.updateTransactionCount();
    }

    renderTransactions() {
        const startIndex = (this.currentPage - 1) * this.transactionsPerPage;
        const endIndex = startIndex + this.transactionsPerPage;
        const pageTransactions = this.filteredTransactions.slice(startIndex, endIndex);
        
        const tbody = document.getElementById('transactions-body');
        tbody.innerHTML = '';
        
        if (pageTransactions.length === 0) {
            tbody.innerHTML = `
                <div class="table-row" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                    <p>No transactions found</p>
                </div>
            `;
            return;
        }
        
        pageTransactions.forEach(transaction => {
            const row = this.createTransactionRow(transaction);
            tbody.appendChild(row);
        });
    }

    createTransactionRow(transaction) {
        const row = document.createElement('div');
        row.className = 'table-row';
        
        const date = this.formatDate(transaction.timestamp);
        const time = this.formatTime(transaction.timestamp);
        
        row.innerHTML = `
            <div class="table-cell" data-label="Date & Time">
                <div class="date-time">
                    <div class="date">${date}</div>
                    <div class="time">${time}</div>
                </div>
            </div>
            <div class="table-cell" data-label="Type">
                <span class="transaction-type ${transaction.type}">
                    ${this.getTransactionIcon(transaction.type)}
                    ${this.capitalizeFirst(transaction.type)}
                </span>
            </div>
            <div class="table-cell" data-label="Amount">
                <span class="amount">${this.formatAmount(transaction.amount, transaction.currency)}</span>
            </div>
            <div class="table-cell" data-label="Currency">
                <span class="currency">${transaction.currency}</span>
            </div>
            <div class="table-cell" data-label="From/To">
                <span class="user">${transaction.description}</span>
            </div>
            <div class="table-cell" data-label="Status">
                <span class="status ${transaction.status}">
                    ${this.getStatusIcon(transaction.status)}
                    ${this.capitalizeFirst(transaction.status)}
                </span>
            </div>
            <div class="table-cell" data-label="Actions">
                <button class="btn btn-sm btn-secondary" title="View Details" onclick="this.viewTransactionDetails('${transaction.id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        `;
        
        return row;
    }

    formatDate(timestamp) {
        const now = new Date();
        const diffTime = Math.abs(now - timestamp);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays - 1} days ago`;
        
        return timestamp.toLocaleDateString();
    }

    formatTime(timestamp) {
        return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatAmount(amount, currency) {
        if (currency === 'INR') {
            return `₹${amount.toFixed(2)}`;
        }
        return amount.toFixed(8);
    }

    getTransactionIcon(type) {
        const icons = {
            deposit: '<i class="fas fa-arrow-down"></i>',
            withdrawal: '<i class="fas fa-arrow-up"></i>',
            send: '<i class="fas fa-paper-plane"></i>',
            receive: '<i class="fas fa-inbox"></i>',
            transfer: '<i class="fas fa-exchange-alt"></i>'
        };
        return icons[type] || '<i class="fas fa-circle"></i>';
    }

    getStatusIcon(status) {
        const icons = {
            completed: '<i class="fas fa-check"></i>',
            pending: '<i class="fas fa-clock"></i>',
            failed: '<i class="fas fa-times"></i>',
            processing: '<i class="fas fa-spinner"></i>'
        };
        return icons[status] || '<i class="fas fa-circle"></i>';
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    updateTransactionCount() {
        const count = this.filteredTransactions.length;
        document.getElementById('transaction-count').textContent = `${count} transaction${count !== 1 ? 's' : ''}`;
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredTransactions.length / this.transactionsPerPage);
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const pageNumbers = document.querySelector('.page-numbers');
        
        prevBtn.disabled = this.currentPage === 1;
        nextBtn.disabled = this.currentPage === totalPages;
        
        // Update page numbers
        pageNumbers.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const pageNumber = document.createElement('span');
            pageNumber.className = `page-number ${i === this.currentPage ? 'active' : ''}`;
            pageNumber.textContent = i;
            pageNumber.addEventListener('click', () => this.goToPage(i));
            pageNumbers.appendChild(pageNumber);
        }
    }

    goToPage(page) {
        this.currentPage = page;
        this.renderTransactions();
        this.updatePagination();
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderTransactions();
            this.updatePagination();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredTransactions.length / this.transactionsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderTransactions();
            this.updatePagination();
        }
    }

    exportToCSV() {
        if (this.filteredTransactions.length === 0) {
            this.showNotification('No transactions to export', 'warning');
            return;
        }
        
        const headers = ['Date', 'Type', 'Amount', 'Currency', 'Description', 'Status'];
        const csvContent = [
            headers.join(','),
            ...this.filteredTransactions.map(t => [
                t.timestamp.toLocaleDateString(),
                t.type,
                t.amount,
                t.currency,
                t.description,
                t.status
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        this.showNotification('Transactions exported successfully!', 'success');
    }

    viewTransactionDetails(transactionId) {
        // In a real application, this would show a modal with detailed transaction info
        this.showNotification('Transaction details feature coming soon!', 'info');
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

    // Method to refresh transaction history (can be called from other pages)
    async refreshTransactionHistory() {
        await this.loadTransactions();
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

// Initialize the history page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const historyPage = new HistoryPage();
    
    // Make refresh method available globally for integration
    window.refreshTransactionHistory = () => historyPage.refreshTransactionHistory();
});
