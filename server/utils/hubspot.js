// Outbound HubSpot CRM sync. Fail-open: missing token or API errors never
// throw to callers. Unset HUBSPOT_ACCESS_TOKEN = production unchanged.

const fetch = require('node-fetch');
const { getTier } = require('../usage');

const BASE = 'https://api.hubapi.com';
const TIMEOUT_MS = Number(process.env.HUBSPOT_TIMEOUT_MS || 8000);
const USING_AFTER = 10;

const PIPELINE = process.env.HUBSPOT_DEAL_PIPELINE_ID || '2244587465';
const STAGE_LABELS = {
    new_lead: 'New Lead',
    no_answer: 'No Answer',
    contacted: 'Contacted',
    signed_up: 'Signed up',
    onboarded: 'Onboarded',
    activated: 'Activated',
    using: 'Using',
    trial_ending: 'Trial ending',
    trial_ended: 'Trial ended',
    won: 'Closed Won',
    lost: 'Closed Lost',
    disqualified: 'Disqualified',
};
const STAGES = {
    new_lead: process.env.HUBSPOT_STAGE_NEW_LEAD || '',
    no_answer: process.env.HUBSPOT_STAGE_NO_ANSWER || '',
    contacted: process.env.HUBSPOT_STAGE_CONTACTED || '',
    signed_up: process.env.HUBSPOT_STAGE_SIGNED_UP || '3837542388',
    onboarded: process.env.HUBSPOT_STAGE_ONBOARDED || '3837542389',
    activated: process.env.HUBSPOT_STAGE_ACTIVATED || '3837542390',
    using: process.env.HUBSPOT_STAGE_USING || '3837542391',
    trial_ending: process.env.HUBSPOT_STAGE_TRIAL_ENDING || '3837542392',
    trial_ended: process.env.HUBSPOT_STAGE_TRIAL_ENDED || '3837542393',
    won: process.env.HUBSPOT_STAGE_WON || '3837543354',
    lost: process.env.HUBSPOT_STAGE_LOST || '3837543355',
    disqualified: process.env.HUBSPOT_STAGE_DISQUALIFIED || '',
};

const STAGE_ORDER = [
    'new_lead', 'no_answer', 'contacted',
    'signed_up', 'onboarded', 'activated', 'using',
    'trial_ending', 'trial_ended', 'won', 'lost', 'disqualified',
];

let stageCache = null;

async function stages() {
    if (stageCache) return stageCache;
    const map = { ...STAGES };
    try {
        const pipe = await hs('GET', `/crm/v3/pipelines/deals/${PIPELINE}`);
        const byLabel = Object.fromEntries((pipe.stages || []).map((s) => [s.label, s.id]));
        for (const [key, label] of Object.entries(STAGE_LABELS)) {
            if (byLabel[label]) map[key] = byLabel[label];
        }
    } catch (err) {
        console.error('[hubspot] pipelines:', err.message);
    }
    if (map.new_lead && map.no_answer && map.contacted && map.disqualified) {
        stageCache = map;
    }
    return map;
}

function stageKey(map, stageId) {
    if (!stageId) return null;
    const hit = Object.entries(map).find(([, id]) => id && id === stageId);
    return hit ? hit[0] : null;
}

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

const CONTACT_STAGE_ORDER = [
    'new_lead', 'no_answer', 'contacted',
    'signed_up', 'onboarded', 'activated', 'using',
    'trial_ending', 'trial_ended', 'won',
];

function canAdvanceContact(current, desired) {
    if (!desired || desired === 'disqualified' || desired === 'old_leads' || desired === 'new_lead') return false;
    if (current === 'disqualified') return false;
    if (!current || current === 'old_leads' || current === 'new_lead') {
        return CONTACT_STAGE_ORDER.includes(desired);
    }
    if (current === 'won') return desired === 'won';
    const from = CONTACT_STAGE_ORDER.indexOf(current);
    const to = CONTACT_STAGE_ORDER.indexOf(desired);
    if (from < 0 || to < 0) return false;
    return to >= from;
}

async function advanceContactStage(contactId, desired) {
    if (!contactId || !desired) return;
    try {
        const row = await hs('GET', `/crm/v3/objects/contacts/${contactId}?properties=pw_stage`);
        const current = row.properties?.pw_stage || '';
        if (!canAdvanceContact(current, desired)) return;
        await hs('PATCH', `/crm/v3/objects/contacts/${contactId}`, {
            properties: { pw_stage: desired },
        });
    } catch (err) {
        console.error('[hubspot] contact stage:', err.message, err.detail ? JSON.stringify(err.detail).slice(0, 400) : '');
    }
}

async function firstContactId(dealId) {
    const assoc = await hs('GET', `/crm/v4/objects/deals/${dealId}/associations/contacts`);
    return assoc.results?.[0]?.toObjectId || null;
}

