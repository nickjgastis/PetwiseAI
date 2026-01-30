import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useAuth0 } from '@auth0/auth0-react';
import { FaCheck, FaCrown, FaGraduationCap, FaSignOutAlt } from 'react-icons/fa';
import StudentRedeem from './StudentRedeem';

const stripePromise = loadStripe(
    process.env.NODE_ENV === 'production'
        ? process.env.REACT_APP_STRIPE_PUBLIC_KEY_LIVE
        : process.env.REACT_APP_STRIPE_PUBLIC_KEY
);

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const PlanSelection = ({ user, onTrialActivated, onPlanSelected }) => {
    const { logout } = useAuth0();
    const [isLoading, setIsLoading] = useState(null); // Track which button is loading
    const [currency, setCurrency] = useState('usd');
    const [showStudentRedeem, setShowStudentRedeem] = useState(false);

    const handleLogout = () => {
        logout({
            logoutParams: {
                returnTo: window.location.origin.includes('app.petwise.vet') 
                    ? 'https://petwise.vet' 
                    : window.location.origin
            }
        });
    };

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

    // Stripe Trial Checkout (14-day free trial with card)
    const handleStripeTrialCheckout = async (trialCurrency) => {
        setIsLoading(`trial_${trialCurrency}`);
        try {
            const stripe = await stripePromise;
            if (!stripe) throw new Error('Stripe failed to initialize');

            const response = await fetch(`${API_URL}/create-trial-checkout-session`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user,
                    currency: trialCurrency
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.code === 'TRIAL_ALREADY_USED') {
                    throw new Error('You have already used your free trial');
                }
                throw new Error(data.error || 'Failed to start trial checkout');
            }

            const result = await stripe.redirectToCheckout({ sessionId: data.id });
            if (result.error) {
                console.error(result.error.message);
                setIsLoading(null);
            }
        } catch (error) {
            console.error('Trial checkout error:', error);
            alert(error.message);
            setIsLoading(null);
        }
    };

    const handleStudentRedeemSuccess = () => {
        setShowStudentRedeem(false);
        // Dispatch event to notify Dashboard and other components
        window.dispatchEvent(new CustomEvent('subscriptionUpdated'));
        // Notify parent that plan was selected (similar to trial activation)
        if (onTrialActivated) {
            onTrialActivated();
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
        <div className="min-h-screen bg-gradient-to-br from-[#2a5298] via-[#3468bd] to-[#1e3a6e] flex flex-col items-center justify-center p-4 sm:p-8 relative">
            {/* Logout Button */}
            <button
                onClick={handleLogout}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm"
            >
                <FaSignOutAlt />
                <span className="hidden sm:inline">Log Out</span>
            </button>

            {/* Student Redeem Modal */}
            {showStudentRedeem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <StudentRedeem
                        onSuccess={handleStudentRedeemSuccess}
                        onCancel={() => setShowStudentRedeem(false)}
                        userData={user}
                    />
                </div>
            )}

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
                    Start with a 14-day free trial or select a plan that fits your practice
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

                {/* 14-Day Stripe Trial - Center/Featured */}
                <div className="flex-1 bg-white rounded-2xl p-6 sm:p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 ring-2 ring-[#3468bd] relative order-first lg:order-none">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#3468bd] to-[#2a5298] text-white px-4 py-1 rounded-full text-xs font-bold">
                        RECOMMENDED
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2 mt-2">Free Trial</h3>
                    <div className="mb-4">
                        <span className="text-4xl font-extrabold text-gray-900">
                            $0
                        </span>
                        <span className="text-gray-500 ml-1">/14 days</span>
                    </div>
                    <p className="text-gray-500 text-sm mb-6">Full unlimited access • Cancel anytime</p>
                    
                    <ul className="space-y-3 mb-6">
                        {features.map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-3 text-gray-700 text-sm">
                                <FaCheck className="text-green-500 flex-shrink-0" />
                                {feature}
                            </li>
                        ))}
                    </ul>

                    <div className="space-y-2">
                        <button
                            onClick={() => handleStripeTrialCheckout(currency)}
                            disabled={isLoading !== null}
                            className="w-full py-3 px-6 bg-gradient-to-r from-[#3468bd] to-[#2a5298] text-white font-semibold rounded-xl hover:from-[#2a5298] hover:to-[#1e3a6e] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            {isLoading?.startsWith('trial_') ? 'Loading...' : 'Start Free Trial'}
                        </button>
                        <p className="text-xs text-gray-400 text-center mt-2">
                            Auto-renews to monthly after 14 days. Cancel anytime.
                        </p>
                    </div>
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

            {/* Student Access Button */}
            <div className="mt-8 flex flex-col items-center">
                <button
                    onClick={() => setShowStudentRedeem(true)}
                    disabled={isLoading !== null}
                    className="flex items-center justify-center gap-2 px-8 py-3 bg-purple-100 text-purple-700 font-semibold rounded-xl hover:bg-purple-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                    <FaGraduationCap />
                    Student Access
                </button>
                <p className="text-white/70 text-xs mt-2 text-center">
                    Vet students get free access with school credentials
                </p>
            </div>

            {/* Footer note */}
            <p className="text-white/60 text-xs mt-8 text-center max-w-md">
                All plans include full access to all features. Paid plans will be charged immediately.
            </p>
        </div>
    );
};

export default PlanSelection;
