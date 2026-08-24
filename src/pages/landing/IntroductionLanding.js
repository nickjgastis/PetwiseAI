import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { FaArrowRight, FaCheck, FaShieldAlt } from 'react-icons/fa';
import YoutubeEmbed from './YoutubeEmbed';

const BULLETS = [
    '140 minutes + a day saved',
    'Cutting edge SOAP dictation',
    'Clinical AI assistant with trusted sources'
];

const IntroductionLanding = () => {
    const { loginWithRedirect } = useAuth0();
    const [email, setEmail] = useState('');

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
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-44 -right-40 w-[44rem] h-[44rem] rounded-full bg-amber-300/25 blur-[140px]" />
                <div className="absolute top-[38%] -left-52 w-[42rem] h-[42rem] rounded-full bg-rose-300/20 blur-[150px]" />
                <div className="absolute bottom-[-10%] right-1/4 w-[38rem] h-[38rem] rounded-full bg-sky-300/20 blur-[150px]" />
            </div>

            <header className="sticky top-0 z-40 backdrop-blur-md bg-[#3468bd]/40 border-b border-white/10">
                <div className="max-w-3xl mx-auto px-5 sm:px-6 h-20 sm:h-24 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        <img src="/PW.png" alt="PetWise" className="w-11 h-11 sm:w-14 sm:h-14 object-contain" />
                        <span className="font-extrabold tracking-tight text-xl sm:text-2xl">
                            Petwise<span className="font-light text-white/60">.vet</span>
                        </span>
                    </div>
                    <button
                        onClick={logIn}
                        className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-white text-[#3468bd] text-sm font-bold hover:bg-amber-50 hover:text-[#20447f] transition-all shadow-md"
                    >
                        Log in
                    </button>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-5 sm:px-6 pt-10 pb-16 sm:pt-16 sm:pb-24 text-center">
                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] mb-4">
                    Do you want to save time writing SOAP records?
                </h1>
                <p className="text-lg sm:text-xl text-white/80 leading-relaxed mb-8 max-w-2xl mx-auto">
                    Watch Dr. Stacey Gastis explain how YOU can save 140 minutes+ a day using Petwise!
                </p>

                <YoutubeEmbed className="mb-8" />

                <form
                    onSubmit={startSignup}
                    className="flex flex-col sm:flex-row items-stretch gap-2.5 max-w-md mx-auto mb-8"
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
                        Start Free
                        <FaArrowRight className="text-xs transition-transform group-hover:translate-x-0.5" />
                    </button>
                </form>

                <ul className="space-y-3 max-w-md mx-auto text-left">
                    {BULLETS.map((item) => (
                        <li key={item} className="flex items-start gap-3 text-white/90 text-[15px] font-medium">
                            <FaCheck className="text-amber-300 text-sm mt-1 flex-shrink-0" />
                            {item}
                        </li>
                    ))}
                </ul>

                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-8 text-[13px] text-white/60">
                    <span className="flex items-center gap-1.5"><FaShieldAlt className="text-[11px]" /> No credit card</span>
                    <span className="flex items-center gap-1.5"><FaCheck className="text-amber-300 text-[11px]" /> Free forever with daily usage</span>
                </div>

                <div className="text-center text-white/45 text-xs mt-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
                    <span>© {new Date().getFullYear()} Petwise.vet</span>
                    <a href="/privacy" className="hover:text-white/70 transition-colors">Privacy</a>
                    <a href="/terms" className="hover:text-white/70 transition-colors">Terms</a>
                </div>
            </main>
        </div>
    );
};

export default IntroductionLanding;
