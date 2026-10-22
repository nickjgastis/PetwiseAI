import { FiClipboard, FiFileText, FiPhone } from 'react-icons/fi';
import { normalizeType } from '../utils/cases';

// The sidebar's background. Keep it to a few feature panels so it stays a brand accent, not wallpaper.
export const BRAND_WASH = 'bg-gradient-to-br from-[#eaf2fd] via-[#f3f7fd] to-[#e3edfb]';

export const GRADIENT_TEXT = 'font-display bg-gradient-to-r from-[#3f7ad6] via-[#2d5fb8] to-[#1e4a94] bg-clip-text text-transparent';

// Note-type colors, shared by the New case picker, the Cases pages and the case picker.
export const TYPE_STYLES = {
    soap: {
        label: 'SOAP',
        icon: FiClipboard,
        solid: 'bg-blue-500',
        soft: 'bg-blue-50 text-blue-700',
        dot: 'bg-blue-500',
        bar: 'from-blue-500 to-blue-400',
        hover: 'hover:border-blue-200'
    },
    summary: {
        label: 'Summary',
        icon: FiFileText,
        solid: 'bg-emerald-500',
        soft: 'bg-emerald-50 text-emerald-700',
        dot: 'bg-emerald-500',
        bar: 'from-emerald-500 to-emerald-400',
        hover: 'hover:border-emerald-200'
    },
    callback: {
        label: 'Callback',
        icon: FiPhone,
        solid: 'bg-amber-500',
        soft: 'bg-amber-50 text-amber-700',
        dot: 'bg-amber-500',
        bar: 'from-amber-500 to-amber-400',
        hover: 'hover:border-amber-200'
    }
};

export const typeStyle = (t) => TYPE_STYLES[normalizeType(t)] || TYPE_STYLES.soap;
