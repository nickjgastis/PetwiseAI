# PetWise SmartPaste: full context

Everything needed to pick this project up cold: what it is, where it stands, how it works, how to ship it, and what
to watch out for. `README.md` covers day-to-day dev commands; `STORE_LISTING.md` holds the Chrome Web Store copy.

## What it is

A Chrome (MV3) extension that pastes records a vet opens in the PetWise web app into the text fields of their
practice management software (PIMS). The vet clicks a notes field in the PIMS, a PetWise chip appears beside it with
the patient's name and a one-click **Paste** button, and SmartPaste inserts the matching part of the record (for a
SOAP, the matching section: Subjective field gets the Subjective).

- No sign-in. The open PetWise tab hands records to the extension directly through Chrome.
- No network requests, no analytics. Records live in memory only (`storage.session`).
- Desktop Chrome only (Edge, Brave, Arc and Opera can install from the Chrome Web Store too). No Safari or Firefox.
- Desktop PIMS (classic Cornerstone, AVImark, ImproMed) can't be reached: they aren't web pages.

## Where we are

| | |
|---|---|
| Version | **1.0.0** (first store submission) |
| Branch | `feature/smartpaste-m1` (merged to local `main` for testing; not pushed as of this writing) |
| Store item id | `cfeodmjhbjndbcbghakbfpinmjhogibd` |
| Dev (unpacked) id | `fdaakcanieiagjadphmnblgicldefcfd` (fixed by the manifest `key` in `wxt.config.js`) |
| Store status | Submitted Nov 3, 2026. Rejected once for "excessive keywords" (PIMS names in the description); description fixed and resubmitted |
| Visibility plan | Unlisted for the beta; Public when ready to advertise |
| First real tester | Nick's mom, a vet on ezyVet. Nothing has been tested on a real PIMS yet |
| Privacy policy | Live at https://petwise.vet/privacy#smartpaste (section 8), already on `main` |

### Iteration history (milestone M1)

1. Core: field detection, section classification, safe insertion, chip and gear menu, mock records, mock PIMS fixture.
2. Bridge: PetWise web app sends records to the extension (`externally_connectable`), memory-only storage.
3. Bigger chip with the PetWise logo; popup restyle (brand wash gradient, switch, site card); How it works page.
4. "Always a direct paste": unrecognised or ambiguous fields paste the Full SOAP; you never have to pick.
5. Chip positioning: clipped-by-scroll-container handling and hysteresis so it stops jumping while scrolling.
6. In-app: Get SmartPaste page, sidebar entry, case name (not record title) in the extension, store build, privacy.
7. Detection fixes: app re-checks for the extension on tab focus and every 5s; "SmartPaste ready" pills.
8. Known PIMS on from install (no per-site Turn on), with domains verified from vendor login pages.
9. Opening a case selects SOAP > summary > callback > dental; clicking into a record still selects that record.
10. Last-viewed PetWise tab wins; hidden tabs never send. Chrome-first copy.
11. Store screenshots and promo tiles (`npm run screenshots`), listing copy, store id baked into the app.

## Changing the version

Bump **both** before every store upload (the store rejects a zip whose version it has seen):

- `extension/wxt.config.js` → `manifest.version` (this is what Chrome and the store read)
- `extension/package.json` → `version` (keep in sync; WXT names the zip from it)

Then `npm run zip:store` and upload under Package → Upload new package. Every upload is reviewed again (updates are
usually faster than the first review). Update the table above when you ship.

## Architecture

```
PetWise web app tab                      Extension                                   PIMS tab
(src/utils/smartPasteBridge.js)          (background service worker)                 (content script)
        |                                         |                                        |
        |  chrome.runtime.sendMessage(id, msg)    |                                        |
        |---------------------------------------->| handleBridgeMessage                   |
        |  petwise:ping / record / case / clear   |   -> storage.session (records)         |
        |                                         |   -> storage.local (selection)         |
        |                                         |                                        |
        |                                         |   storage change events  ------------->| recordStore updates
        |                                         |                                        | chip shows patient + Paste
```

### Folders

