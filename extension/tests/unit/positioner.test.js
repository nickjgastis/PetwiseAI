import { describe, expect, it } from 'vitest';
import { placeChip, rectInViewport } from '../../services/positioner.js';

const SIZE = { width: 300, height: 40 };
const VIEW = { width: 1200, height: 800 };
const field = (top, height = 200) => ({ left: 400, right: 900, top, bottom: top + height, width: 500, height });

describe('placeChip', () => {
    it('prefers above, then below, then inside a field taller than the viewport', () => {
        expect(placeChip(field(300), SIZE, VIEW).placement).toBe('above');
        expect(placeChip(field(20), SIZE, VIEW).placement).toBe('below');
        expect(placeChip(field(-100, 1000), SIZE, VIEW)).toMatchObject({ placement: 'inside', top: 4 });
    });

    it('does not flip back and forth while scrolling near the top edge', () => {
        // 46px above the field fits exactly at top 50; once below, it needs 24px more before moving back up.
        expect(placeChip(field(49), SIZE, VIEW, 6, null).placement).toBe('below');
        expect(placeChip(field(60), SIZE, VIEW, 6, 'below').placement).toBe('below');
        expect(placeChip(field(80), SIZE, VIEW, 6, 'below').placement).toBe('above');
        expect(placeChip(field(52), SIZE, VIEW, 6, 'above').placement).toBe('above');
    });

    it('keeps an inside chip within the visible part of the field', () => {
        const pos = placeChip({ left: 400, right: 900, top: -900, bottom: 30, width: 500, height: 930 }, SIZE, { width: 1200, height: 60 });
        expect(pos.placement).toBe('inside');
        expect(pos.top).toBeLessThanOrEqual(30 - SIZE.height);
    });
});

describe('rectInViewport', () => {
    const box = (el, r) => {
        el.getBoundingClientRect = () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top });
        return el;
    };

    it('trims an editor taller than its scroll box to the part that is showing', () => {
        document.body.innerHTML = '<div id="scroller" style="overflow-y: auto"><div id="editor" contenteditable></div></div>';
        box(document.getElementById('scroller'), { left: 100, right: 700, top: 400, bottom: 600 });
        const editor = box(document.getElementById('editor'), { left: 100, right: 700, top: -300, bottom: 600 });
        const { rect, visible } = rectInViewport(editor, window);
        expect(visible).toBe(true);
        expect(rect).toMatchObject({ top: 400, bottom: 600, height: 200 });
    });

    it('is not visible once its scroll box has scrolled it away', () => {
        document.body.innerHTML = '<div id="scroller" style="overflow: hidden"><textarea id="field"></textarea></div>';
        box(document.getElementById('scroller'), { left: 0, right: 500, top: 0, bottom: 100 });
        const el = box(document.getElementById('field'), { left: 0, right: 500, top: 150, bottom: 250 });
        expect(rectInViewport(el, window).visible).toBe(false);
    });
});
