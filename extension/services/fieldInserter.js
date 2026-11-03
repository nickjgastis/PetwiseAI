import { editorKind, ineligibleReason } from './fieldDetector.js';

// Inserts text into the field the vet chose. Order of attempts:
//   1. document.execCommand('insertText'): native editing pipeline, keeps undo where the editor supports it.
//   2. Inputs/textareas: native value setter + beforeinput/input/change events.
//      Contenteditable: a synthetic paste event (rich editors handle it), then text-node insertion.
// A later attempt only runs when the field is still exactly what it was before, so text is never inserted twice.
// Nothing is ever rolled back: on failure the field is left as the editor left it and the caller offers Copy.

const VERIFY_DELAY_MS = 300;
const SETTLE_DELAY_MS = 50;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = (win) => new Promise((resolve) => (win?.requestAnimationFrame ? win.requestAnimationFrame(() => resolve()) : setTimeout(resolve, 16)));
const settle = async (win) => {
    await nextFrame(win);
    await wait(SETTLE_DELAY_MS);
};

export const normalizeText = (text) =>
    String(text || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'BLOCKQUOTE', 'TR']);

// innerText where the environment has layout; otherwise a DOM walk that keeps line breaks.
const textWithBreaks = (node) => {
    let out = '';
    node.childNodes.forEach((child) => {
        if (child.nodeType === 3) out += child.data;
        else if (child.nodeName === 'BR') out += '\n';
        else if (child.nodeType === 1) {
            const block = BLOCK_TAGS.has(child.nodeName);
            if (block && out && !out.endsWith('\n')) out += '\n';
            out += textWithBreaks(child);
            if (block && !out.endsWith('\n')) out += '\n';
        }
    });
    return out;
};

export const readValue = (el) => {
    if (editorKind(el) === 'contenteditable') return typeof el.innerText === 'string' ? el.innerText : textWithBreaks(el);
    return el.value ?? '';
};

export const containsText = (el, text) => {
    const want = normalizeText(text);
    return !!want && normalizeText(readValue(el)).includes(want);
};

// Where text goes in an input/textarea and what separators it needs. Pure, so it is unit-tested directly.
// - Empty field or replace: the whole field.
// - Caret placed by the vet: at the caret, moved to the end of that line so a sentence is never split.
// - Otherwise: appended at the end.
// Selected text is never replaced; insertion happens after it.
export const planValueInsertion = (value, { selectionEnd = null, useCaret = false, mode = 'insert', multiline = true } = {}) => {
    if (mode === 'replace') return { from: 0, to: value.length, prefix: '', suffix: '' };
    if (!value) return { from: 0, to: 0, prefix: '', suffix: '' };

    let at = value.length;
    if (multiline && useCaret && Number.isInteger(selectionEnd) && selectionEnd >= 0 && selectionEnd <= value.length) {
        at = selectionEnd;
        const atLineStart = at === 0 || value[at - 1] === '\n';
        if (!atLineStart) {
            const nl = value.indexOf('\n', at);
            at = nl === -1 ? value.length : nl;
        }
    }

    const before = value.slice(0, at);
    const after = value.slice(at);
    let prefix = '';
    let suffix = '';
    if (multiline) {
        if (before.trim()) prefix = before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
        if (after.trim()) suffix = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
    } else {
        if (before && !/\s$/.test(before)) prefix = ' ';
        if (after && !/^\s/.test(after)) suffix = ' ';
    }
    return { from: at, to: at, prefix, suffix };
};

const tryExecCommand = (doc, text) => {
    if (typeof doc.execCommand !== 'function') return false;
    try {
        return doc.execCommand('insertText', false, text) === true;
    } catch {
        return false;
    }
};

const ctor = (el, name) => el.ownerDocument.defaultView?.[name] || globalThis[name];

const nativeValueSetter = (el) => {
    let proto = Object.getPrototypeOf(el);
    while (proto && !Object.getOwnPropertyDescriptor(proto, 'value')) proto = Object.getPrototypeOf(proto);
    return proto && Object.getOwnPropertyDescriptor(proto, 'value').set;
};

const fireBeforeInput = (el, data) => {
    const InputEvent = ctor(el, 'InputEvent');
    return el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, composed: true, inputType: 'insertText', data }));
};

const fireInput = (el, data) => {
    const InputEvent = ctor(el, 'InputEvent');
    el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data }));
};

const setValueWithEvents = (el, nextValue, caret, data) => {
    if (!fireBeforeInput(el, data)) return false;
    const setter = nativeValueSetter(el);
    if (!setter) return false;
    setter.call(el, nextValue);
    try {
        el.setSelectionRange(caret, caret);
    } catch {
        // Some input types reject selection APIs; the value is what matters.
    }
    fireInput(el, data);
    el.dispatchEvent(new (ctor(el, 'Event'))('change', { bubbles: true }));
    return true;
};

const focusTarget = (el) => {
    if (el.ownerDocument.activeElement !== el && !el.contains(el.ownerDocument.activeElement)) el.focus({ preventScroll: true });
};

