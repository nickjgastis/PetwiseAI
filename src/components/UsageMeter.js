import React from 'react';
import { motion } from 'framer-motion';

// Percentage-based usage bar. Usage is ALWAYS displayed as % used, never raw counts.
// pct: 0-100. Color shifts neutral → amber (75%+) and stays amber through 100%
// (no red "danger" state — hitting the cap isn't an error, usage just resets).
export const usageColor = (pct) => {
    if (pct >= 75) return '#f59e0b';   // amber-500
    return '#3468bd';                  // brand blue
};

// Compact bar for feature pages (QuickSOAP / PetSOAP / PetQuery).
// Renders nothing for unlimited (paid/student) users.
export const UsageBar = ({ label, pct, isUnlimited, resetsAt, compact = true, dark = false }) => {
    if (isUnlimited) return null;

    const color = usageColor(pct);
    const resetLabel = resetsAt
        ? new Date(resetsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : null;

    return (
        <div className={compact ? 'w-full max-w-xs' : 'w-full'}>
            <div className={`flex items-center justify-between mb-1 text-xs font-medium ${dark ? 'text-white/70' : 'text-gray-500'}`}>
                <span>{label}</span>
                <span style={{ color: pct >= 75 ? color : undefined }}>{pct}% used</span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/15' : 'bg-gray-200'}`}>
                <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                />
            </div>
            {!compact && resetLabel && (
                <div className={`mt-1 text-[11px] ${dark ? 'text-white/50' : 'text-gray-400'}`}>
                    Resets {resetLabel}
                </div>
            )}
        </div>
    );
};

// Full usage section for the Profile/account page: both bars + reset date.
// Parent supplies the upgrade CTA. usage = return value of useUsage().
const UsageMeter = ({ usage, onUpgrade }) => {
    if (!usage?.loaded) return null;

    if (usage.isUnlimited) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                    Unlimited
                </span>
                <span>Your plan includes unlimited SOAP notes and PetQuery.</span>
            </div>
        );
    }

    const resetLabel = usage.resetsAt
        ? usage.resetsAt.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
        : null;

    return (
        <div className="space-y-4">
            <UsageBar label="SOAP notes" pct={usage.soap.pct} isUnlimited={false} compact={false} />
            <UsageBar label="PetQuery" pct={usage.query.pct} isUnlimited={false} compact={false} />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {resetLabel && (
                    <span className="text-xs text-gray-500">Free plan · usage resets {resetLabel}</span>
                )}
                {onUpgrade && (
                    <button
                        onClick={onUpgrade}
                        className="px-4 py-2 bg-[#3468bd] text-white text-sm font-semibold rounded-lg hover:bg-[#2a5298] transition-colors"
                    >
                        Upgrade for unlimited
                    </button>
                )}
            </div>
        </div>
    );
};

export default UsageMeter;
