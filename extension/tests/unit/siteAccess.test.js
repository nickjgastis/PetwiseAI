import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));

const { activeTabSite, grantedPatterns, injectIntoOpenTabs, SCRIPT_ID, sitePattern, syncRegistration } = await import('../../platform/siteAccess.js');
const { KNOWN_PIMS_PATTERNS, knownPimsFor } = await import('../../platform/pimsSites.js');

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
        expect(grantedPatterns(['http://127.0.0.1:4173/*', 'https://*/*', 'https://pims.example.com/*', '<all_urls>'])).toEqual(['https://pims.example.com/*']);
    });

    it('leaves known practice software to the manifest content script', () => {
        expect(grantedPatterns(['https://*.ezyvet.com/*', 'https://clinic.usw2.ezyvet.com/*', 'https://vetspire.com/*', 'https://pims.example.com/*'])).toEqual([
            'https://pims.example.com/*',
        ]);
    });

    it('recognises known practice software by domain, not by lookalikes', () => {
        expect(knownPimsFor('callistovets.usw2.ezyvet.com')).toBe('ezyVet');
        expect(knownPimsFor('app.vetspire.com')).toBe('Vetspire');
        expect(knownPimsFor('us.idexxneo.com')).toBe('IDEXX Neo');
        expect(knownPimsFor('app.instinctvet.cloud')).toBe('Instinct');
        expect(knownPimsFor('login.evetpractice.com')).toBe('Covetrus Pulse');
        expect(knownPimsFor('notezyvet.com')).toBeNull();
        expect(knownPimsFor('ezyvet.com.evil.example')).toBeNull();
        expect(KNOWN_PIMS_PATTERNS).toContain('https://*.ezyvet.com/*');
        expect(KNOWN_PIMS_PATTERNS.every((p) => /^https:\/\/\*\.[a-z.]+\/\*$/.test(p))).toBe(true);
    });

    it('shows known practice software as on, with no per-site switch', async () => {
        const site = (url) => activeTabSite({ tabs: { query: async () => [{ id: 1, url }] }, permissions: { contains: async () => false } });
        expect(await site('https://callistovets.usw2.ezyvet.com/patient/1')).toEqual({ status: 'built-in', host: 'ezyVet' });
        expect(await site('http://callistovets.usw2.ezyvet.com/')).toMatchObject({ status: 'disabled' });
        expect(await site('https://pims.example.com/')).toMatchObject({ status: 'disabled', host: 'pims.example.com' });
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
