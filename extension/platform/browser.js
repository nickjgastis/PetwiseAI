// Every browser-specific API SmartPaste uses goes through here, so Edge/Firefox ports and the Milestone 2 messaging
// bridge only touch this file.
import { browser } from 'wxt/browser';

export const extensionStorage = {
    get: (keys) => browser.storage.local.get(keys),
    set: (values) => browser.storage.local.set(values),
    onChanged: (listener) => {
        const handler = (changes, area) => {
            if (area === 'local') listener(changes);
        };
        browser.storage.onChanged.addListener(handler);
        return () => browser.storage.onChanged.removeListener(handler);
    },
};

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
