import React, { useState, useRef, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useAuth0 } from '@auth0/auth0-react';
import { FaCheck, FaCrown, FaGraduationCap, FaSignOutAlt, FaLock, FaShieldAlt, FaRegCalendarCheck } from 'react-icons/fa';
import StudentRedeem from './StudentRedeem';
import { clearAppLocalStorage } from '../utils/clearUserData';

const stripePromise = loadStripe(
    process.env.NODE_ENV === 'production'
        ? process.env.REACT_APP_STRIPE_PUBLIC_KEY_LIVE
        : process.env.REACT_APP_STRIPE_PUBLIC_KEY
);

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const PRICES = {
    usd: { monthly: 79, yearly: 69, yearlyTotal: 828, monthlyAnnual: 948, symbol: '$', code: 'USD' },
    cad: { monthly: 109, yearly: 96, yearlyTotal: 1152, monthlyAnnual: 1308, symbol: '$', code: 'CAD' }
};

const FEATURES = [
    'Unlimited SOAP reports',
    'QuickSOAP voice dictation',
    'Quick Query AI assistant',
    'Saved reports library',
    'Custom templates',
    'Priority support'
];

// Floating animated orbs background (matches OnboardingLayout)
const OrbsBackground = () => (
    <>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute w-24 h-24 sm:w-36 sm:h-36 rounded-full blur-3xl"
                style={{ background: '#3b82f6', opacity: 0.45, animation: 'teFloat1 22s ease-in-out infinite' }} />
            <div className="absolute w-20 h-20 sm:w-32 sm:h-32 rounded-full blur-3xl"
                style={{ background: '#10b981', opacity: 0.35, animation: 'teFloat2 26s ease-in-out infinite' }} />
            <div className="absolute w-28 h-28 sm:w-40 sm:h-40 rounded-full blur-3xl"
                style={{ background: '#f59e0b', opacity: 0.35, animation: 'teFloat3 24s ease-in-out infinite' }} />
            <div className="absolute w-16 h-16 sm:w-24 sm:h-24 rounded-full blur-3xl"
                style={{ background: '#a855f7', opacity: 0.3, animation: 'teFloat4 30s ease-in-out infinite' }} />
        </div>
        <style>{`
            @keyframes teFloat1 {
                0%, 100% { top: 5%; left: 8%; transform: scale(1); }
                25% { top: 50%; left: 65%; transform: scale(1.2); }
                50% { top: 75%; left: 20%; transform: scale(0.9); }
                75% { top: 20%; left: 55%; transform: scale(1.1); }
            }
            @keyframes teFloat2 {
                0%, 100% { top: 60%; left: 60%; transform: scale(1); }
                25% { top: 10%; left: 5%; transform: scale(0.95); }
                50% { top: 30%; left: 75%; transform: scale(1.15); }
                75% { top: 70%; left: 30%; transform: scale(1); }
            }
            @keyframes teFloat3 {
                0%, 100% { top: 30%; left: 78%; transform: scale(1); }
                25% { top: 65%; left: 35%; transform: scale(1.1); }
                50% { top: 10%; left: 45%; transform: scale(0.85); }
                75% { top: 50%; left: 5%; transform: scale(1.05); }
            }
            @keyframes teFloat4 {
                0%, 100% { top: 80%; left: 12%; transform: scale(1); }
                25% { top: 15%; left: 50%; transform: scale(1.15); }
                50% { top: 55%; left: 82%; transform: scale(0.9); }
                75% { top: 5%; left: 30%; transform: scale(1.1); }
            }
            @keyframes teCardIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `}</style>
    </>
);

