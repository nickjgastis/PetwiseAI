import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { supabase } from '../supabaseClient';
import '../styles/ManageAccount.css';

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
                    .select('subscription_status, subscription_end_date, subscription_type, subscription_interval, cancel_at_period_end')
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

            await logout({ returnTo: window.location.origin });
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
                    <img src={user.picture} alt={user.name} className="profile-picture" />
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
                                    {userData?.subscription_type ? (
                                        <>
                                            {userData.subscription_type === 'singleUser' && 'Single User'}
                                            {userData.subscription_type === 'multiUser' && 'Multi User'}
                                            {userData.subscription_type === 'clinic' && 'Clinic'}
                                            {userData.subscription_type === 'trial' && 'Trial'}
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
                                        {userData.cancel_at_period_end ?
                                            ' (Will not renew)' :
                                            ' (Will auto-renew)'}
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