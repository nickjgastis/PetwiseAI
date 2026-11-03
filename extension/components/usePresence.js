import { useEffect, useState } from 'react';

export const EXIT_MS = 120;

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Keeps a popover mounted for its exit animation after `open` turns false. While closing it should not be
// interactive (the CSS sets pointer-events: none and the element is aria-hidden).
export const usePresence = (open, ms = EXIT_MS) => {
    const [mounted, setMounted] = useState(open);
    useEffect(() => {
        if (open) {
            setMounted(true);
            return undefined;
        }
        if (reducedMotion()) {
            setMounted(false);
            return undefined;
        }
        const timer = setTimeout(() => setMounted(false), ms);
        return () => clearTimeout(timer);
    }, [open, ms]);
    return { mounted: open || mounted, closing: !open && mounted };
};
