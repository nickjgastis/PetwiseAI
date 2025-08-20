import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const AutoLogin = ({ mode = 'login' }) => {
    const { loginWithRedirect } = useAuth0();

    useEffect(() => {
        loginWithRedirect({
            authorizationParams: {
                screen_hint: mode === 'signup' ? 'signup' : undefined
            }
        });
    }, [loginWithRedirect, mode]);

    return null;
};

export default AutoLogin; 