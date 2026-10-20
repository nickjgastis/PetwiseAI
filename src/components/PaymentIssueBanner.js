import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaCreditCard } from 'react-icons/fa';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const DAY_MS = 24 * 60 * 60 * 1000;

export const graceDaysLeft = (userData) => {
    if (userData?.subscription_status !== 'past_due' || !userData?.grace_period_end) return null;
    return Math.max(0, Math.ceil((new Date(userData.grace_period_end) - new Date()) / DAY_MS));
};

// Opens the Stripe portal straight on the "update payment method" form.
export const openCardUpdate = async (userId) => {
    const response = await fetch(`${API_URL}/create-customer-portal`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, flow: 'payment_method_update' })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to open billing');
    window.location.href = data.url;
};

// Failed renewal (subscription_status = past_due). Shown on every app page.
const PaymentIssueBanner = ({ userData, userId, className = '' }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (userData?.subscription_status !== 'past_due') return null;

    const days = graceDaysLeft(userData);
    const expired = days === 0;

    const handleClick = async () => {
        setError('');
        setLoading(true);
        try {
            await openCardUpdate(userId);
        } catch (err) {
            setError(err.message);
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
                    {expired ? "You're on PetWise Free until your card is updated" : "Your last payment didn't go through"}
                </p>
                <p className="text-[13px] text-[#1a2b4a]/65 mt-0.5">
                    {expired
                        ? 'We could not charge your card. Update it to bring back unlimited SOAP notes and PetQuery.'
                        : days !== null
                            ? `Update your card within ${days} ${days === 1 ? 'day' : 'days'} to keep unlimited access.`
                            : 'Update your card to keep unlimited access.'}
                </p>
                {error && <p className="text-[12px] text-[#d64545] mt-1">{error}</p>}
            </div>
            {userData?.stripe_customer_id && (
                <button
                    onClick={handleClick}
                    disabled={loading}
                    className="flex-shrink-0 px-5 py-2.5 rounded-full bg-[#d64545] text-white text-sm font-medium hover:bg-[#bf3a3a] transition-colors disabled:opacity-60"
                >
                    {loading ? 'Opening...' : 'Update card'}
                </button>
            )}
        </motion.div>
    );
};

export default PaymentIssueBanner;
