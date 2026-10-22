import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PiTooth } from 'react-icons/pi';
import { FiX } from 'react-icons/fi';
import DentalChart from './DentalChart';
import { STATUSES, STATUS_ORDER, toothLabel } from '../dental/teeth';

const FONT = { fontFamily: 'var(--font-sans)' };
const POP_W = 252;
const GAP = 10;

const Swatch = ({ s }) => (
    <span
        className="w-3 h-3 shrink-0 rounded-[4px]"
        style={{ background: STATUSES[s].fill === 'none' ? 'transparent' : STATUSES[s].fill, border: `1.5px ${STATUSES[s].dashed ? 'dashed' : 'solid'} ${STATUSES[s].stroke}` }}
    />
);

// Chart side of a dental record. `dental` is { species, teeth: { [id]: { status, note } } }.
const DentalRecordPanel = ({ dental, onChange, chartMaxHeight }) => {
    const [selected, setSelected] = useState(null);
    const [pos, setPos] = useState(null);
    const areaRef = useRef(null);
    const popRef = useRef(null);
    const species = dental?.species === 'feline' ? 'feline' : 'canine';
    const teeth = dental?.teeth || {};
    const charted = Object.keys(teeth).sort();
    const current = selected ? teeth[selected] || { status: 'normal' } : null;

    const update = (next) => onChange({ ...dental, species, teeth: next });
    const setTooth = (id, patch) => {
        const merged = { ...(teeth[id] || {}), ...patch };
        const { [id]: _, ...rest } = teeth;
        update(merged.status === 'normal' && !merged.note ? rest : { ...teeth, [id]: merged });
    };
    const setSpecies = (s) => {
        if (s === species) return;
        setSelected(null);
        onChange({ ...dental, species: s, teeth: {} });
    };
    const close = () => setSelected(null);

    // Beside the tooth when there's room, otherwise above or below it. Clamped inside the chart area.
    const place = () => {
        const area = areaRef.current;
        const tooth = selected && area?.querySelector(`[data-tooth="${selected}"]`);
        if (!tooth || !popRef.current) return;
        const a = area.getBoundingClientRect();
        const r = tooth.getBoundingClientRect();
        const h = popRef.current.offsetHeight;
        const cx = r.left + r.width / 2 - a.left;
        const cy = r.top + r.height / 2 - a.top;
        const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
        const roomRight = a.width - (r.right - a.left) - GAP;
        const roomLeft = r.left - a.left - GAP;
        let left;
        let top;
        if (Math.max(roomRight, roomLeft) >= POP_W + 8) {
            left = cx < a.width / 2 ? r.right - a.left + GAP : r.left - a.left - GAP - POP_W;
            top = cy - h / 2;
        } else {
            left = cx - POP_W / 2;
            top = cy < a.height / 2 ? r.bottom - a.top + GAP : r.top - a.top - GAP - h;
        }
        setPos({ left: clamp(left, 8, a.width - POP_W - 8), top: clamp(top, 8, Math.max(8, a.height - h - 8)) });
    };

    useLayoutEffect(() => {
        if (!selected) setPos(null);
        else place();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, species]);

    useEffect(() => {
        if (!selected) return;
        const onDown = (e) => {
            if (popRef.current?.contains(e.target) || e.target.closest?.('[data-tooth]') || e.target.closest?.('[data-tooth-row]')) return;
            close();
        };
        const onKey = (e) => e.key === 'Escape' && close();
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', place);
        return () => {
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', place);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected]);

    return (
        <div className="bg-white rounded-2xl border border-gray-100" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)', ...FONT }}>
            <div className="px-5 py-2 flex items-center gap-2.5 bg-gradient-to-r from-violet-500 to-violet-600 rounded-t-2xl">
                <span className="w-6 h-6 rounded-md flex items-center justify-center text-white" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <PiTooth className="text-[13px]" />
                </span>
                <h3 className="text-white font-semibold tracking-wider uppercase m-0" style={{ fontSize: '12px', letterSpacing: '0.08em' }}>
                    Dental Chart
                </h3>
                <div className="ml-auto bg-white/15 rounded-full p-0.5 inline-flex gap-0.5">
                    {['canine', 'feline'].map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setSpecies(s)}
                            title={s === species ? undefined : 'Switching clears the chart'}
                            className={`px-3 py-1 rounded-full text-[12px] font-semibold border-none cursor-pointer transition-colors ${s === species ? 'bg-white text-violet-700' : 'bg-transparent text-white/80 hover:text-white'}`}
                        >
                            {s === 'canine' ? 'Dog' : 'Cat'}
                        </button>
                    ))}
                </div>
            </div>

            <div ref={areaRef} className="relative px-4 sm:px-6 pt-5 pb-4">
                <DentalChart
                    species={species}
                    teeth={teeth}
                    selected={selected}
                    maxHeight={chartMaxHeight}
                    onToothClick={(id) => setSelected((cur) => (cur === id ? null : id))}
                />

                <AnimatePresence>
                    {selected && (
                        <motion.div
                            key="tooth-pop"
                            ref={popRef}
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: pos ? 1 : 0, scale: pos ? 1 : 0.96 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ duration: 0.16, ease: 'easeOut' }}
                            className="absolute z-20 rounded-[18px] bg-white border border-[#e7ecf3] p-3 shadow-[0_24px_48px_-20px_rgba(19,35,63,0.35)]"
                            style={{ width: POP_W, left: pos?.left ?? 0, top: pos?.top ?? 0, transition: 'left 180ms ease, top 180ms ease' }}
                        >
                            <div className="flex items-start gap-2.5 px-1 pb-2.5">
                                <span className="text-[18px] font-semibold text-[#13233f] leading-none pt-0.5" style={{ fontFeatureSettings: "'tnum'" }}>{selected}</span>
                                <span className="text-[12px] text-[#1a2b4a]/55 leading-snug">{toothLabel(species, selected)}</span>
                                <button type="button" onClick={close} className="ml-auto -mr-1 -mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[#1a2b4a]/40 hover:text-[#13233f] hover:bg-[#f3f6fa] border-none bg-transparent cursor-pointer" title="Close">
                                    <FiX className="text-[14px]" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                                {STATUS_ORDER.map((s) => {
                                    const on = (current?.status || 'normal') === s;
                                    return (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setTooth(selected, { status: s })}
                                            className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-[12.5px] font-medium text-left cursor-pointer border transition-colors ${on ? 'bg-[#eef4fc] border-[#2d5fb8]/35 text-[#13233f]' : 'bg-transparent border-transparent text-[#1a2b4a]/75 hover:bg-[#f6f8fb]'}`}
                                        >
                                            <Swatch s={s} />
                                            {STATUSES[s].label}
                                        </button>
                                    );
                                })}
                            </div>
                            <input
                                value={current?.note || ''}
                                onChange={(e) => setTooth(selected, { note: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && close()}
                                placeholder="Note, e.g. PD4, mobility 2"
                                className="mt-2 w-full px-3 py-2 rounded-xl bg-[#f6f8fb] border border-transparent text-[13px] text-[#13233f] focus:outline-none focus:bg-white focus:border-[#2d5fb8]/30"
                                style={FONT}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="px-4 sm:px-6 pb-5">
                {charted.length ? (
                    <div className="rounded-[18px] bg-[#f6f8fb] p-1.5">
                        {charted.map((id) => (
                            <button
                                key={id}
                                type="button"
                                data-tooth-row
                                onClick={() => setSelected(id)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-none cursor-pointer text-left transition-colors ${selected === id ? 'bg-white' : 'bg-transparent hover:bg-white/70'}`}
                            >
                                <span className="w-8 text-[13px] font-semibold text-[#13233f]" style={{ fontFeatureSettings: "'tnum'" }}>{id}</span>
                                <span className="inline-flex items-center gap-1.5 w-[104px] shrink-0 text-[12px] font-medium text-[#1a2b4a]/75">
                                    <Swatch s={teeth[id].status} />
                                    {STATUSES[teeth[id].status]?.label}
                                </span>
                                <span className="text-[12.5px] text-[#1a2b4a]/50 truncate">{teeth[id].note}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="m-0 text-center text-[13px] text-[#1a2b4a]/45">No teeth charted yet. Tap a tooth to add a finding.</p>
                )}
            </div>
        </div>
    );
};

export default DentalRecordPanel;
