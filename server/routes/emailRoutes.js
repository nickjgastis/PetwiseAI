const express = require('express');
const router = express.Router();
const {
    sendWelcomeEmail,
    sendSubscriptionConfirmedEmail,
    sendAdminSignupNotification
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
            // Mark email as sent. Awaited so it persists on Vercel serverless (the
            // function freezes after the response, dropping non-awaited writes) —
            // this is the one-shot guard that prevents duplicate welcome/admin emails.
            try {
                await supabase
                    .from('users')
                    .update({ welcome_email_sent_at: new Date().toISOString() })
                    .eq('auth0_user_id', auth0_user_id);
                console.log('Marked welcome email as sent');
            } catch (err) {
                console.error('Failed to mark welcome email sent:', err);
            }

            // Notify the team of the new free signup. Awaited (not fire-and-forget)
            // so it actually sends on Vercel serverless, which freezes the function
            // after the response is returned. Wrapped so a failure never breaks signup.
            // Gated by the same one-shot path as the welcome email → one notice per account.
            try {
                const notify = await sendAdminSignupNotification({ auth0_user_id, email, nickname, createdAt: new Date().toISOString() });
                console.log('Admin signup notification:', notify.success ? 'sent' : notify.error);
            } catch (err) {
                console.error('Admin signup notification failed:', err);
            }

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

    const subscriptionEndDate = new Date();
    subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30); // 30 days from now

    let result;

    try {
        switch (type) {
            case 'welcome':
                result = await sendWelcomeEmail(supabase, mockUser);
                break;
            case 'subscription-confirmed':
                result = await sendSubscriptionConfirmedEmail(supabase, mockUser, 'monthly', subscriptionEndDate.toISOString());
                break;
            default:
                return res.status(400).json({
                    error: 'Invalid email type',
                    validTypes: ['welcome', 'subscription-confirmed']
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
