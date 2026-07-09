import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth0 } from '@auth0/auth0-react';
import {
    FaMicrophone, FaStop, FaSearch, FaCheck, FaArrowRight, FaShieldAlt,
    FaChevronLeft, FaChevronRight, FaStar, FaQuoteLeft,
    FaFileAlt, FaClipboardList, FaListUl, FaNotesMedical, FaUserMd,
    FaCheckCircle, FaTimesCircle, FaRegClock, FaMapMarkedAlt
} from 'react-icons/fa';

// Cold Meta traffic gets ~2–5s. Sell the outcome (time / going home earlier),
// not the feature (SOAP). One decision on the page: enter email, start free.

const BENEFITS = [
    { Icon: FaFileAlt, label: 'AI SOAP Notes' },
    { Icon: FaSearch, label: 'Veterinary AI Search' },
    { Icon: FaClipboardList, label: 'Client Handouts' },
    { Icon: FaListUl, label: 'Differential Lists' },
    { Icon: FaNotesMedical, label: 'Treatment Plans' }
];

const BEFORE = [
    'Finish records after your shift',
    'Search Google for drug dosages',
    'Write discharge notes by hand',
    '1–2 hours documenting every night'
];

const AFTER = [
    'SOAP notes done in minutes',
    'Clinical answers in seconds',
    'Client handouts generated instantly',
    'Go home when your shift ends'
];

const TESTIMONIALS = [
    {
        name: 'Dr. Amanda Wright | DVM',
        quote: [
            "I am absolutely obsessed with PetWise! It is super user friendly, and provides me with fast and accurate information. I've been reluctant to use AI for records because I like things written a certain way and it can be hard to trust outside sources. I'm impressed, and comfortable distributing the information I get from PetWise to my clients."
        ]
    },
    {
        name: 'Dr. Tammi Whelan | DVM',
        quote: [
            "The Quick SOAP produces my recorded exam room record. If I need an uncommon drug dose, differentials, or caloric requirements, a few words in the Query tab gives me my answer — with references — without leaving the platform. It saves me hours, and I don't have lingering questions to follow up on later in the day.",
            "Without Petwise I could not possibly be as productive or efficient. The important medical/legal details are covered so I can enjoy time with the clients and patients."
        ]
    },
    {
        name: 'Dr. Johnson | DVM',
        quote: [
            "Petwise is my go-to whenever I need current veterinary information. The search query feature pulls from multiple sources and shows the references clearly. It makes it easy to find what I need quickly and feel confident the information is reliable and up to date."
        ]
    }
];

const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } }
};

const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } }
};

const Reveal = ({ children, className = '' }) => (
    <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.25 }}
        className={className}
    >
        {children}
    </motion.div>
);

// ---- Looping product demo ----
// Phone shows a mic that switches to recording, then the phone cross-fades out
// and a laptop fades in with a full SOAP generating (same style as the hero).
// Swap the inner render for a <video autoPlay muted loop playsInline
// src="/vets-demo.mp4" /> once a real screen capture exists.
const DEMO_SECTIONS = [
    { label: 'S — Subjective', color: 'from-blue-500 to-blue-600', text: '3yo MN Lab, vomiting x2 days, still drinking. Got into trash.' },
    { label: 'O — Objective', color: 'from-emerald-500 to-emerald-600', text: 'T 39.1 · HR 96 · ~5% dehydrated · abdomen soft, mild discomfort' },
    { label: 'A — Assessment', color: 'from-amber-500 to-amber-600', text: 'Acute gastroenteritis; R/O foreign body, pancreatitis' },
    { label: 'P — Plan', color: 'from-rose-500 to-rose-600', text: 'SQ fluids · maropitant 1 mg/kg · bland diet · recheck 48h' }
];

