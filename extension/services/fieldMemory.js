import { normalizeLabel } from './fieldClassifier.js';
import { ALL_SECTION_KEYS, FULL } from './recordTypes.js';

// Sections the vet chose for fields SmartPaste could not recognize, remembered per site.
// Stored shape: { [origin]: { [fieldKey]: section key from recordTypes.js | 'full' } }.
// Keys are built from field labels and identifiers only, never from field contents or record text.

export const MEMORY_KEY = 'smartpaste.fieldMappings';

const VALID = new Set([...ALL_SECTION_KEYS, FULL]);
const KEY_SOURCES = ['label', 'aria-label', 'aria-labelledby', 'placeholder', 'name', 'id'];

// A stable name for a field: its strongest label-like source. Null when the field has nothing to go on.
export const fieldKey = (descriptor) => {
    for (const kind of KEY_SOURCES) {
        const source = descriptor?.sources?.find((s) => s.kind === kind);
        const text = normalizeLabel(source?.text);
        if (text) return `${descriptor.kind}|${kind}:${text}`;
    }
    return null;
};

export const createFieldMemory = ({ storage } = {}) => {
    let mappings = {};
    const listeners = new Set();
    const emit = () => listeners.forEach((fn) => fn());

    const clean = (value) => {
        const out = {};
        if (!value || typeof value !== 'object') return out;
        Object.entries(value).forEach(([origin, fields]) => {
            if (!fields || typeof fields !== 'object') return;
            const kept = Object.fromEntries(Object.entries(fields).filter(([, s]) => VALID.has(s)));
            if (Object.keys(kept).length) out[origin] = kept;
        });
        return out;
    };

    const ready = storage
        ? storage
              .get([MEMORY_KEY])
              .then((values) => {
                  mappings = clean(values[MEMORY_KEY]);
                  emit();
              })
              .catch(() => {})
        : Promise.resolve();

    storage?.onChanged((changes) => {
        if (!changes[MEMORY_KEY]) return;
        mappings = clean(changes[MEMORY_KEY].newValue);
        emit();
    });

    const save = async (next) => {
        mappings = next;
        emit();
        await storage?.set({ [MEMORY_KEY]: next });
    };

    return {
        ready,
        subscribe: (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        get: (origin, key) => (key ? mappings[origin]?.[key] || null : null),
        remember: async (origin, key, section) => {
            if (!key || !VALID.has(section)) return false;
            await save({ ...mappings, [origin]: { ...mappings[origin], [key]: section } });
            return true;
        },
        forget: async (origin, key) => {
            if (!mappings[origin]?.[key]) return;
            const fields = { ...mappings[origin] };
            delete fields[key];
            const next = { ...mappings };
            if (Object.keys(fields).length) next[origin] = fields;
            else delete next[origin];
            await save(next);
        },
        all: () => mappings,
    };
};
