import { MOCK_OTHER_RECORDS, MOCK_RECORDS } from '../../services/mockRecords.js';
import { formatRecord } from '../../services/soapFormatter.js';
import { chipIn, expect, extensionId, FIXTURE, menuIn, normalize, pasteButton, settingsButton, test } from './extension.js';

const BELLA = formatRecord(MOCK_RECORDS[0]);
const MAX = formatRecord(MOCK_RECORDS[1]);
const MILO = formatRecord(MOCK_RECORDS[4]);
const BELLA_CALLBACK = formatRecord(MOCK_OTHER_RECORDS.find((r) => r.id === 'mock-bella-callback'));
const LUNA_DENTAL = formatRecord(MOCK_OTHER_RECORDS.find((r) => r.id === 'mock-luna-dental'));
const UNDO = process.platform === 'darwin' ? 'Meta+z' : 'Control+z';
const DOC_END = process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End';

const LABELS = { subjective: 'Subjective', objective: 'Objective', assessment: 'Assessment', plan: 'Plan' };

test.describe('separate SOAP fields', () => {
    test('shows "Bella | Paste <Section>" and pastes each section into the right field', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        for (const [key, label] of Object.entries(LABELS)) {
            await page.locator(`#${key}`).click();
            const chip = chipIn(page);
            await expect(chip).toBeVisible();
            await expect(chip.locator('.sp-patient')).toHaveText(/Bella/);
            await pasteButton(page, label).click();
            await expect(page.locator(`#${key}`)).toHaveValue(BELLA[key]);
            await expect(chip).toContainText(`Pasted Bella's ${label}`);
            await expect(page.locator(`#${key}`)).toBeFocused();
        }
        // Nothing leaked into a neighbouring field.
        await expect(page.locator('#history')).toHaveValue('');
    });

    test('keeps undo history for a textarea paste', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        await page.locator('#subjective').click();
        await page.keyboard.type('Seen with owner. ');
        await pasteButton(page, 'Subjective').click();
        await expect(page.locator('#subjective')).toHaveValue(`Seen with owner. \n\n${BELLA.subjective}`);
        await page.keyboard.press(UNDO);
        await expect(page.locator('#subjective')).toHaveValue('Seen with owner. ');
    });

    test('marks a section that is already in the field and needs Paste again to insert it twice', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        const field = page.locator('#plan');
        await field.click();
        await pasteButton(page, 'Plan').click();
        await expect(chipIn(page).getByText('Pasted \u2713')).toBeVisible();
        await expect(pasteButton(page, 'Plan')).toHaveCount(0);

        // Leaving and coming back still shows it as pasted, because the field still contains it.
        await page.locator('#objective').click();
        await field.click();
        await expect(chipIn(page).getByText('Pasted \u2713')).toBeVisible();

        await page.keyboard.press(DOC_END);
        await chipIn(page).getByRole('button', { name: 'Paste again' }).click();
        await expect(field).toHaveValue(`${BELLA.plan}\n\n${BELLA.plan}`);

        // Clearing the field brings the normal Paste button back.
        await field.fill('');
        await expect(pasteButton(page, 'Plan')).toBeVisible();
    });

    test('preserves existing text and appends below it when the caret was not placed', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        const field = page.locator('#existing-subjective');
        const original = await field.inputValue();
        await page.locator('label[for="existing-subjective"]').click();
        await expect(field).toBeFocused();
        await pasteButton(page, 'Subjective').click();
        await expect(field).toHaveValue(`${original}\n\n${BELLA.subjective}`);
    });

    test('inserts at the end of the line where the vet placed the caret', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        const field = page.locator('#existing-subjective');
        // Mid-way through the first line: the insert moves to the end of that line rather than splitting it.
        await field.click({ position: { x: 60, y: 14 } });
        await pasteButton(page, 'Subjective').click();
        await expect(field).toHaveValue(`Owner called at 08:10, reports vomiting overnight.\n\n${BELLA.subjective}\n\nBrought in by husband.`);
    });

    test('preserves existing contenteditable text', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        const field = page.locator('#existing-objective');
        await field.click();
        await pasteButton(page, 'Objective').click();
        const text = normalize(await field.innerText());
        expect(text.startsWith('Triage: BAR, ambulatory.')).toBe(true);
        expect(text).toContain(normalize(BELLA.objective));
    });

    test('replaces a field only through the explicit two-step menu action', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        const field = page.locator('#existing-subjective');
        await field.click();
        await settingsButton(page).click();
        // The control is fixed-position, so the whole menu must fit in the viewport (it scrolls internally).
        const box = await menuIn(page).boundingBox();
        const viewport = page.viewportSize();
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        await menuIn(page).getByRole('button', { name: /Replace field with Subjective/ }).click();
        await expect(field).not.toHaveValue(BELLA.subjective);
        await menuIn(page).getByRole('button', { name: 'Replace', exact: true }).click();
        await expect(field).toHaveValue(BELLA.subjective);
    });
});

