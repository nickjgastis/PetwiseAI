const intersect = (a, b) => ({
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
});

const isEmpty = (r) => r.right <= r.left || r.bottom <= r.top;

const CLIPS = /(auto|scroll|hidden|clip)/;

// Ancestors that cut the element off, e.g. a chat composer whose editor grows taller than its scroll box. Cached per
// element: computed styles are read once per focus, not on every scroll frame.
const clipCache = new WeakMap();
const clippingAncestors = (el) => {
    if (clipCache.has(el)) return clipCache.get(el);
    const win = el.ownerDocument.defaultView;
    const list = [];
    for (let node = el.parentElement; node && node !== el.ownerDocument.documentElement; node = node.parentElement) {
        const s = win.getComputedStyle(node);
        if (CLIPS.test(`${s.overflow} ${s.overflowX} ${s.overflowY}`)) list.push(node);
    }
    clipCache.set(el, list);
    return list;
};

// The element's box in the coordinates of `topWin`'s viewport, walking up through same-origin iframes, trimmed to
// the part its scroll containers show. `visible` is false when it is scrolled out of view anywhere on the way up.
export const rectInViewport = (el, topWin) => {
    const r = el.getBoundingClientRect();
    let rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    for (const box of clippingAncestors(el)) rect = intersect(rect, box.getBoundingClientRect());
    if (isEmpty(rect)) return { rect: { ...rect, width: 0, height: 0 }, visible: false };
    let win = el.ownerDocument.defaultView;
    let visible = intersect(rect, { left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight });

    while (win && win !== topWin) {
        const frame = win.frameElement;
        if (!frame) return null;
        const fr = frame.getBoundingClientRect();
        const dx = fr.left + frame.clientLeft;
        const dy = fr.top + frame.clientTop;
        rect = { left: rect.left + dx, top: rect.top + dy, right: rect.right + dx, bottom: rect.bottom + dy };
        visible = { left: visible.left + dx, top: visible.top + dy, right: visible.right + dx, bottom: visible.bottom + dy };
        win = win.parent;
        visible = intersect(visible, { left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight });
    }

    return {
        rect: { ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top },
        visible: !isEmpty(visible),
    };
};

const MARGIN = 4;

// Extra room a side needs before the chip moves back to it, so scrolling near an edge doesn't flip it every frame.
const HYSTERESIS = 24;

// Above the field's top-right corner, so it never covers the typing area; below when there is no room above.
// Only a field taller than the viewport gets the control drawn over its top edge, held inside the field.
// `previous` is the last placement: the chip stays put while it still fits there.
export const placeChip = (rect, size, viewport, gap = 6, previous = null) => {
    const left = Math.max(MARGIN, Math.min(rect.right - size.width, viewport.width - size.width - MARGIN));
    const above = rect.top - size.height - gap;
    const below = rect.bottom + gap;
    const spots = {
        above: { top: above, fits: (slack) => above >= MARGIN + slack },
        below: { top: below, fits: (slack) => below + size.height <= viewport.height - MARGIN - slack },
    };
    const at = (placement) => ({ top: spots[placement].top, left, placement });

    // Stay while it still fits; otherwise move to the first spot with room to spare.
    if (spots[previous]?.fits(0)) {
        const better = Object.keys(spots).find((p) => p !== previous && spots[p].fits(HYSTERESIS));
        return at(better === 'above' ? better : previous);
    }
    const slack = previous ? HYSTERESIS : 0;
    const next = Object.keys(spots).find((p) => spots[p].fits(slack));
    if (next) return at(next);
    if (previous !== 'inside') {
        const any = Object.keys(spots).find((p) => spots[p].fits(0));
        if (any) return at(any);
    }
    const inside = Math.min(Math.max(MARGIN, rect.top + MARGIN), Math.max(rect.top, rect.bottom - size.height - MARGIN));
    return { top: inside, left: Math.max(MARGIN, left - MARGIN), placement: 'inside' };
};
