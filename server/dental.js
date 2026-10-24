const fetch = require('node-fetch');

// Valid permanent teeth per species (Modified Triadan). Mirrors src/dental/teeth.js; keep the two in sync.
const POSITIONS = {
    canine: { upper: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], lower: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    feline: { upper: [1, 2, 3, 4, 6, 7, 8, 9], lower: [1, 2, 3, 4, 7, 8, 9] }
};
const toothSet = (species) => {
    const p = POSITIONS[species];
    const id = (q, n) => `${q}${String(n).padStart(2, '0')}`;
    return new Set([
        ...p.upper.flatMap((n) => [id(1, n), id(2, n)]),
        ...p.lower.flatMap((n) => [id(3, n), id(4, n)])
    ]);
};

const STATUSES = ['missing', 'extracted', 'fractured', 'caries', 'resorption', 'periodontal', 'mobility', 'retained', 'treated', 'watch'];

const PROMPT = `You are a veterinary dentistry scribe. Turn the dictation into a dental record and a tooth chart.

Return JSON only:
{
  "species": "canine" | "feline",
  "pet_name": string | null,
  "report": string,
  "teeth": [{ "id": "108", "status": "...", "note": string }]
}

species: SPECIES_RULE

teeth: one entry per tooth that has a finding. Use Modified Triadan numbers: quadrant 1 right maxilla, 2 left maxilla, 3 left mandible, 4 right mandible; 01-03 incisors, 04 canine, 05-08 premolars, 09-11 molars.
Map spoken names to numbers, e.g. "upper right fourth premolar" = 108, "left mandibular first molar" = 309, "one-oh-eight" = 108. Expand ranges like "406 through 410" into each tooth.
status, one of: ${STATUSES.join(', ')}.
- missing: absent and not removed today. extracted: removed in this procedure. fractured: any fracture. caries: carious lesion or cavity. resorption: tooth resorption. periodontal: pockets, bone loss, furcation or recession. mobility: mobile tooth, put the grade in note (e.g. "mobility 2"). retained: retained (persistent) deciduous tooth left in place, charted on the permanent tooth's number (e.g. 504 is charted as 104). treated: restored, root canal, bonded sealant or other treatment kept in place. watch: noted for monitoring.
- If a tooth has several findings, pick the most significant status and put the rest in note.
- note: short clinical detail, e.g. "slab fracture, pulp exposed" or "PD3, mobility 1". Empty string if nothing to add.
- Never include a tooth that was not mentioned. Teeth described as normal are left out.

report: the dental record in plain text, no markdown. Sections, in this order, skipping any with nothing to say:
Dental Procedure Summary (anesthesia, overall oral findings, periodontal stage)
Tooth Findings (one line per tooth, "108: ..." in numeric order)
Radiographs
Treatment (extractions with technique, nerve blocks, closure, other procedures)
Home Care and Follow-up
Section headings go on their own line with no symbols. No asterisks, pound signs or other markdown anywhere.
Only use information that was stated. Rephrase professionally, never invent findings, doses or teeth.`;

const SPECIES_GUESS = 'from the dictation ("dog", "cat", breed, or tooth numbers that only exist in one species). Default "canine" if unclear.';

// The vet picks the species before dictating; guessing is only a fallback for older clients.
async function generateDental(input, chosenSpecies) {
    const fixed = chosenSpecies === 'canine' || chosenSpecies === 'feline' ? chosenSpecies : null;
    const prompt = PROMPT.replace(
        'SPECIES_RULE',
        fixed ? `"${fixed}". The vet chose this; always return it and use ${fixed} Modified Triadan numbering.` : SPECIES_GUESS
    );
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-5.4-mini',
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: input }
            ]
        })
    });
    if (!res.ok) throw new Error(`dental generation failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');

    const species = fixed || (parsed.species === 'feline' ? 'feline' : 'canine');
    const valid = toothSet(species);
    const teeth = {};
    const unmatched = [];
    (Array.isArray(parsed.teeth) ? parsed.teeth : []).forEach((t) => {
        const raw = String(t?.id || '').replace(/\D/g, '');
        // Deciduous quadrants 5-8 sit on the permanent tooth's spot (504 -> 104).
        const id = /^[5-8]\d\d$/.test(raw) ? `${Number(raw[0]) - 4}${raw.slice(1)}` : raw;
        const status = STATUSES.includes(t?.status) ? t.status : 'watch';
        if (!valid.has(id)) {
            unmatched.push({ id, status, note: t?.note || '' });
            return;
        }
        teeth[id] = { status, ...(t.note ? { note: String(t.note).slice(0, 200) } : {}) };
    });

    const name = typeof parsed.pet_name === 'string' ? parsed.pet_name.trim() : '';
    const report = String(parsed.report || '')
        .replace(/\*\*|__/g, '')
        .replace(/^#{1,6}\s*/gm, '')
        .replace(/\s*[\u2014\u2013]\s*/g, ', ')
        .trim();
    return {
        report,
        petName: name && name.toLowerCase() !== 'none' ? name : null,
        dental: { species, teeth, unmatched, version: 1 }
    };
}

module.exports = { generateDental };
