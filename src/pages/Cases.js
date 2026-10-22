import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import { FiArrowLeft, FiPlus, FiEdit2, FiSearch, FiFolder, FiX, FiMic, FiChevronRight, FiPause, FiPlay, FiSquare } from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import { useUsage, notifyUsageUpdated, getBrowserTimezone } from '../hooks/useUsage';
import UpgradeModal from '../components/UpgradeModal';
import { useDictation } from '../hooks/useDictation';
import WaveBars, { RecordingStatus } from '../components/WaveBars';
import { TYPE_STYLES, typeStyle, GRADIENT_TEXT } from '../components/caseStyles';
import {
    normalizeType,
    loadNoteIntoQuickSOAP,
    createCase,
    requestNewCase,
    isUnviewedMobileNote,
    markMobileNotesViewed
} from '../utils/cases';
import { CaseCreatedOverlay } from '../components/CaseBar';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const NAME_LABELS = { soap: 'QuickSOAP', summary: 'Summary', callback: 'Callback' };
const TYPE_BLURBS = {
    soap: 'The full medical record for the visit.',
    summary: 'A clear write-up for the client.',
    callback: 'Notes for a follow-up call.'
};
const FONT = { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };
const EASE = [0.2, 0.7, 0.2, 1];

// Entrance lives on a wrapper and the hover lift on the card, so the two never fight over transform.
const FadeIn = ({ delay = 0, children, className = '' }) => (
    <motion.div className={className} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE, delay }}>
        {children}
    </motion.div>
);
const LIFT = {
    whileHover: { y: -4 },
    whileTap: { scale: 0.985 },
    transition: { type: 'spring', stiffness: 420, damping: 30 }
};

