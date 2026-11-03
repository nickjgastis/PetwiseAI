import { afterEach, describe, expect, it } from 'vitest';
import { classifyField, classifyLabel, normalizeLabel, registerAdapter } from '../../services/fieldClassifier.js';

const field = (sources, multiline = true) => ({ multiline, sources: Object.entries(sources).map(([kind, text]) => ({ kind, text })) });

describe('normalizeLabel', () => {
    it.each([
        ['Subjective:', 'subjective'],
        ['  Physical   Examination * ', 'physical examination'],
        ['soap_plan', 'soap plan'],
        ['consultSubjective', 'consult subjective'],
        ['Treatment-Plan', 'treatment plan'],
        ['HPI', 'hpi'],
    ])('%s -> %s', (input, out) => expect(normalizeLabel(input)).toBe(out));
});

describe('classifyLabel', () => {
    it.each([
        ['Subjective', 'subjective'],
        ['History', 'subjective'],
        ['HPI', 'subjective'],
        ['History of Present Illness', 'subjective'],
        ['Objective', 'objective'],
        ['Physical Examination', 'objective'],
        ['Physical Exam', 'objective'],
        ['Assessment', 'assessment'],
        ['Clinical Impression', 'assessment'],
        ['Plan', 'plan'],
        ['Treatment Plan', 'plan'],
        ['Assessment notes', 'assessment'],
        ['S - Subjective', 'subjective'],
        ['Plan:', 'plan'],
    ])('%s -> %s', (label, section) => expect(classifyLabel(label)).toEqual({ kind: 'section', section }));

    it.each(['Medical Record', 'SOAP Notes', 'SOAP', 'Medical record notes'])('%s -> full SOAP', (label) => {
        expect(classifyLabel(label)).toEqual({ kind: 'full' });
    });

    it.each(['Billing plan', 'Payment plan', 'Wellness Plan', 'Search patients', 'Insurance notes', 'Estimate'])('%s is ignored', (label) => {
        expect(classifyLabel(label).kind).toBe('ignore');
    });

    it.each([
        ['Discharge Instructions', 'instructions'],
        ['Home care', 'instructions'],
        ['Follow-up', 'nextSteps'],
        ['Next steps', 'nextSteps'],
        ['Recommendations', 'recommendations'],
        ['Treatment', 'treatment'],
    ])('%s -> %s (filled from a SOAP Plan)', (label, section) => expect(classifyLabel(label)).toEqual({ kind: 'section', section }));

    it.each(['Client communication', 'Phone notes', 'Callback notes', 'Visit summary', 'Dental notes'])('%s -> whole record', (label) => {
        expect(classifyLabel(label)).toEqual({ kind: 'full' });
    });

    it.each(['Phone', 'Phone number', 'Billing notes'])('%s is still ignored', (label) => expect(classifyLabel(label).kind).toBe('ignore'));

    it.each(['Pain assessment', 'Medical history', 'Vaccine history', 'Notes', 'Internal comments', 'Medical record number', 'Plan B'])(
        '%s gives no definite answer',
        (label) => expect(classifyLabel(label)).toBeNull()
    );
});

describe('classifyField', () => {
    it('uses the label before weaker sources', () => {
        const result = classifyField(field({ label: 'Plan', placeholder: 'Objective findings', id: 'subjective' }));
        expect(result).toMatchObject({ kind: 'section', section: 'plan', source: 'label' });
    });

    it('falls back to aria-label, aria-labelledby, placeholder, then identifiers', () => {
        expect(classifyField(field({ 'aria-label': 'Treatment Plan' }))).toMatchObject({ section: 'plan', source: 'aria-label' });
        expect(classifyField(field({ 'aria-labelledby': 'Physical Examination' }))).toMatchObject({ section: 'objective' });
        expect(classifyField(field({ placeholder: 'Clinical Impression' }))).toMatchObject({ section: 'assessment', source: 'placeholder' });
        expect(classifyField(field({ id: 'soap_subjective' }))).toMatchObject({ section: 'subjective', source: 'id' });
    });

    it('a negative label wins even when a weaker source looks clinical', () => {
        expect(classifyField(field({ label: 'Billing plan', id: 'plan' })).kind).toBe('ignore');
    });

    it('uses a nearby heading only for multi-line fields', () => {
        expect(classifyField(field({ heading: 'Assessment' }, true))).toMatchObject({ section: 'assessment', source: 'heading' });
        expect(classifyField(field({ heading: 'Assessment' }, false)).kind).toBe('ignore');
    });

    it('offers manual selection for unknown multi-line fields', () => {
        expect(classifyField(field({ label: 'Notes' })).kind).toBe('ambiguous');
        expect(classifyField(field({})).kind).toBe('ambiguous');
        expect(classifyField(field({ label: 'Pain assessment' })).kind).toBe('ambiguous');
    });

    it('ignores unrelated single-line inputs and keeps clinical-sounding ones ambiguous', () => {
        expect(classifyField(field({ label: 'Owner name' }, false)).kind).toBe('ignore');
        expect(classifyField(field({}, false)).kind).toBe('ignore');
        expect(classifyField(field({ label: 'Medical history' }, false)).kind).toBe('ambiguous');
        expect(classifyField(field({ label: 'HPI' }, false))).toMatchObject({ kind: 'section', section: 'subjective' });
    });

    describe('adapters', () => {
        let unregister;
        afterEach(() => unregister?.());

        it('runs a matching PIMS adapter before the generic rules', () => {
            unregister = registerAdapter({
                id: 'test-pims',
                matchesHost: (loc) => loc.hostname === 'pims.example',
                classify: (d) => (d.sources.some((s) => s.text === 'Clinical Notes') ? { kind: 'full' } : null),
            });
            const d = field({ label: 'Clinical Notes' });
            expect(classifyField(d, { location: { hostname: 'pims.example' } })).toMatchObject({ kind: 'full', source: 'adapter:test-pims' });
            expect(classifyField(d, { location: { hostname: 'other.example' } }).kind).toBe('ambiguous');
        });
    });
});
