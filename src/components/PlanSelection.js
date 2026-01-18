import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { FaCheck, FaCrown } from 'react-icons/fa';

const stripePromise = loadStripe(
    process.env.NODE_ENV === 'production'
        ? process.env.REACT_APP_STRIPE_PUBLIC_KEY_LIVE
        : process.env.REACT_APP_STRIPE_PUBLIC_KEY
);

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const PlanSelection = ({ user, onTrialActivated, onPlanSelected }) => {
    const [isLoading, setIsLoading] = useState(null); // Track which button is loading
    const [currency, setCurrency] = useState('usd');

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

            // Notify parent that trial was activated
            if (onTrialActivated) {
                onTrialActivated(data);
            }
        } catch (error) {
            console.error('Trial activation error:', error);
            setIsLoading(null);
        }
    };

    const features = [
        'Unlimited SOAP reports',
        'QuickSOAP voice dictation',
        'Quick Query AI assistant',
        'Saved reports library',
        'Custom templates',
        'Priority support'
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#2a5298] via-[#3468bd] to-[#1e3a6e] flex flex-col items-center justify-center p-4 sm:p-8">
            {/* Header */}
            <div className="text-center mb-8 sm:mb-12">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <img src="/PW.png" alt="Petwise" className="w-12 h-12 sm:w-14 sm:h-14" />
                    <h1 className="text-3xl sm:text-4xl font-bold text-white">
                        Petwise<span className="font-normal">.vet</span>
                    </h1>
                </div>
                <h2 className="text-xl sm:text-2xl text-white/90 font-medium mb-2">
                    Choose Your Plan
                </h2>
                <p className="text-white/70 text-sm sm:text-base max-w-md mx-auto">
                    Start with a free trial or select a plan that fits your practice
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
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 w-full max-w-5xl">
                {/* Monthly Plan */}
                <div className="flex-1 bg-white rounded-2xl p-6 sm:p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
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
                        disabled={isLoading !== null}
                        className="w-full py-3 px-6 bg-[#3468bd] text-white font-semibold rounded-xl hover:bg-[#2a5298] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading === 'monthly' ? 'Processing...' : 'Get Monthly'}
                    </button>
                </div>

                {/* Trial Plan - Center/Featured */}
                <div className="flex-1 bg-white rounded-2xl p-6 sm:p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 ring-2 ring-[#3468bd] relative order-first lg:order-none">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#3468bd] to-[#2a5298] text-white px-4 py-1 rounded-full text-xs font-bold">
                        RECOMMENDED
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2 mt-2">Free Trial</h3>
                    <div className="mb-4">
                        <span className="text-4xl font-extrabold text-gray-900">
                            {PRICES[currency].symbol}0
                        </span>
                        <span className="text-gray-500 ml-1">/30 days</span>
                    </div>
                    <p className="text-gray-500 text-sm mb-6">No credit card required</p>
                    
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
                        disabled={isLoading !== null}
                        className="w-full py-3 px-6 bg-gradient-to-r from-[#3468bd] to-[#2a5298] text-white font-semibold rounded-xl hover:from-[#2a5298] hover:to-[#1e3a6e] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        {isLoading === 'trial' ? 'Activating...' : 'Start Free Trial'}
                    </button>
                </div>

                {/* Yearly Plan */}
                <div className="flex-1 bg-white rounded-2xl p-6 sm:p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative">
                    <div className="absolute -top-3 right-4 bg-gradient-to-r from-amber-400 to-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <FaCrown className="text-[10px]" /> BEST VALUE
                    </div>
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
                        disabled={isLoading !== null}
                        className="w-full py-3 px-6 bg-[#3468bd] text-white font-semibold rounded-xl hover:bg-[#2a5298] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading === 'yearly' ? 'Processing...' : 'Get Yearly'}
                    </button>
                </div>
            </div>

            {/* Footer note */}
            <p className="text-white/60 text-xs mt-8 text-center max-w-md">
                All plans include full access to all features. Paid plans will be charged immediately.
            </p>
        </div>
    );
};

export default PlanSelection;
