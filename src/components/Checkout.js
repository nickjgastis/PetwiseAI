import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import CancelSubscription from './CancelSubscription';
import { useAuth0 } from '@auth0/auth0-react';
import { supabase } from '../supabaseClient';
import '../styles/Checkout.css';
import '../styles/Profile.css';

const stripePromise = loadStripe(
    process.env.NODE_ENV === 'production'
        ? process.env.REACT_APP_STRIPE_PUBLIC_KEY_LIVE
        : process.env.REACT_APP_STRIPE_PUBLIC_KEY
);

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const Checkout = ({ onBack, user, subscriptionStatus, embedded = false }) => {
    const { logout } = useAuth0();
    const [subscriptionInterval, setSubscriptionInterval] = useState(null);
    const [accessCode, setAccessCode] = useState('');
    const [accessCodeError, setAccessCodeError] = useState('');
    const [showAccessCodeInput, setShowAccessCodeInput] = useState(false);
    const [currency, setCurrency] = useState('usd');

    const PRICES = {
        usd: {
            monthly: 129,
            yearly: 89,
            symbol: '$',
            code: 'USD'
        },
        cad: {
            monthly: 179,
            yearly: 126,
            symbol: '$',
            code: 'CAD'
        }
    };

    useEffect(() => {
        const fetchSubscriptionInfo = async () => {
            if (!user?.sub) return;

            try {
                // First try to get from user object if available
                if (user.subscription_interval) {
                    setSubscriptionInterval(user.subscription_interval);
                    return;
                }

                const response = await fetch(`${API_URL}/check-subscription/${user.sub}`, {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const data = await response.json();

                // Set the interval based on the response or user data
                const interval = data.subscription_interval || user.subscription_interval;
                if (interval) {
                    setSubscriptionInterval(interval);
                } else if (subscriptionStatus === 'active') {
                    // If active but no interval specified, check if it's a trial
                    setSubscriptionInterval(user.has_used_trial ? 'trial' : null);
                }
            } catch (error) {
                console.error('Error fetching subscription info:', error);
            }
        };

        fetchSubscriptionInfo();
    }, [user, subscriptionStatus]);

    const handleCheckout = async (planType) => {
        try {
            const stripe = await stripePromise;
            if (!stripe) throw new Error('Stripe failed to initialize');
            if (!user) throw new Error('No user data available');

            const response = await fetch(`${API_URL}/create-checkout-session`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user,
                    planType,
                    currency
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
            console.log('Starting trial activation for user:', user.sub);

            const response = await fetch(`${API_URL}/activate-trial`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: user.sub,
                    emailOptOut: false
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to activate trial');
            }

            console.log('Trial activation response:', data);

            if (data && data.length > 0) {
                window.location.reload();
            } else {
                throw new Error('No data returned from trial activation');
            }
        } catch (error) {
            console.error('Trial activation error:', error);
            // You might want to show this error to the user
            alert(`Failed to activate trial: ${error.message}`);
        }
    };

    const handleAccessCodeSubmit = async (e) => {
        e.preventDefault();
        setAccessCodeError('');

        try {
            const response = await fetch(`${API_URL}/activate-access-code`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: user.sub,
                    accessCode
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error);
            }

            // Success! Reload the page to update subscription status
            window.location.reload();
        } catch (error) {
            setAccessCodeError(error.message);
        }
    };

    const handleBillingPortal = async () => {
        try {
            const response = await fetch(`${API_URL}/create-customer-portal`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: user.sub
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to access billing portal');
            }

            // Redirect to Stripe Customer Portal
            window.location.href = data.url;
        } catch (error) {
            console.error('Billing portal error:', error);
            alert(`Unable to access billing portal: ${error.message}`);
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

    const CurrencyToggle = () => (
        <div className="currency-toggle">
            <button
                className={`currency-button ${currency === 'usd' ? 'active' : ''}`}
                onClick={() => setCurrency('usd')}
            >
                USD
            </button>
            <button
                className={`currency-button ${currency === 'cad' ? 'active' : ''}`}
                onClick={() => setCurrency('cad')}
            >
                CAD
            </button>
        </div>
    );

    return (
        <div className={`checkout-container ${embedded ? 'embedded' : ''}`}>
            <div className="checkout-options">
                <div className="checkout-header">
                    <h3>{subscriptionStatus === 'active' ? 'Manage Subscription' : 'Choose Your Plan'}</h3>
                    <p className="checkout-subtitle">
                        {subscriptionStatus === 'active' ? (
                            <>
                                Current Plan: {(() => {
                                    const planTypes = {
                                        trial: 'Free Trial (50 reports/day)',
                                        monthly: 'Monthly Plan',
                                        yearly: 'Yearly Plan'
                                    };
                                    return `${planTypes[subscriptionInterval] || 'Unknown Plan'} - Features Active`;
                                })()}
                            </>
                        ) : (
                            'Experience the full power of PetwiseAI! Start with a free trial - no credit card required.'
                        )}
                    </p>
                </div>

                <CurrencyToggle />

                <div className="checkout-pricing-container">
                    {/* Monthly Plan Card */}
                    <div className={`checkout-pricing-card ${subscriptionInterval === 'monthly' ? 'current' : ''}`}>
                        <div className="checkout-pricing-header">
                            <h3>Monthly</h3>
                            <p className="checkout-price">
                                {PRICES[currency].symbol}{PRICES[currency].monthly}
                                <span> {PRICES[currency].code}/Vet/Month</span>
                            </p>
                        </div>
                        <ul className="checkout-pricing-features">
                            <li>Unlimited SOAP reports</li>
                            <li>Unlimited Quick Query</li>
                            <li>Saved reports</li>
                            <li>Priority support</li>
                        </ul>
                        <div className="checkout-footer">
                            <button
                                onClick={() => handleCheckout('monthly')}
                                className="checkout-subscribe-button"
                                disabled={subscriptionInterval === 'monthly' && !user.cancel_at_period_end}
                            >
                                {subscriptionInterval === 'monthly' ? 'Current Plan' : 'Sign Up Now'}
                            </button>
                        </div>
                    </div>

                    {/* Free Trial Card */}
                    <div className={`checkout-pricing-card free highlight-card ${user.has_used_trial ? 'disabled' : ''}`}>
                        <div className="checkout-pricing-header">
                            <h3>30 Day Free Trial</h3>
                            <p className="checkout-price">$0<span>/mo</span></p>
                        </div>
                        <ul className="checkout-pricing-features">
                            <li>No credit card required</li>
                            <li>50 records per day</li>
                            <li>Quick Query</li>
                        </ul>
                        <div className="checkout-footer">
                            <button
                                onClick={handleTrialActivation}
                                className="checkout-trial-button"
                                disabled={user.has_used_trial || subscriptionStatus === 'active'}
                            >
                                {user.has_used_trial ? 'Trial Used' : 'Start Free Trial'}
                            </button>
                        </div>
                    </div>

                    {/* Yearly Plan Card */}
                    <div className={`checkout-pricing-card ${subscriptionInterval === 'yearly' ? 'current' : ''}`}>
                        <div className="checkout-pricing-header">
                            <h3>Yearly</h3>
                            <p className="checkout-price">
                                {PRICES[currency].symbol}{PRICES[currency].yearly}
                                <span> {PRICES[currency].code}/Vet/Month</span>
                            </p>
                            <p className="checkout-savings">Save {currency === 'usd' ? '31' : '30'}%</p>
                        </div>
                        <ul className="checkout-pricing-features">
                            <li>Unlimited SOAP reports</li>
                            <li>Unlimited Quick Query</li>
                            <li>Saved reports</li>
                            <li>Priority support</li>
                        </ul>
                        <div className="checkout-footer">
                            <button
                                onClick={() => handleCheckout('yearly')}
                                className="checkout-subscribe-button"
                                disabled={subscriptionInterval === 'yearly' && !user.cancel_at_period_end}
                            >
                                {subscriptionInterval === 'yearly' ? 'Current Plan' : 'Sign Up Now'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Create a wrapper for the access code and enterprise sections */}
                <div className="checkout-info-sections">
                    <div className="checkout-access-code-section">
                        <h3>Is your clinic a partner?</h3>
                        {!showAccessCodeInput ? (
                            <button
                                className="checkout-access-code-button"
                                onClick={() => setShowAccessCodeInput(true)}
                            >
                                Enter Access Code
                            </button>
                        ) : (
                            <form onSubmit={handleAccessCodeSubmit} className="access-code-form">
                                <input
                                    type="text"
                                    value={accessCode}
                                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                    placeholder="Enter your access code"
                                    className="access-code-input"
                                />
                                <button type="submit" className="access-code-submit">
                                    Submit
                                </button>
                                {accessCodeError && (
                                    <div className="access-code-error">{accessCodeError}</div>
                                )}
                            </form>
                        )}
                    </div>

                    <div className="checkout-enterprise-section">
                        <h3>Looking to sign up your whole clinic staff, or multiple clinics?</h3>
                        <p>We've got you covered! Contact support@petwise.vet for enterprise plans.</p>
                        <a href="mailto:support@petwise.vet" className="enterprise-contact-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383-4.708 2.825L15 11.105V5.383zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741zM1 11.105l4.708-2.897L1 5.383v5.722z" />
                            </svg>
                            Contact Us!
                        </a>
                    </div>
                </div>

                {/* Billing Management Section for Active Subscribers */}
                {subscriptionStatus === 'active' && user.stripe_customer_id && (
                    <div className="checkout-billing-management">
                        <h3>Billing Management</h3>
                        <p>Update your payment method, view invoices, and manage billing details.</p>
                        <button
                            onClick={handleBillingPortal}
                            className="checkout-billing-portal-button"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M4 10a1 1 0 0 1 2 0v1a1 1 0 0 1-2 0v-1zm6-6a1 1 0 0 1 2 0v7a1 1 0 0 1-2 0V4zM2 7a1 1 0 0 1 2 0v4a1 1 0 0 1-2 0V7zm8-5a1 1 0 0 1 2 0v9a1 1 0 0 1-2 0V2zm-2-1a1 1 0 0 1 2 0v10a1 1 0 0 1-2 0V1z" />
                            </svg>
                            Manage Billing & Invoices
                        </button>
                    </div>
                )}

                {!embedded && (
                    <div className="checkout-footer">
                        <button onClick={onBack} className="checkout-back-button">
                            ← Back
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Checkout;
