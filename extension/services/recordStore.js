import { DEFAULT_RECORD_ID, MOCK_RECORDS } from './mockRecords.js';
import { formatRecord, recordLabel } from './soapFormatter.js';

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

export const createRecordStore = ({ storage, records = MOCK_RECORDS, defaultRecordId = DEFAULT_RECORD_ID } = {}) => {
    const byId = new Map(records.map((r) => [r.id, r]));
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
        listRecords: () => records.map((r) => ({ id: r.id, patientName: r.patientName, recordTitle: r.recordTitle, label: recordLabel(r) })),
        getActiveRecord: () => byId.get(state.activeRecordId) || null,
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
