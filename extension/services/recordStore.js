import { DEFAULT_RECORD_ID, MOCK_ALL_RECORDS } from './mockRecords.js';
import { LIVE_RECORDS_KEY } from './petwiseBridge.js';
import { normalizeType, typeLabel } from './recordTypes.js';
import { formatRecord } from './soapFormatter.js';

// Records sent from PetWise sort by when the vet last opened them; demo records by when they were written.
const when = (r) => String(r.openedAt || r.updatedAt || '');
const newestFirst = (a, b) => when(b).localeCompare(when(a));

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
                openedAt: sorted.map((r) => r.openedAt).filter(Boolean).sort().pop(),
                label: c.title ? `${c.patientName} \u00b7 ${c.title}` : c.patientName,
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

// `liveStorage` holds records sent from the PetWise tab (session storage). Once there are any, they replace the
// demo records entirely, so fictional and real patients are never listed together.
export const createRecordStore = ({ storage, liveStorage = null, records: demoRecords = MOCK_ALL_RECORDS, defaultRecordId = DEFAULT_RECORD_ID } = {}) => {
    let live = [];
    let records = demoRecords;
    let byId = new Map();
    let cases = [];
    const caseOf = (recordId) => cases.find((c) => c.records.some((r) => r.id === recordId)) || null;
    const contentCache = new WeakMap();
    const listeners = new Set();
    // The id the vet (or PetWise) last chose, kept even while its record is not loaded yet.
    let requestedId = defaultRecordId;

    const fallbackId = () => (live.length ? [...live].sort(newestFirst)[0].id : byId.has(defaultRecordId) ? defaultRecordId : records[0]?.id);
    const validId = (id) => (byId.has(id) ? id : fallbackId());

    const setRecords = (liveMap) => {
        live = Object.values(liveMap || {});
        records = live.length ? live : demoRecords;
        byId = new Map(records.map((r) => [r.id, r]));
        cases = groupCases(records);
    };
    setRecords({});

    let state = { activeRecordId: validId(defaultRecordId), enabled: true, ready: false, live: false, revision: 0 };

    const emit = () => listeners.forEach((fn) => fn(state));
    const update = (patch) => {
        const next = { ...state, ...patch };
        if (Object.keys(next).every((k) => next[k] === state[k])) return;
        state = next;
        emit();
    };

    const applyStored = (values) => {
        const patch = {};
        if (STORAGE_KEYS.activeRecordId in values) {
            requestedId = values[STORAGE_KEYS.activeRecordId];
            patch.activeRecordId = validId(requestedId);
        }
        if (STORAGE_KEYS.enabled in values) patch.enabled = values[STORAGE_KEYS.enabled] !== false;
        update(patch);
    };

    const applyLive = (liveMap) => {
        setRecords(liveMap);
        update({ live: live.length > 0, activeRecordId: validId(requestedId), revision: state.revision + 1 });
    };

    const loadLocal = storage
        ? storage
              .get(Object.values(STORAGE_KEYS))
              .then(applyStored)
              .catch(() => {})
        : Promise.resolve();
    const loadLive = liveStorage
        ? liveStorage
              .get([LIVE_RECORDS_KEY])
              .then((values) => applyLive(values[LIVE_RECORDS_KEY]))
              .catch(() => {})
        : Promise.resolve();
    const ready = Promise.all([loadLocal, loadLive]).then(() => update({ activeRecordId: validId(requestedId), ready: true }));

    storage?.onChanged((changes) => {
        const values = {};
        Object.values(STORAGE_KEYS).forEach((key) => {
            if (changes[key]) values[key] = changes[key].newValue;
        });
        applyStored(values);
    });

    liveStorage?.onChanged((changes) => {
        if (changes[LIVE_RECORDS_KEY]) applyLive(changes[LIVE_RECORDS_KEY].newValue);
    });

    // Keyed on the record object: an edit sent from PetWise is a new object, so it is formatted again.
    const getContent = (id) => {
        const record = byId.get(id);
        if (!record) return null;
        if (!contentCache.has(record)) contentCache.set(record, formatRecord(record));
        return contentCache.get(record);
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
            requestedId = c.records[0].id;
            update({ activeRecordId: requestedId });
            await storage?.set({ [STORAGE_KEYS.activeRecordId]: c.records[0].id });
            return true;
        },
        getActiveContent: () => (state.activeRecordId ? getContent(state.activeRecordId) : null),
        selectRecord: async (id) => {
            if (!byId.has(id)) return false;
            requestedId = id;
            update({ activeRecordId: id });
            await storage?.set({ [STORAGE_KEYS.activeRecordId]: id });
            return true;
        },
        // Shared clinic computers: drop every record PetWise sent, back to the demo records.
        clearLive: async () => {
            applyLive({});
            await liveStorage?.set({ [LIVE_RECORDS_KEY]: {} });
        },
        setEnabled: async (enabled) => {
            update({ enabled: !!enabled });
            await storage?.set({ [STORAGE_KEYS.enabled]: !!enabled });
        },
    };
};
