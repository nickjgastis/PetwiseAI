import { describe, expect, it, vi } from 'vitest';
import { handleBridgeMessage, LIVE_RECORDS_KEY, MAX_LIVE_RECORDS, originAllowed, sanitizeRecord } from '../../services/petwiseBridge.js';
import { createMemoryStorage, createRecordStore, STORAGE_KEYS } from '../../services/recordStore.js';

const PATTERNS = ['https://app.petwise.vet/*', 'http://localhost:3000/*'];
const SENDER = { origin: 'https://app.petwise.vet' };

const makeIo = (start = {}) => {
    let live = { ...start };
    let clock = 0;
    return {
        version: '0.3.0',
        allowedPatterns: PATTERNS,
        getLive: async () => live,
        setLive: vi.fn(async (next) => (live = next)),
        selectRecord: vi.fn(async () => {}),
        now: () => new Date(Date.UTC(2026, 10, 3, 12, 0, clock++)),
        live: () => live,
    };
};

const soap = (id, text = '**Plan**\nRecheck.') => ({ id, caseId: 'c1', patientName: 'Nova', recordType: 'soap', reportText: text });

describe('sanitizeRecord', () => {
    it('keeps known fields, bounds them, and normalizes the type', () => {
        const r = sanitizeRecord({ id: ' r1 ', patientName: 'N'.repeat(200), recordType: 'quicksoap', reportText: 'x', extra: 'dropped', updatedAt: 'nope' }, new Date(0));
        expect(r).toEqual({ id: 'r1', caseId: null, patientName: 'N'.repeat(80), recordType: 'soap', recordTitle: '', updatedAt: new Date(0).toISOString(), reportText: 'x' });
    });

    it('drops records without an id or text', () => {
        expect(sanitizeRecord({ id: 'r1', reportText: '   ' })).toBeNull();
        expect(sanitizeRecord({ reportText: 'x' })).toBeNull();
        expect(sanitizeRecord('nope')).toBeNull();
    });
});

describe('handleBridgeMessage', () => {
    it('only answers PetWise origins', async () => {
        expect(originAllowed('https://app.petwise.vet', PATTERNS)).toBe(true);
        expect(originAllowed('https://app.petwise.vet.evil.com', PATTERNS)).toBe(false);
        expect(await handleBridgeMessage({ type: 'petwise:ping' }, { origin: 'https://evil.example' }, makeIo())).toEqual({ ok: false, error: 'origin not allowed' });
        expect(await handleBridgeMessage({ type: 'petwise:ping' }, SENDER, makeIo())).toEqual({ ok: true, version: '0.3.0' });
    });

    it('open stores and selects; update refreshes without selecting or reordering', async () => {
        const io = makeIo();
        await handleBridgeMessage({ type: 'petwise:record', reason: 'open', record: soap('r1') }, SENDER, io);
        expect(io.selectRecord).toHaveBeenCalledWith('r1');
        const openedAt = io.live().r1.openedAt;

        await handleBridgeMessage({ type: 'petwise:record', reason: 'update', record: soap('r1', '**Plan**\nRecheck in 3 days.') }, SENDER, io);
        expect(io.selectRecord).toHaveBeenCalledTimes(1);
        expect(io.live().r1).toMatchObject({ reportText: '**Plan**\nRecheck in 3 days.', openedAt });
    });

    it('case stores every record in one write, selects the chosen one and puts it first', async () => {
        const io = makeIo({ old: { ...soap('old'), caseId: 'c0', openedAt: '2026-11-03T08:00:00.000Z' } });
        const summary = { ...soap('s1', 'Nova did great.'), recordType: 'summary' };
        await handleBridgeMessage({ type: 'petwise:case', records: [summary, soap('p1'), { id: 'bad' }], selectId: 'p1' }, SENDER, io);
        expect(io.setLive).toHaveBeenCalledTimes(1);
        expect(io.selectRecord).toHaveBeenCalledWith('p1');
        expect(Object.keys(io.live()).sort()).toEqual(['old', 'p1', 's1']);
        expect(io.live().p1.openedAt > io.live().s1.openedAt).toBe(true);
        expect(io.live().s1.openedAt > io.live().old.openedAt).toBe(true);
    });

    it('case without a valid selectId refreshes without touching the selection', async () => {
        const io = makeIo();
        await handleBridgeMessage({ type: 'petwise:case', records: [soap('p1')], selectId: null }, SENDER, io);
        await handleBridgeMessage({ type: 'petwise:case', records: [soap('p1')], selectId: 'elsewhere' }, SENDER, io);
        expect(io.selectRecord).not.toHaveBeenCalled();
        expect(io.live().p1).toBeDefined();
        expect(await handleBridgeMessage({ type: 'petwise:case', records: [] }, SENDER, io)).toEqual({ ok: false, error: 'invalid record' });
    });

    it('keeps only the most recently opened records and clears on sign-out', async () => {
        const io = makeIo();
        for (let i = 0; i < MAX_LIVE_RECORDS + 3; i++) await handleBridgeMessage({ type: 'petwise:record', reason: 'open', record: soap(`r${i}`) }, SENDER, io);
        expect(Object.keys(io.live())).toHaveLength(MAX_LIVE_RECORDS);
        expect(io.live().r0).toBeUndefined();
        await handleBridgeMessage({ type: 'petwise:clear' }, SENDER, io);
        expect(io.live()).toEqual({});
    });
});

describe('recordStore with records from PetWise', () => {
    it('shows only real records once any arrive, follows the selection PetWise writes, and falls back to demo on clear', async () => {
        const storage = createMemoryStorage();
        const liveStorage = createMemoryStorage();
        const store = createRecordStore({ storage, liveStorage });
        await store.ready;
        expect(store.getState().live).toBe(false);
        expect(store.getActiveRecord().patientName).toBe('Bella');

        await liveStorage.set({ [LIVE_RECORDS_KEY]: { r1: { ...soap('r1'), openedAt: '2026-11-03T12:00:00Z', updatedAt: '2026-11-03T12:00:00Z' } } });
        await storage.set({ [STORAGE_KEYS.activeRecordId]: 'r1' });
        expect(store.getState().live).toBe(true);
        expect(store.listCases().map((c) => c.patientName)).toEqual(['Nova']);
        expect(store.getActiveContent().plan).toBe('Recheck.');

        await liveStorage.set({ [LIVE_RECORDS_KEY]: { r1: { ...soap('r1', '**Plan**\nRecheck in 3 days.'), openedAt: '2026-11-03T12:00:00Z' } } });
        expect(store.getActiveContent().plan).toBe('Recheck in 3 days.');

        await store.clearLive();
        expect(store.getState().live).toBe(false);
        expect(store.getActiveRecord().patientName).toBe('Bella');
    });

    it('picks the most recently opened real record when the stored selection is gone', async () => {
        const liveStorage = createMemoryStorage({
            [LIVE_RECORDS_KEY]: {
                a: { ...soap('a'), patientName: 'Old', caseId: 'c-old', openedAt: '2026-11-03T09:00:00Z' },
                b: { ...soap('b'), patientName: 'New', caseId: 'c-new', openedAt: '2026-11-03T11:00:00Z' },
            },
        });
        const store = createRecordStore({ storage: createMemoryStorage({ [STORAGE_KEYS.activeRecordId]: 'mock-bella' }), liveStorage });
        await store.ready;
        expect(store.getActiveRecord().patientName).toBe('New');
        expect(store.listCases().map((c) => c.patientName)).toEqual(['New', 'Old']);
    });
});
