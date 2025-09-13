// Contract Configuration for CryptoPay Platform
// Update these addresses after deploying your smart contracts

const CONTRACT_CONFIG = {
    // Network Configuration
    networks: {
        bscTestnet: {
            chainId: 97,
            name: 'BSC Testnet',
            rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
            explorer: 'https://testnet.bscscan.com'
        },
        bscMainnet: {
            chainId: 56,
            name: 'BSC Mainnet',
            rpcUrl: 'https://bsc-dataseed.binance.org/',
            explorer: 'https://bscscan.com'
        },
        sepolia: {
            chainId: 11155111,
            name: 'Sepolia Testnet',
            rpcUrl: 'https://sepolia.infura.io/v3/your-project-id',
            explorer: 'https://sepolia.etherscan.io'
        }
    },

    // Contract Addresses (Updated with v2.0.0 deployment)
    contracts: {
        cryptoWallet: '0x981276d58f5f3e0e12591792fb0c661dda4efb25', // CryptoWallet v2.0.0 deployed on Sepolia
        usdt: '0x7169d38820dfd117c3fa1f2a5376148b2a5e7e3e', // USDT on Sepolia (fixed checksum)
        bxc: '0x5e4fd39a51aff44d437c2988e163c6880e819a6d'  // BXC Token deployed on Sepolia
    },

    // Token Information
    tokens: {
        USDT: {
            name: 'Tether USD',
            symbol: 'USDT',
            decimals: 18,
            address: '0x7169d38820dfd117c3fa1f2a5376148b2a5e7e3e' // USDT on Sepolia (fixed checksum)
        },
        BXC: {
            name: 'BXC Token',
            symbol: 'BXC',
            decimals: 18,
            address: '0x5e4fd39a51aff44d437c2988e163c6880e819a6d' // BXC Token deployed on Sepolia
        }
    },

    // Default Network
    defaultNetwork: 'sepolia',

    // Gas Settings
    gas: {
        defaultGasLimit: 300000,
        defaultGasPrice: '20000000000' // 20 Gwei
    }
};

// Export for use in other files
window.CONTRACT_CONFIG = CONTRACT_CONFIG;
