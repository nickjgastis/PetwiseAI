import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const LogoutButton = () => {
    const { logout } = useAuth0();

    return (
        <button onClick={() => logout({
            clientId: process.env.REACT_APP_AUTH0_CLIENT_ID,
            returnTo: window.location.hostname.includes('petwise.vet')
                ? 'https://petwise.vet'
                : 'http://localhost:3000',
            federated: true
        })}>
            Log Out
        </button>
    );
};

export default LogoutButton;
