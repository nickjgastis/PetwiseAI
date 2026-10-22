import React, { useState, useRef, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { motion } from 'framer-motion';
import { FaCheck, FaGraduationCap, FaTimes, FaLock, FaChartPie } from 'react-icons/fa';
import StudentRedeem from './StudentRedeem';
import PlanCards, { CurrencyToggle } from './PlanCards';
import { STUDENT_PROGRAM } from '../constants/features';

// Loaded on first checkout, not on import: a blocked or offline Stripe.js must not crash the page.
let stripePromise = null;
const getStripe = () => {
    if (!stripePromise) stripePromise = loadStripe(
        process.env.NODE_ENV === 'production'
            ? process.env.REACT_APP_STRIPE_PUBLIC_KEY_LIVE
            : process.env.REACT_APP_STRIPE_PUBLIC_KEY
    ).catch((err) => {
        console.error('[Stripe] Failed to load Stripe.js:', err);
        stripePromise = null;
        return null;
    });
    return stripePromise;
};

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const FEATURE_LABELS = {
    soap: 'SOAP notes',
    query: 'PetQuery questions'
};

const REASON_COPY = {
    limit: {
        title: (feature) => `You've finished today's free ${FEATURE_LABELS[feature]}`,
        body: (resetLabel) => (
            <>Your free allowance resets <span className="text-[#3468bd] font-semibold">{resetLabel}</span>, and everything you've created is saved. Upgrade anytime for unlimited use.</>
        ),
        dismiss: 'Maybe later'
    },
    'last-day': {
        title: () => 'Last day of unlimited',
        body: () => (
            <>Your 10 free days end in the next 24 hours. Upgrade to stay unlimited, or continue with PetWise Free: 2 SOAPs and 3 PetQuery questions a day.</>
        ),
        dismiss: 'Keep using unlimited today'
    },
    expired: {
        title: () => 'Your 10 free days are up',
        body: () => (
            <>Choose a plan to stay unlimited, or continue with PetWise Free: 2 SOAPs and 3 PetQuery questions a day. No credit card required to stay on Free.</>
        ),
        dismiss: 'Continue with PetWise Free'
    }
};

// Out-of-usage upgrade screen for free-tier users. Dismissible and friendly —
// they've just finished today's free allowance; it comes back at their local
// midnight (resetsAt), or they can upgrade for unlimited use right now.
// reason: 'limit' (daily cap) | 'last-day' | 'expired'
const UpgradeModal = ({ user, feature = 'soap', resetsAt, reason = 'limit', onClose, onSubscribed }) => {
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
            const stripe = await getStripe();
            if (!stripe) throw new Error('Stripe failed to initialize');

            const response = await fetch(`${API_URL}/create-checkout-session`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user, planType, currency }),
            });

            const session = await response.json();
            if (session?.payUrl) {
                window.location.href = session.payUrl;
                return;
            }
            if (session?.switched) {
                window.dispatchEvent(new CustomEvent('subscriptionUpdated'));
                if (onSubscribed) onSubscribed();
                if (onClose) onClose();
                return;
            }
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

    // "resets in 11 hours" — live distance to the user's local midnight
    const hoursUntilReset = resetsAt
        ? Math.max(1, Math.ceil((new Date(resetsAt) - new Date()) / (1000 * 60 * 60)))
        : null;
    const resetLabel = hoursUntilReset === null
        ? 'tomorrow'
        : hoursUntilReset <= 1
            ? 'in less than an hour'
            : `in ${hoursUntilReset} hours`;
    const copy = REASON_COPY[reason] || REASON_COPY.limit;

    return (
        <motion.div
            ref={scrollContainerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-white bg-[radial-gradient(70%_55%_at_50%_0%,#dbe8fb_0%,rgba(255,255,255,0)_70%)] overflow-y-auto z-[9999]"
            style={{ overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' }}
        >
            <button
                onClick={onClose}
                className="fixed top-4 right-4 flex items-center gap-2 px-4 py-2 text-[#13233f]/70 hover:text-[#13233f] bg-white/80 backdrop-blur border border-[#e7ecf3] shadow-sm rounded-full transition-all text-sm z-20"
            >
                <FaTimes />
                <span className="hidden sm:inline">{copy.dismiss}</span>
            </button>

            {showStudentRedeem && (
                <div className="fixed inset-0 bg-[#13233f]/40 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
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
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-[#3a72cc] to-[#1e4a94] rounded-2xl mb-4 shadow-[0_10px_30px_-12px_rgba(52,104,189,0.6)]">
                        <FaChartPie className="text-white text-xl" />
                    </div>
                    <h1 className="text-2xl sm:text-[2rem] font-semibold text-[#13233f] mb-2 tracking-[-0.03em] leading-tight">
                        {copy.title(feature)}
                    </h1>
                    <p className="text-[#1a2b4a]/65 text-[15px] leading-relaxed">
                        {copy.body(resetLabel)}
                    </p>
                </motion.div>

                {/* Currency toggle */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.08 }}
                    className="mb-5"
                >
                    <CurrencyToggle currency={currency} onChange={setCurrency} />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.16 }}
                    className="w-full max-w-3xl"
                >
                    <PlanCards
                        currency={currency}
                        onCheckout={handleCheckout}
                        isLoading={isLoading}
                        labels={{ monthly: 'Go Monthly', yearly: 'Go Yearly' }}
                    />
                </motion.div>

                {/* Trust + student access — single compact row */}
                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[#1a2b4a]/50 text-[12px]">
                    <span className="flex items-center gap-1.5"><FaLock className="text-[10px]" /> Secure Stripe checkout</span>
                    <span className="text-[#1a2b4a]/25">·</span>
                    <span className="flex items-center gap-1.5"><FaCheck className="text-[#3468bd] text-[10px]" /> Cancel anytime</span>
                    {STUDENT_PROGRAM && (
                        <>
                            <span className="text-[#1a2b4a]/25">·</span>
                            <button
                                onClick={() => setShowStudentRedeem(true)}
                                disabled={isLoading !== null}
                                className="flex items-center gap-1.5 text-[#3468bd] hover:text-[#13233f] underline underline-offset-2 transition-colors disabled:opacity-50"
                            >
                                <FaGraduationCap className="text-[10px]" /> Student? Get free access
                            </button>
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default UpgradeModal;
