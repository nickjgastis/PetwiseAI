import React from 'react';
import { motion } from 'framer-motion';

const TRIAL_DAYS = 10;

// Color for the sidebar ring: brand blue, shifting amber near the daily cap.
// No red "danger" state — hitting the cap isn't an error, usage resets at midnight.
export const usageColor = (pct) => {
    if (pct >= 75) return '#f59e0b';   // amber-500
    return '#3468bd';                  // brand blue
};

const FeatureRow = ({ label, value, valueClass = 'text-gray-900' }) => (
    <div className="flex items-center justify-between py-2.5">
        <span className="text-[13px] text-gray-500">{label}</span>
        <span className={`text-[13px] font-semibold ${valueClass}`}>{value}</span>
    </div>
);

// Pip row for small daily quotas (e.g. 5 SOAPs): ●●●○○ with "2 left today".
export const UsagePips = ({ label, used, limit, remaining }) => {
    const nearCap = remaining <= 1;
    return (
        <div>
            <div className="flex items-center justify-between mb-2 text-[13px]">
                <span className="font-medium text-gray-700">{label}</span>
                <span className={`font-semibold ${nearCap ? 'text-amber-600' : 'text-gray-500'}`}>
                    {remaining === 0 ? 'None left' : `${remaining} left`}
                </span>
            </div>
            <div className="flex items-center gap-1.5">
                {Array.from({ length: limit }).map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.25, delay: i * 0.04 }}
                        className="h-2 flex-1 rounded-full"
                        style={{ background: i < used ? usageColor(Math.round((used / limit) * 100)) : '#e5e7eb' }}
                    />
                ))}
            </div>
        </div>
    );
};

// Count bar for larger daily quotas (e.g. 5 queries): "4 of 5 used".
export const UsageCountBar = ({ label, used, limit, remaining }) => {
    const pct = Math.min(Math.round((used / limit) * 100), 100);
    const color = usageColor(pct);
    return (
        <div>
            <div className="flex items-center justify-between mb-2 text-[13px]">
                <span className="font-medium text-gray-700">{label}</span>
                <span className="font-semibold" style={{ color: remaining <= 3 ? color : undefined }}>
                    <span className="text-gray-900">{used}</span>
                    <span className="text-gray-400 font-medium"> / {limit}</span>
                </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-gray-100">
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

const UpgradeButton = ({ onUpgrade, children }) => {
    if (!onUpgrade) return null;
    return (
        <button
            onClick={onUpgrade}
            className="w-full mt-1 px-4 py-2.5 bg-[#3468bd] text-white text-sm font-semibold rounded-xl hover:bg-[#2a5298] active:scale-[0.99] transition-all"
        >
            {children}
        </button>
    );
};

// Full usage section for the Profile/account page — always visible for free
// users at any usage level. usage = return value of useUsage().
const UsageMeter = ({ usage, onUpgrade }) => {
    if (!usage?.loaded) return null;

    if (usage.isUnlimited) {
        const isTrial = usage.trialPhase === 'active' || usage.trialPhase === 'last-day';
        const lastDay = usage.trialPhase === 'last-day';
        const daysLeft = usage.trialDaysLeft || 0;
        const daysUsed = Math.min(TRIAL_DAYS, Math.max(0, TRIAL_DAYS - daysLeft));
        const trialPct = Math.min(100, Math.round((daysUsed / TRIAL_DAYS) * 100));

        if (isTrial) {
            return (
                <div className="space-y-4">
                    <div>
                        <div className="flex items-end justify-between gap-3 mb-3">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
                                    Trial
                                </p>
                                <p className={`text-2xl font-bold tracking-tight mt-0.5 ${lastDay ? 'text-amber-600' : 'text-gray-900'}`}>
                                    {lastDay ? 'Last day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                                </p>
                            </div>
                            <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                lastDay
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-emerald-50 text-emerald-700'
                            }`}>
                                Unlimited
                            </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden bg-gray-100">
                            <motion.div
                                className="h-full rounded-full"
                                style={{ background: lastDay ? '#f59e0b' : '#3468bd' }}
                                initial={{ width: 0 }}
                                animate={{ width: `${lastDay ? 100 : trialPct}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                            {lastDay
                                ? 'Unlimited SOAP and PetQuery today. Tomorrow you move to PetWise Free, or upgrade to stay unlimited.'
                                : `Unlimited SOAP notes and PetQuery for the rest of your ${TRIAL_DAYS}-day trial.`}
                        </p>
                    </div>
                    <div className="divide-y divide-gray-100 border-t border-gray-100">
                        <FeatureRow label="SOAP notes" value="Unlimited" valueClass="text-emerald-600" />
                        <FeatureRow label="PetQuery" value="Unlimited" valueClass="text-emerald-600" />
                    </div>
                    <UpgradeButton onUpgrade={onUpgrade}>Upgrade to keep unlimited</UpgradeButton>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="rounded-2xl bg-emerald-50/80 border border-emerald-100 px-4 py-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                        Unlimited
                    </p>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                        SOAP notes and PetQuery have no daily cap on your plan.
                    </p>
                </div>
                <div className="divide-y divide-gray-100">
                    <FeatureRow label="SOAP notes" value="Unlimited" valueClass="text-emerald-600" />
                    <FeatureRow label="PetQuery" value="Unlimited" valueClass="text-emerald-600" />
                </div>
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
            <p className="text-xs text-gray-400 leading-relaxed">
                Resets at midnight
                {usage.hoursUntilReset ? ` · ${usage.hoursUntilReset}h left today` : ''}
            </p>
            <UpgradeButton onUpgrade={onUpgrade}>Upgrade for unlimited</UpgradeButton>
        </div>
    );
};

export default UsageMeter;
