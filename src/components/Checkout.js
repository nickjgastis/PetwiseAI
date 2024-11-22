import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import CancelSubscription from './CancelSubscription';
import { useAuth0 } from '@auth0/auth0-react';
import { supabase } from '../supabaseClient';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'  // Your API domain
    : 'http://localhost:3001';

const Checkout = ({ onBack, user, subscriptionStatus }) => {
    const { logout } = useAuth0();
    const [isTrial, setIsTrial] = useState(false);
    const [subscriptionType, setSubscriptionType] = useState(null);

    useEffect(() => {
        const fetchSubscriptionInfo = async () => {
            if (!user?.sub) return;

            try {
                const response = await fetch(`${API_URL}/check-subscription/${user.sub}`, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const data = await response.json();
                setSubscriptionType(data.subscription_type);
            } catch (error) {
                console.error('Error fetching subscription info:', error);
            }
        };

        fetchSubscriptionInfo();
    }, [user]);

    const handleCheckout = async (planType = 'singleUserMonthly') => {
        try {
            const stripe = await stripePromise;
            if (!stripe) {
                throw new Error('Stripe failed to initialize');
            }

            if (!user) {
                throw new Error('No user data available');
            }

            const response = await fetch(`${API_URL}/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user,
                    planType
                }),
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

    const handleTrialActivation = async () => {
        try {
            const response = await fetch(`${API_URL}/activate-trial`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: user.sub }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message);
            }

            window.location.reload();
        } catch (error) {
            console.error('Trial activation error:', error);
        }
    };

    const makeRequest = async (url, options = {}) => {
        return fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
        });
    };

    return (
        <div className="checkout-container">
            <div className="checkout-options">
                <div className="checkout-header">
                    <h3>{subscriptionStatus === 'active' ? 'Manage Subscription' : 'Choose Your Plan'}</h3>
                    <p className="checkout-subtitle">
                        {subscriptionStatus === 'active' ? (
                            <>
                                Current Plan: {(() => {
                                    const planTypes = {
                                        trial: 'Free Trial (10 reports/day)',
                                        singleUser: 'Single User Plan (25 reports/day)',
                                        multiUser: 'Multi User Plan (120 reports/day)',
                                        clinic: 'Clinic Plan (400 reports/day)'
                                    };
                                    return `${planTypes[subscriptionType] || 'Unknown Plan'} - Features Active`;
                                })()}
                            </>
                        ) : (
                            'Get full access to all premium features'
                        )}
                    </p>
                </div>

                <div className="pricing-container">
                    {/* Always show trial card, but disabled if used */}
                    <div className={`pricing-card free ${user.has_used_trial ? 'disabled' : ''}`}>
                        <div className="pricing-header">
                            <h3>Free Trial</h3>
                            <p className="price">$0<span>/7 days</span></p>
                        </div>
                        <ul className="pricing-features">
                            <li>10 reports per day</li>
                            <li>No credit card required</li>

                            <li>Quick Query</li>
                        </ul>
                        <div className="pricing-footer">
                            <button
                                onClick={handleTrialActivation}
                                className="trial-button"
                                disabled={user.has_used_trial || subscriptionStatus === 'active'}
                            >
                                {user.has_used_trial ? 'Trial Used' : 'Start Free Trial'}
                            </button>

                        </div>
                    </div>

                    <div className={`pricing-card ${subscriptionType === 'singleUser' ? 'current' : ''}`}>
                        <div className="pricing-header">
                            <h3>Single User</h3>
                            <div className="price-options">
                                <p className="price">$79.99<span>/mo</span></p>
                                <span className="price-divider">|</span>
                                <p className="price yearly">$859.99<span>/yr</span></p>
                            </div>
                        </div>
                        <ul className="pricing-features">
                            <li>25 reports per day</li>
                            <li>Saved reports</li>
                            <li>Quick Query</li>
                            <li>For 1 user</li>
                        </ul>
                        <div className="pricing-footer">
                            <button
                                onClick={() => handleCheckout('singleUserMonthly')}
                                className="subscribe-button"
                                disabled={subscriptionType === 'singleUser' && !user.cancel_at_period_end}
                            >
                                {subscriptionType === 'singleUser' ? 'Current Plan' : 'Monthly Plan'}
                            </button>
                            <button
                                onClick={() => handleCheckout('singleUserYearly')}
                                className="subscribe-button yearly"
                                disabled={subscriptionType === 'singleUser' && !user.cancel_at_period_end}
                            >
                                {subscriptionType === 'singleUser' ? 'Current Plan' : 'Yearly Plan'}
                            </button>
                        </div>
                    </div>

                    <div className={`pricing-card ${subscriptionType === 'multiUser' ? 'current' : ''}`}>
                        <div className="pricing-header">
                            <h3>Multi User</h3>
                            <div className="price-options">
                                <p className="price">$249.99<span>/mo</span></p>
                                <span className="price-divider">|</span>
                                <p className="price yearly">$2849.99<span>/yr</span></p>
                            </div>
                        </div>
                        <ul className="pricing-features">
                            <li>120 reports per day</li>
                            <li>Saved reports</li>
                            <li>Quick Query</li>
                            <li>For 2-5 users</li>
                        </ul>
                        <div className="pricing-footer">
                            <button
                                onClick={() => handleCheckout('multiUserMonthly')}
                                className="subscribe-button"
                                disabled={subscriptionType === 'multiUser' && !user.cancel_at_period_end}
                            >
                                {subscriptionType === 'multiUser' ? 'Current Plan' : 'Monthly Plan'}
                            </button>
                            <button
                                onClick={() => handleCheckout('multiUserYearly')}
                                className="subscribe-button yearly"
                                disabled={subscriptionType === 'multiUser' && !user.cancel_at_period_end}
                            >
                                {subscriptionType === 'multiUser' ? 'Current Plan' : 'Yearly Plan'}
                            </button>
                        </div>
                    </div>

                    <div className={`pricing-card ${subscriptionType === 'clinic' ? 'current' : ''}`}>
                        <div className="pricing-header">
                            <h3>Clinic Subscription</h3>
                            <div className="price-options">
                                <p className="price">$479.99<span>/mo</span></p>
                                <span className="price-divider">|</span>
                                <p className="price yearly">$5199.99<span>/yr</span></p>
                            </div>
                        </div>
                        <ul className="pricing-features">
                            <li>400 reports per day</li>
                            <li>Saved reports</li>
                            <li>Quick Query</li>
                            <li>For full clinics</li>
                        </ul>
                        <div className="pricing-footer">
                            <button
                                onClick={() => handleCheckout('clinicMonthly')}
                                className="subscribe-button"
                                disabled={subscriptionType === 'clinic' && !user.cancel_at_period_end}
                            >
                                {subscriptionType === 'clinic' ? 'Current Plan' : 'Monthly Plan'}
                            </button>
                            <button
                                onClick={() => handleCheckout('clinicYearly')}
                                className="subscribe-button yearly"
                                disabled={subscriptionType === 'clinic' && !user.cancel_at_period_end}
                            >
                                {subscriptionType === 'clinic' ? 'Current Plan' : 'Yearly Plan'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="checkout-footer">
                    <button onClick={onBack} className="back-button">
                        ← Back
                    </button>
                    {subscriptionStatus === 'active' && (
                        <CancelSubscription
                            user={user}
                            onCancel={() => window.location.reload()}
                        />
                    )}
                    <button
                        onClick={() => alert('Delete account functionality coming soon')}
                        className="delete-account-button"
                        style={{
                            backgroundColor: '#dc3545',
                            color: 'white',
                            marginLeft: 'auto'
                        }}
                    >
                        Delete Account
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
