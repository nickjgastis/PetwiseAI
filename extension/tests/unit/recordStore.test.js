import { describe, expect, it, vi } from 'vitest';
import { MOCK_RECORDS } from '../../services/mockRecords.js';
import { createMemoryStorage, createRecordStore, groupCases, STORAGE_KEYS } from '../../services/recordStore.js';

describe('recordStore', () => {
    it('selects Bella by default and lists five cases, newest first, each with its records newest first', async () => {
        const store = createRecordStore({ storage: createMemoryStorage() });
        await store.ready;
        expect(store.getActiveRecord().patientName).toBe('Bella');
        expect(store.getActiveType()).toBe('soap');
        const cases = store.listCases();
        expect(cases.map((c) => c.label)).toEqual([
            'Luna \u00b7 Inappetence',
            'Milo \u00b7 Coughing',
            'Bella \u00b7 Vomiting',
            'Charlie \u00b7 Diarrhea',
            'Max \u00b7 Lameness',
        ]);
        expect(cases.find((c) => c.patientName === 'Bella').records.map((r) => r.typeLabel)).toEqual(['Callback', 'SOAP']);
        expect(cases.find((c) => c.patientName === 'Max').records.map((r) => r.typeLabel)).toEqual(['Summary', 'SOAP']);
    });

    it('opening a case selects its most recent record; a record can then be picked by type', async () => {
        const store = createRecordStore({ storage: createMemoryStorage() });
        await store.selectCase('case-luna');
        expect(store.getActiveRecord().id).toBe('mock-luna-dental');
        expect(store.getActiveType()).toBe('dental');
        expect(store.getActiveContent().teeth).toMatch(/^108: Slab fracture/);
        await store.selectRecord('mock-luna');
        expect(store.getActiveCase().id).toBe('case-luna');
        expect(store.getActiveType()).toBe('soap');
    });

    it('treats a record without a case as a case of its own', () => {
        const cases = groupCases([{ id: 'r1', patientName: 'Nova', recordTitle: 'Itch', recordType: 'quicksoap', updatedAt: '2026-01-01' }]);
        expect(cases).toHaveLength(1);
        expect(cases[0]).toMatchObject({ id: 'record:r1', label: 'Nova \u00b7 Itch', records: [{ id: 'r1', recordType: 'soap', typeLabel: 'SOAP' }] });
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
