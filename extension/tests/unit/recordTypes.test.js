import { describe, expect, it } from 'vitest';
import { MOCK_OTHER_RECORDS, MOCK_RECORDS } from '../../services/mockRecords.js';
import { toPlainText } from '../../services/petwiseText.js';
import { resolveSection, sectionLabel } from '../../services/recordTypes.js';
import { formatRecord } from '../../services/soapFormatter.js';

describe('record types', () => {
    it('only SOAP is split; Summary, Callback and Dental are one block, exactly the PetWise Copy all text', () => {
        expect(Object.keys(formatRecord(MOCK_RECORDS[0]))).toEqual(['full', 'subjective', 'objective', 'assessment', 'plan']);
        MOCK_OTHER_RECORDS.forEach((r) => expect(formatRecord(r)).toEqual({ full: toPlainText(r.reportText, r.recordType) }));
    });

    it('a single-block record pastes whole whatever the field asks for', () => {
        ['summary', 'callback', 'dental'].forEach((type) => {
            expect(resolveSection(type, 'subjective')).toBe('full');
            expect(resolveSection(type, 'plan')).toBe('full');
            expect(resolveSection(type, 'full')).toBe('full');
        });
    });

    it('maps SOAP fields, including Plan-like ones', () => {
        expect(resolveSection('soap', 'plan')).toBe('plan');
        expect(resolveSection('soap', 'treatment')).toBe('plan');
        expect(resolveSection('soap', 'instructions')).toBe('plan');
        expect(resolveSection('soap', null)).toBeNull();
    });

    it('labels: "Full SOAP" for a whole SOAP, just the type for the others', () => {
        expect(sectionLabel('soap', 'full')).toBe('Full SOAP');
        expect(sectionLabel('soap', 'treatment')).toBe('Plan');
        expect(sectionLabel('callback', 'subjective')).toBe('Callback');
        expect(sectionLabel('dental', 'full')).toBe('Dental');
    });
});
