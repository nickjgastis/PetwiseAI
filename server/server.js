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
    singleUserMonthly: 'price_1QMxUrFpF2XskoMKxt7UOtMV',
    singleUserYearly: 'price_1QMxVTFpF2XskoMKvEIdvxEj',

    multiUserMonthly: 'price_1QNJ9RFpF2XskoMKnvtvwX6C',
    multiUserYearly: 'price_1QNJB9FpF2XskoMKDeUPWNXp',

    clinicMonthly: 'price_1QNJFEFpF2XskoMKVpGm131E',
    clinicYearly: 'price_1QNJG0FpF2XskoMKqNG8CXjh'
};
const TRIAL_DAYS = 14;  // Changed from TRIAL_MINUTES
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
        ? process.env.STRIPE_WEBHOOK_SECRET_DEPLOYED
        : process.env.STRIPE_WEBHOOK_SECRET;

    console.log('Webhook Debug:', {
        hasSignature: !!sig,
        hasBody: !!req.body,
        env: process.env.NODE_ENV,
        hasSecret: !!webhookSecret
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
            console.log('Processing checkout session:', session.id);

            try {
                const subscription = await stripe.subscriptions.retrieve(session.subscription);

                // Determine subscription type and interval
                let subscriptionType, subscriptionInterval;
                const priceId = subscription.items.data[0].price.id;

                // Match price ID to subscription type and interval
                switch (priceId) {
                    case PRICE_IDS.singleUserMonthly:
                        subscriptionType = 'singleUser';
                        subscriptionInterval = 'monthly';
                        break;
                    case PRICE_IDS.singleUserYearly:
                        subscriptionType = 'singleUser';
                        subscriptionInterval = 'yearly';
                        break;
                    case PRICE_IDS.multiUserMonthly:
                        subscriptionType = 'multiUser';
                        subscriptionInterval = 'monthly';
                        break;
                    case PRICE_IDS.multiUserYearly:
                        subscriptionType = 'multiUser';
                        subscriptionInterval = 'yearly';
                        break;
                    case PRICE_IDS.clinicMonthly:
                        subscriptionType = 'clinic';
                        subscriptionInterval = 'monthly';
                        break;
                    case PRICE_IDS.clinicYearly:
                        subscriptionType = 'clinic';
                        subscriptionInterval = 'yearly';
                        break;
                    default:
                        throw new Error('Invalid price ID');
                }

                const updateData = {
                    subscription_status: 'active',
                    subscription_type: subscriptionType,
                    subscription_interval: subscriptionInterval,
                    stripe_customer_id: session.customer,
                    subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
                    reports_used_today: 0,
                    last_report_date: new Date().toISOString().split('T')[0],
                    has_used_trial: true,
                    cancel_at_period_end: false
                };

                console.log('Update Data:', updateData);

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
        console.error('Webhook error:', err);
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

        const { data, error } = await supabase
            .from('users')
            .update({
                subscription_status: 'active',
                subscription_type: 'trial',
                subscription_interval: 'trial',
                subscription_end_date: trialEndDate.toISOString(),
                has_used_trial: true,
                reports_used_today: 0,
                last_report_date: new Date().toISOString().split('T')[0]
            })
            .eq('auth0_user_id', user_id)
            .select();

        if (error) throw error;
        res.json(data);
    } catch (error) {
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

