import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { supabase } from '../supabaseClient';
import '../styles/ManageAccount.css';

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

const ManageAccount = ({ user, onBack }) => {
    const { logout } = useAuth0();
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [userData, setUserData] = useState(null);

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

    const handleDeleteAccount = async () => {
        if (!showConfirmDialog) {
            setShowConfirmDialog(true);
            return;
        }

        try {
            const API_URL = process.env.NODE_ENV === 'production'
                ? 'https://api.petwise.vet'
                : 'http://localhost:3001';

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

            // First logout from Auth0
            await logout({
                clientId: process.env.REACT_APP_AUTH0_CLIENT_ID,
                returnTo: process.env.NODE_ENV === 'production'
                    ? 'https://www.petwise.vet'
                    : 'http://localhost:3000',
                federated: true
            });

        } catch (error) {
            console.error('Delete error:', error);
            setError(error.message);
        }
    };

    return (
        <div className="manage-account-container">
            <h2>Manage Account</h2>

            <div className="user-info-section">
                <div className="user-profile">
                    <img
                        src={getOptimizedImageUrl(user?.picture)}
                        alt={user?.name || 'User'}
                        className="profile-picture"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                            console.log('ManageAccount image error, falling back to SVG');
                            e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ccc' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
                        }}
                        style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #eee',
                            backgroundColor: '#f5f5f5'
                        }}
                    />
                    <div className="user-details">
                        <h3>{user.name}</h3>
                        <p className="user-email">{user.email}</p>
                    </div>
                </div>

                {userData && (
                    <div className="subscription-info">
                        <h3>Subscription Details</h3>
                        <div className="subscription-details">
                            <div className="detail-item">
                                <span>Status:</span>
                                <span className={`status-${userData?.subscription_status || 'inactive'}`}>
                                    {userData?.subscription_status === 'active' ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="detail-item">
                                <span>Plan:</span>
                                <span>
                                    {userData?.subscription_interval ? (
                                        <>
                                            {userData.subscription_interval === 'trial' && 'Trial'}
                                            {userData.subscription_interval === 'monthly' && 'Monthly'}
                                            {userData.subscription_interval === 'yearly' && 'Yearly'}
                                        </>
                                    ) : (
                                        'None'
                                    )}
                                </span>
                            </div>
                            {userData?.subscription_end_date ? (
                                <div className="detail-item">
                                    <span>Renewal Date:</span>
                                    <span>
                                        {new Date(userData.subscription_end_date).toLocaleDateString()}
                                        {userData.subscription_interval !== 'trial' && userData.stripe_customer_id && (
                                            userData.cancel_at_period_end ?
                                                ' (Will not renew)' :
                                                ' (Will auto-renew)'
                                        )}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>

            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}

            <div className="danger-zone">
                <h3>Danger Zone</h3>
                {!showConfirmDialog ? (
                    <button
                        onClick={handleDeleteAccount}
                        className="delete-account-button"
                    >
                        Delete Account
                    </button>
                ) : (
                    <div className="confirm-delete">
                        <p>Are you absolutely sure? This action cannot be undone. All subscriptions will be permanently canceled with no way to restore them.</p>
                        <div className="confirm-buttons">
                            <button
                                onClick={handleDeleteAccount}
                                className="confirm-delete-button"
                            >
                                Yes, Delete My Account
                            </button>
                            <button
                                onClick={() => setShowConfirmDialog(false)}
                                className="cancel-delete-button"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <button onClick={onBack} className="back-button">
                ← Back
            </button>
        </div>
    );
};

export default ManageAccount; 