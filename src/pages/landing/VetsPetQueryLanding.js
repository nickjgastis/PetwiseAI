import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import PetQueryDemo from './campaign/PetQueryDemo';

const VetsPetQueryLanding = () => {
    const { loginWithRedirect } = useAuth0();
    const [showAfterAnswer, setShowAfterAnswer] = useState(false);

    const start = (placement) => {
        window.gtag?.('event', 'landing_cta', { page_variant: 'petquery', placement });
        window.fbq?.('track', 'Lead');
        loginWithRedirect({
            authorizationParams: { screen_hint: 'signup' },
            appState: { returnTo: '/dashboard/quick-query' }
        });
    };

    return (
        <div className="min-h-screen bg-[#f5f7fb] text-[#1a2b4a] text-base overflow-x-clip">
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/PW.png" alt="PetWise" className="w-8 h-8 object-contain" />
                        <span className="font-extrabold tracking-tight">
                            Petwise<span className="font-light text-[#1a2b4a]/40">.vet</span>
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => start('header')}
                        className="px-4 py-2 rounded-full bg-[#5cccf0] text-white text-sm font-medium"
                    >
                        Try for free
                    </button>
                </div>
            </header>

            <section className="px-4 pt-8 pb-6 sm:pt-12">
                <div className="max-w-xl mx-auto">
                    <p className="text-sm font-bold tracking-[0.18em] uppercase text-[#3468bd] mb-3">
                        More than a scribe
                    </p>
                    <h1 className="text-[2rem] leading-[1.12] font-extrabold tracking-tight sm:text-4xl mb-4">
                        SOAP notes are only half the job.{' '}
                        <span className="text-[#5cccf0]">PetQuery is the other half.</span>
                    </h1>
                    <p className="text-lg text-[#1a2b4a]/70 leading-relaxed mb-3">
                        PetWise is the veterinary AI that writes the record and stays for the rest of the case.
                        PetQuery is the clinical assistant inside it. Doses. Protocols. Differentials. Sourced answers, built for licensed vets.
                    </p>
                    <p className="text-[15px] text-[#1a2b4a]/80 font-medium mb-6">
                        Try it right now. Three real questions. No account.
                    </p>

                    <PetQueryDemo
                        onSignup={() => start('demo-lock')}
                        onFirstAnswer={() => setShowAfterAnswer(true)}
                    />

                    {showAfterAnswer && (
                        <div className="mt-5">
                            <button
                                type="button"
                                onClick={() => start('after-answer')}
                                className="w-full rounded-full bg-[#5cccf0] text-white font-medium py-3.5"
                            >
                                Keep asking. Start my free 10 days.
                            </button>
                            <p className="text-sm text-[#1a2b4a]/50 text-center mt-2">
                                Unlimited PetQuery and SOAP for 10 days. No credit card.
                            </p>
                        </div>
                    )}
                </div>
            </section>

            <footer className="px-4 py-8 text-sm text-[#1a2b4a]/40 flex justify-between max-w-xl mx-auto">
                <span>© {new Date().getFullYear()} Petwise.vet</span>
                <div className="flex gap-4">
                    <a href="/privacy" className="hover:text-[#3468bd]">Privacy</a>
                    <a href="/terms" className="hover:text-[#3468bd]">Terms</a>
                </div>
            </footer>
        </div>
    );
};

export default VetsPetQueryLanding;
