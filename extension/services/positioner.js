const intersect = (a, b) => ({
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
});

const isEmpty = (r) => r.right <= r.left || r.bottom <= r.top;

// The element's box in the coordinates of `topWin`'s viewport, walking up through same-origin iframes.
// `visible` is false when the element is scrolled out of view in any frame on the way up.
export const rectInViewport = (el, topWin) => {
    const r = el.getBoundingClientRect();
    let rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
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

// Above the field's top-right corner, so it never covers the typing area; below when there is no room above.
// Only a field taller than the viewport gets the control drawn over its top edge.
export const placeChip = (rect, size, viewport, gap = 6) => {
    const left = Math.max(MARGIN, Math.min(rect.right - size.width, viewport.width - size.width - MARGIN));
    if (rect.top - size.height - gap >= MARGIN) return { top: rect.top - size.height - gap, left, placement: 'above' };
    if (rect.bottom + gap + size.height <= viewport.height - MARGIN) return { top: rect.bottom + gap, left, placement: 'below' };
    return { top: Math.max(MARGIN, rect.top + MARGIN), left: Math.max(MARGIN, left - MARGIN), placement: 'inside' };
};
