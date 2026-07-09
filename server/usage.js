// Free-tier usage enforcement helpers.
// Counters live on the users table; consume_usage/refund_usage (migration 008)
// handle the atomic check-increment and lazy anniversary-based monthly reset.

const { createClient } = require('@supabase/supabase-js');

// Service role bypasses RLS if/when it gets enabled — enforcement must never
// depend on anon-key permissions. Falls back to anon for local setups.
const usageSupabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY
    || process.env.REACT_APP_SUPABASE_ANON_KEY
);

const FREE_LIMITS = {
    soap: Number(process.env.FREE_SOAP_LIMIT || 35),   // QuickSOAP + PetSOAP combined pool
    query: Number(process.env.FREE_QUERY_LIMIT || 40)  // PetQuery
};

// While false, requests that can't be attributed to a user (stale PWA bundles
// that don't send user/source yet) are allowed with a warning instead of 403'd.
const USAGE_ENFORCE_STRICT = process.env.USAGE_ENFORCE_STRICT === 'true';

// Derive the effective tier from a users row. Free tier is the absence of a plan.
function getTier(userRow) {
    if (!userRow) return 'free';
    const now = new Date();
    const endDate = userRow.subscription_end_date ? new Date(userRow.subscription_end_date) : null;

    if (userRow.plan_label === 'student' && endDate && endDate > now) return 'student';

    const hasActiveStatus = ['active', 'past_due'].includes(userRow.subscription_status);
    if (hasActiveStatus && ['monthly', 'yearly'].includes(userRow.subscription_interval)) return 'paid';

    // Grandfather: in-flight trials stay unlimited until they convert or lapse
    // (legacy trials get flipped to free by migration 009; stripe trials by webhook)
    if (hasActiveStatus && ['trial', 'stripe_trial'].includes(userRow.subscription_interval)
        && endDate && endDate > now) return 'trial';

    return 'free';
}

// Check the cap and consume one unit if allowed. feature: 'soap' | 'query'.
// Returns { allowed, exempt?, used?, limit?, resetsAt? }.
async function checkAndConsume(sub, feature) {
    if (!sub) {
        if (USAGE_ENFORCE_STRICT) {
            return { allowed: false, reason: 'MISSING_USER' };
        }
        console.warn(`[USAGE] ${feature} request without user id — allowing (soft mode)`);
        return { allowed: true, exempt: true };
    }

    const { data: userRow, error: fetchError } = await usageSupabase
        .from('users')
        .select('subscription_status, subscription_interval, subscription_end_date, plan_label')
        .eq('auth0_user_id', sub)
        .single();

    if (fetchError) {
        // Don't block a paying vet mid-appointment because of a lookup hiccup
        console.error(`[USAGE] Failed to fetch user ${sub} for ${feature} check — allowing:`, fetchError.message);
        return { allowed: true, exempt: true };
    }

    if (getTier(userRow) !== 'free') {
        return { allowed: true, exempt: true };
    }

    const limit = FREE_LIMITS[feature];
    const { data, error: rpcError } = await usageSupabase.rpc('consume_usage', {
        p_auth0_user_id: sub,
        p_feature: feature,
        p_limit: limit
    });

    if (rpcError) {
        console.error(`[USAGE] consume_usage RPC failed for ${sub}/${feature} — allowing:`, rpcError.message);
        return { allowed: true, exempt: true };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
        allowed: row.allowed,
        used: row.used,
        limit: row.usage_limit,
        resetsAt: row.resets_at
    };
}

// Give a consumed unit back after a failed generation.
async function refund(sub, feature) {
    if (!sub) return;
    const { error } = await usageSupabase.rpc('refund_usage', {
        p_auth0_user_id: sub,
        p_feature: feature
    });
    if (error) {
        console.error(`[USAGE] refund_usage failed for ${sub}/${feature}:`, error.message);
    }
}

// Standard 403 body for a blocked request.
function limitResponse(feature, result) {
    return {
        error: 'USAGE_LIMIT_REACHED',
        feature,
        used: result.used,
        limit: result.limit,
        resetsAt: result.resetsAt
    };
}

module.exports = { FREE_LIMITS, USAGE_ENFORCE_STRICT, getTier, checkAndConsume, refund, limitResponse };
