// Pure classification: a field descriptor in, a paste suggestion out. No DOM access, so it is unit-testable.
//
// descriptor: {
//     sources: [{ kind: 'label' | 'aria-label' | 'aria-labelledby' | 'placeholder' | 'heading' | 'name' | 'id', text }],
//     multiline: boolean,
// }
// result: { kind: 'section', section } | { kind: 'full' } | { kind: 'ambiguous' } | { kind: 'ignore', reason }
//         plus { source, matchedText } describing what decided it.

const SOURCE_ORDER = ['label', 'aria-label', 'aria-labelledby', 'placeholder', 'heading', 'name', 'id'];

const EXACT = {
    subjective: 'subjective',
    history: 'subjective',
    hpi: 'subjective',
    'history of present illness': 'subjective',
    'clinical history': 'subjective',
    objective: 'objective',
    'physical examination': 'objective',
    'physical exam': 'objective',
    assessment: 'assessment',
    'clinical impression': 'assessment',
    'clinical impressions': 'assessment',
    plan: 'plan',
    'treatment plan': 'plan',
    // Summary, Callback and Dental sections. Record types without one map it onward (see recordTypes.js aliases).
    treatment: 'treatment',
    treatments: 'treatment',
    'treatment protocol': 'treatment',
    'treatment performed': 'treatment',
    recommendations: 'recommendations',
    recommendation: 'recommendations',
    instructions: 'instructions',
    'client instructions': 'instructions',
    'discharge instructions': 'instructions',
    'home care': 'instructions',
    'home care instructions': 'instructions',
    aftercare: 'instructions',
    'aftercare instructions': 'instructions',
    'next steps': 'nextSteps',
    'follow up': 'nextSteps',
    followup: 'nextSteps',
    'follow up plan': 'nextSteps',
    'summary of call': 'callSummary',
    'call summary': 'callSummary',
    'dental procedure': 'procedure',
    'dental procedure summary': 'procedure',
    'procedure summary': 'procedure',
    'oral exam': 'procedure',
    'oral examination': 'procedure',
    'tooth findings': 'teeth',
    'dental findings': 'teeth',
    'dental chart notes': 'teeth',
    'charting notes': 'teeth',
    radiographs: 'radiographs',
    'dental radiographs': 'radiographs',
    'x rays': 'radiographs',
    xrays: 'radiographs',
};

const FULL = new Set([
    'medical record', 'medical records', 'soap', 'soap note', 'soap notes', 'soap record',
    'communication', 'communications', 'client communication', 'client communications', 'callback', 'callback notes',
    'phone notes', 'call notes', 'phone call notes', 'client contact', 'contact notes',
    'summary', 'clinical summary', 'visit summary', 'discharge summary',
    'dental record', 'dental notes', 'dental report',
]);

// Words that add nothing to a label ("Assessment notes", "S Subjective", "soap_plan").
const FILLER = new Set(['notes', 'note', 'section', 'field', 'text', 'findings', 'soap', 'the', 's', 'o', 'a', 'p']);

// Any of these in a label means the field is not clinical documentation.
const NEGATIVE = [
    'billing', 'invoice', 'payment', 'pay', 'price', 'cost', 'estimate', 'insurance', 'insurer', 'membership',
    'subscription', 'wellness plan', 'search', 'filter', 'email', 'phone', 'address', 'password', 'username',
    'login', 'coupon', 'discount', 'quantity', 'postal', 'zip',
];

const SECTION_WORDS = ['subjective', 'objective', 'assessment', 'plan', 'history', 'exam', 'soap', 'record', 'notes', 'dental', 'treatment', 'summary'];

export const normalizeLabel = (text) =>
    String(text || '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .replace(/[_\-./]+/g, ' ')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const hasPhrase = (normalized, phrase) => ` ${normalized} `.includes(` ${phrase} `);

// One label on its own: a definite answer, or null when it says nothing useful.
export const classifyLabel = (text) => {
    const n = normalizeLabel(text);
    if (!n) return null;
    // An exact clinical label wins over a negative word inside it ("Phone notes" is a callback field, "Phone" is not).
    if (FULL.has(n)) return { kind: 'full' };
    if (EXACT[n]) return { kind: 'section', section: EXACT[n] };
    const negative = NEGATIVE.find((w) => hasPhrase(n, w));
    if (negative) return { kind: 'ignore', reason: `label mentions "${negative}"` };
    const stripped = n
        .split(' ')
        .filter((w) => !FILLER.has(w))
        .join(' ');
    if (FULL.has(stripped)) return { kind: 'full' };
    if (EXACT[stripped]) return { kind: 'section', section: EXACT[stripped] };
    return null;
};

const mentionsClinicalWord = (text) => {
    const n = normalizeLabel(text);
    return SECTION_WORDS.some((w) => hasPhrase(n, w));
};

const adapters = [];

// PIMS-specific adapters run before the generic rules: { id, matchesHost(location), classify(descriptor) }.
export const registerAdapter = (adapter) => {
    adapters.push(adapter);
    return () => adapters.splice(adapters.indexOf(adapter), 1);
};

export const classifyField = (descriptor, { location } = {}) => {
    for (const adapter of adapters) {
        if (location && !adapter.matchesHost(location)) continue;
        const result = adapter.classify(descriptor);
        if (result) return { ...result, source: `adapter:${adapter.id}` };
    }

    const sources = [...(descriptor.sources || [])]
        .filter((s) => s.text && s.text.trim())
        .sort((a, b) => SOURCE_ORDER.indexOf(a.kind) - SOURCE_ORDER.indexOf(b.kind));

    for (const source of sources) {
        // A heading near a single-line input is too weak a signal; it may belong to a whole form.
        if (source.kind === 'heading' && !descriptor.multiline) continue;
        const result = classifyLabel(source.text);
        if (result) return { ...result, source: source.kind, matchedText: source.text.trim() };
    }

    if (descriptor.multiline) return { kind: 'ambiguous', source: 'none' };
    // A single-line input only gets a suggestion when it is clearly clinical.
    if (sources.some((s) => s.kind !== 'heading' && mentionsClinicalWord(s.text))) return { kind: 'ambiguous', source: 'weak' };
    return { kind: 'ignore', reason: 'unrecognized single-line input' };
};
