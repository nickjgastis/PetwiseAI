const Stripe = require('stripe');
require('dotenv').config({ path: '../.env' });

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function testRecurringPaymentFailure() {
    console.log('🧪 Testing Recurring Payment Failure');

    try {
        // 1. First create a successful subscription
        const customer = await stripe.customers.create({
            email: 'recurring-test@example.com',
            name: 'Recurring Test User',
        });

        const goodPaymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: {
                number: '4242424242424242', // Good card first
                exp_month: 12,
                exp_year: 2025,
                cvc: '123',
            },
        });

        await stripe.paymentMethods.attach(goodPaymentMethod.id, {
            customer: customer.id,
        });

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

        // 2. Now replace with a declining card
        const badPaymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: {
                number: '4000000000000002', // Always declines
                exp_month: 12,
                exp_year: 2025,
                cvc: '123',
            },
        });

        await stripe.paymentMethods.attach(badPaymentMethod.id, {
            customer: customer.id,
        });

        // Update subscription to use declining card
        await stripe.subscriptions.update(subscription.id, {
            default_payment_method: badPaymentMethod.id,
        });

        console.log('✅ Subscription updated with declining card');

        // 3. Create a new invoice to simulate next billing cycle
        const invoice = await stripe.invoices.create({
            customer: customer.id,
            subscription: subscription.id,
        });

        console.log('✅ New invoice created:', invoice.id);

        // 4. Try to pay the invoice (this will fail)
        try {
            await stripe.invoices.pay(invoice.id);
        } catch (error) {
            console.log('💳 Invoice payment failed as expected:', error.decline_code);
            console.log('🎯 Check your webhook logs for invoice.payment_failed event');
        }

        return { customer: customer.id, subscription: subscription.id, invoice: invoice.id };
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testRecurringPaymentFailure(); 