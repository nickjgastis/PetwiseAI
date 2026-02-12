import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { supabase } from '../supabaseClient';
import { FaArrowLeft, FaLock, FaTrash, FaUser, FaEnvelope, FaCalendar, FaCreditCard } from 'react-icons/fa';
import { clearAppLocalStorage } from '../utils/clearUserData';

const getOptimizedImageUrl = (url) => {
    if (!url) return null;

    if (url.includes('googleusercontent.com')) {
        const baseUrl = url.split('=')[0];
        return `${baseUrl}=s200-c`;
    }

    if (url.includes('gravatar.com')) {
        const hash = url.split('/').pop().split('?')[0];
        return `https://secure.gravatar.com/avatar/${hash}?s=200&d=mp`;
    }

    if (url.includes('cdn.auth0.com')) {
        return url.split('?')[0];
    }

    return url;
};

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const ManageAccount = ({ user, onBack }) => {
    const { logout } = useAuth0();
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [userData, setUserData] = useState(null);
    const [isPasswordChangeLoading, setIsPasswordChangeLoading] = useState(false);

    // Check if user signed up with email/password (not social login like Google)
    const isEmailPasswordUser = user?.sub?.startsWith('auth0|');

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select(`
                        subscription_status,
                        subscription_end_date,
                        subscription_interval,
                        cancel_at_period_end,
                        stripe_customer_id
                    `)
                    .eq('auth0_user_id', user.sub)
                    .single();

                if (error) throw error;
                setUserData(data);
            } catch (error) {
                console.error('Error fetching user data:', error);
                setError('Failed to load user information');
            }
        };

        fetchUserData();
    }, [user.sub]);

    const handlePasswordChange = async () => {
        setError('');
        setMessage('');
        setIsPasswordChangeLoading(true);

        try {
            const response = await fetch(`${API_URL}/request-password-change`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: user.email
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send password reset email');
            }

            setMessage('Password reset email sent! Check your inbox.');
        } catch (error) {
            console.error('Password change error:', error);
            setError(error.message);
        } finally {
            setIsPasswordChangeLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!showConfirmDialog) {
            setShowConfirmDialog(true);
            return;
        }

        try {
            const response = await fetch(`${API_URL}/delete-account`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user.sub
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete account');
            }

            // Clear all app data
            clearAppLocalStorage();

            // First logout from Auth0 without returnTo
            await logout({
                clientId: process.env.REACT_APP_AUTH0_CLIENT_ID,
                federated: true
            });

            // Then force redirect - PWA stays on app domain
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                                window.navigator.standalone === true;
            window.location.href = isStandalone ? 'https://app.petwise.vet' : 'https://petwise.vet';

        } catch (error) {
            console.error('Delete error:', error);
            setError(error.message);
        }
    };

    const getSubscriptionLabel = () => {
        if (!userData?.subscription_interval) return 'None';
        const labels = {
            trial: 'Free Trial (Legacy)',
            stripe_trial: '14-Day Trial',
            monthly: 'Monthly',
            yearly: 'Yearly'
        };
        return labels[userData.subscription_interval] || 'Unknown';
    };

    return (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#2a5298] via-[#3468bd] to-[#1e3a6e] flex flex-col items-center p-4 sm:p-8 overflow-y-auto pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Header with back button */}
            <div className="w-full max-w-2xl mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
                >
                    <FaArrowLeft />
                    <span>Back to Profile</span>
                </button>
            </div>

            {/* Title */}
            <div className="text-center mb-6 sm:mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <img src="/PW.png" alt="Petwise" className="w-10 h-10 sm:w-12 sm:h-12" />
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">
                        Manage Account
                    </h1>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="w-full max-w-2xl mb-4 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-xl">
                    {error}
                </div>
            )}
            {message && (
                <div className="w-full max-w-2xl mb-4 bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded-xl">
                    {message}
                </div>
            )}

            {/* Main Content */}
            <div className="w-full max-w-2xl space-y-4 sm:space-y-6">
                {/* Profile Card */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl">
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                        <img
                            src={getOptimizedImageUrl(user?.picture)}
                            alt={user?.name || 'User'}
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-[#3468bd]/20 shadow-lg bg-gray-100"
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                                e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ccc' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
                            }}
                        />
                        <div className="text-center sm:text-left">
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{user.name}</h2>
                            <p className="text-gray-500 flex items-center justify-center sm:justify-start gap-2 mt-1">
                                <FaEnvelope className="text-sm" />
                                {user.email}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Subscription Details Card */}
                {userData && (
                    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <FaCreditCard className="text-[#3468bd]" />
                            Subscription Details
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                <span className="text-gray-600 font-medium">Status</span>
                                <span className={`font-semibold ${userData?.subscription_status === 'active' ? 'text-green-600' : 'text-red-500'}`}>
                                    {userData?.subscription_status === 'active' ? '● Active' : '○ Inactive'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                <span className="text-gray-600 font-medium">Plan</span>
                                <span className="text-gray-800 font-semibold">{getSubscriptionLabel()}</span>
                            </div>
                            {userData?.subscription_end_date && (
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                    <span className="text-gray-600 font-medium flex items-center gap-2">
                                        <FaCalendar className="text-sm" />
                                        {userData.subscription_interval === 'trial' ? 'Expires' : 
                                         userData.subscription_interval === 'stripe_trial' ? 'Trial Ends' : 'Renews'}
                                    </span>
                                    <span className="text-gray-800 font-semibold">
                                        {new Date(userData.subscription_end_date).toLocaleDateString()}
                                        {userData.subscription_interval === 'stripe_trial' && (
                                            <span className={`ml-2 text-xs ${userData.cancel_at_period_end ? 'text-orange-500' : 'text-blue-500'}`}>
                                                {userData.cancel_at_period_end ? '(Canceling)' : '(Auto-converts to monthly)'}
                                            </span>
                                        )}
                                        {!['trial', 'stripe_trial'].includes(userData.subscription_interval) && userData.stripe_customer_id && (
                                            <span className={`ml-2 text-xs ${userData.cancel_at_period_end ? 'text-orange-500' : 'text-green-500'}`}>
                                                {userData.cancel_at_period_end ? '(Canceling)' : '(Auto-renew)'}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Security Card */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <FaLock className="text-[#3468bd]" />
                        Security
                    </h3>
                    {isEmailPasswordUser ? (
                        <>
                            <p className="text-gray-600 mb-4 text-sm">
                                Change your account password. A reset link will be sent to your email.
                            </p>
                            <button
                                onClick={handlePasswordChange}
                                disabled={isPasswordChangeLoading}
                                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#3468bd] to-[#2a5298] text-white font-semibold rounded-xl hover:from-[#2a5298] hover:to-[#1e3a6e] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                            >
                                {isPasswordChangeLoading ? 'Sending...' : 'Change Password'}
                            </button>
                        </>
                    ) : (
                        <p className="text-gray-600 text-sm">
                            You signed in with Google. To change your password, please visit your{' '}
                            <a 
                                href="https://myaccount.google.com/security" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[#3468bd] hover:underline font-medium"
                            >
                                Google account settings
                            </a>.
                        </p>
                    )}
                </div>

                {/* Danger Zone Card */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl border-2 border-red-100">
                    <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                        <FaTrash />
                        Danger Zone
                    </h3>
                    {!showConfirmDialog ? (
                        <>
                            <p className="text-gray-600 mb-4 text-sm">
                                Permanently delete your account and all associated data. This action cannot be undone.
                            </p>
                            <button
                                onClick={handleDeleteAccount}
                                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                            >
                                Delete Account
                            </button>
                        </>
                    ) : (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                            <p className="text-red-700 font-medium mb-4">
                                Are you absolutely sure? This action cannot be undone. All subscriptions will be permanently canceled with no way to restore them.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={handleDeleteAccount}
                                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-red-700 transition-all"
                                >
                                    Yes, Delete My Account
                                </button>
                                <button
                                    onClick={() => setShowConfirmDialog(false)}
                                    className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer note */}
            <p className="text-white/60 text-xs mt-8 text-center max-w-md">
                Need help? Contact us at support@petwise.vet
            </p>
            {/* Extra spacer for mobile safe area */}
            <div className="flex-shrink-0 w-full" style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }} />
        </div>
    );
};

export default ManageAccount;
