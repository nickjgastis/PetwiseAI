# PetWise: how the system works

Last updated Oct 22, 2026. Read this before touching cases, records, the editor, the phone flow or usage limits.

## Product in one minute

PetWise is an AI scribe for vets. The vet talks (or types) through a visit and PetWise writes the medical record.

- **Case**: one patient visit. Everything for that visit lives in it.
- **Record**: one generated document inside a case. A case can hold several records, one per record type or more.
- **Record type**: what kind of document a record is. Four today:

| Type | Color | Icon | What it is |
| --- | --- | --- | --- |
| SOAP | blue | clipboard | Subjective / Objective / Assessment / Plan sections, each editable and copyable |
| Summary | emerald | file | Plain-language visit summary for the client |
| Callback | amber | phone | Notes for a follow-up call |
| Dental | violet | tooth | Dental chart (Modified Triadan, dog/cat) on the right, record text on the left; prints chart first |

- **Dictations & notes**: the raw input for a case. Each recording becomes a dictation (summary + full transcript); typed notes sit alongside. Any record type can be generated from them, and regenerated after adding more.
- **Desktop**: where records are generated, edited, printed and organised.
- **Phone**: the installed app (PWA) is a portable microphone. It records dictations and sends them to the desktop, which generates the record.
- **PetQuery**: separate Q&A assistant for clinical questions.
- **PetSOAP**: the older long-form report generator. Still in the sidebar as a secondary item, not part of cases.

### Plans

- **Free**: 2 records per day (SOAP pool, shared by every record type and PetSOAP) and 3 PetQuery questions per day. Resets at the user's local midnight.
- **Trial**: unlimited, 10 days (`TRIAL_DAYS`).
- **Paid** (monthly / yearly via Stripe) and **student**: unlimited.

## Names: what the code calls it vs what we call it

The backend still uses pre-cases names. They are deliberately **not** renamed (see "Why the old names stay" below). Use the right column when talking to users or writing copy.

| In code / database | Means |
| --- | --- |
| `saved_reports` table, "report", "note" | Record |
| `saved_reports.record_type` | Record type (`soap`, `summary`, `callback`, `dental`; legacy `quicksoap` = SOAP, `generator` = PetSOAP) |
| `cases` table | Case |
| `QuickSOAP.js`, route `/dashboard/quicksoap` | The record editor ("New case" in the sidebar) |
| `quickSOAP_*` localStorage keys | Editor state for the case on screen |
| `/api/generate-soap` | Generates **every** record type, picked by `recordType` |
| `users.soap_notes_used` | Today's count against the free SOAP pool (any record type + PetSOAP) |
| `users.quicksoap_count` | Lifetime records generated (admin stat only) |
| `usage_events.event_type = 'quicksoap'` | A record was generated (any type) |
| "Mobile SOAP", `from_mobile`, `hasNewMobileSOAP` | A record generated from a phone dictation |
| `NAME_LABELS.soap = 'QuickSOAP'` | Kept so auto-generated names stay parseable; never shown as a heading |
| PetSOAP / `ReportForm` / `generator` | Legacy long-form generator |
| Saved Records (`SavedReports.js`) | Legacy flat list of everything; Cases is the main view |

### Why the old names stay

Renaming them means a DB migration and a code deploy that must land at the same instant (`saved_reports`, `quicksoap_count`, the `usage_events` check constraint, the `user_tiers` view), breaks installed phone apps still on the old bundle, and wipes in-progress drafts held in `quickSOAP_*` localStorage. None of it is user-visible. If the file name ever bothers us, the safe step is frontend only: rename `QuickSOAP.js` and add `/dashboard/record` with a redirect from `/dashboard/quicksoap`.

## How it connects

