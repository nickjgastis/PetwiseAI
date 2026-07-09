// ================ IMPORTS ================
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth0 } from '@auth0/auth0-react';

// Free-tier monthly limits — keep in sync with server/usage.js FREE_LIMITS
export const FREE_LIMITS = {
    soap: 15,   // QuickSOAP + PetSOAP combined pool
    query: 30   // PetQuery
};

// Compute the start of the current anniversary-anchored usage period.
// Mirrors consume_usage() in migration 008 — the DB is the source of truth;
// this exists so the UI can show fresh percentages before the first request
// of a new period lazily resets the counters.
function currentPeriodStart(createdAt) {
    const anchor = createdAt ? new Date(createdAt) : new Date();
    const now = new Date();
    let months = (now.getFullYear() - anchor.getFullYear()) * 12 + (now.getMonth() - anchor.getMonth());
    const addMonths = (date, m) => {
        const d = new Date(date);
        const day = d.getDate();
        d.setMonth(d.getMonth() + m);
        // Clamp overflow (Jan 31 + 1mo → Feb 28/29, not Mar 2/3) like Postgres does
        if (d.getDate() < day) d.setDate(0);
        return d;
    };
    let start = addMonths(anchor, months);
    if (start > now) start = addMonths(anchor, months - 1);
    return start;
}

// Derive the effective tier from a users row — mirror of server/usage.js getTier()
export function getTier(userRow) {
    if (!userRow) return 'free';
    const now = new Date();
    const endDate = userRow.subscription_end_date ? new Date(userRow.subscription_end_date) : null;

    if (userRow.plan_label === 'student' && endDate && endDate > now) return 'student';

    const hasActiveStatus = ['active', 'past_due'].includes(userRow.subscription_status);
    if (hasActiveStatus && ['monthly', 'yearly'].includes(userRow.subscription_interval)) return 'paid';
    if (hasActiveStatus && ['trial', 'stripe_trial'].includes(userRow.subscription_interval)
        && endDate && endDate > now) return 'trial';

    return 'free';
}

// Same-tab refresh signal: generation flows dispatch this right after the server
// confirms a consume, so every mounted useUsage (sidebar ring, page bars, Profile)
// refetches immediately without relying on Supabase realtime configuration.
export const USAGE_UPDATED_EVENT = 'petwise:usage-updated';
export function notifyUsageUpdated() {
    window.dispatchEvent(new CustomEvent(USAGE_UPDATED_EVENT));
}

// ================ USAGE HOOK ================
// Returns per-feature usage with percentages (UI displays % only, never raw counts):
// { tier, isUnlimited, soap: {used, limit, remaining, pct}, query: {...}, resetsAt, refresh }
export function useUsage() {
    const [usageData, setUsageData] = useState(null);
    const { user } = useAuth0();

    const fetchUsage = useCallback(async () => {
        if (!user?.sub) return;

        const { data, error } = await supabase
            .from('users')
            .select('soap_notes_used, pet_queries_used, usage_period_start, created_at, subscription_status, subscription_interval, subscription_end_date, plan_label')
            .eq('auth0_user_id', user.sub)
            .single();

        if (error) {
            console.error('Usage check error:', error);
            return;
        }
        setUsageData(data);
    }, [user?.sub]);

    useEffect(() => {
        fetchUsage();

        // Unique channel name per hook instance — shared names cause one
        // component's unmount to unsubscribe every other listener.
        const channel = supabase
            .channel(`usage-updates-${Math.random().toString(36).slice(2)}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'users',
                filter: `auth0_user_id=eq.${user?.sub}`
            }, fetchUsage)
            .subscribe();

        window.addEventListener(USAGE_UPDATED_EVENT, fetchUsage);

        return () => {
            channel.unsubscribe();
            window.removeEventListener(USAGE_UPDATED_EVENT, fetchUsage);
        };
    }, [user?.sub, fetchUsage]);

    const tier = getTier(usageData);
    const isUnlimited = tier !== 'free';

    const periodStart = usageData ? currentPeriodStart(usageData.created_at) : null;
    // Counters are stale until the first capped request of a new period —
    // treat them as 0 when the stored period predates the current one.
    const periodIsStale = usageData?.usage_period_start
        ? new Date(usageData.usage_period_start) < periodStart
        : usageData?.usage_period_start === null;

    const buildFeature = (rawUsed, limit) => {
        const used = isUnlimited ? 0 : (periodIsStale ? 0 : (rawUsed || 0));
        const pct = isUnlimited ? 0 : Math.min(Math.round((used / limit) * 100), 100);
        return { used, limit, remaining: Math.max(limit - used, 0), pct };
    };

    let resetsAt = null;
    if (periodStart) {
        const r = new Date(periodStart);
        const day = r.getDate();
        r.setMonth(r.getMonth() + 1);
        if (r.getDate() < day) r.setDate(0);
        resetsAt = r;
    }

    return {
        loaded: usageData !== null,
        tier,
        isUnlimited,
        soap: buildFeature(usageData?.soap_notes_used, FREE_LIMITS.soap),
        query: buildFeature(usageData?.pet_queries_used, FREE_LIMITS.query),
        resetsAt,
        refresh: fetchUsage
    };
}
