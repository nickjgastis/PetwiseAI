import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import '../styles/PWALogin.css';

const PWALogin = () => {
    const { loginWithRedirect } = useAuth0();

    const handleLogin = () => {
        loginWithRedirect();
    };

    const handleSignup = () => {
        loginWithRedirect({
            authorizationParams: {
                screen_hint: 'signup'
            }
        });
    };

    return (
        <div className="pwa-login">
            <div className="pwa-login-content">
                <img src="/apple-touch-icon.png" alt="PetWise" className="pwa-login-logo" />
                <h1>
                    <span className="logo-bold">Petwise</span>
                    <span className="logo-regular">.vet</span>
                </h1>
                <p>AI-Powered Veterinary Documentation</p>
                
                <div className="pwa-login-buttons">
                    <button onClick={handleLogin} className="pwa-login-btn primary">
                        Log In
                    </button>
                    <button onClick={handleSignup} className="pwa-login-btn secondary">
                        Sign Up
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PWALogin;
