import React, { useEffect, useState } from 'react';
import { FaTimes, FaGraduationCap } from 'react-icons/fa';

const BOOKING_URL = 'https://calendar.app.google/msd3h7YsD4qK3Rvo7';

// Banner shown once per user. If clicked OR dismissed, never shows again.
// localStorage key is scoped per auth0 user so different users on same device get fresh state.
const storageKey = (userSub) => `bookingBanner_${userSub}_action`;

const BookingBanner = ({ user }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!user?.sub) return;
        const prior = localStorage.getItem(storageKey(user.sub));
        if (prior) return; // 'clicked' or 'dismissed' — never show again
        // Small delay so it doesn't blast on first load
        const t = setTimeout(() => setVisible(true), 1800);
        return () => clearTimeout(t);
    }, [user?.sub]);

    const markActioned = (action) => {
        if (user?.sub) localStorage.setItem(storageKey(user.sub), action);
        setVisible(false);
    };

    const handleBook = () => {
        markActioned('clicked');
        window.open(BOOKING_URL, '_blank', 'noopener,noreferrer');
    };

    const handleDismiss = (e) => {
        e.stopPropagation();
        markActioned('dismissed');
    };

    if (!visible) return null;

    return (
        <>
            <style>{`
                @keyframes bookingSlideIn {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
            <div
                onClick={handleBook}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleBook()}
                className="fixed z-[9998] bottom-4 right-4 sm:bottom-6 sm:right-6 max-w-[340px] cursor-pointer group"
                style={{ animation: 'bookingSlideIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            >
                <div className="relative bg-gradient-to-br from-[#1e3a6e] via-[#2a5298] to-[#3468bd] rounded-2xl p-4 sm:p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-white/15 backdrop-blur-md transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)]">
                    <button
                        onClick={handleDismiss}
                        aria-label="Dismiss"
                        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <FaTimes className="text-xs" />
                    </button>

                    <div className="flex items-start gap-3 pr-6">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                            <FaGraduationCap className="text-white text-base" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-white font-bold text-sm sm:text-base leading-tight mb-0.5">
                                Free 1-on-1 demo
                            </h3>
                            <p className="text-white/70 text-[11px] sm:text-xs leading-snug">
                                Walk through PetWise with Dr. Gastis
                                <span className="hidden sm:inline"> — includes 1 hour of RACE-approved CE.</span>
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={(e) => { e.stopPropagation(); handleBook(); }}
                        className="w-full mt-3 py-2 bg-[#3db6fd] hover:bg-[#5ec4ff] text-white font-semibold rounded-lg text-xs sm:text-sm transition-colors"
                    >
                        Book a Demo →
                    </button>
                </div>
            </div>
        </>
    );
};

export default BookingBanner;
