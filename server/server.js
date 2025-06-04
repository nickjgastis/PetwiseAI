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
    monthly_usd: process.env.NODE_ENV === 'production'
        ? 'price_1QdhwtFpF2XskoMK2RjFj916'  // Live monthly USD
        : 'price_1QcwX5FpF2XskoMKrTsq1kHc',  // Test monthly USD
    yearly_usd: process.env.NODE_ENV === 'production'
        ? 'price_1Qdhz7FpF2XskoMK7O7GjJTn'   // Live yearly USD
        : 'price_1QcwYWFpF2XskoMKH9MJisoy',   // Test yearly USD
    monthly_cad: process.env.NODE_ENV === 'production'
        ? 'price_1QvnroFpF2XskoMKrXzdKYw7'    // Live monthly CAD
        : 'price_1QvoD2FpF2XskoMKsTtPM7mg',   // Test monthly CAD
    yearly_cad: process.env.NODE_ENV === 'production'
        ? 'price_1Qvno7FpF2XskoMKbAXkVZzh'    // Live yearly CAD
        : 'price_1QvoCfFpF2XskoMKfLelrbhT',   // Test yearly CAD
    test: process.env.NODE_ENV === 'production'
        ? 'price_1Qdje9FpF2XskoMKcC5p3bwR'
        : 'price_1QcwYWFpF2XskoMKH9MJisoy'
};
const TRIAL_DAYS = 30;  // Changed from TRIAL_MINUTES
const REPORT_LIMITS = {
    trial: 50,
    monthly: Infinity,
    yearly: Infinity
};

const ACCESS_CODES = {
    'NICKSECRETKEY5247': {
        organization: 'Petwise',
        validUntil: '2029-01-01',
        plan: 'yearly',
        maxUsers: 10  // Optional: limit users per code
    },

};

const REVOKED_CODES = new Set([

    // Add more revoked codes here
]);

