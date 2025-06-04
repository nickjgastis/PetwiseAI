const Stripe = require('stripe');
require('dotenv').config({ path: '../.env' });

const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // Test key

async function testPaymentFailure() {
    console.log('🧪 Testing Payment Failure Scenario');

    try {
        // 1. Create a customer
        const customer = await stripe.customers.create({
            email: 'test@example.com',
            name: 'Test User',
        });
        console.log('✅ Customer created:', customer.id);

        // 2. Create a payment method using test token for declining card
        const paymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: {
                token: 'tok_chargeDeclined', // Test token for declined payments
            },
        });
        console.log('✅ Declining payment method created');

        // Attach to customer
        await stripe.paymentMethods.attach(paymentMethod.id, {
            customer: customer.id,
        });

        // 3. Create subscription that will fail on first payment
        try {
            const subscription = await stripe.subscriptions.create({
                customer: customer.id,
                items: [{
                    price: process.env.NODE_ENV === 'production'
                        ? 'price_1QdhwtFpF2XskoMK2RjFj916'  // Your live monthly price
                        : 'price_1QcwX5FpF2XskoMKrTsq1kHc',  // Your test monthly price
                }],
                default_payment_method: paymentMethod.id,
                expand: ['latest_invoice'],
            });
            console.log('✅ Subscription created:', subscription.id);
        } catch (error) {
            console.log('💳 Payment declined as expected:', error.decline_code || error.message);
        }

        console.log('🎯 Check your webhook logs for invoice.payment_failed event');

        return { customer: customer.id };
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function testSuccessfulPayment() {
    console.log('🧪 Testing Successful Payment Scenario');

    try {
        // Use successful test token
        const customer = await stripe.customers.create({
            email: 'success@example.com',
            name: 'Success User',
        });

        const paymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: {
                token: 'tok_visa', // Test token for successful payments
            },
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

        console.log('✅ Successful subscription created:', subscription.id);
        console.log('🎯 Check your webhook logs for invoice.payment_succeeded event');

        return { customer: customer.id, subscription: subscription.id };
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function testSubscriptionUpdate() {
    console.log('🧪 Testing Subscription Update Scenario');

    // First create a successful subscription
    const result = await testSuccessfulPayment();
    if (!result) return;

    // Then cancel it
    try {
        const subscription = await stripe.subscriptions.update(result.subscription, {
            cancel_at_period_end: true,
        });

        console.log('✅ Subscription marked for cancellation');
        console.log('🎯 Check your webhook logs for customer.subscription.updated event');

        return result;
    } catch (error) {
        console.error('❌ Error updating subscription:', error.message);
    }
}

async function testSimpleInvoiceFailure() {
    console.log('🧪 Testing Simple Invoice Payment Failure');

    try {
        // Create customer with successful payment first
        const customer = await stripe.customers.create({
            email: 'invoice-test@example.com',
            name: 'Invoice Test User',
        });

        const goodPaymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: {
                token: 'tok_visa',
            },
        });

        await stripe.paymentMethods.attach(goodPaymentMethod.id, {
            customer: customer.id,
        });

        // Create active subscription
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{
                price: process.env.NODE_ENV === 'production'
                    ? 'price_1QdhwtFpF2XskoMK2RjFj916'
                    : 'price_1QcwX5FpF2XskoMKrTsq1kHc',
            }],
            default_payment_method: goodPaymentMethod.id,
        });

        console.log('✅ Initial subscription created:', subscription.id);

        // Now create a declining payment method
        const badPaymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: {
                token: 'tok_chargeDeclined',
            },
        });

        await stripe.paymentMethods.attach(badPaymentMethod.id, {
            customer: customer.id,
        });

        // Update customer's default payment method to the declining one
        await stripe.customers.update(customer.id, {
            invoice_settings: {
                default_payment_method: badPaymentMethod.id,
            },
        });

        console.log('✅ Updated to declining payment method');

        // Create and attempt to pay an invoice (simulating next billing cycle)
        const invoice = await stripe.invoices.create({
            customer: customer.id,
            subscription: subscription.id,
        });

        console.log('✅ Invoice created:', invoice.id);

        // Finalize the invoice
        await stripe.invoices.finalizeInvoice(invoice.id);

        // Try to pay it (this should fail and trigger webhook)
        try {
            await stripe.invoices.pay(invoice.id);
        } catch (error) {
            console.log('💳 Invoice payment failed as expected:', error.decline_code || error.message);
            console.log('🎯 Check your webhook logs for invoice.payment_failed event');
        }

        return { customer: customer.id, subscription: subscription.id, invoice: invoice.id };
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run tests
async function runAllTests() {
    console.log('🚀 Starting Stripe Webhook Tests\n');

    await testSuccessfulPayment();
    console.log('\n' + '='.repeat(50) + '\n');

    await testSimpleInvoiceFailure();
    console.log('\n' + '='.repeat(50) + '\n');

    await testSubscriptionUpdate();

    console.log('\n✨ All tests completed! Check your webhook logs and database.');
}

// Allow running individual tests
const testType = process.argv[2];
switch (testType) {
    case 'fail':
        testPaymentFailure();
        break;
    case 'success':
        testSuccessfulPayment();
        break;
    case 'update':
        testSubscriptionUpdate();
        break;
    case 'invoice-fail':
        testSimpleInvoiceFailure();
        break;
    default:
        runAllTests();
} 