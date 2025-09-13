// Web3.js Integration for Blockchain Interactions
class Web3Manager {
    constructor() {
        this.web3 = null;
        this.contract = null;
        this.userAccount = null;
        this.contractAddress = window.CONTRACT_CONFIG?.contracts?.cryptoWallet || '0x0000000000000000000000000000000000000000';
        this.contractABI = null;
        this.isConnected = false;
        
        this.init();
    }
    
    async init() {
        try {
            // Check if MetaMask is installed
            if (typeof window.ethereum !== 'undefined') {
                await this.connectWallet();
                await this.loadContract();
                
                // Start monitoring transactions if wallet is connected
                if (this.isConnected && !window.DISABLE_TX_MONITORING) {
                    this.startTransactionMonitoring();
                }
            } else {
                console.warn('MetaMask not found. Please install MetaMask to use blockchain features.');
                this.showNotification('MetaMask not found. Please install MetaMask to use blockchain features.', 'warning');
            }
        } catch (error) {
            console.error('Web3 initialization error:', error);
        }
    }
    
    async connectWallet() {
        try {
            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.userAccount = accounts[0];
            
            // Create Web3 instance
            this.web3 = new Web3(window.ethereum);
            
            // Check and switch to correct network
            await this.checkAndSwitchNetwork();
            
            // Listen for account changes
            window.ethereum.on('accountsChanged', (accounts) => {
                this.userAccount = accounts[0];
                this.updateUI();
            });
            
            // Listen for chain changes
            window.ethereum.on('chainChanged', async (chainId) => {
                const sepoliaChainId = window.CONTRACT_CONFIG?.networks?.sepolia?.chainId || 11155111;
                if (parseInt(chainId, 16) !== sepoliaChainId) {
                    console.log('❌ User switched to wrong network, redirecting to Sepolia...');
                    this.showNotification('Please connect to Sepolia testnet only. Switching network...', 'warning');
                    await this.checkAndSwitchNetwork();
                }
            });
            
            this.isConnected = true;
            console.log('Wallet connected:', this.userAccount);
            
            // Start monitoring transactions (disabled in certain contexts)
            if (!window.DISABLE_TX_MONITORING) {
                this.startTransactionMonitoring();
            }
            
        } catch (error) {
            console.error('Wallet connection error:', error);
            this.showNotification('Failed to connect wallet', 'error');
        }
    }

    async checkAndSwitchNetwork() {
        try {
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            const targetChainId = window.CONTRACT_CONFIG?.networks?.sepolia?.chainId || 11155111;
            
            if (parseInt(chainId, 16) !== targetChainId) {
                console.log('Wrong network detected, switching to Sepolia...');
                await this.switchNetwork(targetChainId);
            } else {
                console.log('✅ Connected to Sepolia testnet');
            }
        } catch (error) {
            console.error('Network check error:', error);
        }
    }

    async switchNetwork(chainId) {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${chainId.toString(16)}` }],
            });
        } catch (switchError) {
            // This error code indicates that the chain has not been added to MetaMask
            if (switchError.code === 4902) {
                await this.addNetwork(chainId);
            }
        }
    }

    async addNetwork(chainId) {
        const networkConfig = window.CONTRACT_CONFIG?.networks?.sepolia;
        if (!networkConfig) return;
        
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: `0x${chainId.toString(16)}`,
                    chainName: networkConfig.name,
                    nativeCurrency: {
                        name: 'Sepolia ETH',
                        symbol: 'ETH',
                        decimals: 18
                    },
                    rpcUrls: [networkConfig.rpcUrl],
                    blockExplorerUrls: [networkConfig.explorer]
                }],
            });
            console.log('✅ Sepolia network added to MetaMask');
        } catch (addError) {
            console.error('Failed to add Sepolia network:', addError);
            this.showNotification('Failed to add Sepolia network to MetaMask', 'error');
        }
    }
    
    async loadContract() {
        try {
            if (!this.web3 || !this.contractAddress) {
                throw new Error('Web3 or contract address not available');
            }
            
            // Wait for ABI to be available
            let retries = 0;
            const maxRetries = 10;
            
            while (!window.CRYPTO_WALLET_ABI && retries < maxRetries) {
                console.log(`Waiting for contract ABI to load... (attempt ${retries + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 500));
                retries++;
            }
            
            if (!window.CRYPTO_WALLET_ABI) {
                throw new Error('Contract ABI failed to load after multiple attempts');
            }
            
            // In production, you'll load the actual compiled ABI
            this.contractABI = this.getContractABI();
            
            // Create contract instance
            this.contract = new this.web3.eth.Contract(this.contractABI, this.contractAddress);
            
