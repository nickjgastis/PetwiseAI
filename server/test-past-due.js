const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function testPastDueStatus() {
    console.log('🧪 Testing Past Due Status on Payment Failure');

    try {
        // 1. Create test user
        const testUserId = `past_due_test_${Date.now()}`;
        const testEmail = `past-due-${Date.now()}@example.com`;

        const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert([{
                auth0_user_id: testUserId,
                email: testEmail,
                nickname: 'Past Due Test User',
                subscription_status: 'inactive',
                has_accepted_terms: true,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (userError) throw userError;
        console.log('✅ Test user created:', testUserId);

        // 2. Create Stripe customer with good payment method first
        const customer = await stripe.customers.create({
            email: testEmail,
            name: 'Past Due Test User',
        });

        const goodPaymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: { token: 'tok_visa' },
        });

        await stripe.paymentMethods.attach(goodPaymentMethod.id, {
            customer: customer.id,
        });

        // 3. Update user with Stripe customer ID
        await supabase
            .from('users')
            .update({ stripe_customer_id: customer.id })
            .eq('auth0_user_id', testUserId);

        console.log('✅ Stripe customer created and linked');

        // 4. Create successful subscription first
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{
                price: process.env.NODE_ENV === 'production'
                    ? 'price_1QdhwtFpF2XskoMK2RjFj916'
                    : 'price_1QcwX5FpF2XskoMKrTsq1kHc',
            }],
            default_payment_method: goodPaymentMethod.id,
        });

        console.log('✅ Active subscription created:', subscription.id);

        // Wait for initial webhook processing
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check initial status (should be active)
        let { data: userCheck1 } = await supabase
            .from('users')
            .select('subscription_status, subscription_interval')
            .eq('auth0_user_id', testUserId)
            .single();

        console.log('📊 Status after successful payment:', userCheck1);

        // 5. Now create a declining payment method
        const badPaymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: { token: 'tok_chargeDeclined' },
        });

        await stripe.paymentMethods.attach(badPaymentMethod.id, {
            customer: customer.id,
        });

        // 6. Update subscription to use declining card
        await stripe.subscriptions.update(subscription.id, {
            default_payment_method: badPaymentMethod.id,
        });

        console.log('✅ Updated subscription to use declining card');

        // 7. Create and try to pay an invoice (this will fail)
        const invoice = await stripe.invoices.create({
            customer: customer.id,
            subscription: subscription.id,
        });

        await stripe.invoices.finalizeInvoice(invoice.id);

        try {
            await stripe.invoices.pay(invoice.id);
        } catch (error) {
            console.log('💳 Payment failed as expected:', error.decline_code || 'declined');
        }

        console.log('🎯 Payment failure should trigger invoice.payment_failed webhook');

        // 8. Wait for webhook processing
        console.log('⏳ Waiting for webhook to process payment failure...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 9. Check final status (should be past_due)
        const { data: finalUser } = await supabase
            .from('users')
            .select('subscription_status, subscription_interval, subscription_end_date')
            .eq('auth0_user_id', testUserId)
            .single();

        console.log('📊 Final status after payment failure:', finalUser);

        if (finalUser.subscription_status === 'past_due') {
            console.log('✅ SUCCESS: User correctly marked as past_due');
        } else {
            console.log('❌ FAILED: Expected past_due, got:', finalUser.subscription_status);
        }

        return { userId: testUserId, customerId: customer.id };

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
testPastDueStatus().then(result => {
    if (result?.userId) {
        setTimeout(() => {
            cleanupTestUser(result.userId);
        }, 3000);
    }
}); 