const TrialEnded = ({ user, onSubscribed }) => {
    const { logout } = useAuth0();
    const [isLoading, setIsLoading] = useState(null);
    const [currency, setCurrency] = useState('usd');
    const [showStudentRedeem, setShowStudentRedeem] = useState(false);
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    }, []);

    const handleLogout = () => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                             window.navigator.standalone === true;
        const returnUrl = process.env.NODE_ENV === 'production'
            ? (isStandalone ? 'https://app.petwise.vet' : 'https://petwise.vet')
            : 'http://localhost:3000';
        clearAppLocalStorage();
        localStorage.removeItem('auth0.is.authenticated');
        logout({ logoutParams: { returnTo: returnUrl } });
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

    const handleStudentRedeemSuccess = () => {
        setShowStudentRedeem(false);
        window.dispatchEvent(new CustomEvent('subscriptionUpdated'));
        if (onSubscribed) onSubscribed();
    };

    const savingsAmount = PRICES[currency].monthlyAnnual - PRICES[currency].yearlyTotal;

    return (
        <div
            ref={scrollContainerRef}
            className="fixed inset-0 bg-gradient-to-br from-[#1e3a6e] via-[#2a5298] to-[#3468bd] overflow-y-auto z-[9999]"
            style={{ overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' }}
        >
            <OrbsBackground />

            <button
                onClick={handleLogout}
                className="fixed top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm z-20"
            >
                <FaSignOutAlt />
                <span className="hidden sm:inline">Log Out</span>
            </button>

            {showStudentRedeem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
                    <StudentRedeem
                        onSuccess={handleStudentRedeemSuccess}
                        onCancel={() => setShowStudentRedeem(false)}
                        userData={user}
                    />
                </div>
            )}

            <div className="min-h-full w-full flex flex-col items-center justify-center p-4 sm:p-8 relative z-10">
            <div className="text-center mb-4 sm:mb-8 mt-2 sm:mt-0 max-w-2xl" style={{ animation: 'teCardIn 0.6s ease-out' }}>
                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl mb-3 sm:mb-5 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.6)]">
                    <FaRegCalendarCheck className="text-white text-xl sm:text-3xl" />
                </div>
                <h1 className="text-2xl sm:text-5xl font-extrabold text-white mb-2 sm:mb-4 tracking-tight leading-tight">
                    Your free trial wrapped up
                </h1>
                <p className="text-white/90 text-sm sm:text-xl leading-relaxed mb-1.5 sm:mb-3">
                    Your reports, templates, and saved data are all <span className="text-emerald-300 font-semibold">still here</span>.
                </p>
                <p className="text-white/65 text-xs sm:text-base">
                    Pick a plan below to pick up right where you left off — nothing is lost.
                </p>
            </div>

            <div className="flex items-center gap-2 mb-4 sm:mb-7 bg-white/10 backdrop-blur-sm rounded-full p-1 border border-white/15" style={{ animation: 'teCardIn 0.6s ease-out 0.1s both' }}>
                <button
                    onClick={() => setCurrency('usd')}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                        currency === 'usd' ? 'bg-white text-[#2a5298] shadow-md' : 'text-white/70 hover:text-white'
                    }`}
                >
                    USD
                </button>
                <button
                    onClick={() => setCurrency('cad')}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                        currency === 'cad' ? 'bg-white text-[#2a5298] shadow-md' : 'text-white/70 hover:text-white'
                    }`}
                >
                    CAD
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-3 sm:gap-6 w-full max-w-4xl" style={{ animation: 'teCardIn 0.6s ease-out 0.2s both' }}>
                {/* Monthly card */}
                <div className="flex-1 bg-white rounded-2xl p-5 sm:p-8 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-1 sm:mb-2">Monthly</h3>
                    <div className="mb-2 sm:mb-3">
                        <span className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                            {PRICES[currency].symbol}{PRICES[currency].monthly}
                        </span>
                        <span className="text-gray-500 ml-1 text-sm">/{PRICES[currency].code}/mo</span>
                    </div>
                    <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6">Billed monthly, cancel anytime</p>

                    <ul className="space-y-1.5 sm:space-y-3 mb-5 sm:mb-7">
                        {FEATURES.map((f, i) => (
                            <li key={i} className="flex items-center gap-2 sm:gap-3 text-gray-700 text-xs sm:text-sm">
                                <FaCheck className="text-green-500 flex-shrink-0" />
                                {f}
                            </li>
                        ))}
                    </ul>

                    <button
                        onClick={() => handleCheckout('monthly')}
                        disabled={isLoading !== null}
                        className="w-full py-2.5 sm:py-3 px-6 bg-[#3468bd] text-white font-semibold rounded-xl hover:bg-[#2a5298] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                        {isLoading === 'monthly' ? 'Processing...' : 'Continue Monthly'}
                    </button>
                </div>

                {/* Yearly card — featured */}
                <div className="flex-1 bg-white rounded-2xl p-5 sm:p-8 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 ring-2 ring-amber-400 relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-500 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <FaCrown className="text-[10px]" /> BEST VALUE
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-1 sm:mb-2 mt-2">Yearly</h3>
                    <div className="mb-2 sm:mb-3">
                        <span className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                            {PRICES[currency].symbol}{PRICES[currency].yearly}
                        </span>
                        <span className="text-gray-500 ml-1 text-sm">/{PRICES[currency].code}/mo</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mb-4 sm:mb-6">
                        <span className="text-gray-500 text-xs sm:text-sm">
                            {PRICES[currency].symbol}{PRICES[currency].yearlyTotal}/{PRICES[currency].code} billed yearly
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] sm:text-[11px] font-bold">
                            Save {PRICES[currency].symbol}{savingsAmount}
                        </span>
                    </div>

                    <ul className="space-y-1.5 sm:space-y-3 mb-5 sm:mb-7">
                        {FEATURES.map((f, i) => (
                            <li key={i} className="flex items-center gap-2 sm:gap-3 text-gray-700 text-xs sm:text-sm">
                                <FaCheck className="text-green-500 flex-shrink-0" />
                                {f}
                            </li>
                        ))}
                    </ul>

                    <button
                        onClick={() => handleCheckout('yearly')}
                        disabled={isLoading !== null}
                        className="w-full py-2.5 sm:py-3 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm sm:text-base"
                    >
                        {isLoading === 'yearly' ? 'Processing...' : 'Continue Yearly'}
                    </button>
                </div>
            </div>

            {/* Trust signals row */}
            <div className="mt-4 sm:mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-white/55 text-[11px] sm:text-xs">
                <span className="flex items-center gap-1.5"><FaLock className="text-[10px]" /> Secure checkout via Stripe</span>
                <span className="hidden sm:inline text-white/30">·</span>
                <span className="flex items-center gap-1.5"><FaCheck className="text-emerald-400 text-[10px]" /> Cancel anytime</span>
                <span className="hidden sm:inline text-white/30">·</span>
                <span className="flex items-center gap-1.5"><FaShieldAlt className="text-[10px]" /> No setup fees</span>
            </div>

            <div className="mt-3 sm:mt-6 flex flex-col items-center">
                <button
                    onClick={() => setShowStudentRedeem(true)}
                    disabled={isLoading !== null}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-100/95 backdrop-blur-sm text-purple-700 font-semibold rounded-xl hover:bg-purple-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm"
                >
                    <FaGraduationCap />
                    Student Access
                </button>
                <p className="text-white/55 text-[11px] mt-1.5 text-center">
                    Vet students get free access with school credentials
                </p>
            </div>

            <p className="text-white/55 text-[11px] sm:text-xs mt-3 sm:mt-6 text-center max-w-md">
                Questions? Email <a href="mailto:support@petwise.vet" className="text-white/75 underline underline-offset-2 hover:text-white">support@petwise.vet</a> — we're happy to help.
            </p>
            </div>
        </div>
    );
};

export default TrialEnded;