const insertIntoValueField = async (el, text, { mode, useCaret }) => {
    const doc = el.ownerDocument;
    const win = doc.defaultView;
    const multiline = el.tagName === 'TEXTAREA';
    const body = multiline ? text : text.replace(/\s*\n+\s*/g, ' ');
    const before = el.value;
    const plan = planValueInsertion(before, { selectionEnd: el.selectionEnd, useCaret, mode, multiline });
    const insert = plan.prefix + body + plan.suffix;
    const expected = before.slice(0, plan.from) + insert + before.slice(plan.to);

    focusTarget(el);
    el.setSelectionRange(plan.from, plan.to);

    let method = null;
    if (tryExecCommand(doc, insert)) method = 'execCommand';
    if (el.value === before) await settle(win);
    if (el.value === before) {
        method = setValueWithEvents(el, expected, plan.from + insert.length, insert) ? 'value-setter' : null;
    }
    return { before, body, method };
};

const rangeTextBefore = (el, range) => {
    const r = el.ownerDocument.createRange();
    r.selectNodeContents(el);
    r.setEnd(range.startContainer, range.startOffset);
    return r.toString();
};

const rangeTextAfter = (el, range) => {
    const r = el.ownerDocument.createRange();
    r.selectNodeContents(el);
    r.setStart(range.endContainer, range.endOffset);
    return r.toString();
};

const insertTextNodes = (el, range, text) => {
    const doc = el.ownerDocument;
    const frag = doc.createDocumentFragment();
    text.split('\n').forEach((line, i) => {
        if (i) frag.appendChild(doc.createElement('br'));
        if (line) frag.appendChild(doc.createTextNode(line));
    });
    const last = frag.lastChild;
    range.deleteContents();
    range.insertNode(frag);
    if (last) {
        const sel = doc.getSelection();
        const after = doc.createRange();
        after.setStartAfter(last);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
    }
};

const dispatchPaste = (el, text) => {
    try {
        const DataTransfer = ctor(el, 'DataTransfer');
        const ClipboardEvent = ctor(el, 'ClipboardEvent');
        const data = new DataTransfer();
        data.setData('text/plain', text);
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true, composed: true }));
    } catch {
        // Environments without DataTransfer/ClipboardEvent constructors fall through to text-node insertion.
    }
};

const insertIntoContentEditable = async (el, text, { mode, useCaret, savedRange }) => {
    const doc = el.ownerDocument;
    const win = doc.defaultView;
    const before = readValue(el);

    focusTarget(el);
    const range = doc.createRange();
    if (mode === 'replace') {
        range.selectNodeContents(el);
    } else if (useCaret && savedRange && el.contains(savedRange.endContainer)) {
        range.setStart(savedRange.endContainer, savedRange.endOffset);
        range.collapse(true);
    } else {
        range.selectNodeContents(el);
        range.collapse(false);
    }

    let prefix = '';
    let suffix = '';
    if (mode !== 'replace') {
        if (rangeTextBefore(el, range).trim()) prefix = '\n';
        if (rangeTextAfter(el, range).trim()) suffix = '\n';
    }
    const insert = prefix + text + suffix;

    const sel = doc.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const unchanged = () => readValue(el) === before;
    let method = null;
    if (tryExecCommand(doc, insert)) method = 'execCommand';
    if (unchanged()) await settle(win);
    if (unchanged()) {
        dispatchPaste(el, insert);
        method = 'paste-event';
        await settle(win);
    }
    if (unchanged()) {
        method = null;
        const current = sel.rangeCount ? sel.getRangeAt(0) : range;
        if (el.contains(current.startContainer) && fireBeforeInput(el, insert)) {
            insertTextNodes(el, current, insert);
            fireInput(el, insert);
            method = 'text-nodes';
        }
    }
    return { before, body: text, method };
};

// Checks the text is present now, after the next frame, and after the editor's normal change handling has run.
const verify = async (el, body, before) => {
    const win = el.ownerDocument.defaultView;
    const present = () => el.isConnected && containsText(el, body);
    const checks = [present()];
    await nextFrame(win);
    checks.push(present());
    await wait(VERIFY_DELAY_MS);
    checks.push(present());
    if (checks.every(Boolean)) return 'inserted';
    if (el.isConnected && readValue(el) === before) return 'unchanged';
    return 'uncertain';
};

// Result status:
//   inserted   text is in the field and stayed there
//   unchanged  the field is exactly as before (the editor refused or reverted); safe to offer Copy
//   uncertain  the field changed but our text is not intact; the vet should check it
//   invalid    the target is gone or no longer editable; nothing was attempted
export const insertText = async (el, text, { mode = 'insert', useCaret = false, savedRange = null } = {}) => {
    const reason = ineligibleReason(el);
    if (reason) return { status: 'invalid', reason };
    if (!normalizeText(text)) return { status: 'invalid', reason: 'nothing to insert' };

    const kind = editorKind(el);
    const attempt = kind === 'contenteditable'
        ? await insertIntoContentEditable(el, text, { mode, useCaret, savedRange })
        : await insertIntoValueField(el, text, { mode, useCaret });

    const status = await verify(el, attempt.body, attempt.before);
    return { status, method: attempt.method };
};
