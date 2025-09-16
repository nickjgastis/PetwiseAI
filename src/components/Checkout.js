import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import CancelSubscription from './CancelSubscription';
import { useAuth0 } from '@auth0/auth0-react';
import { supabase } from '../supabaseClient';
import StudentRedeem from './StudentRedeem';

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
    const [showStudentRedeem, setShowStudentRedeem] = useState(false);

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

    const handleStudentRedeemSuccess = () => {
        setShowStudentRedeem(false);
        // Refresh user data to show updated subscription
        window.location.reload();
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
        <div className={`flex justify-center gap-1 ${embedded ? 'mb-4' : 'mb-6'} bg-gray-100 p-1 rounded-lg w-fit mx-auto`}>
            <button
                className={`px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 ${currency === 'usd'
                    ? 'bg-white text-blue-600 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-blue-600'
                    }`}
                onClick={() => setCurrency('usd')}
            >
                USD
            </button>
            <button
                className={`px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 ${currency === 'cad'
                    ? 'bg-white text-blue-600 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-blue-600'
                    }`}
                onClick={() => setCurrency('cad')}
            >
                CAD
            </button>
        </div>
    );

    return (
        <div className={`${embedded ? 'w-full' : 'max-w-6xl mx-auto px-6 py-6'}`}>
            {showStudentRedeem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <StudentRedeem
                        onSuccess={handleStudentRedeemSuccess}
                        onCancel={() => setShowStudentRedeem(false)}
                        userData={user}
                    />
                </div>
            )}
            <div className="w-full">
                {!embedded && (
                    <div className="text-center mb-8">
                        <h3 className="text-3xl font-bold text-blue-400 mb-2">{subscriptionStatus === 'active' ? 'Manage Subscription' : 'Choose Your Plan'}</h3>
                        <p className="text-gray-600 text-lg font-medium leading-relaxed">
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
                )}

                <CurrencyToggle />

                <div className={`flex flex-col md:flex-row gap-4 md:gap-5 justify-center items-center ${embedded ? 'mb-6' : 'mb-8'} px-4 md:px-0`}>
                    {/* Monthly Plan Card */}
                    <div className={`w-full md:flex-1 min-w-[280px] max-w-[400px] md:max-w-[300px] min-h-[340px] md:min-h-[380px] p-4 md:p-5 flex flex-col bg-white rounded-xl md:rounded-2xl shadow-lg border transition-all duration-400 ${subscriptionInterval === 'monthly'
                        ? 'border-blue-600 shadow-blue-100'
                        : 'border-gray-200 hover:-translate-y-1 hover:shadow-xl hover:border-blue-200'
                        } relative`}>
                        {subscriptionInterval === 'monthly' && (
                            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1 rounded-full text-xs font-bold">
                                CURRENT PLAN
                            </div>
                        )}
                        <div className="min-h-[120px] pb-4 border-b border-gray-200 text-center flex flex-col justify-start mb-0">
                            <h3 className="text-xl font-bold text-blue-600 mb-3">Monthly</h3>
                            <p className="text-3xl font-bold text-gray-800 flex items-baseline justify-center gap-1">
                                {PRICES[currency].symbol}{PRICES[currency].monthly}
                                <span className="text-sm text-gray-500 font-medium"> {PRICES[currency].code}/Vet/Month</span>
                            </p>
                        </div>
                        <ul className="my-4 flex-1 flex flex-col">
                            <li className="py-2 text-gray-700 text-sm flex items-center gap-2 border-b border-gray-100 px-1 font-medium">
                                <span className="text-blue-600 font-bold bg-blue-50 min-w-[18px] w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs">✓</span>
                                Unlimited SOAP reports
                            </li>
                            <li className="py-2 text-gray-700 text-sm flex items-center gap-2 border-b border-gray-100 px-1 font-medium">
                                <span className="text-blue-600 font-bold bg-blue-50 min-w-[18px] w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs">✓</span>
                                Unlimited Quick Query
                            </li>
                            <li className="py-2 text-gray-700 text-sm flex items-center gap-2 border-b border-gray-100 px-1 font-medium">
                                <span className="text-blue-600 font-bold bg-blue-50 min-w-[18px] w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs">✓</span>
                                Saved reports
                            </li>
                            <li className="py-2 text-gray-700 text-sm flex items-center gap-2 px-1 font-medium pb-4">
                                <span className="text-blue-600 font-bold bg-blue-50 min-w-[18px] w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs">✓</span>
                                Priority support
                            </li>
                        </ul>
                        <div className="mt-auto">
                            <button
                                onClick={() => handleCheckout('monthly')}
                                className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-none text-white cursor-pointer tracking-wide bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg hover:from-blue-700 hover:to-blue-800 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                                disabled={subscriptionInterval === 'monthly' && !user.cancel_at_period_end}
                            >
                                {subscriptionInterval === 'monthly' ? 'Current Plan' : 'Sign Up Now'}
                            </button>
                        </div>
                    </div>

                    {/* Free Trial Card */}
                    <div className={`w-full md:flex-1 min-w-[280px] max-w-[400px] md:max-w-[300px] min-h-[340px] md:min-h-[380px] p-4 md:p-5 flex flex-col bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl md:rounded-2xl shadow-lg border-2 border-yellow-400 md:transform md:-translate-y-2 md:scale-105 z-10 relative transition-all duration-400 md:hover:-translate-y-3 md:hover:scale-110 hover:shadow-2xl ${user.has_used_trial ? 'opacity-60 cursor-not-allowed' : ''
                        }`}>
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-4 py-1 rounded-full text-xs font-bold">
                            POPULAR
                        </div>
                        <div className="min-h-[120px] pb-4 border-b border-yellow-200 text-center flex flex-col justify-start mb-0">
                            <h3 className="text-xl font-bold text-gray-700 mb-3">30 Day Free Trial</h3>
                            <p className="text-3xl font-bold text-gray-800 flex items-baseline justify-center gap-1">
                                $0<span className="text-sm text-gray-500 font-medium">/mo</span>
                            </p>
                        </div>
                        <ul className="my-4 flex-1 flex flex-col">
                            <li className="py-2 text-gray-700 text-sm flex items-center gap-2 border-b border-yellow-200 px-1 font-medium">
                                <span className="text-blue-600 font-bold bg-blue-50 min-w-[18px] w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs">✓</span>
                                No credit card required
                            </li>
                            <li className="py-2 text-gray-700 text-sm flex items-center gap-2 border-b border-yellow-200 px-1 font-medium">
                                <span className="text-blue-600 font-bold bg-blue-50 min-w-[18px] w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs">✓</span>
                                50 records per day
                            </li>
                            <li className="py-2 text-gray-700 text-sm flex items-center gap-2 px-1 font-medium pb-4">
                                <span className="text-blue-600 font-bold bg-blue-50 min-w-[18px] w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs">✓</span>
                                Quick Query
                            </li>
                        </ul>
                        <div className="mt-auto">
                            <button
                                onClick={handleTrialActivation}
                                className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-none text-white cursor-pointer tracking-wide bg-gradient-to-r from-gray-600 to-gray-700 shadow-lg hover:from-gray-700 hover:to-gray-800 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                                disabled={user.has_used_trial || subscriptionStatus === 'active'}
                            >
                                {user.has_used_trial ? 'Trial Used' : 'Start Free Trial'}
                            </button>
                        </div>
                    </div>

                    {/* Yearly Plan Card */}
                    <div className={`w-full md:flex-1 min-w-[280px] max-w-[400px] md:max-w-[300px] min-h-[340px] md:min-h-[380px] p-4 md:p-5 flex flex-col bg-white rounded-xl md:rounded-2xl shadow-lg border transition-all duration-400 ${subscriptionInterval === 'yearly'
                        ? 'border-blue-600 shadow-blue-100'
                        : 'border-gray-200 hover:-translate-y-1 hover:shadow-xl hover:border-blue-200'
                        } relative`}>
                        {subscriptionInterval === 'yearly' && (
                            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1 rounded-full text-xs font-bold">
                                CURRENT PLAN
                            </div>
                        )}
                        <div className="min-h-[120px] pb-4 border-b border-gray-200 text-center flex flex-col justify-start mb-0">
                            <h3 className="text-xl font-bold text-blue-600 mb-3">Yearly</h3>
                            <p className="text-3xl font-bold text-gray-800 flex items-baseline justify-center gap-1">
                                {PRICES[currency].symbol}{PRICES[currency].yearly}
                                <span className="text-sm text-gray-500 font-medium"> {PRICES[currency].code}/Vet/Month</span>
                            </p>
                            <p className="mt-1 px-2 py-1 bg-gradient-to-r from-green-50 to-green-100 text-green-700 rounded-xl text-xs font-semibold inline-block">
                                Save {currency === 'usd' ? '31' : '30'}%
                            </p>
                        </div>
                        <ul className="my-4 flex-1 flex flex-col">
                            <li className="py-2 text-gray-700 text-sm flex items-center gap-2 border-b border-gray-100 px-1 font-medium">
                                <span className="text-blue-600 font-bold bg-blue-50 min-w-[18px] w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs">✓</span>
                                Unlimited SOAP reports
                            </li>
                            <li className="py-2 text-gray-700 text-sm flex items-center gap-2 border-b border-gray-100 px-1 font-medium">
                                <span className="text-blue-600 font-bold bg-blue-50 min-w-[18px] w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs">✓</span>
                                Unlimited Quick Query
                            </li>
                            <li className="py-2 text-gray-700 text-sm flex items-center gap-2 border-b border-gray-100 px-1 font-medium">
                                <span className="text-blue-600 font-bold bg-blue-50 min-w-[18px] w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs">✓</span>
                                Saved reports
                            </li>
                            <li className="py-2 text-gray-700 text-sm flex items-center gap-2 px-1 font-medium pb-4">
                                <span className="text-blue-600 font-bold bg-blue-50 min-w-[18px] w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs">✓</span>
                                Priority support
                            </li>
                        </ul>
                        <div className="mt-auto">
                            <button
                                onClick={() => handleCheckout('yearly')}
                                className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-none text-white cursor-pointer tracking-wide bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg hover:from-blue-700 hover:to-blue-800 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                                disabled={subscriptionInterval === 'yearly' && !user.cancel_at_period_end}
                            >
                                {subscriptionInterval === 'yearly' ? 'Current Plan' : 'Sign Up Now'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Create a wrapper for the access code, student, and enterprise sections */}
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 max-w-6xl mx-auto ${embedded ? 'mb-6' : 'mb-8'} px-4 md:px-0`}>
                    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-3 text-center shadow-lg border border-gray-200 min-h-[100px] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-200 relative overflow-hidden">
                        <div className="absolute top-2 right-2 text-lg opacity-10">🏥</div>
                        <h3 className="text-sm font-bold text-gray-800 mb-2 relative z-10 leading-tight">Is your clinic a partner?</h3>
                        {!showAccessCodeInput ? (
                            <button
                                className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-semibold px-4 py-2 border-none rounded-lg cursor-pointer transition-all duration-200 shadow-lg hover:from-blue-700 hover:to-blue-800 hover:-translate-y-0.5 relative z-10 min-h-[36px]"
                                onClick={() => setShowAccessCodeInput(true)}
                            >
                                Enter Access Code
                            </button>
                        ) : (
                            <form onSubmit={handleAccessCodeSubmit} className="flex flex-col items-center gap-2 max-w-xs w-full mx-auto relative z-10">
                                <input
                                    type="text"
                                    value={accessCode}
                                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                    placeholder="Enter your access code"
                                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm text-center tracking-wider uppercase transition-all duration-300 bg-white font-semibold text-gray-800 focus:border-blue-600 focus:shadow-lg focus:bg-gray-50 min-h-[36px]"
                                />
                                <button type="submit" className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-semibold px-4 py-2 border-none rounded-lg cursor-pointer transition-all duration-200 shadow-lg hover:from-blue-700 hover:to-blue-800 hover:-translate-y-0.5 min-h-[36px]">
                                    Submit
                                </button>
                                {accessCodeError && (
                                    <div className="text-red-600 text-xs font-semibold text-center mt-1 px-2 py-1 bg-red-50 rounded border border-red-200">{accessCodeError}</div>
                                )}
                            </form>
                        )}
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 text-center shadow-lg border-2 border-purple-200 min-h-[100px] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-purple-300 relative overflow-hidden">
                        <div className="absolute top-2 right-2 text-lg opacity-10">🎓</div>
                        <h3 className="text-sm font-bold text-purple-800 mb-2 relative z-10 leading-tight">Are you a veterinary student?</h3>
                        <p className="text-purple-600 mb-3 relative z-10 leading-relaxed font-medium text-xs">Get free access with your student credentials!</p>
                        <button
                            className="inline-flex items-center justify-center bg-gradient-to-r from-purple-600 to-purple-700 text-white text-xs font-semibold px-4 py-2 border-none rounded-lg cursor-pointer transition-all duration-200 shadow-lg hover:from-purple-700 hover:to-purple-800 hover:-translate-y-0.5 relative z-10 min-h-[36px]"
                            onClick={() => setShowStudentRedeem(true)}
                        >
                            🎓 Student Access
                        </button>
                    </div>

                    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-3 text-center shadow-lg border border-gray-200 min-h-[100px] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-200 relative overflow-hidden">
                        <div className="absolute top-2 right-2 text-lg opacity-10">🏢</div>
                        <h3 className="text-sm font-bold text-gray-800 mb-2 relative z-10 leading-tight">Looking to sign up your whole clinic staff?</h3>
                        <p className="text-gray-600 mb-3 relative z-10 leading-relaxed font-medium text-xs">We've got you covered! Contact us for enterprise plans.</p>
                        <a href="mailto:support@petwise.vet" className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-semibold px-4 py-2 border-none rounded-lg cursor-pointer transition-all duration-200 shadow-lg hover:from-blue-700 hover:to-blue-800 hover:-translate-y-0.5 relative z-10 min-h-[36px] no-underline">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" className="mr-1">
                                <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383-4.708 2.825L15 11.105V5.383zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741zM1 11.105l4.708-2.897L1 5.383v5.722z" />
                            </svg>
                            Contact Us!
                        </a>
                    </div>
                </div>

                {/* Billing Management Section for Active Subscribers */}
                {subscriptionStatus === 'active' && user.stripe_customer_id && (
                    <div className="bg-gradient-to-br from-white to-blue-50 border-2 border-blue-200 rounded-xl md:rounded-2xl p-3 md:p-4 mx-auto text-center max-w-md shadow-lg min-h-[120px] md:min-h-[140px] flex flex-col justify-center relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-300">
                        <div className="absolute top-3 right-3 text-xl opacity-15">💳</div>
                        <h3 className="text-gray-800 text-lg font-bold mb-3 relative z-10">Billing Management</h3>
                        <p className="text-gray-600 mb-4 relative z-10 leading-relaxed font-medium max-w-xs mx-auto text-sm">Update your payment method, view invoices, and manage billing details.</p>
                        <button
                            onClick={handleBillingPortal}
                            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-none px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 inline-flex items-center gap-2 shadow-lg hover:from-blue-600 hover:to-blue-700 hover:-translate-y-0.5 relative z-10 min-h-[48px]"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M4 10a1 1 0 0 1 2 0v1a1 1 0 0 1-2 0v-1zm6-6a1 1 0 0 1 2 0v7a1 1 0 0 1-2 0V4zM2 7a1 1 0 0 1 2 0v4a1 1 0 0 1-2 0V7zm8-5a1 1 0 0 1 2 0v9a1 1 0 0 1-2 0V2zm-2-1a1 1 0 0 1 2 0v10a1 1 0 0 1-2 0V1z" />
                            </svg>
                            Manage Billing & Invoices
                        </button>
                    </div>
                )}

                {!embedded && (
                    <div className="flex justify-center items-center mt-8 pt-4 w-full">
                        <button
                            onClick={onBack}
                            className="px-5 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-600 cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:border-blue-600 hover:text-blue-600 hover:-translate-y-0.5"
                        >
                            ← Back
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Checkout;
