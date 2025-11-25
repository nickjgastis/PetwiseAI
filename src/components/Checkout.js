import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import CancelSubscription from './CancelSubscription';
import { useAuth0 } from '@auth0/auth0-react';
import { supabase } from '../supabaseClient';
import StudentRedeem from './StudentRedeem';
import { useNavigate } from 'react-router-dom';

const stripePromise = loadStripe(
    process.env.NODE_ENV === 'production'
        ? process.env.REACT_APP_STRIPE_PUBLIC_KEY_LIVE
        : process.env.REACT_APP_STRIPE_PUBLIC_KEY
);

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const Checkout = ({ onBack, user, subscriptionStatus, embedded = false, onSubscriptionChange }) => {
    const { logout } = useAuth0();
    const navigate = useNavigate();
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
                // Refresh subscription data in parent component if callback provided
                if (onSubscriptionChange) {
                    // Small delay to ensure database has updated
                    setTimeout(() => {
                        onSubscriptionChange();
                    }, 300);
                }
                // Dispatch event to notify Dashboard and other components
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('subscriptionUpdated'));
                }, 300);
                // Small delay to ensure database has updated, then navigate to QuickSOAP
                setTimeout(() => {
                    navigate('/dashboard/quicksoap');
                }, 500);
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

            // Success! Refresh subscription data in parent component if callback provided
            if (onSubscriptionChange) {
                setTimeout(() => {
                    onSubscriptionChange();
                }, 300);
            }
            // Dispatch event to notify Dashboard and other components
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('subscriptionUpdated'));
            }, 300);
            // Small delay to ensure database has updated, then navigate to QuickSOAP
            setTimeout(() => {
                navigate('/dashboard/quicksoap');
            }, 500);
        } catch (error) {
            setAccessCodeError(error.message);
        }
    };

    const handleStudentRedeemSuccess = () => {
        setShowStudentRedeem(false);
        // Refresh subscription data in parent component if callback provided
        if (onSubscriptionChange) {
            setTimeout(() => {
                onSubscriptionChange();
            }, 300);
        }
        // Dispatch event to notify Dashboard and other components
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('subscriptionUpdated'));
        }, 300);
        // Small delay to ensure database has updated, then navigate to QuickSOAP
        setTimeout(() => {
            navigate('/dashboard/quicksoap');
        }, 500);
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
        <div className={`flex justify-center gap-1 ${embedded ? 'mb-4' : 'mb-0'} bg-gray-100 p-1 rounded-lg w-fit mx-auto`}>
            <button
                className={`px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 ${currency === 'usd'
                    ? 'bg-white text-primary-600 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-primary-600'
                    }`}
                onClick={() => setCurrency('usd')}
            >
                USD
            </button>
            <button
                className={`px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 ${currency === 'cad'
                    ? 'bg-white text-primary-600 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-primary-600'
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
                    <>
                        {subscriptionStatus === 'active' ? (
                            <div className="text-center mb-6 md:mb-8 px-2">
                                <h3 className="text-2xl md:text-3xl font-bold text-primary-600 mb-2">Manage Subscription</h3>
                                <p className="text-gray-600 text-sm md:text-lg font-medium leading-relaxed max-w-2xl mx-auto">
                                    Current Plan: {(() => {
                                        const planTypes = {
                                            trial: 'Free Trial (50 reports/day)',
                                            monthly: 'Monthly Plan',
                                            yearly: 'Yearly Plan'
                                        };
                                        return `${planTypes[subscriptionInterval] || 'Unknown Plan'} - Features Active`;
                                    })()}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="text-center mb-8">
                                    <h1 className="text-3xl md:text-4xl font-extrabold text-primary-600 tracking-tight">
                                        Start Your PetWise Membership
                                    </h1>
                                    <p className="text-gray-600 text-sm md:text-lg font-medium mt-3 max-w-2xl mx-auto leading-relaxed">
                                        Join thousands of veterinarians using PetWise to complete SOAP records,
                                        QuickQuery research, and client communication in seconds.
                                    </p>
                                </div>
                                <div className="flex justify-center gap-4 mt-4 mb-4 text-gray-500 text-xs md:text-sm font-medium">
                                    <div className="flex items-center gap-1">
                                        <span className="text-primary-600 font-bold text-lg">✓</span> No credit card required
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-primary-600 font-bold text-lg">✓</span> Cancel anytime
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-primary-600 font-bold text-lg">✓</span> HIPAA-aligned, secure
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}

                <CurrencyToggle />

                <div className={`flex flex-col md:flex-row gap-3 md:gap-5 justify-center items-center ${embedded ? 'mb-6' : 'mb-8'} px-3 md:px-0 mt-5`}>
                    {/* Monthly Plan Card */}
                    <div className={`w-full md:flex-1 p-6 rounded-2xl bg-white border transition-all duration-300 flex flex-col ${subscriptionInterval === 'monthly'
                        ? 'border-primary-600 shadow-xl shadow-primary-100'
                        : 'border-gray-200 shadow-md hover:shadow-xl hover:border-primary-200'
                        } relative`}>
                        {subscriptionInterval === 'monthly' && (
                            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-primary-600 to-primary-700 text-white px-3 py-1 rounded-full text-xs font-bold">
                                CURRENT PLAN
                            </div>
                        )}
                        <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">
                            Monthly
                        </h3>
                        <p className="text-4xl font-extrabold text-gray-900 text-center mb-1">
                            {PRICES[currency].symbol}{PRICES[currency].monthly}
                        </p>
                        <p className="text-center text-gray-500 text-sm mb-6">
                            {PRICES[currency].code} per vet per month
                        </p>
                        <ul className="space-y-3 text-gray-700 text-sm mb-8 flex-1">
                            <li className="flex items-center gap-2">
                                <span className="text-primary-600 font-bold">✓</span> Unlimited SOAP reports
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-primary-600 font-bold">✓</span> Unlimited QuickQuery
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-primary-600 font-bold">✓</span> Saved reports
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-primary-600 font-bold">✓</span> Priority support
                            </li>
                        </ul>
                        <button
                            onClick={() => handleCheckout('monthly')}
                            className="w-full py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-auto"
                            disabled={subscriptionInterval === 'monthly' && !user.cancel_at_period_end}
                        >
                            {subscriptionInterval === 'monthly' ? 'Current Plan' : 'Sign Up Monthly'}
                        </button>
                    </div>

                    {/* Free Trial Card */}
                    <div className={`w-full md:flex-1 p-6 rounded-2xl bg-gradient-to-b from-white to-blue-50 border border-primary-200 shadow-xl shadow-primary-100 relative transform md:-translate-y-1 md:scale-[1.03] transition-all duration-300 flex flex-col ${user.has_used_trial ? 'opacity-60 cursor-not-allowed' : ''}`}>
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap">
                            No Credit Card Required
                        </div>
                        <h3 className="text-xl font-bold text-primary-700 mb-2 text-center mt-2">
                            30-Day Free Trial
                        </h3>
                        <p className="text-4xl font-extrabold text-gray-900 text-center">
                            $0
                        </p>
                        <p className="text-center text-gray-500 text-sm mb-6">
                            No credit card required
                        </p>
                        <ul className="space-y-3 text-gray-700 text-sm mb-8 flex-1">
                            <li className="flex items-center gap-2">
                                <span className="text-primary-600 font-bold">✓</span> 50 SOAP records per day
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-primary-600 font-bold">✓</span> QuickQuery access
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-primary-600 font-bold">✓</span> Full dashboard access
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-primary-600 font-bold">✓</span> All core features included
                            </li>
                        </ul>
                        <button
                            onClick={handleTrialActivation}
                            className="w-full py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-auto"
                            disabled={user.has_used_trial || subscriptionStatus === 'active'}
                        >
                            {user.has_used_trial ? 'Trial Used' : 'Start Free Trial'}
                        </button>
                    </div>

                    {/* Yearly Plan Card */}
                    <div className={`w-full md:flex-1 p-6 rounded-2xl bg-white border transition-all duration-300 flex flex-col ${subscriptionInterval === 'yearly'
                        ? 'border-primary-600 shadow-xl shadow-primary-100'
                        : 'border-gray-200 shadow-md hover:shadow-xl hover:border-primary-200'
                        } relative`}>
                        {subscriptionInterval === 'yearly' && (
                            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-primary-600 to-primary-700 text-white px-3 py-1 rounded-full text-xs font-bold">
                                CURRENT PLAN
                            </div>
                        )}
                        <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">
                            Yearly
                        </h3>
                        <p className="text-4xl font-extrabold text-gray-900 text-center mb-1">
                            {PRICES[currency].symbol}{PRICES[currency].yearly}
                        </p>
                        <p className="text-center text-gray-500 text-sm mb-6">
                            {PRICES[currency].code} per vet per month
                        </p>
                        <ul className="space-y-3 text-gray-700 text-sm mb-8 flex-1">
                            <li className="flex items-center gap-2">
                                <span className="text-primary-600 font-bold">✓</span> Unlimited SOAP reports
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-primary-600 font-bold">✓</span> Unlimited QuickQuery
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-primary-600 font-bold">✓</span> Saved reports
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-primary-600 font-bold">✓</span> Priority support
                            </li>
                        </ul>
                        <button
                            onClick={() => handleCheckout('yearly')}
                            className="w-full py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-auto"
                            disabled={subscriptionInterval === 'yearly' && !user.cancel_at_period_end}
                        >
                            {subscriptionInterval === 'yearly' ? 'Current Plan' : 'Sign Up Yearly'}
                        </button>
                    </div>
                </div>

                {/* Create a wrapper for the access code, student, and enterprise sections */}
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto ${embedded ? 'mb-6' : 'mb-8'} px-3 md:px-0`}>
                    <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                        <h3 className="text-sm font-semibold text-gray-800 mb-1">
                            Partner Clinic Access
                        </h3>
                        <p className="text-gray-500 text-xs mb-3 leading-relaxed">
                            Enter your clinic's access code for full access.
                        </p>
                        {!showAccessCodeInput ? (
                            <button
                                className="w-full py-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 text-white font-medium text-sm hover:from-primary-700 hover:to-primary-800 shadow-md hover:shadow-lg transition-all duration-200"
                                onClick={() => setShowAccessCodeInput(true)}
                            >
                                Enter Access Code
                            </button>
                        ) : (
                            <form onSubmit={handleAccessCodeSubmit} className="flex flex-col items-center gap-2">
                                <input
                                    type="text"
                                    value={accessCode}
                                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                    placeholder="Enter your access code"
                                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-xs text-center tracking-wider uppercase transition-all duration-300 bg-white font-semibold text-gray-800 focus:border-primary-600 focus:shadow-lg focus:bg-gray-50"
                                />
                                <button type="submit" className="w-full py-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 text-white font-medium text-sm hover:from-primary-700 hover:to-primary-800 shadow-md hover:shadow-lg transition-all duration-200">
                                    Submit
                                </button>
                                {accessCodeError && (
                                    <div className="text-red-600 text-xs font-semibold text-center mt-1 px-2 py-1 bg-red-50 rounded border border-red-200">{accessCodeError}</div>
                                )}
                            </form>
                        )}
                    </div>

                    <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                        <h3 className="text-sm font-semibold text-gray-800 mb-1">
                            Student Access
                        </h3>
                        <p className="text-gray-500 text-xs mb-3 leading-relaxed">
                            Get free access with your student credentials.
                        </p>
                        <button
                            className="w-full py-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 text-white font-medium text-sm hover:from-primary-700 hover:to-primary-800 shadow-md hover:shadow-lg transition-all duration-200"
                            onClick={() => setShowStudentRedeem(true)}
                        >
                            Student Access
                        </button>
                    </div>

                    <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                        <h3 className="text-sm font-semibold text-gray-800 mb-1">
                            Enterprise Plans
                        </h3>
                        <p className="text-gray-500 text-xs mb-3 leading-relaxed">
                            Looking to sign up your whole clinic staff? Contact us for enterprise plans.
                        </p>
                        <a href="mailto:support@petwise.vet" className="w-full py-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 text-white font-medium text-sm hover:from-primary-700 hover:to-primary-800 shadow-md hover:shadow-lg transition-all duration-200 inline-flex items-center justify-center no-underline">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" className="mr-1">
                                <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383-4.708 2.825L15 11.105V5.383zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741zM1 11.105l4.708-2.897L1 5.383v5.722z" />
                            </svg>
                            Contact Us
                        </a>
                    </div>
                </div>

                {/* Billing Management Section for Active Subscribers */}
                {subscriptionStatus === 'active' && user.stripe_customer_id && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 mx-auto text-center max-w-md shadow-md hover:shadow-xl hover:border-primary-200 transition-all duration-300">
                        <h3 className="text-gray-800 text-lg font-bold mb-3">Billing Management</h3>
                        <p className="text-gray-600 mb-4 leading-relaxed font-medium max-w-xs mx-auto text-sm">Update your payment method, view invoices, and manage billing details.</p>
                        <button
                            onClick={handleBillingPortal}
                            className="bg-gradient-to-r from-primary-500 to-primary-600 text-white border-none px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 inline-flex items-center gap-2 shadow-md hover:shadow-lg hover:from-primary-600 hover:to-primary-700"
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
                            className="px-5 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-600 cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:border-primary-600 hover:text-primary-600 hover:-translate-y-0.5"
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
