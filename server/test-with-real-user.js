const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function testWithRealUser() {
    console.log('🧪 Testing Webhook with Real User Data');

    try {
        // 1. Create a test user in Supabase first
        const testUserId = `test_user_${Date.now()}`;
        const testEmail = `test-${Date.now()}@example.com`;

        const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert([{
                auth0_user_id: testUserId,
                email: testEmail,
                nickname: 'Test User',
                subscription_status: 'inactive',
                has_accepted_terms: true,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (userError) throw userError;
        console.log('✅ Test user created in database:', testUserId);

        // 2. Create Stripe customer
        const customer = await stripe.customers.create({
            email: testEmail,
            name: 'Test User',
            metadata: { auth0_user_id: testUserId }
        });
        console.log('✅ Stripe customer created:', customer.id);

        // 3. Update user with Stripe customer ID
        const { error: updateError } = await supabase
            .from('users')
            .update({ stripe_customer_id: customer.id })
            .eq('auth0_user_id', testUserId);

        if (updateError) throw updateError;
        console.log('✅ User linked to Stripe customer');

        // 4. Create successful subscription
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
        console.log('🎯 Check webhook logs - should see successful user update');

        // Wait longer for webhook processing
        console.log('⏳ Waiting for webhook processing...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        // 5. Check if user was updated by webhook
        const { data: updatedUser, error: checkError } = await supabase
            .from('users')
            .select('*')
            .eq('auth0_user_id', testUserId)
            .single();

        if (checkError) throw checkError;

        console.log('📊 User after webhook processing:', {
            subscription_status: updatedUser.subscription_status,
            subscription_interval: updatedUser.subscription_interval,
            subscription_end_date: updatedUser.subscription_end_date,
            stripe_customer_id: updatedUser.stripe_customer_id
        });

        // Let's also check what price ID was actually used
        console.log('🔍 Checking subscription details from Stripe...');
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.id);
        const actualPriceId = stripeSubscription.items.data[0].price.id;
        console.log('💰 Actual price ID used:', actualPriceId);

        // Check against our constants
        const priceIds = {
            monthly_usd: process.env.NODE_ENV === 'production'
                ? 'price_1QdhwtFpF2XskoMK2RjFj916'
                : 'price_1QcwX5FpF2XskoMKrTsq1kHc',
            yearly_usd: process.env.NODE_ENV === 'production'
                ? 'price_1Qdhz7FpF2XskoMK7O7GjJTn'
                : 'price_1QcwYWFpF2XskoMKH9MJisoy',
        };
        console.log('🆔 Expected price IDs:', priceIds);
        console.log('✅ Price ID match check:', {
            isMonthlyUSD: actualPriceId === priceIds.monthly_usd,
            isYearlyUSD: actualPriceId === priceIds.yearly_usd
        });

        // 6. Test payment failure
        console.log('\n🧪 Now testing payment failure...');

        const badPaymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: { token: 'tok_chargeDeclined' },
        });

        await stripe.paymentMethods.attach(badPaymentMethod.id, {
            customer: customer.id,
        });

        // Update customer to use declining card
        await stripe.customers.update(customer.id, {
            invoice_settings: {
                default_payment_method: badPaymentMethod.id,
            },
        });

        // Create invoice that will fail
        const invoice = await stripe.invoices.create({
            customer: customer.id,
            subscription: subscription.id,
        });

        await stripe.invoices.finalizeInvoice(invoice.id);

        try {
            await stripe.invoices.pay(invoice.id);
        } catch (error) {
            console.log('💳 Payment failed as expected');
            console.log('🎯 Check webhook logs for invoice.payment_failed processing');
        }

        // Wait for webhook processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check final user state
        const { data: finalUser } = await supabase
            .from('users')
            .select('subscription_status')
            .eq('auth0_user_id', testUserId)
            .single();

        console.log('📊 Final user status:', finalUser.subscription_status);

        return { userId: testUserId, customerId: customer.id, subscriptionId: subscription.id };

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function cleanupTestUser(userId) {
    if (userId) {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('auth0_user_id', userId);

        if (error) {
            console.error('Error cleaning up test user:', error);
        } else {
            console.log('🧹 Test user cleaned up');
        }
    }
}

// Run test with cleanup
testWithRealUser().then(result => {
    if (result?.userId) {
        console.log('\n⏳ Waiting 5 seconds before cleanup...');
        setTimeout(() => {
            cleanupTestUser(result.userId);
        }, 5000);
    }
}); 