```
Phone (PWA)                       Desktop browser                         Server (api.petwise.vet)            Supabase
-----------                       ---------------                         ------------------------            --------
record dictation  --------------> (transcription goes straight to server) /api/whisper-proxy, /api/transcribe
"Send to desktop" -- insert ----------------------------------------------> /api/db --------------------------> saved_reports (report_text NULL,
                                                                                                                 sent_to_desktop: true, case_id)
                                  Dashboard polls every 5s for those drafts -> /api/db
                                  POST /api/generate-soap {recordType} ----> OpenAI (gpt-5.4-mini) ------------> users counters, usage_events
                                  update the draft row with report_text ---> /api/db --------------------------> saved_reports
                                  Cases tab gets a dot + banner

Desktop editor: dictate/type -> Generate -> /api/generate-soap -> auto-save to saved_reports (case_id = active case)
```

Key points:

- **The browser never talks to Supabase directly.** `src/supabaseClient.js` is a small look-alike client that POSTs every query to `/api/db` (`server/routes/meDb.js`) with the Auth0 token. The server checks the user, scopes every query to their `user_id`, allows only listed tables and columns, and uses the service role key. RLS denies anon/authenticated on everything (migrations 013 to 015).
- **The phone does not generate.** It only inserts a draft. A desktop tab that is open and signed in picks it up (Dashboard polls every 5 s), generates, and updates the same row. If no desktop is open, the draft waits. If the free limit is hit, drafts wait until the reset or an upgrade.
- **Auth**: Auth0 everywhere. `user.sub` is `users.auth0_user_id`; `users.id` (uuid) is what `saved_reports.user_id` and `cases.user_id` reference.

## Data model

```
users (id uuid, auth0_user_id, subscription_*, plan_label, soap_notes_used, pet_queries_used,
       usage_period_start, timezone, quicksoap_count, ...)
  └── cases (id, user_id, pet_name, title, created_at, updated_at)          migration 018
        └── saved_reports (id, user_id, case_id, record_type, report_name,
                           report_text, form_data jsonb, created_at, updated_at)
usage_events (auth0_user_id, event_type in quicksoap|petsoap|petquery, created_at)   migration 012
```

- `saved_reports.case_id` is nullable. Pre-cases records have none until migration **019** backfills them (one case per user + pet name + UTC day; dental and PetSOAP records are not backfilled). **018 and 019 have not been run against production yet.**
- `report_text IS NULL` means a draft (phone dictation not generated yet).
- Deleting a case sets its records' `case_id` to NULL (`ON DELETE SET NULL`); they stay in Saved Records.

### `form_data` (on `saved_reports`)

| Key | Meaning |
| --- | --- |
| `record_type` | Duplicate of the column, older rows only have this |
| `dictations` | `[{ id, summary, fullText, ... }]` |
| `input`, `lastInput` | Typed notes, and the input the current text was generated from |
| `report` | Editor copy of the record text |
| `reportName`, `petName` | Name and extracted pet name |
| `dental` | Dental only: `{ species: 'dog' \| 'cat', teeth: { '108': { status, note } }, unmatched, version }` |
| `sent_to_desktop`, `sent_to_desktop_at` | Phone draft that was sent. `undefined` = desktop origin |
| `from_mobile`, `auto_generated`, `generated_at` | Record generated from a phone draft |
| `card` | Cached AI title/summary for the Cases card (from `/api/note-previews`), keyed on text length |

### Record names

Auto-generated as `"<Pet> - <Type> - Oct 22, 3:19 PM"` (`formatRecordWhen`), or `"<Type> Mobile - ..."` with no pet name. Type labels come from `NAME_LABELS` (`QuickSOAP`, `Summary`, `Callback`, `Dental`). Older rows have `"10/22/2026, 3:19:13 PM"`.

`displayRecordName()` turns any of these into `"Bella · Oct 22, 3:19 PM"` for card headers (drops the type, shortens old dates). The Cases page treats names matching the auto pattern as generated and shows the AI card title instead (`customTitle` in `Cases.js`); anything else is a name the vet typed and wins.

## Main flows

