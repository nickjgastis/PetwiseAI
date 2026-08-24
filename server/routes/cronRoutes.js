const express = require('express');
const router = express.Router();
const { sendGetStartedEmail, sendDiscountEmail } = require('../utils/emailService');

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

module.exports = router;
module.exports.verifyCronAuth = verifyCronAuth;
