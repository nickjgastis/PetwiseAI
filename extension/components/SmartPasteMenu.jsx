import { useLayoutEffect, useRef, useState } from 'react';
import RecordSelector from './RecordSelector.jsx';
import { SECTION_LABELS } from '../services/soapSections.js';

const SECTION_OPTIONS = ['subjective', 'objective', 'assessment', 'plan', 'full'];

const detectedText = (detected) => {
    if (!detected) return 'Not recognized';
    if (detected.kind === 'section') return SECTION_LABELS[detected.section];
    if (detected.kind === 'full') return 'Full SOAP';
    return 'Not sure, choose a section';
};

const VIEWPORT_MARGIN = 8;
const MIN_MENU_HEIGHT = 160;

export default function SmartPasteMenu({ snap, controller }) {
    const [confirmReplace, setConfirmReplace] = useState(false);
    const menuRef = useRef(null);

    // The control is position: fixed, so page scrolling can never reveal an off-screen menu. Open towards the
    // side with more room and cap the height to what fits; the menu scrolls internally beyond that.
    useLayoutEffect(() => {
        const menu = menuRef.current;
        const anchor = menu?.parentElement?.getBoundingClientRect();
        if (!anchor) return;
        const viewportHeight = menu.ownerDocument.defaultView.innerHeight;
        const below = viewportHeight - anchor.bottom - VIEWPORT_MARGIN - 6;
        const above = anchor.top - VIEWPORT_MARGIN - 6;
        menu.style.maxHeight = 'none';
        const natural = menu.scrollHeight;
        const up = natural > below && above > below;
        menu.classList.toggle('is-up', up);
        menu.style.maxHeight = `${Math.max(MIN_MENU_HEIGHT, Math.floor(up ? above : below))}px`;
    });
    const autoSection = snap.detected?.kind === 'section' ? snap.detected.section : snap.detected?.kind === 'full' ? 'full' : null;

    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            controller.closeMenu();
        }
    };

    return (
        <div ref={menuRef} className="sp-menu" role="dialog" aria-label="SmartPaste settings" onKeyDown={onKeyDown}>
            <div className="sp-menu-section">
                <div className="sp-menu-title">Active PetWise record</div>
                <RecordSelector records={snap.records} activeId={snap.activeRecordId} onSelect={controller.selectRecord} />
            </div>

            <div className="sp-menu-section">
                <div className="sp-menu-title">Paste section</div>
                <div className="sp-sections" role="radiogroup" aria-label="Paste section">
                    <button
                        type="button"
                        role="radio"
                        aria-checked={!snap.override}
                        className={`sp-section-option${!snap.override ? ' is-active' : ''}`}
                        onClick={() => controller.setOverride(null)}
                    >
                        Auto-detect{autoSection ? ` (${SECTION_LABELS[autoSection]})` : ''}
                    </button>
                    {SECTION_OPTIONS.map((key) => {
                        const available = snap.availableSections.includes(key);
                        const active = snap.override === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={!available}
                                className={`sp-section-option${active ? ' is-active' : ''}`}
                                onClick={() => controller.setOverride(key)}
                            >
                                {SECTION_LABELS[key]}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="sp-menu-section sp-meta">
                <div>
                    <span className="sp-meta-key">Field</span> {snap.fieldName}
                </div>
                <div>
                    <span className="sp-meta-key">Detected</span> {detectedText(snap.detected)}
                </div>
            </div>

            <div className="sp-menu-section sp-actions">
                <button type="button" className="sp-action" disabled={!snap.sectionAvailable} onClick={() => controller.copySection()}>
                    Copy {snap.sectionLabel || 'section'}
                </button>
                {!confirmReplace ? (
                    <button type="button" className="sp-action" disabled={!snap.sectionAvailable} onClick={() => setConfirmReplace(true)}>
                        Replace field with {snap.sectionLabel || 'section'}...
                    </button>
                ) : (
                    <div className="sp-confirm" role="group" aria-label="Confirm replace">
                        <span>Replace everything in this field?</span>
                        <button type="button" className="sp-action is-danger" onClick={() => controller.replaceAll()}>
                            Replace
                        </button>
                        <button type="button" className="sp-action" onClick={() => setConfirmReplace(false)}>
                            Cancel
                        </button>
                    </div>
                )}
                <button type="button" className="sp-action is-quiet" onClick={() => controller.setEnabled(false)}>
                    Turn off SmartPaste
                </button>
            </div>
        </div>
    );
}
