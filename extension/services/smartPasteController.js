import { classifyField } from './fieldClassifier.js';
import { describeField, editorKind, fieldDisplayName, isEligible, isOwnUi, resolveEditable } from './fieldDetector.js';
import { containsText, insertText, readValue } from './fieldInserter.js';
import { fieldKey } from './fieldMemory.js';
import { rectInViewport } from './positioner.js';
import { FULL, resolveSection, sectionLabel, typeLabel, typeSectionKeys } from './recordTypes.js';
import { recordLabel } from './soapFormatter.js';

// Owns everything that touches the host page: focus tracking (in this document and same-origin child frames),
// the target field, positioning, and paste/copy actions. The React UI only renders `getSnapshot()` and calls actions.

const UI_GRACE_MS = 600;
const SUCCESS_TOAST_MS = 3500;
const CARET_IGNORED_KEYS = new Set(['Tab', 'Shift', 'Escape', 'Meta', 'Control', 'Alt', 'CapsLock']);

const EDITABLE_SELECTOR = 'textarea, input, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]';

const eventNode = (e) => (typeof e.composedPath === 'function' ? e.composedPath()[0] : e.target) || e.target;

// window.origin is right for about:blank and srcdoc frames too, where location.origin is not.
const originOf = (el) => el.ownerDocument.defaultView?.origin || el.ownerDocument.location?.origin || '';

