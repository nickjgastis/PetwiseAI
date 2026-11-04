import { normalizeType } from './recordTypes.js';

// Records the PetWise web app sends while a vet works in it. The extension never signs in or calls the PetWise API:
// the open PetWise tab hands over the record it shows, and SmartPaste keeps the last few in memory for this browser
// session only.
//
// Messages (chrome.runtime.sendMessage from an externally_connectable PetWise page):
//   { type: 'petwise:ping' }                                      -> { ok, version }
//   { type: 'petwise:record', reason: 'open' | 'update', record }  -> { ok }
//   { type: 'petwise:case', records, selectId }                   -> { ok }   (case page: all its records at once)
//   { type: 'petwise:clear' }                                     -> { ok }   (sign-out)
// record: { id, caseId, patientName, recordType, title, updatedAt, reportText }

export const LIVE_RECORDS_KEY = 'smartpaste.liveRecords';
export const MAX_LIVE_RECORDS = 25;
const MAX_TEXT = 200000;

const str = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Everything from the page is untrusted: keep known fields, bound their size, drop the record if it is unusable.
export const sanitizeRecord = (raw, now = new Date()) => {
    if (!raw || typeof raw !== 'object') return null;
    const id = str(raw.id, 100);
    const reportText = typeof raw.reportText === 'string' ? raw.reportText.slice(0, MAX_TEXT) : '';
    if (!id || !reportText.trim()) return null;
    const updatedAt = !Number.isNaN(Date.parse(raw.updatedAt)) ? new Date(raw.updatedAt).toISOString() : now.toISOString();
    return {
        id,
        caseId: str(raw.caseId, 100) || null,
        patientName: str(raw.patientName, 80) || 'Unnamed patient',
        recordType: normalizeType(raw.recordType),
        recordTitle: str(raw.title, 80),
        updatedAt,
        reportText,
    };
};

// The newest MAX_LIVE_RECORDS records by when they were last opened.
const prune = (records) =>
    Object.fromEntries(
        Object.entries(records)
            .sort(([, a], [, b]) => String(b.openedAt).localeCompare(String(a.openedAt)))
            .slice(0, MAX_LIVE_RECORDS)
    );

export const originAllowed = (origin, patterns) =>
    !!origin && patterns.some((p) => p.endsWith('/*') && origin === p.slice(0, -2));

// `io`: { getLive() -> records map, setLive(map), selectRecord(id), version, allowedPatterns, now() }.
export const handleBridgeMessage = async (message, sender, io) => {
    if (!originAllowed(sender?.origin, io.allowedPatterns)) return { ok: false, error: 'origin not allowed' };
    const type = message?.type;

    if (type === 'petwise:ping') return { ok: true, version: io.version };

    if (type === 'petwise:clear') {
        await io.setLive({});
        return { ok: true };
    }

    if (type === 'petwise:record') {
        const now = io.now ? io.now() : new Date();
        const record = sanitizeRecord(message.record, now);
        if (!record) return { ok: false, error: 'invalid record' };
        const opened = message.reason === 'open';
        const live = await io.getLive();
        const previous = live[record.id];
        const next = prune({ ...live, [record.id]: { ...record, openedAt: opened || !previous ? now.toISOString() : previous.openedAt } });
        await io.setLive(next);
        // Opening a record in PetWise selects it; edits to it never take the selection away from a manual pick.
        if (opened) await io.selectRecord(record.id);
        return { ok: true };
    }

    // One write for the whole case, so records sent together never race each other. The selected record counts as
    // the most recently opened; the rest keep their place, or slot in just behind it.
    if (type === 'petwise:case') {
        const now = io.now ? io.now() : new Date();
        const records = (Array.isArray(message.records) ? message.records : [])
            .slice(0, MAX_LIVE_RECORDS)
            .map((r) => sanitizeRecord(r, now))
            .filter(Boolean);
        if (!records.length) return { ok: false, error: 'invalid record' };
        const select = records.some((r) => r.id === message.selectId) ? message.selectId : null;
        const behind = new Date(now.getTime() - 1).toISOString();
        const live = await io.getLive();
        const next = { ...live };
        for (const record of records) {
            const openedAt = record.id === select ? now.toISOString() : live[record.id]?.openedAt || behind;
            next[record.id] = { ...record, openedAt };
        }
        await io.setLive(prune(next));
        if (select) await io.selectRecord(select);
        return { ok: true };
    }

    return { ok: false, error: 'unknown message' };
};
