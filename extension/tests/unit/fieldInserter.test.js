import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { containsText, insertText, normalizeText, planValueInsertion, readValue } from '../../services/fieldInserter.js';

// jsdom has no document.execCommand editing, so these tests cover the fallback paths and the safety rules around them.
// The execCommand path itself is covered by the Playwright tests in a real Chromium.

const SECTION = 'Presenting Complaint:\nAcute vomiting of 24 hours duration.';

const $ = (sel) => document.querySelector(sel);

beforeEach(() => {
    document.body.innerHTML = `
        <textarea id="ta"></textarea>
        <textarea id="ta-existing">Owner called at 08:10.
Brought in by husband.</textarea>
        <input id="in" type="text" value="Seen by Dr Lee" />
        <textarea id="ro" readonly></textarea>
        <div id="ce" contenteditable="true"></div>
        <div id="ce-existing" contenteditable="true">Triage: BAR, ambulatory.</div>
    `;
});

afterEach(() => {
    vi.restoreAllMocks();
    delete document.execCommand;
});

describe('planValueInsertion', () => {
    it('fills an empty field', () => {
        expect(planValueInsertion('')).toEqual({ from: 0, to: 0, prefix: '', suffix: '' });
    });

    it('appends after existing text with a blank line when the vet has not placed the caret', () => {
        expect(planValueInsertion('Owner called.', { selectionEnd: 0 })).toEqual({ from: 13, to: 13, prefix: '\n\n', suffix: '' });
    });

    it('needs only one newline when the text already ends with one', () => {
        expect(planValueInsertion('Owner called.\n')).toMatchObject({ prefix: '\n' });
        expect(planValueInsertion('Owner called.\n\n')).toMatchObject({ prefix: '' });
    });

    it('inserts at a caret placed at the start of a line', () => {
        const value = 'Line one\nLine two';
        expect(planValueInsertion(value, { selectionEnd: 9, useCaret: true })).toEqual({ from: 9, to: 9, prefix: '\n', suffix: '\n\n' });
    });

    it('moves a mid-line caret to the end of that line so text is never split', () => {
        const value = 'Line one\nLine two';
        expect(planValueInsertion(value, { selectionEnd: 4, useCaret: true })).toMatchObject({ from: 8, prefix: '\n\n', suffix: '\n' });
    });

    it('never replaces a selection: insertion goes after it', () => {
        const value = 'Keep this text';
        const plan = planValueInsertion(value, { selectionEnd: value.length, useCaret: true });
        expect(plan.from).toBe(plan.to);
        expect(plan.from).toBe(value.length);
    });

    it('ignores an out-of-range caret', () => {
        expect(planValueInsertion('abc', { selectionEnd: 99, useCaret: true }).from).toBe(3);
    });

    it('uses spaces, not newlines, in single-line inputs', () => {
        expect(planValueInsertion('Seen by Dr Lee', { multiline: false })).toMatchObject({ from: 14, prefix: ' ', suffix: '' });
    });

    it('covers the whole field only in explicit replace mode', () => {
        expect(planValueInsertion('Old notes', { mode: 'replace' })).toEqual({ from: 0, to: 9, prefix: '', suffix: '' });
    });
});

