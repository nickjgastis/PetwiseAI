import React from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const Checkout = () => {
    const handleCheckout = async (priceId) => {
        const stripe = await stripePromise;

        const response = await fetch('/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ priceId }),
        });

        const session = await response.json();
        const result = await stripe.redirectToCheckout({ sessionId: session.id });

        if (result.error) {
            console.error(result.error.message);
        }
    };

    return (
        <div>
            <h2>Choose Your Plan</h2>
            <button onClick={() => handleCheckout('prod_R7Zil3DDGq3ZcF')}>Start Free Trial</button>
            <button onClick={() => handleCheckout('prod_R7YuUsCsAlP1lM')}>Subscribe Monthly</button>
            <button onClick={() => handleCheckout('prod_R7Zh5C9237ZJCS')}>Subscribe Yearly</button>
        </div>
    );
};

export default Checkout;
