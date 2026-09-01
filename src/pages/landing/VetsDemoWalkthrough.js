import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth0 } from '@auth0/auth0-react';
import YoutubeEmbed from './YoutubeEmbed';
import PetQueryDemo from './campaign/PetQueryDemo';
import QuickSOAPDemo from './campaign/QuickSOAPDemo';

const STEPS = ['welcome', 'soap', 'petquery', 'pricing', 'vsl'];

const slide = {
    enter: (dir) => ({ x: dir > 0 ? '18%' : '-18%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? '-18%' : '18%', opacity: 0 })
};

const PLANS = [
    {
        name: 'Free',
        price: '$0',
        period: '/month',
        items: ['Daily SOAP notes with limits', 'Daily PetQuery questions with limits', 'No credit card']
    },
    {
        name: 'Monthly',
        price: '$79',
        period: ' USD/vet/month',
        items: ['Unlimited SOAP reports', 'Unlimited PetQuery', 'Saved reports']
    },
    {
        name: 'Yearly',
        price: '$69',
        period: ' USD/vet/month',
        save: 'Save 31%',
        items: ['Unlimited SOAP reports', 'Unlimited PetQuery', 'Saved reports']
    }
];

const Cta = ({ children, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="w-full rounded-full bg-[#5cccf0] text-white font-medium py-3.5 shadow-[0_8px_24px_-6px_rgba(92,204,240,0.7)]"
    >
        {children}
    </button>
);

const VetsDemoWalkthrough = () => {
    const { loginWithRedirect } = useAuth0();
    const [step, setStep] = useState(0);
    const [dir, setDir] = useState(1);
    const [soapDone, setSoapDone] = useState(false);
    const [queryDone, setQueryDone] = useState(false);

    const start = (placement) => {
        window.gtag?.('event', 'landing_cta', { page_variant: 'demo', placement });
        window.fbq?.('track', 'Lead');
        loginWithRedirect({
            authorizationParams: { screen_hint: 'signup' },
            appState: { returnTo: '/dashboard' }
        });
    };

    useEffect(() => {
        document.title = 'Try PetWise | Petwise.vet';
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    const go = (next) => {
        const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
        setDir(clamped >= step ? 1 : -1);
        setStep(clamped);
    };

    const nextLabel = () => {
        if (step === 1) return soapDone ? 'Next: PetQuery' : 'Skip to PetQuery';
        if (step === 2) return queryDone ? 'See pricing' : 'Skip to pricing';
        if (step === 3) return 'Watch the story';
        return 'Start my free 10 days';
    };

    return (
        <div className="h-[100dvh] bg-[#1a2b4a] text-[#1a2b4a] overflow-hidden">
            <div className="mx-auto h-full w-full max-w-[430px] bg-[#f5f7fb] flex flex-col">
                {step > 0 && (
                    <div className="shrink-0 px-4 pt-[max(0.85rem,env(safe-area-inset-top))] pb-1 flex items-center justify-center gap-1.5">
                        {STEPS.slice(1).map((id, i) => (
                            <span
                                key={id}
                                className={`h-1.5 rounded-full transition-all ${i + 1 === step ? 'w-6 bg-[#5cccf0]' : 'w-1.5 bg-[#1a2b4a]/15'}`}
                            />
                        ))}
                    </div>
                )}

                <div className="flex-1 min-h-0 relative overflow-hidden">
                    <AnimatePresence custom={dir} mode="wait">
                        <motion.div
                            key={STEPS[step]}
                            custom={dir}
                            variants={slide}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute inset-0 flex flex-col"
                        >
                            {step === 0 && (
                                <div className="flex-1 overflow-y-auto px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-6 flex flex-col">
                                    <p className="text-sm font-bold tracking-[0.18em] uppercase text-[#3468bd] mb-3">
                                        Try it on your phone
                                    </p>
                                    <h1 className="text-[2.1rem] leading-[1.1] font-extrabold tracking-tight mb-4">
                                        Welcome to PetWise.
                                    </h1>
                                    <p className="text-lg text-[#1a2b4a]/70 leading-relaxed mb-3">
                                        Dictate a SOAP the way you would in the app. Then ask PetQuery a real case question.
                                    </p>
                                    <p className="text-[15px] text-[#1a2b4a]/80 font-medium mb-10">
                                        No account for the preview. Sign up after and you get 10 days unlimited. No credit card.
                                    </p>
                                    <div className="mt-auto space-y-3">
                                        <Cta onClick={() => go(1)}>Start</Cta>
                                        <button
                                            type="button"
                                            onClick={() => start('welcome')}
                                            className="w-full py-3 text-sm font-medium text-[#3468bd]"
                                        >
                                            I’d rather just start my 10 days.
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 1 && (
                                <div className="flex-1 min-h-0 flex flex-col">
                                    <div className="px-5 pt-2 pb-1 shrink-0">
                                        <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">QuickSOAP</h1>
                                        <p className="text-sm text-[#1a2b4a]/60 mt-1">Dictate a case. Generate the note.</p>
                                    </div>
                                    <QuickSOAPDemo
                                        hideHeader
                                        onSignup={() => start('soap-lock')}
                                        onGenerated={() => setSoapDone(true)}
                                    />
                                    {soapDone && (
                                        <button
                                            type="button"
                                            onClick={() => start('after-soap')}
                                            className="px-4 py-2 text-sm font-semibold text-[#3468bd] text-center shrink-0"
                                        >
                                            Want this on every case? Start my 10 days.
                                        </button>
                                    )}
                                </div>
                            )}

                            {step === 2 && (
                                <div className="flex-1 min-h-0 flex flex-col">
                                    <div className="px-5 pt-2 pb-2 shrink-0">
                                        <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">PetQuery</h1>
                                        <p className="text-sm text-[#1a2b4a]/60 mt-1">Ask a real clinical question.</p>
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        <PetQueryDemo
                                            fill
                                            hideHeader
                                            onSignup={() => start('query-lock')}
                                            onFirstAnswer={() => setQueryDone(true)}
                                        />
                                    </div>
                                    {queryDone && (
                                        <button
                                            type="button"
                                            onClick={() => start('after-query')}
                                            className="px-4 py-2 text-sm font-semibold text-[#3468bd] text-center shrink-0"
                                        >
                                            Like that answer? Keep going for 10 days.
                                        </button>
                                    )}
                                </div>
                            )}

                            {step === 3 && (
                                <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4">
                                    <h2 className="text-2xl font-extrabold tracking-tight mb-2">
                                        10 days unlimited. Then you decide.
                                    </h2>
                                    <p className="text-sm text-[#1a2b4a]/65 mb-4">
                                        No credit card. After the trial you stay on Free with daily limits, or go Monthly or Yearly.
                                    </p>
                                    <div className="rounded-2xl p-4 mb-4 bg-[#1a2b4a] text-white">
                                        <p className="text-xs font-bold tracking-[0.16em] uppercase text-[#5cccf0] mb-1">
                                            Starts here
                                        </p>
                                        <h3 className="font-extrabold text-lg mb-1">10-day free trial</h3>
                                        <p className="text-sm text-white/75 mb-3">
                                            Unlimited SOAP and PetQuery. Every feature. Then you pick a plan.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => start('pricing-trial')}
                                            className="w-full rounded-full py-2.5 text-sm font-medium bg-[#5cccf0] text-white"
                                        >
                                            Start my free 10 days
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {PLANS.map((p) => (
                                            <div key={p.name} className="rounded-2xl p-4 border bg-white border-gray-100">
                                                <div className="flex items-baseline justify-between gap-2 mb-2">
                                                    <h3 className="font-extrabold">{p.name}</h3>
                                                    <p className="text-sm">
                                                        <span className="text-xl font-extrabold">{p.price}</span>
                                                        <span className="text-[#1a2b4a]/50">{p.period}</span>
                                                    </p>
                                                </div>
                                                {p.save && <p className="text-xs font-semibold text-[#3468bd] mb-2">{p.save}</p>}
                                                <ul className="text-sm space-y-1 text-[#1a2b4a]/70">
                                                    {p.items.map((item) => <li key={item}>{item}</li>)}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4">
                                    <h2 className="text-2xl font-extrabold tracking-tight text-center mb-4">
                                        Dr. Stacey <span className="text-[#5cccf0]">Gastis</span>
                                    </h2>
                                    <YoutubeEmbed />
                                    <p className="text-sm text-[#1a2b4a]/65 text-center mt-4 mb-4">
                                        Built by a veterinarian, for veterinarians. 30+ years in practice.
                                    </p>
                                    <Cta onClick={() => start('vsl')}>Start my free 10 days</Cta>
                                    <p className="text-xs text-[#1a2b4a]/45 text-center mt-2">
                                        Unlimited SOAP and PetQuery for 10 days. No credit card.
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {step > 0 && (
                    <div className="shrink-0 px-4 py-3 bg-white border-t border-gray-100 flex items-center gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        <button
                            type="button"
                            onClick={() => go(step - 1)}
                            className="px-3 py-2.5 text-sm font-medium text-[#1a2b4a]/60"
                        >
                            Back
                        </button>
                        <button
                            type="button"
                            onClick={() => (step === STEPS.length - 1 ? start('vsl-next') : go(step + 1))}
                            className="flex-1 rounded-full bg-[#3468bd] text-white font-medium py-3"
                        >
                            {nextLabel()}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VetsDemoWalkthrough;
