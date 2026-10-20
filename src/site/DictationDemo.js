import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaCheck, FaClipboardList, FaFileAlt, FaMicrophone, FaQuestionCircle, FaSave, FaSearch, FaStop, FaUser } from 'react-icons/fa';

// Fixed design size; the whole stage is scaled to fit its container.
const W = 640;
const H = 430;

const STAGES = { idle: 1400, recording: 3000, sent: 1100, desktop: 6200 };
const NEXT = {
    idle: 'recording',
    recording: 'sent',
    sent: 'desktop',
    desktop: 'idle'
};

const SECTIONS = [
    {
        letter: 'S',
        label: 'Subjective',
        header: 'from-blue-500 to-blue-600',
        text: '7yo FS Labrador, 32 kg. Vomiting x4 overnight, last episode this morning. Still eating small amounts.'
    },
    {
        letter: 'O',
        label: 'Objective',
        header: 'from-emerald-500 to-emerald-600',
        text: 'T 101.8°F · HR 110 · RR 28 · BCS 6/9. Abdomen soft with mild cranial discomfort.'
    },
    {
        letter: 'A',
        label: 'Assessment',
        header: 'from-amber-500 to-amber-600',
        text: 'Acute gastroenteritis. R/O dietary indiscretion, foreign body, pancreatitis.'
    },
    {
        letter: 'P',
        label: 'Plan',
        header: 'from-red-500 to-red-600',
        text: 'Cerenia 1 mg/kg SQ · LRS 250 mL SQ · bland diet · recheck in 24h if not improving.'
    }
];

const NAV = [
    { icon: FaMicrophone, label: 'QuickSOAP', active: true },
    { icon: FaSearch, label: 'PetQUERY' },
    { icon: FaSave, label: 'Saved Records' },
    { icon: FaClipboardList, label: 'My Templates' },
    { icon: FaFileAlt, label: 'PetSOAP' },
    { icon: FaQuestionCircle, label: 'Help' }
];

const BARS = [0.35, 0.7, 0.5, 0.9, 0.6, 1, 0.55, 0.8, 0.4, 0.7, 0.5, 0.3];

