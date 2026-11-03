import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { grantedPatterns, injectIntoOpenTabs, syncRegistration } from '../platform/siteAccess.js';

// Only keeps the per-site content script registration in step with the sites the vet has granted. No network,
// no messaging, no record content.
export default defineBackground(() => {
    const sync = () => syncRegistration().catch(() => {});

    browser.runtime.onInstalled.addListener(sync);
    browser.runtime.onStartup.addListener(sync);
    browser.permissions.onRemoved.addListener(sync);
    browser.permissions.onAdded.addListener(async ({ origins = [] }) => {
        await sync();
        await injectIntoOpenTabs(grantedPatterns(origins)).catch(() => {});
    });
});
