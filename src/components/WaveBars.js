import React from 'react';

// Live mic waveform. levels are 0..1.
const WaveBars = ({ levels = [], live = true, height = 56, barWidth = 4, gap = 3, className = '' }) => (
    <div className={`flex items-center justify-center ${className}`} style={{ height, gap }}>
        {levels.map((l, i) => (
            <span
                key={i}
                className={`rounded-full transition-[height,opacity] duration-100 ${live ? 'bg-[#2d5fb8]' : 'bg-[#1a2b4a]/20'}`}
                style={{
                    width: barWidth,
                    height: live ? Math.max(barWidth + 2, (barWidth + 2) + l * (height - barWidth - 2)) : barWidth + 2,
                    opacity: live ? 0.45 + l * 0.55 : 1
                }}
            />
        ))}
    </div>
);

export const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const RecordingStatus = ({ live, seconds, className = '' }) => (
    <span className={`inline-flex items-center gap-2 text-[13px] font-medium text-[#1a2b4a]/70 ${className}`}>
        <span className={`w-2 h-2 rounded-full ${live ? 'bg-red-500 animate-pulse' : 'bg-[#1a2b4a]/30'}`} />
        {live ? 'Listening' : 'Paused'} · <span className="tabular-nums">{fmtClock(seconds)}</span>
    </span>
);

export default WaveBars;
