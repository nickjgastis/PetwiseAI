const once = (key, fn) => {
    if (!key || localStorage.getItem(key) === 'true') return;
    localStorage.setItem(key, 'true');
    fn();
};

// Auth0 finished and we inserted the users row. Not a CTA click.
export const trackCompleteRegistration = (auth0Sub) => {
    once(`fb-complete-reg-${auth0Sub}`, () => {
        window.fbq?.('track', 'CompleteRegistration');
        window.gtag?.('event', 'sign_up', { method: 'auth0' });
    });
};

// Onboarding name (+ optional phone) saved.
export const trackOnboardingComplete = (auth0Sub) => {
    once(`fb-onboard-${auth0Sub}`, () => {
        window.fbq?.('track', 'SubmitApplication');
        window.gtag?.('event', 'onboarding_complete');
    });
};
