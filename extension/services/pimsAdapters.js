import { registerAdapter } from './fieldClassifier.js';

const onDomain = (location, domain) => {
    const host = location?.hostname || '';
    return host === domain || host.endsWith(`.${domain}`);
};

const sourceText = (descriptor, kind) => descriptor.sources?.find((s) => s.kind === kind)?.text || '';

// ezyVet's clinical record editors are unlabelled Lexical editors wrapped in "<section>-lexical-container-header".
const EZYVET_SECTIONS = {
    history: 'subjective',
    'physical-exam': 'objective',
    assessment: 'assessment',
    plan: 'plan',
};

export const ezyvetAdapter = {
    id: 'ezyvet',
    matchesHost: (location) => onDomain(location, 'ezyvet.com'),
    classify: (descriptor) => {
        const match = /^([a-z-]+?)-lexical-container/.exec(sourceText(descriptor, 'container'));
        const section = match && EZYVET_SECTIONS[match[1]];
        return section ? { kind: 'section', section, matchedText: match[0] } : null;
    },
};

let registered = false;

export const registerPimsAdapters = () => {
    if (registered) return;
    registered = true;
    registerAdapter(ezyvetAdapter);
};