describe('insertText into textarea and input (fallback path)', () => {
    it('fills an empty textarea and fires beforeinput, input and change', async () => {
        const el = $('#ta');
        const events = [];
        ['beforeinput', 'input', 'change'].forEach((t) => el.addEventListener(t, () => events.push(t)));
        const result = await insertText(el, SECTION);
        expect(result).toMatchObject({ status: 'inserted', method: 'value-setter' });
        expect(el.value).toBe(SECTION);
        expect(events).toEqual(['beforeinput', 'input', 'change']);
    });

    it('preserves existing text and appends below it', async () => {
        const el = $('#ta-existing');
        const result = await insertText(el, SECTION);
        expect(result.status).toBe('inserted');
        expect(el.value).toBe(`Owner called at 08:10.\nBrought in by husband.\n\n${SECTION}`);
    });

    it('joins lines with spaces in a single-line input', async () => {
        const el = $('#in');
        await insertText(el, 'Line one\nLine two');
        expect(el.value).toBe('Seen by Dr Lee Line one Line two');
    });

    it('replaces only in explicit replace mode', async () => {
        const el = $('#ta-existing');
        const result = await insertText(el, SECTION, { mode: 'replace' });
        expect(result.status).toBe('inserted');
        expect(el.value).toBe(SECTION);
    });

    it('reports invalid and changes nothing for read-only, detached or empty input', async () => {
        expect((await insertText($('#ro'), SECTION)).status).toBe('invalid');
        const el = $('#ta');
        el.remove();
        expect((await insertText(el, SECTION)).status).toBe('invalid');
        expect((await insertText($('#ta-existing'), '   ')).status).toBe('invalid');
        expect($('#ta-existing').value).toBe('Owner called at 08:10.\nBrought in by husband.');
    });

    it('reports unchanged when the editor cancels beforeinput', async () => {
        const el = $('#ta-existing');
        const original = el.value;
        el.addEventListener('beforeinput', (e) => e.preventDefault());
        const result = await insertText(el, SECTION);
        expect(result.status).toBe('unchanged');
        expect(el.value).toBe(original);
    });

    it('reports unchanged when the editor reverts the value, without restoring anything itself', async () => {
        const el = $('#ta-existing');
        const original = el.value;
        el.addEventListener('input', () => {
            el.value = original;
        });
        const result = await insertText(el, SECTION);
        expect(result.status).toBe('unchanged');
        expect(el.value).toBe(original);
    });

    it('reports uncertain when the editor keeps only part of the text', async () => {
        const el = $('#ta');
        el.addEventListener('input', () => {
            el.value = el.value.slice(0, 20);
        });
        const result = await insertText(el, SECTION);
        expect(result.status).toBe('uncertain');
    });

    it('does not run the fallback when execCommand changed the field (even if it returned false)', async () => {
        const el = $('#ta');
        document.execCommand = vi.fn((cmd, _ui, text) => {
            el.value += text;
            return false;
        });
        const result = await insertText(el, SECTION);
        expect(document.execCommand).toHaveBeenCalledOnce();
        expect(el.value).toBe(SECTION);
        expect(result.status).toBe('inserted');
    });

    it('waits for editors that apply execCommand asynchronously before trying a fallback', async () => {
        const el = $('#ta');
        document.execCommand = vi.fn((cmd, _ui, text) => {
            setTimeout(() => (el.value += text), 10);
            return true;
        });
        const result = await insertText(el, SECTION);
        expect(el.value).toBe(SECTION);
        expect(result).toMatchObject({ status: 'inserted', method: 'execCommand' });
    });

    it('survives execCommand throwing', async () => {
        const el = $('#ta');
        document.execCommand = vi.fn(() => {
            throw new Error('not supported');
        });
        const result = await insertText(el, SECTION);
        expect(result.status).toBe('inserted');
        expect(el.value).toBe(SECTION);
    });
});

describe('insertText into contenteditable (fallback path)', () => {
    it('inserts plain text nodes and line breaks, never HTML', async () => {
        const el = $('#ce');
        const result = await insertText(el, '<img src=x onerror=alert(1)>\nSecond line');
        expect(result).toMatchObject({ status: 'inserted', method: 'text-nodes' });
        expect(el.querySelector('img')).toBeNull();
        expect(el.querySelectorAll('br')).toHaveLength(1);
        expect(readValue(el)).toBe('<img src=x onerror=alert(1)>\nSecond line');
    });

    it('preserves existing content and starts the paste on a new line', async () => {
        const el = $('#ce-existing');
        const result = await insertText(el, SECTION);
        expect(result.status).toBe('inserted');
        expect(readValue(el)).toBe(`Triage: BAR, ambulatory.\n${SECTION}`);
    });

    it('lets a rich editor handle the synthetic paste event when execCommand does nothing', async () => {
        const el = $('#ce');
        el.addEventListener('paste', (e) => {
            e.preventDefault();
            el.textContent = e.clipboardData.getData('text/plain');
        });
        globalThis.DataTransfer ??= class {
            constructor() {
                this.data = {};
            }
            setData(type, value) {
                this.data[type] = value;
            }
            getData(type) {
                return this.data[type];
            }
        };
        const OriginalClipboardEvent = globalThis.ClipboardEvent;
        globalThis.ClipboardEvent = class extends Event {
            constructor(type, init) {
                super(type, init);
                this.clipboardData = init.clipboardData;
            }
        };
        try {
            const result = await insertText(el, 'Pasted by editor');
            expect(result).toMatchObject({ status: 'inserted', method: 'paste-event' });
            expect(el.textContent).toBe('Pasted by editor');
        } finally {
            globalThis.ClipboardEvent = OriginalClipboardEvent;
        }
    });
});

describe('duplicate detection', () => {
    it('finds a section already in the field regardless of whitespace', () => {
        const el = $('#ta');
        el.value = `Intro\n\nPresenting Complaint:\n  Acute vomiting of 24 hours   duration.\n`;
        expect(containsText(el, SECTION)).toBe(true);
    });

    it('does not match partial or empty text', () => {
        const el = $('#ta');
        el.value = 'Presenting Complaint:';
        expect(containsText(el, SECTION)).toBe(false);
        expect(containsText(el, '')).toBe(false);
    });

    it('normalizes non-breaking spaces from rich editors', () => {
        expect(normalizeText('a\u00a0\u00a0b\n c')).toBe('a b c');
    });
});
