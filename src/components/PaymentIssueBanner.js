import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FaCreditCard } from 'react-icons/fa';
import { notifyUsageUpdated } from '../hooks/useUsage';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

// Refetch plan status and usage limits everywhere in the app.
export const refreshBilling = () => {
    window.dispatchEvent(new CustomEvent('subscriptionUpdated'));
    notifyUsageUpdated();
};

const AWAITING_PAYMENT_EVENT = 'petwise:awaiting-payment';

// Opens Stripe's page for the unpaid invoice (falls back to the "update card" form)
// in a new tab. The tab is opened synchronously so popup blockers allow it.
export const openPastDuePayment = async (userId) => {
    const tab = window.open('', '_blank');
    try {
        const response = await fetch(`${API_URL}/create-customer-portal`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, flow: 'pay_past_due' })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to open billing');
        if (tab) tab.location.href = data.url;
        else window.location.href = data.url;
        window.dispatchEvent(new CustomEvent(AWAITING_PAYMENT_EVENT));
    } catch (err) {
        if (tab) tab.close();
        throw err;
    }
};

// Failed renewal (subscription_status = past_due). The account is on PetWise Free
// until the invoice is paid. Shown on every app page; disappears on its own once
// the payment webhook lands.
const PaymentIssueBanner = ({ userData, userId, className = '' }) => {
    const [loading, setLoading] = useState(false);
    const [waiting, setWaiting] = useState(false);
    const [error, setError] = useState('');
    const isPastDue = userData?.subscription_status === 'past_due';

    useEffect(() => {
        const onAwaiting = () => setWaiting(true);
        window.addEventListener(AWAITING_PAYMENT_EVENT, onAwaiting);
        return () => window.removeEventListener(AWAITING_PAYMENT_EVENT, onAwaiting);
    }, []);

    useEffect(() => {
        if (!waiting || !isPastDue) return undefined;
        const poll = setInterval(refreshBilling, 4000);
        const onReturn = () => document.visibilityState === 'visible' && refreshBilling();
        window.addEventListener('focus', onReturn);
        document.addEventListener('visibilitychange', onReturn);
        return () => {
            clearInterval(poll);
            window.removeEventListener('focus', onReturn);
            document.removeEventListener('visibilitychange', onReturn);
        };
    }, [waiting, isPastDue]);

    if (!isPastDue) return null;

    const handleClick = async () => {
        setError('');
        setLoading(true);
        try {
            await openPastDuePayment(userId);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-[20px] border border-[#f6d5d5] bg-[#fff6f6] px-5 py-4 flex flex-wrap items-center gap-4 ${className}`}
        >
            <div className="w-10 h-10 flex-shrink-0 rounded-full bg-[#fde8e8] text-[#d64545] flex items-center justify-center">
                <FaCreditCard className="text-sm" />
            </div>
            <div className="flex-1 min-w-[220px]">
                <p className="text-[15px] font-semibold tracking-tight text-[#13233f]">
                    {waiting ? 'Finish your payment in the new tab' : 'Your payment is past due'}
                </p>
                <p className="text-[13px] text-[#1a2b4a]/65 mt-0.5">
                    {waiting
                        ? 'Unlimited access comes back here automatically as soon as your payment goes through.'
                        : "We couldn't charge your card, so your account is on PetWise Free. Pay your invoice to resume unlimited SOAP notes and PetQuery."}
                </p>
                {error && <p className="text-[12px] text-[#d64545] mt-1">{error}</p>}
            </div>
            {userData?.stripe_customer_id && (
                <button
                    onClick={handleClick}
                    disabled={loading}
                    className="flex-shrink-0 px-5 py-2.5 rounded-full bg-[#d64545] text-white text-sm font-medium hover:bg-[#bf3a3a] transition-colors disabled:opacity-60"
                >
                    {loading ? 'Opening...' : waiting ? 'Open payment page again' : 'Pay now'}
                </button>
            )}
        </motion.div>
    );
};

export default PaymentIssueBanner;
