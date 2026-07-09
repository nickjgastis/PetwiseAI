import React, { useState, useRef, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { motion } from 'framer-motion';
import { FaCheck, FaCrown, FaGraduationCap, FaTimes, FaLock, FaChartPie, FaBolt } from 'react-icons/fa';
import StudentRedeem from './StudentRedeem';

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
    'Unlimited PetQuery AI assistant',
    'Saved reports library',
    'Custom templates',
    'Priority support'
];

const FEATURE_LABELS = {
    soap: 'SOAP notes',
    query: 'PetQuery questions'
};

// Out-of-usage upgrade screen for free-tier users. Unlike the old TrialEnded
// paywall this is dismissible — free users keep the app, they've just used
// 100% of this month's allowance.
const UpgradeModal = ({ user, feature = 'soap', resetsAt, onClose, onSubscribed }) => {
    const [isLoading, setIsLoading] = useState(null);
    const [currency, setCurrency] = useState('usd');
    const [showStudentRedeem, setShowStudentRedeem] = useState(false);
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    }, []);

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
        if (onClose) onClose();
    };

    const savingsAmount = PRICES[currency].monthlyAnnual - PRICES[currency].yearlyTotal;
    const resetDateLabel = resetsAt
        ? new Date(resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
        : 'next month';

    return (
        <motion.div
            ref={scrollContainerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-gradient-to-br from-[#1e3a6e] via-[#2a5298] to-[#3468bd] overflow-y-auto z-[9999]"
            style={{ overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' }}
        >
            <button
                onClick={onClose}
                className="fixed top-4 right-4 flex items-center gap-2 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm z-20"
            >
                <FaTimes />
                <span className="hidden sm:inline">Maybe later</span>
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

            <div className="min-h-full w-full flex flex-col items-center justify-center px-4 py-6 relative z-10">
                {/* Header — compact so the whole modal fits a laptop screen */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="text-center mb-4 max-w-xl"
                >
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl mb-3 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.6)]">
                        <FaChartPie className="text-white text-xl" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-white mb-1.5 tracking-tight leading-tight">
                        You've used all your free {FEATURE_LABELS[feature]} this month
                    </h1>
                    <p className="text-white/80 text-sm">
                        Resets <span className="text-emerald-300 font-semibold">{resetDateLabel}</span> — your work is saved. Upgrade for unlimited access, no waiting.
                    </p>
                </motion.div>

                {/* Currency toggle */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.08 }}
                    className="flex items-center gap-1.5 mb-4 bg-white/10 backdrop-blur-sm rounded-full p-1 border border-white/15"
                >
                    {['usd', 'cad'].map((c) => (
                        <button
                            key={c}
                            onClick={() => setCurrency(c)}
                            className={`px-4 py-1 rounded-full text-xs font-semibold transition-all ${
                                currency === c ? 'bg-white text-[#2a5298] shadow-md' : 'text-white/70 hover:text-white'
                            }`}
                        >
                            {c.toUpperCase()}
                        </button>
                    ))}
                </motion.div>

                {/* Plan cards — same style as the Profile billing cards */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.16 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full max-w-3xl items-start"
                >
                    {/* Monthly */}
                    <div className="rounded-3xl border border-gray-200 bg-white p-6 flex flex-col shadow-xl">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                            <FaBolt className="text-[#3468bd]" />
                        </div>
                        <h3 className="text-base font-bold text-gray-900">Monthly</h3>
                        <p className="text-[13px] text-gray-500 mb-4">Flexible, cancel anytime</p>

                        <div className="flex items-end gap-2 mb-4">
                            <span className="text-3xl font-extrabold text-gray-900 leading-none">
                                {PRICES[currency].symbol}{PRICES[currency].monthly}
                            </span>
                            <span className="text-gray-500 text-[11px] leading-tight pb-0.5">
                                {PRICES[currency].code} / month<br />billed monthly
                            </span>
                        </div>

                        <button
                            onClick={() => handleCheckout('monthly')}
                            disabled={isLoading !== null}
                            className="w-full py-2.5 px-6 bg-[#3468bd] text-white font-semibold rounded-xl hover:bg-[#2a5298] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm mb-4"
                        >
                            {isLoading === 'monthly' ? 'Processing...' : 'Go Monthly'}
                        </button>

                        <div className="border-t border-gray-100 pt-4">
                            <p className="text-[13px] font-semibold text-gray-900 mb-2.5">Everything in Free, plus:</p>
                            <ul className="space-y-2">
                                {FEATURES.map((f, i) => (
                                    <li key={i} className="flex items-center gap-2.5 text-gray-600 text-[13px]">
                                        <FaCheck className="text-[#3468bd] flex-shrink-0 text-[11px]" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Yearly — featured */}
                    <div className="rounded-3xl border border-amber-300 bg-gradient-to-b from-amber-50/70 to-white p-6 flex flex-col shadow-xl relative">
                        <div className="absolute -top-2.5 right-6 bg-gradient-to-r from-amber-400 to-amber-500 text-white px-3 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1">
                            <FaCrown className="text-[9px]" /> BEST VALUE
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center mb-3">
                            <FaCrown className="text-amber-600" />
                        </div>
                        <h3 className="text-base font-bold text-gray-900">Yearly</h3>
                        <p className="text-[13px] text-gray-500 mb-4">
                            Best value — save {PRICES[currency].symbol}{savingsAmount}
                        </p>

                        <div className="flex items-end gap-2 mb-4">
                            <span className="text-3xl font-extrabold text-gray-900 leading-none">
                                {PRICES[currency].symbol}{PRICES[currency].yearly}
                            </span>
                            <span className="text-gray-500 text-[11px] leading-tight pb-0.5">
                                {PRICES[currency].code} / month<br />
                                {PRICES[currency].symbol}{PRICES[currency].yearlyTotal} billed yearly
                            </span>
                        </div>

                        <button
                            onClick={() => handleCheckout('yearly')}
                            disabled={isLoading !== null}
                            className="w-full py-2.5 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm mb-4"
                        >
                            {isLoading === 'yearly' ? 'Processing...' : 'Go Yearly'}
                        </button>

                        <div className="border-t border-amber-200/70 pt-4">
                            <p className="text-[13px] font-semibold text-gray-900 mb-2.5">Everything in Monthly, plus:</p>
                            <ul className="space-y-2">
                                {FEATURES.map((f, i) => (
                                    <li key={i} className="flex items-center gap-2.5 text-gray-600 text-[13px]">
                                        <FaCheck className="text-amber-500 flex-shrink-0 text-[11px]" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </motion.div>

                {/* Trust + student access — single compact row */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-white/55 text-[11px]">
                    <span className="flex items-center gap-1.5"><FaLock className="text-[10px]" /> Secure Stripe checkout</span>
                    <span className="text-white/30">·</span>
                    <span className="flex items-center gap-1.5"><FaCheck className="text-emerald-400 text-[10px]" /> Cancel anytime</span>
                    <span className="text-white/30">·</span>
                    <button
                        onClick={() => setShowStudentRedeem(true)}
                        disabled={isLoading !== null}
                        className="flex items-center gap-1.5 text-purple-200 hover:text-white underline underline-offset-2 transition-colors disabled:opacity-50"
                    >
                        <FaGraduationCap className="text-[10px]" /> Student? Get free access
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default UpgradeModal;
