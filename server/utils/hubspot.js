// Outbound HubSpot CRM sync. Fail-open: missing token or API errors never
// throw to callers. Unset HUBSPOT_ACCESS_TOKEN = production unchanged.

const fetch = require('node-fetch');
const { getTier } = require('../usage');

const BASE = 'https://api.hubapi.com';
const TIMEOUT_MS = Number(process.env.HUBSPOT_TIMEOUT_MS || 8000);
const USING_AFTER = 10;

const PIPELINE = process.env.HUBSPOT_DEAL_PIPELINE_ID || '2244587465';
const STAGES = {
    signed_up: process.env.HUBSPOT_STAGE_SIGNED_UP || '3837542388',
    onboarded: process.env.HUBSPOT_STAGE_ONBOARDED || '3837542389',
    activated: process.env.HUBSPOT_STAGE_ACTIVATED || '3837542390',
    using: process.env.HUBSPOT_STAGE_USING || '3837542391',
    trial_ending: process.env.HUBSPOT_STAGE_TRIAL_ENDING || '3837542392',
    trial_ended: process.env.HUBSPOT_STAGE_TRIAL_ENDED || '3837542393',
    won: process.env.HUBSPOT_STAGE_WON || '3837543354',
    lost: process.env.HUBSPOT_STAGE_LOST || '3837543355',
};

const STAGE_ORDER = [
    'signed_up', 'onboarded', 'activated', 'using',
    'trial_ending', 'trial_ended', 'won', 'lost',
];

const STAGE_BY_ID = Object.fromEntries(
    Object.entries(STAGES).map(([k, v]) => [v, k])
);

function token() {
    return (process.env.HUBSPOT_ACCESS_TOKEN || '').trim();
}

function enabled() {
    return Boolean(token());
}

async function hs(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        timeout: TIMEOUT_MS,
        headers: {
            Authorization: `Bearer ${token()}`,
            'Content-Type': 'application/json',
        },
        body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) {
        const err = new Error(`HubSpot ${res.status} ${method} ${path}`);
        err.detail = json;
        throw err;
    }
    return json;
}

async function safe(label, fn) {
    if (!enabled()) {
        console.log(`[hubspot] ${label}: skipped (no token)`);
        return null;
    }
    try {
        const result = await fn();
        console.log(`[hubspot] ${label}: ok`, result || '');
        return result;
    } catch (err) {
        console.error(`[hubspot] ${label}:`, err.message, err.detail ? JSON.stringify(err.detail).slice(0, 800) : '');
        return null;
    }
}

function splitName(dvmName, nickname) {
    const raw = String(dvmName || nickname || '').replace(/^Dr\.?\s+/i, '').trim();
    if (!raw) return {};
    const parts = raw.split(/\s+/);
    const props = { firstname: parts[0] };
    if (parts.length > 1) props.lastname = parts.slice(1).join(' ');
    return props;
}

function trialDaysLeft(endDate) {
    if (!endDate) return 0;
    const ms = new Date(endDate).getTime() - Date.now();
    if (Number.isNaN(ms) || ms <= 0) return 0;
    return Math.max(1, Math.ceil(ms / 86400000));
}

function trialExpired(user) {
    if (!user?.subscription_end_date) return false;
    if (!['trial', 'stripe_trial'].includes(user.subscription_interval)) return false;
    return new Date(user.subscription_end_date).getTime() <= Date.now();
}

function planOf(user) {
    const tier = getTier(user);
    if (tier === 'paid') return user.subscription_interval === 'yearly' ? 'yearly' : 'monthly';
    if (tier === 'student') return 'student';
    if (tier === 'trial') return 'trial';
    return 'free';
}

