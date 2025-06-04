const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function testManualWebhook() {
    console.log('🧪 Testing Manual Webhook for invoice.payment_failed');

    try {
        // 1. Create test user
        const testUserId = `webhook_test_${Date.now()}`;
        const testEmail = `webhook-test-${Date.now()}@example.com`;

        const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert([{
                auth0_user_id: testUserId,
                email: testEmail,
                nickname: 'Webhook Test User',
                subscription_status: 'active', // Start as active
                subscription_interval: 'monthly',
                subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
                has_accepted_terms: true,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (userError) throw userError;
        console.log('✅ Test user created:', testUserId);

        // 2. Create Stripe customer
        const customer = await stripe.customers.create({
            email: testEmail,
            name: 'Webhook Test User',
        });

        // 3. Link user to Stripe customer
        await supabase
            .from('users')
            .update({ stripe_customer_id: customer.id })
            .eq('auth0_user_id', testUserId);

        console.log('✅ Stripe customer created and linked:', customer.id);

        // 4. Create a subscription (for realism)
        const paymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: { token: 'tok_visa' },
        });

        await stripe.paymentMethods.attach(paymentMethod.id, {
            customer: customer.id,
        });

        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{
                price: process.env.NODE_ENV === 'production'
                    ? 'price_1QdhwtFpF2XskoMK2RjFj916'
                    : 'price_1QcwX5FpF2XskoMKrTsq1kHc',
            }],
            default_payment_method: paymentMethod.id,
        });

        console.log('✅ Subscription created:', subscription.id);

        // 5. Create an invoice for this subscription
        const invoice = await stripe.invoices.create({
            customer: customer.id,
            subscription: subscription.id,
        });

        console.log('✅ Invoice created:', invoice.id);

        // 6. Now use this invoice to trigger the webhook
        console.log('\n🎯 Now run this command in another terminal:');
        console.log(`stripe trigger invoice.payment_failed --override invoice:id=${invoice.id}`);
        console.log('\n⚠️  This will trigger the webhook with YOUR actual customer data');
        console.log('💡 Watch your server logs for the webhook processing...');

        console.log('\n📊 Current user status:');
        const { data: beforeUser } = await supabase
            .from('users')
            .select('subscription_status, subscription_interval')
            .eq('auth0_user_id', testUserId)
            .single();
        console.log(beforeUser);

        console.log('\n⏳ Waiting 10 seconds for you to run the trigger command...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // 7. Check if status changed to past_due
        const { data: afterUser } = await supabase
            .from('users')
            .select('subscription_status, subscription_interval')
            .eq('auth0_user_id', testUserId)
            .single();

        console.log('\n📊 User status after webhook:');
        console.log(afterUser);

        if (afterUser.subscription_status === 'past_due') {
            console.log('✅ SUCCESS: User correctly marked as past_due!');
        } else {
            console.log('❌ Status unchanged. Did you run the trigger command?');
        }

        return { userId: testUserId, customerId: customer.id, invoiceId: invoice.id };

    } catch (error) {
        console.error('❌ Test error:', error.message);
    }
}

async function cleanupTestUser(userId) {
    if (userId) {
        await supabase
            .from('users')
            .delete()
            .eq('auth0_user_id', userId);
        console.log('🧹 Test user cleaned up');
    }
}

// Run test
testManualWebhook().then(result => {
    if (result?.userId) {
        setTimeout(() => {
            cleanupTestUser(result.userId);
        }, 5000);
    }
}); 