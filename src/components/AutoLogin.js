import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useSignup } from '../hooks/useSignup';

const AutoLogin = ({ mode = 'login' }) => {
    const { loginWithRedirect } = useAuth0();
    const { signup, handoff } = useSignup();

    useEffect(() => {
        if (mode !== 'signup') {
            loginWithRedirect();
            return;
        }
        // returnTo / login_hint arrive when the in-app handoff reopens /signup in a real browser.
        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get('returnTo');
        signup({
            returnTo: /^\/(?!\/)/.test(returnTo || '') ? returnTo : undefined,
            loginHint: params.get('login_hint') || undefined
        });
    }, [loginWithRedirect, signup, mode]);

    return handoff || null;
};

export default AutoLogin;
