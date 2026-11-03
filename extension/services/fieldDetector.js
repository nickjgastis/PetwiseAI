// Finds the editable element the vet is working in and describes it for the classifier.

export const UI_HOST_TAG = 'PETWISE-SMARTPASTE';

const TEXT_INPUT_TYPES = new Set(['', 'text']);

const isElement = (node) => node && node.nodeType === 1;

// isContentEditable with an attribute fallback for environments that do not implement it.
export const isContentEditable = (el) => {
    if (!isElement(el)) return false;
    if (typeof el.isContentEditable === 'boolean') return el.isContentEditable;
    for (let n = el; isElement(n); n = n.parentElement) {
        const v = n.getAttribute('contenteditable');
        if (v === '' || v === 'true' || v === 'plaintext-only') return true;
        if (v === 'false') return false;
    }
    return false;
};

export const isOwnUi = (node) => {
    for (let n = node; n; n = n.parentNode || n.host) {
        if (n.tagName === UI_HOST_TAG) return true;
    }
    return false;
};

// The element that actually holds the text: the input itself, or the outermost contenteditable host.
export const resolveEditable = (node) => {
    if (!isElement(node)) node = node?.parentElement;
    if (!node) return null;
    const tag = node.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') return node;
    if (!isContentEditable(node)) return null;
    let host = node;
    while (host.parentElement && isContentEditable(host.parentElement)) host = host.parentElement;
    return host;
};

export const editorKind = (el) => {
    if (!isElement(el)) return null;
    if (el.tagName === 'TEXTAREA') return 'textarea';
    if (el.tagName === 'INPUT') return 'input';
    if (isContentEditable(el)) return 'contenteditable';
    return null;
};

const isHidden = (el) => {
    if (el.hidden || el.getAttribute('aria-hidden') === 'true') return true;
    const win = el.ownerDocument.defaultView;
    const style = win?.getComputedStyle(el);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return true;
    return typeof el.getClientRects === 'function' && el.getClientRects().length === 0 && el.ownerDocument.body?.getClientRects().length > 0;
};

// Why a field is not eligible, or null when SmartPaste may offer to paste into it.
export const ineligibleReason = (el) => {
    const kind = editorKind(el);
    if (!kind) return 'not editable';
    if (!el.isConnected) return 'detached';
    if (isOwnUi(el)) return 'smartpaste ui';
    if (kind === 'input') {
        const type = (el.getAttribute('type') || '').toLowerCase();
        if (!TEXT_INPUT_TYPES.has(type)) return `input type ${type}`;
    }
    if (kind !== 'contenteditable' && (el.disabled || el.readOnly)) return 'disabled or read-only';
    if (el.matches?.(':disabled')) return 'disabled';
    if (el.getAttribute('aria-readonly') === 'true' || el.getAttribute('aria-disabled') === 'true') return 'aria read-only';
    if (el.getAttribute('role') === 'searchbox' || el.getAttribute('role') === 'combobox') return 'search or combobox';
    if (isHidden(el)) return 'hidden';
    return null;
};

export const isEligible = (el) => ineligibleReason(el) === null;

// Text of an element without the text of any form controls nested inside it (a <label> wrapping a <textarea>).
const ownText = (el) => {
    if (!el) return '';
    const clone = el.cloneNode(true);
    clone.querySelectorAll('input, textarea, select, button, [contenteditable]').forEach((n) => n.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
};

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, legend, label, [role="heading"]';

const CONTROL_SELECTOR = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';

// A label for some other control says nothing about this field.
const belongsElsewhere = (heading, el) => heading.tagName === 'LABEL' && heading.control && heading.control !== el;

// The closest heading-like text above the field: a preceding sibling, or one in a nearby ancestor.
// Scanning stops at another form control, so a neighbouring field's label is never borrowed.
const nearbyHeading = (el) => {
    let node = el;
    for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
        let sib = node.previousElementSibling;
        for (let hops = 0; sib && hops < 3; hops++, sib = sib.previousElementSibling) {
            if (sib.matches(HEADING_SELECTOR)) {
                if (belongsElsewhere(sib, el)) return '';
                return ownText(sib);
            }
            if (sib.matches(CONTROL_SELECTOR) || sib.querySelector(CONTROL_SELECTOR)) return '';
            const inner = Array.from(sib.querySelectorAll(HEADING_SELECTOR)).filter((h) => !belongsElsewhere(h, el));
            if (inner.length) return ownText(inner[inner.length - 1]);
        }
    }
    return '';
};

const labelledByText = (el) => {
    const ids = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
    return ids
        .map((id) => ownText(el.ownerDocument.getElementById(id)))
        .filter(Boolean)
        .join(' ');
};

export const describeField = (el) => {
    const kind = editorKind(el);
    const labels = kind === 'contenteditable' ? [] : Array.from(el.labels || []);
    const sources = [
        { kind: 'label', text: labels.map(ownText).filter(Boolean).join(' ') },
        { kind: 'aria-label', text: el.getAttribute('aria-label') || '' },
        { kind: 'aria-labelledby', text: labelledByText(el) },
        { kind: 'placeholder', text: el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || '' },
        { kind: 'heading', text: nearbyHeading(el) },
        { kind: 'name', text: el.getAttribute('name') || '' },
        { kind: 'id', text: el.id || '' },
    ].filter((s) => s.text);
    return { kind, multiline: kind !== 'input', sources };
};

// Best human-readable name for the field, for the settings menu.
export const fieldDisplayName = (descriptor) => {
    const order = ['label', 'aria-labelledby', 'aria-label', 'placeholder', 'heading', 'name', 'id'];
    for (const kind of order) {
        const s = descriptor.sources.find((x) => x.kind === kind);
        if (s) return s.text.length > 40 ? `${s.text.slice(0, 39)}\u2026` : s.text;
    }
    return 'Unlabelled field';
};
