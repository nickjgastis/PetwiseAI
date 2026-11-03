// Every browser-specific API SmartPaste uses goes through here, so Edge/Firefox ports and the Milestone 2 messaging
// bridge only touch this file.
import { browser } from 'wxt/browser';

const storageArea = (area) => ({
    get: (keys) => browser.storage[area].get(keys),
    set: (values) => browser.storage[area].set(values),
    onChanged: (listener) => {
        const handler = (changes, changedArea) => {
            if (changedArea === area) listener(changes);
        };
        browser.storage.onChanged.addListener(handler);
        return () => browser.storage.onChanged.removeListener(handler);
    },
});

// Selection and preferences: ids and flags only, kept across restarts.
export const extensionStorage = storageArea('local');

// Records sent from the PetWise tab. Memory only: Chrome clears it when the browser closes, so record text is
// never written to disk. The background script opens it to content scripts.
export const sessionRecordStorage = storageArea('session');

// `container` should be inside the SmartPaste shadow root so the temporary textarea is never mistaken for a PIMS field.
export const copyToClipboard = async (text, container) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const doc = container.ownerDocument;
        const area = doc.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;top:-1000px;opacity:0;';
        container.appendChild(area);
        area.select();
        let ok = false;
        try {
            ok = doc.execCommand('copy');
        } catch {
            ok = false;
        }
        area.remove();
        return ok;
    }
};
