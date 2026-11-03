import { beforeEach, describe, expect, it } from 'vitest';
import { describeField, fieldDisplayName, ineligibleReason, isEligible, resolveEditable } from '../../services/fieldDetector.js';

const $ = (sel) => document.querySelector(sel);

beforeEach(() => {
    document.body.innerHTML = `
        <label for="s">Subjective</label><textarea id="s"></textarea>
        <label>History <textarea id="wrapped">old value text</textarea></label>
        <input id="text" type="text" />
        <input id="plain" />
        <input id="search" type="search" />
        <input id="pw" type="password" />
        <input id="hidden" type="hidden" />
        <input id="email" type="email" />
        <textarea id="ro" readonly></textarea>
        <textarea id="dis" disabled></textarea>
        <fieldset disabled><textarea id="fs"></textarea></fieldset>
        <div id="ce" contenteditable="true" aria-label="Physical Examination"><p id="inner">x</p></div>
        <div contenteditable="false" id="nce">x</div>
        <div id="ce-ro" contenteditable="true" aria-readonly="true"></div>
        <section><h3>Assessment</h3><div><textarea id="under-heading"></textarea></div></section>
        <span id="lbl">Treatment Plan</span><textarea id="lb" aria-labelledby="lbl"></textarea>
        <petwise-smartpaste><textarea id="own"></textarea></petwise-smartpaste>
    `;
});

describe('resolveEditable', () => {
    it('returns inputs and textareas themselves', () => {
        expect(resolveEditable($('#s'))).toBe($('#s'));
    });

    it('returns the outermost contenteditable host for a nested node', () => {
        expect(resolveEditable($('#inner'))).toBe($('#ce'));
        expect(resolveEditable($('#inner').firstChild)).toBe($('#ce'));
    });

    it('returns null for non-editable elements', () => {
        expect(resolveEditable($('#nce'))).toBeNull();
        expect(resolveEditable(document.body)).toBeNull();
    });
});

describe('eligibility', () => {
    it.each(['#s', '#text', '#plain', '#ce', '#under-heading'])('%s is eligible', (sel) => {
        expect(ineligibleReason($(sel))).toBeNull();
    });

    it.each(['#search', '#pw', '#hidden', '#email', '#ro', '#dis', '#fs', '#ce-ro', '#own'])('%s is not eligible', (sel) => {
        expect(isEligible($(sel))).toBe(false);
    });

    it('rejects detached and null targets', () => {
        const el = $('#s');
        el.remove();
        expect(ineligibleReason(el)).toBe('detached');
        expect(isEligible(null)).toBe(false);
    });
});

describe('describeField', () => {
    const text = (el, kind) => describeField(el).sources.find((s) => s.kind === kind)?.text;

    it('reads the associated label', () => {
        expect(text($('#s'), 'label')).toBe('Subjective');
    });

    it('excludes the wrapped textarea value from a wrapping label', () => {
        expect(text($('#wrapped'), 'label')).toBe('History');
    });

    it('reads aria-label, aria-labelledby and nearby headings', () => {
        expect(text($('#ce'), 'aria-label')).toBe('Physical Examination');
        expect(text($('#lb'), 'aria-labelledby')).toBe('Treatment Plan');
        expect(text($('#under-heading'), 'heading')).toBe('Assessment');
    });

    it('marks inputs single-line and others multi-line', () => {
        expect(describeField($('#text')).multiline).toBe(false);
        expect(describeField($('#ce')).multiline).toBe(true);
    });

    it('never borrows the label of a neighbouring field as a heading', () => {
        expect(text($('#plain'), 'heading')).toBeUndefined();
        expect(text($('#text'), 'heading')).toBeUndefined();
    });

    it('gives a readable field name', () => {
        expect(fieldDisplayName(describeField($('#s')))).toBe('Subjective');
        expect(fieldDisplayName(describeField($('#plain')))).toBe('plain');
    });
});
