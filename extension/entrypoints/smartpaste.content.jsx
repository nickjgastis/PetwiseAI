import { createRoot } from 'react-dom/client';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import SmartPasteButton from '../components/SmartPasteButton.jsx';
import { copyToClipboard, extensionStorage, sessionRecordStorage } from '../platform/browser.js';
import { createFieldMemory } from '../services/fieldMemory.js';
import { createRecordStore } from '../services/recordStore.js';
import { createController } from '../services/smartPasteController.js';
// Bundled into the script rather than fetched: a fetched stylesheet must be web-accessible to the page's origin,
// which would mean listing every site a vet enables.
import styles from '../styles/smartpaste.css?inline';

// A same-origin child frame is handled by the topmost frame it can reach, so the control is drawn in the top
// document and never clipped by a small editor iframe. Only frames that cannot reach the top (cross-origin)
// run their own controller and UI.
const reachableFromTop = () => {
    try {
        let w = window;
        while (w !== w.top) {
            if (!w.frameElement) return false;
            w = w.parent;
        }
        return true;
    } catch {
        return false;
    }
};

export default defineContentScript({
    // Always on for the local mock PIMS (localhost:4173 is a second origin for cross-origin editor frames). Other
    // sites are registered at runtime once the vet enables them (platform/siteAccess.js).
    matches: ['http://127.0.0.1:4173/*', 'http://localhost:4173/*'],
    allFrames: true,
    matchAboutBlank: true,
    matchOriginAsFallback: true,
    runAt: 'document_idle',
    cssInjectionMode: 'manual',

    async main(ctx) {
        if (window !== window.top && reachableFromTop()) return;

        const store = createRecordStore({ storage: extensionStorage, liveStorage: sessionRecordStorage });
        const memory = createFieldMemory({ storage: extensionStorage });
        await Promise.all([store.ready, memory.ready]);
        const controller = createController({ win: window, store, memory, copy: copyToClipboard });

        const ui = await createShadowRootUi(ctx, {
            name: 'petwise-smartpaste',
            css: styles,
            position: 'inline',
            anchor: 'body',
            append: 'last',
            isolateEvents: true,
            onMount: (container, shadow, host) => {
                host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
                controller.attachUi(host, container, () => ui.mount());
                const root = createRoot(container);
                root.render(<SmartPasteButton controller={controller} />);
                return root;
            },
            onRemove: (root) => root?.unmount(),
        });
        ui.mount();
        controller.start();

        ctx.onInvalidated(() => {
            controller.destroy();
            ui.remove();
        });
    },
});