function hsDate(iso) {
    if (!iso) return undefined;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return undefined;
    return String(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dealName(user) {
    const name = (user.dvm_name || user.nickname || '').trim();
    return name ? `${name} — Trial` : `${user.email || 'PetWise'} — Trial`;
}

function dealProperties(user, extra = {}) {
    const props = { pw_auth0_id: user.auth0_user_id };
    const hasPlan = user.subscription_interval != null
        || user.subscription_status != null
        || user.plan_label != null;
    if (hasPlan) {
        const plan = planOf(user);
        const expired = trialExpired(user);
        const days = expired ? 0 : (plan === 'trial' ? trialDaysLeft(user.subscription_end_date) : 0);
        props.pw_plan = plan;
        props.pw_trial_days_left = String(days);
        props.hs_priority = (expired || (plan === 'trial' && days <= 2)) ? 'high' : 'medium';
    }
    const end = hsDate(user.subscription_end_date);
    if (end) {
        props.pw_trial_end = end;
        props.closedate = end;
    }
    if (user.pw_landing) props.pw_landing = user.pw_landing;
    if (user.pw_soaps != null) props.pw_soaps = String(user.pw_soaps);
    if (user.pw_queries != null) props.pw_queries = String(user.pw_queries);
    if (user.pw_last_active) props.pw_last_active = hsDate(user.pw_last_active);
    return { ...props, ...extra };
}

function canAdvance(currentId, desiredKey) {
    if (!desiredKey || !STAGES[desiredKey]) return false;
    if (!currentId) return true;
    const currentKey = STAGE_BY_ID[currentId];
    if (!currentKey) return true;
    if (currentKey === 'won' || currentKey === 'lost') return desiredKey === 'won';
    if (desiredKey === 'won') return true;
    if (desiredKey === 'lost') return false;
    return STAGE_ORDER.indexOf(desiredKey) >= STAGE_ORDER.indexOf(currentKey);
}

async function upsertContact(user) {
    if (!user?.email) return null;
    const properties = {
        email: user.email,
        ...splitName(user.dvm_name, user.nickname),
    };
    if (user.phone_number) properties.phone = user.phone_number;
    const res = await hs('POST', '/crm/v3/objects/contacts/batch/upsert', {
        inputs: [{ idProperty: 'email', id: user.email, properties }],
    });
    return res.results?.[0]?.id || null;
}

async function findDeal(auth0Id) {
    if (!auth0Id) return null;
    try {
        const res = await hs('POST', '/crm/v3/objects/deals/search', {
            filterGroups: [{
                filters: [{ propertyName: 'pw_auth0_id', operator: 'EQ', value: auth0Id }],
            }],
            properties: ['pw_auth0_id', 'dealstage', 'pipeline', 'pw_soaps', 'pw_queries'],
            limit: 1,
        });
        return res.results?.[0] || null;
    } catch (err) {
        console.error('[hubspot] findDeal:', err.message, err.detail ? JSON.stringify(err.detail).slice(0, 400) : '');
        return null;
    }
}

async function associateDeal(dealId, contactId) {
    if (!dealId || !contactId) return;
    await hs(
        'PUT',
        `/crm/v4/objects/deals/${dealId}/associations/contacts/${contactId}`,
        [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }]
    );
}

async function createDeal(contactId, user, stageKey) {
    const properties = {
        dealname: dealName(user),
        pipeline: PIPELINE,
        dealstage: STAGES[stageKey] || STAGES.signed_up,
        dealtype: 'newbusiness',
        ...dealProperties(user),
    };
    const created = await hs('POST', '/crm/v3/objects/deals', { properties });
    try {
        await associateDeal(created?.id, contactId);
    } catch (err) {
        console.error('[hubspot] associateDeal:', err.message, err.detail ? JSON.stringify(err.detail).slice(0, 400) : '');
    }
    return created;
}

async function patchDeal(dealId, properties) {
    return hs('PATCH', `/crm/v3/objects/deals/${dealId}`, { properties });
}

async function ensureDeal(user, stageKey) {
    const contactId = await upsertContact(user);
    const existing = await findDeal(user.auth0_user_id);
    if (existing) {
        const props = dealProperties(user);
        if (canAdvance(existing.properties?.dealstage, stageKey)) {
            props.dealstage = STAGES[stageKey];
        }
        if (user.dvm_name || user.nickname) props.dealname = dealName(user);
        await patchDeal(existing.id, props);
        return existing.id;
    }
    const created = await createDeal(contactId, user, stageKey);
    return created?.id || null;
}

async function syncSignup(user) {
    return safe('signup', () => ensureDeal(user, 'signed_up'));
}

async function syncOnboarded(user) {
    return safe('onboarded', async () => {
        await upsertContact(user);
        const existing = await findDeal(user.auth0_user_id);
        if (!existing) return ensureDeal(user, 'onboarded');
        const props = {};
        if (user.dvm_name || user.nickname) props.dealname = dealName(user);
        if (canAdvance(existing.properties?.dealstage, 'onboarded')) {
            props.dealstage = STAGES.onboarded;
        }
        if (Object.keys(props).length) await patchDeal(existing.id, props);
        return existing.id;
    });
}

async function syncPaid(user) {
    return safe('paid', async () => {
        const id = await ensureDeal(user, 'won');
        try {
            if (user.email) {
                await hs('POST', '/crm/v3/objects/contacts/batch/upsert', {
                    inputs: [{
                        idProperty: 'email',
                        id: user.email,
                        properties: { email: user.email, lifecyclestage: 'customer' },
                    }],
                });
            }
        } catch (err) {
            console.error('[hubspot] paid lifecycle:', err.message);
        }
        return id;
    });
}

async function trackUsage(auth0Id, feature) {
    return safe('usage', async () => {
        const deal = await findDeal(auth0Id);
        if (!deal) return null;
        const soaps = Number(deal.properties?.pw_soaps || 0) + (feature === 'soap' ? 1 : 0);
        const queries = Number(deal.properties?.pw_queries || 0) + (feature === 'query' ? 1 : 0);
        const total = soaps + queries;
        const desired = total >= USING_AFTER ? 'using' : 'activated';
        const props = {
            pw_soaps: String(soaps),
            pw_queries: String(queries),
            pw_last_active: hsDate(new Date().toISOString()),
        };
        if (canAdvance(deal.properties?.dealstage, desired)) {
            props.dealstage = STAGES[desired];
        }
        await patchDeal(deal.id, props);
        return deal.id;
    });
}

function desiredTrialStage(user) {
    const tier = getTier(user);
    if (tier === 'paid') return 'won';
    if (trialExpired(user)) return 'trial_ended';
    if (tier === 'trial' && trialDaysLeft(user.subscription_end_date) <= 2) return 'trial_ending';
    const uses = Number(user.pw_soaps || 0) + Number(user.pw_queries || 0);
    if (uses >= USING_AFTER) return 'using';
    if (uses >= 1) return 'activated';
    return null;
}

async function syncTrialUser(user) {
    return safe('trial-user', async () => {
        const deal = await findDeal(user.auth0_user_id);
        if (!deal) {
            if (['trial', 'stripe_trial'].includes(user.subscription_interval) && user.email) {
                return ensureDeal(user, desiredTrialStage(user) || 'signed_up');
            }
            return null;
        }
        const props = dealProperties(user);
        const desired = desiredTrialStage(user);
        if (canAdvance(deal.properties?.dealstage, desired)) {
            props.dealstage = STAGES[desired];
        }
        await patchDeal(deal.id, props);
        return deal.id;
    });
}

async function syncTrialStates(users) {
    if (!enabled()) return { skipped: true, updated: 0 };
    let updated = 0;
    for (const user of users || []) {
        const id = await syncTrialUser(user);
        if (id) updated += 1;
    }
    return { skipped: false, updated };
}

function runInBackground(promise) {
    const p = Promise.resolve(promise).catch((err) => {
        console.error('[hubspot] bg:', err.message);
    });
    try {
        const { waitUntil } = require('@vercel/functions');
        if (typeof waitUntil === 'function') waitUntil(p);
    } catch (_) { /* local / no Vercel helper — promise still runs */ }
    return p;
}

module.exports = {
    enabled,
    syncSignup,
    syncOnboarded,
    syncPaid,
    trackUsage,
    syncTrialStates,
    runInBackground,
};
