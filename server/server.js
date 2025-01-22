// ================ IMPORTS AND SETUP ================
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// ================ APP INITIALIZATION ================
const app = express();
const stripe = Stripe(
    process.env.NODE_ENV === 'production'
        ? process.env.STRIPE_SECRET_KEY_LIVE
        : process.env.STRIPE_SECRET_KEY
);
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Middleware setup
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Add these headers to all responses
app.use((req, res, next) => {
    const allowedOrigins = [
        'https://petwise.vet',
        'https://www.petwise.vet',
        'http://localhost:3000'
    ];
    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Update existing CORS middleware
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            'https://petwise.vet',
            'https://www.petwise.vet',
            'http://localhost:3000'
        ];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
}));

// ================ CONSTANTS ================
const PRICE_IDS = {
    monthly: process.env.NODE_ENV === 'production'
        ? 'price_1QdhwtFpF2XskoMK2RjFj916'  // Live monthly price
        : 'price_1QcwX5FpF2XskoMKrTsq1kHc',  // Test monthly price
    yearly: process.env.NODE_ENV === 'production'
        ? 'price_1Qdhz7FpF2XskoMK7O7GjJTn'   // Live yearly price
        : 'price_1QcwYWFpF2XskoMKH9MJisoy',   // Test yearly price
    test: process.env.NODE_ENV === 'production'
        ? 'price_1Qdje9FpF2XskoMKcC5p3bwR'
        : 'price_1QcwYWFpF2XskoMKH9MJisoy'  // Using yearly test price as fallback
};
const TRIAL_DAYS = 14;  // Changed from TRIAL_MINUTES
const REPORT_LIMITS = {
    trial: 10,
    monthly: Infinity,
    yearly: Infinity
};

// ================ CHECKOUT ENDPOINT ================
// Handles creation of Stripe checkout sessions
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { user, planType } = req.body;
        const priceId = PRICE_IDS[planType];

        if (!priceId) {
            throw new Error('Invalid plan type');
        }

        // Find or create customer
        let customer;
        const existingCustomers = await stripe.customers.list({
            email: user.email,
            limit: 1
        });

        if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
        } else {
            customer = await stripe.customers.create({
                email: user.email,
                metadata: { auth0_user_id: user.sub }
            });
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            payment_method_types: ['card'],
            mode: 'subscription',
            allow_promotion_codes: true,
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            success_url: process.env.NODE_ENV === 'production'
                ? 'https://petwise.vet/dashboard'
                : 'http://localhost:3000/dashboard',
            cancel_url: process.env.NODE_ENV === 'production'
                ? 'https://petwise.vet/dashboard'
                : 'http://localhost:3000/dashboard',
            client_reference_id: user.sub
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================ WEBHOOK HANDLER ================
// Processes Stripe webhook events
app.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.NODE_ENV === 'production'
        ? process.env.STRIPE_WEBHOOK_SECRET_LIVE
        : process.env.STRIPE_WEBHOOK_SECRET;

    console.log('Webhook received:', {
        hasSignature: !!sig,
        hasBody: !!req.body,
        env: process.env.NODE_ENV,
        webhookSecret: webhookSecret ? 'present' : 'missing'
    });

    try {
        const event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            webhookSecret
        );

        console.log('Event Type:', event.type);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            console.log('Checkout Session:', session);

            try {
                const subscription = await stripe.subscriptions.retrieve(session.subscription);
                console.log('Subscription:', subscription);

                const priceId = subscription.items.data[0].price.id;
                console.log('Price ID:', priceId);

                // Simplified subscription type matching
                const subscriptionInterval = priceId === PRICE_IDS.monthly ? 'monthly' : 'yearly';
                console.log('Subscription Interval:', subscriptionInterval);

                const updateData = {
                    subscription_status: 'active',
                    subscription_interval: subscriptionInterval,
                    stripe_customer_id: session.customer,
                    subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
                    reports_used_today: 0,
                    last_report_date: new Date().toISOString().split('T')[0],
                    has_used_trial: true,
                    cancel_at_period_end: false
                };

                console.log('Updating user with data:', {
                    auth0_user_id: session.client_reference_id,
                    ...updateData
                });

                const { data, error } = await supabase
                    .from('users')
                    .update(updateData)
                    .eq('auth0_user_id', session.client_reference_id)
                    .select();

                if (error) {
                    console.error('Supabase update error:', error);
                    throw error;
                }

                console.log('Update successful:', data);
            } catch (error) {
                console.error('Subscription processing error:', error);
                return res.status(500).json({ error: error.message });
            }
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Webhook Error:', err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

// ================ SUBSCRIPTION CANCELLATION ENDPOINT ================
// Handles subscription cancellation requests
app.post('/cancel-subscription', async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // Get user's stripe customer id
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('stripe_customer_id')
            .eq('auth0_user_id', user_id)
            .single();

        if (userError || !userData?.stripe_customer_id) {
            return res.status(404).json({ error: 'No subscription found' });
        }

        // Get active subscription
        const subscriptions = await stripe.subscriptions.list({
            customer: userData.stripe_customer_id,
            limit: 1,
        });

        if (subscriptions.data.length === 0) {
            return res.status(404).json({ error: 'No active subscription found' });
        }

        // Cancel subscription at period end
        const subscription = await stripe.subscriptions.update(
            subscriptions.data[0].id,
            { cancel_at_period_end: true }
        );

        // Update database
        const { error: updateError } = await supabase
            .from('users')
            .update({
                subscription_status: 'active',
                cancel_at_period_end: true,
                subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString()
            })
            .eq('auth0_user_id', user_id);

        if (updateError) {
            throw updateError;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(400).json({ error: error.message });
    }
});

