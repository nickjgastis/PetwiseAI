import { useLayoutEffect, useRef, useState } from 'react';
import CasePicker from './CasePicker.jsx';
import { fitPopover } from './fitPopover.js';
import { openHelp } from '../platform/browser.js';

function PasteAll({ plan, typeLabel, onPasteAll }) {
    if (!plan || plan.fill.length + plan.skipped.length < 2) return null;
    return (
        <div className="sp-menu-section">
            <button type="button" className="sp-action is-primary" disabled={!plan.fill.length} onClick={onPasteAll}>
                Paste all sections
                <span className="sp-action-detail">
                    {plan.fill.length ? `Fills ${plan.fill.join(', ')}` : `No empty ${typeLabel} fields here`}
                </span>
            </button>
            {plan.skipped.length > 0 && (
                <ul className="sp-skipped">
                    {plan.skipped.map((s) => (
                        <li key={s.section}>
                            Skips {s.label}: {s.reason}
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
                Forget {snap.rememberedLabel} for this field
            </button>
        );
    }
    if (snap.override && snap.canRemember) {
        return (
            <button type="button" className="sp-link" onClick={() => controller.rememberSection(snap.override)}>
                Always use {snap.overrideLabel} for this field on this site
            </button>
        );
    }
    return null;
}

export default function SmartPasteMenu({ snap, controller, closing = false }) {
    const [confirmReplace, setConfirmReplace] = useState(false);
    const menuRef = useRef(null);

    useLayoutEffect(() => fitPopover(menuRef.current));

    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            controller.closeMenu();
        }
    };

    return (
        <div
            ref={menuRef}
            className={`sp-menu${closing ? ' is-closing' : ''}`}
            role="dialog"
            aria-label="SmartPaste settings"
            aria-hidden={closing || undefined}
            onKeyDown={onKeyDown}
        >
            <PasteAll plan={snap.bulkPlan} typeLabel={snap.typeLabel} onPasteAll={controller.pasteAll} />

            <div className="sp-menu-section">
                <div className="sp-menu-title">PetWise record</div>
                <CasePicker
                    cases={snap.cases}
                    activeCaseId={snap.activeCaseId}
                    activeRecordId={snap.activeRecordId}
                    onSelectCase={controller.selectCase}
                    onSelectRecord={controller.selectRecord}
                />
            </div>

            {snap.sectionOptions.length > 0 && (
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
                            {snap.remembered ? `Remembered (${snap.rememberedLabel})` : `Auto-detect${snap.autoLabel ? ` (${snap.autoLabel})` : ''}`}
                        </button>
                        {snap.sectionOptions.map((o) => {
                            const active = snap.override === o.key;
                            return (
                                <button
                                    key={o.key}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    disabled={!o.available}
                                    className={`sp-section-option${active ? ' is-active' : ''}`}
                                    onClick={() => controller.setOverride(o.key)}
                                >
                                    {o.label}
                                </button>
                            );
                        })}
                    </div>
                    <FieldMemory snap={snap} controller={controller} />
                </div>
            )}

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
            </div>

            <div className="sp-menu-foot">
                <button type="button" className="sp-text-link" onClick={openHelp}>
                    How it works
                </button>
                <button type="button" className="sp-text-link is-quiet" onClick={() => controller.setEnabled(false)}>
                    Turn off SmartPaste
                </button>
            </div>
        </div>
    );
}
