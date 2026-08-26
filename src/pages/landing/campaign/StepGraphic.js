import React from 'react';

const Shell = ({ children }) => (
    <div className="aspect-[16/10] bg-gradient-to-br from-[#eaf4fc] to-[#cfe0f4] flex items-center justify-center px-6">
        {children}
    </div>
);

const Mic = ({ cx, cy, fill = '#1a2b4a' }) => (
    <g>
        <rect x={cx - 6} y={cy - 14} width="12" height="18" rx="6" fill={fill} />
        <path
            d={`M${cx - 12} ${cy + 2}c0 8 5 14 12 14s12-6 12-14`}
            fill="none"
            stroke={fill}
            strokeWidth="2.5"
            strokeLinecap="round"
        />
        <line x1={cx} y1={cy + 16} x2={cx} y2={cy + 22} stroke={fill} strokeWidth="2.5" strokeLinecap="round" />
        <line x1={cx - 8} y1={cy + 22} x2={cx + 8} y2={cy + 22} stroke={fill} strokeWidth="2.5" strokeLinecap="round" />
    </g>
);

const OpenSvg = () => (
    <svg viewBox="0 0 160 140" className="w-[72%] max-w-[200px] h-auto" aria-hidden>
        <rect x="48" y="6" width="64" height="118" rx="14" fill="white" stroke="#1a2b4a" strokeWidth="3" />
        <rect x="48" y="6" width="64" height="22" rx="14" fill="#3468bd" />
        <rect x="48" y="18" width="64" height="10" fill="#3468bd" />
        <circle cx="58" cy="17" r="4" fill="#5cccf0" />
        <rect x="66" y="14" width="32" height="6" rx="2" fill="white" opacity="0.9" />
        <circle cx="80" cy="66" r="22" fill="#5cccf0" />
        <circle cx="80" cy="66" r="22" fill="none" stroke="#1a2b4a" strokeWidth="3" />
        <rect x="74" y="54" width="12" height="16" rx="6" fill="#1a2b4a" />
        <path d="M70 66c0 6 4.5 10 10 10s10-4 10-10" fill="none" stroke="#1a2b4a" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="80" y1="76" x2="80" y2="80" stroke="#1a2b4a" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="74" y="112" width="12" height="4" rx="2" fill="#1a2b4a" opacity="0.18" />
    </svg>
);

const ListenSvg = () => (
    <svg viewBox="0 0 160 140" className="w-[86%] max-w-[240px] h-auto" aria-hidden>
        <circle cx="80" cy="58" r="30" fill="#5cccf0" />
        <circle cx="80" cy="58" r="30" fill="none" stroke="#1a2b4a" strokeWidth="3" />
        <Mic cx={80} cy={56} fill="#1a2b4a" />
        <path d="M38 48c-10 6-10 20 0 26" fill="none" stroke="#3468bd" strokeWidth="3" strokeLinecap="round" />
        <path d="M28 40c-16 10-16 36 0 46" fill="none" stroke="#3468bd" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
        <path d="M122 48c10 6 10 20 0 26" fill="none" stroke="#3468bd" strokeWidth="3" strokeLinecap="round" />
        <path d="M132 40c16 10 16 36 0 46" fill="none" stroke="#3468bd" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
        <rect x="50" y="108" width="8" height="16" rx="2" fill="#3468bd" />
        <rect x="62" y="100" width="8" height="24" rx="2" fill="#5cccf0" />
        <rect x="74" y="92" width="8" height="32" rx="2" fill="#1a2b4a" />
        <rect x="86" y="100" width="8" height="24" rx="2" fill="#5cccf0" />
        <rect x="98" y="108" width="8" height="16" rx="2" fill="#3468bd" />
    </svg>
);

const RecordSvg = () => (
    <svg viewBox="0 0 180 140" className="w-[88%] max-w-[250px] h-auto" aria-hidden>
        <rect x="38" y="16" width="104" height="108" rx="10" fill="white" stroke="#1a2b4a" strokeWidth="3" />
        <rect x="38" y="16" width="104" height="22" rx="10" fill="#3468bd" />
        <rect x="38" y="28" width="104" height="10" fill="#3468bd" />
        <circle cx="128" cy="27" r="7" fill="#5cccf0" />
        <path d="M125 27l2.2 2.2 4.4-4.4" fill="none" stroke="#1a2b4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="50" y="48" width="36" height="12" rx="3" fill="#3468bd" />
        <rect x="50" y="66" width="80" height="6" rx="3" fill="#d7e4f4" />
        <rect x="50" y="78" width="68" height="6" rx="3" fill="#d7e4f4" />
        <rect x="50" y="94" width="36" height="12" rx="3" fill="#5cccf0" />
        <rect x="50" y="112" width="80" height="6" rx="3" fill="#d7e4f4" />
    </svg>
);

const StepGraphic = ({ n }) => {
    if (n === '2') return <Shell><ListenSvg /></Shell>;
    if (n === '3') return <Shell><RecordSvg /></Shell>;
    return <Shell><OpenSvg /></Shell>;
};

export default StepGraphic;
