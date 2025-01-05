import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const LoginButton = () => {
    const { loginWithRedirect } = useAuth0();

    const handleLogin = () => {
        loginWithRedirect({
            authorizationParams: {
                prompt: "select_account",
            },
            // Force a fresh login experience
            ignoreCache: true,
            // Clear any existing SSO session
            clearSession: true
        });
    };

    return <button onClick={handleLogin}>Log In</button>;
};

export default LoginButton;