// ================ TRIAL ENDPOINT ================
app.post('/activate-trial', async (req, res) => {
    try {
        const { user_id, emailOptOut = false } = req.body;
        console.log('Trial activation request:', { user_id, emailOptOut });

        if (!user_id) {
            throw new Error('user_id is required');
        }

        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);

        const updateData = {
            subscription_status: 'active',
            subscription_interval: 'trial',
            subscription_end_date: trialEndDate.toISOString(),
            has_used_trial: true,
            reports_used_today: 0,
            last_report_date: new Date().toISOString().split('T')[0],
            email_opt_out: emailOptOut
        };

        console.log('Updating user with data:', updateData);

        const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('auth0_user_id', user_id)
            .select();

        if (error) {
            console.error('Supabase update error:', error);
            throw error;
        }

        console.log('Trial activation successful:', data);
        res.json(data);
    } catch (error) {
        console.error('Trial activation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add this new endpoint for canceling trials
app.post('/cancel-trial', async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // Update user's trial status
        const { error: updateError } = await supabase
            .from('users')
            .update({
                subscription_status: 'inactive',
                subscription_end_date: new Date().toISOString() // End trial immediately
            })
            .eq('auth0_user_id', user_id);

        if (updateError) throw updateError;

        res.json({ success: true });
    } catch (error) {
        console.error('Cancel trial error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Add this function before the server startup section
async function checkTrialExpirations() {
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('users')
        .update({ subscription_status: 'inactive' })
        .lt('subscription_end_date', now)
        .eq('subscription_status', 'active')
        .select();

    if (error) {
        console.error('Error checking trial expirations:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log(`Deactivated ${data.length} expired subscriptions`);
    }
}

// Add this new middleware function
async function checkReportLimit(req, res, next) {
    try {
        const { user } = req.body;
        if (!user?.sub) {
            return res.status(400).json({ error: 'User ID required' });
        }

        const { data: userData, error } = await supabase
            .from('users')
            .select('subscription_interval, reports_used_today, last_report_date')
            .eq('auth0_user_id', user.sub)
            .single();

        if (error) throw error;

        // Only check limits for trial users
        if (userData.subscription_interval === 'trial') {
            if (userData.reports_used_today >= REPORT_LIMITS.trial) {
                return res.status(403).json({
                    error: 'Trial report limit reached',
                    limit: REPORT_LIMITS.trial,
                    used: userData.reports_used_today
                });
            }
        }

        req.reportData = {
            currentCount: userData.reports_used_today,
            limit: userData.subscription_interval === 'trial' ? REPORT_LIMITS.trial : Infinity
        };
        next();
    } catch (error) {
        console.error('Check report limit error:', error);
        res.status(500).json({ error: error.message });
    }
}

// Add to your existing report generation endpoint
app.post('/generate-report', checkReportLimit, async (req, res) => {
    try {
        // Your existing report generation logic here

        // After successful generation, increment the counter
        await supabase
            .from('users')
            .update({
                reports_used_today: req.reportData.currentCount + 1
            })
            .eq('auth0_user_id', req.body.user.sub);

        res.json({ /* your response */ });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint to check user's subscription status
app.get('/check-subscription/:userId', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('subscription_type, subscription_status, reports_used_today, subscription_interval')
            .eq('auth0_user_id', req.params.userId)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add near your other routes
app.get('/', (req, res) => {
    res.json({
        message: 'PetWise API is running',
        status: 'healthy',
        version: '1.0.0',
        endpoints: [
            '/check-subscription/:userId',
            '/create-checkout-session',
            '/cancel-subscription',
            '/cancel-trial',
            '/activate-trial',
            '/webhook',
            '/generate-report'
        ]
    });
});

// Add this new debug endpoint to test the reset
app.get('/test-reset/:userId', async (req, res) => {
    try {
        const now = new Date();
        const timeKey = now.toISOString().split('T')[0];

        // First check expiration
        const { data: expirationCheck } = await supabase
            .from('users')
            .select('subscription_end_date')
            .eq('auth0_user_id', req.params.userId)
            .single();

        if (expirationCheck?.subscription_end_date < now.toISOString()) {
            await supabase
                .from('users')
                .update({ subscription_status: 'inactive' })
                .eq('auth0_user_id', req.params.userId);
        }

        // Then reset reports
        const { data: updateData, error } = await supabase
            .from('users')
            .update({
                reports_used_today: 0,
                last_report_date: timeKey
            })
            .eq('auth0_user_id', req.params.userId)
            .select();

        if (error) throw error;

        console.log('Reset result:', updateData);
        res.json(updateData);
    } catch (error) {
        console.error('Test reset error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add this test endpoint
app.post('/test-expiration/:userId', async (req, res) => {
    try {
        // Set subscription to expire in 1 minute
        const expirationDate = new Date(Date.now() + 1 * 60 * 1000);

        const { data, error } = await supabase
            .from('users')
            .update({
                subscription_status: 'active',
                subscription_end_date: expirationDate.toISOString()
            })
            .eq('auth0_user_id', req.params.userId)
            .select();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this test endpoint after your other test endpoints
app.post('/test-cancellation-flow/:userId', async (req, res) => {
    try {
        const now = new Date();
        const futureDate = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes in future

        // First set up a subscription that's cancelled but not yet expired
        const { data: setupData, error: setupError } = await supabase
            .from('users')
            .update({
                subscription_status: 'active',
                cancel_at_period_end: true,
                subscription_end_date: futureDate.toISOString()
            })
            .eq('auth0_user_id', req.params.userId)
            .select();

        if (setupError) throw setupError;

        console.log('Initial setup:', setupData);

        // Wait 3 seconds then check if checkTrialExpirations catches it
        setTimeout(async () => {
            await checkTrialExpirations();

            // Get final state
            const { data: finalData } = await supabase
                .from('users')
                .select('subscription_status, subscription_end_date, cancel_at_period_end')
                .eq('auth0_user_id', req.params.userId)
                .single();

            console.log('Final state:', finalData);
        }, 3000);

        res.json({
            message: 'Test started. Check server logs.',
            initialState: setupData[0]
        });
    } catch (error) {
        console.error('Test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add this new endpoint for account deletion
app.post('/delete-account', async (req, res) => {
    try {
        const { user_id } = req.body;
        console.log('Attempting to delete user:', user_id);

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // First check if user exists in Supabase
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('auth0_user_id', user_id)
            .single();

        console.log('Found user data:', userData);

        if (userError) {
            console.error('Error finding user:', userError);
            throw userError;
        }

        // Delete user data from Supabase with explicit response checking
        const { data: deleteData, error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('auth0_user_id', user_id)
            .select(); // Add .select() to get back the deleted row

        console.log('Delete response:', { deleteData, deleteError }); // Add this log

        if (deleteError) {
            console.error('Supabase delete error:', deleteError);
            throw deleteError;
        }

        if (!deleteData || deleteData.length === 0) {
            throw new Error('User deletion failed - no rows deleted');
        }

        // Only try to delete Stripe data if it exists
        if (userData?.stripe_customer_id) {
            try {
                console.log('Starting Stripe deletion for customer:', userData.stripe_customer_id);

                const subscriptions = await stripe.subscriptions.list({
                    customer: userData.stripe_customer_id,
                    limit: 1,
                });
                console.log('Found subscriptions:', subscriptions.data);

                if (subscriptions.data.length > 0) {
                    console.log('Cancelling subscription:', subscriptions.data[0].id);
                    await stripe.subscriptions.cancel(subscriptions.data[0].id);
                    console.log('Subscription cancelled successfully');
                }

                console.log('Deleting Stripe customer');
                await stripe.customers.del(userData.stripe_customer_id);
                console.log('Stripe customer deleted successfully');
            } catch (stripeError) {
                console.error('Stripe deletion error:', stripeError);
                throw stripeError; // Throw error to see full details
            }
        }

        res.json({
            success: true,
            deletedUser: deleteData[0]
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});


// ================ SERVER STARTUP ================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Available endpoints:');
    app._router.stack.forEach(r => {
        if (r.route && r.route.path) {
            console.log(`${Object.keys(r.route.methods)} ${r.route.path}`);
        }
    });
});

// Add a manual reset endpoint for testing
app.post('/manual-reset', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .update({
                reports_used_today: 0,
                last_report_date: new Date().toISOString().split('T')[0]
            })
            .not('subscription_status', 'eq', 'inactive');

        if (error) throw error;
        res.json({ message: 'Manual reset successful', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