// ================ CHECKOUT ENDPOINT ================
// Handles creation of Stripe checkout sessions
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { user, planType, currency = 'usd' } = req.body;
        const priceId = PRICE_IDS[`${planType}_${currency}`];

        if (!priceId) {
            throw new Error('Invalid plan type or currency');
        }

        // Find or create customer with invoice settings
        let customer;
        const existingCustomers = await stripe.customers.list({
            email: user.email,
            limit: 1
        });

        if (existingCustomers.data.length > 0) {
            // Force update existing customer's email and set invoice settings
            customer = await stripe.customers.update(existingCustomers.data[0].id, {
                email: user.email,
                name: user.name || 'Valued Customer',
                invoice_settings: {
                    default_payment_method: null // Ensure invoice uses the email from Customer object
                }
            });
        } else {
            customer = await stripe.customers.create({
                email: user.email,
                name: user.name || 'Valued Customer',
                metadata: { auth0_user_id: user.sub },
                invoice_settings: {
                    default_payment_method: null
                }
            });
        }

        // Create checkout session with updated customer
        const session = await stripe.checkout.sessions.create({
            customer: customer.id,  // Using existing customer object
            payment_method_types: ['card'],
            mode: 'subscription',
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            automatic_tax: { enabled: true },
            tax_id_collection: { enabled: true },
            customer_update: {
                address: 'auto',
                name: 'auto'
            },
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

        // Handle initial subscription creation
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            console.log('Checkout Session:', session);

            try {
                const subscription = await stripe.subscriptions.retrieve(session.subscription);
                console.log('Subscription:', subscription);

                const priceId = subscription.items.data[0].price.id;
                console.log('Price ID:', priceId);

                // Determine subscription interval from price
                let subscriptionInterval = 'monthly'; // default

                if (priceId === PRICE_IDS.yearly_usd || priceId === PRICE_IDS.yearly_cad) {
                    subscriptionInterval = 'yearly';
                } else if (priceId === PRICE_IDS.monthly_usd || priceId === PRICE_IDS.monthly_cad) {
                    subscriptionInterval = 'monthly';
                }

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

        // Handle successful recurring payments
        if (event.type === 'invoice.payment_succeeded') {
            const invoice = event.data.object;
            console.log('Payment succeeded for invoice:', invoice.id);

            // Only process subscription invoices (not one-time payments)
            if (invoice.subscription) {
                try {
                    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
                    const customer = await stripe.customers.retrieve(invoice.customer);

                    console.log('Updating subscription for customer:', customer.id);

                    // Find user by stripe customer ID
                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('auth0_user_id')
                        .eq('stripe_customer_id', customer.id)
                        .single();

                    if (userError || !userData) {
                        console.error('User not found for customer:', customer.id);
                        return res.status(200).json({ received: true });
                    }

                    // Determine subscription interval from price
                    const priceId = subscription.items.data[0].price.id;

                    let subscriptionInterval = 'monthly'; // default

                    if (priceId === PRICE_IDS.yearly_usd || priceId === PRICE_IDS.yearly_cad) {
                        subscriptionInterval = 'yearly';
                    } else if (priceId === PRICE_IDS.monthly_usd || priceId === PRICE_IDS.monthly_cad) {
                        subscriptionInterval = 'monthly';
                    }

                    // Update subscription with new period end
                    const { error: updateError } = await supabase
                        .from('users')
                        .update({
                            subscription_status: 'active',
                            subscription_interval: subscriptionInterval,
                            subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
                            cancel_at_period_end: subscription.cancel_at_period_end || false
                        })
                        .eq('auth0_user_id', userData.auth0_user_id);

                    if (updateError) {
                        console.error('Failed to update user subscription:', updateError);
                        throw updateError;
                    }

                    console.log('Successfully renewed subscription for user:', userData.auth0_user_id);
                } catch (error) {
                    console.error('Error processing payment success:', error);
                    return res.status(500).json({ error: error.message });
                }
            }
        }

        // Handle failed recurring payments
        if (event.type === 'invoice.payment_failed') {
            const invoice = event.data.object;
            console.log('Payment failed for invoice:', invoice.id);

            if (invoice.subscription) {
                try {
                    const customer = await stripe.customers.retrieve(invoice.customer);

                    // Find user by stripe customer ID
                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('auth0_user_id, subscription_end_date')
                        .eq('stripe_customer_id', customer.id)
                        .single();

                    if (userError || !userData) {
                        console.error('User not found for customer:', customer.id);
                        return res.status(200).json({ received: true });
                    }

                    // Set status to past_due when payment fails
                    // This gives user a grace period while Stripe retries
                    const { error: updateError } = await supabase
                        .from('users')
                        .update({
                            subscription_status: 'past_due'
                        })
                        .eq('auth0_user_id', userData.auth0_user_id);

                    if (updateError) {
                        console.error('Failed to update user to past_due:', updateError);
                        throw updateError;
                    }

                    console.log('Marked subscription as past_due for user:', userData.auth0_user_id);
                } catch (error) {
                    console.error('Error processing payment failure:', error);
                    return res.status(500).json({ error: error.message });
                }
            }
        }

        // Handle subscription updates (cancellations, reactivations, etc.)
        if (event.type === 'customer.subscription.updated') {
            const subscription = event.data.object;
            console.log('Subscription updated:', subscription.id);

            try {
                // Find user by stripe customer ID
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('auth0_user_id')
                    .eq('stripe_customer_id', subscription.customer)
                    .single();

                if (userError || !userData) {
                    console.error('User not found for customer:', subscription.customer);
                    return res.status(200).json({ received: true });
                }

                let updateData = {
                    subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
                    cancel_at_period_end: subscription.cancel_at_period_end || false
                };

                // Update status based on subscription status
                if (subscription.status === 'active') {
                    updateData.subscription_status = 'active';
                } else if (subscription.status === 'past_due') {
                    updateData.subscription_status = 'past_due';
                } else if (subscription.status === 'canceled') {
                    updateData.subscription_status = 'inactive';
                }

                const { error: updateError } = await supabase
                    .from('users')
                    .update(updateData)
                    .eq('auth0_user_id', userData.auth0_user_id);

                if (updateError) {
                    console.error('Failed to update subscription status:', updateError);
                    throw updateError;
                }

                console.log('Successfully updated subscription status for user:', userData.auth0_user_id);
            } catch (error) {
                console.error('Error processing subscription update:', error);
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
// NOTE: Commented out since you have a Supabase function handling expiration checks
// async function checkTrialExpirations() {
//     const now = new Date().toISOString();

//     // Handle expired active subscriptions
//     const { data: expiredActive, error: activeError } = await supabase
//         .from('users')
//         .update({ subscription_status: 'inactive' })
//         .lt('subscription_end_date', now)
//         .eq('subscription_status', 'active')
//         .select();

//     if (activeError) {
//         console.error('Error checking active subscription expirations:', activeError);
//     } else if (expiredActive && expiredActive.length > 0) {
//         console.log(`Deactivated ${expiredActive.length} expired active subscriptions`);
//     }

//     // Handle expired past_due subscriptions
//     const { data: expiredPastDue, error: pastDueError } = await supabase
//         .from('users')
//         .update({ subscription_status: 'inactive' })
//         .lt('subscription_end_date', now)
//         .eq('subscription_status', 'past_due')
//         .select();

//     if (pastDueError) {
//         console.error('Error checking past_due subscription expirations:', pastDueError);
//     } else if (expiredPastDue && expiredPastDue.length > 0) {
//         console.log(`Deactivated ${expiredPastDue.length} expired past_due subscriptions`);
//     }
// }

// Add this new middleware function
async function checkReportLimit(req, res, next) {
    try {
        const { user } = req.body;
        if (!user?.sub) {
            return res.status(400).json({ error: 'User ID required' });
        }

        const { data: userData, error } = await supabase
            .from('users')
            .select('subscription_interval, subscription_status, reports_used_today, last_report_date')
            .eq('auth0_user_id', user.sub)
            .single();

        if (error) throw error;

        // Check if user has access (active or past_due within grace period)
        if (userData.subscription_status === 'inactive') {
            return res.status(403).json({
                error: 'Subscription inactive',
                status: userData.subscription_status
            });
        }

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
        const { userId } = req.params;

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('auth0_user_id', userId)
            .single();

        if (error) throw error;

        // Add this check for access code revocation
        if (user.access_code) {
            if (REVOKED_CODES.has(user.access_code) ||
                !ACCESS_CODES[user.access_code] ||
                new Date(ACCESS_CODES[user.access_code]?.validUntil) < new Date()) {

                // Deactivate the subscription
                await supabase
                    .from('users')
                    .update({
                        subscription_status: 'inactive',
                        subscription_end_date: new Date().toISOString()
                    })
                    .eq('auth0_user_id', userId);

                user.subscription_status = 'inactive';
            }
        }

        res.json(user);
    } catch (error) {
        console.error('Check subscription error:', error);
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

        // Delete templates first
        const { error: templateError } = await supabase
            .from('templates')
            .delete()
            .eq('user_id', userData.id);

        if (templateError) {
            console.error('Template deletion error:', templateError);
            throw templateError;
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

// Add new endpoint to handle access code activation
app.post('/activate-access-code', async (req, res) => {
    try {
        const { user_id, accessCode } = req.body;
        console.log('Access code activation request:', { user_id, accessCode });

        // Check if user already has this code
        const { data: existingUser, error: userError } = await supabase
            .from('users')
            .select('access_code, subscription_status')
            .eq('auth0_user_id', user_id)
            .single();

        if (userError) throw userError;

        if (existingUser.access_code === accessCode) {
            return res.status(400).json({
                error: 'You have already activated this access code'
            });
        }

        // Check if code exists and isn't revoked
        if (REVOKED_CODES.has(accessCode)) {
            return res.status(400).json({ error: 'This access code has been revoked' });
        }

        const codeDetails = ACCESS_CODES[accessCode];
        if (!codeDetails) {
            return res.status(400).json({ error: 'Invalid access code' });
        }

        // Check if code is expired
        if (new Date(codeDetails.validUntil) < new Date()) {
            return res.status(400).json({ error: 'Access code has expired' });
        }

        // Optional: Check if organization has reached user limit
        if (codeDetails.maxUsers) {
            const { count, error: countError } = await supabase
                .from('users')
                .select('*', { count: 'exact' })
                .eq('access_code', accessCode);

            if (countError) throw countError;

            if (count >= codeDetails.maxUsers) {
                return res.status(400).json({
                    error: 'Organization has reached maximum user limit'
                });
            }
        }

        // Update user subscription in Supabase
        const { data, error } = await supabase
            .from('users')
            .update({
                subscription_status: 'active',
                subscription_interval: codeDetails.plan,
                subscription_end_date: codeDetails.validUntil,
                organization: codeDetails.organization,
                access_code: accessCode,
                reports_used_today: 0,
                last_report_date: new Date().toISOString().split('T')[0],
                stripe_customer_id: null,  // Clear any existing Stripe connection
                cancel_at_period_end: false
            })
            .eq('auth0_user_id', user_id)
            .select();

        if (error) throw error;

        console.log('Access code activation successful:', data);
        res.json({
            success: true,
            organization: codeDetails.organization,
            validUntil: codeDetails.validUntil,
            plan: codeDetails.plan
        });

    } catch (error) {
        console.error('Access code activation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add endpoint to revoke access code
app.post('/revoke-access-code', async (req, res) => {
    try {
        const { code } = req.body;

        // Add to revoked set
        REVOKED_CODES.add(code);

        // Update all users with this code
        const { error } = await supabase
            .from('users')
            .update({
                subscription_status: 'inactive',
                subscription_end_date: new Date().toISOString()
            })
            .eq('access_code', code);

        if (error) throw error;

        res.json({ success: true, message: `Access code ${code} has been revoked` });
    } catch (error) {
        console.error('Revoke access code error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add to your periodic checks
async function checkAccessCodeValidity() {
    try {
        const now = new Date().toISOString();

        // Get all users with access codes
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .not('access_code', 'is', null)
            .eq('subscription_status', 'active');

        if (error) throw error;

        for (const user of users) {
            const codeDetails = ACCESS_CODES[user.access_code];

            // Deactivate if code is revoked, invalid, or expired
            if (REVOKED_CODES.has(user.access_code) ||
                !codeDetails ||
                new Date(codeDetails.validUntil) < new Date()) {

                await supabase
                    .from('users')
                    .update({
                        subscription_status: 'inactive',
                        subscription_end_date: now
                    })
                    .eq('auth0_user_id', user.auth0_user_id);

                console.log(`Deactivated access for user ${user.auth0_user_id} with code ${user.access_code}`);
            }
        }
    } catch (error) {
        console.error('Error checking access code validity:', error);
    }
}

// Add to your server startup
setInterval(checkAccessCodeValidity, 24 * 60 * 60 * 1000); // Check daily

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

// Add this new admin metrics endpoint
app.get('/admin-metrics', async (req, res) => {
    try {
        // Verify admin access - should match process.env.REACT_APP_ADMIN_USER_ID
        const { user_id } = req.query;

        if (!user_id || user_id !== process.env.REACT_APP_ADMIN_USER_ID) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }

        // Get users
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('*');

        if (userError) throw userError;

        // Get reports
        const { data: reports, error: reportError } = await supabase
            .from('reports')
            .select('*');

        if (reportError) throw reportError;

        // Calculate metrics
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        // User metrics
        const totalUsers = users.length;
        const activeUsers = users.filter(u => u.subscription_status === 'active').length;
        const trialUsers = users.filter(u => u.subscription_interval === 'trial').length;

        // Time-based metrics
        const newUsersThisMonth = users.filter(
            u => new Date(u.created_at) >= firstDayOfMonth
        ).length;

        const newUsersLastMonth = users.filter(
            u => new Date(u.created_at) >= firstDayOfLastMonth &&
                new Date(u.created_at) < firstDayOfMonth
        ).length;

        // Subscription metrics
        const subscriptionsByType = {
            monthly: users.filter(u =>
                u.subscription_status === 'active' &&
                u.subscription_interval === 'monthly'
            ).length,
            yearly: users.filter(u =>
                u.subscription_status === 'active' &&
                u.subscription_interval === 'yearly'
            ).length,
            trial: trialUsers,
            inactive: users.filter(u => u.subscription_status === 'inactive').length,
            canceling: users.filter(u => u.cancel_at_period_end === true).length
        };

        // Report metrics
        const totalReports = reports.length;
        const reportsThisMonth = reports.filter(
            r => new Date(r.created_at) >= firstDayOfMonth
        ).length;

        // Quick query metrics (sum from user counts)
        const totalQuickQueries = users.reduce(
            (sum, user) => sum + (user.quick_query_count || 0),
            0
        );

        // Metrics by month
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            return {
                month: date.toLocaleString('default', { month: 'short' }),
                year: date.getFullYear()
            };
        });

        const monthlyMetrics = last6Months.map(({ month, year }) => {
            const startOfMonth = new Date(year, new Date().getMonth() - last6Months.findIndex(m => m.month === month), 1);
            const endOfMonth = new Date(year, new Date().getMonth() - last6Months.findIndex(m => m.month === month) + 1, 0);

            return {
                month,
                year,
                newUsers: users.filter(u =>
                    new Date(u.created_at) >= startOfMonth &&
                    new Date(u.created_at) <= endOfMonth
                ).length,
                newReports: reports.filter(r =>
                    new Date(r.created_at) >= startOfMonth &&
                    new Date(r.created_at) <= endOfMonth
                ).length
            };
        });

        res.json({
            totalUsers,
            activeUsers,
            trialUsers,
            newUsersThisMonth,
            newUsersLastMonth,
            growthRate: newUsersLastMonth > 0
                ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100
                : 0,
            subscriptionsByType,
            totalReports,
            reportsThisMonth,
            totalQuickQueries,
            monthlyMetrics,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Admin metrics error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================ CUSTOMER PORTAL ENDPOINT ================
// Creates a Stripe customer portal session for billing management
app.post('/create-customer-portal', async (req, res) => {
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
            return res.status(404).json({ error: 'No billing account found' });
        }

        // Create customer portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: userData.stripe_customer_id,
            return_url: process.env.NODE_ENV === 'production'
                ? 'https://petwise.vet/profile'
                : 'http://localhost:3000/profile',
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Customer portal error:', error);
        res.status(500).json({ error: error.message });
    }
});

