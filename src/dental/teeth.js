// Modified Triadan system. Quadrants: 1 right maxilla, 2 left maxilla, 3 left mandible, 4 right mandible.
// Shared by the chart, the record view and (later) the server-side validator, so keep it dependency free.

export const SPECIES = ['canine', 'feline'];

const QUADRANTS = [
    { q: 1, jaw: 'upper', side: 'right' },
    { q: 2, jaw: 'upper', side: 'left' },
    { q: 3, jaw: 'lower', side: 'left' },
    { q: 4, jaw: 'lower', side: 'right' }
];

// Per-quadrant tooth positions, mesial to distal. `kind` drives the drawn shape; sizes are rough
// mesiodistal length (len) and buccolingual depth (dep) in mm for a medium dog / average cat.
// `gap` is the space before the tooth (mesial side).
const LAYOUT = {
    canine: {
        upper: [
            { pos: 1, kind: 'incisor', name: 'first incisor', roots: 1, len: 4, dep: 4, gap: 0.6 },
            { pos: 2, kind: 'incisor', name: 'second incisor', roots: 1, len: 4.6, dep: 4.4, gap: 0.4 },
            { pos: 3, kind: 'incisor3', name: 'third incisor', roots: 1, len: 5.6, dep: 5, gap: 0.4 },
            { pos: 4, kind: 'canine', name: 'canine', roots: 1, len: 10, dep: 7, gap: 6 },
            { pos: 5, kind: 'premolar1', name: 'first premolar', roots: 1, len: 4.5, dep: 3.6, gap: 2.5 },
            { pos: 6, kind: 'premolar', name: 'second premolar', roots: 2, len: 8, dep: 4, gap: 2.2 },
            { pos: 7, kind: 'premolar', name: 'third premolar', roots: 2, len: 10, dep: 4.6, gap: 2 },
            { pos: 8, kind: 'carnassialUpper', name: 'fourth premolar', roots: 3, len: 17, dep: 9, gap: 1.2 },
            { pos: 9, kind: 'molarUpper', name: 'first molar', roots: 3, len: 10, dep: 13, gap: 0.5 },
            { pos: 10, kind: 'molarUpperSmall', name: 'second molar', roots: 3, len: 6, dep: 9, gap: 0.5 }
        ],
        lower: [
            { pos: 1, kind: 'incisor', name: 'first incisor', roots: 1, len: 3.4, dep: 3.6, gap: 0.5 },
            { pos: 2, kind: 'incisor', name: 'second incisor', roots: 1, len: 3.9, dep: 3.9, gap: 0.3 },
            { pos: 3, kind: 'incisor', name: 'third incisor', roots: 1, len: 4.4, dep: 4.2, gap: 0.3 },
            { pos: 4, kind: 'canine', name: 'canine', roots: 1, len: 9, dep: 6.4, gap: 0.8 },
            { pos: 5, kind: 'premolar1', name: 'first premolar', roots: 1, len: 4, dep: 3.2, gap: 3 },
            { pos: 6, kind: 'premolar', name: 'second premolar', roots: 2, len: 7.5, dep: 3.8, gap: 2.4 },
            { pos: 7, kind: 'premolar', name: 'third premolar', roots: 2, len: 8.5, dep: 4.2, gap: 2.2 },
            { pos: 8, kind: 'premolar', name: 'fourth premolar', roots: 2, len: 10, dep: 5, gap: 1.8 },
            { pos: 9, kind: 'carnassialLower', name: 'first molar', roots: 2, len: 20, dep: 8, gap: 0.8 },
            { pos: 10, kind: 'molarLower', name: 'second molar', roots: 2, len: 8, dep: 6, gap: 0.5 },
            { pos: 11, kind: 'molarTiny', name: 'third molar', roots: 1, len: 4, dep: 3.6, gap: 0.5 }
        ]
    },
    feline: {
        upper: [
            { pos: 1, kind: 'incisor', name: 'first incisor', roots: 1, len: 1.5, dep: 1.6, gap: 0.3 },
            { pos: 2, kind: 'incisor', name: 'second incisor', roots: 1, len: 1.8, dep: 1.8, gap: 0.2 },
            { pos: 3, kind: 'incisor3', name: 'third incisor', roots: 1, len: 2.6, dep: 2.4, gap: 0.2 },
            { pos: 4, kind: 'canine', name: 'canine', roots: 1, len: 5, dep: 3.8, gap: 2.4 },
            { pos: 6, kind: 'premolar1', name: 'second premolar', roots: 1, len: 2, dep: 1.8, gap: 2.6 },
            { pos: 7, kind: 'premolar', name: 'third premolar', roots: 2, len: 6, dep: 2.8, gap: 0.6 },
            { pos: 8, kind: 'carnassialUpper', name: 'fourth premolar', roots: 3, len: 10, dep: 5, gap: 0.4 },
            { pos: 9, kind: 'molarCatUpper', name: 'first molar', roots: 2, len: 1.6, dep: 3.6, gap: 0.1 }
        ],
        lower: [
            { pos: 1, kind: 'incisor', name: 'first incisor', roots: 1, len: 1.2, dep: 1.4, gap: 0.25 },
            { pos: 2, kind: 'incisor', name: 'second incisor', roots: 1, len: 1.4, dep: 1.5, gap: 0.15 },
            { pos: 3, kind: 'incisor', name: 'third incisor', roots: 1, len: 1.8, dep: 1.7, gap: 0.15 },
            { pos: 4, kind: 'canine', name: 'canine', roots: 1, len: 4.4, dep: 3.4, gap: 0.4 },
            { pos: 7, kind: 'premolar', name: 'third premolar', roots: 2, len: 5, dep: 2.6, gap: 3.4 },
            { pos: 8, kind: 'premolar', name: 'fourth premolar', roots: 2, len: 6.4, dep: 3, gap: 0.4 },
            { pos: 9, kind: 'carnassialLower', name: 'first molar', roots: 2, len: 8, dep: 3.4, gap: 0.4 }
        ]
    }
};

