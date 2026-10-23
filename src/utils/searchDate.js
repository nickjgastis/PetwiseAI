const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const DAY = '(\\d{1,2})(?:st|nd|rd|th)?';

const PATTERNS = [
    // 2026-10-21
    [/^(\d{4})-(\d{1,2})-(\d{1,2})$/, (m) => [+m[1], +m[2], +m[3]]],
    // 10/21, 10/21/26, 10-21-2026
    [/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/, (m) => [m[3], +m[1], +m[2]]],
    // Oct 21, October 21st, Oct 21 2026
    [new RegExp(`^${MONTH}\\s+${DAY}(?:,?\\s+(\\d{4}))?$`), (m) => [m[3], monthIndex(m[1]), +m[2]]],
    // 21 Oct, 21st October 2026
    [new RegExp(`^${DAY}\\s+${MONTH}(?:,?\\s+(\\d{4}))?$`), (m) => [m[3], monthIndex(m[2]), +m[1]]],
];

const monthIndex = (name) => MONTHS.indexOf(name.slice(0, 3)) + 1;

const fullYear = (y) => (String(y).length === 2 ? 2000 + Number(y) : Number(y));

// Typed dates mean a day the vet saw patients, in their own timezone. Returns { from, to } or null.
// A month alone needs a year ("Oct 2026"), since May, June and April are also pet names.
export function parseSearchDate(input, now = new Date()) {
    const q = String(input || '').trim().toLowerCase().replace(/,$/, '');
    if (!q) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (q === 'today') return { from: today, to: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1) };
    if (q === 'yesterday') return { from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1), to: today };

    const monthYear = q.match(new RegExp(`^${MONTH},?\\s+(\\d{4})$`));
    if (monthYear) {
        const month = monthIndex(monthYear[1]) - 1;
        return { from: new Date(+monthYear[2], month, 1), to: new Date(+monthYear[2], month + 1, 1) };
    }

    for (const [re, parts] of PATTERNS) {
        const m = q.match(re);
        if (!m) continue;
        const [y, month, day] = parts(m);
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        let year = y ? fullYear(y) : now.getFullYear();
        // No year typed: the most recent one, so "Dec 3" in January means last December.
        if (!y && new Date(year, month - 1, day) > today) year -= 1;
        const from = new Date(year, month - 1, day);
        if (from.getMonth() !== month - 1) return null;
        return { from, to: new Date(year, month - 1, day + 1) };
    }
    return null;
}