test.describe('field recognition', () => {
    test('maps alternative labels across editor types', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        const cases = [
            ['#history', 'Subjective'],
            ['#hpi', 'Subjective'],
            ['#physical-exam', 'Objective'],
            ['#impression', 'Assessment'],
            ['#treatment-plan', 'Plan'],
        ];
        for (const [sel, label] of cases) {
            await page.locator(sel).click();
            await expect(pasteButton(page, label)).toBeVisible();
        }
    });

    test('pastes into a single-line input and a contenteditable region', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        await page.locator('#hpi').click();
        await pasteButton(page, 'Subjective').click();
        await expect(page.locator('#hpi')).toHaveValue(BELLA.subjective.replace(/\s*\n+\s*/g, ' '));

        await page.locator('#physical-exam').click();
        await pasteButton(page, 'Objective').click();
        await expect.poll(async () => normalize(await page.locator('#physical-exam').innerText())).toBe(normalize(BELLA.objective));
    });

    test('offers manual selection for an unrecognized field and never guesses', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        await page.locator('#notes').click();
        const choose = chipIn(page).getByRole('button', { name: 'Choose section' });
        await expect(choose).toBeVisible();
        await choose.click();
        await menuIn(page).getByRole('radio', { name: 'Plan', exact: true }).click();
        await expect(page.locator('#notes')).toHaveValue('');
        await pasteButton(page, 'Plan').click();
        await expect(page.locator('#notes')).toHaveValue(BELLA.plan);

        // The override applies to this field only; the next field is auto-detected again.
        await page.locator('#subjective').click();
        await expect(pasteButton(page, 'Subjective')).toBeVisible();
    });

    test('manual override on a recognized field, then reset to auto', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        await page.locator('#subjective').click();
        await settingsButton(page).click();
        await menuIn(page).getByRole('radio', { name: 'Full SOAP' }).click();
        await expect(pasteButton(page, 'Full SOAP')).toBeVisible();
        await settingsButton(page).click();
        await menuIn(page).getByRole('radio', { name: /Auto-detect/ }).click();
        await expect(pasteButton(page, 'Subjective')).toBeVisible();
    });

    test('stays away from irrelevant, locked and sensitive fields', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        for (const sel of ['#owner-name', '#patient-search', '#portal-password', '#billing-plan', '#payment-plan', '#readonly-assessment', '#weight']) {
            await page.locator(sel).click();
            await page.waitForTimeout(150);
            await expect(chipIn(page), sel).toHaveCount(0);
        }
    });
});

