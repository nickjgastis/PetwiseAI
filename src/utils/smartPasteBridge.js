import { useEffect, useRef } from 'react';

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

const TYPE_ONLY = /^(quicksoap|soap|summary|callback|dental)( mobile)?$/i;

// Same as normalizeType in ./cases, kept local so sign-out code does not pull in the Supabase client.
const normalizeType = (t) => (!t || t === 'quicksoap' ? 'soap' : t);

// "Bella - Summary - Oct 22, 3:19 PM" -> "Bella"; "Summary Mobile - ..." has no pet name.
const nameFromReportName = (reportName) => {
    const first = String(reportName || '').split(' - ')[0].trim();
    return first && !TYPE_ONLY.test(first) ? first : '';
};

// Sends the open record when it is opened ('open': the extension selects it) and again when its text changes
// ('update': the extension refreshes it but keeps whatever the vet picked there).
export function useSmartPasteBridge({ enabled, report, recordType, petName, reportName, caseId }) {
    const lastId = useRef(null);
    const lastSent = useRef('');

    useEffect(() => {
        if (!enabled) return undefined;
        const sync = () => {
            const id = localStorage.getItem('currentQuickSOAPReportId');
            if (!id || !report?.trim()) return;
            const patientName = petName || nameFromReportName(reportName);
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
        const debounce = setTimeout(sync, EDIT_DEBOUNCE_MS);
        const poll = setInterval(sync, ID_POLL_MS);
        return () => {
            clearTimeout(debounce);
            clearInterval(poll);
        };
    }, [enabled, report, recordType, petName, reportName, caseId]);
}
