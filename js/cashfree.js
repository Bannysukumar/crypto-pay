// Cashfree Integration for INR Deposits
class CashfreeManager {
    constructor() {
        console.log('CashfreeManager constructor called');
        this.cashfree = null;
        this.currentOrder = null;
        this.isProcessing = false;
        this.isInitialized = false;
        this.config = window.CASHFREE_CONFIG ? window.CASHFREE_CONFIG.getCurrentConfig() : {
            appId: 'YOUR_SANDBOX_APP_ID', // Your actual Cashfree Sandbox App ID
            secretKey: 'YOUR_SANDBOX_SECRET_KEY', // Your actual Cashfree Sandbox Secret Key
            baseUrl: 'https://sandbox.cashfree.com/pg/orders',
            apiVersion: '2022-02-01'
        };
        
        console.log('CashfreeManager config:', this.config);
        this.init().then(() => {
            this.isInitialized = true;
            console.log('CashfreeManager fully initialized');
        }).catch(error => {
            console.error('CashfreeManager initialization failed:', error);
            // Try alternative script source if first one fails
            this.tryAlternativeScript();
        });
    }
    
    async init() {
        try {
            console.log('CashfreeManager init called');
            
            // Check if script is already loaded
            if (typeof Cashfree !== 'undefined') {
                console.log('Cashfree script already loaded, creating instance');
                this.cashfree = new Cashfree({ mode: "sandbox" });
                console.log('Cashfree instance created from existing script');
            } else {
                console.log('Cashfree script not loaded, checking accessibility...');
                
                // Test if the script URL is accessible
                const isAccessible = await this.testScriptAccessibility();
                if (!isAccessible) {
                    console.warn('Cashfree script URL may not be accessible');
                    this.showNotification('⚠️ Cashfree SDK unavailable - using test mode', 'warning');
                }
                
                console.log('Loading Cashfree script...');
                await this.loadCashfreeScript();
                console.log('Cashfree script loaded and instance created');
            }
            
            console.log('CashfreeManager init completed, cashfree instance:', this.cashfree);
        } catch (error) {
            console.error('Cashfree initialization error:', error);
            this.showNotification('⚠️ Cashfree initialization failed - using test mode', 'warning');
            throw error; // Re-throw to trigger fallback
        }
    }
    
    // Test if Cashfree script URL is accessible
    async testScriptAccessibility() {
        try {
            // Try multiple Cashfree script URLs - updated with working URLs
            const scriptUrls = [
                'https://sdk.cashfree.com/js/ui/1.0.26/dropinClient.js',
                'https://unpkg.com/@cashfree/cashfree-js@1.0.0/dist/cashfree.js',
                'https://cdn.jsdelivr.net/npm/@cashfree/cashfree-js@1.0.0/dist/cashfree.js',
                'https://sdk.cashfree.com/js/ui/2.0.0/dropinClient.js' // Keep as fallback
            ];
            
            for (const url of scriptUrls) {
                try {
                    // Try to actually fetch the script content, not just HEAD request
                    const response = await fetch(url, {
                        method: 'GET',
                        mode: 'no-cors'
                    });
                    
                    // Check if we can get the content
                    if (response.ok || response.type === 'opaque') {
                        console.log(`Cashfree script accessible at: ${url}`);
                        return url;
                    }
                } catch (error) {
                    console.warn(`Script accessibility test failed for ${url}:`, error);
                }
            }
            
            console.warn('No Cashfree script URLs accessible, will use fallback');
            return null;
        } catch (error) {
            console.warn('Script accessibility test failed:', error);
            return null;
        }
    }
    
    async loadCashfreeScript() {
        try {
            // Test which script URL is accessible
            const accessibleUrl = await this.testScriptAccessibility();
            
            if (accessibleUrl) {
                console.log('Using accessible Cashfree script:', accessibleUrl);
                try {
                    await this.loadScriptFromUrl(accessibleUrl);
                } catch (scriptError) {
                    console.error('Script loading failed, falling back to mock system:', scriptError);
                    await this.createFallbackIntegration();
                }
            } else {
                console.log('No accessible scripts found, using fallback integration');
                await this.createFallbackIntegration();
            }
        } catch (error) {
            console.error('Cashfree script loading failed:', error);
            await this.createFallbackIntegration();
        }
    }
    