test.describe('cases and records', () => {
    test('switching to Max changes what is pasted, does not paste by itself, and survives field changes and reloads', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        await page.locator('#subjective').click();
        await settingsButton(page).click();
        const menu = menuIn(page);
        // 5 cases, Bella's 2 records, Auto-detect + 4 sections + Full SOAP.
        await expect(menu.getByRole('radio')).toHaveCount(5 + 2 + 6);
        await expect(menu.getByRole('radiogroup', { name: 'Active PetWise case' })).toContainText('BellaVomiting');

        // Opening Max's case selects its newest record, the Summary: one block, so no section choices.
        await menu.getByRole('radio', { name: /Max\s*Lameness/ }).click();
        await expect(chipIn(page).locator('.sp-type')).toHaveText('Summary');
        await expect(pasteButton(page, 'Summary')).toBeVisible();
        await expect(menu.getByRole('radiogroup', { name: 'Paste section' })).toHaveCount(0);
        await menu.getByRole('radiogroup', { name: "Records in Max's case" }).getByRole('radio', { name: 'SOAP' }).click();

        await expect(chipIn(page).locator('.sp-patient')).toHaveText(/Max/);
        await expect(chipIn(page).locator('.sp-type')).toHaveText('SOAP');
        await expect(page.locator('#subjective')).toHaveValue('');
        await expect(page.locator('#subjective')).toBeFocused();

        await pasteButton(page, 'Subjective').click();
        await expect(page.locator('#subjective')).toHaveValue(MAX.subjective);

        await page.locator('#objective').click();
        await expect(chipIn(page).locator('.sp-patient')).toHaveText(/Max/);
        await pasteButton(page, 'Objective').click();
        await expect(page.locator('#objective')).toHaveValue(MAX.objective);

        await page.reload();
        await page.locator('#plan').click();
        await expect(chipIn(page).locator('.sp-patient')).toHaveText(/Max/);
    });

    test('opening and closing the menu never pastes', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        await page.locator('#assessment').click();
        await settingsButton(page).click();
        await expect(menuIn(page)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menuIn(page)).toHaveCount(0);
        await settingsButton(page).click();
        await page.locator('.pims-patient h1').click();
        await expect(menuIn(page)).toHaveCount(0);
        await expect(page.locator('#assessment')).toHaveValue('');
    });

    test('the toolbar popup switches records and turns SmartPaste back on', async ({ page, context }) => {
        await page.goto(`${FIXTURE}/`);
        await page.locator('#subjective').click();
        await settingsButton(page).click();
        await menuIn(page).getByRole('button', { name: 'Turn off SmartPaste' }).click();
        await expect(chipIn(page)).toHaveCount(0);
        await page.locator('#objective').click();
        await page.waitForTimeout(150);
        await expect(chipIn(page)).toHaveCount(0);

        const popup = await context.newPage();
        await popup.goto(`chrome-extension://${extensionId()}/popup.html`);
        await popup.getByRole('checkbox').check();
        await popup.getByRole('radio', { name: /Milo/ }).click();
        await expect(popup.getByRole('radio', { name: 'Callback' })).toHaveAttribute('aria-checked', 'true');
        await popup.getByRole('radio', { name: 'SOAP' }).click();
        await popup.close();

        await page.bringToFront();
        await page.locator('#plan').click();
        await expect(chipIn(page).locator('.sp-patient')).toHaveText(/Milo/);
        await pasteButton(page, 'Plan').click();
        await expect(page.locator('#plan')).toHaveValue(MILO.plan);
    });

    test('a Callback pastes whole into whichever field the vet is in', async ({ page }) => {
        await page.goto(`${FIXTURE}/records.html`);
        await page.locator('#client-communication').click();
        await settingsButton(page).click();
        await menuIn(page).getByRole('radiogroup', { name: "Records in Bella's case" }).getByRole('radio', { name: 'Callback' }).click();
        await expect(menuIn(page)).toHaveCount(0);
        await pasteButton(page, 'Callback').click();
        await expect(page.locator('#client-communication')).toHaveValue(BELLA_CALLBACK.full);
        await expect(chipIn(page)).toContainText("Pasted Bella's Callback.");

        // Labelled, unlabelled or SOAP-named: always the whole record, never "No Subjective in Callback".
        for (const id of ['#discharge-instructions', '#misc-notes']) {
            await page.locator(id).click();
            await expect(pasteButton(page, 'Callback')).toBeVisible();
        }
        await page.goto(`${FIXTURE}/`);
        await page.locator('#subjective').click();
        await pasteButton(page, 'Callback').click();
        await expect(page.locator('#subjective')).toHaveValue(BELLA_CALLBACK.full);
        await settingsButton(page).click();
        await expect(menuIn(page).getByRole('button', { name: /^Paste all sections/ })).toHaveCount(0);
        await expect(menuIn(page).getByRole('radiogroup', { name: 'Paste section' })).toHaveCount(0);
    });

    test('a Dental record pastes whole', async ({ page }) => {
        await page.goto(`${FIXTURE}/records.html`);
        await page.locator('#tooth-findings').click();
        await settingsButton(page).click();
        await menuIn(page).getByRole('radio', { name: /Luna\s*Inappetence/ }).click();
        await expect(chipIn(page).locator('.sp-type')).toHaveText('Dental');
        await settingsButton(page).click();
        await expect(menuIn(page)).toHaveCount(0);
        await pasteButton(page, 'Dental').click();
        await expect(page.locator('#tooth-findings')).toHaveValue(LUNA_DENTAL.full);
    });
});

