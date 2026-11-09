const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const once = (key, fn) => {
    if (!key || localStorage.getItem(key) === 'true') return;
    localStorage.setItem(key, 'true');
    fn();
};

const cookie = (name) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] || '';

// /signup redirects to Auth0 before fbevents.js loads, so the pixel never sees fbclid.
// Write _fbc ourselves on boot (same format and 90-day life the pixel uses).
const persistClickId = () => {
    if (typeof window === 'undefined') return;
    const fbclid = new URLSearchParams(window.location.search).get('fbclid');
    if (!fbclid || cookie('_fbc').endsWith(`.${fbclid}`)) return;
    document.cookie = `_fbc=fb.1.${Date.now()}.${fbclid}; max-age=7776000; path=/; SameSite=Lax`;
};
persistClickId();

export const metaBrowserIds = () => ({
    fbp: cookie('_fbp'),
    fbc: cookie('_fbc'),
});

// Browser pixel + Conversions API with a shared event_id so Meta dedupes.
export const trackMeta = (eventName, auth0Sub) => {
    const eventId = `${eventName}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.fbq?.('track', eventName, {}, { eventID: eventId });
    fetch(`${API_URL}/meta/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
            event_name: eventName,
            event_id: eventId,
            event_source_url: window.location.href,
            auth0_user_id: auth0Sub,
            ...metaBrowserIds(),
        }),
    }).catch(() => {});
};

// Auth0 finished and we inserted the users row. Not a CTA click.
export const trackCompleteRegistration = (auth0Sub) => {
    once(`fb-complete-reg-${auth0Sub}`, () => {
        trackMeta('CompleteRegistration', auth0Sub);
        window.gtag?.('event', 'sign_up', { method: 'auth0' });
    });
};

// Onboarding name (+ optional phone) saved.
export const trackOnboardingComplete = (auth0Sub) => {
    once(`fb-onboard-${auth0Sub}`, () => {
        trackMeta('SubmitApplication', auth0Sub);
        window.gtag?.('event', 'onboarding_complete');
    });
};
