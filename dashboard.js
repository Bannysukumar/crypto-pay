// Dashboard JavaScript
class Dashboard {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.cryptoPrices = {
            BTC: 0,
            USDT: 0,
            BXC: 0
        };
        this.priceRefreshInterval = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.checkAuthState();
        this.setupMobileMenu();
        this.initializeCryptoPrices();
        await this.initWeb3();
    }

    setupEventListeners() {
        // Navigation cards
        document.getElementById('deposit-nav').addEventListener('click', () => this.handleDeposit());
        document.getElementById('withdraw-nav').addEventListener('click', () => this.handleWithdraw());
        document.getElementById('send-nav').addEventListener('click', () => this.handleSendMoney());
        document.getElementById('history-nav').addEventListener('click', () => this.handleHistory());
        
        // Action buttons
        document.getElementById('deposit-btn').addEventListener('click', () => this.handleDeposit());
        document.getElementById('withdraw-btn').addEventListener('click', () => this.handleWithdraw());
        document.getElementById('transfer-btn').addEventListener('click', () => this.handleTransfer());
        
        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());
        
        // Conversion inputs
        document.getElementById('inr-input').addEventListener('input', () => this.updateInrToCrypto());
        document.getElementById('inr-crypto-select').addEventListener('change', () => this.updateInrToCrypto());
        document.getElementById('crypto-input').addEventListener('input', () => this.updateCryptoToInr());
        document.getElementById('crypto-type-select').addEventListener('change', () => this.updateCryptoToInr());
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
                console.log('User profile loaded:', this.userProfile);
                
                // Validate balances immediately after loading profile
                if (window.web3Manager) {
                    await window.web3Manager.validateUserBalances();
                }
                
                this.updateDashboardBalances();
            } else {
                // Create new user profile
                await this.createUserProfile();
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.showNotification('Error loading profile', 'error');
        }
    }

    async createUserProfile() {
        try {
            const userProfile = {
                userId: this.currentUser.uid,
                email: this.currentUser.email,
                walletAddress: this.generateWalletAddress(),
                inrBalance: 0,
                cryptoBalances: {
                    BTC: 0,
                    USDT: 0,
                    BXC: 0
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await db.collection('users').doc(this.currentUser.uid).set(userProfile);
            this.userProfile = userProfile;
            this.updateDashboardBalances();
        } catch (error) {
            console.error('Error creating user profile:', error);
            this.showNotification('Error creating profile', 'error');
        }
    }

    generateWalletAddress() {
        // Generate a realistic BEP-20 wallet address for BNB Chain
        const chars = '0123456789abcdef';
        let address = '0x';
        for (let i = 0; i < 40; i++) {
            address += chars[Math.floor(Math.random() * chars.length)];
        }
        return address;
    }

    updateDashboardBalances() {
        if (!this.userProfile) return;
        
        document.getElementById('inr-balance').textContent = `₹${this.userProfile.inrBalance.toFixed(2)}`;
        document.getElementById('btc-balance').textContent = this.userProfile.cryptoBalances.BTC.toFixed(8);
        document.getElementById('usdt-balance').textContent = this.userProfile.cryptoBalances.USDT.toFixed(2);
        document.getElementById('bxc-balance').textContent = this.userProfile.cryptoBalances.BXC.toFixed(2);
        
        // Update INR equivalents
        this.updateBalanceInrEquivalents();
    }

    // Crypto Price Management
    async initializeCryptoPrices() {
        await this.fetchCryptoPrices();
        this.startPriceRefresh();
    }

    async fetchCryptoPrices() {
        try {
            if (window.cryptoPriceAPI && typeof window.cryptoPriceAPI.forceRefresh === 'function') {
                await window.cryptoPriceAPI.forceRefresh();
                const prices = window.cryptoPriceAPI.getAllPrices();
                this.cryptoPrices = {
                    BTC: prices?.BTC?.INR || 4500000,
                    USDT: prices?.USDT?.INR || 83,
                    BXC: prices?.BXC?.INR || 25
                };
            } else {
                // Fallback to direct fetch (may be blocked by CORS)
                try {
                    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether&vs_currencies=inr', {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'CryptoWallet/1.0'
                        },
                        signal: AbortSignal.timeout(8000)
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        this.cryptoPrices = {
                            BTC: data.bitcoin?.inr || 4500000,
                            USDT: data.tether?.inr || 83,
                            BXC: 25
                        };
                    } else {
                        throw new Error(`HTTP ${response.status}`);
                    }
                } catch (error) {
                    console.warn('CoinGecko fallback failed, using default prices:', error.message);
                    this.cryptoPrices = { BTC: 4500000, USDT: 83, BXC: 25 };
                }
            }

            this.updateInrToCrypto();
            this.updateCryptoToInr();
            this.updatePriceDisplay();
        } catch (error) {
            console.error('Error fetching crypto prices:', error);
            this.cryptoPrices = { BTC: 4500000, USDT: 83, BXC: 25 };
        }
    }

    startPriceRefresh() {
        // Refresh prices every 60 seconds to avoid rate limiting
        this.priceRefreshInterval = setInterval(() => {
            this.fetchCryptoPrices();
            this.updateBalanceInrEquivalents();
        }, 60000);
    }

    stopPriceRefresh() {
        if (this.priceRefreshInterval) {
            clearInterval(this.priceRefreshInterval);
            this.priceRefreshInterval = null;
        }
    }

    updateBalanceInrEquivalents() {
        if (!this.userProfile) return;
        
        const btcInr = this.userProfile.cryptoBalances.BTC * this.cryptoPrices.BTC;
        const usdtInr = this.userProfile.cryptoBalances.USDT * this.cryptoPrices.USDT;
        const bxcInr = this.userProfile.cryptoBalances.BXC * this.cryptoPrices.BXC;
        
        document.getElementById('btc-inr').textContent = `₹${btcInr.toFixed(2)}`;
        document.getElementById('usdt-inr').textContent = `₹${usdtInr.toFixed(2)}`;
        document.getElementById('bxc-inr').textContent = `₹${bxcInr.toFixed(2)}`;
    }

    updateInrToCrypto() {
        const inrAmount = parseFloat(document.getElementById('inr-input').value) || 0;
        const selectedCrypto = document.getElementById('inr-crypto-select').value;
        
        if (inrAmount > 0 && this.cryptoPrices[selectedCrypto] > 0) {
            const cryptoAmount = inrAmount / this.cryptoPrices[selectedCrypto];
            document.getElementById('inr-crypto-result').textContent = cryptoAmount.toFixed(8);
            document.getElementById('inr-crypto-symbol').textContent = selectedCrypto;
        } else {
            document.getElementById('inr-crypto-result').textContent = '0.00';
            document.getElementById('inr-crypto-symbol').textContent = selectedCrypto;
        }
    }

    updateCryptoToInr() {
        const cryptoAmount = parseFloat(document.getElementById('crypto-input').value) || 0;
        const selectedCrypto = document.getElementById('crypto-type-select').value;
        
        if (cryptoAmount > 0 && this.cryptoPrices[selectedCrypto] > 0) {
            const inrAmount = cryptoAmount * this.cryptoPrices[selectedCrypto];
            document.getElementById('crypto-inr-result').textContent = `₹${inrAmount.toFixed(2)}`;
        } else {
            document.getElementById('crypto-inr-result').textContent = '₹0.00';
        }
    }

    updatePriceDisplay() {
        // Update live price display on dashboard
        const priceElements = document.querySelectorAll('.live-price');
        priceElements.forEach(element => {
            const crypto = element.dataset.crypto;
            if (crypto && this.cryptoPrices[crypto]) {
                element.textContent = `₹${this.cryptoPrices[crypto].toLocaleString()}`;
            }
        });
    }

    // Navigation Handlers
    handleDeposit() {
        window.location.href = 'deposit.html';
    }

    handleWithdraw() {
        window.location.href = 'withdraw.html';
    }

    handleSendMoney() {
        window.location.href = 'send.html';
    }

    handleHistory() {
        window.location.href = 'history.html';
    }

    handleTransfer() {
        window.location.href = 'send.html';
    }

    async handleLogout() {
        try {
            this.stopPriceRefresh();
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

    // Web3 Integration Methods
    async initWeb3() {
        // Initialize Web3 functionality with retry mechanism
        let retries = 0;
        const maxRetries = 10;
        
        while (!window.web3Manager && retries < maxRetries) {
            console.log(`Waiting for Web3 Manager to initialize... (attempt ${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 500));
            retries++;
        }
        
        if (window.web3Manager) {
            this.web3Manager = window.web3Manager;
            this.setupWalletConnection();
            console.log('Web3 Manager initialized successfully');
        } else {
            console.error('Web3 Manager failed to initialize after multiple attempts');
            this.showNotification('Web3 Manager initialization failed', 'error');
        }
    }

    setupWalletConnection() {
        const connectBtn = document.getElementById('connect-wallet-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                this.connectWallet();
            });
        }
    }

    async connectWallet() {
        try {
            if (this.web3Manager) {
                await this.web3Manager.connectWallet();
                this.updateWalletStatus();
                
                // Enforce Sepolia connection after wallet is connected
                await this.enforceSepoliaConnection();
            }
        } catch (error) {
            console.error('Wallet connection error:', error);
            this.showNotification('Failed to connect wallet', 'error');
        }
    }

    updateWalletStatus() {
        if (this.web3Manager && this.web3Manager.isConnected) {
            const statusElement = document.getElementById('wallet-status');
            const networkElement = document.getElementById('network-status');
            
            if (statusElement) {
                statusElement.textContent = `Connected: ${this.web3Manager.userAccount.slice(0, 6)}...${this.web3Manager.userAccount.slice(-4)}`;
                statusElement.className = 'wallet-status connected';
            }
            
            if (networkElement) {
                const networkStatus = this.web3Manager.getNetworkStatus();
                networkElement.textContent = networkStatus;
                
                if (networkStatus === 'Connected to Sepolia') {
                    networkElement.style.background = 'rgba(16, 185, 129, 0.1)';
                    networkElement.style.color = '#10b981';
                    networkElement.style.borderColor = '#10b981';
                } else if (networkStatus === 'Wrong Network') {
                    networkElement.style.background = 'rgba(239, 68, 68, 0.1)';
                    networkElement.style.color = '#ef4444';
                    networkElement.style.borderColor = '#ef4444';
                }
            }
        }
    }

    async enforceSepoliaConnection() {
        if (this.web3Manager && this.web3Manager.isConnected) {
            const isSepolia = await this.web3Manager.enforceSepoliaNetwork();
            if (!isSepolia) {
                this.showNotification('⚠️ Please connect to Sepolia testnet to use this platform', 'warning');
            }
            return isSepolia;
        }
        return false;
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

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});
