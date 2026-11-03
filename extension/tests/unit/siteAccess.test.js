import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));

const { grantedPatterns, injectIntoOpenTabs, SCRIPT_ID, sitePattern, syncRegistration } = await import('../../platform/siteAccess.js');

const fakeApi = ({ origins = [], registered = [] } = {}) => ({
    permissions: { getAll: vi.fn(async () => ({ origins })) },
    scripting: {
        getRegisteredContentScripts: vi.fn(async () => registered),
        registerContentScripts: vi.fn(async () => {}),
        updateContentScripts: vi.fn(async () => {}),
        unregisterContentScripts: vi.fn(async () => {}),
        executeScript: vi.fn(async () => {}),
    },
    tabs: { query: vi.fn(async () => [{ id: 7 }, { id: 9 }]) },
});

describe('siteAccess', () => {
    it('turns a page URL into a host pattern, ignoring port and path', () => {
        expect(sitePattern('https://clinic.ezyvet.com:8443/visit/12?x=1')).toBe('https://clinic.ezyvet.com/*');
        expect(sitePattern('http://10.0.0.5/pims')).toBe('http://10.0.0.5/*');
        expect(sitePattern('chrome://extensions')).toBeNull();
        expect(sitePattern('file:///tmp/a.html')).toBeNull();
        expect(sitePattern('not a url')).toBeNull();
    });

    it('only counts single sites the vet granted', () => {
        expect(grantedPatterns(['http://127.0.0.1:4173/*', 'https://*/*', 'https://clinic.ezyvet.com/*', '<all_urls>'])).toEqual(['https://clinic.ezyvet.com/*']);
    });

    it('registers SmartPaste for granted sites and updates an existing registration', async () => {
        const api = fakeApi({ origins: ['https://a.example/*'] });
        await syncRegistration(api);
        expect(api.scripting.registerContentScripts).toHaveBeenCalledWith([
            expect.objectContaining({ id: SCRIPT_ID, matches: ['https://a.example/*'], allFrames: true, persistAcrossSessions: true }),
        ]);

        const again = fakeApi({ origins: ['https://a.example/*', 'https://b.example/*'], registered: [{ id: SCRIPT_ID }] });
        await syncRegistration(again);
        expect(again.scripting.updateContentScripts).toHaveBeenCalledWith([expect.objectContaining({ matches: ['https://a.example/*', 'https://b.example/*'] })]);
    });

    it('unregisters when the last site is removed', async () => {
        const api = fakeApi({ origins: ['http://127.0.0.1:4173/*'], registered: [{ id: SCRIPT_ID }] });
        await syncRegistration(api);
        expect(api.scripting.unregisterContentScripts).toHaveBeenCalledWith({ ids: [SCRIPT_ID] });
        expect(api.scripting.registerContentScripts).not.toHaveBeenCalled();
    });

    it('starts SmartPaste in tabs that were already open on a newly granted site', async () => {
        const api = fakeApi();
        await injectIntoOpenTabs(['https://a.example/*'], api);
        expect(api.tabs.query).toHaveBeenCalledWith({ url: ['https://a.example/*'] });
        expect(api.scripting.executeScript).toHaveBeenCalledTimes(2);
        expect(api.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 7, allFrames: true }, files: ['content-scripts/smartpaste.js'] });
    });
});
