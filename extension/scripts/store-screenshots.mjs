// Chrome Web Store screenshots (1280x800) of the real extension on a neutral demo PIMS page (fixture/store.html).
// `npm run screenshots` builds the dev extension first; output goes to store-assets/.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { LIVE_RECORDS_KEY } from '../services/petwiseBridge.js';
import { MOCK_ALL_RECORDS } from '../services/mockRecords.js';
import { STORAGE_KEYS } from '../services/recordStore.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSION = path.join(root, '.output/chrome-mv3');
const OUT = path.join(root, 'store-assets');
const ID = 'fdaakcanieiagjadphmnblgicldefcfd';
const FIXTURE = 'http://127.0.0.1:4173';
const DEMO = `${FIXTURE}/store.html`;
const SHOWN_HOST = 'app.northsidevet.com';

const up = () => fetch(FIXTURE).then((r) => r.ok, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chip = (page) => page.locator('petwise-smartpaste [data-testid="smartpaste"]');
const dataUrl = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

const startFixture = async () => {
    if (await up()) return null;
    const child = spawn('npm', ['run', 'dev:fixture'], { cwd: root, stdio: 'ignore' });
    for (let i = 0; i < 60 && !(await up()); i++) await sleep(250);
    return child;
};

// Records as the PetWise tab would have sent them, so the UI shows "From PetWise" rather than sample records.
const seed = async (context) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${ID}/popup.html`);
    const now = Date.now();
    const live = Object.fromEntries(
        MOCK_ALL_RECORDS.map((r, i) => [r.id, { ...r, recordTitle: '', openedAt: new Date(now - i * 60000).toISOString() }])
    );
    await page.evaluate(
        ([key, records, activeKey]) =>
            Promise.all([chrome.storage.session.set({ [key]: records }), chrome.storage.local.set({ [activeKey]: 'mock-bella' })]),
        [LIVE_RECORDS_KEY, live, STORAGE_KEYS.activeRecordId]
    );
    await page.close();
};

const frame = async (browser, { title, sub, image, points, layout = 'below', width, height }) => {
    const logo = dataUrl(fs.readFileSync(path.join(root, 'public/icon-128.png')));
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const side = layout === 'side';
    await page.setContent(`<!doctype html><html><body style="margin:0">
        <div style="width:1280px;height:800px;overflow:hidden;position:relative;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            background:linear-gradient(160deg,#3f7ad6 0%,#2d5fb8 45%,#2350a3 100%);color:#fff;
            display:flex;${side ? 'align-items:center;gap:72px;padding:0 110px' : 'flex-direction:column;align-items:center;padding-top:58px'};box-sizing:border-box">
            <div style="position:absolute;top:-180px;right:-160px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(101,208,242,.35),rgba(101,208,242,0) 70%)"></div>
            <div style="${side ? 'flex:1;min-width:0' : 'text-align:center'};position:relative">
                <div style="display:inline-flex;align-items:center;gap:10px;font-size:15px;font-weight:600;opacity:.9;margin-bottom:${side ? 22 : 16}px">
                    <img src="${logo}" style="width:28px;height:28px;border-radius:50%"> PetWise SmartPaste</div>
                <div style="font-size:${side ? 48 : 44}px;line-height:1.08;font-weight:700;letter-spacing:-.03em;${side ? '' : 'max-width:980px'}">${title}</div>
                <div style="margin-top:14px;font-size:19px;line-height:1.45;opacity:.82;${side ? 'max-width:460px' : 'max-width:940px;margin-left:auto;margin-right:auto'}">${sub}</div>
            </div>
            ${
                points
                    ? `<div style="position:relative;flex-shrink:0;width:${width}px;display:grid;gap:16px">${points
                          .map(
                              ([head, body]) => `<div style="background:#fff;color:#13233f;border-radius:16px;padding:22px 26px;box-shadow:0 24px 50px -24px rgba(8,20,50,.6)">
                                <div style="font-size:21px;font-weight:700;letter-spacing:-.01em">${head}</div>
                                <div style="margin-top:6px;font-size:16px;line-height:1.45;color:#4b5b74">${body}</div></div>`
                          )
                          .join('')}</div>`
                    : `<img src="${image}" style="position:relative;flex-shrink:0;width:${width}px;${height ? `height:${height}px;object-fit:cover;object-position:top;` : ''}
                ${side ? 'border-radius:16px' : 'margin-top:34px;border-radius:16px 16px 0 0'};box-shadow:0 30px 70px -20px rgba(8,20,50,.65)">`
            }
        </div></body></html>`);
    const buf = await page.screenshot();
    await page.close();
    return buf;
};

const main = async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const fixture = await startFixture();
    const context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        headless: true,
        viewport: { width: 1180, height: 760 },
        deviceScaleFactor: 2,
        // The sample records are timestamped in UTC clinic hours.
        timezoneId: 'UTC',
        args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    const shots = [];
    try {
        await seed(context);
        const page = await context.newPage();
        await page.goto(DEMO);
        const clip = { x: 210, y: 0, width: 970, height: 600 };

        // 1. The button beside the field, with its preview open.
        await page.click('#subjective');
        await chip(page).getByRole('button', { name: 'Paste Subjective', exact: true }).hover();
        await page.getByTestId('smartpaste-preview').waitFor();
        await sleep(400);
        shots.push({
            name: '1-paste-button',
            title: 'Your PetWise record, one click away',
            sub: 'Click a notes field in your practice software and SmartPaste offers the right part of the record.',
            image: dataUrl(await page.screenshot({ clip })),
            width: 1040,
        });

        // 2. Section by section: Subjective and Objective filled, Assessment next.
        await page.mouse.move(5, 5);
        await chip(page).getByRole('button', { name: 'Paste Subjective', exact: true }).click();
        await page.click('#objective');
        await chip(page).getByRole('button', { name: 'Paste Objective', exact: true }).click();
        await page.click('#assessment');
        await chip(page).getByRole('button', { name: 'Paste Assessment', exact: true }).waitFor();
        await page.mouse.move(5, 5);
        await sleep(400);
        shots.push({
            name: '2-section-by-section',
            title: 'SOAPs paste section by section',
            sub: 'Subjective goes in Subjective, Plan goes in Plan. Or fill every field at once with Paste all sections.',
            image: dataUrl(await page.screenshot({ clip })),
            width: 1040,
        });

        // 3. The gear menu: patient, record and section.
        await chip(page).getByRole('button', { name: 'SmartPaste settings' }).click();
        await chip(page).getByRole('dialog', { name: 'SmartPaste settings' }).waitFor();
        await sleep(400);
        shots.push({
            name: '3-choose-record',
            title: 'Always a one-click paste, always your choice',
            sub: 'Switch patient, record or section from the gear. SmartPaste can remember your pick for each field.',
            image: dataUrl(await page.screenshot({ clip: { x: 210, y: 0, width: 970, height: 760 } })),
            width: 1040,
        });

        // 4. The toolbar popup, opened over the demo PIMS tab.
        const popup = await context.newPage();
        await popup.setViewportSize({ width: 340, height: 600 });
        await page.bringToFront();
        await popup.goto(`chrome-extension://${ID}/popup.html`);
        await popup.locator('.sp-site-title').waitFor();
        // A popup opened as a tab sees itself as the active tab, so draw the card it shows on a practice software site,
        // with a made-up clinic host instead of 127.0.0.1.
        await popup.evaluate((host) => {
            const card = document.querySelector('.sp-site');
            card.className = 'sp-site is-on';
            card.innerHTML = `<div class="sp-site-title"><span class="sp-dot" aria-hidden="true"></span>On for ${host}</div>
                <div class="sp-site-text">Click a notes field and the paste button appears beside it.</div>`;
        }, SHOWN_HOST);
        await sleep(300);
        const popupBox = await popup.locator('body').boundingBox();
        shots.push({
            name: '4-toolbar-popup',
            title: 'Today\u2019s records, ready in your toolbar',
            sub: 'Records you open in PetWise show up here automatically. No sign-in, nothing to set up.',
            image: dataUrl(await popup.screenshot({ clip: { x: 0, y: 0, width: 340, height: Math.ceil(popupBox.height) } })),
            layout: 'side',
            width: 360,
        });

        // 5. Privacy, in the same words as the How it works page.
        shots.push({
            name: '5-private-by-design',
            title: 'Private by design',
            sub: 'Built for clinical records from the first line of code.',
            points: [
                ['Stays on this computer', 'Records go straight from your PetWise tab to the extension. They never pass through another server.'],
                ['Memory only', 'Cleared when you sign out of PetWise or quit Chrome. Only your 25 most recent are kept.'],
                ['Only where you paste', 'Runs on practice software and only looks at the field you click and its label. No analytics, no tracking.'],
            ],
            layout: 'side',
            width: 560,
        });

        // A plain browser: the extension's persistent context ignores per-page sizes, and the store wants exactly 1280x800.
        const plain = await chromium.launch({ channel: 'chromium' });
        try {
            for (const shot of shots) {
                const file = path.join(OUT, `${shot.name}.png`);
                fs.writeFileSync(file, await frame(plain, shot));
                console.log(file);
            }
        } finally {
            await plain.close();
        }
    } finally {
        await context.close();
        fixture?.kill();
    }
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