### New case on desktop

1. Sidebar **New case** calls `requestNewCase()` (`utils/cases.js`), which stores a request in localStorage and navigates to `/dashboard/quicksoap`. The editor clears its state on the next mount or event.
2. The vet picks a record type (top toggle), dictates (`useDictation` / `chunkedRecorder` → `/api/whisper-proxy`, cleanup via `/api/cleanup-transcript`) or types.
3. **Generate** → `/api/generate-soap` with `recordType`. The case is created lazily by `ensureCase(petName)` the first time something saves; its id lives in `quickSOAP_caseId`.
4. The record auto-saves to `saved_reports` with that `case_id`. Edits save again (dental chart edits debounced 700 ms).
5. **Add more** (dictate again) then **Regenerate** rewrites the same record from all dictations. Switching record type in the same case generates a new record in that case.
6. Print: SOAP / Summary / Callback via the print view; Dental via `DentalPDF.js` (page 1 chart + legend + tooth findings, page 2 the text).

### Cases page (`/dashboard/cases`, `/dashboard/cases/:id`)

- List of cases (pet name, records as colored type chips, last updated). Cases holding only an un-generated phone draft show "Waiting to generate".
- Case detail: each record is a card (type color, AI title and summary from `/api/note-previews`). Open one → `loadNoteIntoQuickSOAP()` fills localStorage and jumps to the editor.
- **Add a record** from the case: pick a type, optionally reuse the case's earlier dictations, dictate more, generate. Saved into the same case.

### Phone

1. Install from `/install` (PWA). On a phone, `Dashboard.js` renders only the mobile shell (`MobileAppShell`): the editor (`/dashboard/quicksoap`), PetQuery and Profile.
2. Record dictations. The phone keeps a local draft row (`sent_to_desktop: false`) so nothing is lost.
3. **Send to desktop** inserts a new `saved_reports` row (`report_text: null`, `sent_to_desktop: true`, `record_type`, `case_id` = the case open on the phone or a new one).
4. Desktop picks it up as described above, sets `from_mobile: true`, fills the case's pet name if empty, raises the "new from phone" banner and the dot on **Cases**. Unviewed tracking is in `viewedMobileSOAPReports` (14-day window).

### Usage and billing

- Server: `server/usage.js` `checkAndConsume(sub, 'soap' | 'query', tz)` runs **before** generation and refunds on failure. A 403 `USAGE_LIMIT_REACHED` means capped.
- Client: `src/hooks/useUsage.js` mirrors the tier logic for display (`getTier`, `FREE_LIMITS`, sidebar ring, banners). Keep `FREE_LIMITS` in sync with the server.
- Every generation also bumps `users.quicksoap_count` and logs a `usage_events` row (admin charts, HubSpot sync).
- Stripe: `/create-checkout-session`, `/webhook`, `/create-customer-portal`, `/cancel-subscription`. Test keys only in development. Stripe.js is loaded lazily (`getStripe()` in `UpgradeModal.js` / `ManageSubscription.js`).

## Record type internals

All four go through `POST /api/generate-soap` → `{ report, petName, recordType, usage, dental? }`.

| Type | Server code | Notes |
| --- | --- | --- |
| SOAP | `server/soapGenerate.js` `generateSoapFromInput` | Report is `S:/O:/A:/P:` sections; the editor parses them into colored blocks |
| Summary, Callback | inline agents in `server/server.js` | Single text block |
| Dental | `server/dental.js` `generateDental` | JSON mode; validates teeth against the species' Triadan set; strips markdown and em dashes; statuses: missing, extracted, fractured, resorption, periodontal, treated, watch (unlisted teeth are normal) |

Frontend, per type:

