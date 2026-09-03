import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { FaBookMedical, FaCheck, FaClipboardList, FaCommentMedical, FaCrown, FaDesktop } from 'react-icons/fa';
import YoutubeEmbed from './YoutubeEmbed';
import PetQueryDemo from './campaign/PetQueryDemo';
import QuickSOAPDemo from './campaign/QuickSOAPDemo';

const PLAN_FEATURES = [
    'Unlimited SOAP reports',
    'QuickSOAP voice dictation',
    'Unlimited PetQuery AI assistant',
    'Saved reports library',
    'Custom templates',
    'Priority support'
];

const Cta = ({ children, onClick, className = '' }) => (
    <button
        type="button"
        onClick={onClick}
        className={`w-full rounded-full bg-[#5cccf0] text-white font-medium py-3.5 shadow-[0_8px_24px_-6px_rgba(92,204,240,0.7)] ${className}`}
    >
        {children}
    </button>
);

const useDemoSignup = () => {
    const { loginWithRedirect } = useAuth0();
    return (placement) => {
        window.gtag?.('event', 'landing_cta', { page_variant: 'demo', placement });
        window.fbq?.('track', 'Lead');
        loginWithRedirect({
            authorizationParams: { screen_hint: 'signup' },
            appState: { returnTo: '/dashboard' }
        });
    };
};

