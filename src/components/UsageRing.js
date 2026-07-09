import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usageColor } from './UsageMeter';

// Circular usage indicator for the sidebar footer. The stroke fills with the
// overall % used (max of the two feature pools). Hover shows per-feature
// percentages; click goes to the usage section on the Profile page.
// Hidden for unlimited (paid/student) users — parent decides.
const UsageRing = ({ usage, size = 40, onNavigate }) => {
    const navigate = useNavigate();
    const [hovered, setHovered] = useState(false);

    if (!usage?.loaded || usage.isUnlimited) return null;

    // Overall allowance consumed across BOTH pools — not max(), which would read
    // 100% the moment either single feature capped out (misleading "you're done").
    const totalUsed = (usage.soap.used || 0) + (usage.query.used || 0);
    const totalLimit = (usage.soap.limit || 0) + (usage.query.limit || 0);
    const pct = totalLimit ? Math.min(Math.round((totalUsed / totalLimit) * 100), 100) : 0;
    const color = usageColor(pct);
    const soapMaxed = usage.soap.pct >= 100;
    const queryMaxed = usage.query.pct >= 100;
    const stroke = 3.5;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    const resetLabel = usage.hoursUntilReset
        ? `at midnight (in ${usage.hoursUntilReset}h)`
        : 'at midnight';

    const handleClick = () => {
        navigate('/dashboard/profile', { state: { scrollToUsage: true } });
        if (onNavigate) onNavigate();
    };

    return (
        <div
            className="relative flex-shrink-0"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <button
                onClick={handleClick}
                className="relative block rounded-full transition-transform hover:scale-110"
                style={{ width: size, height: size }}
                aria-label={`Usage: ${pct}% used — view details`}
            >
                <svg width={size} height={size} className="-rotate-90">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth={stroke}
                    />
                    <motion.circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                </svg>
                <span
                    className="absolute inset-0 flex items-center justify-center font-bold text-white"
                    style={{ fontSize: size * 0.28 }}
                >
                    {pct}%
                </span>
            </button>

            <AnimatePresence>
                {hovered && (
                    <motion.div
                        initial={{ opacity: 0, x: -4, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -4, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-full bottom-0 ml-3 w-52 p-3.5 rounded-2xl bg-white border border-gray-100 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.25)] z-[60] pointer-events-none"
                    >
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[12px] font-bold text-gray-900">Today's usage</span>
                            <span
                                className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{ color, background: `${color}1a` }}
                            >
                                {pct}%
                            </span>
                        </div>

                        <div className="space-y-2.5">
                            {[
                                { label: 'SOAP notes', p: usage.soap.pct, maxed: soapMaxed, used: usage.soap.used, limit: usage.soap.limit },
                                { label: 'PetQuery', p: usage.query.pct, maxed: queryMaxed, used: usage.query.used, limit: usage.query.limit }
                            ].map(({ label, p, maxed, used, limit }) => (
                                <div key={label}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[11px] font-medium text-gray-500">{label}</span>
                                        {maxed ? (
                                            <span className="text-[10px] font-bold text-amber-600">Done for today</span>
                                        ) : (
                                            <span className="text-[11px] font-semibold text-gray-700">{used} of {limit}</span>
                                        )}
                                    </div>
                                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${p}%`, background: usageColor(p) }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="text-[10px] text-gray-400 mt-2.5 pt-2.5 border-t border-gray-100">
                            Resets {resetLabel}
                        </div>

                        {/* Arrow pointing left toward the ring (aligned to the ring's row) */}
                        <div
                            className="absolute right-full border-[6px] border-transparent border-r-white"
                            style={{ bottom: size / 2 - 6 }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default UsageRing;
