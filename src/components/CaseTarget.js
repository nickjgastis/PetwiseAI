import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiFolder, FiSearch, FiX, FiChevronRight, FiPlus } from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import { normalizeType, pendingCaseIds, caseName } from '../utils/cases';
import { TYPE_STYLES, RECORD_TYPES, GRADIENT_TEXT } from './caseStyles';

const dayLabel = (d) => {
    const date = new Date(d);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const CasePicker = ({ onPick, onClose }) => {
    const [cases, setCases] = useState(null);
    const [types, setTypes] = useState({});
    const [pending, setPending] = useState(() => new Set());
    const [search, setSearch] = useState('');

    useEffect(() => {
        let alive = true;
        (async () => {
            const { data } = await supabase
                .from('cases')
                .select('id, pet_name, title, created_at, updated_at')
                .order('updated_at', { ascending: false })
                .limit(100);
            if (!alive) return;
            setCases(data || []);
            const ids = (data || []).map((c) => c.id);
            if (!ids.length) return;
            const { data: notes } = await supabase
                .from('saved_reports')
                .select('case_id, record_type, report_text, form_data')
                .in('case_id', ids);
            const map = {};
            (notes || []).filter((n) => n.report_text).forEach((n) => {
                const t = normalizeType(n.record_type);
                map[n.case_id] = map[n.case_id] || new Set();
                map[n.case_id].add(t);
            });
            if (!alive) return;
            setTypes(map);
            setPending(pendingCaseIds(notes));
        })();
        return () => { alive = false; };
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (cases || []).filter((c) => !q || (c.pet_name || '').toLowerCase().includes(q));
    }, [cases, search]);

    return (
        <>
            <motion.div
                className="fixed inset-0 z-[60] bg-[#13233f]/30 backdrop-blur-[2px]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
            />
            <motion.div
                className="fixed z-[61] inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-auto sm:top-[12vh] sm:left-1/2 sm:w-[480px] sm:-ml-[240px] max-h-[75vh] flex flex-col rounded-[28px] bg-white shadow-[0_40px_80px_-30px_rgba(19,35,63,0.45)] overflow-hidden"
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            >
                <div className="px-6 pt-6 pb-4">
                    <div className="flex items-center justify-between">
                        <h3 className={`text-xl font-bold tracking-tight pb-0.5 ${GRADIENT_TEXT}`}>Add to existing case</h3>
                        <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-[#1a2b4a]/50 hover:bg-[#f6f8fb] border-none bg-transparent cursor-pointer">
                            <FiX />
                        </button>
                    </div>
                    <div className="relative mt-4">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1a2b4a]/40" />
                        <input
                            autoFocus
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by pet name"
                            className="w-full pl-10 pr-4 py-3 rounded-full bg-[#f6f8fb] border border-transparent text-[15px] focus:outline-none focus:border-[#2d5fb8]/30 focus:bg-white transition-colors"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-3">
                    {cases === null ? (
                        <p className="text-sm text-[#1a2b4a]/45 text-center py-10">Loading cases…</p>
                    ) : filtered.length === 0 ? (
                        <p className="text-sm text-[#1a2b4a]/45 text-center py-10">{cases.length ? 'No cases match.' : 'No cases yet.'}</p>
                    ) : (
                        filtered.map((c, i) => (
                            <motion.button
                                key={c.id}
                                type="button"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(i, 10) * 0.025 }}
                                onClick={() => onPick(c)}
                                className="group w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left bg-transparent border-none cursor-pointer hover:bg-[#f6f8fb] transition-colors"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[15px] font-medium text-[#13233f] truncate">{caseName(c, pending)}</span>
                                    <span className="block text-[12px] text-[#1a2b4a]/50">{dayLabel(c.updated_at)}</span>
                                </span>
                                <span className="flex gap-1">
                                    {RECORD_TYPES.filter((t) => types[c.id]?.has(t)).map((t) => (
                                        <span key={t} className={`w-2 h-2 rounded-full ${TYPE_STYLES[t].dot}`} />
                                    ))}
                                </span>
                                <FiChevronRight className="text-[#1a2b4a]/30 group-hover:text-[#2d5fb8] transition-colors" />
                            </motion.button>
                        ))
                    )}
                </div>
            </motion.div>
        </>
    );
};

// Pill above the recorder: start a new case (default) or file this note into an existing one.
const CaseTarget = ({ caseId, onChange, disabled = false, light = false }) => {
    const [open, setOpen] = useState(false);
    const [caseRow, setCaseRow] = useState(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
        let alive = true;
        if (!caseId) {
            setCaseRow(null);
            return undefined;
        }
        if (caseRow?.id === caseId) return undefined;
        supabase.from('cases').select('id, pet_name, created_at').eq('id', caseId).maybeSingle()
            .then(async ({ data }) => {
                if (!alive) return;
                if (!data) return onChangeRef.current(null);
                let pending = false;
                if (!data.pet_name) {
                    const { data: notes } = await supabase.from('saved_reports').select('case_id, report_text, form_data').eq('case_id', caseId);
                    pending = pendingCaseIds(notes).has(caseId);
                }
                if (alive) setCaseRow({ ...data, pending });
            });
        return () => { alive = false; };
    }, [caseId]); // eslint-disable-line react-hooks/exhaustive-deps

    const base = light
        ? 'border border-white/20 bg-white/[0.08] text-white hover:bg-white/[0.14]'
        : 'border border-[#e7ecf3] bg-white text-[#13233f] hover:border-[#2d5fb8]/30 shadow-[0_6px_20px_-12px_rgba(19,35,63,0.25)]';

    return (
        <>
            <AnimatePresence mode="wait" initial={false}>
                {caseId && caseRow ? (
                    <motion.div
                        key="selected"
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        className={`inline-flex items-center gap-2.5 rounded-full h-12 pl-2 pr-2 text-[15px] ${base}`}
                    >
                        <FiFolder className="ml-2 text-[17px] text-[#2d5fb8]" />
                        <span>
                            Adding to <span className="font-semibold">{caseRow.pet_name || (caseRow.pending ? 'this case' : 'Unnamed patient')}</span>
                            <span className="opacity-50"> · {caseRow.pending ? 'Waiting to generate' : dayLabel(caseRow.created_at)}</span>
                        </span>
                        {!disabled && (
                            <>
                                <button type="button" onClick={() => setOpen(true)} className="px-3.5 h-8 rounded-full text-[13.5px] font-medium text-[#2d5fb8] bg-[#e9f6fd] hover:bg-[#d8effb] border-none cursor-pointer">
                                    Change
                                </button>
                                <button type="button" onClick={() => onChange(null)} title="Start a new case instead" className="w-8 h-8 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-black/5 border-none bg-transparent cursor-pointer">
                                    <FiX className="text-[15px]" />
                                </button>
                            </>
                        )}
                    </motion.div>
                ) : (
                    <motion.button
                        key="new"
                        type="button"
                        disabled={disabled}
                        onClick={() => setOpen(true)}
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        className={`inline-flex items-center gap-2.5 rounded-full h-12 px-6 text-[15px] font-semibold cursor-pointer transition-colors disabled:opacity-50 ${base}`}
                    >
                        <FiFolder className="text-[17px] text-[#2d5fb8]" />
                        or add to existing case
                        <FiPlus className="text-[15px] opacity-50" />
                    </motion.button>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {open && (
                    <CasePicker
                        onClose={() => setOpen(false)}
                        onPick={(c) => {
                            setCaseRow(c);
                            onChange(c.id);
                            setOpen(false);
                        }}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default CaseTarget;
