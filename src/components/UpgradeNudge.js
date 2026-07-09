import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaArrowUp, FaTimes } from 'react-icons/fa';

const FEATURE_LABELS = {
    soap: 'SOAP notes',
    query: 'PetQuery questions'
};

// 90%-usage nudge banner. Non-blocking, dismissible for the session.
// show/pct/feature come from the page's usage state; parent owns visibility.
const UpgradeNudge = ({ show, feature = 'soap', pct = 90, onDismiss }) => {
    const navigate = useNavigate();

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                    className="w-full max-w-2xl mx-auto mb-3 flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 shadow-sm"
                >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center">
                        <FaArrowUp className="text-white text-xs" />
                    </div>
                    <p className="flex-1 text-sm text-amber-900">
                        You've used <span className="font-bold">{pct}%</span> of your free {FEATURE_LABELS[feature]} this month.
                        Upgrade for unlimited access.
                    </p>
                    <button
                        onClick={() => navigate('/dashboard/profile', { state: { openCheckout: true } })}
                        className="flex-shrink-0 px-3 py-1.5 bg-[#3468bd] text-white text-xs font-semibold rounded-lg hover:bg-[#2a5298] transition-colors"
                    >
                        Upgrade
                    </button>
                    <button
                        onClick={onDismiss}
                        className="flex-shrink-0 text-amber-500 hover:text-amber-700 transition-colors p-1"
                        aria-label="Dismiss"
                    >
                        <FaTimes className="text-xs" />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default UpgradeNudge;