const SIDE_WORD = { right: 'Right', left: 'Left' };
const JAW_WORD = { upper: 'maxillary', lower: 'mandibular' };

// Every permanent tooth for a species: { id: '108', quadrant, jaw, side, ...layout }.
export function teethFor(species) {
    const layout = LAYOUT[species];
    if (!layout) return [];
    return QUADRANTS.flatMap(({ q, jaw, side }) =>
        layout[jaw].map((t) => ({
            ...t,
            id: `${q}${String(t.pos).padStart(2, '0')}`,
            quadrant: q,
            jaw,
            side,
            label: `${SIDE_WORD[side]} ${JAW_WORD[jaw]} ${t.name}`
        }))
    );
}

export const layoutFor = (species) => LAYOUT[species] || null;

export const isValidTooth = (species, id) => teethFor(species).some((t) => t.id === String(id));

export const toothLabel = (species, id) => teethFor(species).find((t) => t.id === String(id))?.label || `Tooth ${id}`;

// Chart colors. `fill`/`stroke` are SVG colors; `chip` is the Tailwind class for legends and lists.
export const STATUSES = {
    normal: { label: 'Normal', fill: '#ffffff', stroke: '#c9d3e1', chip: 'bg-white text-[#13233f] border border-[#d9e1ec]' },
    missing: { label: 'Missing', fill: '#5f6672', stroke: '#16191f', chip: 'bg-[#5f6672] text-white' },
    extracted: { label: 'Extracted', fill: '#ffffff', stroke: '#c9d3e1', cross: '#16191f', chip: 'bg-red-50 text-red-700' },
    fractured: { label: 'Fractured', fill: '#ffe6cc', stroke: '#ea8a2b', chip: 'bg-orange-50 text-orange-700' },
    resorption: { label: 'Resorption', fill: '#ece1fb', stroke: '#8b5cf6', chip: 'bg-violet-50 text-violet-700' },
    caries: { label: 'Caries', fill: '#efe2d3', stroke: '#8b5a2b', chip: 'bg-[#f6ede3] text-[#7a4a1e]' },
    periodontal: { label: 'Periodontal Dz', fill: '#fdf0c8', stroke: '#d8a316', chip: 'bg-amber-50 text-amber-700' },
    mobility: { label: 'Mobility', fill: '#ccf3ec', stroke: '#14a08c', chip: 'bg-teal-50 text-teal-700' },
    retained: { label: 'Retained deciduous', fill: '#fce4f1', stroke: '#d6338a', chip: 'bg-pink-50 text-pink-700' },
    treated: { label: 'Treated', fill: '#dbeafe', stroke: '#3b82f6', chip: 'bg-blue-50 text-blue-700' },
    watch: { label: 'Watch', fill: '#ffffff', stroke: '#2d5fb8', chip: 'bg-white text-[#2d5fb8] border border-[#2d5fb8]/40' }
};

// Feline incisors are too tightly packed for a side-by-side "108 Missing" label, so their statuses become callouts:
// a short list beside the incisors with a leader line from each status to its tooth number.
export const calloutTooth = (species, t) => species === 'feline' && t.kind.startsWith('incisor');

// Callout position for each charted feline incisor, in chart units. Per jaw and side of the arch, statuses list
// outward from the outermost incisor number, one per row; the tooth nearest the midline gets the farthest row so
// leader lines nest instead of crossing. `chartTeeth` is buildChart().teeth, `font` the label size in chart units.
// Returns { [id]: { x, y, anchor, from: [x, y], to: [x, y] } } plus `reach`, how far the rows extend past the numbers.
export function callouts(species, chartTeeth, teeth, font) {
    const out = {};
    let reach = 0;
    const incisors = chartTeeth.filter((t) => calloutTooth(species, t));
    ['upper', 'lower'].forEach((jaw) => {
        const dir = jaw === 'upper' ? -1 : 1;
        const ys = incisors.filter((t) => t.jaw === jaw).map((t) => t.label[1]);
        if (!ys.length) return;
        const edgeY = jaw === 'upper' ? Math.min(...ys) : Math.max(...ys);
        [true, false].forEach((left) => {
            const side = incisors.filter((t) => t.jaw === jaw && (t.label[0] < 0) === left);
            const charted = side.filter((t) => STATUSES[teeth[t.id]?.status] && teeth[t.id].status !== 'normal').sort((a, b) => a.pos - b.pos);
            if (!charted.length) return;
            const xs = side.map((t) => t.label[0]);
            const colX = left ? Math.min(...xs) - font * 0.4 : Math.max(...xs) + font * 0.4;
            charted.forEach((t, i) => {
                const row = charted.length - 1 - i;
                const off = font * (1.7 + row * 1.35);
                const y = edgeY + dir * off;
                reach = Math.max(reach, off + font);
                out[t.id] = {
                    x: colX,
                    y,
                    anchor: left ? 'end' : 'start',
                    from: [colX + (left ? font * 0.35 : -font * 0.35), y],
                    to: [t.label[0], t.label[1] + dir * font * 0.6]
                };
            });
        });
    });
    return { spots: out, reach };
}

export const STATUS_ORDER = ['normal', 'missing', 'extracted', 'fractured', 'caries', 'resorption', 'periodontal', 'mobility', 'retained', 'treated', 'watch'];