const Laptop = ({ stage }) => {
    const landed = stage === 'sent' || stage === 'desktop';
    const report = stage === 'desktop';
    return (
        <div className="absolute left-[34px] top-[22px] w-[540px]">
            <div className="relative rounded-t-[18px] bg-[#15171c] p-[10px] pb-[14px] shadow-[0_40px_80px_-30px_rgba(5,12,30,0.8)] ring-1 ring-white/10">
                <span className="absolute left-1/2 top-[4px] -translate-x-1/2 w-[5px] h-[5px] rounded-full bg-[#2a2e36]" />
                <div className="flex h-[325px] overflow-hidden rounded-[6px] bg-[#f5f7fb]">
                    <aside className="flex w-[118px] shrink-0 flex-col bg-gradient-to-b from-[#3a72cf] to-[#1f4790] px-2 py-3 text-white">
                        <div className="flex items-center gap-1.5 px-1">
                            <img src="/PW.png" alt="" className="h-[18px] w-[18px] rounded-[4px] object-contain" />
                            <span className="text-[11px] font-bold tracking-tight">Petwise.vet</span>
                        </div>
                        <nav className="mt-4 space-y-[3px]">
                            {NAV.map(({ icon: Icon, label, active }) => (
                                <div
                                    key={label}
                                    className={`flex items-center gap-1.5 rounded-[6px] px-1.5 py-[5px] text-[8px] ${active ? 'bg-white/20 font-semibold' : 'text-white/80'}`}
                                >
                                    <span className="flex h-[14px] w-[14px] items-center justify-center rounded-[4px] bg-white/15">
                                        <Icon className="text-[6.5px]" />
                                    </span>
                                    {label}
                                </div>
                            ))}
                        </nav>
                        <div className="mt-auto rounded-[6px] bg-white/10 px-2 py-1.5">
                            <p className="text-[7.5px] font-semibold">Dr. Stacey Gastis</p>
                            <p className="text-[6.5px] text-white/60">Monthly plan</p>
                        </div>
                    </aside>

                    <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center gap-1.5 border-b border-gray-200 bg-white px-2.5 py-2">
                            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-gradient-to-b from-[#4f8ff0] to-[#2d6fd6] text-white shadow-[0_4px_10px_-3px_rgba(45,111,214,0.7)]">
                                <FaMicrophone className="text-[8px]" />
                            </span>
                            <span className="rounded-[5px] bg-[#3468bd] px-2 py-[4px] text-[7.5px] font-semibold text-white">Regenerate</span>
                            <span className="rounded-[5px] bg-emerald-500 px-2 py-[4px] text-[7.5px] font-semibold text-white">Start New</span>
                            <span className="ml-1 flex-1 rounded-[5px] border border-gray-200 px-2 py-[4px] text-[7px] italic text-gray-400">Add extra notes or context...</span>
                        </div>

                        <div className="relative flex-1 overflow-hidden px-3 py-2.5">
                            <AnimatePresence>
                                {landed && (
                                    <motion.div
                                        key="dictation"
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.35 }}
                                        className="mb-2 rounded-[6px] border border-gray-200 bg-white px-2 py-1.5"
                                    >
                                        <p className="text-[6.5px] font-semibold uppercase tracking-wider text-[#3468bd]">Dictation 1 · from phone</p>
                                        <p className="mt-0.5 truncate text-[7.5px] text-gray-600">Bella, 7 year old female spayed Lab, 32 kilos, here for vomiting...</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {report ? (
                                <motion.div
                                    initial="hidden"
                                    animate="show"
                                    variants={{
                                        hidden: {},
                                        show: {
                                            transition: {
                                                staggerChildren: 0.45,
                                                delayChildren: 0.25
                                            }
                                        }
                                    }}
                                >
                                    <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} className="mb-1.5">
                                        <p className="text-[11px] font-bold text-gray-900">Bella - QuickSOAP</p>
                                        <p className="text-[6px] font-semibold uppercase tracking-wider text-gray-400">Generated from your clinical notes</p>
                                    </motion.div>
                                    {SECTIONS.map((s) => (
                                        <motion.div
                                            key={s.letter}
                                            variants={{
                                                hidden: { opacity: 0, y: -10 },
                                                show: {
                                                    opacity: 1,
                                                    y: 0,
                                                    transition: {
                                                        type: 'spring',
                                                        stiffness: 320,
                                                        damping: 24
                                                    }
                                                }
                                            }}
                                            className="mb-1.5 overflow-hidden rounded-[6px] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
                                        >
                                            <div className={`flex items-center gap-1.5 bg-gradient-to-r ${s.header} px-2 py-[3px] text-white`}>
                                                <span className="flex h-[11px] w-[11px] items-center justify-center rounded-[3px] bg-white/25 text-[6.5px] font-bold">
                                                    {s.letter}
                                                </span>
                                                <span className="text-[6.5px] font-bold uppercase tracking-wider">{s.label}</span>
                                            </div>
                                            <p className="px-2 py-[5px] text-[7.5px] leading-snug text-gray-700">{s.text}</p>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            ) : (
                                !landed && (
                                    <div className="flex h-full flex-col items-center justify-center text-center">
                                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8f0fc] text-[#3468bd]">
                                            <FaMicrophone className="text-[12px]" />
                                        </span>
                                        <p className="mt-2 text-[9px] font-semibold text-gray-700">Waiting for your dictation</p>
                                        <p className="mt-0.5 text-[7px] text-gray-400">Records from your phone show up here</p>
                                    </div>
                                )
                            )}
                            {stage === 'sent' && (
                                <div className="mt-3 flex items-center gap-1.5 text-[8px] font-medium text-[#3468bd]">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3468bd]" />
                                    Writing your SOAP...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="relative -ml-[6%] h-[13px] w-[112%] rounded-b-[14px] bg-gradient-to-b from-[#3a3e47] to-[#121418] shadow-[0_18px_30px_-12px_rgba(5,12,30,0.7)]">
                <div className="absolute left-1/2 top-0 h-[4px] w-[90px] -translate-x-1/2 rounded-b-[6px] bg-[#0b0c0f]" />
            </div>
        </div>
    );
};

const Phone = ({ stage, seconds }) => {
    const recording = stage === 'recording';
    const sent = stage === 'sent' || stage === 'desktop';
    return (
        <div className="absolute right-[6px] bottom-[4px] w-[152px] rounded-[30px] bg-[#111317] p-[6px] shadow-[0_40px_70px_-25px_rgba(5,12,30,0.9)] ring-1 ring-white/15">
            <div className="relative flex h-[300px] flex-col overflow-hidden rounded-[24px] bg-white">
                <span className="absolute left-1/2 top-[6px] z-10 h-[13px] w-[46px] -translate-x-1/2 rounded-full bg-[#111317]" />
                <div className="flex items-center gap-1.5 bg-[#3468bd] px-3 pb-2 pt-[26px]">
                    <img src="/PW.png" alt="" className="h-[14px] w-[14px] rounded-[3px] object-contain" />
                    <span className="text-[10px] font-bold text-white">Petwise.vet</span>
                </div>

                <div className="flex flex-1 flex-col items-center px-2.5 pt-5 text-center">
                    <p className="flex items-center gap-1 text-[16px] font-bold text-[#3468bd]">
                        QuickSOAP <FaQuestionCircle className="text-[8px] text-gray-400" />
                    </p>
                    <p className="mt-0.5 text-[6px] leading-tight text-gray-500">For best dictation accuracy say section name then list findings.</p>
                    <div className="mt-2 flex rounded-[6px] bg-gray-100 p-[2px] text-[6.5px]">
                        <span className="rounded-[4px] bg-[#3468bd] px-1.5 py-[3px] font-semibold text-white">SOAP</span>
                        <span className="px-1.5 py-[3px] text-gray-500">Summary</span>
                        <span className="px-1.5 py-[3px] text-gray-500">Callback</span>
                    </div>

                    <div className="relative mt-6 flex h-[64px] w-[64px] items-center justify-center">
                        {sent ? (
                            <motion.span
                                key="sent"
                                initial={{ scale: 0.6 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                                className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_10px_24px_-8px_rgba(16,185,129,0.8)]"
                            >
                                <FaCheck className="text-[18px]" />
                            </motion.span>
                        ) : recording ? (
                            <motion.span key="rec" initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="relative flex h-[56px] w-[56px] items-center justify-center">
                                <span className="absolute inset-0 animate-ping rounded-full bg-red-400/40" />
                                <span className="relative flex h-[56px] w-[56px] items-center justify-center rounded-full bg-gradient-to-b from-red-500 to-red-600 text-white shadow-[0_10px_24px_-8px_rgba(239,68,68,0.8)]">
                                    <FaStop className="text-[15px]" />
                                </span>
                            </motion.span>
                        ) : (
                            <motion.span
                                key="mic"
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-gradient-to-b from-[#4f8ff0] to-[#2d6fd6] text-white shadow-[0_12px_26px_-8px_rgba(45,111,214,0.85)]"
                            >
                                <FaMicrophone className="text-[18px]" />
                            </motion.span>
                        )}
                    </div>

                    <div className="mt-3 h-[34px]">
                        {recording && (
                            <>
                                <div className="flex h-[16px] items-center justify-center gap-[2px]">
                                    {BARS.map((b, i) => (
                                        <motion.span
                                            key={i}
                                            className="w-[2px] rounded-full bg-red-500"
                                            animate={{
                                                height: [`${b * 6}px`, `${b * 16}px`, `${b * 6}px`]
                                            }}
                                            transition={{
                                                duration: 0.6 + (i % 4) * 0.12,
                                                repeat: Infinity,
                                                ease: 'easeInOut'
                                            }}
                                        />
                                    ))}
                                </div>
                                <p className="mt-1 text-[7.5px] font-semibold tabular-nums text-red-500">Recording 0:{String(seconds).padStart(2, '0')}</p>
                            </>
                        )}
                        {stage === 'idle' && <p className="pt-2 text-[7.5px] text-gray-400">Tap to dictate</p>}
                        {sent && <p className="pt-2 text-[7.5px] font-semibold text-emerald-600">Sent to desktop</p>}
                    </div>
                </div>

                <div className="flex border-t border-gray-100 py-1.5">
                    <div className="flex flex-1 flex-col items-center text-[#3468bd]">
                        <FaMicrophone className="text-[9px]" />
                        <span className="mt-0.5 text-[6px] font-medium">QuickSOAP</span>
                    </div>
                    <div className="flex flex-1 flex-col items-center text-gray-400">
                        <FaUser className="text-[9px]" />
                        <span className="mt-0.5 text-[6px]">Profile</span>
                    </div>
                </div>
                <span className="mx-auto mb-1.5 h-[3px] w-[44px] rounded-full bg-gray-900" />
            </div>
        </div>
    );
};

// Phone dictation landing on the desktop app as a SOAP note, drawn to match the real PetWise UI.
const DictationDemo = () => {
    const wrapRef = useRef(null);
    const [scale, setScale] = useState(1);
    const [stage, setStage] = useState('idle');
    const [seconds, setSeconds] = useState(0);

    useLayoutEffect(() => {
        const el = wrapRef.current;
        if (!el) return undefined;
        const fit = () => setScale(Math.min(1, el.clientWidth / W));
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const id = setTimeout(() => setStage((s) => NEXT[s]), STAGES[stage]);
        return () => clearTimeout(id);
    }, [stage]);

    useEffect(() => {
        if (stage !== 'recording') return undefined;
        setSeconds(0);
        const id = setInterval(() => setSeconds((s) => s + 1), 220);
        return () => clearInterval(id);
    }, [stage]);

    return (
        <div ref={wrapRef} className="relative w-full" style={{ height: H * scale }}>
            <div
                className="absolute left-1/2 top-0 origin-top"
                style={{
                    width: W,
                    height: H,
                    transform: `translateX(-50%) scale(${scale})`
                }}
            >
                <Laptop stage={stage} />
                <Phone stage={stage} seconds={seconds} />
            </div>
        </div>
    );
};

export default DictationDemo;
