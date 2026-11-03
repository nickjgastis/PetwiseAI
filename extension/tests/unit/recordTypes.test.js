import { describe, expect, it } from 'vitest';
import { MOCK_OTHER_RECORDS } from '../../services/mockRecords.js';
import { toPlainText } from '../../services/petwiseText.js';
import { resolveSection, sectionLabel, splitRecord } from '../../services/recordTypes.js';
import { formatRecord } from '../../services/soapFormatter.js';

const byId = (id) => MOCK_OTHER_RECORDS.find((r) => r.id === id);

describe('splitRecord for non-SOAP types', () => {
    it('splits a Callback into call summary, instructions and next steps, without the title and sign-off', () => {
        const s = splitRecord(byId('mock-bella-callback').reportText, 'callback');
        expect(s.callSummary).toMatch(/^The clinician called the owner/);
        expect(s.callSummary).toContain('2. Appetite and Hydration:');
        expect(s.callSummary).not.toMatch(/Client Communication Report|Patient:/);
        expect(s.instructions).toMatch(/^1\. Continue the low-fat/);
        expect(s.nextSteps).toMatch(/^No recheck needed/);
        expect(s.nextSteps).not.toMatch(/End of Report|serves as documentation/);
        expect(s.recommendations).toBe('');
    });

    it('puts the opening paragraph and numbered findings of a Summary under Overview', () => {
        const s = splitRecord(byId('mock-max-summary').reportText, 'summary');
        expect(s.overview).toMatch(/^Max was examined/);
        expect(s.overview).toContain('2. Diagnosis:');
        expect(s.treatment).toMatch(/^- Carprofen/);
        expect(s.recommendations).toMatch(/^Strict leash-only/);
    });

    it('splits a Dental record on the headings server/dental.js writes', () => {
        const s = splitRecord(byId('mock-luna-dental').reportText, 'dental');
        expect(s.procedure).toMatch(/^General anesthesia/);
        expect(s.teeth.split('\n')).toEqual(['108: Slab fracture with pulp exposure. Extracted.', '307: Type 1 tooth resorption. Extracted.', '409: PD3 on the distal root.']);
        expect(s.radiographs).toMatch(/^108: Periapical/);
        expect(s.treatment).toMatch(/^Infraorbital/);
        expect(s.homeCare).toMatch(/^Soft food/);
    });

    it('Full is exactly the PetWise Copy all text for that type', () => {
        MOCK_OTHER_RECORDS.forEach((r) => expect(formatRecord(r).full).toBe(toPlainText(r.reportText, r.recordType)));
    });
});

describe('resolveSection', () => {
    it('maps a field section onto what the record type has', () => {
        expect(resolveSection('soap', 'plan')).toBe('plan');
        expect(resolveSection('soap', 'treatment')).toBe('plan');
        expect(resolveSection('dental', 'instructions')).toBe('homeCare');
        expect(resolveSection('summary', 'nextSteps')).toBe('recommendations');
        expect(resolveSection('callback', 'subjective')).toBeNull();
        expect(resolveSection('callback', 'full')).toBe('full');
    });

    it('labels sections for the record type, and missing ones by their usual name', () => {
        expect(sectionLabel('soap', 'full')).toBe('Full SOAP');
        expect(sectionLabel('callback', 'full')).toBe('Full Callback');
        expect(sectionLabel('dental', 'instructions')).toBe('Home care');
        expect(sectionLabel('callback', 'subjective')).toBe('Subjective');
    });
});
