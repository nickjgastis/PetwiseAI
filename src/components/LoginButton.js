import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const LoginButton = () => {
    const { loginWithRedirect } = useAuth0();

    const handleLogin = () => {
        // Clear any existing Auth0 session from localStorage
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('@@auth0spajs@@')) {
                localStorage.removeItem(key);
            }
        });

        loginWithRedirect({
            authorizationParams: {
                prompt: "login", // Forces login screen
            },
            // Force a fresh login experience
            ignoreCache: true,
            // Clear any existing SSO session
            clearSession: true,
            // Additional parameters to ensure fresh login
            initialScreen: 'login',
            // Disable automatic sign-in with last used account
            skipRedirectCallback: true
        });
    };

    return <button onClick={handleLogin}>Log In</button>;
};

export default LoginButton;