const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatDateTime = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const plain = (text) => (text || '').replace(/[*#_`>]/g, '');

const dayBucket = (d) => {
    const date = new Date(d);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((start - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000);
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return 'This week';
    return 'Earlier';
};

const PillButton = ({ onClick, children, disabled, variant = 'primary', className = '' }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold border cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variant === 'primary'
            ? 'bg-[#2d5fb8] hover:bg-[#2350a3] text-white border-transparent shadow-[0_10px_30px_-12px_rgba(45,95,184,0.7)] hover:-translate-y-px'
            : 'bg-white hover:bg-[#f6f8fb] text-[#13233f] border-[#e7ecf3]'
            } ${className}`}
    >
        {children}
    </button>
);

const TypeChip = ({ type, count }) => {
    const info = typeStyle(type);
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold ${info.soft}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
            {info.label}
            {count > 1 && <span className="opacity-60">×{count}</span>}
        </span>
    );
};

const PageHeader = ({ title, subtitle, action }) => (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
            <h1 className={`text-[2.1rem] sm:text-[2.6rem] leading-[1.15] pb-1 font-bold tracking-[-0.03em] ${GRADIENT_TEXT}`}>{title}</h1>
            {subtitle && <p className="text-[15px] sm:text-[16px] text-[#1a2b4a]/60 mt-1">{subtitle}</p>}
        </div>
        {action}
    </div>
);

const NewCaseDialog = ({ onClose, onCreated }) => {
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        setError('');
        const id = await createCase(name.trim() || null);
        if (!id) {
            setSaving(false);
            setError('Couldn’t create the case. Please try again.');
            return;
        }
        onCreated(id);
    };

    return (
        <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-[#13233f]/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => !saving && onClose()}
            style={FONT}
        >
            <motion.form
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.26, ease: EASE }}
                className="w-full max-w-[420px] bg-white rounded-[28px] p-6 sm:p-7 shadow-[0_40px_80px_-30px_rgba(19,35,63,0.45)]"
            >
                <div className="flex items-start justify-between gap-4">
                    <h3 className={`m-0 pb-0.5 text-[24px] font-bold tracking-[-0.02em] ${GRADIENT_TEXT}`}>New case</h3>
                    <button type="button" onClick={onClose} className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-[#1a2b4a]/50 hover:bg-[#f6f8fb] border-none bg-transparent cursor-pointer">
                        <FiX />
                    </button>
                </div>
                <p className="mt-1 mb-5 text-[14px] text-[#1a2b4a]/55">Name it after the patient. You can change it later.</p>
                <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Bella Smith"
                    className="w-full px-4 py-3 rounded-2xl bg-[#f6f8fb] border border-transparent text-[#13233f] placeholder:text-[#1a2b4a]/35 focus:outline-none focus:border-[#2d5fb8]/30 focus:bg-white transition-colors"
                />
                {error && <p className="mt-2 mb-0 text-[13px] text-red-500">{error}</p>}
                <div className="flex justify-end gap-2 mt-6">
                    <PillButton variant="secondary" onClick={onClose} disabled={saving}>Cancel</PillButton>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white bg-[#2d5fb8] hover:bg-[#2350a3] border-none cursor-pointer shadow-[0_10px_30px_-12px_rgba(45,95,184,0.7)] transition-colors disabled:opacity-60"
                    >
                        {saving && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                        Create case
                    </button>
                </div>
            </motion.form>
        </motion.div>
    );
};

const CaseList = ({ mobile = false }) => {
    const navigate = useNavigate();
    const [naming, setNaming] = useState(false);
    const [cases, setCases] = useState([]);
    const [typesByCase, setTypesByCase] = useState({});
    const [unviewed, setUnviewed] = useState(() => new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    const load = useCallback(async () => {
        const { data, error: caseErr } = await supabase
            .from('cases')
            .select('id, pet_name, title, created_at, updated_at')
            .order('updated_at', { ascending: false });
        if (caseErr) {
            setError('Could not load cases.');
            setLoading(false);
            return;
        }
        setCases(data || []);
        const ids = (data || []).map((c) => c.id);
        if (ids.length) {
            const { data: notes } = await supabase
                .from('saved_reports')
                .select('id, case_id, record_type, report_text, form_data, created_at')
                .in('case_id', ids);
            const map = {};
            const fresh = new Set();
            (notes || []).filter((n) => n.report_text).forEach((n) => {
                const t = normalizeType(n.record_type);
                map[n.case_id] = map[n.case_id] || {};
                map[n.case_id][t] = (map[n.case_id][t] || 0) + 1;
                if (isUnviewedMobileNote(n)) fresh.add(n.case_id);
            });
            setTypesByCase(map);
            setUnviewed(fresh);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
        localStorage.removeItem('hasNewMobileSOAP');
        localStorage.removeItem('mobileSOAPCount');
        window.dispatchEvent(new CustomEvent('clearMobileSOAPNotification'));
        window.addEventListener('newMobileSOAPGenerated', load);
        return () => window.removeEventListener('newMobileSOAPGenerated', load);
    }, [load]);

    const groups = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = q ? cases.filter((c) => (c.pet_name || c.title || '').toLowerCase().includes(q)) : cases;
        const out = [];
        list.forEach((c) => {
            const label = dayBucket(c.updated_at);
            const g = out.find((x) => x.label === label);
            if (g) g.items.push(c);
            else out.push({ label, items: [c] });
        });
        return out;
    }, [cases, search]);

    return (
        <div style={FONT}>
            <div className={`max-w-5xl mx-auto px-4 sm:px-8 ${mobile ? 'pt-6 pb-8' : 'pt-8 sm:pt-12 pb-16'}`}>
                {mobile ? (
                    <div className="mb-5">
                        <h1 className={`m-0 text-[2rem] leading-[1.15] pb-1 font-bold tracking-[-0.03em] ${GRADIENT_TEXT}`}>Cases</h1>
                        <p className="mt-1 mb-0 text-[14.5px] text-[#1a2b4a]/55">Tap a case to dictate into it.</p>
                    </div>
                ) : (
                    <PageHeader
                        title="Cases"
                        subtitle="Every patient’s SOAPs, summaries and callbacks, kept together."
                        action={(
                            <PillButton onClick={() => setNaming(true)}>
                                <FiPlus /> New case
                            </PillButton>
                        )}
                    />
                )}

                {cases.length > 0 && (
                    <div className={`relative max-w-md ${mobile ? 'mb-6' : 'mb-8'}`}>
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1a2b4a]/40" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Find a patient"
                            className="w-full pl-11 pr-4 py-3 bg-white border border-[#e7ecf3] rounded-full text-[15px] shadow-[0_6px_20px_-14px_rgba(19,35,63,0.25)] focus:outline-none focus:border-[#2d5fb8]/30 transition-colors"
                        />
                    </div>
                )}

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[0, 1, 2].map((i) => <div key={i} className="h-[132px] rounded-[24px] bg-white border border-[#e7ecf3] animate-pulse" />)}
                    </div>
                ) : error ? (
                    <p className="text-sm text-red-500 py-12 text-center">{error}</p>
                ) : cases.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
                        className="rounded-[28px] border border-[#e7ecf3] bg-white py-16 px-6 text-center"
                    >
                        <span className="mx-auto w-14 h-14 rounded-2xl bg-[#e9f6fd] text-[#3468bd] flex items-center justify-center text-2xl mb-4"><FiFolder /></span>
                        <p className="text-lg font-semibold text-[#13233f]">No cases yet</p>
                        <p className={`text-[14px] text-[#1a2b4a]/60 mt-1 ${mobile ? 'mb-0' : 'mb-6'}`}>Record your first visit and it will show up here.</p>
                        {!mobile && <PillButton onClick={() => setNaming(true)}><FiPlus /> Start a new case</PillButton>}
                    </motion.div>
                ) : groups.length === 0 ? (
                    <p className="text-[15px] text-[#1a2b4a]/50 py-12 text-center">No patients match “{search}”.</p>
                ) : (
                    groups.map((g, gi) => (
                        <section key={g.label} className={mobile ? 'mb-7' : 'mb-10'}>
                            <h2 className="text-[14px] font-semibold text-[#1a2b4a]/50 mb-3 ml-1">{g.label}</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {g.items.map((c, i) => {
                                    const types = typesByCase[c.id] || {};
                                    const total = Object.values(types).reduce((a, b) => a + b, 0);
                                    const isNew = !mobile && unviewed.has(c.id);
                                    return (
                                        <FadeIn key={c.id} delay={Math.min(gi * 3 + i, 10) * 0.03}>
                                        <motion.button
                                            type="button"
                                            {...LIFT}
                                            onClick={() => (mobile ? requestNewCase(navigate, c.id) : navigate(`/dashboard/cases/${c.id}`))}
                                            className={`group w-full text-left border bg-white cursor-pointer transition-[box-shadow,border-color] duration-300 hover:shadow-[0_24px_48px_-24px_rgba(19,35,63,0.25)] ${mobile ? 'rounded-[20px] p-4' : 'rounded-[24px] p-5'} ${isNew ? 'border-[#2d5fb8]/35 shadow-[0_14px_34px_-22px_rgba(45,95,184,0.55)]' : 'border-[#e7ecf3] hover:border-[#d6e3f7]'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="flex items-center gap-2 m-0 text-[16px] font-semibold text-[#13233f]">
                                                        {isNew && <span title="New from your phone" className="shrink-0 w-2.5 h-2.5 rounded-full bg-[#2d5fb8] ring-4 ring-[#2d5fb8]/15" />}
                                                        <span className="truncate">{c.pet_name || c.title || 'Unnamed patient'}</span>
                                                    </p>
                                                    <p className="text-[12.5px] text-[#1a2b4a]/50 mt-0.5">
                                                        {formatDateTime(c.updated_at)}
                                                        {total > 0 && ` · ${total} ${total === 1 ? 'record' : 'records'}`}
                                                        {isNew && <span className="font-medium text-[#2d5fb8]"> · New from phone</span>}
                                                    </p>
                                                </div>
                                                <FiChevronRight className="text-[#1a2b4a]/25 group-hover:text-[#2d5fb8] group-hover:translate-x-0.5 transition-all" />
                                            </div>
                                            {total > 0 && (
                                                <div className={`flex flex-wrap gap-1.5 ${mobile ? 'mt-3' : 'mt-4'}`}>
                                                    {['soap', 'summary', 'callback'].filter((t) => types[t]).map((t) => <TypeChip key={t} type={t} count={types[t]} />)}
                                                </div>
                                            )}
                                        </motion.button>
                                        </FadeIn>
                                    );
                                })}
                            </div>
                        </section>
                    ))
                )}
            </div>
            <AnimatePresence>
                {naming && (
                    <NewCaseDialog
                        key="new-case"
                        onClose={() => setNaming(false)}
                        onCreated={(id) => navigate(`/dashboard/cases/${id}`)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

// Cached cards are tied to the record text length so an edited record gets a fresh card.
const cardSource = (note) => (note.report_text || '').length;

// Auto-generated names look like "Bella - QuickSOAP - 10/21/2026, 9:00 PM"; anything else the vet typed.
const customTitle = (note) => {
    const name = (note.report_name || '').trim();
    if (!name || /\b(QuickSOAP|SOAP|Summary|Callback)( Mobile| Draft)? - \d/.test(name)) return null;
    return name;
};

const NoteBox = ({ note, onOpen, isNew, previewPending }) => {
    const card = note.form_data?.card;
    const info = typeStyle(note.record_type || note.form_data?.record_type);
    const Icon = info.icon;
    const title = customTitle(note) || card?.title || `${info.label} record`;
    return (
        <motion.button
            type="button"
            {...LIFT}
            initial={isNew ? { scale: 0.94 } : false}
            animate={{ scale: 1 }}
            onClick={() => onOpen(note)}
            className={`group w-full text-left rounded-[24px] border border-[#e7ecf3] bg-white overflow-hidden flex flex-col min-h-[180px] cursor-pointer transition-[box-shadow,border-color] duration-300 hover:shadow-[0_24px_48px_-24px_rgba(19,35,63,0.25)] ${info.hover} ${isNew ? 'ring-2 ring-[#5cccf0]/50' : ''}`}
        >
            <div className={`h-1 w-full bg-gradient-to-r ${info.bar}`} />
            <div className="p-5 flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11.5px] font-semibold ${info.soft}`}>
                        <Icon className="text-[10.5px]" /> {info.label}
                    </span>
                    <span className="text-[12px] text-[#1a2b4a]/45">{formatDateTime(note.created_at)}</span>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                    {card || customTitle(note) || !previewPending ? (
                        <motion.div key="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="flex-1 flex flex-col">
                            <p className="mt-3 mb-0 text-[16.5px] font-semibold leading-snug tracking-[-0.01em] text-[#13233f] line-clamp-2">{title}</p>
                            {card?.summary && (
                                <p className="mt-1.5 mb-0 text-[14px] leading-relaxed text-[#1a2b4a]/65">{card.summary}</p>
                            )}
                            {card?.points?.length ? (
                                <ul className="list-none m-0 mt-3.5 pt-3.5 border-t border-[#eef2f7] pl-0 space-y-1.5">
                                    {card.points.map((p) => (
                                        <li key={p.label} className="flex gap-2 text-[13.5px] leading-snug text-[#1a2b4a]/75">
                                            <span className={`mt-[7px] w-1.5 h-1.5 shrink-0 rounded-full ${info.dot}`} />
                                            <span>
                                                <span className="font-semibold text-[#13233f]">{p.label}</span> {p.text}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : previewPending ? (
                                <div className="mt-3 space-y-2">
                                    <div className="h-3 rounded-full bg-[#eef2f7] animate-pulse w-11/12" />
                                    <div className="h-3 rounded-full bg-[#eef2f7] animate-pulse w-2/3" />
                                </div>
                            ) : (
                                <p className="mt-2 mb-0 text-[13.5px] text-[#1a2b4a]/65 leading-relaxed line-clamp-2">{plain(note.report_text).trim()}</p>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div key="loading" exit={{ opacity: 0 }} className="flex-1 mt-3.5 space-y-2.5">
                            <div className="h-4 rounded-full bg-[#eef2f7] animate-pulse w-3/5" />
                            <div className="h-3 rounded-full bg-[#eef2f7] animate-pulse w-11/12" />
                            <div className="h-3 rounded-full bg-[#eef2f7] animate-pulse w-2/3" />
                        </motion.div>
                    )}
                </AnimatePresence>

                <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-[#2d5fb8] opacity-0 group-hover:opacity-100 transition-opacity">
                    <FiEdit2 className="text-[11px]" /> Open and edit
                </span>
            </div>
        </motion.button>
    );
};

// Builds the generation input from the visit's existing dictation.
const visitInput = (notes) => {
    for (let i = notes.length - 1; i >= 0; i--) {
        const fd = notes[i].form_data || {};
        if (fd.lastInput && fd.lastInput.trim()) return fd.lastInput.trim();
        const dictated = (fd.dictations || []).map((d) => d.fullText || '').filter((t) => t.trim()).join('\n\n');
        const combined = [dictated, fd.input || ''].filter((t) => t.trim()).join('\n\n');
        if (combined.trim()) return combined.trim();
    }
    return '';
};

const SWAP = { initial: { opacity: 0, scale: 0.97 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.97 }, transition: { duration: 0.18, ease: EASE } };

const AddNotePanel = ({ caseRow, notes, initialType, onCreated, onCancel, onLimit, onBusy }) => {
    const { user } = useAuth0();
    const usage = useUsage();
    const dictation = useDictation();
    const [type, setType] = useState(() => initialType || (notes.some((n) => normalizeType(n.record_type) === 'soap') ? 'callback' : 'soap'));
    const [text, setText] = useState('');
    const baseInput = useMemo(() => visitInput(notes), [notes]);
    const [includeEarlier, setIncludeEarlier] = useState(false);
    const textRef = useRef(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const busy = generating || dictation.status !== 'idle';

    useEffect(() => { onBusy(busy); }, [busy, onBusy]);
    useEffect(() => () => onBusy(false), [onBusy]);
    useEffect(() => {
        const el = textRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }, [text, dictation.status]);

    const startDictation = useCallback(async () => {
        if (dictation.status !== 'idle') return;
        if (!usage.isUnlimited && usage.soap.remaining <= 0) {
            onLimit();
            return;
        }
        setError('');
        try {
            await dictation.start();
        } catch {
            setError('Couldn’t reach the microphone. Check your browser’s mic permission.');
        }
    }, [dictation, usage, onLimit]);

    const stopDictation = async () => {
        try {
            const t = await dictation.stop();
            if (t) setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${t}` : t));
        } catch (err) {
            setError(err.message || 'Transcription failed. Please try again.');
        }
    };

    const useEarlier = includeEarlier && !!baseInput;

    const generate = async () => {
        const fresh = text.trim();
        const input = [useEarlier ? baseInput : '', fresh].filter(Boolean).join('\n\n');
        if (!input) {
            setError('Dictate or type something first.');
            return;
        }
        if (!usage.isUnlimited && usage.soap.remaining <= 0) {
            onLimit();
            return;
        }
        setGenerating(true);
        setError('');
        try {
            const res = await axios.post(`${API_URL}/api/generate-soap`, {
                input,
                user: user ? { sub: user.sub } : null,
                recordType: type,
                tz: getBrowserTimezone()
            });
            notifyUsageUpdated();
            const report = res.data.report;
            if (!report) throw new Error('No report generated');

            const petName = caseRow.pet_name || res.data.petName || null;
            const reportName = `${petName ? `${petName} - ` : ''}${NAME_LABELS[type]} - ${new Date().toLocaleString()}`;
            const source = notes[notes.length - 1]?.form_data || {};
            const dictations = [
                ...(useEarlier ? source.dictations || [] : []),
                ...(fresh ? [{ id: Date.now(), fullText: fresh, summary: fresh.slice(0, 100) + (fresh.length > 100 ? '...' : ''), expanded: false }] : [])
            ];
            const { data: saved, error: saveError } = await supabase
                .from('saved_reports')
                .insert([{
                    report_name: reportName,
                    report_text: report,
                    record_type: type,
                    case_id: caseRow.id,
                    form_data: {
                        record_type: type,
                        dictations,
                        input: useEarlier && !(source.dictations || []).length ? source.input || '' : '',
                        lastInput: input,
                        report,
                        petName,
                        auto_generated: true,
                        generated_at: new Date().toISOString()
                    }
                }])
                .select()
                .single();
            if (saveError || !saved) throw new Error('Could not save the record');
            await supabase.from('cases').update({ pet_name: petName }).eq('id', caseRow.id);
            onCreated(saved, res.data.petName);
        } catch (err) {
            if (err.response?.status === 403 && err.response?.data?.error === 'USAGE_LIMIT_REACHED') {
                onLimit();
            } else {
                setError(err.response?.data?.error || err.message || 'Something went wrong. Please try again.');
            }
        } finally {
            setGenerating(false);
        }
    };

    return (
        <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.38, ease: EASE }, opacity: { duration: 0.25 } }}
            className="overflow-hidden"
        >
            <div className="rounded-[24px] border border-[#e7ecf3] bg-white p-3 sm:p-4 mb-6 shadow-[0_18px_40px_-30px_rgba(19,35,63,0.3)]">
                <div className="flex items-center gap-2 mb-3">
                    <div className="bg-[#f6f8fb] rounded-full p-0.5 inline-flex gap-0.5 max-w-full overflow-x-auto">
                        {Object.entries(TYPE_STYLES).map(([key, info]) => {
                            const Icon = info.icon;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    disabled={generating}
                                    onClick={() => setType(key)}
                                    className={`relative px-3 py-1.5 text-[13px] font-medium rounded-full whitespace-nowrap flex items-center gap-1.5 border-none cursor-pointer bg-transparent transition-colors ${type === key ? 'text-white' : 'text-[#1a2b4a]/60 hover:text-[#13233f]'}`}
                                >
                                    {type === key && (
                                        <motion.span layoutId="addnote-type" className={`absolute inset-0 rounded-full ${info.solid} shadow-sm`} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                                    )}
                                    <span className="relative flex items-center gap-1.5"><Icon className="text-[11px]" /> {info.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    {!busy && (
                        <button type="button" onClick={onCancel} title="Close" className="ml-auto w-8 h-8 rounded-full flex items-center justify-center text-[#1a2b4a]/45 hover:bg-[#f6f8fb] border-none bg-transparent cursor-pointer">
                            <FiX />
                        </button>
                    )}
                </div>

                <div className="rounded-[20px] bg-[#f6f8fb] border border-transparent focus-within:bg-white focus-within:border-[#2d5fb8]/30 transition-colors p-1.5 min-h-[52px] flex items-center">
                    <AnimatePresence mode="wait" initial={false}>
                        {dictation.status === 'idle' ? (
                            <motion.div key="idle" {...SWAP} className="flex items-start gap-2 w-full">
                                <motion.button
                                    type="button"
                                    onClick={startDictation}
                                    disabled={generating}
                                    whileHover={{ scale: 1.06 }}
                                    whileTap={{ scale: 0.94 }}
                                    title="Dictate"
                                    className="w-10 h-10 shrink-0 rounded-full border-none cursor-pointer text-white flex items-center justify-center shadow-[0_8px_20px_-10px_rgba(45,95,184,0.8)] disabled:opacity-50"
                                    style={{ background: 'linear-gradient(160deg,#3f7ad6 0%,#2d5fb8 45%,#2350a3 100%)' }}
                                >
                                    <FiMic />
                                </motion.button>
                                <textarea
                                    ref={textRef}
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    disabled={generating}
                                    rows={1}
                                    placeholder="Tap the mic to dictate, or type here"
                                    className="flex-1 min-w-0 py-2 pr-2 bg-transparent border-none text-[15px] leading-relaxed text-[#13233f] resize-none focus:outline-none placeholder:text-[#1a2b4a]/40"
                                    style={{ maxHeight: 180, overflow: 'auto' }}
                                />
                            </motion.div>
                        ) : dictation.status === 'transcribing' ? (
                            <motion.div key="tx" {...SWAP} className="flex items-center gap-2.5 px-2 h-10 text-[14px] font-medium text-[#2d5fb8]">
                                <span className="w-4 h-4 rounded-full border-2 border-[#2d5fb8]/25 border-t-[#2d5fb8] animate-spin" /> Transcribing…
                            </motion.div>
                        ) : (
                            <motion.div key="rec" {...SWAP} className="flex items-center gap-3 w-full pl-2">
                                <RecordingStatus live={dictation.status === 'recording'} seconds={dictation.seconds} className="shrink-0" />
                                <WaveBars levels={dictation.levels} live={dictation.status === 'recording'} height={32} barWidth={3} gap={2} className="flex-1 min-w-0 overflow-hidden" />
                                <button type="button" onClick={dictation.status === 'recording' ? dictation.pause : dictation.resume} title={dictation.status === 'recording' ? 'Pause' : 'Resume'} className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[#2d5fb8] bg-white border border-[#e7ecf3] hover:bg-[#e9f6fd] cursor-pointer transition-colors">
                                    {dictation.status === 'recording' ? <FiPause className="text-[13px]" /> : <FiPlay className="text-[13px]" />}
                                </button>
                                <button type="button" onClick={stopDictation} className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold text-white bg-[#2d5fb8] hover:bg-[#2350a3] border-none cursor-pointer transition-colors">
                                    <FiSquare className="text-[10px]" /> Done
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <AnimatePresence>
                    {error && (
                        <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-[13px] text-red-500 mt-2 mb-0 overflow-hidden">
                            {error}
                        </motion.p>
                    )}
                </AnimatePresence>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                    {baseInput ? (
                        <label className="flex items-center gap-2 text-[13px] text-[#1a2b4a]/65 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={includeEarlier}
                                onChange={(e) => setIncludeEarlier(e.target.checked)}
                                className="w-4 h-4 accent-[#2d5fb8]"
                            />
                            Include earlier dictation from this case
                        </label>
                    ) : <span />}
                    <PillButton onClick={generate} disabled={busy} className="!px-4 !py-2 !text-[13.5px]">
                        {generating ? (
                            <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Writing {typeStyle(type).label}…</>
                        ) : (
                            <>Create {typeStyle(type).label}</>
                        )}
                    </PillButton>
                </div>
            </div>
        </motion.div>
    );
};

const CaseDetail = ({ caseId }) => {
    const navigate = useNavigate();
    const { user } = useAuth0();
    const usage = useUsage();
    const [caseRow, setCaseRow] = useState(null);
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState('');
    const [adding, setAdding] = useState(false);
    const [panelBusy, setPanelBusy] = useState(false);
    const [addType, setAddType] = useState(null);
    const [freshNoteIds, setFreshNoteIds] = useState(() => new Set());
    const [announcement, setAnnouncement] = useState(null);
    const [showUpgrade, setShowUpgrade] = useState(false);

    const load = useCallback(async () => {
        const [{ data: c }, { data: n }] = await Promise.all([
            supabase.from('cases').select('id, pet_name, title, created_at, updated_at').eq('id', caseId).maybeSingle(),
            supabase
                .from('saved_reports')
                .select('id, report_name, report_text, form_data, record_type, created_at, updated_at, case_id')
                .eq('case_id', caseId)
                .order('created_at', { ascending: true })
        ]);
        setCaseRow(c || null);
        setNotes((n || []).filter((r) => r.report_text));
        const fromPhone = (n || []).filter((r) => isUnviewedMobileNote(r)).map((r) => r.id);
        if (fromPhone.length) setFreshNoteIds((prev) => new Set([...prev, ...fromPhone]));
        markMobileNotesViewed(n || []);
        setLoading(false);
    }, [caseId]);

    useEffect(() => {
        load();
        window.addEventListener('newMobileSOAPGenerated', load);
        return () => window.removeEventListener('newMobileSOAPGenerated', load);
    }, [load]);

    const [pendingPreviews, setPendingPreviews] = useState(() => new Set());
    const requestedPreviews = useRef(new Set());
    useEffect(() => {
        const missing = notes
            .filter((n) => (n.form_data?.card?.src !== cardSource(n) || !n.form_data?.card?.summary) && !requestedPreviews.current.has(n.id))
            .slice(0, 12);
        if (!missing.length) return;
        missing.forEach((n) => requestedPreviews.current.add(n.id));
        const ids = missing.map((n) => n.id);
        setPendingPreviews((prev) => new Set([...prev, ...ids]));
        axios.post(`${API_URL}/api/note-previews`, {
            notes: missing.map((n) => ({ id: n.id, type: n.record_type, text: plain(n.report_text) }))
        }).then(({ data }) => {
            const previews = data?.previews || {};
            const withCard = (n) => ({ ...(n.form_data || {}), card: { ...previews[n.id], src: cardSource(n) } });
            setNotes((prev) => prev.map((n) => (previews[n.id] ? { ...n, form_data: withCard(n) } : n)));
            missing.filter((n) => previews[n.id]).forEach((n) => {
                supabase.from('saved_reports').update({ form_data: withCard(n) }).eq('id', n.id).then(() => {});
            });
        }).catch(() => {}).finally(() => {
            setPendingPreviews((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                return next;
            });
        });
    }, [notes]);

    const saveName = async () => {
        const name = nameDraft.trim();
        setEditingName(false);
        if (!caseRow || name === (caseRow.pet_name || '')) return;
        setCaseRow({ ...caseRow, pet_name: name || null });
        await supabase.from('cases').update({ pet_name: name || null }).eq('id', caseRow.id);
    };

    const openInEditor = (note) => {
        loadNoteIntoQuickSOAP(note);
        navigate('/dashboard/quicksoap');
    };

    const onCreated = (saved, extractedPetName) => {
        const type = normalizeType(saved.record_type);
        const label = TYPE_STYLES[type]?.label || 'Record';
        setAnnouncement({
            kind: 'added',
            title: `${caseRow.pet_name || extractedPetName || label} · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            typeLabel: label === 'SOAP' ? 'SOAP' : label.toLowerCase()
        });
        setTimeout(() => openInEditor(saved), 1400);
    };

    const startNote = (type) => {
        setAddType(type);
        setAdding(true);
    };

    const counts = notes.reduce((acc, n) => {
        const t = normalizeType(n.record_type);
        acc[t] = (acc[t] || 0) + 1;
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-6 sm:pt-10" style={FONT}>
                <div className="h-5 w-24 mb-5" />
                <div className="h-[148px] rounded-[28px] bg-white border border-[#e7ecf3] animate-pulse mb-8" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[0, 1, 2].map((i) => <div key={i} className="h-60 rounded-[24px] bg-white border border-[#e7ecf3] animate-pulse" />)}
                </div>
            </div>
        );
    }

    if (!caseRow) {
        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-8 py-20 text-center" style={FONT}>
                <p className="text-lg font-semibold text-[#13233f]">We couldn’t find that case</p>
                <PillButton variant="secondary" className="mt-5" onClick={() => navigate('/dashboard/cases')}>
                    <FiArrowLeft /> Back to cases
                </PillButton>
            </div>
        );
    }

    return (
        <div style={FONT}>
            <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-6 sm:pt-10 pb-16">
                <button
                    type="button"
                    onClick={() => navigate('/dashboard/cases')}
                    className="group mb-5 inline-flex items-center gap-1.5 text-[14px] font-medium text-[#1a2b4a]/55 hover:text-[#2d5fb8] bg-transparent border-none cursor-pointer p-0 transition-colors"
                >
                    <FiArrowLeft className="group-hover:-translate-x-0.5 transition-transform" /> All cases
                </button>

                <FadeIn className="relative overflow-hidden rounded-[28px] border border-[#e7ecf3] bg-white p-6 sm:p-8 mb-8">
                    <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(92,204,240,0.18) 0%, rgba(92,204,240,0) 70%)' }} />
                    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="min-w-0">
                                {editingName ? (
                                    <input
                                        value={nameDraft}
                                        onChange={(e) => setNameDraft(e.target.value)}
                                        onBlur={saveName}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveName();
                                            if (e.key === 'Escape') setEditingName(false);
                                        }}
                                        placeholder="Pet name"
                                        autoFocus
                                        className="block p-0 pb-1 m-0 !text-[1.9rem] sm:!text-[2.2rem] leading-[1.15] font-bold tracking-[-0.03em] text-[#2d5fb8] bg-transparent border-0 border-b-2 border-[#2d5fb8]/40 focus:outline-none w-full max-w-md"
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => { setNameDraft(caseRow.pet_name || ''); setEditingName(true); }}
                                        className="group inline-flex items-center gap-2 bg-transparent border-none cursor-pointer p-0 text-left max-w-full"
                                        title="Rename"
                                    >
                                        <h1 className={`text-[1.9rem] sm:text-[2.2rem] leading-[1.15] pb-1 font-bold tracking-[-0.03em] truncate ${GRADIENT_TEXT}`}>
                                            {caseRow.pet_name || 'Unnamed patient'}
                                        </h1>
                                        <FiEdit2 className="text-[14px] shrink-0 text-[#1a2b4a]/25 group-hover:text-[#2d5fb8] transition-colors" />
                                    </button>
                                )}
                                <p className="text-[14px] text-[#1a2b4a]/55">
                                    Started {formatDate(caseRow.created_at)} · {notes.length} {notes.length === 1 ? 'record' : 'records'}
                                </p>
                                {notes.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                                        {['soap', 'summary', 'callback'].filter((t) => counts[t]).map((t) => <TypeChip key={t} type={t} count={counts[t]} />)}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                            <PillButton
                                onClick={() => {
                                    setAddType(null);
                                    setAdding((v) => !v);
                                }}
                                disabled={panelBusy}
                            >
                                <motion.span animate={{ rotate: adding ? 45 : 0 }} transition={{ duration: 0.25, ease: EASE }} className="flex"><FiPlus /></motion.span>
                                {adding ? 'Close' : 'Add a record'}
                            </PillButton>
                        </div>
                    </div>
                </FadeIn>

                <AnimatePresence initial={false}>
                    {adding && (
                        <AddNotePanel
                            key={`add-${addType || 'default'}`}
                            caseRow={caseRow}
                            notes={notes}
                            initialType={addType}
                            onCreated={onCreated}
                            onCancel={() => setAdding(false)}
                            onLimit={() => setShowUpgrade(true)}
                            onBusy={setPanelBusy}
                        />
                    )}
                </AnimatePresence>

                {notes.length === 0 ? (
                    !adding && (
                        <FadeIn delay={0.05}>
                            <p className="text-[14px] font-semibold text-[#1a2b4a]/50 mb-3 ml-1">Start this case with</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {['soap', 'summary', 'callback'].map((t) => {
                                    const s = TYPE_STYLES[t];
                                    const Icon = s.icon;
                                    return (
                                        <motion.button
                                            key={t}
                                            type="button"
                                            {...LIFT}
                                            onClick={() => startNote(t)}
                                            className={`group text-left rounded-[24px] border border-[#e7ecf3] bg-white p-5 cursor-pointer transition-[box-shadow,border-color] duration-300 hover:shadow-[0_24px_48px_-24px_rgba(19,35,63,0.25)] ${s.hover}`}
                                        >
                                            <span className={`w-10 h-10 rounded-2xl flex items-center justify-center text-[17px] ${s.soft}`}>
                                                <Icon />
                                            </span>
                                            <span className="block mt-4 text-[16px] font-semibold text-[#13233f]">{s.label}</span>
                                            <span className="block mt-1 text-[13.5px] text-[#1a2b4a]/55">{TYPE_BLURBS[t]}</span>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </FadeIn>
                    )
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {notes.map((note, i) => (
                            <FadeIn key={note.id} delay={0.05 + Math.min(i, 8) * 0.035}>
                                <NoteBox note={note} onOpen={openInEditor} isNew={freshNoteIds.has(note.id)} previewPending={pendingPreviews.has(note.id)} />
                            </FadeIn>
                        ))}
                    </div>
                )}
            </div>

            {showUpgrade && (
                <UpgradeModal
                    user={user}
                    feature="soap"
                    reason="limit"
                    resetsAt={usage.resetsAt}
                    onClose={() => setShowUpgrade(false)}
                />
            )}
            <CaseCreatedOverlay announcement={announcement} />
        </div>
    );
};

const Cases = ({ caseId: caseIdProp, mobile = false }) => {
    const params = useParams();
    const caseId = mobile ? null : params.caseId || caseIdProp;
    return (
        <motion.div
            key={caseId || 'list'}
            className="min-h-full bg-gradient-to-b from-[#f6f8fb] to-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
        >
            {caseId ? <CaseDetail caseId={caseId} /> : <CaseList mobile={mobile} />}
        </motion.div>
    );
};

export default Cases;
