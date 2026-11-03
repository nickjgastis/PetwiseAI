const VIEWPORT_MARGIN = 8;
const GAP = 6;
const MIN_HEIGHT = 160;

// The SmartPaste control is position: fixed, so page scrolling can never reveal an off-screen popover. Open it
// towards the side of the control with more room and cap its height to what fits; it scrolls internally beyond that.
export const fitPopover = (el) => {
    const anchor = el?.parentElement?.getBoundingClientRect();
    if (!anchor) return;
    const viewportHeight = el.ownerDocument.defaultView.innerHeight;
    const below = viewportHeight - anchor.bottom - VIEWPORT_MARGIN - GAP;
    const above = anchor.top - VIEWPORT_MARGIN - GAP;
    el.style.maxHeight = 'none';
    const natural = el.scrollHeight;
    const up = natural > below && above > below;
    el.classList.toggle('is-up', up);
    el.style.maxHeight = `${Math.max(MIN_HEIGHT, Math.floor(up ? above : below))}px`;
};
