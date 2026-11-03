import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import PetWiseLogo from './PetWiseLogo.jsx';
import SmartPasteMenu from './SmartPasteMenu.jsx';
import { fitPopover } from './fitPopover.js';
import { usePresence } from './usePresence.js';
import { placeChip } from '../services/positioner.js';

const PREVIEW_DELAY_MS = 250;
const PREVIEW_LINES = 6;
const PREVIEW_LINE_CHARS = 90;

// Keeps focus (and the caret) in the PIMS field when a chip button is clicked with the mouse.
const keepFieldFocus = (e) => e.preventDefault();

function Preview({ snap, closing }) {
    const ref = useRef(null);
    useLayoutEffect(() => fitPopover(ref.current));
    const lines = snap.sectionText.split('\n');
    const shown = lines.slice(0, PREVIEW_LINES).map((l) => (l.length > PREVIEW_LINE_CHARS ? `${l.slice(0, PREVIEW_LINE_CHARS - 1)}\u2026` : l));
    const more = lines.length - shown.length;
    return (
        <div ref={ref} className={`sp-preview${closing ? ' is-closing' : ''}`} role="tooltip" aria-hidden={closing || undefined} data-testid="smartpaste-preview">
            <div className="sp-preview-title">
                {snap.patientName} {'\u00b7'} {snap.typeLabel} {'\u00b7'} {snap.sectionLabel}
            </div>
            <pre className="sp-preview-text">{shown.join('\n')}</pre>
            {more > 0 && <div className="sp-preview-more">+{more} more lines</div>}
        </div>
    );
}

// Hover (or keyboard focus) on a paste button shows what will be pasted; it never pastes by itself.
const usePreview = () => {
    const [open, setOpen] = useState(false);
    const timer = useRef(0);
    useEffect(() => () => clearTimeout(timer.current), []);
    const show = () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setOpen(true), PREVIEW_DELAY_MS);
    };
    const hide = () => {
        clearTimeout(timer.current);
        setOpen(false);
    };
    return { open, hide, bind: { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide } };
};

function PrimaryAction({ snap, controller, previewBind }) {
    if (snap.busy) {
        return (
            <button type="button" className="sp-primary" disabled>
                Pasting...
            </button>
        );
    }
    if (!snap.section) {
        return (
            <button type="button" className="sp-primary is-choose" onMouseDown={keepFieldFocus} onClick={controller.toggleMenu}>
                Choose section
            </button>
        );
    }
    if (!snap.sectionAvailable) {
        return (
            <button type="button" className="sp-primary" disabled>
                No {snap.sectionLabel} in {snap.typeLabel}
            </button>
        );
    }
    if (snap.duplicate) {
        return (
            <>
                <span className="sp-done" role="status">
                    Pasted {'\u2713'}
                </span>
                <button type="button" className="sp-again" onMouseDown={keepFieldFocus} onClick={() => controller.paste({ again: true })} {...previewBind}>
                    Paste again
                </button>
            </>
        );
    }
    return (
        <button type="button" className="sp-primary" onMouseDown={keepFieldFocus} onClick={() => controller.paste()} {...previewBind}>
            Paste {snap.sectionLabel}
        </button>
    );
}

export default function SmartPasteButton({ controller }) {
    const snap = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
    const rootRef = useRef(null);
    const preview = usePreview();
    const previewTarget = snap.visible && snap.section && snap.sectionText ? `${snap.activeRecordId}:${snap.section}` : null;

    // Close the preview whenever what it would show changes (field, record, section) or a paste starts.
    useEffect(() => preview.hide(), [previewTarget, snap.busy, snap.menuOpen]);

    // Popovers render the last snapshot they were open with while they animate out.
    const showPreview = preview.open && !!previewTarget && !snap.menuOpen && !snap.busy;
    const menu = usePresence(snap.menuOpen);
    const previewPresence = usePresence(showPreview);
    const menuSnap = useRef(snap);
    const previewSnap = useRef(snap);
    if (snap.menuOpen) menuSnap.current = snap;
    if (showPreview) previewSnap.current = snap;

    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!root || !snap.visible || !snap.anchor) return;
        const chip = root.querySelector('.sp-chip');
        const pos = placeChip(snap.anchor, { width: chip.offsetWidth, height: chip.offsetHeight }, snap.viewport);
        root.style.top = `${Math.round(pos.top)}px`;
        root.style.left = `${Math.round(pos.left)}px`;
        root.dataset.placement = pos.placement;
    });

    if (!snap.visible) return null;

    const feedback = snap.feedback;

    return (
        <div ref={rootRef} className="sp-root" data-testid="smartpaste">
            <div className="sp-chip" role="toolbar" aria-label="PetWise SmartPaste">
                <PetWiseLogo />
                <span className="sp-patient" title="Active PetWise record">
                    <span className="sp-patient-name">{snap.patientName}</span>
                    <span className={`sp-type is-${snap.recordType}`}>{snap.typeLabel}</span>
                </span>
                <span className="sp-divider" aria-hidden="true" />
                <PrimaryAction snap={snap} controller={controller} previewBind={preview.bind} />
                <span className="sp-divider" aria-hidden="true" />
                <button
                    type="button"
                    className="sp-icon"
                    aria-label="SmartPaste settings"
                    aria-expanded={snap.menuOpen}
                    onMouseDown={keepFieldFocus}
                    onClick={controller.toggleMenu}
                >
                    {'\u2699'}
                </button>
                <button type="button" className="sp-icon sp-close" aria-label="Dismiss SmartPaste" onMouseDown={keepFieldFocus} onClick={controller.dismiss}>
                    {'\u00d7'}
                </button>
            </div>

            {feedback && (
                <div key={feedback.message} className={`sp-feedback is-${feedback.type}`} role={feedback.type === 'success' ? 'status' : 'alert'}>
                    <span>{feedback.message}</span>
                    {feedback.action?.kind === 'copy' && (
                        <button type="button" className="sp-feedback-action" onClick={() => controller.copySection(feedback.action.section)}>
                            Copy section
                        </button>
                    )}
                </div>
            )}

            {menu.mounted && <SmartPasteMenu snap={menuSnap.current} controller={controller} closing={menu.closing} />}
            {previewPresence.mounted && <Preview snap={previewSnap.current} closing={previewPresence.closing} />}
        </div>
    );
}
