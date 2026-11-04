import { describe, expect, it, vi } from 'vitest';
import { createFieldMemory, fieldKey, MEMORY_KEY } from '../../services/fieldMemory.js';
import { createMemoryStorage } from '../../services/recordStore.js';

const ORIGIN = 'https://pims.example';

describe('fieldKey', () => {
    it('uses the strongest label-like source', () => {
        const descriptor = {
            kind: 'textarea',
            sources: [
                { kind: 'label', text: 'Clinical Notes:' },
                { kind: 'id', text: 'notes' },
            ],
        };
        expect(fieldKey(descriptor)).toBe('textarea|label:clinical notes');
    });

    it('falls back to name/id and returns null with nothing to go on', () => {
        expect(fieldKey({ kind: 'input', sources: [{ kind: 'id', text: 'field_12' }] })).toBe('input|id:field 12');
        expect(fieldKey({ kind: 'textarea', sources: [{ kind: 'heading', text: 'Notes' }] })).toBeNull();
        expect(fieldKey({ kind: 'textarea', sources: [] })).toBeNull();
    });
});

describe('fieldMemory', () => {
    it('remembers and forgets per site', async () => {
        const storage = createMemoryStorage();
        const memory = createFieldMemory({ storage });
        await memory.ready;
        await memory.remember(ORIGIN, 'textarea|label:notes', 'plan');
        expect(memory.get(ORIGIN, 'textarea|label:notes')).toBe('plan');
        expect(memory.get('https://other.example', 'textarea|label:notes')).toBeNull();

        await memory.forget(ORIGIN, 'textarea|label:notes');
        expect(memory.get(ORIGIN, 'textarea|label:notes')).toBeNull();
        expect(memory.all()).toEqual({});
    });

    it('stores only site, field key and section name', async () => {
        const storage = createMemoryStorage();
        const memory = createFieldMemory({ storage });
        await memory.remember(ORIGIN, 'textarea|label:notes', 'full');
        const stored = await storage.get([MEMORY_KEY]);
        expect(stored).toEqual({ [MEMORY_KEY]: { [ORIGIN]: { 'textarea|label:notes': 'full' } } });
    });

    it('rejects unknown sections and drops invalid stored data', async () => {
        const storage = createMemoryStorage({ [MEMORY_KEY]: { [ORIGIN]: { a: 'plan', b: 'rm -rf', c: 42 }, bad: 'x' } });
        const memory = createFieldMemory({ storage });
        await memory.ready;
        expect(memory.all()).toEqual({ [ORIGIN]: { a: 'plan' } });
        expect(await memory.remember(ORIGIN, 'k', 'billing')).toBe(false);
        expect(await memory.remember(ORIGIN, null, 'plan')).toBe(false);
    });

    it('picks up changes made in another tab', async () => {
        const storage = createMemoryStorage();
        const memory = createFieldMemory({ storage });
        await memory.ready;
        const listener = vi.fn();
        memory.subscribe(listener);
        await storage.set({ [MEMORY_KEY]: { [ORIGIN]: { k: 'assessment' } } });
        expect(listener).toHaveBeenCalled();
        expect(memory.get(ORIGIN, 'k')).toBe('assessment');
    });
});
