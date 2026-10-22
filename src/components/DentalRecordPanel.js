import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PiTooth } from 'react-icons/pi';
import { FiX } from 'react-icons/fi';
import DentalChart from './DentalChart';
import { STATUSES, STATUS_ORDER, toothLabel } from '../dental/teeth';

const FONT = { fontFamily: 'var(--font-sans)' };

// Chart side of a dental record. `dental` is { species, teeth: { [id]: { status, note } } }.
const DentalRecordPanel = ({ dental, onChange }) => {
    const [selected, setSelected] = useState(null);
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

    return (
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 lg:sticky lg:top-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)', ...FONT }}>
            <div className="px-5 py-2 flex items-center gap-2.5 bg-gradient-to-r from-violet-500 to-violet-600">
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

            <div className="px-4 pt-5 pb-4">
                <DentalChart species={species} teeth={teeth} selected={selected} onToothClick={(id) => setSelected((cur) => (cur === id ? null : id))} />
            </div>

            <AnimatePresence initial={false} mode="wait">
                {selected ? (
                    <motion.div
                        key={selected}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="mx-4 mb-4 rounded-[18px] bg-[#f6f8fb] p-4"
                    >
                        <div className="flex items-start gap-3 mb-3">
                            <span className="text-[20px] font-semibold text-[#13233f] leading-none" style={{ fontFeatureSettings: "'tnum'" }}>{selected}</span>
                            <span className="text-[13px] text-[#1a2b4a]/60 leading-snug pt-0.5">{toothLabel(species, selected)}</span>
                            <button type="button" onClick={() => setSelected(null)} className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-[#1a2b4a]/45 hover:text-[#13233f] hover:bg-white border-none bg-transparent cursor-pointer" title="Close">
                                <FiX className="text-[14px]" />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {STATUS_ORDER.map((s) => {
                                const on = (current?.status || 'normal') === s;
                                return (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setTooth(selected, { status: s })}
                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium cursor-pointer transition-all ${STATUSES[s].chip} ${on ? 'ring-2 ring-[#2d5fb8] ring-offset-1' : 'opacity-80 hover:opacity-100'}`}
                                    >
                                        <span
                                            className="w-2.5 h-2.5 rounded-[3px]"
                                            style={{ background: STATUSES[s].fill === 'none' ? 'transparent' : STATUSES[s].fill, border: `1.5px ${STATUSES[s].dashed ? 'dashed' : 'solid'} ${STATUSES[s].stroke}` }}
                                        />
                                        {STATUSES[s].label}
                                    </button>
                                );
                            })}
                        </div>
                        <input
                            value={current?.note || ''}
                            onChange={(e) => setTooth(selected, { note: e.target.value })}
                            placeholder="Note, e.g. PD4, mobility 2"
                            className="mt-3 w-full px-3.5 py-2 rounded-xl bg-white border border-[#e3e9f2] text-[13.5px] text-[#13233f] focus:outline-none focus:border-[#2d5fb8]/40"
                            style={FONT}
                        />
                    </motion.div>
                ) : (
                    <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="px-5 pb-4">
                        {charted.length ? (
                            <div className="divide-y divide-[#eef2f7] rounded-[18px] bg-[#f6f8fb] px-4">
                                {charted.map((id) => (
                                    <button key={id} type="button" onClick={() => setSelected(id)} className="w-full flex items-center gap-3 py-2.5 bg-transparent border-none cursor-pointer text-left">
                                        <span className="w-9 text-[13px] font-semibold text-[#13233f]" style={{ fontFeatureSettings: "'tnum'" }}>{id}</span>
                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUSES[teeth[id].status]?.chip || ''}`}>{STATUSES[teeth[id].status]?.label}</span>
                                        <span className="text-[12.5px] text-[#1a2b4a]/55 truncate">{teeth[id].note}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="m-0 text-center text-[13px] text-[#1a2b4a]/45">No teeth charted. Tap a tooth to add a finding.</p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DentalRecordPanel;
