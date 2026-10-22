import { FiClipboard, FiFileText, FiPhone } from 'react-icons/fi';
import { PiTooth } from 'react-icons/pi';
import { normalizeType } from '../utils/cases';

export { BRAND_WASH } from '../brand';

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
    },
    dental: {
        label: 'Dental',
        icon: PiTooth,
        solid: 'bg-violet-500',
        soft: 'bg-violet-50 text-violet-700',
        dot: 'bg-violet-500',
        bar: 'from-violet-500 to-violet-400',
        hover: 'hover:border-violet-200'
    }
};

export const RECORD_TYPES = Object.keys(TYPE_STYLES);

export const typeStyle = (t) => TYPE_STYLES[normalizeType(t)] || TYPE_STYLES.soap;
