import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiArrowLeft, FiCheck } from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import { typeStyle, GRADIENT_TEXT } from './caseStyles';

const EASE = [0.2, 0.7, 0.2, 1];
const shortDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Top of the editor: which case you're in and which note you're editing.
export const CaseBar = ({ caseId, recordType, onBack, refreshKey }) => {
    const [info, setInfo] = useState(null);

    useEffect(() => {
        let alive = true;
        if (!caseId) {
            setInfo(null);
            return undefined;
        }
        Promise.all([
            supabase.from('cases').select('id, pet_name, created_at').eq('id', caseId).maybeSingle(),
            supabase.from('saved_reports').select('id, report_text').eq('case_id', caseId)
        ]).then(([{ data: c }, { data: notes }]) => {
            if (!alive || !c) return;
            setInfo({ ...c, count: (notes || []).filter((n) => n.report_text).length });
        });
        return () => { alive = false; };
    }, [caseId, refreshKey]);

    const type = typeStyle(recordType);
    const Icon = type.icon;

    return (
        <AnimatePresence initial={false}>
            {info && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="mb-5 rounded-[22px] border border-[#e7ecf3] bg-gradient-to-r from-white to-[#f6f8fb] pl-2 pr-4 py-2.5 flex items-center gap-3"
                    style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
                >
                    <button
                        type="button"
                        onClick={onBack}
                        title="Back to case"
                        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[#2d5fb8] bg-white border border-[#e7ecf3] hover:bg-[#e9f6fd] cursor-pointer transition-colors"
                    >
                        <FiArrowLeft />
                    </button>
                    <span className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-semibold text-white bg-gradient-to-br from-[#5b8fe0] to-[#2d5fb8]">
                        {(info.pet_name || '?')[0].toUpperCase()}
                    </span>
                    <button type="button" onClick={onBack} className="min-w-0 flex-1 text-left bg-transparent border-none p-0 cursor-pointer">
                        <span className={`block text-[17px] font-bold tracking-tight truncate ${GRADIENT_TEXT}`}>
                            {info.pet_name || 'Unnamed patient'}
                        </span>
                        <span className="block text-[12.5px] text-[#1a2b4a]/55">
                            Case from {shortDate(info.created_at)} · {info.count} {info.count === 1 ? 'note' : 'notes'}
                        </span>
                    </button>
                    <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold ${type.soft}`}>
                        <Icon className="text-[11px]" /> Editing {type.label}
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// Shown between the loader and the editor: tells you a case was made (or added to).
export const CaseCreatedOverlay = ({ announcement }) => (
    <AnimatePresence>
        {announcement && (
            <motion.div
                className="fixed inset-0 z-[80] flex items-center justify-center bg-white/75 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
            >
                <motion.div
                    className="flex flex-col items-center text-center px-6"
                    initial={{ opacity: 0, y: 14, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, ease: EASE }}
                >
                    <motion.span
                        className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl shadow-[0_14px_34px_-12px_rgba(45,95,184,0.8)]"
                        style={{ background: 'linear-gradient(160deg,#3f7ad6 0%,#2d5fb8 45%,#2350a3 100%)' }}
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.08 }}
                    >
                        <FiCheck />
                    </motion.span>
                    <p className={`mt-5 text-[2rem] leading-[1.15] pb-1 font-bold tracking-[-0.03em] ${GRADIENT_TEXT}`}>
                        {announcement.kind === 'added' ? 'Added to case' : 'Case created'}
                    </p>
                    <p className="text-[17px] font-medium text-[#13233f]">{announcement.title}</p>
                    <p className="mt-3 text-[14px] text-[#1a2b4a]/55">Opening your {announcement.typeLabel} to edit…</p>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);
