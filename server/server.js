const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

app.use(cors());
app.use(express.json());

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

app.post('/create-checkout-session', async (req, res) => {
    try {
        const { user } = req.body;
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

        res.json({ id: session.id });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

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
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            const { error } = await supabase
                .from('users')
                .update({ subscription_status: 'active' })
                .eq('auth0_user_id', session.client_reference_id);

            if (error) console.error('Supabase update error:', error);
            break;

        case 'customer.subscription.deleted':
            const subscription = event.data.object;
            const { error: cancelError } = await supabase
                .from('users')
                .update({ subscription_status: 'inactive' })
                .eq('auth0_user_id', subscription.client_reference_id);

            if (cancelError) console.error('Supabase cancel error:', cancelError);
            break;
    }

    res.json({ received: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
