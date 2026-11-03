# PetWise SmartPaste (Milestone 1, local prototype)

Chrome extension that shows a small control next to the PIMS field you click and pastes the matching section of a
PetWise SOAP record into it: **🐾 Bella | Paste Subjective | ⚙**.

This milestone uses five fictional records and a mock PIMS. No Auth0, Supabase, PetWise API or real PIMS access.

## Run it

```bash
cd extension
npm install
npm run browsers           # once: Chromium for the Playwright tests

# Terminal A: mock PIMS at http://127.0.0.1:4173 (and the "no permission" origin on :4174)
npm run dev:fixture

# Terminal B: extension in dev mode (dev server :3010, opens Chrome with SmartPaste loaded)
npm run dev
```

From the repo root, `npm run dev:smartpaste-test` and `npm run dev:extension` do the same. PetWise itself
(`npm run dev` at the root, ports 3000/3001) can run alongside; SmartPaste does not need it.

### Load the production build into your normal Chrome

```bash
cd extension
npm run build
```

1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** and pick `extension/.output/chrome-mv3`.
3. Start the mock PIMS (`npm run dev:fixture`) and open http://127.0.0.1:4173. Reload the tab if it was already open.

After rebuilding, press the reload icon on the extension card, then reload the page.

## Mock PIMS pages

| Page | What it covers |
| --- | --- |
| `/` | Separate S/O/A/P textareas, alternative labels (History, HPI, Physical Examination, Clinical Impression, Treatment Plan), input and contenteditable, existing text, fields that must be ignored |
| `/full.html` | One "Medical Record" textarea and a "SOAP Notes" contenteditable (Full SOAP) |
| `/rich.html` | Quill editors; the text under each one is Quill's own model |
| `/frames.html` | srcdoc, about:blank (DOM-built and document.write), a permitted cross-origin frame, and a frame without permission |
| `/react.html` | React-controlled textareas, plus one that rejects outside changes (failure path) |

## Tests

```bash
npm run test:run     # unit tests (Vitest + jsdom)
npm run test:e2e     # builds, then drives the real extension in Chromium against the mock PIMS (Playwright)
HEADED=1 npm run test:e2e   # watch it
```

jsdom has no real editing, so unit tests cover the fallback insertion paths and the safety rules; the
`document.execCommand` path, Quill, React state, iframes and permissions are only proven by the Playwright tests.

## How it works

| File | Role |
| --- | --- |
| `entrypoints/smartpaste.content.jsx` | Content script: mounts the shadow-root UI, decides which frame owns the UI |
| `entrypoints/popup/` | Toolbar popup: on/off and record selection |
| `services/smartPasteController.js` | Focus tracking (page and same-origin frames), target field, positioning, paste/copy actions |
| `services/fieldDetector.js` | Which element is editable and eligible; collects label/aria/placeholder/heading/id text |
| `services/fieldClassifier.js` | Pure label to section mapping, negative keywords, adapter hook for PIMS-specific rules |
| `services/fieldInserter.js` | Insertion with fallbacks, verification, duplicate detection |
| `services/soapSections.js` | Strict section splitter for `report_text` |
| `services/soapFormatter.js` | Section and Full SOAP text via PetWise's own Copy all formatter (`src/utils/recordText.js`) |
| `services/recordStore.js` | Active record and on/off; persists only those two values |
| `platform/browser.js` | The only file that calls browser extension APIs |

### Paste rules

- Nothing is inserted without a click on Paste. Choosing a record or section never pastes.
- Empty field: fills it. Field with text: inserts where the vet placed the caret (moved to the end of that line so a
  sentence is never split), or appends at the end with a blank line. Selected text is never replaced.
- Replace is a separate two-step menu action.
- If the section is already in the field the control shows **Pasted ✓** and needs **Paste again**.
- Insertion order: `execCommand('insertText')` (keeps undo), then the native value setter with input events
  (inputs/textareas) or a synthetic paste event then text nodes (contenteditable). A fallback only runs if the field
  is still byte-identical, so text is never inserted twice.
- The result is checked immediately, next frame and 300 ms later. Nothing is ever rolled back: if the editor
  rejected the text the field is left as it was and **Copy section** is offered; if the field changed but the text is
  not intact the vet is told to check it.

### Frames

Same-origin child frames (including about:blank and srcdoc) are handled by the top frame, which draws the control in
top-page coordinates so small editor frames do not clip it. Cross-origin frames that match the extension run their
own instance. Frames from origins outside `matches` get nothing, by design.

### Permissions

`storage` only. Content script matches `http://127.0.0.1:4173/*` and `http://localhost:4173/*` (the second is a
separate origin used to test cross-origin frames). No background worker in the production build; WXT adds one in dev
mode for hot reload.
