import { describe, expect, it } from 'vitest';
import { MOCK_RECORDS } from '../../services/mockRecords.js';
import { matchSectionHeading, SECTION_KEYS, splitSoap } from '../../services/soapSections.js';

const nonBlank = (text) => text.split('\n').filter((l) => l.trim());

// Every non-heading line of the original must land, in order, in the preamble or exactly one section body.
const expectNothingDropped = (text) => {
    const { preamble, sections, headingLines } = splitSoap(text);
    const lines = text.split('\n');
    const expected = lines.filter((l, i) => l.trim() && !headingLines.includes(i));
    const actual = [...nonBlank(preamble), ...SECTION_KEYS.flatMap((k) => nonBlank(sections[k]))];
    expect(actual).toEqual(expected);
};

describe('matchSectionHeading', () => {
    it.each([
        ['**Subjective**', 'subjective'],
        ['**Subjective:**', 'subjective'],
        ['**Plan**:', 'plan'],
        ['## Objective', 'objective'],
        ['### Assessment', 'assessment'],
        ['Assessment:', 'assessment'],
        ['PLAN', 'plan'],
        ['S - Subjective', 'subjective'],
        ['O: Objective', 'objective'],
        ['  plan  ', 'plan'],
    ])('%s is a %s heading', (line, key) => {
        expect(matchSectionHeading(line)).toBe(key);
    });

    it.each([
        'Plan to recheck in 2 weeks.',
        'Planned dental prophylaxis deferred.',
        'Assessment of hydration: 5%',
        'Subjective history unremarkable',
        '**Treatment:**',
        'Diagnosis:',
        'a plan',
        '#108: Slab fracture',
    ])('%s is not a heading', (line) => {
        expect(matchSectionHeading(line)).toBeNull();
    });
});

describe('splitSoap', () => {
    it('splits the current generator format with bold headings', () => {
        const { sections, found } = splitSoap(MOCK_RECORDS[0].reportText);
        expect(found).toEqual(SECTION_KEYS);
        expect(sections.subjective.startsWith('**Presenting Complaint:**')).toBe(true);
        expect(sections.objective).toContain('Temperature: 102.6 F');
        expect(sections.plan).toContain('Maropitant (Cerenia) 1 mg/kg SQ once in clinic');
    });

    it('drops the repeated Assessment sub-heading but keeps everything under it', () => {
        const { sections } = splitSoap(MOCK_RECORDS[0].reportText);
        expect(sections.assessment.startsWith('Acute vomiting most consistent')).toBe(true);
        expect(sections.assessment).toContain('**Diagnosis:**');
        expect(sections.assessment).toContain('DDx: Dietary indiscretion, Pancreatitis, Gastrointestinal foreign body');
    });

    it('does not split Assessment on a body line starting with "Planned" or "Plan to"', () => {
        const bella = splitSoap(MOCK_RECORDS[0].reportText).sections;
        expect(bella.assessment).toContain('Planned dental prophylaxis deferred until GI signs resolve.');
        const max = splitSoap(MOCK_RECORDS[1].reportText).sections;
        expect(max.assessment).toContain('Plan to reassess stability under sedation if owner declines referral.');
        expect(max.plan.startsWith('**Treatment:**')).toBe(true);
    });

    it('keeps V/D/C/S content in Subjective', () => {
        const bella = splitSoap(MOCK_RECORDS[0].reportText).sections;
        expect(bella.subjective).toContain('**V/D/C/S:**');
        expect(bella.subjective).toContain('Vomiting: 4 episodes in 24 hours');
        expect(bella.subjective).toContain('Diarrhea: 1 episode of soft stool this morning.');
        const milo = splitSoap(MOCK_RECORDS[4].reportText).sections;
        expect(milo.subjective).toContain('Coughing: Soft, moist cough several times nightly');
        expect(milo.subjective).toContain('Sneezing: Rare.');
    });

    it('handles markdown, plain-colon, letter-prefixed and uppercase heading styles', () => {
        MOCK_RECORDS.forEach((r) => expect(splitSoap(r.reportText).found).toEqual(SECTION_KEYS));
        expect(splitSoap(MOCK_RECORDS[2].reportText).sections.objective).toContain('#108: Slab fracture with pulp exposure');
        expect(splitSoap(MOCK_RECORDS[3].reportText).sections.assessment).toContain('Acute Colitis');
    });

    it('keeps text before the first heading as a preamble', () => {
        const { preamble } = splitSoap(MOCK_RECORDS[4].reportText);
        expect(preamble).toBe('Patient: Milo, 9 y MN Cavalier King Charles Spaniel\nVisit: Medical consultation');
    });

    it.each(MOCK_RECORDS.map((r) => [r.patientName, r.reportText]))('drops no lines from %s', (_, text) => {
        expectNothingDropped(text);
    });

    it('keeps a repeated heading as body text once its section has content', () => {
        const text = 'Assessment:\nStable.\nAssessment:\nRecheck values.\nPlan:\nContinue.';
        const { sections } = splitSoap(text);
        expect(sections.assessment).toBe('Stable.\nAssessment:\nRecheck values.');
        expectNothingDropped(text);
    });

    it('does not let a late out-of-order heading reopen an earlier section', () => {
        const text = 'Subjective:\nA\nObjective:\nB\nSubjective:\nC';
        const { sections } = splitSoap(text);
        expect(sections.subjective).toBe('A');
        expect(sections.objective).toBe('B\nSubjective:\nC');
        expectNothingDropped(text);
    });

    it('returns empty sections for unstructured text', () => {
        const { sections, found, preamble } = splitSoap('Vomiting x2, BAR, recheck tomorrow.');
        expect(found).toEqual([]);
        expect(sections.subjective).toBe('');
        expect(preamble).toBe('Vomiting x2, BAR, recheck tomorrow.');
    });

    it('normalizes Windows line endings', () => {
        expect(splitSoap('Plan:\r\nRecheck.\r\n').sections.plan).toBe('Recheck.');
    });
});
