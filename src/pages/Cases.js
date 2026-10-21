import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
    FaArrowLeft, FaPlus, FaPen, FaSearch, FaFolderOpen, FaCheck, FaTimes,
    FaClipboardList, FaFileAlt, FaPhoneAlt, FaCopy, FaExternalLinkAlt
} from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import { useUsage, notifyUsageUpdated, getBrowserTimezone } from '../hooks/useUsage';
import UpgradeModal from '../components/UpgradeModal';
import {
    NOTE_LABELS,
    normalizeType,
    loadNoteIntoQuickSOAP,
    clearQuickSOAPStorage,
    setActiveCaseId
} from '../utils/cases';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

// Same colors as the record-type picker on the New case page.
const TYPES = {
    soap: { label: 'SOAP', icon: FaClipboardList, solid: 'bg-blue-500', soft: 'bg-blue-50 text-blue-700', bar: 'bg-blue-500', ring: 'hover:border-blue-300' },
    summary: { label: 'Summary', icon: FaFileAlt, solid: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', ring: 'hover:border-emerald-300' },
    callback: { label: 'Callback', icon: FaPhoneAlt, solid: 'bg-amber-500', soft: 'bg-amber-50 text-amber-700', bar: 'bg-amber-500', ring: 'hover:border-amber-300' }
};
const typeInfo = (t) => TYPES[normalizeType(t)] || { label: NOTE_LABELS[t] || t, icon: FaFileAlt, solid: 'bg-gray-500', soft: 'bg-gray-50 text-gray-700', bar: 'bg-gray-400', ring: 'hover:border-gray-300' };
const NAME_LABELS = { soap: 'QuickSOAP', summary: 'Summary', callback: 'Callback' };

const FONT = { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };

const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatDateTime = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const plain = (text) => (text || '').replace(/[*#_`>]/g, '');

const TypeBadge = ({ type, count }) => {
    const info = typeInfo(type);
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${info.soft}`}>
            {info.label}
            {count > 1 && <span className="opacity-60">×{count}</span>}
        </span>
    );
};

// A finished note on the New case page is already saved to its case, so starting fresh is safe.
// An in-progress dictation that hasn't been generated yet is left alone.
const goToNewCase = (navigate) => {
    if (localStorage.getItem('quickSOAP_report')) {
        clearQuickSOAPStorage();
        localStorage.removeItem('quickSOAP_selectedTemplate');
        setActiveCaseId(null);
    }
    navigate('/dashboard/quicksoap');
};

const PrimaryButton = ({ onClick, children, disabled }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'linear-gradient(135deg, #4f7fd9 0%, #3369bd 100%)', boxShadow: '0 2px 8px rgba(51,105,189,0.2)' }}
    >
        {children}
    </button>
);

const CaseList = () => {
    const navigate = useNavigate();
    const [cases, setCases] = useState([]);
    const [typesByCase, setTypesByCase] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        let alive = true;
        (async () => {
            const { data, error: caseErr } = await supabase
                .from('cases')
                .select('id, pet_name, title, created_at, updated_at')
                .order('updated_at', { ascending: false });
            if (!alive) return;
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
                if (alive) setTypesByCase(map);
            }
            if (alive) setLoading(false);
        })();
        return () => { alive = false; };
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? cases.filter((c) => (c.pet_name || c.title || '').toLowerCase().includes(q)) : cases;
    }, [cases, search]);

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8" style={FONT}>
            <div className="flex items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Cases</h1>
                    <p className="text-[13px] text-gray-500 mt-0.5">Every note you generate is filed under its case.</p>
                </div>
                <PrimaryButton onClick={() => goToNewCase(navigate)}>
                    <FaPlus className="text-xs" /> New case
                </PrimaryButton>
            </div>

            {cases.length > 0 && (
                <div className="relative mb-4">
                    <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by pet name"
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                </div>
            )}

            {loading ? (
                <p className="text-sm text-gray-400 py-12 text-center">Loading cases…</p>
            ) : error ? (
                <p className="text-sm text-red-500 py-12 text-center">{error}</p>
            ) : cases.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
                    <FaFolderOpen className="mx-auto text-3xl text-gray-300 mb-3" />
                    <p className="text-gray-700 font-semibold">No cases yet</p>
                    <p className="text-[13px] text-gray-500 mt-1 mb-5">Generate a SOAP, summary or callback and it will show up here.</p>
                    <PrimaryButton onClick={() => goToNewCase(navigate)}>
                        <FaPlus className="text-xs" /> New case
                    </PrimaryButton>
                </div>
            ) : (
                <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
                    {filtered.map((c) => {
                        const types = typesByCase[c.id] || {};
                        return (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => navigate(`/dashboard/cases/${c.id}`)}
                                className="w-full text-left px-5 py-4 flex items-center gap-4 bg-white hover:bg-blue-50/40 border-none cursor-pointer transition-colors"
                            >
                                <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center font-bold shrink-0">
                                    {(c.pet_name || '?')[0].toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-gray-900 truncate">{c.pet_name || c.title || 'Unnamed patient'}</p>
                                    <p className="text-[12px] text-gray-400 mt-0.5">{formatDate(c.created_at)}</p>
                                </div>
                                <div className="flex flex-wrap justify-end gap-1.5">
                                    {['soap', 'summary', 'callback'].filter((t) => types[t]).map((t) => <TypeBadge key={t} type={t} count={types[t]} />)}
                                </div>
                            </button>
                        );
                    })}
                    {filtered.length === 0 && <p className="text-sm text-gray-400 py-10 text-center">No cases match.</p>}
                </div>
            )}
        </div>
    );
};

const NoteBox = ({ note, onOpen, isNew }) => {
    const info = typeInfo(note.record_type || note.form_data?.record_type);
    const Icon = info.icon;
    return (
        <motion.button
            type="button"
            layout
            initial={isNew ? { opacity: 0, scale: 0.96 } : false}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => onOpen(note)}
            className={`text-left rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col h-56 cursor-pointer transition-all hover:shadow-md ${info.ring}`}
        >
            <div className={`h-1.5 w-full ${info.bar}`} />
            <div className="p-4 flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-semibold ${info.soft}`}>
                        <Icon className="text-[10px]" /> {info.label}
                    </span>
                    <span className="text-[11px] text-gray-400">{formatDateTime(note.created_at)}</span>
                </div>
                <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line overflow-hidden flex-1" style={{ maskImage: 'linear-gradient(to bottom, black 70%, transparent)' }}>
                    {plain(note.report_text).trim()}
                </p>
            </div>
        </motion.button>
    );
};

const NoteViewer = ({ note, onClose, onOpenInEditor }) => {
    const [copied, setCopied] = useState(false);
    const info = typeInfo(note.record_type || note.form_data?.record_type);
    const Icon = info.icon;
    const text = plain(note.report_text).trim();

    const copy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <>
            <motion.div className="fixed inset-0 bg-black/30 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
            <motion.div
                className="fixed inset-x-4 top-[6vh] bottom-[6vh] sm:inset-x-auto sm:left-1/2 sm:w-[720px] sm:-ml-[360px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
                style={FONT}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            >
                <div className={`h-1.5 w-full ${info.bar}`} />
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-semibold ${info.soft}`}>
                            <Icon className="text-[10px]" /> {info.label}
                        </span>
                        <p className="text-[13px] font-semibold text-gray-900 mt-1.5 truncate">{note.report_name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border-none cursor-pointer">
                            {copied ? <FaCheck className="text-[10px] text-emerald-500" /> : <FaCopy className="text-[10px]" />} {copied ? 'Copied' : 'Copy'}
                        </button>
                        <button type="button" onClick={() => onOpenInEditor(note)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border-none cursor-pointer">
                            <FaExternalLinkAlt className="text-[10px]" /> Edit
                        </button>
                        <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 border-none bg-transparent cursor-pointer"><FaTimes /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <p className="text-[14px] text-gray-800 leading-relaxed whitespace-pre-wrap">{text}</p>
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

const AddNotePanel = ({ caseRow, notes, onCreated, onCancel, onLimit }) => {
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
            setError('This case has no dictation to work from. Add some notes below.');
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
            if (!caseRow.pet_name && res.data.petName) {
                await supabase.from('cases').update({ pet_name: res.data.petName }).eq('id', caseRow.id);
            }
            onCreated(saved, res.data.petName);
        } catch (err) {
            if (err.response?.status === 403 && err.response?.data?.error === 'USAGE_LIMIT_REACHED') {
                onLimit();
            } else {
                setError(err.response?.data?.error || err.message || 'Generation failed. Please try again.');
            }
        } finally {
            setGenerating(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-gray-200 bg-white p-5 mb-6"
        >
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-900">Add a note to this case</p>
                {!generating && (
                    <button type="button" onClick={onCancel} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 border-none bg-transparent cursor-pointer"><FaTimes /></button>
                )}
            </div>

            <div className="bg-gray-100 rounded-xl p-1 inline-flex gap-1 mb-4">
                {Object.entries(TYPES).map(([key, info]) => {
                    const Icon = info.icon;
                    return (
                        <button
                            key={key}
                            type="button"
                            disabled={generating}
                            onClick={() => setType(key)}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 border-none cursor-pointer ${type === key ? `${info.solid} text-white shadow-sm` : 'bg-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-200'}`}
                        >
                            <Icon className="text-xs" /> {info.label}
                        </button>
                    );
                })}
            </div>

            <p className="text-[12px] text-gray-500 mb-2">
                {baseInput ? 'Uses this visit\'s dictation. Add anything else for this note (optional):' : 'No dictation saved on this case. Type the details for this note:'}
            </p>
            <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                disabled={generating}
                rows={3}
                placeholder={type === 'callback' ? 'e.g. Owner reports eating well, recheck in 2 weeks' : 'Extra findings or instructions'}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-y"
            />

            {error && <p className="text-[13px] text-red-500 mt-2">{error}</p>}

            <div className="flex justify-end mt-4">
                <PrimaryButton onClick={generate} disabled={generating}>
                    {generating ? (
                        <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Generating {typeInfo(type).label}…</>
                    ) : (
                        <>Generate {typeInfo(type).label}</>
                    )}
                </PrimaryButton>
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

    useEffect(() => { load(); }, [load]);

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

    if (loading) return <p className="text-sm text-gray-400 py-16 text-center" style={FONT}>Loading case…</p>;

    if (!caseRow) {
        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center" style={FONT}>
                <p className="text-gray-700 font-semibold">Case not found</p>
                <button type="button" onClick={() => navigate('/dashboard/cases')} className="mt-3 text-primary-600 text-sm font-semibold bg-transparent border-none cursor-pointer">
                    Back to cases
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8" style={FONT}>
            <button
                type="button"
                onClick={() => navigate('/dashboard/cases')}
                className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-500 hover:text-gray-800 bg-transparent border-none cursor-pointer p-0"
            >
                <FaArrowLeft className="text-[11px]" /> All cases
            </button>

            <div className="flex items-start justify-between gap-4 mb-6">
                <div className="min-w-0">
                    {editingName ? (
                        <div className="flex items-center gap-2">
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
                                className="text-2xl font-bold text-gray-900 tracking-tight bg-transparent border-b-2 border-primary-400 focus:outline-none"
                            />
                            <FaCheck className="text-primary-500" />
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => { setNameDraft(caseRow.pet_name || ''); setEditingName(true); }}
                            className="group inline-flex items-center gap-2 bg-transparent border-none cursor-pointer p-0 text-left"
                            title="Edit pet name"
                        >
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{caseRow.pet_name || 'Unnamed patient'}</h1>
                            <FaPen className="text-xs text-gray-300 group-hover:text-primary-500" />
                        </button>
                    )}
                    <p className="text-[13px] text-gray-500 mt-1">
                        {formatDate(caseRow.created_at)} · {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                    </p>
                </div>
                {!adding && (
                    <PrimaryButton onClick={() => setAdding(true)}>
                        <FaPlus className="text-xs" /> Add note
                    </PrimaryButton>
                )}
            </div>

            <AnimatePresence>
                {adding && (
                    <AddNotePanel
                        caseRow={caseRow}
                        notes={notes}
                        onCreated={onCreated}
                        onCancel={() => setAdding(false)}
                        onLimit={() => setShowUpgrade(true)}
                    />
                )}
            </AnimatePresence>

            {notes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center">
                    <p className="text-gray-600 font-medium">No notes in this case yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {notes.map((note) => (
                        <NoteBox key={note.id} note={note} onOpen={setOpenNote} isNew={note.id === newNoteId} />
                    ))}
                </div>
            )}

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

const Cases = () => {
    const { caseId } = useParams();
    return caseId ? <CaseDetail caseId={caseId} /> : <CaseList />;
};

export default Cases;