            console.log('Contract loaded successfully');
            
        } catch (error) {
            console.error('Contract loading error:', error);
        }
    }

    async enforceSepoliaNetwork() {
        try {
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            const sepoliaChainId = window.CONTRACT_CONFIG?.networks?.sepolia?.chainId || 11155111;
            
            if (parseInt(chainId, 16) !== sepoliaChainId) {
                this.showNotification('⚠️ Please connect to Sepolia testnet to use this platform', 'warning');
                await this.checkAndSwitchNetwork();
                return false;
            }
            return true;
        } catch (error) {
            console.error('Network enforcement error:', error);
            return false;
        }
    }

    getNetworkStatus() {
        if (!this.web3) return 'Not Connected';
        
        const chainId = window.ethereum.chainId;
        const sepoliaChainId = window.CONTRACT_CONFIG?.networks?.sepolia?.chainId || 11155111;
        
        if (parseInt(chainId, 16) === sepoliaChainId) {
            return 'Connected to Sepolia';
        } else {
            return 'Wrong Network';
        }
    }
    
    getContractABI() {
        // Use the ABI from the contract-abi.js file
        if (window.CRYPTO_WALLET_ABI) {
            return window.CRYPTO_WALLET_ABI;
        }
        
        // Fallback to basic ABI if the file is not loaded
        console.warn('Contract ABI not loaded, using fallback');
        return [
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "token",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "amount",
                        "type": "uint256"
                    }
                ],
                "name": "depositCrypto",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ];
    }
    
    // Blockchain Operations
    
    async depositCrypto(tokenAddress, amount) {
        try {
            if (!this.isConnected || !this.contract) {
                throw new Error('Wallet not connected or contract not loaded');
            }
            
            // First approve the contract to spend tokens
            const tokenContract = new this.web3.eth.Contract(this.getERC20ABI(), tokenAddress);
            await tokenContract.methods.approve(this.contractAddress, amount).send({ from: this.userAccount });
            
            // Then deposit
            const result = await this.contract.methods.depositCrypto(tokenAddress, amount).send({ from: this.userAccount });
            
            console.log('Deposit successful:', result);
            this.showNotification('Crypto deposit successful!', 'success');
            
            return result;
            
        } catch (error) {
            console.error('Deposit error:', error);
            this.showNotification('Deposit failed: ' + error.message, 'error');
            throw error;
        }
    }
    
    async withdrawCrypto(tokenAddress, amount) {
        try {
            if (!this.isConnected || !this.contract) {
                throw new Error('Wallet not connected or contract not loaded');
            }
            
            // Create unique withdrawal identifier to prevent duplicates
            const withdrawalId = `withdrawal-${this.userAccount}-${tokenAddress}-${amount}-${Date.now()}`;
            
            // Check if this withdrawal is already in progress
            if (this.processedTransactions.has(withdrawalId)) {
                console.log('Withdrawal already in progress:', withdrawalId);
                this.showNotification('Withdrawal already in progress, please wait...', 'warning');
                return;
            }
            
            // Mark withdrawal as in progress
            this.processedTransactions.add(withdrawalId);
            
            console.log('Processing withdrawal:', withdrawalId);
            
            const result = await this.contract.methods.withdrawCrypto(tokenAddress, amount).send({ from: this.userAccount });
            
            console.log('Withdrawal successful:', result);
            
            // Remove from processed transactions after successful completion
            this.processedTransactions.delete(withdrawalId);
            
            // Update balance immediately to prevent duplicate updates
            await this.updateUserCryptoBalanceAfterWithdrawal(tokenAddress, amount);
            
            this.showNotification('Crypto withdrawal successful!', 'success');
            
            return result;
            
        } catch (error) {
            console.error('Withdrawal error:', error);
            
            // Remove from processed transactions on error
            const withdrawalId = `withdrawal-${this.userAccount}-${tokenAddress}-${amount}-${Date.now()}`;
            this.processedTransactions.delete(withdrawalId);
            
            this.showNotification('Withdrawal failed: ' + error.message, 'error');
            throw error;
        }
    }
    
    async transferCrypto(toAddress, tokenAddress, amount) {
        try {
            if (!this.isConnected || !this.contract) {
                throw new Error('Wallet not connected or contract not loaded');
            }
            
            const result = await this.contract.methods.transferCrypto(toAddress, tokenAddress, amount).send({ from: this.userAccount });
            
            console.log('Transfer successful:', result);
            this.showNotification('Crypto transfer successful!', 'success');
            
            return result;
            
        } catch (error) {
            console.error('Transfer error:', error);
            this.showNotification('Transfer failed: ' + error.message, 'error');
            throw error;
        }
    }
    
    async getCryptoBalance(tokenAddress) {
        try {
            if (!this.isConnected || !this.contract) {
                return 0;
            }
            
            // Validate address before calling contract
            let validatedAddress;
            try {
                validatedAddress = this.web3.utils.toChecksumAddress(tokenAddress);
            } catch (error) {
                console.error('Invalid token address:', tokenAddress, error);
                return 0;
            }
            
            const balance = await this.contract.methods.getCryptoBalance(this.userAccount, validatedAddress).call();
            return this.web3.utils.fromWei(balance, 'ether');
            
        } catch (error) {
            console.error('Balance fetch error:', error);
            return 0;
        }
    }

    // Track processed transactions to prevent duplicates
    processedTransactions = new Set();

    // Track INR operations to prevent duplicates
    inrOperations = new Set();

    // Monitor incoming transactions and update balances
    async monitorIncomingTransactions() {
        if (!this.isConnected || !this.contract) {
            return;
        }

        try {
            console.log('Starting transaction monitoring...');
            
            // Get the latest block number
            const latestBlock = await this.web3.eth.getBlockNumber();
            console.log('Latest block:', latestBlock);
            
            // Monitor the last 1000 blocks for transactions
            const fromBlock = Math.max(0, latestBlock - 1000);
            console.log('Monitoring from block:', fromBlock, 'to block:', latestBlock);
            
            // Get all Deposit events from the contract
            console.log('Checking for Deposit events...');
            const depositEvents = await this.contract.getPastEvents('Deposit', {
                fromBlock: fromBlock,
                toBlock: 'latest',
                filter: { user: this.userAccount }
            });

            console.log('Found deposit events:', depositEvents);

            // Process each deposit event (with duplicate prevention)
            for (const event of depositEvents) {
                await this.processDepositEvent(event);
            }

            // Get all Withdraw events from the contract
            console.log('Checking for Withdraw events...');
            const withdrawEvents = await this.contract.getPastEvents('Withdraw', {
                fromBlock: fromBlock,
                toBlock: 'latest',
                filter: { user: this.userAccount }
            });

            console.log('Found withdraw events:', withdrawEvents);

            // Process each withdraw event (with duplicate prevention)
            for (const event of withdrawEvents) {
                await this.processWithdrawEvent(event);
            }

            // Also check for direct token transfers to the contract
            console.log('Checking for direct token transfers...');
            await this.checkDirectTokenTransfers(fromBlock, latestBlock);

        } catch (error) {
            console.error('Error monitoring transactions:', error);
        }
    }

    // Check for direct token transfers to the contract address
    async checkDirectTokenTransfers(fromBlock, toBlock) {
        try {
            console.log('Checking USDT transfers to contract:', CONTRACT_CONFIG.contracts.usdt);
            console.log('Checking BXC transfers to contract:', CONTRACT_CONFIG.contracts.bxc);
            console.log('Contract address:', this.contractAddress);
            
            // Validate addresses before creating contracts
            let usdtAddress, bxcAddress;
            try {
                usdtAddress = this.web3.utils.toChecksumAddress(CONTRACT_CONFIG.contracts.usdt);
                bxcAddress = this.web3.utils.toChecksumAddress(CONTRACT_CONFIG.contracts.bxc);
                console.log('Validated USDT address:', usdtAddress);
                console.log('Validated BXC address:', bxcAddress);
            } catch (error) {
                console.error('Address validation failed:', error);
                return;
            }
            
            // Get all Transfer events from USDT and BXC tokens
            const usdtContract = new this.web3.eth.Contract(this.getERC20ABI(), usdtAddress);
            const bxcContract = new this.web3.eth.Contract(this.getERC20ABI(), bxcAddress);

            // Check USDT transfers to the contract
            console.log('Querying USDT Transfer events...');
            const usdtTransfers = await usdtContract.getPastEvents('Transfer', {
                fromBlock: fromBlock,
                toBlock: toBlock,
                filter: { to: this.contractAddress }
            });

            // Check BXC transfers to the contract
            console.log('Querying BXC Transfer events...');
            const bxcTransfers = await bxcContract.getPastEvents('Transfer', {
                fromBlock: fromBlock,
                toBlock: toBlock,
                filter: { to: this.contractAddress }
            });

            console.log('Found USDT transfers:', usdtTransfers);
            console.log('Found BXC transfers:', bxcTransfers);

            // Process USDT transfers
            for (const transfer of usdtTransfers) {
                await this.processDirectTokenTransfer(transfer, 'USDT');
            }

            // Process BXC transfers
            for (const transfer of bxcTransfers) {
                await this.processDirectTokenTransfer(transfer, 'BXC');
            }

        } catch (error) {
            console.error('Error checking direct token transfers:', error);
        }
    }

    // Process direct token transfers
    async processDirectTokenTransfer(transfer, tokenType) {
        try {
            const { from, to, value } = transfer.returnValues;
            
            // Check if this transfer is to our contract
            if (to.toLowerCase() !== this.contractAddress.toLowerCase()) {
                return;
            }

            // Create unique transaction identifier
            const txId = `${transfer.transactionHash}-${from}-${to}-${value}-${tokenType}`;
            
            // Check if this transaction was already processed
            if (this.processedTransactions.has(txId)) {
                console.log('Skipping duplicate direct transfer:', txId);
                return;
            }

            console.log(`Processing direct ${tokenType} transfer:`, { from, to, value, txId });

            // Convert amount from Wei to Ether
            const amountInEther = this.web3.utils.fromWei(value, 'ether');
            
            // Update user balance in Firestore if this is the current user
            if (from.toLowerCase() === this.userAccount.toLowerCase()) {
                await this.updateUserCryptoBalance(tokenType, parseFloat(amountInEther));
                await this.logTransaction('deposit', parseFloat(amountInEther), tokenType, 'Direct token transfer to contract', transfer.transactionHash);
                
                // Mark transaction as processed
                this.processedTransactions.add(txId);
                
                this.showNotification(`${tokenType} transfer detected: ${amountInEther}`, 'success');
            }

        } catch (error) {
            console.error('Error processing direct token transfer:', error);
        }
    }

    // Handle direct crypto deposit (when user sends tokens directly to contract)
    async handleDirectCryptoDeposit(tokenAddress, amount) {
        try {
            if (!this.isConnected) {
                throw new Error('Wallet not connected');
            }

            console.log('Handling direct crypto deposit:', { tokenAddress, amount });

            // Determine token type
            let tokenType = 'UNKNOWN';
            if (tokenAddress.toLowerCase() === CONTRACT_CONFIG.contracts.usdt.toLowerCase()) {
                tokenType = 'USDT';
            } else if (tokenAddress.toLowerCase() === CONTRACT_CONFIG.contracts.bxc.toLowerCase()) {
                tokenType = 'BXC';
            }

            if (tokenType === 'UNKNOWN') {
                throw new Error('Unsupported token');
            }

            // First approve the contract to spend tokens
            const tokenContract = new this.web3.eth.Contract(this.getERC20ABI(), tokenAddress);
            
            console.log('Approving token spend...');
            await tokenContract.methods.approve(this.contractAddress, amount).send({ from: this.userAccount });
            
            console.log('Token spend approved, calling depositCrypto...');
            
            // Then call the contract's depositCrypto function
            const result = await this.contract.methods.depositCrypto(tokenAddress, amount).send({ from: this.userAccount });
            
            console.log('Direct deposit successful:', result);
            this.showNotification(`${tokenType} deposit successful!`, 'success');
            
            // Update balance immediately
            await this.refreshAllBalances();
            
            return result;
            
        } catch (error) {
            console.error('Direct deposit error:', error);
            this.showNotification('Direct deposit failed: ' + error.message, 'error');
            throw error;
        }
    }

    // Process a deposit event and update user balance
    async processDepositEvent(event) {
        try {
            const { user, token, amount, timestamp } = event.returnValues;
            
            // Check if this is the current user
            if (user.toLowerCase() !== this.userAccount.toLowerCase()) {
                return;
            }

            // Create unique transaction identifier
            const txId = `${event.transactionHash}-${user}-${token}-${amount}`;
            
            // Check if this transaction was already processed
            if (this.processedTransactions.has(txId)) {
                console.log('Skipping duplicate deposit event:', txId);
                return;
            }

            console.log('Processing deposit event:', { user, token, amount, timestamp, txId });

            // Convert amount from Wei to Ether
            const amountInEther = this.web3.utils.fromWei(amount, 'ether');
            
            // Determine token type
            let tokenType = 'UNKNOWN';
            if (token.toLowerCase() === CONTRACT_CONFIG.contracts.usdt.toLowerCase()) {
                tokenType = 'USDT';
            } else if (token.toLowerCase() === CONTRACT_CONFIG.contracts.bxc.toLowerCase()) {
                tokenType = 'BXC';
            }

            if (tokenType === 'UNKNOWN') {
                console.warn('Unknown token address:', token);
                return;
            }

            // Update user profile in Firestore
            await this.updateUserCryptoBalance(tokenType, parseFloat(amountInEther));
            // Log history entry for deposit
            await this.logTransaction('deposit', parseFloat(amountInEther), tokenType, 'On-chain deposit', event.transactionHash);
            
            // Mark transaction as processed
            this.processedTransactions.add(txId);
            
            // Show notification
            this.showNotification(`${tokenType} deposit detected: ${amountInEther}`, 'success');

        } catch (error) {
            console.error('Error processing deposit event:', error);
        }
    }

    // Process a withdraw event and update user balance
    async processWithdrawEvent(event) {
        try {
            const { user, token, amount, timestamp } = event.returnValues;
            
            // Check if this is the current user
            if (user.toLowerCase() !== this.userAccount.toLowerCase()) {
                return;
            }

            // Create unique transaction identifier
            const txId = `${event.transactionHash}-${user}-${token}-${amount}-withdraw`;
            
            // Check if this transaction was already processed
            if (this.processedTransactions.has(txId)) {
                console.log('Skipping duplicate withdraw event:', txId);
                return;
            }

            console.log('Processing withdraw event:', { user, token, amount, timestamp, txId });

            // Convert amount from Wei to Ether
            const amountInEther = this.web3.utils.fromWei(amount, 'ether');
            
            // Determine token type
            let tokenType = 'UNKNOWN';
            if (token.toLowerCase() === CONTRACT_CONFIG.contracts.usdt.toLowerCase()) {
                tokenType = 'USDT';
            } else if (token.toLowerCase() === CONTRACT_CONFIG.contracts.bxc.toLowerCase()) {
                tokenType = 'BXC';
            }

            if (tokenType === 'UNKNOWN') {
                console.warn('Unknown token address:', token);
                return;
            }

            // Log history entry for withdrawal
            await this.logTransaction('withdraw', parseFloat(amountInEther), tokenType, 'On-chain withdrawal', event.transactionHash);
            
            // Mark transaction as processed
            this.processedTransactions.add(txId);
            
            // Show notification
            this.showNotification(`${tokenType} withdrawal detected: ${amountInEther}`, 'success');

        } catch (error) {
            console.error('Error processing withdraw event:', error);
        }
    }

    // Set current user for Firestore operations
    setCurrentUser(user) {
        this.currentUser = user;
        console.log('Web3Manager: Current user set to:', user?.uid);
        
        // If user is set and wallet is connected, immediately sync balances
        if (user && this.isConnected) {
            this.syncUserBalancesOnLogin();
        }
    }
    
    // Sync user balances immediately after login to prevent 0 balance flash
    async syncUserBalancesOnLogin() {
        try {
            if (!this.currentUser || !this.isConnected) {
                console.log('Cannot sync balances: user not set or wallet not connected');
                return;
            }
            
            console.log('🔄 Syncing user balances after login...');
            
            // First, get current Firestore balances
            const userRef = db.collection('users').doc(this.currentUser.uid);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                console.log('User document not found, cannot sync balances');
                return;
            }
            
            const userData = userDoc.data();
            const currentBalances = userData.cryptoBalances || {};
            const currentInrBalance = userData.inrBalance || 0;
            
            console.log('Current Firestore balances:', currentBalances, 'INR:', currentInrBalance);
            
            // If balances are 0 or undefined, force refresh from blockchain
            const needsRefresh = !currentBalances.BXC || !currentBalances.USDT || 
                               currentBalances.BXC === 0 || currentBalances.USDT === 0;
            
            if (needsRefresh) {
                console.log('⚠️ Detected zero/undefined balances, refreshing from blockchain...');
                await this.refreshAllBalances();
            } else {
                console.log('✅ Balances look good, starting transaction monitoring...');
                // Start monitoring to catch any pending transactions
                this.startTransactionMonitoring();
            }
            
            // Always check for pending deposits
            await this.checkForPendingDeposits();
            
        } catch (error) {
            console.error('Error syncing balances on login:', error);
            // Fallback: try to refresh balances anyway
            try {
                await this.refreshAllBalances();
            } catch (fallbackError) {
                console.error('Fallback balance refresh also failed:', fallbackError);
            }
        }
    }

    // Log a crypto transaction to Firestore history
    async logTransaction(type, amount, currency, description = '', txHash = '') {
        try {
            if (!this.currentUser) return;
            
            // Create unique transaction identifier for Firestore
            const firestoreTxId = `${txHash}-${type}-${amount}-${currency}`;
            
            // Check if transaction already exists in Firestore
            if (txHash) {
                const existingTx = await db.collection('transactions')
                    .where('txHash', '==', txHash)
                    .where('userId', '==', this.currentUser.uid)
                    .limit(1)
                    .get();
                
                if (!existingTx.empty) {
                    console.log('Transaction already logged in Firestore:', firestoreTxId);
                    return;
                }
            }
            
            // Add new transaction
            await db.collection('transactions').add({
                userId: this.currentUser.uid,
                type: type,
                amount: amount,
                currency: currency,
                description: description,
                txHash: txHash,
                timestamp: new Date(),
                status: 'completed'
            });
            
            console.log('Transaction logged to Firestore:', firestoreTxId);
            
            if (window.refreshTransactionHistory) {
                window.refreshTransactionHistory();
            }
        } catch (e) {
            console.error('Error logging transaction:', e);
        }
    }

    // Track last balance update time to prevent rapid updates
    lastBalanceUpdate = {};

    // Update user's crypto balance in Firestore (for deposits)
    async updateUserCryptoBalance(tokenType, amount) {
        try {
            if (!this.currentUser) {
                console.warn('No current user to update balance for');
                return;
            }

            // Create unique balance update key
            const updateKey = `${this.currentUser.uid}-${tokenType}`;
            const now = Date.now();
            
            // Check if we recently updated this balance (within 5 seconds)
            if (this.lastBalanceUpdate[updateKey] && 
                (now - this.lastBalanceUpdate[updateKey]) < 5000) {
                console.log(`Skipping rapid balance update for ${tokenType}: ${now - this.lastBalanceUpdate[updateKey]}ms ago`);
                return;
            }

            const userRef = db.collection('users').doc(this.currentUser.uid);
            
            // Get current user data
            const userDoc = await userRef.get();
            if (!userDoc.exists) {
                console.warn('User document not found');
                return;
            }

            const userData = userDoc.data();
            const currentBalance = userData.cryptoBalances?.[tokenType] || 0;
            const newBalance = currentBalance + amount;

            // Update the balance
            await userRef.update({
                [`cryptoBalances.${tokenType}`]: newBalance,
                updatedAt: new Date()
            });

            // Record the update time
            this.lastBalanceUpdate[updateKey] = now;

            console.log(`Updated ${tokenType} balance: ${currentBalance} → ${newBalance}`);

            // Trigger balance refresh in dashboard
            if (window.dashboard && typeof window.dashboard.updateDashboardBalances === 'function') {
                window.dashboard.updateDashboardBalances();
            }

        } catch (error) {
            console.error('Error updating user crypto balance:', error);
        }
    }

    // Update user's crypto balance in Firestore (for withdrawals)
    async updateUserCryptoBalanceAfterWithdrawal(tokenAddress, amount) {
        try {
            if (!this.currentUser) {
                console.warn('No current user to update balance for');
                return;
            }

            // Determine token type
            let tokenType = 'UNKNOWN';
            if (tokenAddress.toLowerCase() === CONTRACT_CONFIG.contracts.usdt.toLowerCase()) {
                tokenType = 'USDT';
            } else if (tokenAddress.toLowerCase() === CONTRACT_CONFIG.contracts.bxc.toLowerCase()) {
                tokenType = 'BXC';
            }

            if (tokenType === 'UNKNOWN') {
                console.warn('Unknown token address for withdrawal:', tokenAddress);
                return;
            }

            // Create unique balance update key
            const updateKey = `${this.currentUser.uid}-${tokenType}-withdrawal`;
            const now = Date.now();
            
            // Check if we recently updated this balance (within 3 seconds for withdrawals)
            if (this.lastBalanceUpdate[updateKey] && 
                (now - this.lastBalanceUpdate[updateKey]) < 3000) {
                console.log(`Skipping rapid withdrawal balance update for ${tokenType}: ${now - this.lastBalanceUpdate[updateKey]}ms ago`);
                return;
            }

            const userRef = db.collection('users').doc(this.currentUser.uid);
            
            // Get current user data
            const userDoc = await userRef.get();
            if (!userDoc.exists) {
                console.warn('User document not found');
                return;
            }

            const userData = userDoc.data();
            const currentBalance = userData.cryptoBalances?.[tokenType] || 0;
            const newBalance = Math.max(0, currentBalance - parseFloat(this.web3.utils.fromWei(amount, 'ether')));

            // Update the balance
            await userRef.update({
                [`cryptoBalances.${tokenType}`]: newBalance,
                updatedAt: new Date()
            });

            // Record the update time
            this.lastBalanceUpdate[updateKey] = now;

            console.log(`Updated ${tokenType} balance after withdrawal: ${currentBalance} → ${newBalance}`);

            // Trigger balance refresh in dashboard
            if (window.dashboard && typeof window.dashboard.updateDashboardBalances === 'function') {
                window.dashboard.updateDashboardBalances();
            }

        } catch (error) {
            console.error('Error updating user crypto balance after withdrawal:', error);
        }
    }

    // INR Operations Duplicate Prevention

    // Prevent duplicate INR deposits
    async preventDuplicateInrDeposit(amount, description = '') {
        try {
            if (!this.currentUser) return false;

            // Create unique INR deposit identifier
            const depositId = `inr-deposit-${this.currentUser.uid}-${amount}-${Date.now()}`;
            
            // Check if this deposit is already in progress
            if (this.inrOperations.has(depositId)) {
                console.log('INR deposit already in progress:', depositId);
                return false; // Block duplicate
            }
            
            // Mark deposit as in progress
            this.inrOperations.add(depositId);
            
            // Remove after 10 seconds to prevent permanent blocking
            setTimeout(() => {
                this.inrOperations.delete(depositId);
            }, 10000);
            
            return true; // Allow deposit
        } catch (error) {
            console.error('Error preventing duplicate INR deposit:', error);
            return false;
        }
    }

    // Prevent duplicate INR withdrawals
    async preventDuplicateInrWithdrawal(amount, description = '') {
        try {
            if (!this.currentUser) return false;

            // Create unique INR withdrawal identifier
            const withdrawalId = `inr-withdrawal-${this.currentUser.uid}-${amount}-${Date.now()}`;
            
            // Check if this withdrawal is already in progress
            if (this.inrOperations.has(withdrawalId)) {
                console.log('INR withdrawal already in progress:', withdrawalId);
                return false; // Block duplicate
            }
            
            // Mark withdrawal as in progress
            this.inrOperations.add(withdrawalId);
            
            // Remove after 15 seconds to prevent permanent blocking
            setTimeout(() => {
                this.inrOperations.delete(withdrawalId);
            }, 15000);
            
            return true; // Allow withdrawal
        } catch (error) {
            console.error('Error preventing duplicate INR withdrawal:', error);
            return false;
        }
    }

    // Prevent duplicate INR transfers
    async preventDuplicateInrTransfer(toUserId, amount, description = '') {
        try {
            if (!this.currentUser) return false;

            // Create unique INR transfer identifier
            const transferId = `inr-transfer-${this.currentUser.uid}-${toUserId}-${amount}-${Date.now()}`;
            
            // Check if this transfer is already in progress
            if (this.inrOperations.has(transferId)) {
                console.log('INR transfer already in progress:', transferId);
                return false; // Block duplicate
            }
            
            // Mark transfer as in progress
            this.inrOperations.add(transferId);
            
            // Remove after 12 seconds to prevent permanent blocking
            setTimeout(() => {
                this.inrOperations.delete(transferId);
            }, 12000);
            
            return true; // Allow transfer
        } catch (error) {
            console.error('Error preventing duplicate INR transfer:', error);
            return false;
        }
    }

    // Update INR balance with duplicate prevention
    async updateInrBalance(amount, operation = 'deposit') {
        try {
            if (!this.currentUser) {
                console.warn('No current user to update INR balance for');
                return;
            }

            // Create unique balance update key
            const updateKey = `${this.currentUser.uid}-INR-${operation}`;
            const now = Date.now();
            
            // Check if we recently updated this balance (within 3 seconds for INR)
            if (this.lastBalanceUpdate[updateKey] && 
                (now - this.lastBalanceUpdate[updateKey]) < 3000) {
                console.log(`Skipping rapid INR balance update for ${operation}: ${now - this.lastBalanceUpdate[updateKey]}ms ago`);
                return;
            }

            const userRef = db.collection('users').doc(this.currentUser.uid);
            
            // Get current user data
            const userDoc = await userRef.get();
            if (!userDoc.exists) {
                console.warn('User document not found');
                return;
            }

            const userData = userDoc.data();
            const currentBalance = userData.inrBalance || 0;
            let newBalance;

            if (operation === 'deposit') {
                newBalance = currentBalance + amount;
            } else if (operation === 'withdrawal') {
                newBalance = Math.max(0, currentBalance - amount);
            } else if (operation === 'transfer-sent') {
                newBalance = Math.max(0, currentBalance - amount);
            } else if (operation === 'transfer-received') {
                newBalance = currentBalance + amount;
            }

            // Update the balance
            await userRef.update({
                'inrBalance': newBalance,
                updatedAt: new Date()
            });

            // Record the update time
            this.lastBalanceUpdate[updateKey] = now;

            console.log(`Updated INR balance after ${operation}: ${currentBalance} → ${newBalance}`);

            // Trigger balance refresh in dashboard
            if (window.dashboard && typeof window.dashboard.updateDashboardBalances === 'function') {
                window.dashboard.updateDashboardBalances();
            }

        } catch (error) {
            console.error('Error updating INR balance:', error);
        }
    }

    // Log INR transaction with duplicate prevention
    async logInrTransaction(type, amount, description = '', recipientId = '') {
        try {
            if (!this.currentUser) return;
            
            // Create unique transaction identifier for INR
            const inrTxId = `INR-${type}-${amount}-${this.currentUser.uid}-${Date.now()}`;
            
            // Check if this transaction was already logged (within last 5 seconds)
            const existingKey = `INR-${type}-${amount}-${this.currentUser.uid}`;
            if (this.lastBalanceUpdate[existingKey]) {
                const timeDiff = Date.now() - this.lastBalanceUpdate[existingKey];
                if (timeDiff < 5000) {
                    console.log('Skipping duplicate INR transaction log:', existingKey);
                    return;
                }
            }
            
            // Add new INR transaction
            await db.collection('transactions').add({
                userId: this.currentUser.uid,
                type: type,
                amount: amount,
                currency: 'INR',
                description: description,
                recipientId: recipientId || '',
                timestamp: new Date(),
                status: 'completed'
            });
            
            // Record the transaction time to prevent duplicates
            this.lastBalanceUpdate[existingKey] = Date.now();
            
            console.log('INR transaction logged to Firestore:', inrTxId);
            
            if (window.refreshTransactionHistory) {
                window.refreshTransactionHistory();
            }
        } catch (e) {
            console.error('Error logging INR transaction:', e);
        }
    }

    // Check if any INR operation is in progress
    isInrOperationInProgress() {
        return this.inrOperations.size > 0;
    }

    // Get INR operations status
    getInrOperationsStatus() {
        const operations = Array.from(this.inrOperations);
        return {
            count: operations.length,
            operations: operations
        };
    }

    // Start monitoring for incoming transactions
    startTransactionMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        // Clear processed transactions when starting fresh monitoring
        this.processedTransactions.clear();
        console.log('Cleared processed transactions cache for fresh monitoring');

        // Check for new transactions every 30 seconds
        this.monitoringInterval = setInterval(() => {
            this.monitorIncomingTransactions();
        }, 30000);

        console.log('Started transaction monitoring');
    }

    // Stop monitoring for incoming transactions
    stopTransactionMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        console.log('Stopped transaction monitoring');
    }

    // Clear processed transactions cache (useful for debugging)
    clearProcessedTransactionsCache() {
        this.processedTransactions.clear();
        this.lastBalanceUpdate = {};
        this.inrOperations.clear();
        console.log('All caches cleared: transactions, balance updates, and INR operations');
    }

    // Manual refresh of all crypto balances from blockchain
    async refreshAllBalances() {
        try {
            if (!this.isConnected || !this.contract) {
                throw new Error('Wallet not connected or contract not loaded');
            }

            console.log('🔄 Refreshing all crypto balances from blockchain...');
            
            // Show loading state
            this.showBalanceLoadingState(true);

            // Get balances for USDT and BXC
            const usdtBalance = await this.getCryptoBalance(CONTRACT_CONFIG.contracts.usdt);
            const bxcBalance = await this.getCryptoBalance(CONTRACT_CONFIG.contracts.bxc);

            console.log('Blockchain balances:', { USDT: usdtBalance, BXC: bxcBalance });

            // Update Firestore with blockchain balances
            if (this.currentUser) {
                const userRef = db.collection('users').doc(this.currentUser.uid);
                await userRef.update({
                    'cryptoBalances.USDT': parseFloat(usdtBalance),
                    'cryptoBalances.BXC': parseFloat(bxcBalance),
                    updatedAt: new Date()
                });

                console.log('✅ Updated Firestore balances from blockchain');

                // Check for any pending deposits
                await this.checkForPendingDeposits();

                // Trigger dashboard refresh
                if (window.dashboard && typeof window.dashboard.updateDashboardBalances === 'function') {
                    window.dashboard.updateDashboardBalances();
                }

                this.showNotification('Balances refreshed from blockchain!', 'success');
            }

        } catch (error) {
            console.error('Error refreshing balances:', error);
            this.showNotification('Failed to refresh balances: ' + error.message, 'error');
        } finally {
            // Hide loading state
            this.showBalanceLoadingState(false);
        }
    }
    
    // Show/hide balance loading state to prevent flash
    showBalanceLoadingState(show) {
        try {
            // Find balance elements and show loading state
            const balanceElements = document.querySelectorAll('.balance-amount, .crypto-balance, .inr-balance');
            
            balanceElements.forEach(element => {
                if (show) {
                    // Store original text and show loading
                    if (!element.dataset.originalText) {
                        element.dataset.originalText = element.textContent;
                    }
                    element.textContent = '🔄 Loading...';
                    element.style.opacity = '0.7';
                } else {
                    // Restore original text
                    if (element.dataset.originalText) {
                        element.textContent = element.dataset.originalText;
                        delete element.dataset.originalText;
                    }
                    element.style.opacity = '1';
                }
            });
            
            // Also update dashboard if available
            if (window.dashboard && typeof window.dashboard.showBalanceLoading === 'function') {
                window.dashboard.showBalanceLoading(show);
            }
            
        } catch (error) {
            console.error('Error showing balance loading state:', error);
        }
    }

    // Check for pending deposits by comparing blockchain vs stored balances
    async checkForPendingDeposits() {
        try {
            if (!this.isConnected || !this.contract || !this.currentUser) {
                return;
            }

            console.log('🔍 Checking for pending deposits...');

            // Get current blockchain balances
            const usdtBalance = await this.getCryptoBalance(CONTRACT_CONFIG.contracts.usdt);
            const bxcBalance = await this.getCryptoBalance(CONTRACT_CONFIG.contracts.bxc);

            // Get stored balances from Firestore
            const userRef = db.collection('users').doc(this.currentUser.uid);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                return;
            }

            const userData = userDoc.data();
            const storedUSDT = userData.cryptoBalances?.USDT || 0;
            const storedBXC = userData.cryptoBalances?.BXC || 0;

            console.log('Balance comparison:', {
                blockchain: { USDT: usdtBalance, BXC: bxcBalance },
                stored: { USDT: storedUSDT, BXC: storedBXC }
            });

            // Check for differences (with tolerance for small rounding errors)
            const tolerance = 0.000001; // 0.000001 tolerance
            const usdtDiff = parseFloat(usdtBalance) - storedUSDT;
            const bxcDiff = parseFloat(bxcBalance) - storedBXC;

            let depositsFound = false;

            if (usdtDiff > tolerance) {
                console.log(`💰 Found pending USDT deposit: ${usdtDiff}`);
                await this.updateUserCryptoBalance('USDT', usdtDiff);
                depositsFound = true;
            }

            if (bxcDiff > tolerance) {
                console.log(`💰 Found pending BXC deposit: ${bxcDiff}`);
                await this.updateUserCryptoBalance('BXC', bxcDiff);
                depositsFound = true;
            }

            if (depositsFound) {
                this.showNotification('Pending deposits detected and processed!', 'success');
                
                // Force dashboard refresh
                if (window.dashboard && typeof window.dashboard.updateDashboardBalances === 'function') {
                    window.dashboard.updateDashboardBalances();
                }
            } else {
                console.log('✅ No pending deposits found');
            }

        } catch (error) {
            console.error('Error checking for pending deposits:', error);
        }
    }
    
    // ERC-20 Token Operations
    
    getERC20ABI() {
        return [
            {
                "constant": true,
                "inputs": [],
                "name": "name",
                "outputs": [{"name": "", "type": "string"}],
                "type": "function"
            },
            {
                "constant": true,
                "inputs": [],
                "name": "symbol",
                "outputs": [{"name": "", "type": "string"}],
                "type": "function"
            },
            {
                "constant": true,
                "inputs": [],
                "name": "decimals",
                "outputs": [{"name": "", "type": "uint8"}],
                "type": "function"
            },
            {
                "constant": true,
                "inputs": [{"name": "_owner", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "balance", "type": "uint256"}],
                "type": "function"
            },
            {
                "constant": false,
                "inputs": [{"name": "_to", "type": "address"}, {"name": "_value", "type": "uint256"}],
                "name": "transfer",
                "outputs": [{"name": "", "type": "bool"}],
                "type": "function"
            },
            {
                "constant": false,
                "inputs": [{"name": "_spender", "type": "address"}, {"name": "_value", "type": "uint256"}],
                "name": "approve",
                "outputs": [{"name": "", "type": "bool"}],
                "type": "function"
            },
            {
                "constant": true,
                "inputs": [{"name": "_owner", "type": "address"}, {"name": "_spender", "type": "address"}],
                "name": "allowance",
                "outputs": [{"name": "", "type": "uint256"}],
                "type": "function"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": true,
                        "internalType": "address",
                        "name": "from",
                        "type": "address"
                    },
                    {
                        "indexed": true,
                        "internalType": "address",
                        "name": "to",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "value",
                        "type": "uint256"
                    }
                ],
                "name": "Transfer",
                "type": "event"
            }
        ];
    }

    getBXCTokenABI() {
        // Use the ABI from the bxc-token-abi.js file
        if (window.BXC_TOKEN_ABI) {
            return window.BXC_TOKEN_ABI;
        }
        
        // Fallback to basic ERC20 ABI if the file is not loaded
        console.warn('BXC Token ABI not loaded, using fallback');
        return this.getERC20ABI();
    }

    getUSDTABI() {
        // USDT is a standard ERC20 token
        return this.getERC20ABI();
    }

    // Token Balance Methods
    
    async getUSDTBalance(userAddress) {
        try {
            if (!this.web3) {
                throw new Error('Web3 not initialized');
            }
            
            const usdtContract = new this.web3.eth.Contract(this.getUSDTABI(), window.CONTRACT_CONFIG?.contracts?.usdt);
            const balance = await usdtContract.methods.balanceOf(userAddress).call();
            return this.web3.utils.fromWei(balance, 'ether');
        } catch (error) {
            console.error('Error getting USDT balance:', error);
            return '0';
        }
    }

    async getBXCBalance(userAddress) {
        try {
            if (!this.web3) {
                throw new Error('Web3 not initialized');
            }
            
            const bxcContract = new this.web3.eth.Contract(this.getBXCTokenABI(), window.CONTRACT_CONFIG?.contracts?.bxc);
            const balance = await bxcContract.methods.balanceOf(userAddress).call();
            return this.web3.utils.fromWei(balance, 'ether');
        } catch (error) {
            console.error('Error getting BXC balance:', error);
            return '0';
        }
    }

    async getCryptoWalletBalance(userAddress, tokenAddress) {
        try {
            if (!this.contract) {
                throw new Error('CryptoWallet contract not loaded');
            }
            
            const balance = await this.contract.methods.getCryptoBalance(userAddress, tokenAddress).call();
            return this.web3.utils.fromWei(balance, 'ether');
        } catch (error) {
            console.error('Error getting crypto wallet balance:', error);
            return '0';
        }
    }
    
    // Utility Functions
    
    async getNetworkInfo() {
        if (!this.web3) return null;
        
        try {
            const networkId = await this.web3.eth.net.getId();
            const networkType = await this.web3.eth.net.getNetworkType();
            
            return {
                networkId,
                networkType,
                isBSC: networkId === 56 || networkId === 97 // BSC Mainnet or Testnet
            };
        } catch (error) {
            console.error('Network info error:', error);
            return null;
        }
    }
    
    updateUI() {
        // Update UI elements to show connection status
        const walletStatus = document.getElementById('wallet-status');
        if (walletStatus) {
            if (this.isConnected) {
                walletStatus.textContent = `Connected: ${this.userAccount.slice(0, 6)}...${this.userAccount.slice(-4)}`;
                walletStatus.className = 'wallet-status connected';
            } else {
                walletStatus.textContent = 'Not Connected';
                walletStatus.className = 'wallet-status disconnected';
            }
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

    // Global functions for other parts of the application
    static getGlobalFunctions() {
        return {
            startTransactionMonitoring: () => window.web3Manager?.startTransactionMonitoring(),
            stopTransactionMonitoring: () => window.web3Manager?.stopTransactionMonitoring(),
            refreshAllBalances: () => window.web3Manager?.refreshAllBalances(),
            checkForPendingDeposits: () => window.web3Manager?.checkForPendingDeposits(),
            clearProcessedTransactionsCache: () => window.web3Manager?.clearProcessedTransactionsCache(),
            isWithdrawalInProgress: () => window.web3Manager?.isWithdrawalInProgress(),
            // Balance Validation Functions
            validateUserBalances: () => window.web3Manager?.validateUserBalances(),
            syncUserBalancesOnLogin: () => window.web3Manager?.syncUserBalancesOnLogin(),
            // INR Duplicate Prevention Functions
            preventDuplicateInrDeposit: (amount, description) => window.web3Manager?.preventDuplicateInrDeposit(amount, description),
            preventDuplicateInrWithdrawal: (amount, description) => window.web3Manager?.preventDuplicateInrWithdrawal(amount, description),
            preventDuplicateInrTransfer: (toUserId, amount, description) => window.web3Manager?.preventDuplicateInrTransfer(toUserId, amount, description),
            updateInrBalance: (amount, operation) => window.web3Manager?.updateInrBalance(amount, operation),
            logInrTransaction: (type, amount, description, recipientId) => window.web3Manager?.logInrTransaction(type, amount, description, recipientId),
            isInrOperationInProgress: () => window.web3Manager?.isInrOperationInProgress(),
            getInrOperationsStatus: () => window.web3Manager?.getInrOperationsStatus()
        };
    }

    // Check if a withdrawal is currently in progress
    isWithdrawalInProgress() {
        const withdrawalPattern = new RegExp(`withdrawal-${this.userAccount}-.*`);
        for (const txId of this.processedTransactions) {
            if (withdrawalPattern.test(txId)) {
                return true;
            }
        }
        return false;
    }
    
    // Validate user balances after login to prevent showing 0
    async validateUserBalances() {
        try {
            if (!this.currentUser) {
                console.log('No user set, cannot validate balances');
                return;
            }
            
            console.log('🔍 Validating user balances...');
            
            // Get user profile from Firestore
            const userRef = db.collection('users').doc(this.currentUser.uid);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                console.log('User document not found');
                return;
            }
            
            const userData = userDoc.data();
            const cryptoBalances = userData.cryptoBalances || {};
            const inrBalance = userData.inrBalance || 0;
            
            console.log('Current stored balances:', { crypto: cryptoBalances, inr: inrBalance });
            
            // Check if balances are suspiciously low or 0
            const suspiciousBalances = [];
            
            if (!cryptoBalances.BXC || cryptoBalances.BXC === 0) {
                suspiciousBalances.push('BXC');
            }
            if (!cryptoBalances.USDT || cryptoBalances.USDT === 0) {
                suspiciousBalances.push('USDT');
            }
            if (!inrBalance || inrBalance === 0) {
                suspiciousBalances.push('INR');
            }
            
            if (suspiciousBalances.length > 0) {
                console.log(`⚠️ Suspicious balances detected for: ${suspiciousBalances.join(', ')}`);
                console.log('🔄 Forcing balance refresh from blockchain...');
                
                // Force refresh balances
                await this.refreshAllBalances();
                
                // Double-check after refresh
                setTimeout(async () => {
                    await this.checkForPendingDeposits();
                }, 2000);
                
            } else {
                console.log('✅ All balances look normal');
            }
            
        } catch (error) {
            console.error('Error validating user balances:', error);
        }
    }
}

// Initialize Web3 Manager
document.addEventListener('DOMContentLoaded', () => {
    window.web3Manager = new Web3Manager();
    
    // Add global functions to window
    const globalFunctions = Web3Manager.getGlobalFunctions();
    Object.assign(window, globalFunctions);
});
