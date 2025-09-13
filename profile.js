// Profile Page JavaScript
class ProfilePage {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthState();
        this.setupMobileMenu();
    }

    setupEventListeners() {
        // Profile actions
        document.getElementById('edit-profile-btn').addEventListener('click', () => this.editProfile());
        document.getElementById('change-email-btn').addEventListener('click', () => this.changeEmail());
        document.getElementById('copy-address-btn').addEventListener('click', () => this.copyWalletAddress());
        
        // Security settings
        document.getElementById('change-password-btn').addEventListener('click', () => this.showPasswordModal());
        document.getElementById('setup-2fa-btn').addEventListener('click', () => this.setup2FA());
        document.getElementById('view-sessions-btn').addEventListener('click', () => this.viewSessions());
        
        // Password modal
        document.getElementById('close-password-modal').addEventListener('click', () => this.hidePasswordModal());
        document.getElementById('change-password-form').addEventListener('submit', (e) => this.handlePasswordChange(e));
        
        // Preferences
        document.getElementById('email-notifications').addEventListener('change', (e) => this.updatePreference('emailNotifications', e.target.checked));
        document.getElementById('push-notifications').addEventListener('change', (e) => this.updatePreference('pushNotifications', e.target.checked));
        document.getElementById('auto-refresh').addEventListener('change', (e) => this.updatePreference('autoRefresh', e.target.checked));
        
        // Account actions
        document.getElementById('deactivate-account-btn').addEventListener('click', () => this.deactivateAccount());
        document.getElementById('delete-account-btn').addEventListener('click', () => this.deleteAccount());
        
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
                this.updateProfileDisplay();
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.showNotification('Error loading profile', 'error');
        }
    }

    updateProfileDisplay() {
        if (!this.userProfile) return;
        
        // Update profile info
        document.getElementById('user-email').textContent = this.userProfile.email;
        document.getElementById('user-id').textContent = this.userProfile.userId;
        document.getElementById('member-since').textContent = this.formatDate(this.userProfile.createdAt);
        
        // Update account details
        document.getElementById('account-email').textContent = this.userProfile.email;
        document.getElementById('wallet-address').textContent = this.userProfile.walletAddress;
        document.getElementById('last-login').textContent = this.formatDate(this.userProfile.updatedAt);
        
        // Load preferences
        this.loadPreferences();
    }

    loadPreferences() {
        // Load saved preferences from Firestore or use defaults
        const preferences = this.userProfile.preferences || {
            emailNotifications: true,
            pushNotifications: false,
            autoRefresh: true
        };
        
        document.getElementById('email-notifications').checked = preferences.emailNotifications;
        document.getElementById('push-notifications').checked = preferences.pushNotifications;
        document.getElementById('auto-refresh').checked = preferences.autoRefresh;
    }

    formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays - 1} days ago`;
        
        return date.toLocaleDateString();
    }

    editProfile() {
        // In a real application, this would show an edit profile modal
        this.showNotification('Profile editing feature coming soon!', 'info');
    }

    changeEmail() {
        // In a real application, this would show an email change modal
        this.showNotification('Email change feature coming soon!', 'info');
    }

    copyWalletAddress() {
        const address = document.getElementById('wallet-address').textContent;
        
        try {
            navigator.clipboard.writeText(address).then(() => {
                this.showNotification('Wallet address copied to clipboard!', 'success');
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = address;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showNotification('Wallet address copied to clipboard!', 'success');
            });
        } catch (err) {
            this.showNotification('Failed to copy address', 'error');
        }
    }

    showPasswordModal() {
        document.getElementById('password-modal').style.display = 'block';
    }

    hidePasswordModal() {
        document.getElementById('password-modal').style.display = 'none';
        document.getElementById('change-password-form').reset();
    }

    async handlePasswordChange(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-new-password').value;
        
        if (newPassword !== confirmPassword) {
            this.showNotification('New passwords do not match', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            this.showNotification('New password must be at least 6 characters', 'error');
            return;
        }
        
        try {
            // In a real application, you would re-authenticate the user before changing password
            // For now, we'll simulate the password change
            this.showNotification('Password updated successfully!', 'success');
            this.hidePasswordModal();
            
        } catch (error) {
            console.error('Password change error:', error);
            this.showNotification('Error updating password', 'error');
        }
    }

    setup2FA() {
        // In a real application, this would initiate 2FA setup
        this.showNotification('Two-factor authentication setup coming soon!', 'info');
    }

    viewSessions() {
        // In a real application, this would show active login sessions
        this.showNotification('Login sessions feature coming soon!', 'info');
    }

    async updatePreference(key, value) {
        try {
            // Update preference in Firestore
            await db.collection('users').doc(this.currentUser.uid).update({
                [`preferences.${key}`]: value,
                updatedAt: new Date()
            });
            
            // Update local profile
            if (!this.userProfile.preferences) {
                this.userProfile.preferences = {};
            }
            this.userProfile.preferences[key] = value;
            
            this.showNotification('Preference updated successfully!', 'success');
            
        } catch (error) {
            console.error('Error updating preference:', error);
            this.showNotification('Error updating preference', 'error');
            
            // Revert the checkbox
            const checkbox = document.getElementById(key.replace(/([A-Z])/g, '-$1').toLowerCase());
            if (checkbox) {
                checkbox.checked = !value;
            }
        }
    }

    async deactivateAccount() {
        if (confirm('Are you sure you want to deactivate your account? This action can be reversed within 30 days.')) {
            try {
                // In a real application, this would deactivate the account
                this.showNotification('Account deactivation feature coming soon!', 'info');
            } catch (error) {
                console.error('Account deactivation error:', error);
                this.showNotification('Error deactivating account', 'error');
            }
        }
    }

    async deleteAccount() {
        if (confirm('Are you sure you want to permanently delete your account? This action cannot be undone and all data will be lost.')) {
            try {
                // In a real application, this would delete the account and all associated data
                this.showNotification('Account deletion feature coming soon!', 'info');
            } catch (error) {
                console.error('Account deletion error:', error);
                this.showNotification('Error deleting account', 'error');
            }
        }
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

// Initialize the profile page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ProfilePage();
});