test.describe('full SOAP', () => {
    test('pastes the whole record into a Medical Record textarea and a SOAP Notes contenteditable', async ({ page }) => {
        await page.goto(`${FIXTURE}/full.html`);
        await page.locator('#medical-record').click();
        await pasteButton(page, 'Full SOAP').click();
        await expect(page.locator('#medical-record')).toHaveValue(BELLA.full);

        await page.locator('#soap-notes').click();
        await pasteButton(page, 'Full SOAP').click();
        await expect.poll(async () => normalize(await page.locator('#soap-notes').innerText())).toBe(normalize(BELLA.full));
    });
});

test.describe('rich text (Quill)', () => {
    test('Quill\'s own model receives the pasted section and full record', async ({ page }) => {
        await page.goto(`${FIXTURE}/rich.html`);
        await page.locator('#quill-assessment .ql-editor').click();
        await pasteButton(page, 'Assessment').click();
        await expect(chipIn(page)).toContainText("Pasted Bella's Assessment");
        await expect.poll(async () => normalize(await page.evaluate(() => window.__quills.assessment.getText()))).toBe(normalize(BELLA.assessment));

        await page.locator('#quill-record .ql-editor').click();
        await pasteButton(page, 'Full SOAP').click();
        await expect.poll(async () => normalize(await page.evaluate(() => window.__quills.record.getText()))).toBe(normalize(BELLA.full));

        // The text survives Quill's own change handling after more typing.
        await page.keyboard.type(' Signed.');
        await expect.poll(async () => normalize(await page.evaluate(() => window.__quills.record.getText()))).toBe(normalize(`${BELLA.full} Signed.`));
    });
});

test.describe('React-controlled fields', () => {
    test('updates React state, not just the DOM', async ({ page }) => {
        await page.goto(`${FIXTURE}/react.html`);
        await page.locator('#react-subjective').click();
        await pasteButton(page, 'Subjective').click();
        await expect(page.getByTestId('react-subjective-state')).toHaveText(BELLA.subjective);

        await page.locator('#react-plan').click();
        await pasteButton(page, 'Plan').click();
        await expect(page.getByTestId('react-plan-state')).toHaveText(BELLA.plan);

        // A React re-render keeps the pasted value.
        await page.getByRole('button', { name: 'Save consultation' }).click();
        await expect(page.locator('#react-plan')).toHaveValue(BELLA.plan);
    });

    test('reports failure and offers Copy when an editor rejects the paste, leaving the field untouched', async ({ page }) => {
        await page.goto(`${FIXTURE}/react.html`);
        const field = page.locator('#react-locked');
        await field.click();
        await pasteButton(page, 'Assessment').click();
        const feedback = chipIn(page).getByRole('alert');
        await expect(feedback).toContainText("didn't accept the text");
        await expect(field).toHaveValue('Typed by vet.');
        await expect(page.getByTestId('react-locked-state')).toHaveText('Typed by vet.');

        await feedback.getByRole('button', { name: 'Copy section' }).click();
        await expect(chipIn(page)).toContainText('Copied Assessment');
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(BELLA.assessment);
    });
});