| Path | What lives there |
|---|---|
| `entrypoints/background.js` | Service worker: bridge receiver, per-site script registration, welcome tab on install, opens help |
| `entrypoints/smartpaste.content.jsx` | Content script: mounts the chip in a shadow root, starts the controller |
| `entrypoints/popup/` | Toolbar popup: on/off switch, site card, record list, How it works link |
| `entrypoints/help/` | `help.html`: How it works page (`?welcome` on first install) |
| `components/` | React UI: `SmartPasteButton` (chip), `SmartPasteMenu` (gear menu), `CasePicker`, `PetWiseLogo`, popover helpers |
| `services/` | Logic, no React: detection, classification, insertion, controller, stores, bridge, formatting |
| `platform/` | Browser glue: `browser.js` (storage, clipboard, open help), `siteAccess.js` (permissions), `pimsSites.js` (known PIMS) |
| `styles/smartpaste.css` | Chip and menu styles, injected inline into the shadow root |
| `fixture/` | Mock PIMS pages for dev and tests (`npm run dev:fixture`, port 4173); `store.html` is the screenshot demo page |
| `tests/unit/`, `tests/e2e/` | Vitest (jsdom) and Playwright (real Chromium with the extension loaded) |
| `scripts/store-screenshots.mjs` | Generates `store-assets/` |

### services/

