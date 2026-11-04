export const SECTION_KEYS = ['subjective', 'objective', 'assessment', 'plan'];

export const SECTION_LABELS = {
    subjective: 'Subjective',
    objective: 'Objective',
    assessment: 'Assessment',
    plan: 'Plan',
    full: 'Full SOAP',
};

// A section heading must be the whole line: "**Subjective**", "## Plan", "Assessment:", "S - Subjective", "PLAN".
// Body lines that merely start with a section word ("Plan to recheck...", "Planned dental...") are not headings.
const HEADING_RE = /^\s*(?:#{1,6}\s+)?(?:\*\*|__)?\s*(?:[SOAP]\s*[-\u2013\u2014:.)]\s*)?(subjective|objective|assessment|plan)\s*:?\s*(?:\*\*|__)?\s*:?\s*$/i;

export const matchSectionHeading = (line) => {
    const m = HEADING_RE.exec(line);
    return m ? m[1].toLowerCase() : null;
};

const trimBlankLines = (lines) => {
    let start = 0;
    let end = lines.length;
    while (start < end && !lines[start].trim()) start++;
    while (end > start && !lines[end - 1].trim()) end--;
    return lines.slice(start, end);
};

// Splits report_text into raw section bodies. Nothing is dropped: every line lands in the preamble, a section body,
// or `headingLines` (the section headings themselves, including a section name repeated as its first sub-heading).
// A heading for a section that already has content is kept as body text rather than starting the section over.
export const splitSoap = (text) => {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const preamble = [];
    const bodies = {};
    const headingLines = [];
    let current = null;

    lines.forEach((line, i) => {
        const key = matchSectionHeading(line);
        if (key) {
            if (!(key in bodies)) {
                bodies[key] = [];
                current = key;
                headingLines.push(i);
                return;
            }
            if (key === current && !bodies[key].some((l) => l.trim())) {
                headingLines.push(i);
                return;
            }
        }
        (current ? bodies[current] : preamble).push(line);
    });

    const sections = {};
    SECTION_KEYS.forEach((key) => {
        sections[key] = key in bodies ? trimBlankLines(bodies[key]).join('\n') : '';
    });

    return {
        preamble: trimBlankLines(preamble).join('\n'),
        sections,
        found: SECTION_KEYS.filter((key) => key in bodies),
        headingLines,
    };
};
