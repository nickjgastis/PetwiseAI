import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowRight, FiCheck, FiChrome, FiClipboard, FiFileText, FiLock, FiMail, FiMousePointer, FiRefreshCw, FiSettings, FiZap } from 'react-icons/fi';
import { BRAND_WASH, GRADIENT_TEXT } from '../components/caseStyles';
import { canInstallSmartPaste, SMARTPASTE_STORE_URL, useSmartPasteInstalled } from '../utils/smartPasteBridge';

const EASE = [0.2, 0.7, 0.2, 1];
const NAVY = { background: 'linear-gradient(160deg,#3f7ad6 0%,#2d5fb8 45%,#2350a3 100%)' };
const EARLY_ACCESS = 'mailto:support@petwise.vet?subject=SmartPaste%20early%20access';

const STEPS = [
    {
        icon: FiChrome,
        title: 'Add SmartPaste to Chrome',
        text: 'One click from the Chrome Web Store. Then pin it: click the puzzle piece in Chrome\u2019s toolbar and pin PetWise SmartPaste.',
    },
    {
        icon: FiFileText,
        title: 'Open a record in PetWise',
        text: 'Make or open a SOAP, summary, callback or dental record here, as usual. SmartPaste picks it up on its own. There is nothing to sign in to.',
    },
    {
        icon: FiMousePointer,
        title: 'Click a field in your PIMS, then Paste',
        text: 'In ezyVet, Vetspire, Provet Cloud, Shepherd, Digitail, Covetrus Pulse, IDEXX Neo or Instinct, a Paste button appears beside any notes field. Using something else? Click the PetWise icon in Chrome\u2019s toolbar there and choose Turn on for this site.',
    },
];

const GOOD_TO_KNOW = [
    { icon: FiZap, title: 'SOAPs go section by section', text: 'Click the Subjective field and it pastes the Subjective. A general notes field gets the whole SOAP. Paste all sections fills them all at once.' },
    { icon: FiClipboard, title: 'Summaries, callbacks and dental', text: 'These paste whole, into whichever field you click.' },
    { icon: FiSettings, title: 'Always your choice', text: 'There is always a one-click paste. Use the gear on the button to pick a different section or patient.' },
    { icon: FiLock, title: 'Private by design', text: 'Records go straight from this tab to the extension and are cleared when you sign out or quit Chrome. SmartPaste only runs on practice software.' },
];

// A static replica of the in-page SmartPaste button, so vets know what to look for.
const ChipPreview = () => (
    <div className="relative w-full max-w-[420px]">
        <div className="rounded-[18px] bg-white/95 p-4 shadow-[0_30px_60px_-30px_rgba(10,25,60,0.6)]">
            <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#5b6b85]">Subjective</p>
            <div className="h-[92px] rounded-[10px] border-2 border-[#3f8ddb] bg-white px-3 py-2 text-[13px] text-[#13233f]/40">|</div>
        </div>
        <div className="absolute -top-6 right-3 flex items-center gap-1 h-10 pl-1.5 pr-1 rounded-full bg-white border border-[#c3ddf5] shadow-[0_0_0_3px_rgba(63,141,219,0.14),0_10px_24px_-8px_rgba(19,35,63,0.35)]">
            <img src="/favicon-96x96.png" alt="" className="w-7 h-7 rounded-full mr-1.5" />
            <span className="text-[13.5px] font-semibold text-[#13233f]">Bella</span>
            <span className="ml-1 px-1.5 py-[1px] rounded-full bg-[#e7f2fc] text-[#2d6fc0] text-[10.5px] font-bold">SOAP</span>
            <span className="mx-2 w-px h-5 bg-[#dfe6f0]" />
            <span className="h-[30px] px-4 rounded-full bg-[#3f8ddb] text-white text-[13px] font-semibold flex items-center">Paste Subjective</span>
            <span className="mx-1.5 w-px h-5 bg-[#dfe6f0]" />
            <span className="w-7 text-center text-[#5b6b85] text-[15px]">{'\u2699'}</span>
        </div>
    </div>
);

