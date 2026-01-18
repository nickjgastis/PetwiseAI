import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { FaCheck, FaCrown, FaArrowLeft, FaCreditCard, FaGraduationCap } from 'react-icons/fa';
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

const ManageSubscription = ({ user, subscriptionStatus, subscriptionInterval, onBack, onSubscriptionChange }) => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(null);
    const [currency, setCurrency] = useState('usd');
    const [showStudentRedeem, setShowStudentRedeem] = useState(false);

    const PRICES = {
        usd: {
            monthly: 79,
            yearly: 69,
            yearlyTotal: 828,
            symbol: '$',
            code: 'USD'
        },
        cad: {
            monthly: 109,
            yearly: 96,
            yearlyTotal: 1152,
            symbol: '$',
            code: 'CAD'
        }
    };

    const handleCheckout = async (planType) => {
        setIsLoading(planType);
        try {
            const stripe = await stripePromise;
            if (!stripe) throw new Error('Stripe failed to initialize');

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
                setIsLoading(null);
                return;
            }

            const result = await stripe.redirectToCheckout({ sessionId: session.id });
            if (result.error) {
                console.error(result.error.message);
                setIsLoading(null);
            }
        } catch (error) {
            console.error('Checkout error:', error);
            setIsLoading(null);
        }
    };

    const handleTrialActivation = async () => {
        setIsLoading('trial');
        try {
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

            // Refresh subscription data
            if (onSubscriptionChange) {
                onSubscriptionChange();
            }
            
            // Dispatch event to notify other components
            window.dispatchEvent(new CustomEvent('subscriptionUpdated'));
        } catch (error) {
            console.error('Trial activation error:', error);
            alert(error.message);
            setIsLoading(null);
        }
    };

    const handleBillingPortal = async () => {
        setIsLoading('portal');
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
            setIsLoading(null);
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

    const features = [
        'Unlimited SOAP reports',
        'QuickSOAP voice dictation',
        'Quick Query AI assistant',
        'Saved reports library',
        'Custom templates',
        'Priority support'
    ];

    const getCurrentPlanLabel = () => {
        if (subscriptionInterval === 'trial') return 'Free Trial';
        if (subscriptionInterval === 'monthly') return 'Monthly Plan';
        if (subscriptionInterval === 'yearly') return 'Yearly Plan';
        return 'No Active Plan';
    };

    const isCurrentPlan = (planType) => {
        return subscriptionInterval === planType && subscriptionStatus === 'active';
    };

    const hasUsedTrial = user?.has_used_trial;
    const hasStripeCustomer = user?.stripe_customer_id;

    return (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#2a5298] via-[#3468bd] to-[#1e3a6e] flex flex-col items-center p-4 sm:p-8 overflow-y-auto">
            {/* Student Redeem Modal */}
            {showStudentRedeem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <StudentRedeem
                        onSuccess={handleStudentRedeemSuccess}
                        onCancel={() => setShowStudentRedeem(false)}
                        userData={user}
                    />
                </div>
            )}

            {/* Header with back button */}
            <div className="w-full max-w-5xl mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
                >
                    <FaArrowLeft />
                    <span>Back to Profile</span>
                </button>
            </div>

            {/* Title */}
            <div className="text-center mb-6 sm:mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <img src="/PW.png" alt="Petwise" className="w-10 h-10 sm:w-12 sm:h-12" />
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">
                        Manage Subscription
                    </h1>
                </div>
                <p className="text-white/80 text-sm sm:text-base">
                    Current Plan: <span className="font-semibold">{getCurrentPlanLabel()}</span>
                </p>
            </div>

            {/* Currency Toggle */}
            <div className="flex items-center gap-2 mb-6 bg-white/10 rounded-full p-1">
                <button
                    onClick={() => setCurrency('usd')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        currency === 'usd' 
                            ? 'bg-white text-[#3468bd]' 
                            : 'text-white/80 hover:text-white'
                    }`}
                >
                    USD
                </button>
                <button
                    onClick={() => setCurrency('cad')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        currency === 'cad' 
                            ? 'bg-white text-[#3468bd]' 
                            : 'text-white/80 hover:text-white'
                    }`}
                >
                    CAD
                </button>
            </div>

            {/* Plan Cards */}
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 w-full max-w-5xl mb-8">
                {/* Monthly Plan */}
                <div className={`flex-1 bg-white rounded-2xl p-6 sm:p-8 shadow-xl transition-all duration-300 relative ${
                    isCurrentPlan('monthly') ? 'ring-4 ring-yellow-400' : 'hover:shadow-2xl hover:-translate-y-1'
                }`}>
                    {isCurrentPlan('monthly') && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-xs font-bold">
                            CURRENT PLAN
                        </div>
                    )}
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Monthly</h3>
                    <div className="mb-4">
                        <span className="text-4xl font-extrabold text-gray-900">
                            {PRICES[currency].symbol}{PRICES[currency].monthly}
                        </span>
                        <span className="text-gray-500 ml-1">/{PRICES[currency].code}/mo</span>
                    </div>
                    <p className="text-gray-500 text-sm mb-6">Billed monthly, cancel anytime</p>
                    
                    <ul className="space-y-3 mb-8">
                        {features.map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-3 text-gray-700 text-sm">
                                <FaCheck className="text-green-500 flex-shrink-0" />
                                {feature}
                            </li>
                        ))}
                    </ul>

                    <button
                        onClick={() => handleCheckout('monthly')}
                        disabled={isLoading !== null || isCurrentPlan('monthly')}
                        className={`w-full py-3 px-6 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isCurrentPlan('monthly')
                                ? 'bg-yellow-100 text-yellow-700 cursor-default'
                                : 'bg-[#3468bd] text-white hover:bg-[#2a5298]'
                        }`}
                    >
                        {isLoading === 'monthly' ? 'Processing...' : isCurrentPlan('monthly') ? 'Current Plan' : 'Switch to Monthly'}
                    </button>
                </div>

                {/* Trial Plan */}
                <div className={`flex-1 bg-white rounded-2xl p-6 sm:p-8 shadow-xl transition-all duration-300 relative ${
                    isCurrentPlan('trial') ? 'ring-4 ring-yellow-400' : hasUsedTrial ? 'opacity-60' : 'hover:shadow-2xl hover:-translate-y-1'
                } order-first lg:order-none`}>
                    {isCurrentPlan('trial') && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-xs font-bold">
                            CURRENT PLAN
                        </div>
                    )}
                    {!hasUsedTrial && !isCurrentPlan('trial') && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#3468bd] to-[#2a5298] text-white px-4 py-1 rounded-full text-xs font-bold">
                            FREE
                        </div>
                    )}
                    <h3 className="text-xl font-bold text-gray-800 mb-2 mt-2">Free Trial</h3>
                    <div className="mb-4">
                        <span className="text-4xl font-extrabold text-gray-900">
                            {PRICES[currency].symbol}0
                        </span>
                        <span className="text-gray-500 ml-1">/30 days</span>
                    </div>
                    <p className="text-gray-500 text-sm mb-6">
                        {hasUsedTrial ? 'Trial already used' : 'No credit card required'}
                    </p>
                    
                    <ul className="space-y-3 mb-8">
                        {features.map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-3 text-gray-700 text-sm">
                                <FaCheck className="text-green-500 flex-shrink-0" />
                                {feature}
                            </li>
                        ))}
                    </ul>

                    <button
                        onClick={handleTrialActivation}
                        disabled={isLoading !== null || hasUsedTrial || isCurrentPlan('trial')}
                        className={`w-full py-3 px-6 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isCurrentPlan('trial')
                                ? 'bg-yellow-100 text-yellow-700 cursor-default'
                                : hasUsedTrial
                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-[#3468bd] to-[#2a5298] text-white hover:from-[#2a5298] hover:to-[#1e3a6e] shadow-lg'
                        }`}
                    >
                        {isLoading === 'trial' ? 'Activating...' : isCurrentPlan('trial') ? 'Current Plan' : hasUsedTrial ? 'Trial Used' : 'Start Free Trial'}
                    </button>
                </div>

                {/* Yearly Plan */}
                <div className={`flex-1 bg-white rounded-2xl p-6 sm:p-8 shadow-xl transition-all duration-300 relative ${
                    isCurrentPlan('yearly') ? 'ring-4 ring-yellow-400' : 'hover:shadow-2xl hover:-translate-y-1'
                }`}>
                    {isCurrentPlan('yearly') && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-xs font-bold z-10">
                            CURRENT PLAN
                        </div>
                    )}
                    {!isCurrentPlan('yearly') && (
                        <div className="absolute -top-3 right-4 bg-gradient-to-r from-amber-400 to-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <FaCrown className="text-[10px]" /> BEST VALUE
                        </div>
                    )}
                    <h3 className="text-xl font-bold text-gray-800 mb-2 mt-2">Yearly</h3>
                    <div className="mb-4">
                        <span className="text-4xl font-extrabold text-gray-900">
                            {PRICES[currency].symbol}{PRICES[currency].yearly}
                        </span>
                        <span className="text-gray-500 ml-1">/{PRICES[currency].code}/mo</span>
                    </div>
                    <p className="text-gray-500 text-sm mb-6">
                        {PRICES[currency].symbol}{PRICES[currency].yearlyTotal}/{PRICES[currency].code} billed yearly
                    </p>
                    
                    <ul className="space-y-3 mb-8">
                        {features.map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-3 text-gray-700 text-sm">
                                <FaCheck className="text-green-500 flex-shrink-0" />
                                {feature}
                            </li>
                        ))}
                    </ul>

                    <button
                        onClick={() => handleCheckout('yearly')}
                        disabled={isLoading !== null || isCurrentPlan('yearly')}
                        className={`w-full py-3 px-6 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isCurrentPlan('yearly')
                                ? 'bg-yellow-100 text-yellow-700 cursor-default'
                                : 'bg-[#3468bd] text-white hover:bg-[#2a5298]'
                        }`}
                    >
                        {isLoading === 'yearly' ? 'Processing...' : isCurrentPlan('yearly') ? 'Current Plan' : 'Switch to Yearly'}
                    </button>
                </div>
            </div>

            {/* Action Buttons - Student Access & Billing Settings */}
            <div className="w-full max-w-5xl flex justify-center gap-4 flex-wrap">
                {/* Student Access Button - Always visible */}
                <button
                    onClick={() => setShowStudentRedeem(true)}
                    disabled={isLoading !== null}
                    className="flex items-center justify-center gap-2 px-8 py-3 bg-purple-100 text-purple-700 font-semibold rounded-xl hover:bg-purple-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                    <FaGraduationCap />
                    Student Access
                </button>
                
                {/* Billing Settings - Only for Stripe customers */}
                {hasStripeCustomer && (
                    <button
                        onClick={handleBillingPortal}
                        disabled={isLoading !== null}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-white text-[#3468bd] font-semibold rounded-xl hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        <FaCreditCard />
                        {isLoading === 'portal' ? 'Loading...' : 'Billing Settings'}
                    </button>
                )}
            </div>

            {/* Footer note */}
            <p className="text-white/60 text-xs mt-8 text-center max-w-md">
                Changes to your subscription will take effect immediately. You can manage payment methods and view invoices in Billing Settings.
            </p>
        </div>
    );
};

export default ManageSubscription;