const DemoStage = () => {
    // stage cycles: dictate → recording → laptop → (loop)
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
        <div className="relative mx-auto w-full max-w-[440px] h-[440px] sm:h-[460px]">
            <AnimatePresence mode="wait">
                {showPhone ? (
                    <motion.div
                        key="phone"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        {/* Phone frame — big centered mic */}
                        <div className="relative w-[240px] max-w-full rounded-[2.5rem] bg-[#0f1f3d] p-2.5 shadow-[0_50px_120px_-30px_rgba(8,20,55,0.9)] ring-1 ring-white/10">
                            <div className="absolute left-1/2 -translate-x-1/2 top-2.5 w-20 h-4 rounded-b-2xl bg-[#0f1f3d] z-10" />
                            <div className="rounded-[2rem] bg-white overflow-hidden h-[420px] flex flex-col">
                                <div className="bg-[#3468bd] px-4 pt-7 pb-3 flex items-center gap-2">
                                    <img src="/PW.png" alt="" className="w-6 h-6 object-contain" />
                                    <span className="text-white text-sm font-bold">Petwise<span className="font-light text-white/60">.vet</span></span>
                                </div>
                                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                                    {/* Matches the QuickSOAP control: blue gradient mic idle,
                                        red pulsing stop while recording */}
                                    {recording ? (
                                        <div className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg animate-pulse">
                                            <FaStop className="text-base" />
                                        </div>
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center shadow-xl">
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
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="w-full [zoom:0.72] sm:[zoom:1]">
                        {/* Laptop — screen + base, SOAP generating like the hero */}
                        <div className="relative z-0 rounded-t-xl bg-[#0f1f3d] px-2 pt-2 pb-0 shadow-[0_50px_120px_-30px_rgba(8,20,55,0.9)] ring-1 ring-white/10">
                            <div className="rounded-t-lg bg-white overflow-hidden">
                                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100">
                                    <span className="w-2 h-2 rounded-full bg-gray-200" />
                                    <span className="w-2 h-2 rounded-full bg-gray-200" />
                                    <span className="w-2 h-2 rounded-full bg-gray-200" />
                                    <span className="ml-2 text-[10px] text-gray-400">app.petwise.vet</span>
                                    <span className="ml-auto text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">SOAP</span>
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
                                                <div className={`h-6 rounded-md bg-gradient-to-r ${s.color} text-white text-[11px] font-semibold flex items-center px-3`}>
                                                    {s.label}
                                                </div>
                                                <div className="mt-1 rounded-md bg-gray-50 border border-gray-100 px-3 py-1.5">
                                                    <span className="text-[11px] text-gray-500 leading-snug">{s.text}</span>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                </div>
                            </div>
                        </div>
                        {/* hinge / base deck — wider than the lid, sits in front of the screen */}
                        <div className="relative z-10 -mt-1 mx-auto w-[118%] -ml-[9%] h-4 bg-gradient-to-b from-[#22345f] to-[#0e1c39] rounded-b-xl shadow-[0_14px_24px_-8px_rgba(8,20,55,0.6)]">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1.5 bg-[#0a1631] rounded-b-lg" />
                        </div>
                      </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const VetsLanding = () => {
    const { loginWithRedirect } = useAuth0();
    const [email, setEmail] = useState('');
    const [active, setActive] = useState(0);

    useEffect(() => {
        const id = setTimeout(() => setActive((i) => (i + 1) % TESTIMONIALS.length), 7000);
        return () => clearTimeout(id);
    }, [active]);

    const goTestimonial = (dir) =>
        setActive((i) => (i + dir + TESTIMONIALS.length) % TESTIMONIALS.length);

    const startSignup = (e) => {
        if (e?.preventDefault) e.preventDefault();
        loginWithRedirect({
            authorizationParams: {
                screen_hint: 'signup',
                login_hint: email || undefined
            },
            appState: { returnTo: '/dashboard' }
        });
    };

    const logIn = () => loginWithRedirect({ appState: { returnTo: '/dashboard' } });

    return (
        <div className="relative min-h-screen text-white overflow-x-hidden bg-gradient-to-b from-[#3d70c6] via-[#3468bd] to-[#20447f]">
            {/* Warm ambient glows layered over the blue for depth + warmth */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-44 -right-40 w-[44rem] h-[44rem] rounded-full bg-amber-300/25 blur-[140px]" />
                <div className="absolute top-[38%] -left-52 w-[42rem] h-[42rem] rounded-full bg-rose-300/20 blur-[150px]" />
                <div className="absolute bottom-[-10%] right-1/4 w-[38rem] h-[38rem] rounded-full bg-sky-300/20 blur-[150px]" />
                <div className="absolute top-[12%] left-1/3 w-[30rem] h-[30rem] rounded-full bg-white/10 blur-[130px]" />
            </div>

            {/* Minimal top bar — logo + log in only, zero navigation */}
            <header className="sticky top-0 z-40 backdrop-blur-md bg-[#3468bd]/40 border-b border-white/10">
                <div className="max-w-6xl mx-auto px-5 sm:px-6 h-20 sm:h-24 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        <img src="/PW.png" alt="PetWise" className="w-11 h-11 sm:w-14 sm:h-14 object-contain" />
                        <span className="font-extrabold tracking-tight text-xl sm:text-2xl">
                            Petwise<span className="font-light text-white/60">.vet</span>
                        </span>
                    </div>
                    <button
                        onClick={logIn}
                        className="text-sm font-semibold text-white/70 hover:text-white transition-colors"
                    >
                        Log in
                    </button>
                </div>
            </header>

            {/* Hero — sell the outcome: time back / leave on time */}
            <section className="max-w-6xl mx-auto px-5 sm:px-6 pt-10 pb-12 sm:pt-16 sm:pb-16">
                <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                    {/* Left — headline, one-liner, single email field */}
                    <motion.div
                        variants={stagger}
                        initial="hidden"
                        animate="show"
                        className="text-center lg:text-left"
                    >
                        <motion.span
                            variants={fadeUp}
                            className="inline-block text-amber-200 font-bold tracking-[0.25em] text-xs sm:text-sm mb-4"
                        >
                            PETWISE
                        </motion.span>
                        <motion.h1
                            variants={fadeUp}
                            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5"
                        >
                            Finish your records{' '}
                            <span className="bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent">
                                before you leave the clinic.
                            </span>
                        </motion.h1>
                        <motion.p
                            variants={fadeUp}
                            className="text-lg sm:text-xl text-white/80 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0"
                        >
                            Create SOAP notes, ask clinical questions, and generate client
                            handouts in a fraction of the time — and get your evenings back.
                        </motion.p>

                        {/* Single email → Start Free. Ask for name/clinic AFTER signup. */}
                        <motion.form
                            variants={fadeUp}
                            onSubmit={startSignup}
                            className="flex flex-col sm:flex-row items-stretch gap-2.5 max-w-md mx-auto lg:mx-0"
                        >
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@yourclinic.com"
                                className="flex-1 px-4 py-3.5 rounded-xl bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300/70 transition-all shadow-lg"
                            />
                            <button
                                type="submit"
                                className="group flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-xl text-sm hover:from-amber-500 hover:to-orange-600 transition-all whitespace-nowrap shadow-[0_10px_30px_-8px_rgba(251,146,60,0.7)]"
                            >
                                Go
                                <FaArrowRight className="text-xs transition-transform group-hover:translate-x-0.5" />
                            </button>
                        </motion.form>

                        <motion.div
                            variants={fadeUp}
                            className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 mt-5 text-[13px] text-white/70"
                        >
                            <span className="flex items-center gap-1.5"><FaShieldAlt className="text-[11px]" /> No credit card</span>
                            <span className="flex items-center gap-1.5"><FaCheck className="text-amber-300 text-[11px]" /> Free forever with daily usage</span>
                        </motion.div>
                    </motion.div>

                    {/* Right — SOAP note building itself, section by section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="rounded-3xl bg-white p-5 shadow-[0_40px_100px_-30px_rgba(10,25,60,0.75)] ring-1 ring-black/5"
                    >
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-9 h-9 rounded-full bg-[#3468bd] flex items-center justify-center flex-shrink-0">
                                <FaMicrophone className="text-white text-xs" />
                            </div>
                            <div className="h-8 flex-1 rounded-lg bg-gray-50 border border-gray-200 flex items-center px-3 min-w-0">
                                <span className="text-[11px] text-gray-400 italic truncate">Dictating appointment…</span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex-shrink-0">SOAP</span>
                        </div>

                        <motion.div
                            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.4, delayChildren: 0.4 } } }}
                            initial="hidden"
                            animate="show"
                        >
                            {[
                                {
                                    label: 'S — Subjective', c: 'from-blue-500 to-blue-600',
                                    lines: [
                                        '3yo MN Labrador presented for vomiting x2 days.',
                                        'Owner reports 4–5 episodes daily, still drinking, no diarrhea. Got into trash 3 days ago.'
                                    ]
                                },
                                {
                                    label: 'O — Objective', c: 'from-emerald-500 to-emerald-600',
                                    lines: [
                                        'T 39.1°C · HR 96 · RR 24 · BW 31.2 kg',
                                        'BAR, ~5% dehydrated, tacky mm. Abdomen soft, mild cranial discomfort on palpation.'
                                    ]
                                },
                                {
                                    label: 'A — Assessment', c: 'from-amber-500 to-amber-600',
                                    lines: [
                                        'Acute gastroenteritis, likely dietary indiscretion.',
                                        'R/O foreign body, pancreatitis, toxin exposure.'
                                    ]
                                },
                                {
                                    label: 'P — Plan', c: 'from-rose-500 to-rose-600',
                                    lines: [
                                        'SQ fluids 120 mL/kg/day · maropitant 1 mg/kg SQ.',
                                        'Bland diet 3–5 days, recheck 48h or sooner if worsening. Discharge notes sent to owner.'
                                    ]
                                }
                            ].map((s) => (
                                <motion.div
                                    key={s.label}
                                    variants={{
                                        hidden: { opacity: 0, y: -14 },
                                        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 22 } }
                                    }}
                                    className="mb-2.5 last:mb-0"
                                >
                                    <div className={`h-6 rounded-md bg-gradient-to-r ${s.c} text-white text-[11px] font-semibold flex items-center px-3`}>
                                        {s.label}
                                    </div>
                                    <div className="mt-1 rounded-md bg-gray-50 border border-gray-100 px-3 py-2 space-y-1">
                                        {s.lines.map((line, i) => (
                                            <p key={i} className="text-[11px] text-gray-500 leading-snug">{line}</p>
                                        ))}
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Benefit icons — scannable, no paragraphs */}
            <section className="max-w-5xl mx-auto px-5 sm:px-6 pb-6 sm:pb-10">
                <motion.div
                    variants={stagger}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.3 }}
                    className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3"
                >
                    {BENEFITS.map(({ Icon, label }) => (
                        <motion.div
                            key={label}
                            variants={fadeUp}
                            className="flex items-center gap-2 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm px-4 py-2.5"
                        >
                            <Icon className="text-amber-200 text-sm" />
                            <span className="text-[13px] sm:text-sm font-semibold text-white/90 whitespace-nowrap">{label}</span>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* Demo — seeing it convert. Open phone, dictate, SOAP appears, done. */}
            <section className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-20">
                <Reveal>
                    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                        <div className="text-center lg:text-left order-2 lg:order-1">
                            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
                                Open your phone. Talk. Done.
                            </h2>
                            <p className="text-white/75 text-lg leading-relaxed mb-6 max-w-lg mx-auto lg:mx-0">
                                Dictate the appointment in plain language. PetWise writes a clean,
                                structured SOAP note and saves it to your records — in seconds, from
                                anywhere in the clinic.
                            </p>
                            <button
                                onClick={startSignup}
                                className="group inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-xl text-sm hover:from-amber-500 hover:to-orange-600 transition-all shadow-[0_10px_30px_-8px_rgba(251,146,60,0.7)]"
                            >
                                Start Free
                                <FaArrowRight className="text-xs transition-transform group-hover:translate-x-0.5" />
                            </button>
                        </div>
                        <div className="order-1 lg:order-2">
                            <DemoStage />
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* Before vs After — sell the transformation, not features */}
            <section className="max-w-5xl mx-auto px-5 sm:px-6 py-12 sm:py-20">
                <Reveal className="text-center mb-10">
                    <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                        Why veterinarians are switching
                    </h2>
                </Reveal>
                <div className="grid sm:grid-cols-2 gap-5">
                    <Reveal>
                        <div className="h-full rounded-3xl bg-white/[0.06] border border-white/10 p-7">
                            <p className="text-white/50 font-semibold text-sm mb-5">Before PetWise</p>
                            <ul className="space-y-3.5">
                                {BEFORE.map((b) => (
                                    <li key={b} className="flex items-start gap-3 text-white/70 text-[15px]">
                                        <FaTimesCircle className="text-rose-300/70 text-base mt-0.5 flex-shrink-0" />
                                        {b}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Reveal>
                    <Reveal>
                        <div className="h-full rounded-3xl bg-white text-gray-900 p-7 shadow-[0_40px_100px_-30px_rgba(10,25,60,0.7)]">
                            <p className="text-[#3468bd] font-bold text-sm mb-5 flex items-center gap-2">
                                <img src="/PW.png" alt="" className="w-5 h-5 object-contain" /> With PetWise
                            </p>
                            <ul className="space-y-3.5">
                                {AFTER.map((a) => (
                                    <li key={a} className="flex items-start gap-3 text-gray-700 text-[15px] font-medium">
                                        <FaCheckCircle className="text-emerald-500 text-base mt-0.5 flex-shrink-0" />
                                        {a}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* Authority + social proof */}
            <section className="max-w-3xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
                <Reveal>
                    <div className="rounded-3xl bg-white/10 border border-white/15 backdrop-blur-xl p-7 sm:p-9 text-center sm:text-left sm:flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto sm:mx-0 mb-4 sm:mb-0 flex-shrink-0">
                            <FaUserMd className="text-white text-2xl" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">Created by Dr. Stacey Gastis, DVM</p>
                            <p className="text-white/70 text-sm mt-1">
                                30+ years in clinical practice. Built by a veterinarian, for veterinarians —
                                and used by vets across North America.
                            </p>
                            <div className="flex items-center justify-center sm:justify-start gap-4 mt-3 text-white/60 text-[13px]">
                                <span className="flex items-center gap-1.5"><FaMapMarkedAlt className="text-amber-200 text-xs" /> Across North America</span>
                                <span className="flex items-center gap-1.5"><FaRegClock className="text-amber-200 text-xs" /> Ready in under a minute</span>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* Testimonials */}
            <section className="max-w-3xl mx-auto px-5 sm:px-6 pb-12 sm:pb-20">
                <Reveal className="text-center">
                    <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-8 sm:mb-10">
                        What veterinarians say
                    </h2>

                    <div className="rounded-3xl bg-white/10 border border-white/15 backdrop-blur-xl p-6 sm:p-10">
                        <FaQuoteLeft className="text-amber-300/70 text-2xl mx-auto mb-4" />

                        <div className="flex items-center justify-center gap-1 mb-5">
                            {[...Array(5)].map((_, i) => (
                                <FaStar key={i} className="text-amber-300 text-xs" />
                            ))}
                        </div>

                        {/* All quotes share one grid cell → the box is always as tall as
                            the longest testimonial, so cycling never shifts the page. */}
                        <div className="grid">
                            {TESTIMONIALS.map((t, idx) => (
                                <motion.div
                                    key={idx}
                                    style={{ gridArea: '1 / 1' }}
                                    animate={{ opacity: idx === active ? 1 : 0, y: idx === active ? 0 : 10 }}
                                    transition={{ duration: 0.45, ease: 'easeOut' }}
                                    className={`flex flex-col items-center justify-center ${idx === active ? '' : 'pointer-events-none'}`}
                                >
                                    {t.quote.map((p, i) => (
                                        <p
                                            key={i}
                                            className="text-white/85 text-[15px] sm:text-base leading-relaxed italic mb-3 last:mb-0"
                                        >
                                            “{p}”
                                        </p>
                                    ))}
                                    <p className="text-amber-200 font-bold text-sm mt-5">
                                        {t.name}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-4 mt-6">
                        <button
                            onClick={() => goTestimonial(-1)}
                            aria-label="Previous testimonial"
                            className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/80 hover:bg-white/20 hover:text-white transition-all"
                        >
                            <FaChevronLeft className="text-xs" />
                        </button>

                        <div className="flex items-center gap-2">
                            {TESTIMONIALS.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActive(i)}
                                    aria-label={`Go to testimonial ${i + 1}`}
                                    className="h-2 rounded-full transition-all"
                                    style={{
                                        width: i === active ? 20 : 8,
                                        background: i === active ? '#fcd34d' : 'rgba(255,255,255,0.3)'
                                    }}
                                />
                            ))}
                        </div>

                        <button
                            onClick={() => goTestimonial(1)}
                            aria-label="Next testimonial"
                            className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/80 hover:bg-white/20 hover:text-white transition-all"
                        >
                            <FaChevronRight className="text-xs" />
                        </button>
                    </div>
                </Reveal>
            </section>

            {/* Final CTA */}
            <section className="max-w-6xl mx-auto px-5 sm:px-6 pb-16 sm:pb-24">
                <Reveal>
                    <div className="rounded-3xl bg-white/10 border border-white/15 backdrop-blur-xl p-8 sm:p-14 text-center">
                        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
                            Get your evenings back.
                        </h2>
                        <p className="text-white/75 mb-8 max-w-md mx-auto">
                            Start using PetWise right now — free, no credit card, ready in under a minute.
                        </p>
                        <form
                            onSubmit={startSignup}
                            className="flex flex-col sm:flex-row items-stretch gap-2.5 max-w-md mx-auto"
                        >
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@yourclinic.com"
                                className="flex-1 px-4 py-3.5 rounded-xl bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300/70 transition-all shadow-lg"
                            />
                            <button
                                type="submit"
                                className="group flex items-center justify-center gap-2 px-7 py-3.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-xl text-sm hover:from-amber-500 hover:to-orange-600 transition-all whitespace-nowrap shadow-[0_12px_36px_-10px_rgba(251,146,60,0.8)]"
                            >
                                Start Free
                                <FaArrowRight className="text-xs transition-transform group-hover:translate-x-0.5" />
                            </button>
                        </form>
                        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-5 text-[13px] text-white/60">
                            <span className="flex items-center gap-1.5"><FaCheck className="text-amber-300 text-[11px]" /> Free forever with daily usage</span>
                            <span className="flex items-center gap-1.5"><FaShieldAlt className="text-[11px]" /> No credit card</span>
                            <span className="flex items-center gap-1.5"><FaCheck className="text-amber-300 text-[11px]" /> No installation</span>
                        </div>
                    </div>
                </Reveal>

                <div className="text-center text-white/45 text-xs mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
                    <span>© {new Date().getFullYear()} Petwise.vet</span>
                    <a href="/privacy" className="hover:text-white/70 transition-colors">Privacy</a>
                    <a href="/terms" className="hover:text-white/70 transition-colors">Terms</a>
                </div>
            </section>
        </div>
    );
};

export default VetsLanding;