const DemoShell = ({ title, sub, children, onSignup, afterCta, showAfter }) => {
    const navigate = useNavigate();

    useEffect(() => {
        document.title = `${title} | Petwise.vet`;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [title]);

    return (
        <div className="h-[100dvh] bg-[#f5f7fb] text-[#1a2b4a] overflow-hidden">
            <div className="mx-auto h-full w-full max-w-[430px] flex flex-col">
                <div className="px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-1 shrink-0 flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">{title}</h1>
                        {sub && <p className="text-sm text-[#1a2b4a]/60 mt-1">{sub}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/vets/demo')}
                        className="shrink-0 mt-1 rounded-full bg-[#3468bd] text-white text-xs font-semibold px-3 py-1.5"
                    >
                        ← Back
                    </button>
                </div>
                <div className="flex-1 min-h-0 flex flex-col">
                    {children}
                </div>
                {showAfter && (
                    <button
                        type="button"
                        onClick={onSignup}
                        className="px-4 py-2 text-sm font-semibold text-[#3468bd] text-center shrink-0"
                    >
                        {afterCta}
                    </button>
                )}
                <div className="shrink-0 px-4 py-3 bg-white border-t border-gray-100 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <Cta onClick={onSignup}>Start my free 10 days</Cta>
                </div>
            </div>
        </div>
    );
};

export const VetsSoapDemo = () => {
    const start = useDemoSignup();
    const [done, setDone] = useState(false);
    return (
        <DemoShell
            title="QuickSOAP"
            onSignup={() => start(done ? 'after-soap' : 'soap-footer')}
            showAfter={false}
        >
            <QuickSOAPDemo hideHeader onSignup={() => start('soap-lock')} onGenerated={() => setDone(true)} />
        </DemoShell>
    );
};

export const VetsPetQueryDemo = () => {
    const start = useDemoSignup();
    const [done, setDone] = useState(false);
    return (
        <DemoShell
            title="PetQuery"
            sub="Ask a real clinical question."
            onSignup={() => start(done ? 'after-query' : 'query-footer')}
            showAfter={false}
        >
            <PetQueryDemo fill hideHeader onSignup={() => start('query-lock')} onFirstAnswer={() => setDone(true)} />
        </DemoShell>
    );
};

const FEATURES = [
    { icon: FaClipboardList, title: 'SOAP Records', body: 'Turn your conversation or notes into an organized medical record.' },
    { icon: FaCommentMedical, title: 'Clinical Assistant', body: 'Ask questions while you’re working through the case.' },
    { icon: FaBookMedical, title: 'Trusted Sources', body: 'Get answers supported by veterinary references and citations.' },
    { icon: FaDesktop, title: 'Use It Everywhere', body: 'Start on your phone. Continue on your desktop.' }
];

const VetsDemoWalkthrough = () => {
    const navigate = useNavigate();
    const start = useDemoSignup();

    const openDemo = (tool, path) => {
        window.gtag?.('event', 'demo_open', { page_variant: 'demo', tool });
        navigate(path);
    };

    const [showSticky, setShowSticky] = useState(false);
    const sentinelRef = useRef(null);

    useEffect(() => {
        document.title = 'Try PetWise | Petwise.vet';
    }, []);

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return undefined;
        const io = new IntersectionObserver(
            ([entry]) => setShowSticky(!entry.isIntersecting),
            { threshold: 0, rootMargin: '0px 0px 0px 0px' }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    return (
        <div className="min-h-screen bg-[#f5f7fb] text-[#1a2b4a] pb-28">
            <div className="mx-auto w-full max-w-[430px]">
                <section className="px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-12">
                    <div className="flex items-center gap-2 mb-8">
                        <img src="/PW.png" alt="PetWise" className="w-10 h-10 object-contain" />
                        <span className="text-lg font-extrabold tracking-tight">
                            Petwise<span className="font-light text-[#1a2b4a]/40">.vet</span>
                        </span>
                    </div>
                    <h1 className="text-[2.15rem] leading-[1.12] font-extrabold tracking-tight mb-8 text-center">
                        <span className="block">Write your SOAP.</span>
                        <span className="block">Ask clinical questions.</span>
                        <span className="block">Get trusted answers.</span>
                    </h1>
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={() => openDemo('soap', '/vets/demo/soap')}
                            className="w-full rounded-full bg-[#5cccf0] text-white text-lg font-medium py-2.5 tracking-tight inline-flex items-center justify-center gap-2"
                        >
                            <FaClipboardList className="text-base" />
                            Try a sample SOAP
                        </button>
                        <button
                            type="button"
                            onClick={() => openDemo('petquery', '/vets/demo/petquery')}
                            className="w-full rounded-full bg-[#5cccf0] text-white text-lg font-medium py-2.5 tracking-tight inline-flex items-center justify-center gap-2"
                        >
                            <FaCommentMedical className="text-base" />
                            Try the clinical assistant
                        </button>
                    </div>
                    <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-[#1a2b4a]">
                        <FaCheck className="text-emerald-500 text-xs" />
                        No signup needed
                    </p>
                    <div ref={sentinelRef} className="h-px" aria-hidden />
                </section>

                <section className="px-5 pb-12">
                    <h2 className="text-2xl font-extrabold tracking-tight mb-5">
                        <span className="block">One tool.</span>
                        <span className="block">Your entire clinical workflow.</span>
                    </h2>
                    <div className="space-y-3">
                        {FEATURES.map((f) => (
                            <div key={f.title} className="rounded-2xl bg-white border border-gray-100 p-4">
                                <div className="flex items-start gap-3">
                                    <span className="w-10 h-10 rounded-xl bg-[#eef4fc] text-[#3468bd] flex items-center justify-center shrink-0 mt-0.5">
                                        <f.icon />
                                    </span>
                                    <div>
                                        <h3 className="font-extrabold mb-1">{f.title}</h3>
                                        <p className="text-sm text-[#1a2b4a]/65 leading-relaxed">{f.body}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="px-5 pb-8">
                    <img
                        src="/Deskandphone.png"
                        alt="PetWise QuickSOAP on desktop and phone"
                        className="w-full h-auto"
                    />
                </section>

                <section className="px-5 pb-10">
                    <h2 className="text-2xl font-extrabold tracking-tight mb-5">
                        Plans
                    </h2>
                    <div className="space-y-4">
                        <div className="rounded-3xl border border-gray-200 bg-white p-5 flex flex-col">
                            <h3 className="text-base font-bold text-gray-900">Free version</h3>
                            <p className="text-[13px] text-gray-500 mb-4">With daily limits. No credit card</p>
                            <div className="flex items-end gap-2 mb-4">
                                <span className="text-3xl font-extrabold text-gray-900 leading-none">$0</span>
                                <span className="text-gray-500 text-[11px] leading-tight pb-0.5">
                                    forever
                                </span>
                            </div>
                            <div className="border-t border-gray-100 pt-4">
                                <ul className="space-y-2">
                                    {['5 SOAP reports per day', '5 PetQuery messages per day', 'Templates'].map((f) => (
                                        <li key={f} className="flex items-center gap-2.5 text-gray-600 text-[13px]">
                                            <FaCheck className="text-gray-400 flex-shrink-0 text-[11px]" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-gray-200 bg-white p-5 flex flex-col">
                            <h3 className="text-base font-bold text-gray-900">Monthly</h3>
                            <p className="text-[13px] text-gray-500 mb-4">Flexible, cancel anytime</p>
                            <div className="flex items-end gap-2 mb-4">
                                <span className="text-3xl font-extrabold text-gray-900 leading-none">$79</span>
                                <span className="text-gray-500 text-[11px] leading-tight pb-0.5">
                                    USD / month<br />billed monthly
                                </span>
                            </div>
                            <div className="border-t border-gray-100 pt-4">
                                <p className="text-[13px] font-semibold text-gray-900 mb-2.5">Everything in Free, plus:</p>
                                <ul className="space-y-2">
                                    {PLAN_FEATURES.map((f) => (
                                        <li key={f} className="flex items-center gap-2.5 text-gray-600 text-[13px]">
                                            <FaCheck className="text-[#3468bd] flex-shrink-0 text-[11px]" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-amber-300 bg-gradient-to-b from-amber-50/70 to-white p-5 flex flex-col relative">
                            <div className="absolute -top-2.5 right-5 bg-gradient-to-r from-amber-400 to-amber-500 text-white px-3 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1">
                                <FaCrown className="text-[9px]" /> BEST VALUE
                            </div>
                            <h3 className="text-base font-bold text-gray-900">Yearly</h3>
                            <p className="text-[13px] text-gray-500 mb-4">Best value, save ~12%</p>
                            <div className="flex items-end gap-2 mb-4">
                                <span className="text-3xl font-extrabold text-gray-900 leading-none">$69</span>
                                <span className="text-gray-500 text-[11px] leading-tight pb-0.5">
                                    USD / month<br />$828 billed yearly
                                </span>
                            </div>
                            <div className="border-t border-amber-200/70 pt-4">
                                <p className="text-[13px] font-semibold text-gray-900 mb-2.5">Everything in Monthly, plus:</p>
                                <ul className="space-y-2">
                                    {PLAN_FEATURES.map((f) => (
                                        <li key={f} className="flex items-center gap-2.5 text-gray-600 text-[13px]">
                                            <FaCheck className="text-amber-500 flex-shrink-0 text-[11px]" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-5 pb-12">
                    <YoutubeEmbed />
                </section>

                <section className="px-5 pb-12">
                    <Cta onClick={() => start('footer')}>Start free trial - no credit card</Cta>
                </section>

                <footer className="px-5 py-8 text-sm text-[#1a2b4a]/40 flex justify-between">
                    <span>© {new Date().getFullYear()} Petwise.vet</span>
                    <div className="flex gap-4">
                        <a href="/privacy" className="hover:text-[#3468bd]">Privacy</a>
                        <a href="/terms" className="hover:text-[#3468bd]">Terms</a>
                    </div>
                </footer>
            </div>

            <AnimatePresence>
                {showSticky && (
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed bottom-0 left-0 right-0 z-50"
                    >
                        <div className="bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
                            <div className="mx-auto max-w-[430px] px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                                <Cta onClick={() => start('sticky')}>START FREE TRIAL - NO CREDIT CARD</Cta>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default VetsDemoWalkthrough;