function InstallPanel({ installed }) {
    if (installed) {
        return (
            <>
                <p className="m-0 inline-flex items-center gap-2 h-8 px-3 rounded-full bg-white/15 text-[13px] font-semibold">
                    <FiCheck /> SmartPaste is installed
                </p>
                <p className="m-0 mt-4 text-[16px] text-white/85 leading-relaxed max-w-[420px]">
                    Open a record, then click a notes field in your practice software. The Paste button appears beside it.
                </p>
                <Link to="/dashboard/cases" className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-full bg-white text-[#2d5fb8] text-[14.5px] font-semibold no-underline hover:bg-[#f3f7fd] transition-colors">
                    Open a case <FiArrowRight />
                </Link>
            </>
        );
    }
    if (!canInstallSmartPaste()) {
        return (
            <p className="m-0 text-[16px] text-white/85 leading-relaxed max-w-[420px]">
                SmartPaste works in Google Chrome on a computer. Open PetWise in Chrome to add it, and use your practice software in Chrome too.
            </p>
        );
    }
    if (!SMARTPASTE_STORE_URL) {
        return (
            <>
                <p className="m-0 text-[16px] text-white/85 leading-relaxed max-w-[420px]">
                    SmartPaste is coming to the Chrome Web Store. Want it early? Email us and we will send it over.
                </p>
                <a href={EARLY_ACCESS} className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-full bg-white text-[#2d5fb8] text-[14.5px] font-semibold no-underline hover:bg-[#f3f7fd] transition-colors">
                    <FiMail /> Get early access
                </a>
            </>
        );
    }
    return (
        <>
            <a
                href={SMARTPASTE_STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2.5 h-12 px-6 rounded-full bg-white text-[#2d5fb8] text-[15.5px] font-semibold no-underline shadow-[0_14px_30px_-14px_rgba(10,25,60,0.6)] hover:bg-[#f3f7fd] transition-colors"
            >
                <FiChrome className="text-[18px]" /> Add to Chrome, it&rsquo;s free
            </a>
            <p className="m-0 mt-3 text-[13.5px] text-white/75">Opens the Chrome Web Store. Click Add to Chrome, then Add extension.</p>
            <p className="m-0 mt-1 text-[12.5px] text-white/60">Using Microsoft Edge? It works there too. Choose Allow extensions from other stores when Edge asks.</p>
            <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-5 inline-flex items-center gap-2 p-0 bg-transparent border-none cursor-pointer text-[13.5px] font-semibold text-white/90 hover:text-white"
            >
                <FiRefreshCw /> Added it? Refresh this page
            </button>
        </>
    );
}

const SmartPaste = () => {
    const installed = useSmartPasteInstalled({ pollMs: 2000 });

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#f6f8fb] to-white" style={{ fontFamily: 'var(--font-sans)' }}>
            <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-16">
                <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="mb-10">
                    <p className="m-0 mb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[#2d5fb8]">Chrome extension</p>
                    <h1 className={`m-0 pb-1 text-[2.4rem] sm:text-[3rem] font-bold tracking-[-0.03em] ${GRADIENT_TEXT}`}>SmartPaste</h1>
                    <p className="m-0 mt-2 text-[17px] text-[#1a2b4a]/60 max-w-[600px]">
                        Paste PetWise records straight into your practice software. One click, no copying, no switching tabs.
                    </p>
                </motion.header>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
                    className="mb-14 rounded-[32px] p-7 sm:p-10 text-white grid md:grid-cols-2 gap-10 items-center shadow-[0_40px_80px_-40px_rgba(35,80,163,0.8)]"
                    style={NAVY}
                >
                    <div>
                        <img src="/favicon-96x96.png" alt="" className="w-14 h-14 rounded-full mb-5 ring-4 ring-white/20" />
                        {installed === null ? <div className="h-12" /> : <InstallPanel installed={installed} />}
                    </div>
                    <div className="flex justify-center md:justify-end pt-6">
                        <ChipPreview />
                    </div>
                </motion.div>

                <section className="mb-14">
                    <p className="m-0 mb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[#2d5fb8]">How it works</p>
                    <h2 className="m-0 mb-5 text-[24px] sm:text-[28px] font-bold tracking-[-0.02em] text-[#13233f]">Three steps, about a minute</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        {STEPS.map((s, i) => {
                            const Icon = s.icon;
                            return (
                                <motion.div
                                    key={s.title}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, ease: EASE, delay: 0.05 * i }}
                                    className="rounded-[28px] bg-white border border-[#e7ecf3] p-6 flex flex-col shadow-[0_18px_40px_-34px_rgba(19,35,63,0.35)]"
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="w-11 h-11 rounded-[14px] text-white flex items-center justify-center text-[18px] shadow-[0_12px_26px_-14px_rgba(45,95,184,0.8)]" style={NAVY}>
                                            <Icon />
                                        </span>
                                        <span className="text-[13px] font-bold text-[#1a2b4a]/40">Step {i + 1}</span>
                                    </div>
                                    <p className="m-0 text-[18px] font-semibold text-[#13233f]">{s.title}</p>
                                    <p className="m-0 mt-1 text-[15px] text-[#1a2b4a]/60 leading-relaxed">{s.text}</p>
                                </motion.div>
                            );
                        })}
                    </div>
                </section>

                <section className="mb-14">
                    <p className="m-0 mb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[#2d5fb8]">Good to know</p>
                    <h2 className="m-0 mb-5 text-[24px] sm:text-[28px] font-bold tracking-[-0.02em] text-[#13233f]">Made for busy days</h2>
                    <div className={`rounded-[28px] ${BRAND_WASH} border border-[#e3ecf8] p-6 sm:p-8 grid sm:grid-cols-2 gap-6`}>
                        {GOOD_TO_KNOW.map((g) => {
                            const Icon = g.icon;
                            return (
                                <div key={g.title} className="flex gap-4">
                                    <span className="w-10 h-10 shrink-0 rounded-[12px] bg-white border border-[#e3ecf8] text-[#2d5fb8] flex items-center justify-center text-[17px]">
                                        <Icon />
                                    </span>
                                    <div>
                                        <p className="m-0 text-[16px] font-semibold text-[#13233f]">{g.title}</p>
                                        <p className="m-0 mt-1 text-[14.5px] text-[#1a2b4a]/60 leading-relaxed">{g.text}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <div className="rounded-[28px] p-7 sm:p-8 text-white flex flex-wrap items-center justify-between gap-5" style={NAVY}>
                    <div>
                        <p className="m-0 text-[20px] font-semibold">Questions about SmartPaste?</p>
                        <p className="m-0 mt-1 text-[15px] text-white/80">Email us and we&rsquo;ll help you get set up.</p>
                    </div>
                    <a href="mailto:support@petwise.vet" className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-white text-[#2d5fb8] text-[14.5px] font-semibold no-underline hover:bg-[#f3f7fd] transition-colors">
                        <FiMail /> support@petwise.vet
                    </a>
                </div>
            </div>
        </div>
    );
};

export default SmartPaste;
