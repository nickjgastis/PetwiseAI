// ================ IMPORTS AND SETUP ================
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const cron = require('node-cron');

// ================ APP INITIALIZATION ================
const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Middleware setup
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Place CORS configuration BEFORE any routes
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? 'https://www.petwise.vet'
        : 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
}));

// ================ CONSTANTS ================
const PRICE_IDS = {
    singleUserMonthly: 'price_1QMxUrFpF2XskoMKxt7UOtMV',
    singleUserYearly: 'price_1QMxVTFpF2XskoMKvEIdvxEj',

    multiUserMonthly: 'price_1QNJ9RFpF2XskoMKnvtvwX6C',
    multiUserYearly: 'price_1QNJB9FpF2XskoMKDeUPWNXp',

    clinicMonthly: 'price_1QNJFEFpF2XskoMKVpGm131E',
    clinicYearly: 'price_1QNJG0FpF2XskoMKqNG8CXjh'
};
const TRIAL_DAYS = 1;  // Changed from TRIAL_MINUTES
const REPORT_LIMITS = {
    trial: 10,
    singleUser: 25,
    multiUser: 120,
    clinic: 400
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
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            success_url: process.env.NODE_ENV === 'production'
                ? 'https://www.petwise.vet/dashboard'
                : 'http://localhost:3000/dashboard',
            cancel_url: process.env.NODE_ENV === 'production'
                ? 'https://www.petwise.vet/dashboard'
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

    try {
        // Use different webhook secrets based on environment
        const webhookSecret = process.env.NODE_ENV === 'production'
            ? process.env.STRIPE_WEBHOOK_SECRET_DEPLOYED
            : process.env.STRIPE_WEBHOOK_SECRET;

        console.log('Using webhook secret for:', process.env.NODE_ENV);

        const event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            webhookSecret
        );

        console.log('2. Event type:', event.type);

        // Handle checkout.session.completed event
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            console.log('3. Checkout session:', {
                id: session.id,
                customer: session.customer,
                subscription: session.subscription,
                clientRef: session.client_reference_id
            });

            try {
                const subscription = await stripe.subscriptions.retrieve(session.subscription);

                // Get the price ID and determine subscription type
                const priceId = subscription.items.data[0].price.id;
                let subscriptionType;

                // Map price IDs to subscription types
                if (priceId === PRICE_IDS.singleUserMonthly || priceId === PRICE_IDS.singleUserYearly) {
                    subscriptionType = 'singleUser';
                } else if (priceId === PRICE_IDS.multiUserMonthly || priceId === PRICE_IDS.multiUserYearly) {
                    subscriptionType = 'multiUser';
                } else if (priceId === PRICE_IDS.clinicMonthly || priceId === PRICE_IDS.clinicYearly) {
                    subscriptionType = 'clinic';
                } else {
                    throw new Error(`Unknown price ID: ${priceId}`);
                }

                console.log('Processing subscription:', {
                    priceId,
                    subscriptionType,
                    userId: session.client_reference_id
                });

                const updateData = {
                    subscription_status: 'active',
                    subscription_type: subscriptionType,
                    stripe_customer_id: session.customer,
                    subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
                    reports_used_today: 0,
                    last_report_date: new Date().toISOString().split('T')[0]
                };

                const { data, error } = await supabase
                    .from('users')
                    .update(updateData)
                    .eq('auth0_user_id', session.client_reference_id)
                    .select();

                if (error) {
                    console.error('Supabase update error:', error);
                    throw error;
                }

                console.log('Subscription processed successfully:', {
                    subscriptionType,
                    userId: session.client_reference_id,
                    data
                });
            } catch (error) {
                console.error('Subscription processing error:', error);
                return res.status(400).json({ error: error.message });
            }
        }

        // Handle subscription creation event
        if (event.type === 'customer.subscription.created') {
            const subscription = event.data.object;
            try {
                const customer = await stripe.customers.retrieve(subscription.customer);

                // Get current user data
                const { data: userData } = await supabase
                    .from('users')
                    .select('subscription_end_date, has_used_trial')
                    .eq('auth0_user_id', customer.metadata.auth0_user_id)
                    .single();

                // If this is a free trial, don't update the end date
                const isTrial = userData?.subscription_end_date && !userData?.has_used_trial;

                const updateData = {
                    subscription_status: 'active',
                    stripe_customer_id: subscription.customer,
                    // Only update subscription_end_date for paid subscriptions
                    ...(isTrial ? {} : {
                        subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString()
                    })
                };

                console.log('Updating user with data:', updateData);

                const { error } = await supabase
                    .from('users')
                    .update(updateData)
                    .eq('auth0_user_id', customer.metadata.auth0_user_id);

                if (error) throw error;
            } catch (error) {
                console.error('Error processing subscription:', error);
            }
        }

        // Handle subscription updates and deletions
        if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object;
            console.log('Subscription update/deletion:', {
                customer: subscription.customer,
                status: subscription.status,
                currentPeriodEnd: subscription.current_period_end
            });

            try {
                const customer = await stripe.customers.retrieve(subscription.customer);

                // Set status based on subscription status
                const status = subscription.status === 'active' ? 'active' : 'inactive';

                const updateData = {
                    subscription_status: status,
                    subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
                    cancel_at_period_end: subscription.cancel_at_period_end || false
                };

                console.log('Updating user with data:', updateData);

                const { error } = await supabase
                    .from('users')
                    .update(updateData)
                    .eq('auth0_user_id', customer.metadata.auth0_user_id);

                if (error) {
                    console.error('Supabase update error:', error);
                    throw error;
                }
            } catch (error) {
                console.error('Error processing subscription update:', error);
                return res.status(400).json({ error: error.message });
            }
        }

        return res.json({ received: true });
    } catch (err) {
        console.error('Webhook Error:', err.message);
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
        const { user_id } = req.body;
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);

        const updateData = {
            subscription_status: 'active',
            subscription_type: 'trial',
            subscription_end_date: trialEndDate.toISOString(),
            has_used_trial: true,
            reports_used_today: 0,
            last_report_date: new Date().toISOString().split('T')[0]
        };

        const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('auth0_user_id', user_id)
            .select();

        if (error) throw error;
        console.log('Trial activated:', data);
        res.json({ success: true });
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
            .select('subscription_type, reports_used_today, last_report_date')
            .eq('auth0_user_id', user.sub)
            .single();

        if (error) throw error;

        // Reset counter if it's a new day
        const today = new Date().toISOString().split('T')[0];
        if (userData.last_report_date !== today) {
            await supabase
                .from('users')
                .update({
                    reports_used_today: 0,
                    last_report_date: today
                })
                .eq('auth0_user_id', user.sub);
            userData.reports_used_today = 0;
        }

        // Get limit based on subscription type
        let limit;
        switch (userData.subscription_type) {
            case 'trial': limit = REPORT_LIMITS.trial; break;
            case 'singleUser': limit = REPORT_LIMITS.singleUser; break;
            case 'multiUser': limit = REPORT_LIMITS.multiUser; break;
            case 'clinic': limit = REPORT_LIMITS.clinic; break;
            default: limit = 0;
        }

        if (userData.reports_used_today >= limit) {
            return res.status(403).json({
                error: 'Daily report limit reached',
                limit,
                used: userData.reports_used_today
            });
        }

        // Attach to request for later use
        req.reportData = {
            currentCount: userData.reports_used_today,
            limit
        };
        next();
    } catch (error) {
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
            .select('subscription_type, subscription_status, reports_used_today')
            .eq('auth0_user_id', req.params.userId)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
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

// Run at midnight every day
cron.schedule('0 0 * * *', () => {
    checkTrialExpirations();
});

