import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import "../styles/Profile.css";

const Profile = () => {
    const { user, isAuthenticated, isLoading } = useAuth0();

    if (isLoading) {
        return <div className="profile-loading">Loading ...</div>;
    }

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
                </div>
            </div>
        )
    );
};

export default Profile;
