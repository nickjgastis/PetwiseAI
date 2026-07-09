import React, { useState, useMemo, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth0 } from '@auth0/auth0-react';
import { FaMicrophone, FaSearch, FaPaw, FaMobileAlt } from 'react-icons/fa';
import { supabase } from '../../supabaseClient';

// First-run tutorial shown once, right after a new signup lands in the app.
// Tracked by users.has_seen_app_tour (backfilled TRUE for existing users in
// migration 008, so only genuinely new users ever see this).
//
// "anchor" steps spotlight a real sidebar item (matched via [data-tour="…"])
// and float the card beside it; "center" steps render a normal centered modal.
const STEPS = [
    {
        id: 'welcome',
        placement: 'center',
        icon: FaPaw,
        iconBg: 'from-emerald-400 to-emerald-600',
        title: (dvmName) => `Welcome to PetWise${dvmName ? `, Dr. ${dvmName}` : ''}!`,
        body: () => "Let's take a quick tour so you can get started. It'll only take a few seconds."
    },
    {
        id: 'quicksoap',
        placement: 'anchor',
        target: 'quicksoap',
        icon: FaMicrophone,
        iconBg: 'from-blue-400 to-blue-600',
        title: () => 'QuickSOAP',
        body: () => "This is where you'll create all your dictations and SOAP records — just talk or type and PetWise does the rest."
    },
    {
        id: 'petquery',
        placement: 'anchor',
        target: 'petquery',
        icon: FaSearch,
        iconBg: 'from-purple-400 to-purple-600',
        title: () => 'PetQuery',
        body: () => 'Your go-to for any veterinary question. Ask about drug dosages, differential diagnoses, treatment protocols, lab result interpretation — and more.'
    },
    {
        id: 'mobile',
        placement: 'center',
        desktopOnly: true,
        icon: FaMobileAlt,
        iconBg: 'from-[#3468bd] to-[#2a5298]',
        title: () => 'Get PetWise on your phone',
        body: () => 'Scan this code, log in, and follow the instructions to make dictations from anywhere on your phone — they sync straight back here to your desktop.'
    }
];

const CARD_WIDTH = 360;

const AppTour = ({ dvmName, isMobile = false, onComplete }) => {
    const { user } = useAuth0();
    const [stepIndex, setStepIndex] = useState(0);
    const [closing, setClosing] = useState(false);
    const [rect, setRect] = useState(null);

    // Drop desktop-only steps (the mobile QR) when the user is already on a phone.
    const steps = useMemo(
        () => STEPS.filter((s) => !(s.desktopOnly && isMobile)),
        [isMobile]
    );

    const step = steps[stepIndex];
    const Icon = step.icon;
    const isLast = stepIndex === steps.length - 1;

    // Measure the anchored sidebar target (and keep it fresh on resize). Falls
    // back to a centered card when the target isn't visible (e.g. mobile).
    useLayoutEffect(() => {
        if (step.placement !== 'anchor' || !step.target) {
            setRect(null);
            return;
        }
        const measure = () => {
            const el = document.querySelector(`[data-tour="${step.target}"]`);
            const r = el?.getBoundingClientRect();
            setRect(r && r.width > 0 ? r : null);
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [step]);

    const finish = async () => {
        setClosing(true);
        try {
            await supabase
                .from('users')
                .update({ has_seen_app_tour: true })
                .eq('auth0_user_id', user?.sub);
        } catch (err) {
            console.error('Failed to persist app tour completion:', err);
        }
        if (onComplete) onComplete();
    };

    const next = () => (isLast ? finish() : setStepIndex(stepIndex + 1));

    const isAnchored = step.placement === 'anchor' && rect;
    const pad = 8;

    // Card position for anchored steps: to the right of the sidebar item,
    // vertically centered on it but clamped inside the viewport.
    let cardTop = 0;
    let arrowTop = 0;
    if (isAnchored) {
        const estHeight = 300;
        const centerY = rect.top + rect.height / 2;
        cardTop = Math.min(
            Math.max(centerY - estHeight / 2, 16),
            window.innerHeight - estHeight - 16
        );
        arrowTop = centerY - cardTop;
    }

    const cardInner = (
        <>
            <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${step.iconBg} mb-4 shadow-lg`}>
                <Icon className="text-white text-xl" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-3 tracking-tight">
                {step.title(dvmName)}
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-6">
                {step.body()}
            </p>

            {step.id === 'mobile' && (
                <div className="flex justify-center mb-6">
                    <img
                        src="/PW QR CODE.png"
                        alt="Scan to open PetWise on your phone"
                        className="w-40 h-40 rounded-2xl border border-gray-200 shadow-sm"
                    />
                </div>
            )}

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2 mb-6">
                {steps.map((s, i) => (
                    <motion.div
                        key={s.id}
                        animate={{
                            width: i === stepIndex ? 20 : 8,
                            backgroundColor: i === stepIndex ? '#3468bd' : '#d1d5db'
                        }}
                        transition={{ duration: 0.25 }}
                        className="h-2 rounded-full"
                    />
                ))}
            </div>

            <div className="flex items-center justify-between gap-3">
                <button
                    onClick={finish}
                    className="text-gray-400 hover:text-gray-600 text-sm transition-colors px-2 py-2"
                >
                    Skip
                </button>
                <button
                    onClick={next}
                    className="px-6 py-2.5 bg-[#3468bd] text-white font-semibold rounded-xl hover:bg-[#2a5298] transition-colors text-sm"
                >
                    {isLast ? "Got it — let's go" : 'Next'}
                </button>
            </div>
        </>
    );

    return (
        <AnimatePresence>
            {!closing && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9998]"
                >
                    {isAnchored ? (
                        <>
                            {/* Spotlight: the huge box-shadow dims everything except
                                a rounded hole around the highlighted sidebar item. */}
                            <div
                                className="fixed rounded-xl pointer-events-none"
                                style={{
                                    top: rect.top - pad,
                                    left: rect.left - pad,
                                    width: rect.width + pad * 2,
                                    height: rect.height + pad * 2,
                                    boxShadow: '0 0 0 9999px rgba(15,23,42,0.62)',
                                    border: '2px solid rgba(255,255,255,0.9)'
                                }}
                            />
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                                className="fixed bg-white rounded-2xl shadow-2xl p-6 text-center"
                                style={{ top: cardTop, left: rect.right + 20, width: CARD_WIDTH }}
                            >
                                {/* Arrow pointing left toward the item */}
                                <div
                                    className="absolute right-full border-[9px] border-transparent border-r-white"
                                    style={{ top: arrowTop - 9 }}
                                />
                                {cardInner}
                            </motion.div>
                        </>
                    ) : (
                        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -16, scale: 0.98 }}
                                transition={{ duration: 0.35, ease: 'easeOut' }}
                                className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8 text-center"
                            >
                                {cardInner}
                            </motion.div>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AppTour;
