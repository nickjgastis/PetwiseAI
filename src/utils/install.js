export const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const UA = () => navigator.userAgent || '';

// Instagram, Facebook, Messenger, LinkedIn, TikTok webviews can't add to the home screen.
export const isInAppBrowser = () => /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|LinkedInApp|musical_ly|BytedanceWebview/i.test(UA());

export const isIOS = () =>
    /iPad|iPhone|iPod/.test(UA()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isAndroid = () => /Android/i.test(UA());

export const installPlatform = () => {
    if (isInAppBrowser()) return 'in-app';
    if (isIOS()) return /CriOS|EdgiOS|FxiOS/.test(UA()) ? 'ios-chrome' : 'ios-safari';
    if (isAndroid()) return 'android';
    return 'other';
};

const clickId = () => {
    const fromUrl = new URLSearchParams(window.location.search).get('fbclid');
    if (fromUrl) return fromUrl;
    const fbc = document.cookie.match(/(?:^|; )_fbc=([^;]*)/)?.[1];
    return fbc ? fbc.split('.').slice(3).join('.') : '';
};

// Sign-up URL to reopen outside the in-app browser; keeps fbclid + utm_* so Meta attribution survives.
export const externalSignupUrl = ({ returnTo, loginHint } = {}) => {
    const url = new URL('/signup', window.location.origin);
    const current = new URLSearchParams(window.location.search);
    current.forEach((v, k) => { if (k.startsWith('utm_')) url.searchParams.set(k, v); });
    const fbclid = clickId();
    if (fbclid) url.searchParams.set('fbclid', fbclid);
    if (returnTo) url.searchParams.set('returnTo', returnTo);
    if (loginHint) url.searchParams.set('login_hint', loginHint);
    return url.toString();
};

export const browserLinks = (url) => {
    const bare = url.replace(/^https?:\/\//, '');
    if (isAndroid()) {
        return [
            { id: 'chrome', label: 'Open in Chrome', href: `intent://${bare}#Intent;scheme=https;package=com.android.chrome;end` },
            { id: 'default', label: 'Open in my browser', href: `intent://${bare}#Intent;scheme=https;action=android.intent.action.VIEW;end` }
        ];
    }
    return [
        { id: 'safari', label: 'Open in Safari', href: `x-safari-${url}` },
        { id: 'chrome', label: 'Open in Chrome', href: `${url.startsWith('https') ? 'googlechromes' : 'googlechrome'}://${bare}` }
    ];
};

export const canPromptInstall = () => Boolean(window.deferredInstallPrompt);

// Android/Chrome one-tap install. Resolves true if the user accepted.
export const promptInstall = async () => {
    const prompt = window.deferredInstallPrompt;
    if (!prompt) return false;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    window.deferredInstallPrompt = null;
    return outcome === 'accepted';
};