test.describe('iframes', () => {
    test('same-origin srcdoc and about:blank editors are handled from the top frame', async ({ page }) => {
        await page.goto(`${FIXTURE}/frames.html`);

        const srcdoc = page.frameLocator('#frame-srcdoc');
        await srcdoc.locator('#srcdoc-objective').click();
        await pasteButton(page, 'Objective').click();
        await expect(srcdoc.locator('#srcdoc-objective')).toHaveValue(BELLA.objective);

        const blankDom = page.frameLocator('#frame-blank-dom');
        await blankDom.locator('#blank-plan').click();
        await pasteButton(page, 'Plan').click();
        await expect(blankDom.locator('#blank-plan')).toHaveValue(BELLA.plan);

        const blankWrite = page.frameLocator('#frame-blank-write');
        await blankWrite.locator('#blank-assessment').click();
        await pasteButton(page, 'Assessment').click();
        await expect.poll(async () => normalize(await blankWrite.locator('#blank-assessment').innerText())).toBe(normalize(BELLA.assessment));

        // The control sits next to the field inside the frame, in top-page coordinates.
        const frameBox = await page.locator('#frame-blank-write').boundingBox();
        const chipBox = await chipIn(page).locator('.sp-chip').boundingBox();
        expect(chipBox.y).toBeGreaterThan(frameBox.y - chipBox.height - 10);
        expect(chipBox.y).toBeLessThan(frameBox.y + frameBox.height);
    });

    test('a permitted cross-origin frame runs its own SmartPaste', async ({ page }) => {
        await page.goto(`${FIXTURE}/frames.html`);
        const frame = page.frameLocator('#frame-cross-allowed');
        await frame.locator('#frame-subjective').click();
        await pasteButton(frame, 'Subjective').click();
        await expect(frame.locator('#frame-subjective')).toHaveValue(BELLA.subjective);
        await expect(chipIn(page)).toHaveCount(0);
    });

    test('a frame from an origin without permission never shows SmartPaste', async ({ page }) => {
        await page.goto(`${FIXTURE}/frames.html`);
        const frame = page.frameLocator('#frame-cross-denied');
        await frame.locator('#frame-subjective').click();
        await page.waitForTimeout(300);
        await expect(frame.locator('petwise-smartpaste')).toHaveCount(0);
        await expect(chipIn(page)).toHaveCount(0);
    });
});

test.describe('UI behaviour', () => {
    test('sits above the field without covering it, follows scrolling and resizing, hides when off screen', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        const field = page.locator('#objective');
        await field.click();
        const chip = chipIn(page).locator('.sp-chip');
        await expect(chip).toBeVisible();

        const check = async () => {
            const f = await field.boundingBox();
            const c = await chip.boundingBox();
            expect(c.y + c.height).toBeLessThanOrEqual(f.y + 1);
            expect(c.y + c.height).toBeGreaterThan(f.y - 20);
            expect(c.x + c.width).toBeLessThanOrEqual(f.x + f.width + 1);
        };
        await check();

        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(100);
        await check();

        await page.setViewportSize({ width: 900, height: 700 });
        await page.waitForTimeout(100);
        await check();

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await expect(chipIn(page)).toHaveCount(0);
        await page.evaluate(() => document.getElementById('objective').scrollIntoView({ block: 'center' }));
        await expect(chip).toBeVisible();
        await check();
    });

    test('does not interfere with typing and dismisses with Escape', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        const field = page.locator('#assessment');
        await field.click();
        await expect(chipIn(page)).toBeVisible();
        await page.keyboard.type('Typing works normally.');
        await expect(field).toHaveValue('Typing works normally.');
        await page.keyboard.press('Escape');
        await expect(chipIn(page)).toHaveCount(0);
        await page.keyboard.type(' Still typing.');
        await expect(field).toHaveValue('Typing works normally. Still typing.');
        // Dismissal lasts until another field is focused.
        await page.keyboard.press('Tab');
        await expect(pasteButton(page, 'Plan')).toBeVisible();
    });

    test('Tab moves between PIMS fields and the control follows', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        await page.locator('#subjective').click();
        await page.keyboard.press('Tab');
        await expect(page.locator('#objective')).toBeFocused();
        await expect(pasteButton(page, 'Objective')).toBeVisible();
    });

    test('page CSS does not reach the control and the control CSS does not reach the page', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        await page.locator('#subjective').click();
        const inside = await pasteButton(page, 'Subjective').evaluate((b) => getComputedStyle(b).textTransform);
        expect(inside).toBe('none');
        const pageButton = await page.locator('#save').evaluate((b) => [getComputedStyle(b).textTransform, getComputedStyle(b).backgroundColor]);
        expect(pageButton).toEqual(['uppercase', 'rgb(253, 230, 138)']);
    });

    test('does not run on an origin outside its matches', async ({ page }) => {
        await page.goto('http://127.0.0.1:4174/');
        await page.locator('#frame-subjective').click();
        await page.waitForTimeout(500);
        await expect(page.locator('petwise-smartpaste')).toHaveCount(0);
    });
});

