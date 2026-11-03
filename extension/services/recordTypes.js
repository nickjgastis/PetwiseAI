// One entry per PetWise record type (saved_reports.record_type). Only SOAP is split into sections; Summary,
// Callback and Dental are a single block of text and always paste whole, into whichever field the vet is in.

export const FULL = 'full';

export const RECORD_TYPES = {
    soap: {
        label: 'SOAP',
        sections: [
            { key: 'subjective', label: 'Subjective' },
            { key: 'objective', label: 'Objective' },
            { key: 'assessment', label: 'Assessment' },
            { key: 'plan', label: 'Plan' },
        ],
        // Fields that ask for something SOAP files under Plan.
        aliases: { treatment: 'plan', recommendations: 'plan', instructions: 'plan', nextSteps: 'plan' },
    },
    summary: { label: 'Summary', sections: [], aliases: {} },
    callback: { label: 'Callback', sections: [], aliases: {} },
    dental: { label: 'Dental', sections: [], aliases: {} },
};

export const TYPE_KEYS = Object.keys(RECORD_TYPES);

export const ALL_SECTION_KEYS = RECORD_TYPES.soap.sections.map((s) => s.key);

// Legacy 'quicksoap' and missing types are SOAP, as in src/utils/cases.js.
export const normalizeType = (type) => (RECORD_TYPES[type] ? type : 'soap');

export const typeDef = (type) => RECORD_TYPES[normalizeType(type)];

export const typeLabel = (type) => typeDef(type).label;

export const typeSectionKeys = (type) => typeDef(type).sections.map((s) => s.key);

export const isSingleBlock = (type) => !typeDef(type).sections.length;

// The part of a `type` record to paste for `key` (what the field asks for), or null when there is none.
export const resolveSection = (type, key) => {
    if (!key) return null;
    if (key === FULL || isSingleBlock(type)) return FULL;
    const def = typeDef(type);
    if (def.sections.some((s) => s.key === key)) return key;
    return def.aliases[key] || null;
};

// "Full SOAP" for a whole SOAP; a single-block record is just its type ("Paste Callback").
export const sectionLabel = (type, key) => {
    const resolved = resolveSection(type, key);
    if (resolved === FULL) return isSingleBlock(type) ? typeLabel(type) : `Full ${typeLabel(type)}`;
    const section = RECORD_TYPES.soap.sections.find((s) => s.key === (resolved || key));
    return section ? section.label : '';
};
