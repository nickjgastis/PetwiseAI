import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useAuth0 } from '@auth0/auth0-react';
import { FaCheck, FaCrown, FaGraduationCap, FaSignOutAlt } from 'react-icons/fa';
import StudentRedeem from '../StudentRedeem';
import OnboardingLayout from './OnboardingLayout';

const stripePromise = loadStripe(
    process.env.NODE_ENV === 'production'
        ? process.env.REACT_APP_STRIPE_PUBLIC_KEY_LIVE
        : process.env.REACT_APP_STRIPE_PUBLIC_KEY
);

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const PRICES = {
    usd: { monthly: 79, yearly: 69, yearlyTotal: 828, symbol: '$', code: 'USD' },
    cad: { monthly: 109, yearly: 96, yearlyTotal: 1152, symbol: '$', code: 'CAD' }
};

const FEATURES = [
    'Unlimited SOAP reports',
    'QuickSOAP voice dictation',
    'Quick Query AI assistant',
    'Saved reports library',
    'Custom templates',
    'Priority support'
];

const TrialStep = ({ user, onTrialActivated, onBack }) => {
    const { logout } = useAuth0();
    const [isLoading, setIsLoading] = useState(null);
    const [currency, setCurrency] = useState('usd');
    const [showStudentRedeem, setShowStudentRedeem] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        setIsMobile(mobile);
    }, []);

    const handleLogout = () => {
        logout({
            logoutParams: {
                returnTo: window.location.origin.includes('app.petwise.vet') 
                    ? 'https://petwise.vet' 
                    : window.location.origin
            }
        });
    };

    const handleCheckout = async (planType) => {
        setIsLoading(planType);
        try {
            const stripe = await stripePromise;
            if (!stripe) throw new Error('Stripe failed to initialize');

            const response = await fetch(`${API_URL}/create-checkout-session`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user, planType, currency }),
            });

            const session = await response.json();
            if (!session?.id) { setIsLoading(null); return; }

            const result = await stripe.redirectToCheckout({ sessionId: session.id });
            if (result.error) setIsLoading(null);
        } catch (error) {
            console.error('Checkout error:', error);
            setIsLoading(null);
        }
    };

    const handleStripeTrialCheckout = async (trialCurrency) => {
        setIsLoading(`trial_${trialCurrency}`);
        try {
            const stripe = await stripePromise;
            if (!stripe) throw new Error('Stripe failed to initialize');

            const response = await fetch(`${API_URL}/create-trial-checkout-session`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user, currency: trialCurrency }),
            });

            const data = await response.json();
            if (!response.ok) {
                if (data.code === 'TRIAL_ALREADY_USED') throw new Error('You have already used your free trial');
                throw new Error(data.error || 'Failed to start trial checkout');
            }

            const result = await stripe.redirectToCheckout({ sessionId: data.id });
            if (result.error) setIsLoading(null);
        } catch (error) {
            console.error('Trial checkout error:', error);
            alert(error.message);
            setIsLoading(null);
        }
    };

    const handleStudentRedeemSuccess = () => {
        setShowStudentRedeem(false);
        window.dispatchEvent(new CustomEvent('subscriptionUpdated'));
        if (onTrialActivated) onTrialActivated();
    };

    // =================== MOBILE LAYOUT ===================
    if (isMobile) {
        return (
            <OnboardingLayout currentStep="trial" showProgress={true} onBack={onBack}>
                <div className="animate-fade-in">
                    {/* Logout */}
                    <div className="flex justify-end mb-3">
                        <button onClick={handleLogout} className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs transition-colors">
                            <FaSignOutAlt className="text-[10px]" /> Log Out
                        </button>
                    </div>

                    {/* Header */}
                    <div className="text-center mb-4">
                        <h1 className="text-xl font-bold text-white mb-1">Choose Your Plan</h1>
                        <p className="text-white/60 text-xs">Start with a 14-day free trial or pick a plan</p>
                    </div>

                    {/* Currency toggle */}
                    <div className="flex justify-center mb-3">
                        <div className="flex items-center gap-1 bg-white/10 rounded-full p-0.5">
                            <button onClick={() => setCurrency('usd')} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${currency === 'usd' ? 'bg-white text-[#3468bd]' : 'text-white/80'}`}>USD</button>
                            <button onClick={() => setCurrency('cad')} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${currency === 'cad' ? 'bg-white text-[#3468bd]' : 'text-white/80'}`}>CAD</button>
                        </div>
                    </div>

                    {/* Features list */}
                    <div className="bg-white/10 rounded-xl p-3 mb-4">
                        <p className="text-white/80 text-xs font-semibold mb-2 uppercase tracking-wide">All plans include:</p>
                        <div className="grid grid-cols-2 gap-1.5">
                            {FEATURES.map((f, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <FaCheck className="text-green-400 text-[10px] flex-shrink-0" />
                                    <span className="text-white/90 text-xs">{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Plan cards — compact */}
                    <div className="space-y-2.5 mb-4">
                        {/* Trial — featured */}
                        <div className="bg-white rounded-xl p-4 ring-2 ring-[#3db6fd] relative">
                            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#3db6fd] text-white px-3 py-0.5 rounded-full text-[10px] font-bold">RECOMMENDED</div>
                            <div className="flex items-center justify-between mt-1">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm">14-Day Free Trial</h3>
                                    <p className="text-gray-400 text-xs">Full access • Cancel anytime</p>
                                </div>
                                <span className="text-2xl font-extrabold text-gray-900">$0</span>
                            </div>
                            <button
                                onClick={() => handleStripeTrialCheckout(currency)}
                                disabled={isLoading !== null}
                                className="w-full mt-3 py-2.5 bg-[#3db6fd] text-white font-semibold rounded-lg text-sm disabled:opacity-50 transition-all"
                            >
                                {isLoading?.startsWith('trial_') ? 'Loading...' : 'Start Free Trial'}
                            </button>
                            <p className="text-[10px] text-gray-400 text-center mt-1.5">Auto-renews to monthly. Cancel anytime.</p>
                        </div>

                        {/* Monthly */}
                        <div className="bg-white rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm">Monthly</h3>
                                    <p className="text-gray-400 text-xs">Access to all features</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xl font-extrabold text-gray-900">{PRICES[currency].symbol}{PRICES[currency].monthly}</span>
                                    <span className="text-gray-400 text-xs">/{PRICES[currency].code}/mo</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleCheckout('monthly')}
                                disabled={isLoading !== null}
                                className="w-full mt-3 py-2 bg-[#3468bd] text-white font-semibold rounded-lg text-sm disabled:opacity-50 transition-all"
                            >
                                {isLoading === 'monthly' ? 'Processing...' : 'Get Monthly'}
                            </button>
                        </div>

                        {/* Yearly */}
                        <div className="bg-white rounded-xl p-4 relative">
                            <div className="absolute -top-2.5 right-3 bg-amber-400 text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                                <FaCrown className="text-[8px]" /> BEST VALUE
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm">Yearly</h3>
                                    <p className="text-gray-400 text-xs">{PRICES[currency].symbol}{PRICES[currency].yearlyTotal}/{PRICES[currency].code} billed yearly</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xl font-extrabold text-gray-900">{PRICES[currency].symbol}{PRICES[currency].yearly}</span>
                                    <span className="text-gray-400 text-xs">/{PRICES[currency].code}/mo</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleCheckout('yearly')}
                                disabled={isLoading !== null}
                                className="w-full mt-3 py-2 bg-[#3468bd] text-white font-semibold rounded-lg text-sm disabled:opacity-50 transition-all"
                            >
                                {isLoading === 'yearly' ? 'Processing...' : 'Get Yearly'}
                            </button>
                        </div>
                    </div>

                    {/* Student */}
                    <div className="text-center">
                        <button
                            onClick={() => setShowStudentRedeem(true)}
                            disabled={isLoading !== null}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-100 text-purple-700 font-semibold rounded-lg text-xs disabled:opacity-50 transition-all"
                        >
                            <FaGraduationCap /> Student Access
                        </button>
                        <p className="text-white/50 text-[10px] mt-1">Free access with school credentials</p>
                    </div>

                    {/* Student modal */}
                    {showStudentRedeem && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <StudentRedeem onSuccess={handleStudentRedeemSuccess} onCancel={() => setShowStudentRedeem(false)} userData={user} />
                        </div>
                    )}
                </div>
            </OnboardingLayout>
        );
    }

    // =================== DESKTOP LAYOUT ===================
    // Desktop uses the existing full PlanSelection layout — render it inline without the OnboardingLayout
    // since PlanSelection already has its own full-page styling
    return (
        <OnboardingLayout currentStep="trial" showProgress={true} wide={true} onBack={onBack}>
            <div className="animate-fade-in">
                {/* Logout */}
                <div className="flex justify-end mb-3">
                    <button onClick={handleLogout} className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors">
                        <FaSignOutAlt /> Log Out
                    </button>
                </div>

                {/* Header */}
                <div className="text-center mb-6">
                    <div className="flex items-center justify-center gap-3 mb-3">
                        <img src="/PW.png" alt="Petwise" className="w-12 h-12" />
                        <h1 className="text-3xl font-bold text-white">Petwise<span className="font-normal">.vet</span></h1>
                    </div>
                    <h2 className="text-xl text-white/90 font-medium mb-1">Choose Your Plan</h2>
                    <p className="text-white/60 text-sm">Start with a 14-day free trial or select a plan</p>
                </div>

                {/* Currency toggle */}
                <div className="flex justify-center mb-6">
                    <div className="flex items-center gap-2 bg-white/10 rounded-full p-1">
                        <button onClick={() => setCurrency('usd')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${currency === 'usd' ? 'bg-white text-[#3468bd]' : 'text-white/80'}`}>USD</button>
                        <button onClick={() => setCurrency('cad')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${currency === 'cad' ? 'bg-white text-[#3468bd]' : 'text-white/80'}`}>CAD</button>
                    </div>
                </div>

                {/* Cards row */}
                <div className="flex gap-5 w-full max-w-5xl mx-auto">
                    {/* Monthly */}
                    <div className="flex-1 bg-white rounded-2xl p-6 shadow-xl">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Monthly</h3>
                        <div className="mb-3">
                            <span className="text-4xl font-extrabold text-gray-900">{PRICES[currency].symbol}{PRICES[currency].monthly}</span>
                            <span className="text-gray-500 ml-1">/{PRICES[currency].code}/mo</span>
                        </div>
                        <p className="text-gray-500 text-sm mb-5">Billed monthly, cancel anytime</p>
                        <ul className="space-y-2.5 mb-6">
                            {FEATURES.map((f, i) => (
                                <li key={i} className="flex items-center gap-2.5 text-gray-700 text-sm"><FaCheck className="text-green-500 flex-shrink-0" />{f}</li>
                            ))}
                        </ul>
                        <button onClick={() => handleCheckout('monthly')} disabled={isLoading !== null} className="w-full py-3 bg-[#3468bd] text-white font-semibold rounded-xl disabled:opacity-50 transition-all">
                            {isLoading === 'monthly' ? 'Processing...' : 'Get Monthly'}
                        </button>
                    </div>

                    {/* Trial — featured */}
                    <div className="flex-1 bg-white rounded-2xl p-6 shadow-xl ring-2 ring-[#3db6fd] relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#3db6fd] text-white px-4 py-1 rounded-full text-xs font-bold">RECOMMENDED</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2 mt-2">Free Trial</h3>
                        <div className="mb-3">
                            <span className="text-4xl font-extrabold text-gray-900">$0</span>
                            <span className="text-gray-500 ml-1">/14 days</span>
                        </div>
                        <p className="text-gray-500 text-sm mb-5">Full access • Cancel anytime</p>
                        <ul className="space-y-2.5 mb-5">
                            {FEATURES.map((f, i) => (
                                <li key={i} className="flex items-center gap-2.5 text-gray-700 text-sm"><FaCheck className="text-green-500 flex-shrink-0" />{f}</li>
                            ))}
                        </ul>
                        <button onClick={() => handleStripeTrialCheckout(currency)} disabled={isLoading !== null} className="w-full py-3 bg-[#3db6fd] text-white font-semibold rounded-xl disabled:opacity-50 transition-all shadow-lg">
                            {isLoading?.startsWith('trial_') ? 'Loading...' : 'Start Free Trial'}
                        </button>
                        <p className="text-xs text-gray-400 text-center mt-2">Auto-renews to monthly. Cancel anytime.</p>
                    </div>

                    {/* Yearly */}
                    <div className="flex-1 bg-white rounded-2xl p-6 shadow-xl relative">
                        <div className="absolute -top-3 right-4 bg-amber-400 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><FaCrown className="text-[10px]" /> BEST VALUE</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2 mt-2">Yearly</h3>
                        <div className="mb-3">
                            <span className="text-4xl font-extrabold text-gray-900">{PRICES[currency].symbol}{PRICES[currency].yearly}</span>
                            <span className="text-gray-500 ml-1">/{PRICES[currency].code}/mo</span>
                        </div>
                        <p className="text-gray-500 text-sm mb-5">{PRICES[currency].symbol}{PRICES[currency].yearlyTotal}/{PRICES[currency].code} billed yearly</p>
                        <ul className="space-y-2.5 mb-6">
                            {FEATURES.map((f, i) => (
                                <li key={i} className="flex items-center gap-2.5 text-gray-700 text-sm"><FaCheck className="text-green-500 flex-shrink-0" />{f}</li>
                            ))}
                        </ul>
                        <button onClick={() => handleCheckout('yearly')} disabled={isLoading !== null} className="w-full py-3 bg-[#3468bd] text-white font-semibold rounded-xl disabled:opacity-50 transition-all">
                            {isLoading === 'yearly' ? 'Processing...' : 'Get Yearly'}
                        </button>
                    </div>
                </div>

                {/* Student */}
                <div className="text-center mt-6">
                    <button onClick={() => setShowStudentRedeem(true)} disabled={isLoading !== null} className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-100 text-purple-700 font-semibold rounded-xl disabled:opacity-50 transition-all shadow-lg">
                        <FaGraduationCap /> Student Access
                    </button>
                    <p className="text-white/60 text-xs mt-1.5">Vet students get free access with school credentials</p>
                </div>

                <p className="text-white/50 text-xs mt-6 text-center">All plans include full access to all features.</p>

                {showStudentRedeem && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <StudentRedeem onSuccess={handleStudentRedeemSuccess} onCancel={() => setShowStudentRedeem(false)} userData={user} />
                    </div>
                )}
            </div>
        </OnboardingLayout>
    );
};

export default TrialStep;
