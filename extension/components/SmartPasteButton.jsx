import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import SmartPasteMenu from './SmartPasteMenu.jsx';
import { placeChip } from '../services/positioner.js';

// Keeps focus (and the caret) in the PIMS field when a chip button is clicked with the mouse.
const keepFieldFocus = (e) => e.preventDefault();

function PrimaryAction({ snap, controller }) {
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
                No {snap.sectionLabel} in record
            </button>
        );
    }
    if (snap.duplicate) {
        return (
            <>
                <span className="sp-done" role="status">
                    Pasted {'\u2713'}
                </span>
                <button type="button" className="sp-again" onMouseDown={keepFieldFocus} onClick={() => controller.paste({ again: true })}>
                    Paste again
                </button>
            </>
        );
    }
    return (
        <button type="button" className="sp-primary" onMouseDown={keepFieldFocus} onClick={() => controller.paste()}>
            Paste {snap.sectionLabel}
        </button>
    );
}

export default function SmartPasteButton({ controller }) {
    const snap = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
    const rootRef = useRef(null);

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
                <span className="sp-patient" title="Active PetWise record">
                    <span aria-hidden="true">{'\ud83d\udc3e'}</span> {snap.patientName}
                </span>
                <span className="sp-divider" aria-hidden="true" />
                <PrimaryAction snap={snap} controller={controller} />
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
                <div className={`sp-feedback is-${feedback.type}`} role={feedback.type === 'success' ? 'status' : 'alert'}>
                    <span>{feedback.message}</span>
                    {feedback.action?.kind === 'copy' && (
                        <button type="button" className="sp-feedback-action" onClick={() => controller.copySection(feedback.action.section)}>
                            Copy section
                        </button>
                    )}
                </div>
            )}

            {snap.menuOpen && <SmartPasteMenu snap={snap} controller={controller} />}
        </div>
    );
}
