import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { supabase } from '../supabaseClient';

const ManageAccount = ({ user, onBack }) => {
    const { logout, loginWithRedirect } = useAuth0();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handlePasswordChange = () => {
        loginWithRedirect({
            screen_hint: 'change_password'
        });
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            return;
        }

        try {
            const API_URL = process.env.NODE_ENV === 'production'
                ? 'https://api.petwise.vet'
                : 'http://localhost:3001';

            const response = await fetch(`${API_URL}/delete-account`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user.sub
                })
            });

            if (!response.ok) throw new Error('Failed to delete account');

            await logout({ returnTo: window.location.origin });
        } catch (error) {
            setError(error.message);
        }
    };

    return (
        <div className="manage-account-container">
            <h2>Manage Account</h2>

            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}

            <button onClick={handlePasswordChange} className="update-password-button">
                Change Password
            </button>

            <div className="danger-zone">
                <h3>Danger Zone</h3>
                <button
                    onClick={handleDeleteAccount}
                    className="delete-account-button"
                >
                    Delete Account
                </button>
            </div>

            <button onClick={onBack} className="back-button">
                ← Back
            </button>
        </div>
    );
};

export default ManageAccount; 