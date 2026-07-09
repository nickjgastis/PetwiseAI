import React from 'react';
import { motion } from 'framer-motion';

// Color for the sidebar ring: brand blue, shifting amber near the daily cap.
// No red "danger" state — hitting the cap isn't an error, usage resets at midnight.
export const usageColor = (pct) => {
    if (pct >= 75) return '#f59e0b';   // amber-500
    return '#3468bd';                  // brand blue
};

// Pip row for small daily quotas (e.g. 5 SOAPs): ●●●○○ with "2 left today".
export const UsagePips = ({ label, used, limit, remaining }) => {
    const nearCap = remaining <= 1;
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5 text-xs font-medium text-gray-500">
                <span>{label}</span>
                <span style={{ color: nearCap ? '#f59e0b' : undefined }}>
                    {remaining === 0 ? 'None left today' : `${remaining} left today`}
                </span>
            </div>
            <div className="flex items-center gap-1.5">
                {Array.from({ length: limit }).map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.25, delay: i * 0.04 }}
                        className="h-2.5 flex-1 max-w-[44px] rounded-full"
                        style={{ background: i < used ? usageColor(Math.round((used / limit) * 100)) : '#e5e7eb' }}
                    />
                ))}
            </div>
        </div>
    );
};

// Count bar for larger daily quotas (e.g. 15 queries): "12 of 15 used".
export const UsageCountBar = ({ label, used, limit, remaining }) => {
    const pct = Math.min(Math.round((used / limit) * 100), 100);
    const color = usageColor(pct);
    return (
        <div>
            <div className="flex items-center justify-between mb-1 text-xs font-medium text-gray-500">
                <span>{label}</span>
                <span style={{ color: remaining <= 3 ? color : undefined }}>
                    {used} of {limit} used today
                </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-gray-200">
                <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                />
            </div>
        </div>
    );
};

// Full usage section for the Profile/account page — always visible for free
// users at any usage level. usage = return value of useUsage().
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

    return (
        <div className="space-y-5">
            <UsagePips
                label="SOAP notes"
                used={usage.soap.used}
                limit={usage.soap.limit}
                remaining={usage.soap.remaining}
            />
            <UsageCountBar
                label="PetQuery"
                used={usage.query.used}
                limit={usage.query.limit}
                remaining={usage.query.remaining}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs text-gray-500">
                    Free plan · your allowance resets at midnight
                    {usage.hoursUntilReset ? ` (in ${usage.hoursUntilReset}h)` : ''}
                </span>
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