| File | Role |
|---|---|
| `fieldDetector.js` | Finds the editable field the vet is in (textarea, input, contenteditable, rich editors, same-origin frames) |
| `fieldClassifier.js` | Reads the field's label and nearby text and decides: a SOAP section, ambiguous, or ignore (search boxes etc.) |
| `soapSections.js` | Label vocabulary per section (History/HPI → Subjective, Physical Exam → Objective, ...) and record splitting |
| `soapFormatter.js`, `petwiseText.js` | Turn PetWise `report_text` into paste-ready plain text (shares the web app's Copy all formatter in `../src`) |
| `fieldInserter.js` | Inserts text at the cursor in a way frameworks (React etc.) notice; never clears a field without asking |
| `smartPasteController.js` | Ties it together: tracks focus, picks the section, drives the chip state, paste / paste again / paste all |
| `recordStore.js` | Records (live from PetWise, or built-in samples) and the active selection; cases grouped for the pickers |
| `fieldMemory.js` | "Always use this section for this field", per site |
| `positioner.js` | Where the chip sits (above/below/inside the field), clipping by scroll containers, anti-jitter hysteresis |
| `petwiseBridge.js` | Validates and stores messages from PetWise |
| `recordTypes.js` | soap / summary / callback / dental; which are single-block (paste whole) |
| `mockRecords.js` | Sample records (Bella, Max, Luna, Charlie, Milo) shown until PetWise sends real ones |

## How it works

### Records: PetWise → extension

The web app side is `src/utils/smartPasteBridge.js`:

- `useSmartPasteBridge` (record editor, `src/pages/QuickSOAP.js`): sends the open record as `petwise:record` with
  `reason: 'open'` when opened (extension selects it) and `'update'` on edits (refreshes text, keeps the vet's pick).
  Debounced 600ms; polls the open record id every 2s because it lives in `localStorage` (`currentQuickSOAPReportId`).
- `useSmartPasteCase` (case page, `src/pages/Cases.js`): sends every record in the case in one `petwise:case`
  message and selects `pickCaseRecord`: SOAP, else summary, callback, dental; newest within a type. Re-selects only
  if the pick changes while the page is open.
- Multiple PetWise tabs: coming back to a tab (`visibilitychange`) re-selects its record. Hidden tabs never send.
  Window focus is deliberately ignored: closing the toolbar popup refocuses the page and would undo a popup pick.
- `clearSmartPaste()` runs on sign-out (`src/utils/clearUserData.js`): extension forgets every record.
- `useSmartPasteInstalled` pings the extension (on load, tab focus, every 5s) for the pills and sidebar entry.

Messages (`services/petwiseBridge.js`):

| Message | Effect |
|---|---|
| `{ type: 'petwise:ping' }` | `{ ok, version }` |
| `{ type: 'petwise:record', reason: 'open' \| 'update', record }` | Upsert; `open` selects it and marks it most recent |
| `{ type: 'petwise:case', records, selectId }` | Upsert all in one write; selects `selectId` if given |
| `{ type: 'petwise:clear' }` | Forget all records |

`record`: `{ id, caseId, patientName, recordType, updatedAt, reportText }`. `id` is the `saved_reports.id`, so the
editor and case page refer to the same record. Everything from the page is treated as untrusted: known fields only,
sizes bounded. Only origins in `externally_connectable` can send (petwise.vet, www, app; plus `localhost:3000` in
dev builds). Max 25 records, newest by when they were opened.

Storage keys: `smartpaste.liveRecords` (session, memory only; opened to content scripts with
`setAccessLevel`), `smartpaste.activeRecordId` and `smartpaste.enabled` (local), plus field memory (local).

Extension id the app talks to: `cfeodmjhbjndbcbghakbfpinmjhogibd` in production builds, the dev id otherwise.
Override with `REACT_APP_SMARTPASTE_EXTENSION_ID`.

### Where it runs

- **Known cloud PIMS** (`platform/pimsSites.js`): ezyVet, Vetspire, Provet Cloud, Shepherd, Digitail, Covetrus Pulse
  (`evetpractice.com`), IDEXX Neo, Instinct (`instinctvet.cloud`, `instinctvet.com`). These are required
  `host_permissions` and static content script matches, so SmartPaste works from install with no Turn on step. The
  background script injects into tabs already open at install. The popup shows "On for ezyVet" with no per-site off
  switch (Chrome can't drop install-time access); the main switch pauses SmartPaste everywhere.
- **Any other site**: the popup offers "Turn on for this site", which requests that one origin via
  `optional_host_permissions`; `siteAccess.js` registers the content script for exactly the granted sites.

### Pasting

1. Vet focuses a field. Detector finds it; classifier reads the label.
2. Section choice (`requestedSection` in the controller): an explicit gear override wins; else remembered field
   choice; else the detected section if the record has it; **otherwise Full SOAP**. There is always a one-click paste.
   Summaries, callbacks and dental records always paste whole.
3. Chip shows patient, record type and `Paste <section>`. Hovering Paste previews the text.
4. Paste inserts at the cursor. If the field already has text it adds rather than replaces. Paste all sections fills
   every confidently detected, empty SOAP field and skips ones that already have text.
5. A failed insertion is reported; SmartPaste never auto-overwrites or restores a field (could erase vet edits).

## PetWise web app pieces (`../src`)

| File | What |
|---|---|
| `utils/smartPasteBridge.js` | Messaging, hooks, extension ids, store URL, case pick |
| `components/SmartPastePill.js` | "SmartPaste ready" pill, shown only when the extension is detected (desktop) |
| `components/CaseBar.js` | `extra` slot: the pill sits beside the "Editing …" pill in the record editor |
| `pages/QuickSOAP.js` | Bridge call, case name fetch, pill in the CaseBar |
| `pages/Cases.js` | `useSmartPasteCase` and the pill on the case page |
| `pages/SmartPaste.js` | `/dashboard/smartpaste`: install panel, how it works, tips |
| `pages/Dashboard.js` | Route, and the highlighted "Get SmartPaste" sidebar entry |
| `legal/PrivacyContent.js` | Section 8, `id="smartpaste"` |

**Visibility switches:** the sidebar entry only shows when `REACT_APP_SMARTPASTE_STORE_URL` is set, the extension
isn't detected, and it's desktop. Without the extension nobody sees anything SmartPaste-related, so the code is safe
to deploy before launch. To go public set
`REACT_APP_SMARTPASTE_STORE_URL=https://chromewebstore.google.com/detail/cfeodmjhbjndbcbghakbfpinmjhogibd` in Vercel
and redeploy (sidebar entry + Add to Chrome button appear).

## Builds

| Command | Output | Notes |
|---|---|---|
| `npx wxt build` | `.output/chrome-mv3` | Dev build: dev `key` (fixed id), `localhost:3000` allowed to send records, mock PIMS content script. Load unpacked from here |
| `npm run test:e2e` | same folder | Builds with `SMARTPASTE_E2E=1` (adds the test PetWise origin `127.0.0.1:4174`) then runs Playwright. **Run `npx wxt build` after** so your unpacked copy is the normal dev build again |
| `npm run zip:store` | `.output/petwise-smartpaste-<version>-chrome.zip` | Store build: no `key`, no localhost origins or matches, no mock PIMS. This is what gets uploaded |
| `npm run screenshots` | `store-assets/*.png` | Rebuilds dev, drives the real extension on `fixture/store.html`, frames shots at exactly 1280x800 plus promo tiles |

Build flags live in `wxt.config.js` (`STORE`, `SMARTPASTE_E2E`) and reach code through `__SMARTPASTE_STORE__`.

## Testing

- `npm run test:run`: unit tests (Vitest + jsdom). 195 passing at 1.0.0.
- `npm run test:e2e`: 37 Playwright tests against the mock PIMS (`fixture/`), real Chromium with the extension.
  Must run outside the sandbox (needs a real browser).
- Manual: `npm run dev:fixture`, load `.output/chrome-mv3` unpacked, open http://127.0.0.1:4173. Run PetWise locally
  (`npm run dev` in the repo root, port 3000) to send real records.
- Root app: `CI=false npx react-scripts build` to check it compiles. The root build rewrites `public/version.json`;
  revert it with `git checkout public/version.json`.

## Store and release

- Copy for every store field: `STORE_LISTING.md`. Images: `store-assets/` (screenshots 1-5 in order, promo tiles),
  icon `public/icon-128.png`.
- Data usage disclosure: **Website content only**. Not health info (animal records, no client or owner details).
- **No product names in the public description.** v1.0.0 was rejected for listing the PIMS as keywords. They're fine
  in the host permission justification (Privacy tab, not public).
- Adding a domain to `pimsSites.js` in an update makes Chrome disable the extension for every user until they
  re-approve. Prefer letting new systems use Turn on for this site; batch domain additions into a major release.
- Changing visibility (Unlisted → Public) is done in the dashboard's Distribution tab.

## Watch out for

- **Real PIMS are untested.** Labels may differ (ezyVet "History", "Clinical notes"...), fields may be rich editors
  or cross-origin iframes, pages may swap fields without reloading. Fallbacks keep it usable (Full SOAP, remembered
  choices) but expect a round of label additions per system in `soapSections.js` / `fieldClassifier.js`.
- **Install while PetWise is open**: Chrome may only connect an already-open page to a newly installed extension
  after a reload. The app re-checks on focus, the help page and SmartPaste page tell vets to refresh.
- **Two PetWise editor tabs**: the web app itself stores the open record id in shared `localStorage`, so two editor
  tabs on different records clash in PetWise (saves included). The bridge guards against it; the app bug remains.
  Possible fix: per-tab `sessionStorage` for the open record id.
- **Dev vs store id**: production talks to the store id. Your unpacked copy only gets records from `localhost:3000`.
- **jsdom** doesn't expand the `overflow` shorthand (tests rely on `s.overflow` too). Playwright's e2e needs the
  `SMARTPASTE_E2E` build or `chrome.runtime` is undefined on the test PetWise page.

## Constraints we've kept

- JavaScript/JSX only, Prettier style (4 spaces, single quotes), everything extension-side inside `/extension`.
- No Auth0, Supabase or production API calls from the extension; no backend routes or tables changed.
- No "all websites" permission, no third-party analytics, no record content leaves the device, no unrelated page
  content collected.
- Never overwrite or restore a field automatically; never globally block pointer events.
- No em dashes in user-facing copy. Desktop only.

## Next up

1. Store approval → publish (Unlisted) → mom tests on ezyVet over a screen share; add any missing field labels.
2. Merge `feature/smartpaste-m1` to `main` and push so production sends records (invisible without the extension).
3. Onboarding: in-app first-run nudge, refresh-after-install inside PetWise, maybe a short GIF.
4. Optional "Copy diagnostics" in the gear (field type, label, frame, decision; no record text) for remote debugging.
5. Verify petwise.vet in Google Search Console and set it as the item's Official URL (verified publisher badge).
6. Going public: set `REACT_APP_SMARTPASTE_STORE_URL`, switch visibility, announce. Later: Edge Add-ons listing.
