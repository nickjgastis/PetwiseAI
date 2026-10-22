import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiArrowRight, FiChevronDown, FiFolder, FiMail, FiMessageCircle, FiMic, FiPlay, FiSmartphone } from 'react-icons/fi';
import Footer from './Footer';
import Guide, { StepBody, NAME_SCRIPT, SPEAK_TIPS } from './Guide';
import { BRAND_WASH, GRADIENT_TEXT } from './caseStyles';

const EASE = [0.2, 0.7, 0.2, 1];

const START = [
    {
        guide: 'records',
        icon: FiMic,
        title: 'Make a record',
        text: 'Dictate a visit and get a SOAP, summary or callback in seconds.',
        to: '/dashboard/quicksoap',
        cta: 'New case'
    },
    {
        guide: 'cases',
        icon: FiFolder,
        title: 'Manage cases',
        text: 'Find a patient, open their records and add new ones.',
        to: '/dashboard/cases',
        cta: 'Cases'
    },
    {
        guide: 'petquery',
        icon: FiMessageCircle,
        title: 'Ask PetQuery',
        text: 'Doses, differentials and protocols, answered in plain language.',
        to: '/dashboard/quick-query',
        cta: 'PetQuery'
    },
    {
        guide: 'phone',
        icon: FiSmartphone,
        title: 'Put it on your phone',
        text: 'Dictate in the exam room and send it to your desktop.'
    }
];

const FAQ = [
    {
        title: 'Records and cases',
        items: [
            {
                q: 'How does a case get its name?',
                a: 'Say the pet\u2019s name at the start of your dictation and PetWise names the case for you. You can rename it any time with the pencil on the case page.'
            },
            {
                q: 'Do I need to save?',
                a: 'The record is saved to its case as soon as it is generated. If you edit it afterwards, hit Save. PetWise asks before you leave with unsaved edits.'
            },
            {
                q: 'How do I add a callback or summary to an existing patient?',
                a: 'Open the case from Cases, click Add a record, pick the type, then dictate or type. Tick "Include earlier dictation" to build on what you already said.'
            },
            {
                q: 'Can I type instead of dictating?',
                a: 'Yes. On New case, click "Or type and paste notes instead". You can also mix both.'
            },
            {
                q: 'Where are my older records?',
                a: 'Records made before cases existed are in Saved Records, under More in the sidebar.'
            }
        ]
    },
    {
        title: 'Dictation',
        items: [
            {
                q: 'The mic is not working',
                a: 'Your browser needs microphone permission. Click the lock icon next to the address bar, allow the microphone, then reload. On a phone, check Settings for your browser\u2019s mic access.'
            },
            {
                q: 'How long can I talk for?',
                a: 'As long as you need. Long recordings can take up to a few minutes to transcribe. You can also split a visit into several dictations with Add more.'
            },
            {
                q: 'I said something wrong',
                a: 'Say "correction" and the right value, e.g. "correction, weight is 28 kilos". Or just fix it in the editor afterwards.'
            }
        ]
    },
    {
        title: 'Phone',
        items: [
            {
                q: 'Do I need to download an app?',
                a: 'No. Open petwise.vet on your phone, log in, and add it to your home screen. It opens like an app.'
            },
            {
                q: 'My phone dictation has not shown up',
                a: 'Keep PetWise open and logged in on your computer. It writes the record as soon as it sees the dictation and puts it in the case you dictated in on your phone, marked with a blue dot.'
            }
        ]
    },
    {
        title: 'PetQuery',
        items: [
            {
                q: 'How accurate is it?',
                a: 'PetQuery draws on veterinary references, journals and guidelines, and shows its sources under each answer. Treat it like a knowledgeable colleague: always confirm doses and decisions with your own judgment.'
            },
            {
                q: 'What sources does it use?',
                a: 'Standard references such as the Merck Veterinary Manual and Blackwell\u2019s Five-Minute Veterinary Consult, peer reviewed journals (JVIM, JFMS, JAAHA, Veterinary Clinics of North America and more), veterinary schools like Cornell, UC Davis and the Royal Veterinary College, and organisations such as the AVMA and WOAH.'
            }
        ]
    }
];

const Section = ({ eyebrow, title, children, className = '' }) => (
    <section className={`mb-14 ${className}`}>
        {eyebrow && <p className="m-0 mb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[#2d5fb8]">{eyebrow}</p>}
        <h2 className="m-0 mb-5 text-[24px] sm:text-[28px] font-bold tracking-[-0.02em] text-[#13233f]">{title}</h2>
        {children}
    </section>
);

