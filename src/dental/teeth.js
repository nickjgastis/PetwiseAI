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
    extracted: { label: 'Extracted', fill: '#ffffff', stroke: '#c9d3e1', cross: '#e05a52', chip: 'bg-red-50 text-red-700' },
    fractured: { label: 'Fractured', fill: '#ffe6cc', stroke: '#ea8a2b', chip: 'bg-orange-50 text-orange-700' },
    resorption: { label: 'Resorption', fill: '#ece1fb', stroke: '#8b5cf6', chip: 'bg-violet-50 text-violet-700' },
    periodontal: { label: 'Periodontal', fill: '#fdf0c8', stroke: '#d8a316', chip: 'bg-amber-50 text-amber-700' },
    treated: { label: 'Treated', fill: '#dbeafe', stroke: '#3b82f6', chip: 'bg-blue-50 text-blue-700' },
    watch: { label: 'Watch', fill: '#ffffff', stroke: '#2d5fb8', chip: 'bg-white text-[#2d5fb8] border border-[#2d5fb8]/40' }
};

export const STATUS_ORDER = ['normal', 'missing', 'extracted', 'fractured', 'resorption', 'periodontal', 'treated', 'watch'];
