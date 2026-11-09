import React, { useCallback, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import InAppHandoff from '../components/InAppHandoff';
import { isInAppBrowser } from '../utils/install';

// Off: in-app browsers sign up in place. Flip on to show the browser picker first.
const IN_APP_HANDOFF = false;

// Sign-up entry point. Render `handoff` somewhere in the page.
export const useSignup = () => {
    const { loginWithRedirect } = useAuth0();
    const [pending, setPending] = useState(null);

    const redirect = useCallback(
        ({ returnTo, loginHint } = {}) =>
            loginWithRedirect({
                authorizationParams: { screen_hint: 'signup', login_hint: loginHint || undefined },
                appState: { returnTo: returnTo || '/dashboard' }
            }),
        [loginWithRedirect]
    );

    const signup = useCallback(
        (opts = {}) => (IN_APP_HANDOFF && isInAppBrowser() ? setPending(opts) : redirect(opts)),
        [redirect]
    );

    const handoff = pending && <InAppHandoff {...pending} onContinueHere={() => redirect(pending)} />;

    return { signup, redirect, handoff };
};
