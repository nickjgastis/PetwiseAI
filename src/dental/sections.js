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

const FINDINGS = ['tooth findings', 'findings'];
const SUMMARY = ['dental procedure summary', 'procedure summary'];
const toothId = (l) => l.match(/^\s*[-•]?\s*(\d{3})\b/)?.[1];

// Adds a tooth's chart status and note to its "Tooth Findings" line, creating the line or section if needed.
// Only appends; text already in the record is never changed or removed.
export function addToothFinding(report, id, { status, note } = {}, statusLabel) {
    const sections = parseSections(report);
    let idx = sections.findIndex((s) => FINDINGS.includes((s.heading || '').toLowerCase()));
    if (idx === -1) {
        const after = sections.findIndex((s) => SUMMARY.includes((s.heading || '').toLowerCase()));
        idx = after === -1 ? sections.length : after + 1;
        sections.splice(idx, 0, { heading: 'Tooth Findings', body: '' });
    }
    const lines = sections[idx].body ? sections[idx].body.split('\n') : [];
    const at = lines.findIndex((l) => toothId(l) === id);
    const existing = at === -1 ? '' : lines[at].toLowerCase();
    const parts = [status && status !== 'normal' ? statusLabel : null, note?.trim()].filter(
        (p) => p && !existing.includes(p.toLowerCase().slice(0, 6))
    );
    if (!parts.length) return report;

    if (at === -1) {
        const next = lines.findIndex((l) => toothId(l) && toothId(l) > id);
        lines.splice(next === -1 ? lines.length : next, 0, `${id}: ${parts.join(', ')}.`);
    } else {
        lines[at] = `${lines[at].replace(/[\s.]+$/, '')}. ${parts.join(', ')}.`;
    }
    sections[idx] = { ...sections[idx], body: lines.join('\n') };
    return joinSections(sections);
}
