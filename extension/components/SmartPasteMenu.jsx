import { useLayoutEffect, useRef, useState } from 'react';
import RecordSelector from './RecordSelector.jsx';
import { fitPopover } from './fitPopover.js';
import { SECTION_LABELS } from '../services/soapSections.js';

const SECTION_OPTIONS = ['subjective', 'objective', 'assessment', 'plan', 'full'];

const detectedText = (detected) => {
    if (!detected) return 'Not recognized';
    if (detected.source === 'remembered') return `${SECTION_LABELS[detected.section || 'full']} (remembered)`;
    if (detected.kind === 'section') return SECTION_LABELS[detected.section];
    if (detected.kind === 'full') return 'Full SOAP';
    return 'Not sure, choose a section';
};

function PasteAll({ plan, onPasteAll }) {
    if (!plan || plan.fill.length + plan.skipped.length < 2) return null;
    return (
        <div className="sp-menu-section">
            <button type="button" className="sp-action is-primary" disabled={!plan.fill.length} onClick={onPasteAll}>
                Paste all sections
                <span className="sp-action-detail">
                    {plan.fill.length ? `Fills ${plan.fill.map((s) => SECTION_LABELS[s]).join(', ')}` : 'No empty SOAP fields here'}
                </span>
            </button>
            {plan.skipped.length > 0 && (
                <ul className="sp-skipped">
                    {plan.skipped.map((s) => (
                        <li key={s.section}>
                            Skips {SECTION_LABELS[s.section]}: {s.reason}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function FieldMemory({ snap, controller }) {
    if (snap.remembered) {
        return (
            <button type="button" className="sp-link" onClick={controller.forgetField}>
                Forget {SECTION_LABELS[snap.remembered]} for this field
            </button>
        );
    }
    if (snap.override && snap.canRemember) {
        return (
            <button type="button" className="sp-link" onClick={() => controller.rememberSection(snap.override)}>
                Always use {SECTION_LABELS[snap.override]} for this field on this site
            </button>
        );
    }
    return null;
}

export default function SmartPasteMenu({ snap, controller }) {
    const [confirmReplace, setConfirmReplace] = useState(false);
    const menuRef = useRef(null);
    const autoSection = snap.detected?.kind === 'section' ? snap.detected.section : snap.detected?.kind === 'full' ? 'full' : null;

    useLayoutEffect(() => fitPopover(menuRef.current));

    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            controller.closeMenu();
        }
    };

    return (
        <div ref={menuRef} className="sp-menu" role="dialog" aria-label="SmartPaste settings" onKeyDown={onKeyDown}>
            <PasteAll plan={snap.bulkPlan} onPasteAll={controller.pasteAll} />

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
                <FieldMemory snap={snap} controller={controller} />
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