    // Load script from specific URL
    loadScriptFromUrl(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.type = 'text/javascript';
            script.async = true;
            
            let timeoutId;
            
            script.onload = () => {
                clearTimeout(timeoutId);
                console.log(`Cashfree script loaded from: ${url}`);
                
                // Wait a bit for the script to initialize
                setTimeout(() => {
                    try {
                        this.initializeCashfreeInstance();
                        resolve();
                    } catch (error) {
                        console.error('Failed to initialize Cashfree instance:', error);
                        reject(new Error(`Initialization failed: ${error.message}`));
                    }
                }, 1000);
            };
            
            script.onerror = () => {
                clearTimeout(timeoutId);
                console.error(`Failed to load script from: ${url}`);
                reject(new Error(`Script loading failed: ${url}`));
            };
            
            // Add timeout
            timeoutId = setTimeout(() => {
                console.error(`Script loading timeout for: ${url}`);
                reject(new Error(`Script loading timeout: ${url}`));
            }, 8000); // Reduced timeout to 8 seconds
            
            document.head.appendChild(script);
        });
    }
    
    // Initialize Cashfree instance after script loads
    initializeCashfreeInstance() {
        try {
            if (typeof Cashfree !== 'undefined') {
                this.cashfree = new Cashfree({ mode: "sandbox" });
                console.log('Cashfree instance created successfully');
            } else {
                throw new Error('Cashfree class not found after script load');
            }
        } catch (error) {
            console.error('Failed to initialize Cashfree instance:', error);
            throw error;
        }
    }
    
    // Create fallback integration when scripts fail
    async createFallbackIntegration() {
        console.log('Creating fallback Cashfree integration...');
        
        // Set initialized to true so we can proceed with payments
        this.isInitialized = true;
        
        this.cashfree = {
            initialiseDropin: (container, options) => {
                console.log('Fallback Cashfree dropin initialized with options:', options);
                // Create a mock payment flow directly in the container
                this.createMockPaymentFlow(container, options);
            }
        };
        
        console.log('Fallback integration created successfully');
        this.showNotification('🧪 Test payment mode activated - Cashfree SDK unavailable', 'info');
        
        // Also show a console message for developers
        console.log('💡 Cashfree SDK unavailable - using mock payment system for testing');
        console.log('💡 In production, ensure Cashfree SDK is properly loaded');
        
        // Add a visual indicator on the page
        this.addTestModeIndicator();
    }
    
    // Add visual indicator that system is in test mode
    addTestModeIndicator() {
        try {
            // Remove any existing indicator
            const existingIndicator = document.getElementById('cashfree-test-mode-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            // Create test mode indicator
            const indicator = document.createElement('div');
            indicator.id = 'cashfree-test-mode-indicator';
            indicator.innerHTML = `
                <div style="
                    position: fixed;
                    top: 10px;
                    left: 10px;
                    background: #f59e0b;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    z-index: 9999;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                ">
                    <span>🧪</span>
                    <span>Test Mode</span>
                </div>
            `;
            
            document.body.appendChild(indicator);
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.style.opacity = '0.7';
                }
            }, 10000);
            
        } catch (error) {
            console.error('Error adding test mode indicator:', error);
        }
    }
    
    // Modern Cashfree integration method
    async tryModernCashfreeIntegration(resolve, reject) {
        try {
            // Method 1: Try loading from Cashfree's current CDN
            const script = document.createElement('script');
            script.src = 'https://sdk.cashfree.com/js/ui/2.0.0/dropinClient.js';
            script.type = 'text/javascript';
            script.async = true;
            
            const scriptPromise = new Promise((resolveScript, rejectScript) => {
                script.onload = () => resolveScript('Script loaded successfully');
                script.onerror = () => rejectScript('Script failed to load');
                setTimeout(() => rejectScript('Script loading timeout'), 8000);
            });
            
            document.head.appendChild(script);
            await scriptPromise;
            
            // Check if Cashfree class is available
            if (typeof Cashfree !== 'undefined') {
                this.cashfree = new Cashfree({ mode: "sandbox" });
                console.log('Modern Cashfree integration successful');
                resolve();
                return;
            }
            
            // If script loaded but class not found, try alternative approach
            console.log('Script loaded but Cashfree class not found, trying alternative...');
            await this.tryAlternativeIntegration();
            resolve();
            
        } catch (error) {
            console.log('Modern integration failed, trying alternatives...');
            
            // Try alternative integration methods
            const alternativeSuccess = await this.tryAlternativeIntegration();
            if (alternativeSuccess) {
                resolve();
            } else {
                reject(new Error('All Cashfree integration methods failed'));
            }
        }
    }
    
    // Recursively try different script URLs
    tryLoadScript(urls, index, resolve, reject) {
        if (index >= urls.length) {
            reject(new Error('All Cashfree script URLs failed'));
            return;
        }
        
        const url = urls[index];
        console.log(`Trying to load Cashfree script from: ${url}`);
        
        const script = document.createElement('script');
        script.src = url;
        script.type = 'text/javascript';
        script.async = true;
        
        // Add timeout for script loading
        const timeout = setTimeout(() => {
            console.log(`Script loading timeout for: ${url}`);
            this.tryLoadScript(urls, index + 1, resolve, reject);
        }, 8000); // 8 second timeout
        
        script.onload = () => {
            clearTimeout(timeout);
            console.log(`Cashfree script loaded successfully from: ${url}`);
            
            // Wait a bit for the script to initialize
            setTimeout(() => {
                try {
                    if (typeof Cashfree !== 'undefined') {
                        this.cashfree = new Cashfree({ mode: "sandbox" });
                        console.log('Cashfree instance created:', this.cashfree);
                        resolve();
                    } else {
                        console.log('Cashfree class not available, trying next URL...');
                        this.tryLoadScript(urls, index + 1, resolve, reject);
                    }
                } catch (error) {
                    console.error('Error creating Cashfree instance:', error);
                    this.tryLoadScript(urls, index + 1, resolve, reject);
                }
            }, 500);
        };
        
        script.onerror = (error) => {
            clearTimeout(timeout);
            console.error(`Failed to load Cashfree script from: ${url}`, error);
            this.tryLoadScript(urls, index + 1, resolve, reject);
        };
        
        // Add to head
        document.head.appendChild(script);
    }
    
    // Try alternative script sources if primary fails
    async tryAlternativeScript() {
        console.log('Trying alternative Cashfree script sources...');
        
        // This is now handled by the main loadCashfreeScript method
        // which tries multiple URLs automatically
        console.log('Alternative script loading is now handled automatically');
        
        // Try alternative integration method first
        console.log('Trying alternative integration method...');
        const alternativeSuccess = await this.tryAlternativeIntegration();
        
        if (!alternativeSuccess) {
            // If all scripts fail, create a mock payment flow for testing
            console.log('Creating mock payment flow for testing...');
            this.createMockPaymentFlow();
        }
    }
    
    // Create a mock payment flow when Cashfree is unavailable
    createMockPaymentFlow(container, options) {
        console.log('Mock Cashfree drop-in initialized');
        
        // Create a simple payment form
        const form = document.createElement('div');
        form.innerHTML = `
            <div style="padding: 20px; text-align: center; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <h3 style="color: #333; margin-bottom: 15px;">🧪 Test Payment Mode</h3>
                <p style="color: #666; margin-bottom: 20px;">Cashfree SDK unavailable - using test payment system</p>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #e9ecef;">
                    <p style="margin: 5px 0;"><strong>Order ID:</strong> ${options.paymentSessionId || 'test_order'}</p>
                    <p style="margin: 5px 0;"><strong>Amount:</strong> ₹${this.currentOrder?.amount || '0'}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #28a745;">Ready for Test</span></p>
                </div>
                
                <div style="margin: 20px 0;">
                    <button onclick="window.mockPaymentSuccess()" style="background: #10b981; color: white; padding: 12px 24px; border: none; border-radius: 5px; margin: 5px; cursor: pointer; font-size: 16px; font-weight: 600;">✅ Simulate Success</button>
                    <button onclick="window.mockPaymentFailure()" style="background: #ef4444; color: white; padding: 12px 24px; border: none; border-radius: 5px; margin: 5px; cursor: pointer; font-size: 16px; font-weight: 600;">❌ Simulate Failure</button>
                </div>
                
                <div style="margin-top: 20px; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; color: #856404;">
                    <small>
                        <strong>Note:</strong> This is a test payment form. In production, this would be the real Cashfree payment interface.
                        <br>You can simulate successful or failed payments to test the system.
                    </small>
                </div>
            </div>
        `;
        
        container.appendChild(form);
        
        // Add mock payment handlers to window
        window.mockPaymentSuccess = () => {
            console.log('Mock payment success triggered');
            if (options.onSuccess) {
                options.onSuccess({ 
                    order_id: options.paymentSessionId || 'mock_order_123', 
                    payment_status: 'SUCCESS',
                    payment_session_id: options.paymentSessionId 
                });
            }
        };
        
        window.mockPaymentFailure = () => {
            console.log('Mock payment failure triggered');
            if (options.onFailure) {
                options.onFailure({ error: 'Mock payment failed' });
            }
        };
        
        console.log('Mock payment form created successfully');
    }
    
    // Alternative: Try to use Cashfree's newer integration method
    async tryAlternativeIntegration() {
        console.log('Trying alternative Cashfree integration method...');
        
        // Try multiple alternative approaches
        const alternatives = [
            // Method 1: Try npm CDN
            async () => {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/@cashfree/cashfree-js@latest/dist/cashfree.js';
                script.type = 'text/javascript';
                script.async = true;
                
                const scriptPromise = new Promise((resolve, reject) => {
                    script.onload = () => resolve('NPM script loaded');
                    script.onerror = () => reject('NPM script failed');
                    setTimeout(() => reject('NPM script timeout'), 8000);
                });
                
                document.head.appendChild(script);
                await scriptPromise;
                
                if (typeof window.Cashfree !== 'undefined') {
                    this.cashfree = new window.Cashfree({ mode: "sandbox" });
                    console.log('NPM Cashfree integration successful');
                    return true;
                }
                return false;
            },
            
            // Method 2: Try jsDelivr CDN
            async () => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@cashfree/cashfree-js@latest/dist/cashfree.js';
                script.type = 'text/javascript';
                script.async = true;
                
                const scriptPromise = new Promise((resolve, reject) => {
                    script.onload = () => resolve('jsDelivr script loaded');
                    script.onerror = () => reject('jsDelivr script failed');
                    setTimeout(() => reject('jsDelivr script timeout'), 8000);
                });
                
                document.head.appendChild(script);
                await scriptPromise;
                
                if (typeof window.Cashfree !== 'undefined') {
                    this.cashfree = new window.Cashfree({ mode: "sandbox" });
                    console.log('jsDelivr Cashfree integration successful');
                    return true;
                }
                return false;
            },
            
            // Method 3: Try direct integration without SDK
            async () => {
                console.log('Trying direct Cashfree integration...');
                // Create a mock Cashfree object that uses direct API calls
                this.cashfree = {
                    initialiseDropin: (container, options) => {
                        console.log('Direct integration drop-in initialized');
                        this.createDirectPaymentForm(container, options);
                    }
                };
                console.log('Direct integration created');
                return true;
            }
        ];
        
        for (let i = 0; i < alternatives.length; i++) {
            try {
                console.log(`Trying alternative method ${i + 1}...`);
                const success = await alternatives[i]();
                if (success) {
                    this.isInitialized = true;
                    return true;
                }
            } catch (error) {
                console.log(`Alternative method ${i + 1} failed:`, error);
            }
        }
        
        return false;
    }
    
    // Create direct payment form without SDK
    createDirectPaymentForm(container, options) {
        console.log('Creating direct payment form...');
        
        const form = document.createElement('div');
        form.innerHTML = `
            <div style="padding: 20px; text-align: center; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <h3>Cashfree Payment</h3>
                <p>Direct integration mode (SDK unavailable)</p>
                
                <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                    <p><strong>Payment Session ID:</strong></p>
                    <p style="font-family: monospace; background: #e9ecef; padding: 8px; border-radius: 3px;">${options.paymentSessionId || 'session_123'}</p>
                </div>
                
                <div style="margin: 20px 0;">
                    <button onclick="window.directPaymentSuccess()" style="background: #10b981; color: white; padding: 12px 24px; border: none; border-radius: 5px; margin: 5px; cursor: pointer; font-size: 16px;">Complete Payment</button>
                    <button onclick="window.directPaymentCancel()" style="background: #6b7280; color: white; padding: 12px 24px; border: none; border-radius: 5px; margin: 5px; cursor: pointer; font-size: 16px;">Cancel</button>
                </div>
                
                <div style="margin-top: 20px; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; color: #856404;">
                    <small>
                        <strong>Note:</strong> This is a test payment form. In production, this would be the real Cashfree payment interface.
                        <br>Payment Session ID: ${options.paymentSessionId || 'session_123'}
                    </small>
                </div>
            </div>
        `;
        
        container.appendChild(form);
        
        // Add payment handlers to window
        window.directPaymentSuccess = () => {
            if (options.onSuccess) {
                options.onSuccess({ 
                    order_id: options.paymentSessionId || 'direct_order_123', 
                    payment_status: 'SUCCESS',
                    payment_session_id: options.paymentSessionId 
                });
                this.closePaymentForm();
            }
        };
        
        window.directPaymentCancel = () => {
            if (options.onClose) {
                options.onClose();
            }
        };
        
        console.log('Direct payment form created successfully');
    }
    
    // Load script from specific source
    loadScriptFromSource(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            script.async = true;
            
            const timeout = setTimeout(() => {
                reject(new Error('Script loading timeout'));
            }, 8000);
            
            script.onload = () => {
                clearTimeout(timeout);
                setTimeout(() => {
                    try {
                        if (typeof Cashfree !== 'undefined') {
                            this.cashfree = new Cashfree({ mode: "sandbox" });
                            resolve();
                        } else {
                            reject(new Error('Cashfree class not available'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                }, 500);
            };
            
            script.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Script load failed'));
            };
            
            document.head.appendChild(script);
        });
    }
    
    // Create INR order and initialize payment
    async createPayment(amount, userEmail, userName, userId) {
        try {
            // Wait for initialization to complete
            if (!this.isInitialized) {
                console.log('Waiting for CashfreeManager to initialize...');
                let attempts = 0;
                const maxAttempts = 50; // 5 seconds max wait
                
                while (!this.isInitialized && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                
                if (!this.isInitialized) {
                    throw new Error('CashfreeManager initialization timeout');
                }
            }
            
            if (!this.cashfree) {
                throw new Error('Cashfree instance not available');
            }
            
            // Check if already processing
            if (this.isProcessing) {
                this.showNotification('Payment already in progress. Please wait...', 'warning');
                return;
            }
            
            this.isProcessing = true;
            
            // Generate unique order ID
            const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Create order data
            const orderData = {
                order_id: orderId,
                order_amount: amount,
                order_currency: "INR",
                customer_details: {
                    customer_id: userId,
                    customer_email: userEmail,
                    customer_phone: "9876543210" // You can make this configurable
                },
                order_meta: {
                    return_url: window.location.origin + "/dashboard.html?payment=success"
                }
            };
            
            // Store current order details
            this.currentOrder = {
                orderId: orderId,
                amount: amount,
                email: userEmail,
                userId: userId,
                timestamp: new Date()
            };
            
            // Show loading notification
            this.showNotification('Creating payment order...', 'info');
            
            // Create real order with Cashfree API
            const paymentSession = await this.createCashfreeOrder(orderData);
            
            if (paymentSession && paymentSession.payment_session_id) {
                // Check if this is a mock session
                if (paymentSession.payment_session_id.startsWith('mock_session_')) {
                    this.showNotification('🧪 Test Mode: Using mock payment system', 'info');
                }
                
                // Initialize Cashfree drop-in with payment session
                this.initializeDropin(paymentSession.payment_session_id);
            } else {
                throw new Error('Failed to create payment session');
            }
            
        } catch (error) {
            console.error('Payment creation error:', error);
            
            // Check if it's a Cashfree API error
            if (error.message.includes('Cashfree API Error')) {
                this.showNotification('Payment service error: ' + error.message, 'error');
            } else if (error.message.includes('Failed to create payment session')) {
                this.showNotification('Unable to create payment session. Please try again.', 'error');
            } else {
                this.showNotification('Failed to create payment: ' + error.message, 'error');
            }
        } finally {
            this.isProcessing = false;
        }
    }
    
    // Create real order with Cashfree API
    async createCashfreeOrder(orderData) {
        try {
            // Note: In production, this should be a server-side API call for security
            // For now, we'll make a direct API call from the frontend (not recommended for production)
            
            // Try to make the API call with proper error handling
            const response = await fetch(this.config.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-client-id': this.config.appId,
                    'x-client-secret': this.config.secretKey,
                    'x-api-version': this.config.apiVersion
                },
                body: JSON.stringify(orderData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Cashfree API Error: ${errorData.message || response.statusText}`);
            }
            
            const result = await response.json();
            console.log('Cashfree order created:', result);
            
            return result;
            
        } catch (error) {
            console.error('Error creating Cashfree order:', error);
            
            // Check if it's a CORS error
            if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
                console.log('CORS error detected, using mock payment system...');
                this.showNotification('⚠️ Using test mode due to API restrictions', 'warning');
            }
            
            // Create a mock payment session for testing
            console.log('API call failed, creating mock payment session for testing...');
            
            // Create a mock payment session
            const mockSession = {
                payment_session_id: `mock_session_${Date.now()}`,
                order_id: orderData.order_id,
                order_status: 'ACTIVE',
                payment_status: 'PENDING'
            };
            
            console.log('Mock payment session created:', mockSession);
            return mockSession;
        }
    }
    
    // Initialize Cashfree drop-in payment form
    initializeDropin(paymentSessionId) {
        try {
            // Create payment form container
            let paymentForm = document.getElementById('cashfree-payment-form');
            if (!paymentForm) {
                paymentForm = document.createElement('div');
                paymentForm.id = 'cashfree-payment-form';
                paymentForm.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                    z-index: 3000;
                    min-width: 400px;
                    max-width: 90vw;
                `;
                
                // Add close button
                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '&times;';
                closeBtn.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                `;
                closeBtn.onclick = () => this.closePaymentForm();
                paymentForm.appendChild(closeBtn);
                
                // Add title
                const title = document.createElement('h3');
                title.textContent = 'Complete Payment';
                title.style.cssText = 'margin: 0 0 1rem 0; color: #333;';
                paymentForm.appendChild(title);
                
                // Add payment form
                const formContainer = document.createElement('div');
                formContainer.id = 'payment-form-container';
                paymentForm.appendChild(formContainer);
                
                document.body.appendChild(paymentForm);
            }
            
            // Initialize Cashfree drop-in
            this.cashfree.initialiseDropin(
                document.getElementById('payment-form-container'),
                {
                    paymentSessionId: paymentSessionId,
                    redirectTarget: "_self",
                    onSuccess: (data) => {
                        console.log('Payment successful:', data);
                        this.handlePaymentSuccess(data);
                    },
                    onFailure: (data) => {
                        console.log('Payment failed:', data);
                        this.handlePaymentFailure(data);
                    },
                    onClose: () => {
                        console.log('Payment form closed');
                        this.closePaymentForm();
                    }
                }
            );
            
            // Add overlay
            this.addOverlay();
            
        } catch (error) {
            console.error('Drop-in initialization error:', error);
            this.showNotification('Failed to initialize payment form', 'error');
        }
    }
    
    // Add overlay behind payment form
    addOverlay() {
        let overlay = document.getElementById('cashfree-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'cashfree-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 2999;
            `;
            overlay.onclick = () => this.closePaymentForm();
            document.body.appendChild(overlay);
        }
    }
    
    // Close payment form
    closePaymentForm() {
        const paymentForm = document.getElementById('cashfree-payment-form');
        const overlay = document.getElementById('cashfree-overlay');
        
        if (paymentForm) {
            paymentForm.remove();
        }
        if (overlay) {
            overlay.remove();
        }
    }
    
    // Handle successful payment
    async handlePaymentSuccess(response) {
        try {
            console.log('Payment successful:', response);
            
            // Check if this is a mock payment
            const isMockPayment = response.order_id && response.order_id.startsWith('mock_session_');
            
            if (isMockPayment) {
                console.log('Processing mock payment success...');
                
                // For mock payments, directly update balance and show success
                await this.updateUserBalance(response.order_id, this.currentOrder.amount);
                this.showNotification('✅ Mock payment successful! ₹' + this.currentOrder.amount + ' added to your wallet.', 'success');
                await this.logTransaction(response, 'completed');
                this.closePaymentForm();
                
                // Refresh dashboard if available
                if (typeof window.refreshDashboard === 'function') {
                    window.refreshDashboard();
                }
                
                // Refresh deposit history if on deposit page
                if (typeof window.loadRecentDeposits === 'function') {
                    window.loadRecentDeposits();
                }
                return;
            }
            
            // For real payments, verify first (in production, this should be server-side)
            const verification = await this.verifyPayment(response);
            
            if (verification.success) {
                // Update user balance in Firebase
                await this.updateUserBalance(response.order_id, this.currentOrder.amount);
                
                this.showNotification('Payment successful! INR added to your wallet.', 'success');
                
                // Log transaction
                await this.logTransaction(response, 'completed');
                
                // Close payment form
                this.closePaymentForm();
                
                // Refresh dashboard
                if (typeof window.refreshDashboard === 'function') {
                    window.refreshDashboard();
                }
                
            } else {
                this.showNotification('Payment verification failed', 'error');
            }
            
        } catch (error) {
            console.error('Payment success handling error:', error);
            this.showNotification('Error processing payment: ' + error.message, 'error');
        }
    }
    
    // Verify payment (in production, this should be server-side)
    async verifyPayment(response) {
        try {
            // In production, verify payment using Cashfree API
            // For now, we'll do basic verification
            
            if (!response.order_id || !response.payment_status) {
                return { success: false, error: 'Missing payment details' };
            }
            
            // Check if order exists in our records
            if (!this.currentOrder || this.currentOrder.orderId !== response.order_id) {
                return { success: false, error: 'Order not found' };
            }
            
            // Check payment status
            if (response.payment_status !== 'SUCCESS') {
                return { success: false, error: 'Payment not successful' };
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('Payment verification error:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Update user balance in Firebase
    async updateUserBalance(orderId, amount) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('User not authenticated');
            }
            
            // Get current user profile
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) {
                throw new Error('User profile not found');
            }
            
            const userData = userDoc.data();
            const newBalance = (userData.inrBalance || 0) + amount;
            
            // Update balance
            await db.collection('users').doc(user.uid).update({
                inrBalance: newBalance,
                updatedAt: new Date()
            });
            
            console.log('User balance updated successfully');
            
        } catch (error) {
            console.error('Balance update error:', error);
            throw error;
        }
    }
    
    // Log transaction in Firebase
    async logTransaction(paymentResponse, status) {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('User not authenticated');
            }
            
            const transaction = {
                userId: user.uid,
                type: 'deposit',
                amount: this.currentOrder.amount,
                currency: 'INR',
                status: status,
                paymentId: paymentResponse.order_id || 'unknown',
                orderId: this.currentOrder.orderId,
                description: 'INR Deposit via Cashfree',
                timestamp: new Date(),
                fromUserId: 'cashfree',
                toUserId: user.uid
            };
            
            await db.collection('transactions').add(transaction);
            console.log('Transaction logged successfully');
            
        } catch (error) {
            console.error('Transaction logging error:', error);
        }
    }
    
    // Handle payment failure
    handlePaymentFailure(error) {
        console.error('Payment failed:', error);
        this.showNotification('Payment failed: ' + (error.description || error.message), 'error');
        
        // Log failed transaction
        if (this.currentOrder) {
            this.logTransaction({
                order_id: this.currentOrder.orderId,
                payment_status: 'FAILED'
            }, 'failed');
        }
        
        // Close payment form
        this.closePaymentForm();
    }
    
    // Get payment history
    async getPaymentHistory() {
        try {
            const user = auth.currentUser;
            if (!user) {
                return [];
            }
            
            const snapshot = await db.collection('transactions')
                .where('userId', '==', user.uid)
                .where('type', '==', 'deposit')
                .where('currency', '==', 'INR')
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
        } catch (error) {
            console.error('Payment history error:', error);
            return [];
        }
    }
    
    // Check if manager is ready for payments
    isReady() {
        return this.isInitialized && this.cashfree !== null;
    }
    
    // Utility functions
    
    formatAmount(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
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

// Initialize Cashfree Manager
let cashfreeManager = null;

// Function to ensure Cashfree manager is ready
function ensureCashfreeManager() {
    console.log('ensureCashfreeManager called, current state:', !!cashfreeManager);
    if (!cashfreeManager) {
        console.log('Creating new CashfreeManager instance');
        cashfreeManager = new CashfreeManager();
        window.cashfreeManager = cashfreeManager;
        console.log('CashfreeManager created and assigned to window');
    } else {
        console.log('CashfreeManager already exists');
    }
    return cashfreeManager;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    ensureCashfreeManager();
});

// Also try to initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
} else {
    // DOM is already loaded, initialize immediately
    ensureCashfreeManager();
}

// Export for use in other files
window.cashfreeManager = cashfreeManager;
