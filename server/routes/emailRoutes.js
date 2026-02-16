const express = require('express');
const router = express.Router();
const { 
    sendWelcomeEmail, 
    sendTrialActivatedEmail,
    sendTrialMidwayEmail, 
    sendTrialEndingEmail,
    sendSubscriptionConfirmedEmail
} = require('../utils/emailService');

/**
 * POST /email/welcome
 * Send welcome email to newly created user
 * Called from client after user creation in Supabase
 */
router.post('/welcome', async (req, res) => {
    console.log('Welcome email endpoint hit:', req.body);
    const { supabase } = req.app.locals;
    const { auth0_user_id, email, nickname } = req.body;

    if (!auth0_user_id || !email) {
        console.log('Missing required fields:', { auth0_user_id, email });
        return res.status(400).json({ 
            error: 'Missing required fields: auth0_user_id, email' 
        });
    }

    try {
        // Send the welcome email directly (skip database check to avoid timeout)
        const result = await sendWelcomeEmail(supabase, {
            auth0_user_id,
            email,
            nickname
        });

        if (result.success) {
            // Update the database to mark email as sent (fire and forget)
            supabase
                .from('users')
                .update({ welcome_email_sent_at: new Date().toISOString() })
                .eq('auth0_user_id', auth0_user_id)
                .then(() => console.log('Marked welcome email as sent'))
                .catch(err => console.error('Failed to mark welcome email sent:', err));

            return res.json({ success: true, message: 'Welcome email sent' });
        } else {
            return res.status(500).json({ 
                error: 'Failed to send email', 
                details: result.error 
            });
        }
    } catch (err) {
        console.error('Welcome email error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /email/test/:type
 * Test endpoint to preview any email template
 * Only available in development
 */
router.post('/test/:type', async (req, res) => {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Test endpoints disabled in production' });
    }

    const { supabase } = req.app.locals;
    const { type } = req.params;
    const { email, nickname = 'Test User' } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const mockUser = {
        auth0_user_id: 'test-user',
        email,
        nickname
    };

    // Mock dates for testing (14-day trial)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 days from now (midway point)

    const subscriptionEndDate = new Date();
    subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30); // 30 days from now

    let result;

    try {
        switch (type) {
            case 'welcome':
                result = await sendWelcomeEmail(supabase, mockUser);
                break;
            case 'trial-activated':
                result = await sendTrialActivatedEmail(supabase, mockUser, trialEndDate.toISOString());
                break;
            case 'trial-midway':
                result = await sendTrialMidwayEmail(supabase, mockUser, 7, trialEndDate.toISOString());
                break;
            case 'trial-ending':
                const endingSoon = new Date();
                endingSoon.setDate(endingSoon.getDate() + 3);
                result = await sendTrialEndingEmail(supabase, mockUser, 3, endingSoon.toISOString());
                break;
            case 'subscription-confirmed':
                result = await sendSubscriptionConfirmedEmail(supabase, mockUser, 'monthly', subscriptionEndDate.toISOString());
                break;
            default:
                return res.status(400).json({ 
                    error: 'Invalid email type',
                    validTypes: ['welcome', 'trial-activated', 'trial-midway', 'trial-ending', 'subscription-confirmed']
                });
        }

        if (result.success) {
            return res.json({ success: true, message: `${type} email sent to ${email}` });
        } else {
            return res.status(500).json({ error: 'Failed to send email', details: result.error });
        }
    } catch (err) {
        console.error('Test email error:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

module.exports = router;
