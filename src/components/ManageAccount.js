import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaLock, FaTrash, FaGoogle } from 'react-icons/fa';
import { clearAppLocalStorage } from '../utils/clearUserData';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

// Inline account panel — rendered inside the Profile settings layout (desktop)
// or as a full page on mobile (pass onBack to show the back row).
const ManageAccount = ({ user, onBack }) => {
    const { logout } = useAuth0();
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [isPasswordChangeLoading, setIsPasswordChangeLoading] = useState(false);

    // Check if user signed up with email/password (not social login like Google)
    const isEmailPasswordUser = user?.sub?.startsWith('auth0|');

    const handlePasswordChange = async () => {
        setError('');
        setMessage('');
        setIsPasswordChangeLoading(true);

        try {
            const response = await fetch(`${API_URL}/request-password-change`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email })
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.sub })
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

    return (
        <div>
            {onBack && (
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors mb-5 text-sm font-medium"
                >
                    <FaArrowLeft className="text-xs" />
                    <span>Back to Profile</span>
                </button>
            )}

            {/* Messages */}
            {error && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                </motion.div>
            )}
            {message && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">
                    {message}
                </motion.div>
            )}

            <div className="space-y-5">
                {/* Security */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                        <FaLock className="text-[#3468bd] text-xs" />
                        Security
                    </h3>
                    {isEmailPasswordUser ? (
                        <>
                            <p className="text-gray-500 text-[13px] mb-4">
                                Change your account password. A reset link will be sent to your email.
                            </p>
                            <button
                                onClick={handlePasswordChange}
                                disabled={isPasswordChangeLoading}
                                className="px-4 py-2.5 bg-[#3468bd] text-white font-semibold rounded-xl text-sm hover:bg-[#2a5298] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPasswordChangeLoading ? 'Sending...' : 'Change Password'}
                            </button>
                        </>
                    ) : (
                        <p className="text-gray-500 text-[13px] flex items-center gap-2 flex-wrap">
                            <FaGoogle className="text-gray-400" />
                            You signed in with Google. To change your password, visit your{' '}
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

                {/* Danger Zone */}
                <div className="rounded-2xl border border-red-200 bg-white p-5">
                    <h3 className="text-sm font-bold text-red-600 mb-1 flex items-center gap-2">
                        <FaTrash className="text-xs" />
                        Danger Zone
                    </h3>
                    {!showConfirmDialog ? (
                        <>
                            <p className="text-gray-500 text-[13px] mb-4">
                                Permanently delete your account and all associated data. This action cannot be undone.
                            </p>
                            <button
                                onClick={handleDeleteAccount}
                                className="px-4 py-2.5 bg-white text-red-600 font-semibold rounded-xl text-sm border border-red-200 hover:bg-red-50 transition-all"
                            >
                                Delete Account
                            </button>
                        </>
                    ) : (
                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 border border-red-200 rounded-xl p-4 mt-2">
                            <p className="text-red-700 text-sm font-medium mb-4">
                                Are you absolutely sure? This action cannot be undone. All subscriptions will be permanently canceled with no way to restore them.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={handleDeleteAccount}
                                    className="px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl text-sm hover:bg-red-700 transition-all"
                                >
                                    Yes, Delete My Account
                                </button>
                                <button
                                    onClick={() => setShowConfirmDialog(false)}
                                    className="px-4 py-2.5 bg-white text-gray-700 font-semibold rounded-xl text-sm border border-gray-200 hover:bg-gray-50 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            <p className="text-gray-400 text-xs mt-5">
                Need help? Contact us at <a href="mailto:support@petwise.vet" className="text-[#3468bd] hover:underline">support@petwise.vet</a>
            </p>
        </div>
    );
};

export default ManageAccount;