const FaqItem = ({ q, a }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-[#eef2f7] last:border-b-0">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between gap-4 py-4 px-1 text-left bg-transparent border-none cursor-pointer text-[15.5px] font-semibold text-[#13233f] hover:text-[#2d5fb8] transition-colors"
            >
                {q}
                <FiChevronDown className={`shrink-0 text-[#1a2b4a]/40 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden">
                        <p className="m-0 px-1 pb-5 text-[15px] text-[#1a2b4a]/70 leading-relaxed max-w-[720px]">{a}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Help = () => {
    const { isAuthenticated } = useAuth0();
    const [guide, setGuide] = useState(null);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <>
            <div className="min-h-screen bg-gradient-to-b from-[#f6f8fb] to-white" style={{ fontFamily: "var(--font-sans)" }}>
                <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-16">
                    <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="mb-12">
                        <h1 className={`m-0 pb-1 text-[2.4rem] sm:text-[3rem] font-bold tracking-[-0.03em] ${GRADIENT_TEXT}`}>Help center</h1>
                        <p className="m-0 mt-2 text-[17px] text-[#1a2b4a]/60 max-w-[560px]">Everything you need to make records, manage cases and get answers. Each guide takes about a minute.</p>
                    </motion.header>

                    <Section eyebrow="Start here" title="The basics">
                        <div className="grid sm:grid-cols-2 gap-4">
                            {START.map((s, i) => {
                                const Icon = s.icon;
                                return (
                                    <motion.div
                                        key={s.guide}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.4, ease: EASE, delay: 0.05 * i }}
                                        className="rounded-[28px] bg-white border border-[#e7ecf3] p-6 sm:p-7 flex flex-col shadow-[0_18px_40px_-34px_rgba(19,35,63,0.35)]"
                                    >
                                        <span className="w-12 h-12 rounded-[16px] text-white flex items-center justify-center text-[20px] mb-4 shadow-[0_12px_26px_-14px_rgba(45,95,184,0.8)]" style={{ background: 'linear-gradient(160deg,#3f7ad6 0%,#2d5fb8 45%,#2350a3 100%)' }}>
                                            <Icon />
                                        </span>
                                        <p className="m-0 text-[19px] font-semibold text-[#13233f]">{s.title}</p>
                                        <p className="m-0 mt-1 mb-5 text-[15px] text-[#1a2b4a]/60 leading-relaxed">{s.text}</p>
                                        <div className="mt-auto flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setGuide(s.guide)}
                                                className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-[14px] font-semibold text-white bg-[#2d5fb8] hover:bg-[#2350a3] border-none cursor-pointer shadow-[0_10px_30px_-14px_rgba(45,95,184,0.7)] transition-colors"
                                            >
                                                <FiPlay className="text-[12px]" /> Show me how
                                            </button>
                                            {s.to && isAuthenticated && (
                                                <Link to={s.to} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-[14px] font-semibold text-[#13233f] hover:text-[#2d5fb8] no-underline transition-colors">
                                                    Go to {s.cta} <FiArrowRight />
                                                </Link>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </Section>

                    <Section eyebrow="Dictation" title="How to dictate a great record">
                        <div className="grid lg:grid-cols-2 gap-6 items-start">
                            <div>
                                <p className="m-0 mb-4 text-[16px] text-[#1a2b4a]/70 leading-relaxed">
                                    Start with the patient’s name and signalment, then talk through the visit the way you would tell a colleague. PetWise sorts it into the right sections.
                                </p>
                                <StepBody step={{ script: NAME_SCRIPT }} />
                            </div>
                            <StepBody step={{ tips: SPEAK_TIPS }} />
                        </div>
                    </Section>

                    <Section eyebrow="Phone" title="Get PetWise on your phone">
                        <div className={`rounded-[28px] ${BRAND_WASH} border border-[#e3ecf8] p-6 sm:p-8`}>
                            <StepBody step={{ install: true }} />
                            <button
                                type="button"
                                onClick={() => setGuide('phone')}
                                className="mt-6 inline-flex items-center gap-2 h-10 px-5 rounded-full text-[14px] font-semibold text-[#13233f] bg-white border border-[#e7ecf3] hover:border-[#2d5fb8]/30 hover:text-[#2d5fb8] cursor-pointer transition-colors"
                            >
                                <FiPlay className="text-[12px]" /> How dictating from your phone works
                            </button>
                        </div>
                    </Section>

                    <Section eyebrow="FAQ" title="Common questions">
                        <div className="grid gap-5">
                            {FAQ.map((group) => (
                                <div key={group.title} className="rounded-[24px] bg-white border border-[#e7ecf3] px-5 sm:px-7 pt-5 pb-1">
                                    <p className="m-0 mb-1 text-[13px] font-bold uppercase tracking-[0.08em] text-[#1a2b4a]/45">{group.title}</p>
                                    {group.items.map((item) => <FaqItem key={item.q} {...item} />)}
                                </div>
                            ))}
                        </div>
                    </Section>

                    <div className="rounded-[28px] p-7 sm:p-8 text-white flex flex-wrap items-center justify-between gap-5" style={{ background: 'linear-gradient(160deg,#3f7ad6 0%,#2d5fb8 45%,#2350a3 100%)' }}>
                        <div>
                            <p className="m-0 text-[20px] font-semibold">Still stuck?</p>
                            <p className="m-0 mt-1 text-[15px] text-white/80">Email us and we’ll help you out.</p>
                        </div>
                        <a href="mailto:support@petwise.vet" className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-white text-[#2d5fb8] text-[14.5px] font-semibold no-underline hover:bg-[#f3f7fd] transition-colors">
                            <FiMail /> support@petwise.vet
                        </a>
                    </div>
                    <p className="mt-6 text-center text-[13px] text-[#1a2b4a]/45">
                        <Link to="/privacy" className="text-inherit hover:text-[#2d5fb8] no-underline">Privacy Policy</Link>
                        <span className="mx-2">·</span>
                        <Link to="/terms" className="text-inherit hover:text-[#2d5fb8] no-underline">Terms of Service</Link>
                    </p>
                </div>
            </div>
            {!isAuthenticated && <Footer />}
            <AnimatePresence>{guide && <Guide key={guide} id={guide} onClose={() => setGuide(null)} />}</AnimatePresence>
        </>
    );
};

export default Help;
