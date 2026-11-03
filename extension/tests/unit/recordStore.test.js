import { describe, expect, it, vi } from 'vitest';
import { MOCK_RECORDS } from '../../services/mockRecords.js';
import { createMemoryStorage, createRecordStore, STORAGE_KEYS } from '../../services/recordStore.js';

describe('recordStore', () => {
    it('selects Bella by default and lists all five records', async () => {
        const store = createRecordStore({ storage: createMemoryStorage() });
        await store.ready;
        expect(store.getActiveRecord().patientName).toBe('Bella');
        expect(store.listRecords().map((r) => r.label)).toEqual([
            'Bella \u00b7 Vomiting',
            'Max \u00b7 Lameness',
            'Luna \u00b7 Inappetence',
            'Charlie \u00b7 Diarrhea',
            'Milo \u00b7 Coughing',
        ]);
    });

    it('switches the active record, notifies, and serves that record\'s content', async () => {
        const store = createRecordStore({ storage: createMemoryStorage() });
        await store.ready;
        const listener = vi.fn();
        store.subscribe(listener);
        await store.selectRecord('mock-max');
        expect(listener).toHaveBeenCalled();
        expect(store.getActiveRecord().patientName).toBe('Max');
        expect(store.getActiveContent().subjective).toContain('Acute right pelvic limb lameness');
    });

    it('persists only the record id and enabled flag, never record content', async () => {
        const storage = createMemoryStorage();
        const set = vi.spyOn(storage, 'set');
        const store = createRecordStore({ storage });
        await store.ready;
        await store.selectRecord('mock-luna');
        await store.setEnabled(false);
        const written = set.mock.calls.map(([values]) => values);
        expect(written).toEqual([{ [STORAGE_KEYS.activeRecordId]: 'mock-luna' }, { [STORAGE_KEYS.enabled]: false }]);
        expect(JSON.stringify(written)).not.toMatch(/vomiting|lameness|inappetence/i);
    });

    it('restores a stored selection', async () => {
        const store = createRecordStore({ storage: createMemoryStorage({ [STORAGE_KEYS.activeRecordId]: 'mock-milo', [STORAGE_KEYS.enabled]: false }) });
        await store.ready;
        expect(store.getActiveRecord().patientName).toBe('Milo');
        expect(store.getState().enabled).toBe(false);
    });

    it('falls back to the default for an unknown stored id', async () => {
        const store = createRecordStore({ storage: createMemoryStorage({ [STORAGE_KEYS.activeRecordId]: 'deleted-record' }) });
        await store.ready;
        expect(store.getActiveRecord().id).toBe('mock-bella');
    });

    it('rejects selecting an unknown record', async () => {
        const store = createRecordStore({ storage: createMemoryStorage() });
        await store.ready;
        expect(await store.selectRecord('nope')).toBe(false);
        expect(store.getActiveRecord().id).toBe('mock-bella');
    });

    it('picks up a selection made in another tab or the popup', async () => {
        const storage = createMemoryStorage();
        const a = createRecordStore({ storage });
        const b = createRecordStore({ storage });
        await Promise.all([a.ready, b.ready]);
        await a.selectRecord('mock-charlie');
        expect(b.getActiveRecord().patientName).toBe('Charlie');
    });

    it('works without storage', async () => {
        const store = createRecordStore({ records: MOCK_RECORDS });
        await store.ready;
        expect(store.getActiveRecord().patientName).toBe('Bella');
    });
});