- Shared styles: `src/components/caseStyles.js` (`TYPE_STYLES`, `RECORD_TYPES`, `typeStyle()`). **Adding a type** = add it here, to `NAME_LABELS` / `NOTE_LABELS` / `TYPE_PART` in `utils/cases.js`, to the type lists in `Dashboard.js` (phone draft query), a branch in `/api/generate-soap`, and the preview labels in `/api/note-previews`.
- SOAP / Summary / Callback editors are inline in `QuickSOAP.js`.
- Dental: `DentalWorkspace.js` (card + layout), `DentalChartCanvas.js` (zoom, pan, regions, tooth popover), `DentalChart.js` (the svg), `src/dental/sections.js` (headed text sections), `DentalPDF.js` (print). Sandbox at `/dev/dental` (no login needed).
- Card header: colored bar with type label, a dot, and the record name (`RecordName.js`, click to rename).

## Local storage (browser)

| Key | Holds |
| --- | --- |
| `quickSOAP_caseId` | Active case id |
| `quickSOAP_dictations`, `quickSOAP_input`, `quickSOAP_lastInput` | Editor input |
| `quickSOAP_report`, `quickSOAP_reportName`, `quickSOAP_recordType`, `quickSOAP_dental` | Editor output |
| `currentQuickSOAPReportId`, `currentQuickSOAPReportType`, `quickSOAP_savedReport` | Which saved row the editor is bound to |
| `quickSOAP_newCaseRequest` | Pending "New case" click |
| `loadQuickSOAPData` | Tells the editor to load from storage on mount |
| `hasNewMobileSOAP`, `newMobileSOAPId`, `newMobileSOAPCaseId`, `viewedMobileSOAPReports` | Phone notification state |

`clearQuickSOAPStorage()` wipes the editor keys; `utils/clearUserData.js` wipes everything on logout.

## Hosts and deploy

- `petwise.vet`: marketing site, same React app (`src/site`), routes in `src/site/routes.js`.
- `app.petwise.vet` and the installed PWA: the app; `/` goes to login or `/dashboard`.
- `api.petwise.vet`: Express server (`server/server.js`) on Vercel, with crons for drip emails and HubSpot sync (`server/vercel.json`).
- Dev: CRA via craco on `:3000`, server on `:3001` (plain `node`, so **restart it after server changes**).

## Branding and copy rules

- Name: **PetWise** (capital W) in copy.
- Product words in the UI: New case, Cases, record, record type, SOAP, Summary, Callback, Dental, PetQuery. "QuickSOAP" is retired in UI copy (the Updates page announces "New case replaces QuickSOAP"); it survives in old blog posts and the campaign demo.
- Type colors are fixed: SOAP blue, Summary emerald, Callback amber, Dental violet. App accent `#2d5fb8`, ink `#13233f`, sidebar wash `BRAND_WASH` in `src/brand.js`. Fonts: `var(--font-sans)` for UI, Geist (`font-display`) for headings.
- **No em dashes** in any user-facing copy. `node scripts/check-copy.js` fails the build on one.
- Plumb's can be cited as a reference source but never named in frontend copy.
- Don't edit `src/pages/landing/campaign/*`.
- Code style: Prettier, 4-space indent, single quotes.

## Gotchas

- Global CSS forces `input, textarea, select` to `font-size: 16px !important` (stops iOS zoom on focus). Override with `sm:!text-[13px]` style classes where a smaller desktop input is needed.
- The dev overlay shows any uncaught error, including ones from browser extensions; that is how the Stripe.js load failure surfaced.
- `react-pdf` crashes on `strokeDasharray={undefined}`; only pass it when set.
- Auth0 blocks app pages in automated browsers; use `/dev/dental` for visual checks.

## Known gaps

- Saved Records (`SavedReports.js` `getRecordType`) does not know `dental`; dental rows show as SOAP there.
- The phone "generating" banner counts only soap / summary / callback (`mobileReportTypes` in `Dashboard.js`); dental drafts generate fine but are not counted in the banner text.
- The phone's report view still has an older "QuickSOAP" style header.
- Migrations 018 and 019 need to run in production with the deploy.
