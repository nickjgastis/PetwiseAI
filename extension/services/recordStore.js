import { DEFAULT_RECORD_ID, MOCK_ALL_RECORDS } from './mockRecords.js';
import { normalizeType, typeLabel } from './recordTypes.js';
import { formatRecord } from './soapFormatter.js';

const newestFirst = (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));

// Groups records into cases the way PetWise does (saved_reports.case_id). A record without a case is its own case,
// so nothing depends on the cases migration having run.
export const groupCases = (records) => {
    const cases = new Map();
    records.forEach((r) => {
        const id = r.caseId || `record:${r.id}`;
        if (!cases.has(id)) cases.set(id, { id, patientName: r.patientName, species: r.species, title: r.recordTitle, records: [] });
        cases.get(id).records.push(r);
    });
    return [...cases.values()]
        .map((c) => {
            const sorted = [...c.records].sort(newestFirst);
            return {
                ...c,
                updatedAt: sorted[0]?.updatedAt,
                label: `${c.patientName} \u00b7 ${c.title}`,
                records: sorted.map((r) => ({ id: r.id, recordType: normalizeType(r.recordType), typeLabel: typeLabel(r.recordType), updatedAt: r.updatedAt })),
            };
        })
        .sort(newestFirst);
};

// Selection state. Only the selected record id and the enabled flag are persisted; record content never is.
// `storage` is { get(keys), set(values), onChanged(listener) => unsubscribe } so tests can pass an in-memory one.

export const STORAGE_KEYS = { activeRecordId: 'smartpaste.activeRecordId', enabled: 'smartpaste.enabled' };

export const createMemoryStorage = (initial = {}) => {
    const data = { ...initial };
    const listeners = new Set();
    return {
        get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
        set: async (values) => {
            Object.assign(data, values);
            const changes = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { newValue: v }]));
            listeners.forEach((fn) => fn(changes));
        },
        onChanged: (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };
};

export const createRecordStore = ({ storage, records = MOCK_ALL_RECORDS, defaultRecordId = DEFAULT_RECORD_ID } = {}) => {
    const byId = new Map(records.map((r) => [r.id, r]));
    const cases = groupCases(records);
    const caseOf = (recordId) => cases.find((c) => c.records.some((r) => r.id === recordId)) || null;
    const contentCache = new Map();
    const listeners = new Set();
    const validId = (id) => (byId.has(id) ? id : byId.has(defaultRecordId) ? defaultRecordId : records[0]?.id);

    let state = { activeRecordId: validId(defaultRecordId), enabled: true, ready: false };

    const emit = () => listeners.forEach((fn) => fn(state));
    const update = (patch) => {
        const next = { ...state, ...patch };
        if (next.activeRecordId === state.activeRecordId && next.enabled === state.enabled && next.ready === state.ready) return;
        state = next;
        emit();
    };

    const applyStored = (values) => {
        const patch = {};
        if (STORAGE_KEYS.activeRecordId in values) patch.activeRecordId = validId(values[STORAGE_KEYS.activeRecordId]);
        if (STORAGE_KEYS.enabled in values) patch.enabled = values[STORAGE_KEYS.enabled] !== false;
        update(patch);
    };

    const ready = storage
        ? storage
              .get(Object.values(STORAGE_KEYS))
              .then(applyStored)
              .catch(() => {})
              .finally(() => update({ ready: true }))
        : Promise.resolve(update({ ready: true }));

    storage?.onChanged((changes) => {
        const values = {};
        Object.values(STORAGE_KEYS).forEach((key) => {
            if (changes[key]) values[key] = changes[key].newValue;
        });
        applyStored(values);
    });

    const getContent = (id) => {
        if (!contentCache.has(id)) contentCache.set(id, formatRecord(byId.get(id)));
        return contentCache.get(id);
    };

    return {
        ready,
        getState: () => state,
        subscribe: (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        listCases: () => cases,
        getActiveCase: () => caseOf(state.activeRecordId),
        getActiveRecord: () => byId.get(state.activeRecordId) || null,
        getActiveType: () => normalizeType(byId.get(state.activeRecordId)?.recordType),
        // Opening a case selects its most recent record, like opening it in PetWise.
        selectCase: async (caseId) => {
            const c = cases.find((x) => x.id === caseId);
            if (!c?.records.length) return false;
            update({ activeRecordId: c.records[0].id });
            await storage?.set({ [STORAGE_KEYS.activeRecordId]: c.records[0].id });
            return true;
        },
        getActiveContent: () => (state.activeRecordId ? getContent(state.activeRecordId) : null),
        selectRecord: async (id) => {
            if (!byId.has(id)) return false;
            update({ activeRecordId: id });
            await storage?.set({ [STORAGE_KEYS.activeRecordId]: id });
            return true;
        },
        setEnabled: async (enabled) => {
            update({ enabled: !!enabled });
            await storage?.set({ [STORAGE_KEYS.enabled]: !!enabled });
        },
    };
};
