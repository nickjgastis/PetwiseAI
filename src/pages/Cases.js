import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import { FiArrowLeft, FiPlus, FiEdit2, FiSearch, FiFolder, FiCheck, FiX, FiCopy, FiExternalLink, FiMic, FiChevronRight } from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import { useUsage, notifyUsageUpdated, getBrowserTimezone } from '../hooks/useUsage';
import UpgradeModal from '../components/UpgradeModal';
import { TYPE_STYLES, typeStyle, GRADIENT_TEXT } from '../components/caseStyles';
import {
    normalizeType,
    loadNoteIntoQuickSOAP,
    clearQuickSOAPStorage,
    setActiveCaseId
} from '../utils/cases';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const NAME_LABELS = { soap: 'QuickSOAP', summary: 'Summary', callback: 'Callback' };
const FONT = { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };
const EASE = [0.2, 0.7, 0.2, 1];

const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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

// Leaves an in-progress dictation alone; a finished note is already saved to its case.
const goToNewCase = (navigate, caseId = null) => {
    if (localStorage.getItem('quickSOAP_report')) {
        clearQuickSOAPStorage();
        localStorage.removeItem('quickSOAP_selectedTemplate');
    }
    setActiveCaseId(caseId);
    navigate('/dashboard/quicksoap');
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

const Avatar = ({ name, size = 'md' }) => (
    <span className={`${size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-11 h-11 text-base'} rounded-full shrink-0 flex items-center justify-center font-semibold text-white bg-gradient-to-br from-[#5b8fe0] to-[#2d5fb8] shadow-[0_8px_20px_-10px_rgba(45,95,184,0.8)]`}>
        {(name || '?')[0].toUpperCase()}
    </span>
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

const CaseList = () => {
    const navigate = useNavigate();
    const [cases, setCases] = useState([]);
    const [typesByCase, setTypesByCase] = useState({});
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
                .select('id, case_id, record_type, report_text')
                .in('case_id', ids);
            const map = {};
            (notes || []).filter((n) => n.report_text).forEach((n) => {
                const t = normalizeType(n.record_type);
                map[n.case_id] = map[n.case_id] || {};
                map[n.case_id][t] = (map[n.case_id][t] || 0) + 1;
            });
            setTypesByCase(map);
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
        <div className="min-h-full bg-gradient-to-b from-[#f6f8fb] to-white" style={FONT}>
            <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 pb-16">
                <PageHeader
                    title="Cases"
                    subtitle="Every patient’s SOAPs, summaries and callbacks, kept together."
                    action={(
                        <PillButton onClick={() => goToNewCase(navigate)}>
                            <FiPlus /> New case
                        </PillButton>
                    )}
                />

                {cases.length > 0 && (
                    <div className="relative mb-8 max-w-md">
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
                        <p className="text-[14px] text-[#1a2b4a]/60 mt-1 mb-6">Record your first visit and it will show up here.</p>
                        <PillButton onClick={() => goToNewCase(navigate)}><FiPlus /> Start a new case</PillButton>
                    </motion.div>
                ) : groups.length === 0 ? (
                    <p className="text-[15px] text-[#1a2b4a]/50 py-12 text-center">No patients match “{search}”.</p>
                ) : (
                    groups.map((g, gi) => (
                        <section key={g.label} className="mb-10">
                            <h2 className="text-[14px] font-semibold text-[#1a2b4a]/50 mb-3 ml-1">{g.label}</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {g.items.map((c, i) => {
                                    const types = typesByCase[c.id] || {};
                                    const total = Object.values(types).reduce((a, b) => a + b, 0);
                                    return (
                                        <motion.button
                                            key={c.id}
                                            type="button"
                                            initial={{ opacity: 0, y: 14 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.45, ease: EASE, delay: Math.min(gi * 3 + i, 12) * 0.035 }}
                                            onClick={() => navigate(`/dashboard/cases/${c.id}`)}
                                            className="group text-left rounded-[24px] border border-[#e7ecf3] bg-white p-5 cursor-pointer transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-[#d6e3f7] hover:shadow-[0_24px_48px_-24px_rgba(19,35,63,0.25)]"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar name={c.pet_name} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[16px] font-semibold text-[#13233f] truncate">{c.pet_name || c.title || 'Unnamed patient'}</p>
                                                    <p className="text-[12.5px] text-[#1a2b4a]/50 mt-0.5">
                                                        {g.label === 'Today' || g.label === 'Yesterday' ? formatTime(c.updated_at) : formatDate(c.updated_at)}
                                                        {total > 0 && ` · ${total} ${total === 1 ? 'note' : 'notes'}`}
                                                    </p>
                                                </div>
                                                <FiChevronRight className="text-[#1a2b4a]/25 group-hover:text-[#2d5fb8] group-hover:translate-x-0.5 transition-all" />
                                            </div>
                                            {total > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-4">
                                                    {['soap', 'summary', 'callback'].filter((t) => types[t]).map((t) => <TypeChip key={t} type={t} count={types[t]} />)}
                                                </div>
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </section>
                    ))
                )}
            </div>
        </div>
    );
};

const NoteBox = ({ note, onOpen, isNew }) => {
    const info = typeStyle(note.record_type || note.form_data?.record_type);
    const Icon = info.icon;
    return (
        <motion.button
            type="button"
            layout
            initial={isNew ? { opacity: 0, scale: 0.94, y: 10 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            onClick={() => onOpen(note)}
            className={`group text-left rounded-[24px] border border-[#e7ecf3] bg-white overflow-hidden flex flex-col h-60 cursor-pointer transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgba(19,35,63,0.25)] ${info.hover}`}
        >
            <div className={`h-1.5 w-full bg-gradient-to-r ${info.bar}`} />
            <div className="p-5 flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${info.soft}`}>
                        <Icon className="text-[11px]" /> {info.label}
                    </span>
                    <span className="text-[12px] text-[#1a2b4a]/45">{formatDateTime(note.created_at)}</span>
                </div>
                <p className="text-[13.5px] text-[#1a2b4a]/70 leading-relaxed whitespace-pre-line overflow-hidden flex-1" style={{ maskImage: 'linear-gradient(to bottom, black 65%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black 65%, transparent)' }}>
                    {plain(note.report_text).trim()}
                </p>
            </div>
        </motion.button>
    );
};

const NoteViewer = ({ note, onClose, onOpenInEditor }) => {
    const [copied, setCopied] = useState(false);
    const info = typeStyle(note.record_type || note.form_data?.record_type);
    const Icon = info.icon;
    const text = plain(note.report_text).trim();

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const copy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <>
            <motion.div
                className="fixed inset-0 bg-[#13233f]/30 backdrop-blur-[3px] z-[60]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
            />
            <motion.div
                className="fixed inset-x-3 top-[5vh] bottom-[5vh] sm:inset-x-auto sm:left-1/2 sm:w-[740px] sm:-ml-[370px] bg-white rounded-[28px] shadow-[0_40px_80px_-30px_rgba(19,35,63,0.45)] z-[61] flex flex-col overflow-hidden"
                style={FONT}
                initial={{ opacity: 0, y: 28, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 28, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            >
                <div className={`h-1.5 w-full bg-gradient-to-r ${info.bar}`} />
                <div className="px-6 py-5 border-b border-[#eef2f7] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${info.soft}`}>
                            <Icon className="text-[11px]" /> {info.label}
                        </span>
                        <p className="text-[14px] font-semibold text-[#13233f] mt-2 truncate">{note.report_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <PillButton variant="secondary" onClick={copy} className="!px-4 !py-2 !text-[13px]">
                            {copied ? <FiCheck className="text-emerald-500" /> : <FiCopy />} {copied ? 'Copied' : 'Copy'}
                        </PillButton>
                        <PillButton variant="secondary" onClick={() => onOpenInEditor(note)} className="!px-4 !py-2 !text-[13px]">
                            <FiExternalLink /> Edit
                        </PillButton>
                        <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center text-[#1a2b4a]/50 hover:bg-[#f6f8fb] border-none bg-transparent cursor-pointer">
                            <FiX />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-7 py-6">
                    <p className="text-[15px] text-[#1a2b4a]/85 leading-relaxed whitespace-pre-wrap">{text}</p>
                </div>
            </motion.div>
        </>
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

const AddNotePanel = ({ caseRow, notes, onCreated, onCancel, onLimit, onRecord }) => {
    const { user } = useAuth0();
    const usage = useUsage();
    const [type, setType] = useState(() => (notes.some((n) => normalizeType(n.record_type) === 'soap') ? 'callback' : 'soap'));
    const [extra, setExtra] = useState('');
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const baseInput = useMemo(() => visitInput(notes), [notes]);

    const generate = async () => {
        const input = [baseInput, extra.trim()].filter(Boolean).join('\n\n');
        if (!input) {
            setError('There’s nothing to write from yet. Add a few details below, or record into this case.');
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
            const { data: saved, error: saveError } = await supabase
                .from('saved_reports')
                .insert([{
                    report_name: reportName,
                    report_text: report,
                    record_type: type,
                    case_id: caseRow.id,
                    form_data: {
                        record_type: type,
                        dictations: source.dictations || [],
                        input: [source.input || '', extra.trim()].filter(Boolean).join('\n\n'),
                        lastInput: input,
                        report,
                        petName,
                        auto_generated: true,
                        generated_at: new Date().toISOString()
                    }
                }])
                .select()
                .single();
            if (saveError || !saved) throw new Error('Could not save the note');
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
            transition={{ duration: 0.4, ease: EASE }}
            className="overflow-hidden"
        >
            <div className="rounded-[28px] border border-[#e7ecf3] bg-white p-6 sm:p-7 mb-8 shadow-[0_24px_48px_-32px_rgba(19,35,63,0.3)]">
                <div className="flex items-start justify-between gap-3 mb-5">
                    <div>
                        <p className={`text-[1.35rem] font-bold tracking-tight pb-0.5 ${GRADIENT_TEXT}`}>Add a note</p>
                        <p className="text-[14px] text-[#1a2b4a]/60">
                            {baseInput ? 'We’ll write it from this visit’s dictation.' : 'Type a few details and we’ll write it up.'}
                        </p>
                    </div>
                    {!generating && (
                        <button type="button" onClick={onCancel} className="w-9 h-9 rounded-full flex items-center justify-center text-[#1a2b4a]/50 hover:bg-[#f6f8fb] border-none bg-transparent cursor-pointer">
                            <FiX />
                        </button>
                    )}
                </div>

                <div className="bg-[#f6f8fb] rounded-full p-1 inline-flex gap-1 mb-5">
                    {Object.entries(TYPE_STYLES).map(([key, info]) => {
                        const Icon = info.icon;
                        return (
                            <button
                                key={key}
                                type="button"
                                disabled={generating}
                                onClick={() => setType(key)}
                                className={`relative px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap flex items-center gap-1.5 border-none cursor-pointer bg-transparent transition-colors ${type === key ? 'text-white' : 'text-[#1a2b4a]/60 hover:text-[#13233f]'}`}
                            >
                                {type === key && (
                                    <motion.span layoutId="addnote-type" className={`absolute inset-0 rounded-full ${info.solid} shadow-sm`} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                                )}
                                <span className="relative flex items-center gap-1.5"><Icon className="text-xs" /> {info.label}</span>
                            </button>
                        );
                    })}
                </div>

                <textarea
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    disabled={generating}
                    rows={3}
                    placeholder={type === 'callback' ? 'Anything to add? e.g. owner says she’s eating well, recheck in 2 weeks' : 'Anything to add? (optional)'}
                    className="w-full px-4 py-3 bg-[#f6f8fb] border border-transparent rounded-2xl text-[15px] focus:outline-none focus:bg-white focus:border-[#2d5fb8]/30 transition-colors resize-y"
                />

                <AnimatePresence>
                    {error && (
                        <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-[13px] text-red-500 mt-2">
                            {error}
                        </motion.p>
                    )}
                </AnimatePresence>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 mt-5">
                    <button
                        type="button"
                        onClick={onRecord}
                        disabled={generating}
                        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#2d5fb8] hover:text-[#2350a3] bg-transparent border-none cursor-pointer p-0 disabled:opacity-50"
                    >
                        <FiMic /> Record something new instead
                    </button>
                    <PillButton onClick={generate} disabled={generating}>
                        {generating ? (
                            <><span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Writing {typeStyle(type).label}…</>
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
    const [openNote, setOpenNote] = useState(null);
    const [newNoteId, setNewNoteId] = useState(null);
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
        setLoading(false);
    }, [caseId]);

    useEffect(() => {
        load();
        window.addEventListener('newMobileSOAPGenerated', load);
        return () => window.removeEventListener('newMobileSOAPGenerated', load);
    }, [load]);

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
        setNotes((prev) => [...prev, saved]);
        if (!caseRow.pet_name && extractedPetName) setCaseRow({ ...caseRow, pet_name: extractedPetName });
        setNewNoteId(saved.id);
        setAdding(false);
        setOpenNote(saved);
    };

    const counts = notes.reduce((acc, n) => {
        const t = normalizeType(n.record_type);
        acc[t] = (acc[t] || 0) + 1;
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="min-h-full bg-gradient-to-b from-[#f6f8fb] to-white" style={FONT}>
                <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-12">
                    <div className="h-36 rounded-[28px] bg-white border border-[#e7ecf3] animate-pulse" />
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
        <div className="min-h-full bg-gradient-to-b from-[#f6f8fb] to-white" style={FONT}>
            <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-6 sm:pt-10 pb-16">
                <button
                    type="button"
                    onClick={() => navigate('/dashboard/cases')}
                    className="group mb-5 inline-flex items-center gap-1.5 text-[14px] font-medium text-[#1a2b4a]/55 hover:text-[#2d5fb8] bg-transparent border-none cursor-pointer p-0 transition-colors"
                >
                    <FiArrowLeft className="group-hover:-translate-x-0.5 transition-transform" /> All cases
                </button>

                <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
                    className="relative overflow-hidden rounded-[28px] border border-[#e7ecf3] bg-white p-6 sm:p-8 mb-8"
                >
                    <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(92,204,240,0.18) 0%, rgba(92,204,240,0) 70%)' }} />
                    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                        <div className="flex items-center gap-4 min-w-0">
                            <Avatar name={caseRow.pet_name} size="lg" />
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
                                        className="text-[1.9rem] font-bold tracking-[-0.03em] text-[#13233f] bg-transparent border-0 border-b-2 border-[#2d5fb8]/40 focus:outline-none w-full max-w-xs"
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => { setNameDraft(caseRow.pet_name || ''); setEditingName(true); }}
                                        className="group inline-flex items-center gap-2 bg-transparent border-none cursor-pointer p-0 text-left"
                                        title="Rename"
                                    >
                                        <h1 className={`text-[1.9rem] sm:text-[2.2rem] leading-[1.15] pb-1 font-bold tracking-[-0.03em] truncate ${GRADIENT_TEXT}`}>
                                            {caseRow.pet_name || 'Unnamed patient'}
                                        </h1>
                                        <FiEdit2 className="text-[14px] text-[#1a2b4a]/25 group-hover:text-[#2d5fb8] transition-colors" />
                                    </button>
                                )}
                                <p className="text-[14px] text-[#1a2b4a]/55">
                                    Started {formatDate(caseRow.created_at)} · {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                                </p>
                                {notes.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                                        {['soap', 'summary', 'callback'].filter((t) => counts[t]).map((t) => <TypeChip key={t} type={t} count={counts[t]} />)}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                            <PillButton variant="secondary" onClick={() => goToNewCase(navigate, caseRow.id)}>
                                <FiMic /> Record
                            </PillButton>
                            <PillButton onClick={() => setAdding((v) => !v)}>
                                <motion.span animate={{ rotate: adding ? 45 : 0 }} transition={{ duration: 0.25 }} className="flex"><FiPlus /></motion.span>
                                {adding ? 'Close' : 'Add a note'}
                            </PillButton>
                        </div>
                    </div>
                </motion.div>

                <AnimatePresence initial={false}>
                    {adding && (
                        <AddNotePanel
                            caseRow={caseRow}
                            notes={notes}
                            onCreated={onCreated}
                            onCancel={() => setAdding(false)}
                            onLimit={() => setShowUpgrade(true)}
                            onRecord={() => goToNewCase(navigate, caseRow.id)}
                        />
                    )}
                </AnimatePresence>

                {notes.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-[#d6e3f7] bg-white/60 py-14 text-center">
                        <p className="text-[15px] text-[#1a2b4a]/60">No notes in this case yet.</p>
                    </div>
                ) : (
                    <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {notes.map((note) => (
                            <NoteBox key={note.id} note={note} onOpen={setOpenNote} isNew={note.id === newNoteId} />
                        ))}
                    </motion.div>
                )}
            </div>

            <AnimatePresence>
                {openNote && <NoteViewer note={openNote} onClose={() => setOpenNote(null)} onOpenInEditor={openInEditor} />}
            </AnimatePresence>

            {showUpgrade && (
                <UpgradeModal
                    user={user}
                    feature="soap"
                    reason="limit"
                    resetsAt={usage.resetsAt}
                    onClose={() => setShowUpgrade(false)}
                />
            )}
        </div>
    );
};

const Cases = ({ caseId: caseIdProp }) => {
    const params = useParams();
    const caseId = params.caseId || caseIdProp;
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={caseId || 'list'}
                className="min-h-full"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: EASE }}
            >
                {caseId ? <CaseDetail caseId={caseId} /> : <CaseList />}
            </motion.div>
        </AnimatePresence>
    );
};

export default Cases;
