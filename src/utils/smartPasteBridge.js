import { useEffect, useRef, useState } from 'react';

// Hands the record open in the editor to the PetWise SmartPaste Chrome extension so a vet can paste it into their
// PIMS. Stays inside the browser: no network request, and nothing happens unless the extension is installed
// (Chrome only exposes chrome.runtime.sendMessage to sites an installed extension lists in externally_connectable).
// The extension keeps what it receives in memory for the browser session only. See extension/services/petwiseBridge.js.

const EXTENSION_ID = process.env.REACT_APP_SMARTPASTE_EXTENSION_ID || 'fdaakcanieiagjadphmnblgicldefcfd';
const EDIT_DEBOUNCE_MS = 600;
// The open record's id lives in localStorage and can change (first save, switching records) without a render.
const ID_POLL_MS = 2000;

const send = (message) => {
    const runtime = window.chrome?.runtime;
    if (!runtime?.sendMessage) return;
    try {
        // Reading lastError keeps Chrome from logging "Receiving end does not exist" when the extension is absent.
        runtime.sendMessage(EXTENSION_ID, message, () => void runtime.lastError);
    } catch {
        // Not installed or disabled.
    }
};

// Sign-out and user switch: the extension forgets every record it was sent.
export const clearSmartPaste = () => send({ type: 'petwise:clear' });

// Chrome Web Store listing. Empty until the extension is published; the get-SmartPaste page says so.
export const SMARTPASTE_STORE_URL = process.env.REACT_APP_SMARTPASTE_STORE_URL || '';

// Chrome and Edge on a computer: the browsers that can install it from the Chrome Web Store.
export const canInstallSmartPaste = () =>
    typeof window !== 'undefined' && !!window.chrome && !/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);

const ping = () =>
    new Promise((resolve) => {
        const runtime = window.chrome?.runtime;
        if (!runtime?.sendMessage) return resolve(false);
        try {
            runtime.sendMessage(EXTENSION_ID, { type: 'petwise:ping' }, (res) => {
                void runtime.lastError;
                resolve(!!res?.ok);
            });
        } catch {
            resolve(false);
        }
    });

// null while checking, then true or false. Checks again whenever the vet comes back to this tab (they install it in
// the Web Store tab) and every pollMs. Chrome may only connect a page to a newly installed extension after a
// reload, so the get-SmartPaste page also offers a refresh.
export function useSmartPasteInstalled({ pollMs = 5000 } = {}) {
    const [installed, setInstalled] = useState(null);
    useEffect(() => {
        let live = true;
        const check = async () => {
            if (document.hidden) return;
            const ok = await ping();
            if (live) setInstalled(ok);
        };
        check();
        const timer = pollMs ? setInterval(check, pollMs) : null;
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', check);
        return () => {
            live = false;
            clearInterval(timer);
            window.removeEventListener('focus', check);
            document.removeEventListener('visibilitychange', check);
        };
    }, [pollMs]);
    return installed;
}

const TYPE_ONLY = /^(quicksoap|soap|summary|callback|dental)( mobile)?$/i;

// Same as normalizeType in ./cases, kept local so sign-out code does not pull in the Supabase client.
const normalizeType = (t) => (!t || t === 'quicksoap' ? 'soap' : t);

// "Bella - Summary - Oct 22, 3:19 PM" -> "Bella"; "Summary Mobile - ..." has no pet name.
const nameFromReportName = (reportName) => {
    const first = String(reportName || '').split(' - ')[0].trim();
    return first && !TYPE_ONLY.test(first) ? first : '';
};

const CASE_PRIORITY = ['soap', 'summary', 'callback', 'dental'];
const rank = (note) => {
    const i = CASE_PRIORITY.indexOf(normalizeType(note.record_type || note.form_data?.record_type));
    return i === -1 ? CASE_PRIORITY.length : i;
};
const stamp = (note) => String(note.updated_at || note.created_at || '');

// The record a case opens on in SmartPaste: its SOAP, else summary, callback, dental; the newest of that type.
export const pickCaseRecord = (notes = []) =>
    notes.filter((n) => n.report_text?.trim()).sort((a, b) => rank(a) - rank(b) || stamp(b).localeCompare(stamp(a)))[0] || null;

