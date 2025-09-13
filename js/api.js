// Enhanced API Integration for Live Crypto Prices
class CryptoPriceAPI {
    constructor() {
        this.prices = {
            BTC: { INR: 0, USD: 0, lastUpdate: null },
            USDT: { INR: 0, USD: 0, lastUpdate: null },
            BXC: { INR: 0, USD: 0, lastUpdate: null }
        };
        
        this.apiEndpoints = {
            coingecko: 'https://api.coingecko.com/api/v3',
            binance: 'https://api.binance.com/api/v3'
        };
        
        this.updateInterval = null;
        this.init();
    }
    
    init() {
        this.fetchAllPrices();
        this.startAutoUpdate();
    }
    
    // Fetch prices from multiple sources
    async fetchAllPrices() {
        try {
            await Promise.all([
                this.fetchCoinGeckoPrices(),
                this.fetchBinancePrices()
            ]);
            
            this.updatePriceDisplay();
            console.log('All prices updated successfully');
            
        } catch (error) {
            console.error('Price fetch error:', error);
            // Use fallback prices if APIs fail
            this.useFallbackPrices();
        }
    }
    
    // CoinGecko API - Good for general crypto prices
    async fetchCoinGeckoPrices() {
        try {
            // Add delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const response = await fetch(`${this.apiEndpoints.coingecko}/simple/price?ids=bitcoin,tether&vs_currencies=inr,usd`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'CryptoWallet/1.0'
                },
                // Add timeout
                signal: AbortSignal.timeout(10000)
            });
            
            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('CoinGecko rate limit hit, will retry later');
                    return null;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.bitcoin) {
                this.prices.BTC.INR = data.bitcoin.inr || 0;
                this.prices.BTC.USD = data.bitcoin.usd || 0;
                this.prices.BTC.lastUpdate = new Date();
            }
            
            if (data.tether) {
                this.prices.USDT.INR = data.tether.inr || 0;
                this.prices.USDT.USD = data.tether.usd || 0;
                this.prices.USDT.lastUpdate = new Date();
            }
            
            console.log('CoinGecko prices fetched');
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('CoinGecko request timed out');
            } else {
                console.error('CoinGecko API error:', error);
            }
            return null;
        }
    }
    
    // Binance API - Good for real-time trading data
    async fetchBinancePrices() {
        try {
            // Fetch BTC/USDT price
            const btcResponse = await fetch(`${this.apiEndpoints.binance}/ticker/price?symbol=BTCUSDT`);
            const btcData = await btcResponse.json();
            
            if (btcData.price) {
                const btcPrice = parseFloat(btcData.price);
                this.prices.BTC.USD = btcPrice;
                // Convert USD to INR using approximate rate (you can use a forex API for exact rates)
                this.prices.BTC.INR = btcPrice * 83; // Approximate USD to INR rate
                this.prices.BTC.lastUpdate = new Date();
            }
            
            // Fetch USDT/INR equivalent (USDT is pegged to USD, so INR = USD * forex_rate)
            this.prices.USDT.USD = 1; // USDT is pegged to USD
            this.prices.USDT.INR = 83; // Approximate rate
            this.prices.USDT.lastUpdate = new Date();
            
            console.log('Binance prices fetched');
            
        } catch (error) {
            console.error('Binance API error:', error);
        }
    }
    
    // Custom BXC token price (you can update this based on your token's market)
    updateBXCPrices() {
        // For now, using a fixed price. In production, you'd fetch this from your token's market
        this.prices.BXC.USD = 0.30; // Example: $0.30 per BXC
        this.prices.BXC.INR = this.prices.BXC.USD * 83; // Convert to INR
        this.prices.BXC.lastUpdate = new Date();
    }
    
    // Use fallback prices if APIs fail
    useFallbackPrices() {
        this.prices.BTC.INR = 4500000; // ₹45,00,000 per BTC
        this.prices.BTC.USD = 54000;   // $54,000 per BTC
        this.prices.USDT.INR = 83;     // ₹83 per USDT
        this.prices.USDT.USD = 1;      // $1 per USDT
        this.prices.BXC.INR = 25;      // ₹25 per BXC
        this.prices.BXC.USD = 0.30;    // $0.30 per BXC
        
        this.prices.BTC.lastUpdate = new Date();
        this.prices.USDT.lastUpdate = new Date();
        this.prices.BXC.lastUpdate = new Date();
        
        console.log('Using fallback prices');
    }
    
    // Get current price for a specific crypto and currency
    getPrice(crypto, currency = 'INR') {
        if (this.prices[crypto] && this.prices[crypto][currency]) {
            return this.prices[crypto][currency];
        }
        return 0;
    }
    
    // Get all current prices
    getAllPrices() {
        return this.prices;
    }
    
    // Convert amount between currencies
    convertAmount(amount, fromCrypto, toCurrency = 'INR') {
        const price = this.getPrice(fromCrypto, toCurrency);
        return amount * price;
    }
    
    // Convert INR to crypto amount
    inrToCrypto(inrAmount, crypto) {
        const price = this.getPrice(crypto, 'INR');
        return price > 0 ? inrAmount / price : 0;
    }
    
    // Convert crypto to INR amount
    cryptoToInr(cryptoAmount, crypto) {
        const price = this.getPrice(crypto, 'INR');
        return cryptoAmount * price;
    }
    
    // Start automatic price updates
    startAutoUpdate() {
        this.updateInterval = setInterval(() => {
            this.fetchAllPrices();
        }, 60000); // Update every 60 seconds to avoid rate limiting
    }
    
    // Stop automatic updates
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    // Update price display on the UI
    updatePriceDisplay() {
        // Update live price elements
        const priceElements = document.querySelectorAll('.live-price');
        priceElements.forEach(element => {
            const crypto = element.dataset.crypto;
            if (crypto && this.prices[crypto]) {
                const price = this.prices[crypto].INR;
                element.textContent = `₹${price.toLocaleString()}`;
                
                // Add price change indicator
                this.addPriceChangeIndicator(element, crypto);
            }
        });
        
        // Update conversion displays
        this.updateConversionDisplays();
        
        // Update last update time
        this.updateLastUpdateTime();
    }
    
    // Add price change indicator (if you want to show price movement)
    addPriceChangeIndicator(element, crypto) {
        // This could show price change percentage, up/down arrows, etc.
        // For now, just updating the price
    }
    
    // Update conversion displays
    updateConversionDisplays() {
        // Update INR to Crypto conversion
        const inrInput = document.getElementById('inr-input');
        if (inrInput && inrInput.value) {
            this.updateInrToCryptoConversion();
        }
        
        // Update Crypto to INR conversion
        const cryptoInput = document.getElementById('crypto-input');
        if (cryptoInput && cryptoInput.value) {
            this.updateCryptoToInrConversion();
        }
    }
    
    // Update INR to Crypto conversion display
    updateInrToCryptoConversion() {
        const inrAmount = parseFloat(document.getElementById('inr-input')?.value) || 0;
        const selectedCrypto = document.getElementById('inr-crypto-select')?.value;
        
        if (inrAmount > 0 && selectedCrypto) {
            const cryptoAmount = this.inrToCrypto(inrAmount, selectedCrypto);
            const resultElement = document.getElementById('inr-crypto-result');
            const symbolElement = document.getElementById('inr-crypto-symbol');
            
            if (resultElement) resultElement.textContent = cryptoAmount.toFixed(8);
            if (symbolElement) symbolElement.textContent = selectedCrypto;
        }
    }
    
    // Update Crypto to INR conversion display
    updateCryptoToInrConversion() {
        const cryptoAmount = parseFloat(document.getElementById('crypto-input')?.value) || 0;
        const selectedCrypto = document.getElementById('crypto-type-select')?.value;
        
        if (cryptoAmount > 0 && selectedCrypto) {
            const inrAmount = this.cryptoToInr(cryptoAmount, selectedCrypto);
            const resultElement = document.getElementById('crypto-inr-result');
            
            if (resultElement) resultElement.textContent = `₹${inrAmount.toFixed(2)}`;
        }
    }
    
    // Update last update time display
    updateLastUpdateTime() {
        const lastUpdateElements = document.querySelectorAll('.last-update');
        lastUpdateElements.forEach(element => {
            const now = new Date();
            element.textContent = `Last updated: ${now.toLocaleTimeString()}`;
        });
    }
    
    // Get price history (if needed for charts)
    async getPriceHistory(crypto, days = 7) {
        try {
            const response = await fetch(`${this.apiEndpoints.coingecko}/coins/${crypto}/market_chart?vs_currency=inr&days=${days}`);
            const data = await response.json();
            return data.prices;
        } catch (error) {
            console.error('Price history fetch error:', error);
            return [];
        }
    }
    
    // Get market cap and volume data
    async getMarketData(crypto) {
        try {
            const response = await fetch(`${this.apiEndpoints.coingecko}/simple/price?ids=${crypto}&vs_currencies=inr&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`);
            const data = await response.json();
            return data[crypto] || {};
        } catch (error) {
            console.error('Market data fetch error:', error);
            return {};
        }
    }
    
    // Format price with appropriate decimals
    formatPrice(price, currency = 'INR') {
        if (currency === 'INR') {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(price);
        } else if (currency === 'USD') {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(price);
        }
        return price.toFixed(8);
    }
    
    // Check if prices are stale (older than 1 minute)
    arePricesStale() {
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60000);
        
        return Object.values(this.prices).some(price => 
            !price.lastUpdate || price.lastUpdate < oneMinuteAgo
        );
    }
    
    // Force refresh prices
    async forceRefresh() {
        console.log('Forcing price refresh...');
        await this.fetchAllPrices();
    }
}

// Initialize Crypto Price API
let cryptoPriceAPI;
document.addEventListener('DOMContentLoaded', () => {
    cryptoPriceAPI = new CryptoPriceAPI();
});

// Export for use in other files
window.cryptoPriceAPI = cryptoPriceAPI;
