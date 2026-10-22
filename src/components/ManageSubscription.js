import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { loadStripe } from '@stripe/stripe-js';
import { FaArrowLeft, FaCreditCard, FaGraduationCap } from 'react-icons/fa';
import StudentRedeem from './StudentRedeem';
import { useNavigate } from 'react-router-dom';
import PlanCards, { CurrencyToggle } from './PlanCards';
import { openPastDuePayment } from './PaymentIssueBanner';
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

// Inline billing panel — rendered inside the Profile settings layout (desktop)
// or as a full page on mobile (pass onBack to show the back row).
const ManageSubscription = ({ user, subscriptionStatus, subscriptionInterval, onBack, onSubscriptionChange }) => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(null);
    const [currency, setCurrency] = useState('usd');
    const [showStudentRedeem, setShowStudentRedeem] = useState(false);
    const [pendingSwitch, setPendingSwitch] = useState(null);
    const [switchError, setSwitchError] = useState('');

    const isStudentPlan = user?.plan_label === 'student' &&
        user?.subscription_end_date &&
        new Date(user.subscription_end_date) > new Date();

    const requestPlan = (planType) => {
        if (subscriptionStatus === 'past_due') {
            return openPastDuePayment(user.sub).catch((err) => alert(`Unable to open payment page: ${err.message}`));
        }
        const isSwitch = ['monthly', 'yearly'].includes(subscriptionInterval) && subscriptionStatus === 'active';
        if (!isSwitch) return handleCheckout(planType);
        setSwitchError('');
        setPendingSwitch(planType);
    };

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
            if (!response.ok) throw new Error(session?.error || 'Could not change plan');
            if (session.payUrl) {
                window.location.href = session.payUrl;
                return;
            }

            if (session.switched) {
                setPendingSwitch(null);
                if (onSubscriptionChange) onSubscriptionChange();
                window.dispatchEvent(new CustomEvent('subscriptionUpdated'));
                setIsLoading(null);
                return;
            }

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
            if (pendingSwitch) setSwitchError(error.message);
            else alert(`Unable to change plan: ${error.message}`);
            setIsLoading(null);
        }
    };

    const handleBillingPortal = async () => {
        setIsLoading('portal');
        try {
            const response = await fetch(`${API_URL}/create-customer-portal`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.sub }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to access billing portal');
            }

            window.location.href = data.url;
        } catch (error) {
            console.error('Billing portal error:', error);
            alert(`Unable to access billing portal: ${error.message}`);
            setIsLoading(null);
        }
    };

    const handleStudentRedeemSuccess = () => {
        setShowStudentRedeem(false);
        if (onSubscriptionChange) {
            setTimeout(() => { onSubscriptionChange(); }, 300);
        }
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('subscriptionUpdated'));
        }, 300);
        setTimeout(() => { navigate('/dashboard/quicksoap'); }, 500);
    };

    const handleCancelStudent = async () => {
        if (!window.confirm('Are you sure you want to deactivate your student access? This will end your access immediately.')) {
            return;
        }

        setIsLoading('cancelStudent');
        try {
            const response = await fetch(`${API_URL}/cancel-student`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.sub }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to deactivate student access');
            }

            if (onSubscriptionChange) onSubscriptionChange();
            window.dispatchEvent(new CustomEvent('subscriptionUpdated'));

            alert('Student access has been deactivated.');
            window.location.reload();
        } catch (error) {
            console.error('Cancel student error:', error);
            alert(error.message);
        } finally {
            setIsLoading(null);
        }
    };

    const getCurrentPlanLabel = () => {
        if (isStudentPlan) return '🎓 Student Access';
        if (subscriptionStatus === 'past_due') return 'Free Plan (payment past due)';
        if (subscriptionInterval === 'monthly') return 'Monthly Plan';
        if (subscriptionInterval === 'yearly') return 'Yearly Plan';
        return 'Free Plan';
    };

    const isCurrentPlan = (planType) => {
        return subscriptionInterval === planType && subscriptionStatus === 'active';
    };

    const hasStripeCustomer = user?.stripe_customer_id;
    const onFreePlan = !isStudentPlan && !['monthly', 'yearly'].includes(subscriptionInterval);

    return (
        <div>
            {/* Student Redeem Modal */}
            {showStudentRedeem && (
                <div className="fixed inset-0 bg-[#13233f]/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <StudentRedeem
                        onSuccess={handleStudentRedeemSuccess}
                        onCancel={() => setShowStudentRedeem(false)}
                        userData={user}
                    />
                </div>
            )}

            {pendingSwitch && createPortal(
                <div
                    className="fixed inset-0 bg-[#13233f]/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
                    onClick={() => isLoading === null && setPendingSwitch(null)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md rounded-[24px] bg-white p-6 sm:p-7 shadow-[0_24px_60px_-20px_rgba(19,35,63,0.35)]"
                    >
                        <h3 className="text-xl font-semibold tracking-tight text-[#13233f]">
                            Switch to {pendingSwitch === 'yearly' ? 'Yearly' : 'Monthly'}?
                        </h3>
                        <p className="text-sm text-[#1a2b4a]/65 mt-2 leading-relaxed">
                            {pendingSwitch === 'yearly'
                                ? "You'll be charged the full yearly price today, and your plan renews yearly from today. Your current monthly plan ends now with no credit for unused time."
                                : "You'll be charged the full monthly price today, and your plan renews monthly from today. Your current yearly plan ends now with no credit for unused time."}
                        </p>
                        {switchError && (
                            <p className="mt-3 rounded-xl bg-[#fff6f6] border border-[#f6d5d5] px-3 py-2 text-[13px] text-[#d64545]">
                                {switchError}
                            </p>
                        )}
                        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                            <button
                                onClick={() => setPendingSwitch(null)}
                                disabled={isLoading !== null}
                                className="px-5 py-2.5 rounded-full text-sm font-medium text-[#13233f] border border-[#13233f]/15 hover:border-[#13233f]/40 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleCheckout(pendingSwitch)}
                                disabled={isLoading !== null}
                                className="px-5 py-2.5 rounded-full text-sm font-medium text-white bg-[#3468bd] hover:bg-[#2b5aa6] transition-colors disabled:opacity-60"
                            >
                                {isLoading === pendingSwitch ? 'Switching...' : `Switch to ${pendingSwitch === 'yearly' ? 'Yearly' : 'Monthly'}`}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {onBack && (
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-[#13233f]/55 hover:text-[#13233f] transition-colors mb-5 text-sm font-medium"
                >
                    <FaArrowLeft className="text-xs" />
                    <span>Back to Profile</span>
                </button>
            )}

            {/* Current plan summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <p className="text-[13px] text-[#1a2b4a]/55">Current plan</p>
                    <p className="text-lg font-semibold tracking-tight text-[#13233f]">{getCurrentPlanLabel()}</p>
                </div>
                <CurrencyToggle currency={currency} onChange={setCurrency} />
            </div>

            <div className="mb-6">
                <PlanCards
                    currency={currency}
                    onCheckout={requestPlan}
                    isLoading={isLoading}
                    currentPlan={['monthly', 'yearly'].find((plan) => isCurrentPlan(plan)) || null}
                    labels={{
                        monthly: onFreePlan ? 'Get Monthly plan' : 'Switch to Monthly',
                        yearly: onFreePlan ? 'Get Yearly plan' : 'Switch to Yearly'
                    }}
                />
            </div>

            {/* Secondary actions */}
            <div className="flex flex-wrap gap-3">
                {STUDENT_PROGRAM && !isStudentPlan && (
                    <button
                        onClick={() => setShowStudentRedeem(true)}
                        disabled={isLoading !== null}
                        className="flex items-center gap-2 px-5 py-2.5 bg-purple-50 text-purple-700 font-medium rounded-full text-sm hover:bg-purple-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-purple-100"
                    >
                        <FaGraduationCap />
                        Student Access
                    </button>
                )}

                {isStudentPlan && (
                    <button
                        onClick={handleCancelStudent}
                        disabled={isLoading !== null}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-700 font-medium rounded-full text-sm hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-red-100"
                    >
                        <FaGraduationCap />
                        {isLoading === 'cancelStudent' ? 'Deactivating...' : 'Deactivate Student Access'}
                    </button>
                )}

                {hasStripeCustomer && (
                    <button
                        onClick={handleBillingPortal}
                        disabled={isLoading !== null}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-[#13233f] font-medium rounded-full text-sm hover:border-[#13233f]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-[#13233f]/15"
                    >
                        <FaCreditCard className="text-[#3468bd]" />
                        {isLoading === 'portal' ? 'Loading...' : 'Billing Settings'}
                    </button>
                )}
            </div>

            <p className="text-[#1a2b4a]/45 text-xs mt-5">
                Changes take effect immediately. Manage payment methods and view invoices in Billing Settings.
            </p>
        </div>
    );
};

export default ManageSubscription;
