// Per-site access. The extension ships with no host access beyond the local mock PIMS; a vet grants one site at a
// time from the popup (Chrome shows its own permission prompt), and SmartPaste is registered for exactly the sites
// granted. Removing a site in the popup or in chrome://extensions removes the registration.
import { browser } from 'wxt/browser';

export const SCRIPT_ID = 'smartpaste-granted-sites';
export const CONTENT_SCRIPT = 'content-scripts/smartpaste.js';
export const BUILT_IN_PATTERNS = ['http://127.0.0.1:4173/*', 'http://localhost:4173/*'];

// "https://pims.example.com:8443/visit/1" -> "https://pims.example.com/*". Chrome host patterns ignore ports, and
// only http(s) pages can be enabled.
export const sitePattern = (url) => {
    try {
        const u = new URL(url);
        return /^https?:$/.test(u.protocol) && u.hostname ? `${u.protocol}//${u.hostname}/*` : null;
    } catch {
        return null;
    }
};

const isBuiltIn = (url) => BUILT_IN_PATTERNS.some((p) => url.startsWith(p.slice(0, -1)));

// Sites the vet granted, excluding the built-in mock PIMS and any broad pattern.
export const grantedPatterns = (origins = []) => origins.filter((o) => !BUILT_IN_PATTERNS.includes(o) && /^https?:\/\/[^*/]+\/\*$/.test(o));

export const registrationFor = (patterns) => ({
    id: SCRIPT_ID,
    matches: patterns,
    js: [CONTENT_SCRIPT],
    allFrames: true,
    matchOriginAsFallback: true,
    runAt: 'document_idle',
    persistAcrossSessions: true,
});

// Brings the dynamic registration in line with the granted sites. Safe to call any number of times.
export const syncRegistration = async (api = browser) => {
    const { origins = [] } = await api.permissions.getAll();
    const patterns = grantedPatterns(origins);
    const existing = await api.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
    if (!patterns.length) {
        if (existing.length) await api.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
        return [];
    }
    const script = registrationFor(patterns);
    if (existing.length) await api.scripting.updateContentScripts([script]);
    else await api.scripting.registerContentScripts([script]);
    return patterns;
};

// Registered scripts only run on pages loaded afterwards, so start SmartPaste in open tabs of a newly granted site.
export const injectIntoOpenTabs = async (patterns, api = browser) => {
    if (!patterns.length) return;
    const tabs = await api.tabs.query({ url: patterns });
    await Promise.all(
        tabs.map((tab) => api.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: [CONTENT_SCRIPT] }).catch(() => {}))
    );
};

// For the popup: what SmartPaste can do on the active tab.
export const activeTabSite = async (api = browser) => {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || '';
    if (isBuiltIn(url)) return { status: 'built-in', host: new URL(url).host };
    const pattern = sitePattern(url);
    if (!pattern) return { status: 'unsupported' };
    const granted = await api.permissions.contains({ origins: [pattern] });
    return { status: granted ? 'enabled' : 'disabled', pattern, host: new URL(url).hostname, tabId: tab.id };
};

// Must be called straight from a click: Chrome only shows the permission prompt for a user gesture.
export const enableSite = (pattern, api = browser) => api.permissions.request({ origins: [pattern] });

export const disableSite = (pattern, api = browser) => api.permissions.remove({ origins: [pattern] });
