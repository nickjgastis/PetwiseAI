// import { supabase } from '../supabaseClient';
// import Stripe from 'stripe';

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// export async function handleStripeWebhook(req, res) {
//     const sig = req.headers['stripe-signature'];
//     const event = stripe.webhooks.constructEvent(
//         req.body,
//         sig,
//         process.env.STRIPE_WEBHOOK_SECRET
//     );

//     switch (event.type) {
//         case 'customer.subscription.updated':
//         case 'customer.subscription.created': {
//             const subscription = event.data.object;

//             await supabase
//                 .from('users')
//                 .update({
//                     subscription_end_date: new Date(subscription.current_period_end * 1000),
//                     subscription_status: subscription.status
//                 })
//                 .eq('stripe_customer_id', subscription.customer);
//             break;
//         }
//     }

//     res.json({ received: true });
// } 