// saved_reports timestamps come back without a zone but are UTC.
const isoFrom = (d) => (typeof d === 'string' && /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(d) ? `${d}Z` : d);

// Case page: hands SmartPaste every record in the case and selects pickCaseRecord. Selects again only when that pick
// changes (a SOAP lands while the page is open), so a record the vet chose in the extension is left alone otherwise.
// Opening a record afterwards selects that record instead (useSmartPasteBridge).
// Coming back to this tab selects the case's pick again, like opening it.
export function useSmartPasteCase({ enabled, caseId, petName, notes }) {
    const lastPick = useRef(null);
    const lastSent = useRef('');
    const [shown, setShown] = useState(0);

    useEffect(() => {
        const onVisibility = () => !document.hidden && setShown((n) => n + 1);
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    useEffect(() => {
        lastPick.current = null;
        lastSent.current = '';
    }, [caseId, shown]);

    useEffect(() => {
        if (!enabled || !caseId || document.hidden) return;
        const usable = (notes || []).filter((n) => n.report_text?.trim());
        if (!usable.length) return;
        const pick = pickCaseRecord(usable);
        const records = usable.map((n) => ({
            id: String(n.id),
            caseId,
            patientName: petName || nameFromReportName(n.report_name),
            recordType: normalizeType(n.record_type || n.form_data?.record_type),
            updatedAt: isoFrom(n.updated_at || n.created_at),
            reportText: n.report_text,
        }));
        const signature = JSON.stringify([pick.id, records]);
        if (signature === lastSent.current) return;
        lastSent.current = signature;
        const selectId = String(pick.id) !== lastPick.current ? String(pick.id) : null;
        lastPick.current = String(pick.id);
        send({ type: 'petwise:case', records, selectId });
    }, [enabled, caseId, petName, notes, shown]);
}

// Sends the open record when it is opened ('open': the extension selects it) and again when its text changes
// ('update': the extension refreshes it but keeps whatever the vet picked there).
// With several PetWise tabs open, the one the vet last looked at wins: coming back to this tab selects its record
// again. Hidden tabs send nothing.
export function useSmartPasteBridge({ enabled, report, recordType, caseName, petName, reportName, caseId }) {
    const lastId = useRef(null);
    const lastSent = useRef('');
    // localStorage is shared by every tab. ownId is the record this tab has open; seenId is the stored id as this
    // tab last saw it while visible, so a change another tab made while this one was hidden is not taken as ours.
    const ownId = useRef(null);
    const seenId = useRef(null);

    useEffect(() => {
        if (!enabled) return undefined;
        const sync = () => {
            if (document.hidden) return;
            const stored = localStorage.getItem('currentQuickSOAPReportId');
            if (stored !== seenId.current) {
                seenId.current = stored;
                ownId.current = stored;
            }
            const id = ownId.current;
            if (!id || !report?.trim()) return;
            const patientName = caseName || petName || nameFromReportName(reportName);
            const signature = [id, recordType, patientName, caseId, report].join('\u0000');
            if (signature === lastSent.current) return;
            const reason = id === lastId.current ? 'update' : 'open';
            lastId.current = id;
            lastSent.current = signature;
            send({
                type: 'petwise:record',
                reason,
                record: {
                    id,
                    caseId: caseId || null,
                    patientName,
                    recordType: normalizeType(recordType),
                    updatedAt: new Date().toISOString(),
                    reportText: report,
                },
            });
        };
        const onVisibility = () => {
            if (document.hidden) return;
            if (ownId.current) seenId.current = localStorage.getItem('currentQuickSOAPReportId');
            lastId.current = null;
            lastSent.current = '';
            sync();
        };
        const debounce = setTimeout(sync, EDIT_DEBOUNCE_MS);
        const poll = setInterval(sync, ID_POLL_MS);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            clearTimeout(debounce);
            clearInterval(poll);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [enabled, report, recordType, caseName, petName, reportName, caseId]);
}
