import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth0 } from '@auth0/auth0-react';
import {
    FaMicrophone, FaSearch, FaCheck, FaCrown, FaBolt,
    FaArrowRight, FaShieldAlt, FaRegClock, FaChevronLeft, FaChevronRight,
    FaStar, FaQuoteLeft
} from 'react-icons/fa';

const PRICES = {
    usd: { monthly: 79, yearly: 69, yearlyTotal: 828, symbol: '$', code: 'USD' },
    cad: { monthly: 109, yearly: 96, yearlyTotal: 1152, symbol: '$', code: 'CAD' }
};

const FEATURES = [
    'Unlimited SOAP reports',
    'QuickSOAP voice dictation',
    'Unlimited PetQuery AI assistant',
    'Saved reports library',
    'Custom templates',
    'Priority support'
];

const TESTIMONIALS = [
    {
        name: 'Dr. Amanda Wright | DMV',
        quote: [
            "I am finishing up the free trial period, and I am absolutely obsessed with PetWise! It is super user friendly, and provides me with fast and accurate information. I have been reluctant to use AI for records because I like things written a certain way, and it can be hard to trust information generated from outside sources. I am impressed, and I am comfortable distributing the information I get from PetWise to my clients. Please let me know how I can sign up for the year!"
        ]
    },
    {
        name: 'Dr. Tammi Whelan | DMV',
        quote: [
            "I love Petwise because it is versatile and comprehensive (compared to other platforms I have tried). The Quick SOAP produces my recorded exam room record. If I need more details, like an uncommon drug dose, differentials based on clinical signs, caloric requirement for weight loss etc. With few words in the Query tab I have my answer (with references!) without leaving the platform – I just move the data into the record and finish it. It saves me hours! And I don't have lingering questions to follow up on later in the day.",
            "Without Petwise, I could not possibly be as productive or efficient. It saves me hours. The important medical/legal details are covered so I can enjoy time with the clients and patients; the things that make my job as a vet so rewarding."
        ]
    },
    {
        name: 'Dr. Johnson | DMV',
        quote: [
            "Petwise is my go to whenever I need current veterinary information. I use the search query feature the most because it pulls from multiple sources and shows the references clearly, which I really like. It makes it easy to find what I need quickly and feel confident that the information is reliable and up to date."
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

const VetsLanding = () => {
    const { loginWithRedirect } = useAuth0();
    const [email, setEmail] = useState('');
    const [currency, setCurrency] = useState('usd');
    const [active, setActive] = useState(0);

    // Auto-cycle testimonials; the [active] dep restarts the timer after any
    // manual navigation so a fresh full interval follows a tap.
    useEffect(() => {
        const id = setTimeout(
            () => setActive((i) => (i + 1) % TESTIMONIALS.length),
            7000
        );
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

    const price = PRICES[currency];

    return (
        <div className="relative min-h-screen text-white overflow-x-hidden bg-gradient-to-b from-[#3d70c6] via-[#3468bd] to-[#20447f]">
            {/* Warm ambient glows layered over the blue for depth + warmth */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-44 -right-40 w-[44rem] h-[44rem] rounded-full bg-amber-300/25 blur-[140px]" />
                <div className="absolute top-[38%] -left-52 w-[42rem] h-[42rem] rounded-full bg-rose-300/20 blur-[150px]" />
                <div className="absolute bottom-[-10%] right-1/4 w-[38rem] h-[38rem] rounded-full bg-sky-300/20 blur-[150px]" />
                <div className="absolute top-[12%] left-1/3 w-[30rem] h-[30rem] rounded-full bg-white/10 blur-[130px]" />
            </div>

            {/* Minimal top bar */}
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

            {/* Hero */}
            <section className="max-w-6xl mx-auto px-5 sm:px-6 pt-10 pb-16 sm:pt-20 sm:pb-28">
                <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                    {/* Left — brand, tagline, signup */}
                    <motion.div
                        variants={stagger}
                        initial="hidden"
                        animate="show"
                        className="text-center lg:text-left"
                    >
                        <motion.h1
                            variants={fadeUp}
                            className="text-6xl sm:text-8xl lg:text-9xl font-extrabold tracking-tight leading-none mb-4"
                        >
                            Petwise
                        </motion.h1>
                        <motion.p
                            variants={fadeUp}
                            className="text-xl sm:text-2xl text-white/80 font-medium mb-8"
                        >
                            The best way to{' '}
                            <span className="bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent font-bold">
                                SOAP
                            </span>
                            .
                        </motion.p>

                        {/* Email → signup */}
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
                                className="group flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold rounded-xl text-sm hover:from-amber-500 hover:to-orange-600 transition-all whitespace-nowrap shadow-[0_10px_30px_-8px_rgba(251,146,60,0.7)]"
                            >
                                Sign up with email
                                <FaArrowRight className="text-xs transition-transform group-hover:translate-x-0.5" />
                            </button>
                        </motion.form>

                        <motion.div
                            variants={fadeUp}
                            className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 mt-5 text-[12px] text-white/60"
                        >
                            <span className="flex items-center gap-1.5"><FaCheck className="text-amber-300 text-[10px]" /> Free to start</span>
                            <span className="flex items-center gap-1.5"><FaShieldAlt className="text-[10px]" /> No credit card</span>
                            <span className="flex items-center gap-1.5"><FaRegClock className="text-[10px]" /> 60-second setup</span>
                        </motion.div>
                    </motion.div>

                    {/* Right — SOAP note building itself, section by section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="rounded-3xl bg-white p-5 shadow-[0_40px_100px_-30px_rgba(10,25,60,0.75)] ring-1 ring-black/5"
                    >
                        {/* Dictation header */}
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-9 h-9 rounded-full bg-[#3468bd] flex items-center justify-center flex-shrink-0">
                                <FaMicrophone className="text-white text-xs" />
                            </div>
                            <div className="h-8 flex-1 rounded-lg bg-gray-50 border border-gray-200 flex items-center px-3 min-w-0">
                                <span className="text-[11px] text-gray-400 italic truncate">Dictating appointment…</span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex-shrink-0">SOAP</span>
                        </div>

                        {/* Sections drop in one by one */}
                        <motion.div
                            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.4, delayChildren: 0.4 } } }}
                            initial="hidden"
                            animate="show"
                        >
                            {[
                                { label: 'S — Subjective', c: 'from-blue-500 to-blue-600', lines: ['3yo Lab, vomiting x2 days'] },
                                { label: 'O — Objective', c: 'from-emerald-500 to-emerald-600', lines: ['T 39.1 · HR 96 · mild dehydration'] },
                                { label: 'A — Assessment', c: 'from-amber-500 to-amber-600', lines: ['Acute gastroenteritis'] },
                                { label: 'P — Plan', c: 'from-rose-500 to-rose-600', lines: ['Fluids, antiemetic, bland diet'] }
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
                                    <div className="mt-1 rounded-md bg-gray-50 border border-gray-100 px-3 py-1.5">
                                        <span className="text-[11px] text-gray-500">{s.lines[0]}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="max-w-3xl mx-auto px-5 sm:px-6 py-12 sm:py-20">
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

                        {/* Fixed-ish height so the card doesn't jump between quotes */}
                        <div className="min-h-[200px] sm:min-h-[190px] flex flex-col items-center justify-center">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={active}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -12 }}
                                    transition={{ duration: 0.4, ease: 'easeOut' }}
                                >
                                    {TESTIMONIALS[active].quote.map((p, i) => (
                                        <p
                                            key={i}
                                            className="text-white/85 text-[15px] sm:text-base leading-relaxed italic mb-3 last:mb-0"
                                        >
                                            “{p}”
                                        </p>
                                    ))}
                                    <p className="text-amber-200 font-bold text-sm mt-5">
                                        {TESTIMONIALS[active].name}
                                    </p>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Controls — below the quote so nothing overlaps on mobile */}
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

            {/* QuickSOAP */}
            <section className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-24">
                <Reveal>
                    <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
                        <div>
                            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-center mb-5">
                                <FaMicrophone className="text-amber-200 text-lg" />
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">QuickSOAP</h2>
                            <p className="text-white/75 text-lg leading-relaxed mb-6">
                                Just talk. Dictate your appointment naturally and PetWise turns it into a
                                clean, structured SOAP note — Subjective, Objective, Assessment, Plan —
                                saved to your records automatically. No templates, no retyping.
                            </p>
                            <button
                                onClick={startSignup}
                                className="inline-flex items-center gap-2 text-amber-200 font-semibold text-sm hover:gap-3 transition-all"
                            >
                                Try it free <FaArrowRight className="text-xs" />
                            </button>
                        </div>

                        {/* Floating mock SOAP card */}
                        <div className="rounded-3xl bg-white p-5 shadow-[0_40px_100px_-30px_rgba(10,25,60,0.7)] ring-1 ring-black/5">
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="w-9 h-9 rounded-full bg-[#3468bd] flex items-center justify-center flex-shrink-0">
                                    <FaMicrophone className="text-white text-xs" />
                                </div>
                                <div className="h-8 flex-1 rounded-lg bg-gray-50 border border-gray-200 flex items-center px-3 min-w-0">
                                    <span className="text-[11px] text-gray-400 italic truncate">Listening… “3-year-old lab, vomiting since…”</span>
                                </div>
                            </div>
                            {[
                                { label: 'S — Subjective', c: 'from-blue-500 to-blue-600' },
                                { label: 'O — Objective', c: 'from-emerald-500 to-emerald-600' },
                                { label: 'A — Assessment', c: 'from-amber-500 to-amber-600' },
                                { label: 'P — Plan', c: 'from-rose-500 to-rose-600' }
                            ].map((s) => (
                                <div key={s.label} className="mb-2 last:mb-0">
                                    <div className={`h-6 rounded-md bg-gradient-to-r ${s.c} text-white text-[11px] font-semibold flex items-center px-3`}>
                                        {s.label}
                                    </div>
                                    <div className="h-7 mt-1 rounded-md bg-gray-50 border border-gray-100" />
                                </div>
                            ))}
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* PetQuery */}
            <section className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-24">
                <Reveal>
                    <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
                        {/* Floating mock chat card (first on desktop) */}
                        <div className="order-2 lg:order-1 rounded-3xl bg-white p-5 shadow-[0_40px_100px_-30px_rgba(10,25,60,0.7)] ring-1 ring-black/5 space-y-3">
                            <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-[#3468bd] text-white text-[12px] px-3.5 py-2.5">
                                Metronidazole dose for a 12&nbsp;kg dog with acute colitis?
                            </div>
                            <div className="mr-auto max-w-[88%] rounded-2xl rounded-bl-md bg-gray-50 border border-gray-200 text-[12px] text-gray-600 px-3.5 py-2.5 leading-relaxed">
                                10–15&nbsp;mg/kg PO q12h for 5–7 days. For a 12&nbsp;kg patient that's roughly
                                120–180&nbsp;mg per dose. Pair with a bland diet and monitor hydration…
                            </div>
                        </div>

                        <div className="order-1 lg:order-2">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-center mb-5">
                                <FaSearch className="text-amber-200 text-lg" />
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">PetQuery</h2>
                            <p className="text-white/75 text-lg leading-relaxed mb-6">
                                Your go-to for any veterinary question. Ask about drug dosages, differential
                                diagnoses, treatment protocols, lab interpretation — and more. Concise,
                                evidence-based answers built for licensed vets.
                            </p>
                            <button
                                onClick={startSignup}
                                className="inline-flex items-center gap-2 text-amber-200 font-semibold text-sm hover:gap-3 transition-all"
                            >
                                Ask your first question <FaArrowRight className="text-xs" />
                            </button>
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* Pricing */}
            <section className="max-w-4xl mx-auto px-5 sm:px-6 py-12 sm:py-24">
                <Reveal className="text-center mb-10">
                    <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">Simple pricing</h2>
                    <p className="text-white/70 mb-6">Start free. Upgrade for unlimited whenever you're ready.</p>
                    <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 backdrop-blur-sm rounded-full p-1">
                        {['usd', 'cad'].map((c) => (
                            <button
                                key={c}
                                onClick={() => setCurrency(c)}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                    currency === c ? 'bg-white text-[#3468bd] shadow-sm' : 'text-white/70 hover:text-white'
                                }`}
                            >
                                {c.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </Reveal>

                <motion.div
                    variants={stagger}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.2 }}
                    className="grid sm:grid-cols-2 gap-5 items-start"
                >
                    {/* Monthly */}
                    <motion.div variants={fadeUp} className="rounded-3xl bg-white text-gray-900 p-7 flex flex-col shadow-[0_40px_100px_-30px_rgba(10,25,60,0.7)]">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                            <FaBolt className="text-[#3468bd]" />
                        </div>
                        <h3 className="text-lg font-bold">Monthly</h3>
                        <p className="text-[13px] text-gray-500 mb-4">Flexible, cancel anytime</p>
                        <div className="flex items-end gap-2 mb-5">
                            <span className="text-4xl font-extrabold leading-none">{price.symbol}{price.monthly}</span>
                            <span className="text-gray-500 text-xs leading-tight pb-0.5">{price.code} / month<br />billed monthly</span>
                        </div>
                        <button
                            onClick={startSignup}
                            className="w-full py-3 bg-[#3468bd] text-white font-semibold rounded-xl text-sm hover:bg-[#2a5298] transition-all mb-6"
                        >
                            Get started
                        </button>
                        <ul className="space-y-2.5">
                            {FEATURES.map((f) => (
                                <li key={f} className="flex items-center gap-2.5 text-gray-600 text-[13px]">
                                    <FaCheck className="text-[#3468bd] flex-shrink-0 text-[11px]" /> {f}
                                </li>
                            ))}
                        </ul>
                    </motion.div>

                    {/* Yearly */}
                    <motion.div variants={fadeUp} className="rounded-3xl bg-white text-gray-900 p-7 flex flex-col relative shadow-[0_40px_100px_-30px_rgba(10,25,60,0.7)] ring-2 ring-amber-400">
                        <div className="absolute -top-2.5 right-6 bg-gradient-to-r from-amber-400 to-amber-500 text-white px-3 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1">
                            <FaCrown className="text-[9px]" /> BEST VALUE
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center mb-3">
                            <FaCrown className="text-amber-600" />
                        </div>
                        <h3 className="text-lg font-bold">Yearly</h3>
                        <p className="text-[13px] text-gray-500 mb-4">Best value — 2 months free</p>
                        <div className="flex items-end gap-2 mb-5">
                            <span className="text-4xl font-extrabold leading-none">{price.symbol}{price.yearly}</span>
                            <span className="text-gray-500 text-xs leading-tight pb-0.5">{price.code} / month<br />{price.symbol}{price.yearlyTotal} billed yearly</span>
                        </div>
                        <button
                            onClick={startSignup}
                            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl text-sm transition-all mb-6"
                        >
                            Get started
                        </button>
                        <ul className="space-y-2.5">
                            {FEATURES.map((f) => (
                                <li key={f} className="flex items-center gap-2.5 text-gray-600 text-[13px]">
                                    <FaCheck className="text-amber-500 flex-shrink-0 text-[11px]" /> {f}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                </motion.div>
            </section>

            {/* Final CTA */}
            <section className="max-w-6xl mx-auto px-5 sm:px-6 pb-20 sm:pb-24">
                <Reveal>
                    <div className="rounded-3xl bg-white/10 border border-white/15 backdrop-blur-xl p-8 sm:p-14 text-center">
                        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
                            Ready to write your first note?
                        </h2>
                        <p className="text-white/70 mb-8 max-w-md mx-auto">
                            One click and you're in. No demos, no sales calls — just start using it.
                        </p>
                        <button
                            onClick={startSignup}
                            className="group inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-xl text-sm hover:from-amber-500 hover:to-orange-600 transition-all shadow-[0_12px_36px_-10px_rgba(251,146,60,0.8)]"
                        >
                            Sign up with email
                            <FaArrowRight className="text-xs transition-transform group-hover:translate-x-0.5" />
                        </button>
                    </div>
                </Reveal>

                <p className="text-center text-white/45 text-xs mt-8">
                    © {new Date().getFullYear()} Petwise.vet · Built for veterinarians
                </p>
            </section>
        </div>
    );
};

export default VetsLanding;
