import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaPlus, FaPen, FaSearch, FaFolderOpen, FaCheck } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import {
    NOTE_LABELS,
    normalizeType,
    loadNoteIntoQuickSOAP,
    startNoteInCase,
    clearQuickSOAPStorage,
    setActiveCaseId
} from '../utils/cases';

const TYPE_STYLES = {
    soap: 'bg-blue-50 text-blue-700 ring-blue-200',
    summary: 'bg-amber-50 text-amber-700 ring-amber-200',
    callback: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dental: 'bg-purple-50 text-purple-700 ring-purple-200'
};

const FONT = { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };

const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatDateTime = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const preview = (text) => (text || '').replace(/[*#_`>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 220);

const TypeBadge = ({ type, count }) => {
    const t = normalizeType(type);
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${TYPE_STYLES[t] || 'bg-gray-50 text-gray-600 ring-gray-200'}`}>
            {NOTE_LABELS[t] || t}
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

const PrimaryButton = ({ onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold border-none cursor-pointer"
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8" style={FONT}>
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
                                    {Object.entries(types).map(([t, n]) => <TypeBadge key={t} type={t} count={n} />)}
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

const CaseDetail = ({ caseId }) => {
    const navigate = useNavigate();
    const [caseRow, setCaseRow] = useState(null);
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState('');

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

    const openNote = (note) => {
        loadNoteIntoQuickSOAP(note);
        navigate('/dashboard/quicksoap');
    };

    const addNote = () => {
        startNoteInCase(caseId, notes[notes.length - 1]);
        navigate('/dashboard/quicksoap');
    };

    if (loading) return <p className="text-sm text-gray-400 py-16 text-center" style={FONT}>Loading case…</p>;

    if (!caseRow) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center" style={FONT}>
                <p className="text-gray-700 font-semibold">Case not found</p>
                <button type="button" onClick={() => navigate('/dashboard/cases')} className="mt-3 text-primary-600 text-sm font-semibold bg-transparent border-none cursor-pointer">
                    Back to cases
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8" style={FONT}>
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
                <PrimaryButton onClick={addNote}>
                    <FaPlus className="text-xs" /> Add note
                </PrimaryButton>
            </div>

            {notes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center">
                    <p className="text-gray-600 font-medium">No notes in this case yet.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notes.map((note) => (
                        <button
                            key={note.id}
                            type="button"
                            onClick={() => openNote(note)}
                            className="w-full text-left rounded-2xl border border-gray-200 bg-white p-5 hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
                        >
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <TypeBadge type={note.record_type || note.form_data?.record_type} />
                                    <span className="text-sm font-semibold text-gray-900 truncate">{note.report_name}</span>
                                </div>
                                <span className="text-[12px] text-gray-400 shrink-0">{formatDateTime(note.created_at)}</span>
                            </div>
                            <p className="text-[13px] text-gray-500 leading-relaxed line-clamp-2">{preview(note.report_text)}</p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const Cases = () => {
    const { caseId } = useParams();
    return caseId ? <CaseDetail caseId={caseId} /> : <CaseList />;
};

export default Cases;
