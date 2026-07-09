// ================ IMPORTS ================
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth0 } from '@auth0/auth0-react';

// Free-tier DAILY limits — keep in sync with server/usage.js FREE_LIMITS.
// Reset at the user's local midnight; unused quota never rolls over.
export const FREE_LIMITS = {
    soap: 5,    // QuickSOAP + PetSOAP combined pool
    query: 15   // PetQuery
};

// The browser's IANA timezone — sent with generation requests so the server
// resets quotas at THIS user's local midnight.
export function getBrowserTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
        return null;
    }
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
// confirms a consume, so every mounted useUsage (sidebar ring, banners, Profile)
// refetches immediately without relying on Supabase realtime configuration.
export const USAGE_UPDATED_EVENT = 'petwise:usage-updated';
export function notifyUsageUpdated() {
    window.dispatchEvent(new CustomEvent(USAGE_UPDATED_EVENT));
}

// ================ USAGE HOOK ================
// Daily quota view (the browser IS the user's local time, so "today" is just
// the local calendar date). Returns:
// { tier, isUnlimited, soap: {used, limit, remaining, pct}, query: {...},
//   resetsAt (next local midnight), hoursUntilReset, refresh }
export function useUsage() {
    const [usageData, setUsageData] = useState(null);
    const { user } = useAuth0();

    const fetchUsage = useCallback(async () => {
        if (!user?.sub) return;

        const { data, error } = await supabase
            .from('users')
            .select('soap_notes_used, pet_queries_used, usage_period_start, subscription_status, subscription_interval, subscription_end_date, plan_label')
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

    // Start of today, local time (the browser is authoritative for display)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Next local midnight
    const resetsAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const hoursUntilReset = Math.max(1, Math.ceil((resetsAt - now) / (1000 * 60 * 60)));

    // Counters are stale until the first capped request of a new day —
    // treat them as 0 when the stored period predates today's midnight.
    const periodIsStale = !usageData?.usage_period_start
        || new Date(usageData.usage_period_start) < todayStart;

    const buildFeature = (rawUsed, limit) => {
        const used = isUnlimited ? 0 : (periodIsStale ? 0 : (rawUsed || 0));
        const pct = isUnlimited ? 0 : Math.min(Math.round((used / limit) * 100), 100);
        return { used, limit, remaining: Math.max(limit - used, 0), pct };
    };

    return {
        loaded: usageData !== null,
        tier,
        isUnlimited,
        soap: buildFeature(usageData?.soap_notes_used, FREE_LIMITS.soap),
        query: buildFeature(usageData?.pet_queries_used, FREE_LIMITS.query),
        resetsAt,
        hoursUntilReset,
        refresh: fetchUsage
    };
}
