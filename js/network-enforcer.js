// Network Enforcement Component
// Ensures users can only connect to Sepolia testnet

class NetworkEnforcer {
    constructor() {
        this.sepoliaChainId = 11155111;
        this.isEnforcing = false;
        this.init();
    }

    init() {
        // Check if MetaMask is available
        if (typeof window.ethereum !== 'undefined') {
            this.setupNetworkMonitoring();
            this.checkCurrentNetwork();
        }
    }

    setupNetworkMonitoring() {
        // Monitor network changes
        window.ethereum.on('chainChanged', async (chainId) => {
            console.log('Network changed to:', parseInt(chainId, 16));
            await this.handleNetworkChange(parseInt(chainId, 16));
        });

        // Monitor account changes
        window.ethereum.on('accountsChanged', (accounts) => {
            console.log('Account changed:', accounts[0]);
            this.checkCurrentNetwork();
        });
    }

    async checkCurrentNetwork() {
        try {
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            const currentChainId = parseInt(chainId, 16);
            
            if (currentChainId !== this.sepoliaChainId) {
                this.showNetworkWarning();
                await this.switchToSepolia();
            } else {
                this.hideNetworkWarning();
                console.log('✅ Connected to Sepolia testnet');
            }
        } catch (error) {
            console.error('Error checking network:', error);
        }
    }

    async handleNetworkChange(newChainId) {
        if (newChainId !== this.sepoliaChainId) {
            this.showNetworkWarning();
            this.showNotification('⚠️ Please connect to Sepolia testnet only', 'warning');
            await this.switchToSepolia();
        } else {
            this.hideNetworkWarning();
            this.showNotification('✅ Connected to Sepolia testnet', 'success');
        }
    }

    async switchToSepolia() {
        if (this.isEnforcing) return;
        
        this.isEnforcing = true;
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${this.sepoliaChainId.toString(16)}` }],
            });
        } catch (switchError) {
            if (switchError.code === 4902) {
                // Chain not added, add it
                await this.addSepoliaNetwork();
            } else {
                console.error('Failed to switch to Sepolia:', switchError);
                this.showNotification('❌ Failed to switch to Sepolia network', 'error');
            }
        } finally {
            this.isEnforcing = false;
        }
    }

    async addSepoliaNetwork() {
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: `0x${this.sepoliaChainId.toString(16)}`,
                    chainName: 'Sepolia Testnet',
                    nativeCurrency: {
                        name: 'Sepolia ETH',
                        symbol: 'ETH',
                        decimals: 18
                    },
                    rpcUrls: ['https://sepolia.infura.io/v3/your-project-id'],
                    blockExplorerUrls: ['https://sepolia.etherscan.io']
                }],
            });
            console.log('✅ Sepolia network added to MetaMask');
        } catch (addError) {
            console.error('Failed to add Sepolia network:', addError);
            this.showNotification('❌ Failed to add Sepolia network to MetaMask', 'error');
        }
    }

    showNetworkWarning() {
        let warning = document.getElementById('network-warning');
        if (!warning) {
            warning = this.createNetworkWarning();
        }
        warning.style.display = 'flex';
    }

    hideNetworkWarning() {
        const warning = document.getElementById('network-warning');
        if (warning) {
            warning.style.display = 'none';
        }
    }

    createNetworkWarning() {
        const warning = document.createElement('div');
        warning.id = 'network-warning';
        warning.className = 'network-warning';
        warning.innerHTML = `
            <div class="warning-content">
                <div class="warning-icon">⚠️</div>
                <div class="warning-text">
                    <h4>Wrong Network Detected</h4>
                    <p>This platform only works on Sepolia testnet. Please switch your wallet to Sepolia.</p>
                </div>
                <button class="btn btn-primary" id="switch-to-sepolia">Switch to Sepolia</button>
            </div>
        `;

        // Add event listener to switch button
        warning.querySelector('#switch-to-sepolia').addEventListener('click', () => {
            this.switchToSepolia();
        });

        // Add to page
        document.body.appendChild(warning);
        return warning;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        // Set color based on type
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
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

// Initialize network enforcer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.networkEnforcer = new NetworkEnforcer();
});

// Export for use in other files
window.NetworkEnforcer = NetworkEnforcer;
