import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaArrowUp, FaTimes } from 'react-icons/fa';

// Almost-out-of-quota banner (fires at ~80% of the daily allowance — the last
// SOAP / last few queries). Non-blocking, dismissible for the rest of the day.
// Copy is count-based: "You have 1 free SOAP note remaining today."
const UpgradeNudge = ({ show, feature = 'soap', remaining = 1, onDismiss }) => {
    const navigate = useNavigate();

    const label = feature === 'soap'
        ? (remaining === 1 ? 'free SOAP note' : 'free SOAP notes')
        : (remaining === 1 ? 'free PetQuery question' : 'free PetQuery questions');

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                    className="w-full max-w-2xl mx-auto mb-3 flex items-center gap-3 px-4 py-3 rounded-[20px] border border-[#d6e3f7] bg-[#eef4fc]"
                >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#3468bd] flex items-center justify-center">
                        <FaArrowUp className="text-white text-xs" />
                    </div>
                    <p className="flex-1 text-sm text-[#1a2b4a]/80">
                        You have <span className="font-semibold text-[#13233f]">{remaining} {label}</span> remaining today.
                        Upgrade for unlimited use.
                    </p>
                    <button
                        onClick={() => navigate('/dashboard/profile', { state: { openCheckout: true } })}
                        className="flex-shrink-0 px-4 py-1.5 bg-[#3468bd] text-white text-xs font-medium rounded-full hover:bg-[#2a5298] transition-colors"
                    >
                        Upgrade
                    </button>
                    <button
                        onClick={onDismiss}
                        className="flex-shrink-0 text-[#1a2b4a]/40 hover:text-[#13233f] transition-colors p-1"
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
