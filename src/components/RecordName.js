import React, { useState } from 'react';
import { FiEdit2 } from 'react-icons/fi';
import { displayRecordName } from '../utils/cases';

const TONES = {
    onColor: {
        text: 'text-white/90 hover:bg-white/15',
        icon: 'text-white/70',
        input: 'bg-white/15 text-white placeholder:text-white/60 focus:bg-white/20'
    },
    plain: {
        text: 'text-[#1a2b4a]/70 hover:bg-[#eef2f8] hover:text-[#13233f]',
        icon: 'text-[#1a2b4a]/45',
        input: 'bg-white border border-[#d6e3f7] text-[#13233f] placeholder:text-[#1a2b4a]/40'
    }
};

// Record name for a card header, click to rename. Shows the cleaned-up name; edits the raw one.
const RecordName = ({ name, onChange, tone = 'plain' }) => {
    const [editing, setEditing] = useState(false);
    const t = TONES[tone];
    const FONT = { fontFamily: 'var(--font-sans)' };

    if (editing) {
        return (
            <input
                autoFocus
                value={name}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => setEditing(false)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && setEditing(false)}
                onFocus={(e) => e.target.select()}
                placeholder="Name this record"
                className={`min-w-0 w-full max-w-[420px] h-7 px-2 rounded-md text-[13px] font-medium focus:outline-none ${t.input}`}
                style={FONT}
            />
        );
    }

    return (
        <button
            type="button"
            onClick={() => setEditing(true)}
            title="Rename"
            className={`group min-w-0 inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[13px] font-medium border-none bg-transparent cursor-text transition-colors ${t.text}`}
            style={FONT}
        >
            <span className="truncate">{displayRecordName(name) || 'Name this record'}</span>
            <FiEdit2 className={`shrink-0 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity ${t.icon}`} />
        </button>
    );
};

export default RecordName;
