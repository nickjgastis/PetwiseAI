import { supabase } from '../supabaseClient';

export const CASE_KEY = 'quickSOAP_caseId';
export const NOTE_TYPE_KEY = 'currentQuickSOAPReportType';
export const SAVED_SNAPSHOT_KEY = 'quickSOAP_savedReport';
export const NEW_CASE_EVENT = 'petwise:new-case';
const NEW_CASE_REQUEST_KEY = 'quickSOAP_newCaseRequest';

// Stored rather than passed so QuickSOAP sees it whether it is already mounted or mounts after navigate.
export const requestNewCase = (navigate, caseId = null) => {
    localStorage.setItem(NEW_CASE_REQUEST_KEY, JSON.stringify({ caseId }));
    window.dispatchEvent(new Event(NEW_CASE_EVENT));
    navigate('/dashboard/quicksoap');
};

const VIEWED_MOBILE_KEY = 'viewedMobileSOAPReports';
const UNVIEWED_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const readViewedMobile = () => {
    try {
        return JSON.parse(localStorage.getItem(VIEWED_MOBILE_KEY) || '[]');
    } catch {
        return [];
    }
};

// Older mobile notes predate view tracking, so only recent ones can count as unviewed.
export const isUnviewedMobileNote = (note, viewed = readViewedMobile()) => {
    const fd = note.form_data || {};
    if (!fd.from_mobile || !note.report_text) return false;
    const at = new Date(fd.generated_at || note.created_at || 0).getTime();
    return Date.now() - at < UNVIEWED_WINDOW_MS && !viewed.includes(note.id);
};

export const markMobileNotesViewed = (notes) => {
    const viewed = readViewedMobile();
    const fresh = notes.filter((n) => n.form_data?.from_mobile && !viewed.includes(n.id)).map((n) => n.id);
    if (fresh.length) localStorage.setItem(VIEWED_MOBILE_KEY, JSON.stringify([...viewed, ...fresh]));
};

export const takeNewCaseRequest = () => {
    const raw = localStorage.getItem(NEW_CASE_REQUEST_KEY);
    if (!raw) return null;
    localStorage.removeItem(NEW_CASE_REQUEST_KEY);
    try {
        return JSON.parse(raw);
    } catch {
        return { caseId: null };
    }
};

export const NOTE_LABELS = { soap: 'SOAP', summary: 'Summary', callback: 'Callback', dental: 'Dental' };

export const normalizeType = (t) => (!t || t === 'quicksoap' ? 'soap' : t);

export const getActiveCaseId = () => localStorage.getItem(CASE_KEY) || null;

export const setActiveCaseId = (id) => {
    if (id) localStorage.setItem(CASE_KEY, id);
    else localStorage.removeItem(CASE_KEY);
};

const QUICKSOAP_KEYS = [
    'quickSOAP_dictations',
    'quickSOAP_input',
    'quickSOAP_report',
    'quickSOAP_lastInput',
    'currentQuickSOAPReportId',
    'quickSOAP_reportName',
    'quickSOAP_recordType',
    NOTE_TYPE_KEY,
    SAVED_SNAPSHOT_KEY
];

export const clearQuickSOAPStorage = () => QUICKSOAP_KEYS.forEach((k) => localStorage.removeItem(k));

// Standalone case for notes generated in the background (mobile drafts), so they never
// land in whatever case is open on screen. Returns null on failure.
export async function createCase(petName) {
    try {
        const { data, error } = await supabase
            .from('cases')
            .insert([{ pet_name: petName || null }])
            .select('id')
            .single();
        return error || !data ? null : data.id;
    } catch (err) {
        console.error('[cases] createCase failed:', err);
        return null;
    }
}

// Returns the active case id, creating the case on first use. Never throws: a note must
// still save if cases are unavailable (e.g. before the migration has run).
export async function ensureCase(petName) {
    try {
        const existingId = getActiveCaseId();
        if (existingId) {
            const { data: existing } = await supabase
                .from('cases')
                .select('id, pet_name')
                .eq('id', existingId)
                .maybeSingle();
            if (existing) {
                // Never overwrite a name the vet already has (they may have corrected it).
                await supabase
                    .from('cases')
                    .update({ pet_name: existing.pet_name || petName || null })
                    .eq('id', existing.id);
                return existing.id;
            }
        }
        const { data: created, error } = await supabase
            .from('cases')
            .insert([{ pet_name: petName || null }])
            .select('id')
            .single();
        if (error || !created) return null;
        setActiveCaseId(created.id);
        return created.id;
    } catch (err) {
        console.error('[cases] ensureCase failed:', err);
        return null;
    }
}

// Load a saved note into QuickSOAP's storage so the page opens on it.
export function loadNoteIntoQuickSOAP(report) {
    clearQuickSOAPStorage();
    localStorage.setItem('quickSOAP_recordType', normalizeType(report.record_type || report.form_data?.record_type));

    const formData = report.form_data || {};
    if (report.report_text && formData.from_mobile) {
        localStorage.setItem('quickSOAP_report', report.report_text);
        if (formData.dictations) localStorage.setItem('quickSOAP_dictations', JSON.stringify(formData.dictations));
    } else {
        if (formData.dictations) localStorage.setItem('quickSOAP_dictations', JSON.stringify(formData.dictations));
        if (formData.input !== undefined) localStorage.setItem('quickSOAP_input', formData.input);
        if (formData.report) localStorage.setItem('quickSOAP_report', formData.report);
        else if (report.report_text) localStorage.setItem('quickSOAP_report', report.report_text);
        if (formData.lastInput !== undefined) localStorage.setItem('quickSOAP_lastInput', formData.lastInput);
    }
    if (report.report_name) localStorage.setItem('quickSOAP_reportName', report.report_name);

    localStorage.setItem('currentQuickSOAPReportId', report.id);
    if (report.report_text) localStorage.setItem(NOTE_TYPE_KEY, normalizeType(report.record_type || formData.record_type));
    setActiveCaseId(report.case_id || null);
    localStorage.setItem('loadQuickSOAPData', 'true');
}
