const express = require('express');
const router = express.Router();
const { sendGetStartedEmail, sendDiscountEmail } = require('../utils/emailService');
const hubspot = require('../utils/hubspot');

// Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
function verifyCronAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV !== 'production') {
        return next();
    }

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
}

function isPaid(user) {
    return ['monthly', 'yearly'].includes(user.subscription_interval);
}

function daysAgo(n) {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

async function markSent(supabase, auth0UserId, column) {
    const { error } = await supabase
        .from('users')
        .update({ [column]: new Date().toISOString() })
        .eq('auth0_user_id', auth0UserId);
    if (error) console.error(`Failed to mark ${column} for ${auth0UserId}:`, error);
}

async function sendBatch(users, sendFn, column, supabase) {
    const results = { sent: 0, skipped: 0, failed: 0 };
    const queue = users.filter((u) => u.email && !isPaid(u));

    const CONCURRENCY = 5;
    for (let i = 0; i < queue.length; i += CONCURRENCY) {
        const chunk = queue.slice(i, i + CONCURRENCY);
        const settled = await Promise.allSettled(chunk.map(async (user) => {
            const result = await sendFn(supabase, user);
            if (result.success) {
                await markSent(supabase, user.auth0_user_id, column);
                results.sent += 1;
            } else if (result.skipped) {
                results.skipped += 1;
            } else {
                results.failed += 1;
                console.error(`Drip ${column} failed for ${user.email}:`, result.error);
            }
        }));
        settled.forEach((s) => {
            if (s.status === 'rejected') {
                results.failed += 1;
                console.error('Drip send threw:', s.reason);
            }
        });
    }

    results.skipped += users.length - queue.length;
    return results;
}

/**
 * GET/POST /cron/drip-emails
 * Day 2: get-started reminder. Day 8: 50% off first month.
 * Windows are bounded so a first deploy doesn't blast the whole free-user list.
 */
async function runDripEmails(req, res) {
    const { supabase } = req.app.locals;

    try {
        const [
            { data: day2Users, error: day2Error },
            { data: day8Users, error: day8Error }
        ] = await Promise.all([
            supabase
                .from('users')
                .select('auth0_user_id, email, nickname, dvm_name, subscription_interval, email_opt_out')
                .not('welcome_email_sent_at', 'is', null)
                .lte('welcome_email_sent_at', daysAgo(2))
                .gt('welcome_email_sent_at', daysAgo(8))
                .is('drip_get_started_email_sent_at', null)
                .or('email_opt_out.is.null,email_opt_out.eq.false')
                .limit(40),
            supabase
                .from('users')
                .select('auth0_user_id, email, nickname, dvm_name, subscription_interval, email_opt_out')
                .not('welcome_email_sent_at', 'is', null)
                .lte('welcome_email_sent_at', daysAgo(8))
                .gt('welcome_email_sent_at', daysAgo(14))
                .is('drip_discount_email_sent_at', null)
                .or('email_opt_out.is.null,email_opt_out.eq.false')
                .limit(40)
        ]);

        if (day2Error) throw day2Error;
        if (day8Error) throw day8Error;

        const getStarted = await sendBatch(day2Users || [], sendGetStartedEmail, 'drip_get_started_email_sent_at', supabase);
        const discount = await sendBatch(day8Users || [], sendDiscountEmail, 'drip_discount_email_sent_at', supabase);

        return res.json({
            success: true,
            getStarted: { candidates: (day2Users || []).length, ...getStarted },
            discount: { candidates: (day8Users || []).length, ...discount }
        });
    } catch (err) {
        console.error('Drip cron failed:', err);
        return res.status(500).json({ error: 'Drip cron failed', details: err.message });
    }
}

router.get('/drip-emails', verifyCronAuth, runDripEmails);
router.post('/drip-emails', verifyCronAuth, runDripEmails);

/**
 * GET/POST /cron/hubspot-sync
 * Push trial days-left + ending/ended stages. No-op without HUBSPOT_ACCESS_TOKEN.
 * Isolated from drip-emails so a HubSpot blip cannot skip the email cron.
 */
async function runHubspotSync(req, res) {
    const { supabase } = req.app.locals;
    if (!hubspot.enabled()) {
        return res.json({ success: true, skipped: true, reason: 'HUBSPOT_ACCESS_TOKEN unset' });
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .select('auth0_user_id, email, nickname, dvm_name, phone_number, subscription_status, subscription_interval, subscription_end_date, plan_label')
            .in('subscription_interval', ['trial', 'stripe_trial'])
            .not('email', 'is', null)
            .limit(80);

        if (error) throw error;
        const users = data || [];
        if (users.length) {
            const ids = users.map((u) => u.auth0_user_id);
            const { data: events, error: evErr } = await supabase
                .from('usage_events')
                .select('auth0_user_id, event_type, created_at')
                .in('auth0_user_id', ids);
            if (evErr) console.error('[hubspot-sync] usage_events:', evErr.message);
            const byUser = {};
            for (const ev of events || []) {
                const row = byUser[ev.auth0_user_id] || { soaps: 0, queries: 0, last: null };
                if (ev.event_type === 'petquery') row.queries += 1;
                else row.soaps += 1;
                if (!row.last || ev.created_at > row.last) row.last = ev.created_at;
                byUser[ev.auth0_user_id] = row;
            }
            for (const user of users) {
                const u = byUser[user.auth0_user_id];
                if (!u) continue;
                user.pw_soaps = u.soaps;
                user.pw_queries = u.queries;
                user.pw_last_active = u.last;
            }
        }
        const result = await hubspot.syncTrialStates(users);
        return res.json({ success: true, candidates: users.length, ...result });
    } catch (err) {
        console.error('HubSpot trial cron failed:', err);
        return res.status(500).json({ error: 'HubSpot trial cron failed', details: err.message });
    }
}

router.get('/hubspot-sync', verifyCronAuth, runHubspotSync);
router.post('/hubspot-sync', verifyCronAuth, runHubspotSync);

module.exports = router;
module.exports.verifyCronAuth = verifyCronAuth;
