import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { clearAppLocalStorage } from '../utils/clearUserData';

const LogoutButton = () => {
    const { logout } = useAuth0();

    const handleLogout = () => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                            window.navigator.standalone === true;
        
        const returnUrl = process.env.NODE_ENV === 'production' && !isStandalone
            ? 'https://petwise.vet'
            : window.location.origin;
        
        clearAppLocalStorage();
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
