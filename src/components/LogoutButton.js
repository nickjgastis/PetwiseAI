import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const LogoutButton = () => {
    const { logout } = useAuth0();

    const handleLogout = () => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                            window.navigator.standalone === true;
        
        const returnUrl = process.env.NODE_ENV === 'production'
            ? (isStandalone ? 'https://app.petwise.vet' : 'https://petwise.vet')
            : 'http://localhost:3000';
        
        localStorage.removeItem('auth0.is.authenticated');
        
        logout({
            logoutParams: {
                returnTo: returnUrl
            }
        });
    };

    return (
        <button onClick={handleLogout}>
            Log Out
        </button>
    );
};

export default LogoutButton;
