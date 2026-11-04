# Chrome Web Store listing

Upload `.output/petwise-smartpaste-<version>-chrome.zip` from `npm run zip:store`.

## Store listing

- **Name:** PetWise SmartPaste
- **Summary (132 max):** Paste PetWise SOAPs, summaries, callbacks and dental records into your practice software in one click.
- **Category:** Productivity (Workflow & Planning)
- **Language:** English
- **Icon:** `public/icon-128.png`
- **Screenshots (1280x800):** the Paste button on a notes field; the gear menu with Paste all sections; the toolbar popup; the How it works page.
- **Homepage:** https://petwise.vet
- **Support:** support@petwise.vet

### Description

SmartPaste moves your PetWise records into your practice management software without copying and pasting.

Open a record in PetWise, click a notes field in your practice software, and a Paste button appears beside it with the patient's name and what it will paste.

- SOAPs paste section by section: click the Subjective field and it pastes the Subjective. Paste all sections fills every SOAP field on the page at once.
- Summaries, callbacks and dental records paste whole, into whichever field you click.
- There is always a one-click paste. Use the gear to choose a different section or patient, and SmartPaste can remember your choice for each field.
- It adds text where your cursor is and never clears a field without asking.

Private by design:
- Records go straight from your PetWise tab to the extension. They never pass through another server.
- They are kept in memory only, and cleared when you sign out of PetWise or quit Chrome.
- SmartPaste only runs on practice software: ezyVet, Vetspire, Provet Cloud, Shepherd, Digitail, Covetrus Pulse, IDEXX Neo and Instinct, plus any other site you turn on yourself.
- No analytics, no tracking, no network requests.

Requires a PetWise account (https://petwise.vet).

## Privacy practices tab

- **Single purpose:** Paste records the user opens in the PetWise web app into text fields the user chooses in their veterinary practice management software.
- **storage:** Saves the user's settings, the selected record, and per-field section choices; holds records sent from the PetWise tab in session (memory-only) storage until the browser closes or the user signs out.
- **activeTab:** Lets the toolbar popup see which site the user is on, so it can offer to turn SmartPaste on for that site.
- **scripting:** Registers the paste button on the sites the user has turned on, and starts it in their already-open tabs.
- **Host permissions (ezyvet.com, vetspire.com, provetcloud.com, shepherd.vet, digitail.io, evetpractice.com, idexxneo.com, instinctvet.cloud, instinctvet.com):** These are the cloud veterinary practice management systems SmartPaste pastes into. It needs access to those pages to show the paste button beside the field the user clicks and write the record into it. It reads only that field and its label.
- **Optional host permissions (http/https):** For practice software not on that list. Requested for one site at a time, only when the user clicks Turn on for this site.
- **Remote code:** No, all code is in the package.
- **Data usage:** Tick **Website content** only (the label of the field the user clicks). Leave Health information and Personally identifiable information unticked: the records are veterinary notes about animal patients, identified by the pet's name, and SmartPaste receives no client or owner information. If the reviewer asks, use this: "SmartPaste handles veterinary medical notes about animals. It receives no client, owner or human health information. Everything stays on the device; nothing is sold, transferred, or sent over the network."
- **Certify:** compliance with the Developer Program Policies, including Limited Use.
- **Privacy policy URL:** https://petwise.vet/privacy#smartpaste

## After it is approved

1. Copy the extension id from the store dashboard.
2. Set these in the web app's production environment, then redeploy:
   - `REACT_APP_SMARTPASTE_EXTENSION_ID=<store id>`
   - `REACT_APP_SMARTPASTE_STORE_URL=https://chromewebstore.google.com/detail/<store id>`
3. Edge users can install from the same listing.
