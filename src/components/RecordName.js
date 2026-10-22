import React, { useState } from 'react';
import { FiEdit2 } from 'react-icons/fi';
import { displayRecordName } from '../utils/cases';

const TONES = {
    onColor: {
        dot: 'bg-white/45',
        text: 'text-white/90',
        hover: 'hover:bg-white/15',
        icon: 'text-white/70',
        input: 'bg-white/15 text-white placeholder:text-white/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]'
    },
    plain: {
        dot: 'bg-[#1a2b4a]/25',
        text: 'text-[#1a2b4a]/70 hover:text-[#13233f]',
        hover: 'hover:bg-[#eef2f8]',
        icon: 'text-[#1a2b4a]/45',
        input: 'bg-white text-[#13233f] placeholder:text-[#1a2b4a]/40 shadow-[inset_0_0_0_1px_#d6e3f7]'
    }
};

const BOX = 'h-7 px-2 rounded-md text-[13px] leading-7 font-medium';

// Dot separator plus the record name, click to rename. Shows the cleaned-up name; edits the raw one.
const RecordName = ({ name, onChange, tone = 'plain' }) => {
    const [editing, setEditing] = useState(false);
    const t = TONES[tone];
    const label = displayRecordName(name) || 'Name this record';

    return (
        <span className="min-w-0 inline-flex items-center gap-2" style={{ fontFamily: 'var(--font-sans)' }}>
            <span className={`shrink-0 w-1 h-1 rounded-full ${t.dot}`} />
            {editing ? (
                <span className="min-w-0 inline-grid">
                    <span aria-hidden className={`${BOX} invisible whitespace-pre overflow-hidden [grid-area:1/1] pr-[26px]`}>{name || 'Name this record'}</span>
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => onChange(e.target.value)}
                        onBlur={() => setEditing(false)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && setEditing(false)}
                        onFocus={(e) => e.target.select()}
                        placeholder="Name this record"
                        className={`${BOX} sm:!text-[13px] [grid-area:1/1] min-w-0 w-full border-none focus:outline-none ${t.input}`}
                        style={{ fontFamily: 'inherit' }}
                    />
                </span>
            ) : (
                <button
                    type="button"
                    onClick={() => setEditing(true)}
                    title="Rename"
                    className={`${BOX} group min-w-0 inline-flex items-center gap-1.5 border-none bg-transparent cursor-text transition-colors ${t.text} ${t.hover}`}
                    style={{ fontFamily: 'inherit' }}
                >
                    <span className="truncate">{label}</span>
                    <FiEdit2 className={`shrink-0 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity ${t.icon}`} />
                </button>
            )}
        </span>
    );
};

export default RecordName;