export const createController = ({ win, store, memory = null, copy }) => {
    const listeners = new Set();
    const attached = new Map();
    let uiHost = null;
    let uiContainer = null;
    let lastUiPointer = 0;
    let rafId = 0;
    let toastTimer = 0;
    let resizeObserver = null;

    let state = {
        target: null,
        descriptor: null,
        classification: null,
        override: null,
        useCaret: false,
        savedRange: null,
        menuOpen: false,
        dismissed: false,
        busy: false,
        feedback: null,
        anchor: null,
        bulkPlan: null,
    };
    let snapshot = null;

    // A section the vet told us to always use for this field on this site wins over automatic detection.
    const classify = (el, descriptor) => {
        const remembered = memory?.get(originOf(el), fieldKey(descriptor));
        if (remembered === 'full') return { kind: 'full', source: 'remembered' };
        if (remembered) return { kind: 'section', section: remembered, source: 'remembered' };
        return classifyField(descriptor, { location: el.ownerDocument.location });
    };

    const activeType = () => store.getActiveType();
    const labelOf = (section) => sectionLabel(activeType(), section);

    // What the field asks for, as a section key or 'full'. A field nobody could name gets the whole record when the
    // record is not a SOAP (Summary and Callback usually go into one communication box), and a choice for SOAP.
    const fieldSection = (classification = state.classification, descriptor = state.descriptor) => {
        if (classification?.kind === 'section') return classification.section;
        if (classification?.kind === 'full') return FULL;
        if (classification?.kind === 'ambiguous' && descriptor?.multiline && activeType() !== 'soap') return FULL;
        return null;
    };

    // The section of the active record to paste: the field's section mapped onto this record type, or null.
    const requestedSection = () => state.override || fieldSection();
    const effectiveSection = () => resolveSection(activeType(), requestedSection());

    const detectedLabel = () => {
        const c = state.classification;
        const section = fieldSection();
        if (!c) return 'Not recognized';
        if (!section) return 'Not sure, choose a section';
        if (c.kind === 'ambiguous') return `Not sure, using ${labelOf(FULL)}`;
        return `${labelOf(section)}${c.source === 'remembered' ? ' (remembered)' : ''}`;
    };

    const buildSnapshot = () => {
        const store_ = store.getState();
        const record = store.getActiveRecord();
        const content = store.getActiveContent();
        const type = activeType();
        const requested = requestedSection();
        const section = effectiveSection();
        const text = section && content ? content[section] : '';
        const el = state.target;
        const remembered = state.classification?.source === 'remembered' ? fieldSection() : null;
        const autoSection = fieldSection();
        return {
            visible: !!(store_.enabled && el && !state.dismissed && state.anchor),
            enabled: store_.enabled,
            anchor: state.anchor,
            viewport: { width: win.innerWidth, height: win.innerHeight },
            activeRecordId: store_.activeRecordId,
            activeCaseId: store.getActiveCase()?.id || null,
            cases: store.listCases(),
            patientName: record?.patientName || '',
            recordType: type,
            typeLabel: typeLabel(type),
            recordLabel: recordLabel(record),
            sectionText: text,
            canRemember: !!(state.descriptor && fieldKey(state.descriptor)),
            remembered,
            rememberedLabel: remembered ? labelOf(remembered) : '',
            bulkPlan: state.bulkPlan,
            sectionOptions: [...typeSectionKeys(type), FULL].map((key) => ({ key, label: labelOf(key), available: !!content?.[key] })),
            fieldName: state.descriptor ? fieldDisplayName(state.descriptor) : '',
            detected: state.classification,
            detectedLabel: detectedLabel(),
            autoLabel: autoSection && resolveSection(type, autoSection) ? labelOf(autoSection) : '',
            override: state.override,
            overrideLabel: state.override ? labelOf(state.override) : '',
            section: requested,
            sectionLabel: requested ? labelOf(requested) : '',
            sectionAvailable: !!text,
            duplicate: !!(el && text && containsText(el, text)),
            menuOpen: state.menuOpen,
            busy: state.busy,
            feedback: state.feedback,
        };
    };

    const emit = () => {
        snapshot = buildSnapshot();
        listeners.forEach((fn) => fn());
    };

    const setState = (patch) => {
        state = { ...state, ...patch };
        emit();
    };

    const measure = () => {
        rafId = 0;
        if (!state.target) return;
        if (!state.target.isConnected) {
            clearTarget();
            return;
        }
        const box = rectInViewport(state.target, win);
        setState({ anchor: box && box.visible ? box.rect : null });
    };

    const scheduleMeasure = () => {
        if (!rafId) rafId = win.requestAnimationFrame(measure);
    };

    const clearTarget = () => {
        resizeObserver?.disconnect();
        if (!state.target && !state.menuOpen) return;
        setState({ target: null, descriptor: null, classification: null, override: null, savedRange: null, menuOpen: false, feedback: null, anchor: null, useCaret: false });
    };

    const setTarget = (el) => {
        if (state.target === el) {
            if (state.dismissed) return;
            scheduleMeasure();
            return;
        }
        const descriptor = describeField(el);
        const classification = classify(el, descriptor);
        if (classification.kind === 'ignore') {
            clearTarget();
            return;
        }
        resizeObserver?.disconnect();
        if (typeof win.ResizeObserver === 'function') {
            resizeObserver = resizeObserver || new win.ResizeObserver(scheduleMeasure);
            resizeObserver.observe(el);
        }
        state = { ...state, target: el, descriptor, classification, override: null, useCaret: false, savedRange: null, menuOpen: false, dismissed: false, feedback: null };
        measure();
    };

    const inTarget = (node) => !!(state.target && node && (node === state.target || state.target.contains(node)));
    const uiRecentlyUsed = () => Date.now() - lastUiPointer < UI_GRACE_MS || (uiHost && uiHost.ownerDocument.activeElement === uiHost);

    const handleFocusNode = (node) => {
        if (!store.getState().enabled) return;
        if (isOwnUi(node)) return;
        if (node?.tagName === 'IFRAME') {
            watchFrame(node, true);
            const inner = safeDoc(node)?.activeElement;
            if (inner && inner !== inner.ownerDocument.body) handleFocusNode(inner);
            return;
        }
        if (uiHost && !uiHost.isConnected) remountUi?.();
        const el = resolveEditable(node);
        if (el && isEligible(el)) setTarget(el);
        else if (!uiRecentlyUsed()) clearTarget();
    };

    const onFocusIn = (e) => handleFocusNode(eventNode(e));

    // Hide once focus has settled somewhere that is neither the field nor the SmartPaste UI.
    const hideIfFocusLeft = (leaving) => {
        setTimeout(() => {
            if (state.target !== leaving) return;
            const active = leaving.ownerDocument.activeElement;
            if (active === leaving || leaving.contains(active)) return;
            if (state.menuOpen || uiRecentlyUsed()) return;
            clearTarget();
        }, 150);
    };

    const onFocusOut = (e) => {
        if (state.target && inTarget(eventNode(e))) hideIfFocusLeft(state.target);
    };

    const onPointerDown = (e) => {
        if (isOwnUi(eventNode(e)) || inTarget(eventNode(e))) return;
        if (state.menuOpen) setState({ menuOpen: false });
        if (state.target) hideIfFocusLeft(state.target);
    };

    const onCaretEvent = (e) => {
        if (e.type === 'keyup' && CARET_IGNORED_KEYS.has(e.key)) return;
        if (inTarget(eventNode(e)) && !state.useCaret) state = { ...state, useCaret: true };
    };

    const onKeyDown = (e) => {
        if (e.key !== 'Escape' || !state.target || !inTarget(eventNode(e))) return;
        if (state.menuOpen) setState({ menuOpen: false });
        else if (!state.dismissed) setState({ dismissed: true });
    };

    const onInput = (e) => {
        if (inTarget(eventNode(e))) {
            emit();
            scheduleMeasure();
        }
    };

    const onSelectionChange = () => {
        const el = state.target;
        if (!el || editorKind(el) !== 'contenteditable') return;
        const sel = el.ownerDocument.getSelection();
        if (sel && sel.rangeCount && el.contains(sel.anchorNode)) state = { ...state, savedRange: sel.getRangeAt(0).cloneRange() };
    };

    // Focus moving into a child frame blurs the parent window; the frame element becomes its activeElement.
    const onWindowBlur = (e) => {
        const doc = e.currentTarget.document;
        setTimeout(() => {
            const active = doc.activeElement;
            if (active?.tagName === 'IFRAME') handleFocusNode(active);
        }, 0);
    };

    const safeDoc = (iframe) => {
        try {
            return iframe.contentDocument;
        } catch {
            return null;
        }
    };

    // `force` re-adds listeners: a frame rewritten with document.open() silently loses them.
    const watchFrame = (iframe, force = false) => {
        if (!iframe.__smartpasteWatched) {
            iframe.__smartpasteWatched = true;
            iframe.addEventListener('load', () => {
                const doc = safeDoc(iframe);
                if (doc) attachDoc(doc, true);
            });
        }
        const doc = safeDoc(iframe);
        if (doc) attachDoc(doc, force);
    };

    const attachDoc = (doc, force = false) => {
        const existing = attached.get(doc);
        if (existing && !force) return;
        existing?.detach();

        const fw = doc.defaultView;
        const opts = true;
        doc.addEventListener('focusin', onFocusIn, opts);
        doc.addEventListener('focusout', onFocusOut, opts);
        doc.addEventListener('pointerdown', onPointerDown, opts);
        doc.addEventListener('pointerup', onCaretEvent, opts);
        doc.addEventListener('keyup', onCaretEvent, opts);
        doc.addEventListener('keydown', onKeyDown, opts);
        doc.addEventListener('input', onInput, opts);
        doc.addEventListener('selectionchange', onSelectionChange);
        doc.addEventListener('scroll', scheduleMeasure, { capture: true, passive: true });
        fw?.addEventListener('resize', scheduleMeasure, { passive: true });
        fw?.addEventListener('blur', onWindowBlur);

        const Observer = fw?.MutationObserver || win.MutationObserver;
        const observer = new Observer((mutations) => {
            for (const m of mutations) {
                m.addedNodes.forEach((n) => {
                    if (n.nodeType !== 1) return;
                    if (n.tagName === 'IFRAME') watchFrame(n);
                    else if (n.querySelector?.('iframe')) n.querySelectorAll('iframe').forEach(watchFrame);
                });
            }
        });
        if (doc.documentElement) observer.observe(doc.documentElement, { childList: true, subtree: true });
        doc.querySelectorAll('iframe').forEach(watchFrame);

        attached.set(doc, {
            detach: () => {
                observer.disconnect();
                doc.removeEventListener('focusin', onFocusIn, opts);
                doc.removeEventListener('focusout', onFocusOut, opts);
                doc.removeEventListener('pointerdown', onPointerDown, opts);
                doc.removeEventListener('pointerup', onCaretEvent, opts);
                doc.removeEventListener('keyup', onCaretEvent, opts);
                doc.removeEventListener('keydown', onKeyDown, opts);
                doc.removeEventListener('input', onInput, opts);
                doc.removeEventListener('selectionchange', onSelectionChange);
                doc.removeEventListener('scroll', scheduleMeasure, { capture: true });
                fw?.removeEventListener('resize', scheduleMeasure);
                fw?.removeEventListener('blur', onWindowBlur);
            },
        });

        // A field may already have focus when we attach (e.g. a frame that loaded after the vet clicked into it).
        const active = doc.activeElement;
        if (active && active !== doc.body && doc.hasFocus?.()) handleFocusNode(active);
    };

    let remountUi = null;

    const showFeedback = (feedback) => {
        clearTimeout(toastTimer);
        setState({ feedback });
        if (feedback?.type === 'success') toastTimer = setTimeout(() => setState({ feedback: null }), SUCCESS_TOAST_MS);
    };

    const refocusTarget = () => {
        const el = state.target;
        if (!el || !el.isConnected) return;
        el.focus({ preventScroll: true });
        if (editorKind(el) === 'contenteditable' && state.savedRange && el.contains(state.savedRange.startContainer)) {
            const sel = el.ownerDocument.getSelection();
            sel.removeAllRanges();
            sel.addRange(state.savedRange);
        }
    };

    const sectionText = (section) => {
        const content = store.getActiveContent();
        const key = resolveSection(activeType(), section);
        return key && content ? content[key] || '' : '';
    };

    const copySection = async (section = effectiveSection()) => {
        const text = sectionText(section);
        if (!text) return false;
        const ok = await copy(text, uiContainer);
        const label = labelOf(section);
        showFeedback(ok ? { type: 'success', message: `Copied ${label}. Paste it with Ctrl+V or \u2318V.` } : { type: 'error', message: `Couldn't copy ${label}.` });
        return ok;
    };

    const paste = async ({ again = false, mode = 'insert' } = {}) => {
        const el = state.target;
        const section = effectiveSection();
        const text = sectionText(section);
        if (!el || state.busy) return null;
        const label = section ? labelOf(section) : 'section';
        if (!text) {
            const name = store.getActiveRecord()?.patientName;
            showFeedback({ type: 'error', message: `${name ? `${name}'s` : 'This'} ${typeLabel(activeType())} has no ${labelOf(requestedSection()) || 'such'} section.` });
            return null;
        }
        if (mode === 'insert' && !again && containsText(el, text)) {
            emit();
            return { status: 'duplicate' };
        }

        const recordId = store.getState().activeRecordId;
        setState({ busy: true, menuOpen: false, feedback: null });
        let result;
        try {
            result = await insertText(el, text, { mode, useCaret: state.useCaret, savedRange: state.savedRange });
        } catch (err) {
            result = { status: 'uncertain', reason: String(err?.message || err) };
        }
        state = { ...state, busy: false };

        const copyAction = { kind: 'copy', section };
        if (result.status === 'inserted') {
            const name = store.getActiveRecord()?.patientName;
            showFeedback({ type: 'success', message: `Pasted ${name}'s ${label}${mode === 'replace' ? ' (replaced field)' : ''}.` });
        } else if (result.status === 'unchanged') {
            showFeedback({ type: 'error', message: `This field didn't accept the text. Nothing was changed.`, action: copyAction });
        } else if (result.status === 'invalid') {
            showFeedback({ type: 'error', message: `This field is no longer available.`, action: copyAction });
        } else {
            showFeedback({ type: 'warning', message: `The field changed but the ${label} may be incomplete. Check it before saving.`, action: copyAction });
        }
        return { ...result, recordId, section };
    };

    // Paste All works on the smallest part of the page around the focused field that holds fields for at least
    // two different sections (e.g. the "Clinical notes" panel). Within it, each section needs exactly one field
    // and that field must be empty; anything else is skipped with a reason rather than guessed.
    const planBulk = () => {
        const el = state.target;
        if (!el) return null;
        const seen = new Set();
        const type = activeType();
        const fields = [];
        el.ownerDocument.querySelectorAll(EDITABLE_SELECTOR).forEach((node) => {
            const field = resolveEditable(node);
            if (!field || seen.has(field) || !isEligible(field)) return;
            seen.add(field);
            const c = field === el && state.override ? { kind: 'section', section: state.override } : classify(field, describeField(field));
            const section = c.kind === 'section' ? resolveSection(type, c.section) : null;
            if (section && section !== FULL) fields.push({ el: field, section });
        });

        let scope = el.parentElement;
        let inScope = [];
        while (scope) {
            inScope = fields.filter((f) => scope.contains(f.el));
            if (new Set(inScope.map((f) => f.section)).size >= 2) break;
            scope = scope.parentElement;
        }
        if (!scope) return { fill: [], skipped: [], fields: [] };

        const fill = [];
        const skipped = [];
        typeSectionKeys(type).forEach((section) => {
            const matches = inScope.filter((f) => f.section === section);
            if (!matches.length) return;
            if (matches.length > 1) skipped.push({ section, reason: `${matches.length} fields look like ${labelOf(section)}` });
            else if (!sectionText(section)) skipped.push({ section, reason: 'not in this record' });
            else if (readValue(matches[0].el).trim()) skipped.push({ section, reason: 'field already has text' });
            else fill.push(matches[0]);
        });
        const labelled = (s) => ({ ...s, label: labelOf(s.section) });
        return { fill: fill.map((f) => labelOf(f.section)), skipped: skipped.map(labelled), fields: fill };
    };

    const pasteAll = async () => {
        if (state.busy) return null;
        const plan = planBulk();
        if (!plan?.fields.length) {
            showFeedback({ type: 'error', message: `No empty ${typeLabel(activeType())} fields to fill here.` });
            return plan;
        }
        const origin = state.target;
        setState({ busy: true, menuOpen: false, feedback: null, bulkPlan: null });
        const results = [];
        for (const f of plan.fields) {
            let status;
            try {
                status = (await insertText(f.el, sectionText(f.section), { mode: 'insert' })).status;
            } catch {
                status = 'uncertain';
            }
            results.push({ section: f.section, status });
        }
        state = { ...state, busy: false };
        if (origin?.isConnected) origin.focus({ preventScroll: true });

        const done = results.filter((r) => r.status === 'inserted').map((r) => labelOf(r.section));
        const failed = results.filter((r) => r.status !== 'inserted').map((r) => labelOf(r.section));
        const name = store.getActiveRecord()?.patientName;
        const parts = [];
        if (done.length) parts.push(`Pasted ${name}'s ${done.join(', ')}.`);
        if (failed.length) parts.push(`Check ${failed.join(', ')}: the field did not take the text.`);
        if (plan.skipped.length) parts.push(`Skipped ${plan.skipped.map((s) => `${s.label} (${s.reason})`).join(', ')}.`);
        showFeedback({ type: failed.length ? 'warning' : plan.skipped.length ? 'info' : 'success', message: parts.join(' ') });
        return { results, skipped: plan.skipped };
    };

    const rememberSection = async (section) => {
        const el = state.target;
        const key = state.descriptor && fieldKey(state.descriptor);
        if (!el || !key || !memory) return;
        await memory.remember(originOf(el), key, section);
        setState({ override: null, menuOpen: false, feedback: { type: 'success', message: `${labelOf(section)} will be used for this field on this site.` } });
        refocusTarget();
    };

    const forgetField = async () => {
        const el = state.target;
        const key = state.descriptor && fieldKey(state.descriptor);
        if (!el || !key || !memory) return;
        await memory.forget(originOf(el), key);
        setState({ menuOpen: false, feedback: null });
        refocusTarget();
    };

    // Re-detect the focused field when remembered mappings change (here, in another tab, or after loading).
    const unsubscribeMemory = memory?.subscribe(() => {
        if (state.target && state.descriptor) setState({ classification: classify(state.target, state.descriptor) });
    });

    const unsubscribeStore = store.subscribe(() => emit());

    snapshot = buildSnapshot();

    return {
        getSnapshot: () => snapshot,
        subscribe: (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        attachUi: (host, container, remount) => {
            uiHost = host;
            uiContainer = container;
            remountUi = remount;
            host.addEventListener('pointerdown', () => (lastUiPointer = Date.now()), true);
        },
        start: () => {
            attachDoc(win.document);
            const active = win.document.activeElement;
            if (active && active !== win.document.body) handleFocusNode(active);
        },
        destroy: () => {
            unsubscribeStore();
            unsubscribeMemory?.();
            resizeObserver?.disconnect();
            attached.forEach((a) => a.detach());
            attached.clear();
        },
        paste,
        pasteAll,
        rememberSection,
        forgetField,
        copySection,
        replaceAll: () => paste({ mode: 'replace' }),
        selectRecord: async (id) => {
            await store.selectRecord(id);
            setState({ override: null, menuOpen: false, feedback: null });
            refocusTarget();
        },
        // Picking a case keeps the menu open so a different record type in it can be chosen next.
        selectCase: async (id) => {
            await store.selectCase(id);
            const plan = state.menuOpen ? planBulk() : null;
            setState({ override: null, feedback: null, bulkPlan: plan ? { fill: plan.fill, skipped: plan.skipped } : null });
        },
        setOverride: (section) => {
            setState({ override: section, menuOpen: false, feedback: null });
            refocusTarget();
        },
        toggleMenu: () => {
            const opening = !state.menuOpen;
            const plan = opening ? planBulk() : null;
            setState({ menuOpen: opening, bulkPlan: plan ? { fill: plan.fill, skipped: plan.skipped } : null });
        },
        closeMenu: (refocus = true) => {
            setState({ menuOpen: false });
            if (refocus) refocusTarget();
        },
        dismiss: () => setState({ dismissed: true, menuOpen: false }),
        setEnabled: async (enabled) => {
            await store.setEnabled(enabled);
            if (!enabled) clearTarget();
        },
        // Exposed for tests.
        _state: () => state,
    };
};
