const express = require('express');
const router = express.Router();
const {
    sendTrialMidwayEmail,
    sendTrialEndingEmail
} = require('../utils/emailService');

/**
 * Verify cron request is from Vercel
 * In production, Vercel adds the CRON_SECRET to the Authorization header
 */
function verifyCronAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    // In development, allow requests without auth
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }

    // Vercel sends: Authorization: Bearer <CRON_SECRET>
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
}

/**
 * GET /cron/trial-reminders-midway
 * Send reminder emails to users at day 15 of their trial
 * Scheduled to run daily via Vercel Cron
 */
router.get('/trial-reminders-midway', verifyCronAuth, async (req, res) => {
    const { supabase } = req.app.locals;
    const results = { sent: 0, skipped: 0, errors: [] };

    try {
        // Calculate the target date range for day 15
        // Users who started their trial 15 days ago (subscription_end_date is 15 days from now)
        const now = new Date();
        const targetDateMin = new Date(now);
        targetDateMin.setDate(targetDateMin.getDate() + 14); // 14 days from now (start of window)
        targetDateMin.setHours(0, 0, 0, 0);

        const targetDateMax = new Date(now);
        targetDateMax.setDate(targetDateMax.getDate() + 16); // 16 days from now (end of window)
        targetDateMax.setHours(23, 59, 59, 999);

        // Find trial users in the midway window who haven't received this email
        const { data: users, error } = await supabase
            .from('users')
            .select('id, auth0_user_id, email, nickname, dvm_name, subscription_end_date, trial_midway_email_sent_at')
            .eq('subscription_status', 'active')
            .eq('subscription_interval', 'trial')
            .is('trial_midway_email_sent_at', null)
            .gte('subscription_end_date', targetDateMin.toISOString())
            .lte('subscription_end_date', targetDateMax.toISOString());

        if (error) {
            console.error('Error fetching trial users:', error);
            return res.status(500).json({ error: 'Database query failed', details: error });
        }

        console.log(`Found ${users?.length || 0} users for midway trial reminder`);

        // Send emails to each user
        for (const user of users || []) {
            try {
                const trialEndDate = new Date(user.subscription_end_date);
                const daysLeft = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));

                const result = await sendTrialMidwayEmail(supabase, user, daysLeft, user.subscription_end_date);

                if (result.success) {
                    // Mark email as sent
                    await supabase
                        .from('users')
                        .update({ trial_midway_email_sent_at: new Date().toISOString() })
                        .eq('id', user.id);
                    results.sent++;
                } else if (result.reason === 'opted_out') {
                    // Mark as sent to avoid retrying
                    await supabase
                        .from('users')
                        .update({ trial_midway_email_sent_at: new Date().toISOString() })
                        .eq('id', user.id);
                    results.skipped++;
                } else {
                    results.errors.push({ userId: user.id, error: result.error });
                }
            } catch (err) {
                console.error(`Error sending midway email to ${user.email}:`, err);
                results.errors.push({ userId: user.id, error: err.message });
            }
        }

        console.log('Midway reminder results:', results);
        return res.json({
            success: true,
            message: `Processed ${users?.length || 0} users`,
            results
        });
    } catch (err) {
        console.error('Cron job error:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

/**
 * GET /cron/trial-reminders-ending
 * Send reminder emails to users 3 days before LEGACY trial ends
 * Scheduled to run daily via Vercel Cron
 * NOTE: This is for legacy in-house trials only (subscription_interval='trial')
 */
router.get('/trial-reminders-ending', verifyCronAuth, async (req, res) => {
    const { supabase } = req.app.locals;
    const results = { sent: 0, skipped: 0, errors: [] };

    try {
        // Calculate the target date range for 3 days before expiry
        const now = new Date();
        const targetDateMin = new Date(now);
        targetDateMin.setDate(targetDateMin.getDate() + 2); // 2 days from now (start of window)
        targetDateMin.setHours(0, 0, 0, 0);

        const targetDateMax = new Date(now);
        targetDateMax.setDate(targetDateMax.getDate() + 4); // 4 days from now (end of window)
        targetDateMax.setHours(23, 59, 59, 999);

        // Find LEGACY trial users in the ending window who haven't received this email
        const { data: users, error } = await supabase
            .from('users')
            .select('id, auth0_user_id, email, nickname, dvm_name, subscription_end_date, trial_ending_email_sent_at')
            .eq('subscription_status', 'active')
            .eq('subscription_interval', 'trial')  // Legacy trial only
            .is('trial_ending_email_sent_at', null)
            .gte('subscription_end_date', targetDateMin.toISOString())
            .lte('subscription_end_date', targetDateMax.toISOString());

        if (error) {
            console.error('Error fetching trial users:', error);
            return res.status(500).json({ error: 'Database query failed', details: error });
        }

        console.log(`Found ${users?.length || 0} users for ending trial reminder (legacy)`);

        // Send emails to each user
        for (const user of users || []) {
            try {
                const trialEndDate = new Date(user.subscription_end_date);
                const daysLeft = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));

                const result = await sendTrialEndingEmail(supabase, user, daysLeft, user.subscription_end_date);

                if (result.success) {
                    // Mark email as sent
                    await supabase
                        .from('users')
                        .update({ trial_ending_email_sent_at: new Date().toISOString() })
                        .eq('id', user.id);
                    results.sent++;
                } else if (result.reason === 'opted_out') {
                    // Mark as sent to avoid retrying
                    await supabase
                        .from('users')
                        .update({ trial_ending_email_sent_at: new Date().toISOString() })
                        .eq('id', user.id);
                    results.skipped++;
                } else {
                    results.errors.push({ userId: user.id, error: result.error });
                }
            } catch (err) {
                console.error(`Error sending ending email to ${user.email}:`, err);
                results.errors.push({ userId: user.id, error: err.message });
            }
        }

        console.log('Ending reminder results:', results);
        return res.json({
            success: true,
            message: `Processed ${users?.length || 0} users`,
            results
        });
    } catch (err) {
        console.error('Cron job error:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

// ================================================================================
// STRIPE TRIAL CRON JOBS (14-day trial with card)
// ================================================================================

/**
 * GET /cron/stripe-trial-reminders-midway
 * Send reminder emails to Stripe trial users at day 7 (7 days remaining)
 * Scheduled to run daily via Vercel Cron
 */
router.get('/stripe-trial-reminders-midway', verifyCronAuth, async (req, res) => {
    const { supabase } = req.app.locals;
    const results = { sent: 0, skipped: 0, errors: [] };

    try {
        // Calculate the target date range for day 7 (7 days remaining in 14-day trial)
        const now = new Date();
        const targetDateMin = new Date(now);
        targetDateMin.setDate(targetDateMin.getDate() + 6); // 6 days from now (start of window)
        targetDateMin.setHours(0, 0, 0, 0);

        const targetDateMax = new Date(now);
        targetDateMax.setDate(targetDateMax.getDate() + 8); // 8 days from now (end of window)
        targetDateMax.setHours(23, 59, 59, 999);

        // Find Stripe trial users in the midway window who haven't received this email
        const { data: users, error } = await supabase
            .from('users')
            .select('id, auth0_user_id, email, nickname, dvm_name, subscription_end_date, stripe_trial_midway_email_sent_at')
            .eq('subscription_status', 'active')
            .eq('subscription_interval', 'stripe_trial')  // Stripe trial only
            .is('stripe_trial_midway_email_sent_at', null)
            .gte('subscription_end_date', targetDateMin.toISOString())
            .lte('subscription_end_date', targetDateMax.toISOString());

        if (error) {
            console.error('Error fetching Stripe trial users:', error);
            return res.status(500).json({ error: 'Database query failed', details: error });
        }

        console.log(`Found ${users?.length || 0} users for Stripe trial midway reminder`);

        // Send emails to each user
        for (const user of users || []) {
            try {
                const trialEndDate = new Date(user.subscription_end_date);
                const daysLeft = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));

                const result = await sendTrialMidwayEmail(supabase, user, daysLeft, user.subscription_end_date);

                if (result.success) {
                    // Mark email as sent
                    await supabase
                        .from('users')
                        .update({ stripe_trial_midway_email_sent_at: new Date().toISOString() })
                        .eq('id', user.id);
                    results.sent++;
                } else if (result.reason === 'opted_out') {
                    // Mark as sent to avoid retrying
                    await supabase
                        .from('users')
                        .update({ stripe_trial_midway_email_sent_at: new Date().toISOString() })
                        .eq('id', user.id);
                    results.skipped++;
                } else {
                    results.errors.push({ userId: user.id, error: result.error });
                }
            } catch (err) {
                console.error(`Error sending Stripe trial midway email to ${user.email}:`, err);
                results.errors.push({ userId: user.id, error: err.message });
            }
        }

        console.log('Stripe trial midway reminder results:', results);
        return res.json({
            success: true,
            message: `Processed ${users?.length || 0} Stripe trial users`,
            results
        });
    } catch (err) {
        console.error('Cron job error:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

/**
 * GET /cron/stripe-trial-reminders-ending
 * Send reminder emails to Stripe trial users 2 days before trial ends
 * Scheduled to run daily via Vercel Cron
 */
router.get('/stripe-trial-reminders-ending', verifyCronAuth, async (req, res) => {
    const { supabase } = req.app.locals;
    const results = { sent: 0, skipped: 0, errors: [] };

    try {
        // Calculate the target date range for 2 days before expiry
        const now = new Date();
        const targetDateMin = new Date(now);
        targetDateMin.setDate(targetDateMin.getDate() + 1); // 1 day from now (start of window)
        targetDateMin.setHours(0, 0, 0, 0);

        const targetDateMax = new Date(now);
        targetDateMax.setDate(targetDateMax.getDate() + 3); // 3 days from now (end of window)
        targetDateMax.setHours(23, 59, 59, 999);

        // Find Stripe trial users in the ending window who haven't received this email
        const { data: users, error } = await supabase
            .from('users')
            .select('id, auth0_user_id, email, nickname, dvm_name, subscription_end_date, stripe_trial_ending_email_sent_at')
            .eq('subscription_status', 'active')
            .eq('subscription_interval', 'stripe_trial')  // Stripe trial only
            .is('stripe_trial_ending_email_sent_at', null)
            .gte('subscription_end_date', targetDateMin.toISOString())
            .lte('subscription_end_date', targetDateMax.toISOString());

        if (error) {
            console.error('Error fetching Stripe trial users:', error);
            return res.status(500).json({ error: 'Database query failed', details: error });
        }

        console.log(`Found ${users?.length || 0} users for Stripe trial ending reminder`);

        // Send emails to each user
        for (const user of users || []) {
            try {
                const trialEndDate = new Date(user.subscription_end_date);
                const daysLeft = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));

                const result = await sendTrialEndingEmail(supabase, user, daysLeft, user.subscription_end_date);

                if (result.success) {
                    // Mark email as sent
                    await supabase
                        .from('users')
                        .update({ stripe_trial_ending_email_sent_at: new Date().toISOString() })
                        .eq('id', user.id);
                    results.sent++;
                } else if (result.reason === 'opted_out') {
                    // Mark as sent to avoid retrying
                    await supabase
                        .from('users')
                        .update({ stripe_trial_ending_email_sent_at: new Date().toISOString() })
                        .eq('id', user.id);
                    results.skipped++;
                } else {
                    results.errors.push({ userId: user.id, error: result.error });
                }
            } catch (err) {
                console.error(`Error sending Stripe trial ending email to ${user.email}:`, err);
                results.errors.push({ userId: user.id, error: err.message });
            }
        }

        console.log('Stripe trial ending reminder results:', results);
        return res.json({
            success: true,
            message: `Processed ${users?.length || 0} Stripe trial users`,
            results
        });
    } catch (err) {
        console.error('Cron job error:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

module.exports = router;
