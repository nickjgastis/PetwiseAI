const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });
console.log('Stripe key:', process.env.REACT_APP_STRIPE_SECRET_KEY);

const app = express();
const stripe = Stripe(process.env.REACT_APP_STRIPE_SECRET_KEY);
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

app.use(cors());
app.use(express.json());

// Create a checkout session
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { user } = req.body;
        console.log('Creating checkout session for auth0_user_id:', user.sub);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [{
                price: 'price_1QFKZ4FpF2XskoMKESsuPmeJ',
                quantity: 1,
            }],
            success_url: 'http://localhost:3000/dashboard',
            cancel_url: 'http://localhost:3000/dashboard',
            client_reference_id: user.sub,
        });

        console.log('Session created with ID:', session.id);
        res.json({ id: session.id });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add webhook endpoint
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log('Webhook: checkout.session.completed');
            console.log('auth0_user_id from session:', session.client_reference_id);

            // Let's also check if the user exists first
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('auth0_user_id')
                .eq('auth0_user_id', session.client_reference_id)
                .single();

            if (checkError) {
                console.error('Error checking user:', checkError);
            }

            console.log('Existing user:', existingUser);

            // Update user subscription status
            const { error } = await supabase
                .from('users')
                .update({ subscription_status: 'active' })
                .eq('auth0_user_id', session.client_reference_id);

            if (error) {
                console.error('Supabase update error:', error);
                console.error('Error details:', error.details);
                console.error('Error hint:', error.hint);
            } else {
                console.log('Successfully updated subscription status to active');
            }
            break;

        case 'customer.subscription.deleted':
            const subscription = event.data.object;
            // Handle subscription cancellation
            const { error: cancelError } = await supabase
                .from('users')
                .update({ subscription_status: 'inactive' })
                .eq('auth0_user_id', subscription.client_reference_id);

            if (cancelError) console.error('Supabase cancel error:', cancelError);
            break;
    }

    res.json({ received: true });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