test.describe('paste all', () => {
    const pasteAllButton = (page) => menuIn(page).getByRole('button', { name: /^Paste all sections/ });

    test('fills the empty S/O/A/P fields in the same panel and leaves typed text alone', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        await page.locator('#plan').fill('Typed by vet.');
        await page.locator('#subjective').click();
        await settingsButton(page).click();
        await expect(pasteAllButton(page)).toContainText('Fills Subjective, Objective, Assessment');
        await expect(menuIn(page)).toContainText('Skips Plan: field already has text');
        await pasteAllButton(page).click();

        for (const key of ['subjective', 'objective', 'assessment']) await expect(page.locator(`#${key}`)).toHaveValue(BELLA[key]);
        await expect(page.locator('#plan')).toHaveValue('Typed by vet.');
        await expect(page.locator('#history')).toHaveValue('');
        await expect(chipIn(page)).toContainText("Pasted Bella's Subjective, Objective, Assessment.");
        await expect(page.locator('#subjective')).toBeFocused();
    });

    test('skips a section when more than one field looks like it', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        await page.locator('#history').click();
        await settingsButton(page).click();
        await expect(menuIn(page)).toContainText('Skips Subjective: 2 fields look like Subjective');
        await pasteAllButton(page).click();
        await expect(page.locator('#history')).toHaveValue('');
        await expect(page.locator('#hpi')).toHaveValue('');
        expect(normalize(await page.locator('#physical-exam').innerText())).toBe(normalize(BELLA.objective));
        await expect(page.locator('#impression')).toHaveValue(BELLA.assessment);
        await expect(page.locator('#treatment-plan')).toHaveValue(BELLA.plan);
        await expect(page.locator('#notes')).toHaveValue('');
    });

    test('is not offered for a field that stands alone', async ({ page }) => {
        await page.goto(`${FIXTURE}/full.html`);
        await page.locator('#medical-record').click();
        await settingsButton(page).click();
        await expect(menuIn(page)).toBeVisible();
        await expect(pasteAllButton(page)).toHaveCount(0);
    });
});

test.describe('remembered sections', () => {
    test('remembers a manual choice for this field on this site until forgotten', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        await page.locator('#notes').click();
        await chipIn(page).getByRole('button', { name: 'Choose section' }).click();
        await menuIn(page).getByRole('radio', { name: 'Plan', exact: true }).click();
        await settingsButton(page).click();
        await menuIn(page).getByRole('button', { name: 'Always use Plan for this field on this site' }).click();
        await expect(chipIn(page)).toContainText('Plan will be used for this field on this site.');

        await page.reload();
        await page.locator('#notes').click();
        await expect(pasteButton(page, 'Plan')).toBeVisible();
        await settingsButton(page).click();
        await expect(menuIn(page)).toContainText('Plan (remembered)');
        await menuIn(page).getByRole('button', { name: 'Forget Plan for this field' }).click();
        await expect(chipIn(page).getByRole('button', { name: 'Choose section' })).toBeVisible();
        await expect(page.locator('#notes')).toHaveValue('');
    });
});

test.describe('hover preview', () => {
    test('shows what will be pasted without pasting it', async ({ page }) => {
        await page.goto(`${FIXTURE}/`);
        await page.locator('#subjective').click();
        await pasteButton(page, 'Subjective').hover();
        const preview = chipIn(page).getByTestId('smartpaste-preview');
        await expect(preview).toBeVisible();
        await expect(preview).toContainText('Bella \u00b7 SOAP \u00b7 Subjective');
        await expect(preview).toContainText(BELLA.subjective.split('\n')[0].slice(0, 40));
        await expect(page.locator('#subjective')).toHaveValue('');

        await page.mouse.move(5, 5);
        await expect(preview).toHaveCount(0);
    });
});
