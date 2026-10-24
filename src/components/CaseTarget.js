import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiFolder, FiSearch, FiX, FiChevronRight, FiPlus } from 'react-icons/fi';
import { PiPawPrintFill } from 'react-icons/pi';
import { supabase } from '../supabaseClient';
import usePagedList from '../hooks/usePagedList';
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
    const [search, setSearch] = useState('');
    const autoFocus = useMemo(() => window.matchMedia('(pointer: fine)').matches, []);
    const { items, notes, loading, loadingMore, hasMore, loadMore, searching } = usePagedList('cases', { q: search.trim() });
    const cases = loading && !items.length ? null : items;

    const { types, pending } = useMemo(() => {
        const map = {};
        notes.filter((n) => n.report_text).forEach((n) => {
            const t = normalizeType(n.record_type);
            map[n.case_id] = map[n.case_id] || new Set();
            map[n.case_id].add(t);
        });
        return { types: map, pending: pendingCaseIds(notes) };
    }, [notes]);

    // Portalled to body: the mobile shell pads itself by the keyboard height, and the sheet must not move with it.
    return createPortal(
        <>
            <motion.div
                className="fixed inset-0 z-[60] bg-[#13233f]/30 backdrop-blur-[2px]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
            />
            <motion.div
                className="fixed z-[61] inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-auto sm:top-[12vh] sm:left-1/2 sm:w-[480px] sm:-ml-[240px] h-[75vh] sm:h-auto sm:max-h-[75vh] flex flex-col rounded-[28px] bg-white shadow-[0_40px_80px_-30px_rgba(19,35,63,0.45)] overflow-hidden"
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
                            autoFocus={autoFocus}
                            value={search}
                            enterKeyHint="search"
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by patient"
                            className="w-full pl-10 pr-4 py-3 rounded-full bg-[#f6f8fb] border border-transparent text-[15px] focus:outline-none focus:border-[#2d5fb8]/30 focus:bg-white transition-colors"
                        />
                    </div>
                </div>
                <div className={`flex-1 overflow-y-auto px-3 pb-3 transition-opacity ${searching ? 'opacity-60' : ''}`}>
                    {cases === null ? (
                        <p className="text-sm text-[#1a2b4a]/45 text-center py-10">Loading cases…</p>
                    ) : cases.length === 0 ? (
                        <p className="text-sm text-[#1a2b4a]/45 text-center py-10">{search.trim() ? 'No cases match.' : 'No cases yet.'}</p>
                    ) : (
                        cases.map((c, i) => (
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
                    {hasMore && cases?.length > 0 && (
                        <button
                            type="button"
                            onClick={loadMore}
                            disabled={loadingMore}
                            className="w-full mt-1 py-3 rounded-2xl text-[14px] font-medium text-[#2d5fb8] bg-transparent border-none cursor-pointer hover:bg-[#f6f8fb] disabled:opacity-60"
                        >
                            {loadingMore ? 'Loading' : 'Load more'}
                        </button>
                    )}
                </div>
            </motion.div>
        </>,
        document.body
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
                        className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto max-w-full min-w-0 overflow-hidden rounded-full h-12 sm:h-16 pl-3.5 sm:pl-5 pr-1.5 sm:pr-2.5 text-[14px] sm:text-[20px] text-white bg-gradient-to-r from-[#3f7ad6] via-[#2d5fb8] to-[#1e4a94] shadow-[0_14px_34px_-14px_rgba(45,95,184,0.75)]"
                    >
                        <PiPawPrintFill className="shrink-0 text-[18px] sm:text-[22px]" />
                        <span className="min-w-0 flex-1 sm:flex-none truncate text-left">
                            Adding to <span className="font-semibold">{caseRow.pet_name || (caseRow.pending ? 'this case' : 'Unnamed patient')}</span>
                            <span className={`${caseRow.pending ? '' : 'hidden sm:inline'} text-white/70`}> · {caseRow.pending ? 'Waiting to generate' : dayLabel(caseRow.created_at)}</span>
                        </span>
                        {!disabled && (
                            <>
                                <button type="button" onClick={() => setOpen(true)} className="shrink-0 px-3 sm:px-4 h-8 sm:h-10 rounded-full text-[13px] sm:text-[14px] font-semibold text-[#2d5fb8] bg-white hover:bg-[#e9f6fd] border-none cursor-pointer">
                                    Change
                                </button>
                                <button type="button" onClick={() => onChange(null)} title="Start a new case instead" className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 border-none bg-transparent cursor-pointer">
                                    <FiX className="text-[15px] sm:text-[16px]" />
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
                        add to existing case
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
