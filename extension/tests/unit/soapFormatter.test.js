import { describe, expect, it } from 'vitest';
import { MOCK_RECORDS } from '../../services/mockRecords.js';
import { toPlainText } from '../../services/petwiseText.js';
import { formatRecord, recordLabel } from '../../services/soapFormatter.js';
import { SECTION_KEYS, splitSoap } from '../../services/soapSections.js';

const tokens = (text) => text.replace(/\*\*/g, '').match(/[A-Za-z0-9#%/.<>+-]+/g) || [];

describe('formatRecord', () => {
    it('Full SOAP is exactly the PetWise Copy all output', () => {
        MOCK_RECORDS.forEach((r) => expect(formatRecord(r).full).toBe(toPlainText(r.reportText, 'soap')));
    });

    it('Full SOAP for Bella reads like the editor copy', () => {
        const full = formatRecord(MOCK_RECORDS[0]).full;
        expect(full.startsWith('Subjective\n\nPresenting Complaint:\nAcute vomiting')).toBe(true);
        expect(full).toContain('\n\nObjective\n\nVital Signs:\nTemperature: 102.6 F');
        // Copy all collapses the repeated "Assessment" / "Assessment:" pair into one section heading.
        expect(full).toContain('\n\nAssessment\nAcute vomiting most consistent');
        expect(full).not.toContain('Assessment:\n');
        expect(full).toContain('\n\nPlan\n\nTreatment:\nMaropitant');
        expect(full).not.toContain('**');
    });

    it('section text has no markdown and no section heading of its own', () => {
        const content = formatRecord(MOCK_RECORDS[0]);
        expect(content.subjective.startsWith('Presenting Complaint:\nAcute vomiting of 24 hours duration')).toBe(true);
        expect(content.assessment.startsWith('Acute vomiting most consistent')).toBe(true);
        SECTION_KEYS.forEach((k) => expect(content[k]).not.toContain('**'));
    });

    it.each(MOCK_RECORDS.map((r) => [r.patientName, r]))('keeps every clinical token of %s in its section text', (_, record) => {
        const { sections } = splitSoap(record.reportText);
        const content = formatRecord(record);
        SECTION_KEYS.forEach((k) => {
            const out = tokens(content[k]);
            tokens(sections[k]).forEach((t) => expect(out).toContain(t));
        });
    });

    it('keeps a leading "#" on tooth numbers (fixed in src/utils/recordText.js)', () => {
        const luna = formatRecord(MOCK_RECORDS[2]);
        expect(luna.objective).toContain('#108: Slab fracture with pulp exposure');
        expect(luna.objective).toContain('#307: Type 1 tooth resorption');
        expect(luna.full).toContain('#108: Slab fracture with pulp exposure');
    });

    it('still strips real markdown headings', () => {
        expect(toPlainText('## Notes\nBright and alert.\n## End', 'soap')).not.toContain('#');
    });

    it('returns empty sections for a record without SOAP headings', () => {
        const content = formatRecord({ reportText: 'Vaccines given, no concerns.' });
        expect(content.subjective).toBe('');
        expect(content.full).toBe('Vaccines given, no concerns.');
    });

    it('labels records as "Name · Title" without an em dash', () => {
        expect(recordLabel(MOCK_RECORDS[0])).toBe('Bella \u00b7 Vomiting');
        expect(recordLabel(MOCK_RECORDS[0])).not.toMatch(/\u2014/);
    });
});
