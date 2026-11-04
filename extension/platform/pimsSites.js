// Cloud practice software SmartPaste runs on from install, with no Turn on step. Chrome asks for these at install,
// and adding one in a later version disables the extension until each vet re-approves it, so new systems belong in
// the per-site flow (siteAccess.js) unless they ship in a major release.
export const KNOWN_PIMS = [
    { name: 'ezyVet', domains: ['ezyvet.com'] },
    { name: 'Vetspire', domains: ['vetspire.com'] },
    { name: 'Provet Cloud', domains: ['provetcloud.com'] },
    { name: 'Shepherd', domains: ['shepherd.vet'] },
    { name: 'Digitail', domains: ['digitail.io'] },
    { name: 'Covetrus Pulse', domains: ['evetpractice.com'] },
    { name: 'IDEXX Neo', domains: ['idexxneo.com'] },
    { name: 'Instinct', domains: ['instinctvet.cloud', 'instinctvet.com'] },
];

export const KNOWN_PIMS_PATTERNS = KNOWN_PIMS.flatMap(({ domains }) => domains.map((d) => `https://*.${d}/*`));

// "clinic.usw2.ezyvet.com" -> "ezyVet". Chrome's *.domain patterns also cover the bare domain.
export const knownPimsFor = (hostname = '') => {
    const host = hostname.toLowerCase();
    return KNOWN_PIMS.find(({ domains }) => domains.some((d) => host === d || host.endsWith(`.${d}`)))?.name || null;
};
