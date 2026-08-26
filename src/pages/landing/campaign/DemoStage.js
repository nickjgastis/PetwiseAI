import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaMicrophone, FaStop } from 'react-icons/fa';

const DEMO_SECTIONS = [
    { label: 'S  Subjective', color: 'bg-[#3468bd]', text: '3yo MN Lab, vomiting x2 days, still drinking. Got into trash.' },
    { label: 'O  Objective', color: 'bg-[#2a5298]', text: 'T 39.1 · HR 96 · ~5% dehydrated · abdomen soft, mild discomfort' },
    { label: 'A  Assessment', color: 'bg-[#3db6fd]', text: 'Acute gastroenteritis; R/O foreign body, pancreatitis' },
    { label: 'P  Plan', color: 'bg-[#20447f]', text: 'SQ fluids · maropitant 1 mg/kg · bland diet · recheck 48h' }
];

const DemoStage = () => {
    const [stage, setStage] = useState('dictate');

    useEffect(() => {
        const durations = { dictate: 1500, recording: 2000, laptop: 5200 };
        const next = { dictate: 'recording', recording: 'laptop', laptop: 'dictate' };
        const id = setTimeout(() => setStage((s) => next[s]), durations[stage]);
        return () => clearTimeout(id);
    }, [stage]);

    const showPhone = stage === 'dictate' || stage === 'recording';
    const recording = stage === 'recording';

    return (
        <div className="relative mx-auto w-full max-w-[420px] h-[300px] sm:h-[400px] md:h-[440px] [zoom:0.82] sm:[zoom:1]">
            <AnimatePresence mode="wait">
                {showPhone ? (
                    <motion.div
                        key="phone"
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.94 }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <div className="relative w-[220px] max-w-full rounded-[2.4rem] bg-[#e8e4dc] p-2 shadow-[0_30px_80px_-28px_rgba(32,68,127,0.35)] ring-1 ring-black/5">
                            <div className="absolute left-1/2 -translate-x-1/2 top-2 w-16 h-3.5 rounded-b-2xl bg-[#e8e4dc] z-10" />
                            <div className="rounded-[2rem] bg-white overflow-hidden h-[360px] flex flex-col">
                                <div className="bg-[#3468bd] px-4 pt-7 pb-3 flex items-center gap-2">
                                    <img src="/PW.png" alt="" className="w-5 h-5 object-contain" />
                                    <span className="text-white text-sm font-bold">Petwise<span className="font-light text-white/60">.vet</span></span>
                                </div>
                                <div className="flex-1 flex flex-col items-center justify-center gap-5">
                                    {recording ? (
                                        <div className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg animate-pulse">
                                            <FaStop className="text-base" />
                                        </div>
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-[#3468bd] text-white flex items-center justify-center shadow-xl">
                                            <FaMicrophone className="text-xl" />
                                        </div>
                                    )}
                                    <span className={`text-sm font-medium ${recording ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {recording ? 'Listening...' : 'Tap to dictate'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="laptop"
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <div className="w-full [zoom:0.78] sm:[zoom:1]">
                            <div className="relative z-0 rounded-t-xl bg-[#d9d4cb] px-2 pt-2 pb-0 shadow-[0_30px_80px_-28px_rgba(32,68,127,0.35)] ring-1 ring-black/5">
                                <div className="rounded-t-lg bg-white overflow-hidden">
                                    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100">
                                        <span className="w-2 h-2 rounded-full bg-gray-200" />
                                        <span className="w-2 h-2 rounded-full bg-gray-200" />
                                        <span className="w-2 h-2 rounded-full bg-gray-200" />
                                        <span className="ml-2 text-[10px] text-gray-400">app.petwise.vet</span>
                                        <span className="ml-auto text-[9px] font-bold text-[#3468bd] bg-[#f0f7ff] px-1.5 py-0.5 rounded">SOAP</span>
                                    </div>
                                    <div className="p-4">
                                        <motion.div
                                            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.55, delayChildren: 0.3 } } }}
                                            initial="hidden"
                                            animate="show"
                                        >
                                            {DEMO_SECTIONS.map((s) => (
                                                <motion.div
                                                    key={s.label}
                                                    variants={{
                                                        hidden: { opacity: 0, y: -12 },
                                                        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 22 } }
                                                    }}
                                                    className="mb-2.5 last:mb-0"
                                                >
                                                    <div className={`h-6 rounded-md ${s.color} text-white text-[11px] font-semibold flex items-center px-3`}>
                                                        {s.label}
                                                    </div>
                                                    <div className="mt-1 rounded-md bg-[#f7f4ee] border border-black/5 px-3 py-1.5">
                                                        <span className="text-[11px] text-gray-500 leading-snug">{s.text}</span>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </motion.div>
                                    </div>
                                </div>
                            </div>
                            <div className="relative z-10 -mt-1 mx-auto w-[118%] -ml-[9%] h-4 bg-gradient-to-b from-[#cfc9be] to-[#b9b3a8] rounded-b-xl shadow-[0_10px_20px_-8px_rgba(32,68,127,0.25)]">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1.5 bg-[#a8a297] rounded-b-lg" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DemoStage;
