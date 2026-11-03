import { splitSoap } from './soapSections.js';

// One entry per PetWise record type (saved_reports.record_type). Section headings follow what the generators in
// server/server.js and server/dental.js are told to write. Section keys are shared names ("treatment" means the
// same thing in a Summary and a Dental record), so a field recognized once works for every record type.

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
        // Where a field asks for something this type files under another section.
        aliases: { treatment: 'plan', recommendations: 'plan', instructions: 'plan', nextSteps: 'plan' },
    },
    summary: {
        label: 'Summary',
        // The opening paragraph and numbered findings have no heading of their own.
        preamble: 'overview',
        sections: [
            { key: 'overview', label: 'Overview', headings: [] },
            { key: 'treatment', label: 'Treatment', headings: ['treatment protocol', 'treatment'] },
            { key: 'recommendations', label: 'Recommendations', headings: ['recommendations', 'recommendation'] },
        ],
        aliases: { instructions: 'recommendations', nextSteps: 'recommendations' },
    },
    callback: {
        label: 'Callback',
        preamble: 'callSummary',
        sections: [
            { key: 'callSummary', label: 'Call summary', headings: ['summary of call', 'call summary'] },
            { key: 'instructions', label: 'Instructions', headings: ['instructions provided', 'instructions'] },
            { key: 'nextSteps', label: 'Next steps', headings: ['next steps', 'follow-up', 'follow up'] },
            { key: 'recommendations', label: 'Recommendations', headings: ['recommendation', 'recommendations'] },
        ],
        aliases: {},
    },
    dental: {
        label: 'Dental',
        sections: [
            { key: 'procedure', label: 'Procedure summary', headings: ['dental procedure summary', 'procedure summary', 'anesthesia', 'oral exam'] },
            { key: 'teeth', label: 'Tooth findings', headings: ['tooth findings', 'findings'] },
            { key: 'radiographs', label: 'Radiographs', headings: ['radiographs'] },
            { key: 'treatment', label: 'Treatment', headings: ['treatment', 'procedures'] },
            { key: 'homeCare', label: 'Home care', headings: ['home care and follow-up', 'home care', 'follow-up', 'recommendations'] },
        ],
        aliases: { instructions: 'homeCare', nextSteps: 'homeCare', recommendations: 'homeCare' },
    },
};

export const TYPE_KEYS = Object.keys(RECORD_TYPES);

// Generic names for sections the active record type does not have ("No Subjective in Callback").
const GENERIC_LABELS = {
    instructions: 'Instructions',
    nextSteps: 'Next steps',
};

export const ALL_SECTION_KEYS = [...new Set(TYPE_KEYS.flatMap((t) => RECORD_TYPES[t].sections.map((s) => s.key)))];

// Legacy 'quicksoap' and missing types are SOAP, as in src/utils/cases.js.
export const normalizeType = (type) => (RECORD_TYPES[type] ? type : 'soap');

export const typeDef = (type) => RECORD_TYPES[normalizeType(type)];

export const typeLabel = (type) => typeDef(type).label;

export const typeSectionKeys = (type) => typeDef(type).sections.map((s) => s.key);

// The section of `type` that should be pasted for `key` (a field's section), or null when the type has none.
export const resolveSection = (type, key) => {
    if (!key) return null;
    if (key === FULL) return FULL;
    const def = typeDef(type);
    if (def.sections.some((s) => s.key === key)) return key;
    return def.aliases[key] || null;
};

export const sectionLabel = (type, key) => {
    if (!key) return '';
    if (key === FULL) return `Full ${typeLabel(type)}`;
    const resolved = resolveSection(type, key);
    const own = typeDef(type).sections.find((s) => s.key === (resolved || key));
    if (own) return own.label;
    for (const t of TYPE_KEYS) {
        const other = RECORD_TYPES[t].sections.find((s) => s.key === key);
        if (other) return other.label;
    }
    return GENERIC_LABELS[key] || key;
};

// Title and sign-off lines the Summary and Callback generators add; they belong in Full but not in a section.
const BOILERPLATE = [/^clinical summary report$/i, /^client communication report$/i, /^patient:/i, /^end of report\.?$/i, /^this report serves as documentation\b/i];

const headingText = (line) => {
    const t = line.replace(/[*#_]/g, '').replace(/:\s*$/, '').trim();
    return t.length <= 50 ? t.toLowerCase().replace(/\s+/g, ' ') : null;
};

const trimBlank = (lines) => {
    let start = 0;
    let end = lines.length;
    while (start < end && !lines[start].trim()) start++;
    while (end > start && !lines[end - 1].trim()) end--;
    return lines.slice(start, end).join('\n');
};

// Raw section bodies for any record type. SOAP keeps its own, stricter splitter.
export const splitRecord = (text, type) => {
    const t = normalizeType(type);
    if (t === 'soap') return splitSoap(text).sections;

    const def = RECORD_TYPES[t];
    const byHeading = new Map();
    def.sections.forEach((s) => (s.headings || []).forEach((h) => byHeading.has(h) || byHeading.set(h, s.key)));

    const bodies = {};
    let current = def.preamble || null;
    if (current) bodies[current] = [];

    String(text || '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .forEach((line) => {
            if (BOILERPLATE.some((re) => re.test(line.trim()))) return;
            const key = byHeading.get(headingText(line));
            // A heading only starts a section once; a repeat inside a section that already has content is body text.
            if (key && !(bodies[key] || []).some((l) => l.trim())) {
                bodies[key] = [];
                current = key;
                return;
            }
            if (current) bodies[current].push(line);
        });

    const sections = {};
    def.sections.forEach((s) => {
        sections[s.key] = bodies[s.key] ? trimBlank(bodies[s.key]) : '';
    });
    return sections;
};
