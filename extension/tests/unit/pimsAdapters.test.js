import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { describeField } from '../../services/fieldDetector.js';
import { classifyField } from '../../services/fieldClassifier.js';
import { registerPimsAdapters } from '../../services/pimsAdapters.js';

const EZYVET = { hostname: 'crystalriver.use1.ezyvet.com' };

const editor = (section) => `
    <div id="${section}-lexical-container-header">
        <div class="lexical-editor-container">
            <div class="lexical-editor-input" data-section="${section}" contenteditable="true" role="textbox"></div>
        </div>
    </div>`;

describe('ezyVet adapter', () => {
    beforeAll(() => {
        registerPimsAdapters();
        document.body.innerHTML = ['history', 'physical-exam', 'assessment', 'plan', 'unknown'].map(editor).join('');
    });
    afterAll(() => {
        document.body.innerHTML = '';
    });

    const classify = (id, location = EZYVET) => classifyField(describeField(document.querySelector(`[data-section="${id}"]`)), { location });

    it('maps the Lexical editors to SOAP sections by their wrapper id', () => {
        expect(classify('history')).toMatchObject({ kind: 'section', section: 'subjective', source: 'adapter:ezyvet' });
        expect(classify('physical-exam')).toMatchObject({ kind: 'section', section: 'objective' });
        expect(classify('assessment')).toMatchObject({ kind: 'section', section: 'assessment' });
        expect(classify('plan')).toMatchObject({ kind: 'section', section: 'plan' });
    });

    it('falls back to the generic rules for other editors and other sites', () => {
        expect(classify('unknown')).toMatchObject({ kind: 'ambiguous' });
        expect(classify('history', { hostname: 'example.com' })).toMatchObject({ kind: 'ambiguous' });
    });
});
