import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { HELP_PAGE, OPEN_HELP_MESSAGE } from '../platform/browser.js';
import { grantedPatterns, injectIntoOpenTabs, syncRegistration } from '../platform/siteAccess.js';
import { handleBridgeMessage, LIVE_RECORDS_KEY } from '../services/petwiseBridge.js';
import { STORAGE_KEYS } from '../services/recordStore.js';

// Keeps the per-site content script registration in step with granted sites, and receives records from the
// PetWise tab. No network requests.
export default defineBackground(() => {
    const sync = () => syncRegistration().catch(() => {});

    browser.runtime.onInstalled.addListener(({ reason }) => {
        sync();
        if (reason === 'install') browser.tabs.create({ url: browser.runtime.getURL(`${HELP_PAGE}?welcome`) }).catch(() => {});
    });
    browser.runtime.onMessage.addListener((message, sender) => {
        if (message?.type === OPEN_HELP_MESSAGE && sender.id === browser.runtime.id) {
            browser.tabs.create({ url: browser.runtime.getURL(HELP_PAGE) }).catch(() => {});
        }
    });
    browser.runtime.onStartup.addListener(sync);
    browser.permissions.onRemoved.addListener(sync);
    browser.permissions.onAdded.addListener(async ({ origins = [] }) => {
        await sync();
        await injectIntoOpenTabs(grantedPatterns(origins)).catch(() => {});
    });

    // Session storage is memory only. Content scripts need to read it to paste, so open it to them; web pages
    // still have no access.
    browser.storage.session.setAccessLevel?.({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => {});

    const manifest = browser.runtime.getManifest();
    const io = {
        version: manifest.version,
        allowedPatterns: manifest.externally_connectable?.matches || [],
        getLive: async () => (await browser.storage.session.get(LIVE_RECORDS_KEY))[LIVE_RECORDS_KEY] || {},
        setLive: (records) => browser.storage.session.set({ [LIVE_RECORDS_KEY]: records }),
        selectRecord: (id) => browser.storage.local.set({ [STORAGE_KEYS.activeRecordId]: id }),
    };

    browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
        handleBridgeMessage(message, sender, io).then(sendResponse, (err) => sendResponse({ ok: false, error: String(err?.message || err) }));
        return true;
    });
});
