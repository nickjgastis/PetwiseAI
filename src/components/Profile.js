import React, { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import "../styles/Profile.css";

const Profile = () => {
    const { user, isAuthenticated, isLoading } = useAuth0();
    const navigate = useNavigate(); // Use navigate to redirect

    useEffect(() => {
        if (isAuthenticated && user) {
            // You can log user info here if needed
        }
    }, [isAuthenticated, user]);

    if (isLoading) {
        return <div className="profile-loading">Loading ...</div>;
    }

    const handleBillingClick = async () => {
        try {
            // Update the URL to point to your backend
            const response = await fetch('http://localhost:3001/create-billing-session', { // Change this line
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: user.sub }) // You can pass user ID or other necessary info
            });

            if (!response.ok) {
                throw new Error('Failed to create billing session');
            }

            const { url } = await response.json(); // Assuming the backend sends back a JSON response with the URL

            window.location.href = url; // Redirect the user to the billing portal
        } catch (error) {
            console.error('Error fetching billing session:', error);
        }
    };


    return (
        isAuthenticated && (
            <div className="profile-container">
                <div className="profile-header">
                    <img src={user.picture} alt={user.name} className="profile-picture" />
                    <h2>{user.name}</h2>
                    <p className="profile-email">{user.email}</p>
                </div>
                <div className="profile-details">
                    <h3>Profile Information</h3>
                    <div className="profile-info">
                        <div className="info-item">
                            <span className="info-label">User ID:</span>
                            <span className="info-value">{user.sub}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Nickname:</span>
                            <span className="info-value">{user.nickname || 'Not set'}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Email Verified:</span>
                            <span className="info-value">{user.email_verified ? 'Yes' : 'No'}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Last Updated:</span>
                            <span className="info-value">{new Date(user.updated_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                <div className="profile-actions">
                    <button className="profile-button">Edit Profile</button>
                    <button className="profile-button">Change Password</button>
                    <button className="profile-button" onClick={handleBillingClick}>Billing</button> {/* Billing button */}
                </div>
            </div>
        )
    );
};

export default Profile;
