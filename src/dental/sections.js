const KNOWN = [
    'dental procedure summary',
    'procedure summary',
    'anesthesia',
    'oral exam',
    'tooth findings',
    'findings',
    'radiographs',
    'treatment',
    'procedures',
    'home care and follow-up',
    'home care',
    'follow-up',
    'recommendations'
];

// A heading is its own short line, no sentence punctuation, with content after it.
const isHeading = (line, next) => {
    const t = line.trim().replace(/:$/, '');
    if (!t || !next?.trim()) return false;
    if (KNOWN.includes(t.toLowerCase())) return true;
    return t.length <= 40 && /^[A-Z]/.test(t) && !/[.,;:!?)]$/.test(t) && !/^\d/.test(t) && t.split(/\s+/).length <= 5 && !line.includes(':');
};

// Splits plain record text into [{ heading, body }]. Text before the first heading gets heading null.
export function parseSections(text = '') {
    const lines = String(text).replace(/\r\n/g, '\n').split('\n');
    const sections = [];
    let cur = { heading: null, lines: [] };
    lines.forEach((line, i) => {
        if (isHeading(line, lines[i + 1])) {
            if (cur.heading || cur.lines.some((l) => l.trim())) sections.push(cur);
            cur = { heading: line.trim().replace(/:$/, ''), lines: [] };
        } else {
            cur.lines.push(line);
        }
    });
    if (cur.heading || cur.lines.some((l) => l.trim())) sections.push(cur);
    return sections.map((s) => ({ heading: s.heading, body: s.lines.join('\n').replace(/^\n+|\s+$/g, '') }));
}

export const joinSections = (sections) =>
    sections.map((s) => (s.heading ? `${s.heading}\n${s.body}` : s.body)).join('\n\n');