function canAdvance(map, currentId, desiredKey) {
    if (!desiredKey || !map[desiredKey]) return false;
    if (!currentId) return true;
    const currentKey = stageKey(map, currentId);
    if (!currentKey) return true;
    if (currentKey === 'disqualified') return false;
    if (currentKey === 'won' || currentKey === 'lost') return desiredKey === 'won';
    if (desiredKey === 'won') return true;
    if (desiredKey === 'lost' || desiredKey === 'disqualified') return false;
    const current = STAGE_ORDER.indexOf(currentKey);
    const desired = STAGE_ORDER.indexOf(desiredKey);
    if (current < 0 || desired < 0) return false;
    return desired >= current;
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
    const row = res.results?.[0];
    return row?.id || row?.properties?.hs_object_id || null;
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

async function findPipelineDealForContact(contactId, map) {
    const assoc = await hs('GET', `/crm/v4/objects/contacts/${contactId}/associations/deals`);
    const ids = (assoc.results || []).map((r) => r.toObjectId).filter(Boolean);
    if (!ids.length) return null;
    const batch = await hs('POST', '/crm/v3/objects/deals/batch/read', {
        properties: ['pw_auth0_id', 'dealstage', 'pipeline', 'pw_soaps', 'pw_queries'],
        inputs: ids.slice(0, 100).map((id) => ({ id: String(id) })),
    });
    const inPipe = (batch.results || []).filter((d) => String(d.properties?.pipeline) === String(PIPELINE));
    if (!inPipe.length) return null;
    const terminal = new Set([map.won, map.lost, map.disqualified].filter(Boolean));
    const open = inPipe.filter((d) => !terminal.has(d.properties?.dealstage));
    open.sort((a, b) => {
        const ar = STAGE_ORDER.indexOf(stageKey(map, a.properties?.dealstage));
        const br = STAGE_ORDER.indexOf(stageKey(map, b.properties?.dealstage));
        return br - ar;
    });
    return open[0] || inPipe[0];
}

async function findDealForUser(user, contactId, map) {
    const byAuth = await findDeal(user.auth0_user_id);
    if (byAuth) return byAuth;
    if (!contactId) return null;
    try {
        return await findPipelineDealForContact(contactId, map);
    } catch (err) {
        console.error('[hubspot] findPipelineDeal:', err.message, err.detail ? JSON.stringify(err.detail).slice(0, 400) : '');
        return null;
    }
}

async function associateDeal(dealId, contactId) {
    if (!dealId || !contactId) return;
    await hs(
        'PUT',
        `/crm/v4/objects/deals/${dealId}/associations/default/contacts/${contactId}`
    );
}

async function createDeal(contactId, user, stageKey, map) {
    const properties = {
        dealname: dealName(user),
        pipeline: PIPELINE,
        dealstage: map[stageKey] || map.signed_up,
        dealtype: 'newbusiness',
        ...dealProperties(user),
    };
    const payload = { properties };
    if (contactId) {
        payload.associations = [{
            to: { id: String(contactId) },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }],
        }];
    }
    return hs('POST', '/crm/v3/objects/deals', payload);
}

async function patchDeal(dealId, properties) {
    return hs('PATCH', `/crm/v3/objects/deals/${dealId}`, { properties });
}

async function ensureDeal(user, stageKey) {
    const map = await stages();
    const contactId = await upsertContact(user);
    const existing = await findDealForUser(user, contactId, map);
    if (existing) {
        const props = dealProperties(user);
        if (canAdvance(map, existing.properties?.dealstage, stageKey)) {
            props.dealstage = map[stageKey];
        }
        if (user.dvm_name || user.nickname) props.dealname = dealName(user);
        await patchDeal(existing.id, props);
        try {
            await associateDeal(existing.id, contactId);
        } catch (err) {
            console.error('[hubspot] associateDeal:', err.message, err.detail ? JSON.stringify(err.detail).slice(0, 400) : '');
        }
        await advanceContactStage(contactId, stageKey);
        return existing.id;
    }
    const created = await createDeal(contactId, user, stageKey, map);
    await advanceContactStage(contactId, stageKey);
    return created?.id || null;
}

async function syncSignup(user) {
    return safe('signup', () => ensureDeal(user, 'signed_up'));
}

async function syncOnboarded(user) {
    return safe('onboarded', () => ensureDeal(user, 'onboarded'));
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
        const map = await stages();
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
        if (canAdvance(map, deal.properties?.dealstage, desired)) {
            props.dealstage = map[desired];
        }
        await patchDeal(deal.id, props);
        try {
            await advanceContactStage(await firstContactId(deal.id), desired);
        } catch (err) {
            console.error('[hubspot] contact stage:', err.message);
        }
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
        const map = await stages();
        const deal = await findDeal(user.auth0_user_id);
        if (!deal) return null;
        const props = dealProperties(user);
        const desired = desiredTrialStage(user);
        if (canAdvance(map, deal.properties?.dealstage, desired)) {
            props.dealstage = map[desired];
        }
        await patchDeal(deal.id, props);
        if (user.email) {
            try {
                const contactId = await upsertContact(user);
                await associateDeal(deal.id, contactId);
                await advanceContactStage(contactId, desired);
            } catch (err) {
                console.error('[hubspot] associateDeal:', err.message, err.detail ? JSON.stringify(err.detail).slice(0, 400) : '');
            }
        }
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
