// Razorpay Integration for INR Deposits
class RazorpayManager {
    constructor() {
        this.razorpay = null;
        this.options = {
            key: 'rzp_test_YOUR_KEY_HERE', // Replace with your Razorpay test key
            currency: 'INR',
            name: 'CryptoPay',
            description: 'INR Deposit to Crypto Wallet',
            image: 'https://your-logo-url.com/logo.png',
            handler: this.handlePaymentSuccess.bind(this),
            prefill: {
                name: '',
                email: '',
                contact: ''
            },
            theme: {
                color: '#667eea'
            }
        };
        
        this.init();
    }
    
    init() {
        try {
            // Load Razorpay script if not already loaded
            if (typeof Razorpay === 'undefined') {
                this.loadRazorpayScript();
            } else {
                this.razorpay = new Razorpay(this.options);
            }
        } catch (error) {
            console.error('Razorpay initialization error:', error);
        }
    }
    
    loadRazorpayScript() {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
            this.razorpay = new Razorpay(this.options);
        };
        script.onerror = () => {
            console.error('Failed to load Razorpay script');
        };
        document.head.appendChild(script);
    }
    
    // Initialize payment
    async createPayment(amount, userEmail, userName) {
        try {
            if (!this.razorpay) {
                throw new Error('Razorpay not initialized');
            }
            
            // Update options for this payment
            this.options.amount = amount * 100; // Convert to paise
            this.options.prefill.email = userEmail;
            this.options.prefill.name = userName;
            
            // Create payment instance
            const payment = new Razorpay(this.options);
            
            // Open payment modal
            payment.open();
            
            // Store payment details for verification
            this.currentPayment = {
                amount: amount,
                email: userEmail,
                timestamp: new Date()
            };
            
        } catch (error) {
            console.error('Payment creation error:', error);
            this.showNotification('Failed to create payment: ' + error.message, 'error');
        }
    }
    
    // Handle successful payment
    async handlePaymentSuccess(response) {
        try {
            console.log('Payment successful:', response);
            
            // Verify payment on server (in production, this should be server-side)
            const verification = await this.verifyPayment(response);
            
            if (verification.success) {
                // Update user balance in Firebase
                await this.updateUserBalance(response.razorpay_payment_id, response.razorpay_amount / 100);
                
                this.showNotification('Payment successful! INR added to your wallet.', 'success');
                
                // Log transaction
                await this.logTransaction(response, 'completed');
                
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
            // In production, send payment_id and signature to your server for verification
            // For now, we'll do basic verification
            
            const requiredFields = ['razorpay_payment_id', 'razorpay_order_id', 'razorpay_signature'];
            const hasAllFields = requiredFields.every(field => response[field]);
            
            if (!hasAllFields) {
                return { success: false, error: 'Missing payment details' };
            }
            
            // Basic amount verification
            if (this.currentPayment && response.razorpay_amount / 100 !== this.currentPayment.amount) {
                return { success: false, error: 'Amount mismatch' };
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('Payment verification error:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Update user balance in Firebase
    async updateUserBalance(paymentId, amount) {
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
                amount: paymentResponse.razorpay_amount / 100,
                currency: 'INR',
                status: status,
                paymentId: paymentResponse.razorpay_payment_id,
                orderId: paymentResponse.razorpay_order_id,
                description: 'INR Deposit via Razorpay',
                timestamp: new Date(),
                fromUserId: 'razorpay',
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
        this.showNotification('Payment failed: ' + error.description, 'error');
        
        // Log failed transaction
        if (this.currentPayment) {
            this.logTransaction({
                razorpay_payment_id: 'failed_' + Date.now(),
                razorpay_amount: this.currentPayment.amount * 100
            }, 'failed');
        }
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

// Initialize Razorpay Manager
let razorpayManager;
document.addEventListener('DOMContentLoaded', () => {
    razorpayManager = new RazorpayManager();
});

// Export for use in other files
window.razorpayManager = razorpayManager;
