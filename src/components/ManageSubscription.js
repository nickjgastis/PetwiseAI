import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { motion } from 'framer-motion';
import { FaCheck, FaCrown, FaArrowLeft, FaCreditCard, FaGraduationCap, FaBolt } from 'react-icons/fa';
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

// Inline billing panel — rendered inside the Profile settings layout (desktop)
// or as a full page on mobile (pass onBack to show the back row).
const ManageSubscription = ({ user, subscriptionStatus, subscriptionInterval, onBack, onSubscriptionChange }) => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(null);
    const [currency, setCurrency] = useState('usd');
    const [showStudentRedeem, setShowStudentRedeem] = useState(false);

    const isStudentPlan = user?.plan_label === 'student' &&
        user?.subscription_end_date &&
        new Date(user.subscription_end_date) > new Date();

    const PRICES = {
        usd: { monthly: 79, yearly: 69, yearlyTotal: 828, symbol: '$', code: 'USD' },
        cad: { monthly: 109, yearly: 96, yearlyTotal: 1152, symbol: '$', code: 'CAD' }
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

    const features = [
        'Unlimited SOAP reports',
        'QuickSOAP voice dictation',
        'Unlimited PetQuery AI assistant',
        'Saved reports library',
        'Custom templates',
        'Priority support'
    ];

    const getCurrentPlanLabel = () => {
        if (isStudentPlan) return '🎓 Student Access';
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <StudentRedeem
                        onSuccess={handleStudentRedeemSuccess}
                        onCancel={() => setShowStudentRedeem(false)}
                        userData={user}
                    />
                </div>
            )}

            {onBack && (
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors mb-5 text-sm font-medium"
                >
                    <FaArrowLeft className="text-xs" />
                    <span>Back to Profile</span>
                </button>
            )}

            {/* Current plan summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <p className="text-sm text-gray-500">Current plan</p>
                    <p className="text-lg font-bold text-gray-900">{getCurrentPlanLabel()}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-gray-100 rounded-full p-1">
                    <button
                        onClick={() => setCurrency('usd')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            currency === 'usd' ? 'bg-white text-[#3468bd] shadow-sm' : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        USD
                    </button>
                    <button
                        onClick={() => setCurrency('cad')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            currency === 'cad' ? 'bg-white text-[#3468bd] shadow-sm' : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        CAD
                    </button>
                </div>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6 items-start">
                {/* Monthly */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`rounded-3xl border p-7 bg-white relative flex flex-col ${
                        isCurrentPlan('monthly') ? 'border-[#3468bd] ring-1 ring-[#3468bd]' : 'border-gray-200 hover:border-gray-300 hover:shadow-md transition-all'
                    }`}
                >
                    {isCurrentPlan('monthly') && (
                        <div className="absolute -top-2.5 left-6 bg-[#3468bd] text-white px-3 py-0.5 rounded-full text-[11px] font-bold">
                            CURRENT PLAN
                        </div>
                    )}

                    <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                        <FaBolt className="text-[#3468bd] text-lg" />
                    </div>

                    <h3 className="text-lg font-bold text-gray-900">Monthly</h3>
                    <p className="text-[13px] text-gray-500 mb-5">Flexible, cancel anytime</p>

                    <div className="flex items-end gap-2 mb-6">
                        <span className="text-4xl font-extrabold text-gray-900 leading-none">
                            {PRICES[currency].symbol}{PRICES[currency].monthly}
                        </span>
                        <span className="text-gray-500 text-xs leading-tight pb-0.5">
                            {PRICES[currency].code} / month<br />billed monthly
                        </span>
                    </div>

                    <button
                        onClick={() => handleCheckout('monthly')}
                        disabled={isLoading !== null || isCurrentPlan('monthly')}
                        className={`w-full py-3 px-6 font-semibold rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-6 ${
                            isCurrentPlan('monthly')
                                ? 'bg-blue-50 text-[#3468bd] cursor-default'
                                : 'bg-[#3468bd] text-white hover:bg-[#2a5298]'
                        }`}
                    >
                        {isLoading === 'monthly' ? 'Processing...' : isCurrentPlan('monthly') ? 'Current Plan' : (onFreePlan ? 'Get Monthly plan' : 'Switch to Monthly')}
                    </button>

                    <div className="border-t border-gray-100 pt-5">
                        <p className="text-[13px] font-semibold text-gray-900 mb-3">Everything in Free, plus:</p>
                        <ul className="space-y-2.5">
                            {features.map((feature, idx) => (
                                <li key={idx} className="flex items-center gap-2.5 text-gray-600 text-[13px]">
                                    <FaCheck className="text-[#3468bd] flex-shrink-0 text-[11px]" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>
                </motion.div>

                {/* Yearly */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.06 }}
                    className={`rounded-3xl border p-7 relative flex flex-col ${
                        isCurrentPlan('yearly')
                            ? 'border-[#3468bd] ring-1 ring-[#3468bd] bg-white'
                            : 'border-amber-300 bg-gradient-to-b from-amber-50/60 to-white hover:shadow-md transition-all'
                    }`}
                >
                    {isCurrentPlan('yearly') ? (
                        <div className="absolute -top-2.5 left-6 bg-[#3468bd] text-white px-3 py-0.5 rounded-full text-[11px] font-bold">
                            CURRENT PLAN
                        </div>
                    ) : (
                        <div className="absolute -top-2.5 right-6 bg-gradient-to-r from-amber-400 to-amber-500 text-white px-3 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1">
                            <FaCrown className="text-[9px]" /> BEST VALUE
                        </div>
                    )}

                    <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
                        <FaCrown className="text-amber-600 text-lg" />
                    </div>

                    <h3 className="text-lg font-bold text-gray-900">Yearly</h3>
                    <p className="text-[13px] text-gray-500 mb-5">Best value, save ~12%</p>

                    <div className="flex items-end gap-2 mb-6">
                        <span className="text-4xl font-extrabold text-gray-900 leading-none">
                            {PRICES[currency].symbol}{PRICES[currency].yearly}
                        </span>
                        <span className="text-gray-500 text-xs leading-tight pb-0.5">
                            {PRICES[currency].code} / month<br />
                            {PRICES[currency].symbol}{PRICES[currency].yearlyTotal} billed yearly
                        </span>
                    </div>

                    <button
                        onClick={() => handleCheckout('yearly')}
                        disabled={isLoading !== null || isCurrentPlan('yearly')}
                        className={`w-full py-3 px-6 font-semibold rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-6 ${
                            isCurrentPlan('yearly')
                                ? 'bg-blue-50 text-[#3468bd] cursor-default'
                                : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700'
                        }`}
                    >
                        {isLoading === 'yearly' ? 'Processing...' : isCurrentPlan('yearly') ? 'Current Plan' : (onFreePlan ? 'Get Yearly plan' : 'Switch to Yearly')}
                    </button>

                    <div className="border-t border-amber-200/70 pt-5">
                        <p className="text-[13px] font-semibold text-gray-900 mb-3">Everything in Monthly, plus:</p>
                        <ul className="space-y-2.5">
                            {features.map((feature, idx) => (
                                <li key={idx} className="flex items-center gap-2.5 text-gray-600 text-[13px]">
                                    <FaCheck className="text-amber-500 flex-shrink-0 text-[11px]" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>
                </motion.div>
            </div>

            {/* Secondary actions */}
            <div className="flex flex-wrap gap-3">
                {!isStudentPlan && (
                    <button
                        onClick={() => setShowStudentRedeem(true)}
                        disabled={isLoading !== null}
                        className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 font-semibold rounded-xl text-sm hover:bg-purple-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-purple-100"
                    >
                        <FaGraduationCap />
                        Student Access
                    </button>
                )}

                {isStudentPlan && (
                    <button
                        onClick={handleCancelStudent}
                        disabled={isLoading !== null}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 font-semibold rounded-xl text-sm hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-red-100"
                    >
                        <FaGraduationCap />
                        {isLoading === 'cancelStudent' ? 'Deactivating...' : 'Deactivate Student Access'}
                    </button>
                )}

                {hasStripeCustomer && (
                    <button
                        onClick={handleBillingPortal}
                        disabled={isLoading !== null}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
                    >
                        <FaCreditCard className="text-[#3468bd]" />
                        {isLoading === 'portal' ? 'Loading...' : 'Billing Settings'}
                    </button>
                )}
            </div>

            <p className="text-gray-400 text-xs mt-5">
                Changes take effect immediately. Manage payment methods and view invoices in Billing Settings.
            </p>
        </div>
    );
};

export default ManageSubscription;
