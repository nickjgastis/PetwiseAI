import React from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const Checkout = ({ onBack, user }) => {
    const handleCheckout = async () => {
        try {
            const stripe = await stripePromise;
            if (!stripe) {
                throw new Error('Stripe failed to initialize');
            }

            if (!user) {
                throw new Error('No user data available');
            }

            const response = await fetch('http://localhost:3001/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ user }),
            });

            const session = await response.json();
            if (!session || !session.id) {
                console.error('Invalid session:', session);
                return;
            }

            const result = await stripe.redirectToCheckout({ sessionId: session.id });
            if (result.error) {
                console.error(result.error.message);
            }
        } catch (error) {
            console.error('Checkout error:', error);
        }
    };

    return (
        <div>
            <button onClick={handleCheckout}>Start Free Trial</button>
            <button onClick={onBack}>Back to Profile</button>
        </div>
    );
};

export default Checkout;
