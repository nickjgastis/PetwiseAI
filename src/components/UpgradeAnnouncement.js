import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiArrowRight, FiFolder, FiMic, FiPlus, FiSend, FiSmartphone, FiX } from 'react-icons/fi';
import { PiTooth } from 'react-icons/pi';
import DentalChart from './DentalChart';
import Guide, { StepBody, NAME_SCRIPT } from './Guide';
import { BRAND_WASH, TYPE_STYLES, GRADIENT_TEXT } from './caseStyles';
import { requestNewCase } from '../utils/cases';

const EASE = [0.2, 0.7, 0.2, 1];
const SEEN_KEY = 'petwise_upgrade_cases_v2';
const NEW_ACCOUNT_MS = 3 * 24 * 60 * 60 * 1000;
const VIOLET_TEXT = 'bg-clip-text text-transparent bg-gradient-to-r from-[#6d28d9] via-[#8b5cf6] to-[#c084fc]';

const DENTAL_SAMPLE = {
    104: { status: 'watch' },
    108: { status: 'extracted' },
    201: { status: 'missing' },
    309: { status: 'periodontal' },
    409: { status: 'extracted' }
};
const DENTAL_POINTS = ['Pick Dental, then dictate', 'Every tooth charted, dog and cat', 'PDF with the chart on page one'];

const DentalCard = ({ compact = false }) => (
    <div className={`rounded-[24px] bg-white border border-[#e7ecf3] shadow-[0_30px_60px_-36px_rgba(19,35,63,0.45)] ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-center gap-2.5 mb-2">
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-violet-50 text-violet-700 text-[11.5px] font-semibold">
                <PiTooth className="text-[13px]" /> Dental
            </span>
            <span className="text-[14px] font-semibold text-[#13233f]">Max</span>
        </div>
        <DentalChart species="canine" teeth={DENTAL_SAMPLE} showLegend={!compact} maxHeight={compact ? '220px' : '340px'} />
    </div>
);

const seenKey = (sub) => `${SEEN_KEY}:${sub || 'anon'}`;

// Existing users only: brand-new accounts get the AppTour instead.
export const shouldShowUpgrade = (userData, sub) => {
    if (!userData || userData.has_seen_app_tour === false) return false;
    if (localStorage.getItem(seenKey(sub))) return false;
    const created = userData.created_at ? new Date(userData.created_at).getTime() : 0;
    return !created || Date.now() - created > NEW_ACCOUNT_MS;
};

export const markUpgradeSeen = (sub) => localStorage.setItem(seenKey(sub), new Date().toISOString());

const CaseMock = ({ compact = false }) => {
    const rows = [
        { type: 'soap', title: 'Vomiting, 2 days', text: 'Mild cranial abdominal pain, maropitant started.' },
        { type: 'summary', title: 'Discharge summary', text: 'Bland diet, recheck Friday.' },
        { type: 'callback', title: 'Day 2 check-in', text: 'Eating again, no more vomiting.' }
    ];
    return (
        <div className={`rounded-[24px] bg-white border border-[#e7ecf3] shadow-[0_30px_60px_-36px_rgba(19,35,63,0.45)] ${compact ? 'p-4' : 'p-5'}`}>
            <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 rounded-2xl bg-[#e9f6fd] text-[#2d5fb8] flex items-center justify-center text-[18px]">
                    <FiFolder />
                </span>
                <div>
                    <p className="m-0 text-[16px] font-semibold text-[#13233f]">Bella</p>
                    <p className="m-0 text-[12.5px] text-[#1a2b4a]/50">Today · 3 records</p>
                </div>
            </div>
            <div className="space-y-2">
                {rows.map((r) => {
                    const t = TYPE_STYLES[r.type];
                    return (
                        <div key={r.type} className="rounded-[16px] bg-[#f6f8fb] px-3.5 py-2.5">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${t.soft}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} /> {t.label}
                            </span>
                            <p className="m-0 mt-1 text-[14px] font-semibold text-[#13233f]">{r.title}</p>
                            {!compact && <p className="m-0 text-[13px] text-[#1a2b4a]/55">{r.text}</p>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const DIAGRAM_ROWS = [
    { type: 'soap', title: 'Vomiting, 2 days' },
    { type: 'summary', title: 'Discharge summary' },
    { type: 'callback', title: 'Day 2 check-in' }
];

const CaseDiagram = () => (
    <div>
        <div className="relative z-10 flex items-center gap-3 rounded-[22px] bg-white border border-[#e7ecf3] p-4 shadow-[0_24px_50px_-30px_rgba(19,35,63,0.45)]">
            <span className="w-11 h-11 rounded-2xl bg-[#e9f6fd] text-[#2d5fb8] flex items-center justify-center text-[19px]">
                <FiFolder />
            </span>
            <div className="min-w-0">
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-[#2d5fb8]">Case</p>
                <p className="m-0 text-[17px] font-semibold text-[#13233f]">Bella</p>
                <p className="m-0 text-[12.5px] text-[#1a2b4a]/50">Today · 3 records</p>
            </div>
        </div>
        <div className="ml-[38px] pl-7 pt-3.5 pb-2.5 border-l-2 border-[#2d5fb8]/20">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-[#1a2b4a]/45">Record types</p>
        </div>
        <div className="ml-[38px]">
            {DIAGRAM_ROWS.map((r, idx) => {
                const t = TYPE_STYLES[r.type];
                const lastRow = idx === DIAGRAM_ROWS.length - 1;
                return (
                    <div key={r.type} className="relative pl-7 pb-2.5 last:pb-0">
                        {!lastRow && <span className="absolute left-0 top-0 bottom-0 border-l-2 border-[#2d5fb8]/20" />}
                        <span className="absolute left-0 top-0 h-1/2 w-5 border-l-2 border-b-2 border-[#2d5fb8]/20 rounded-bl-[10px]" />
                        <div className="rounded-[16px] bg-white border border-[#e7ecf3] px-3.5 py-2.5 shadow-[0_14px_30px_-24px_rgba(19,35,63,0.45)]">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${t.soft}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} /> {t.label}
                            </span>
                            <p className="m-0 mt-1 text-[14px] font-semibold text-[#13233f]">{r.title}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

const Feature = ({ icon: Icon, title, text }) => (
    <div className="flex items-start gap-3.5">
        <span className="w-10 h-10 shrink-0 rounded-2xl bg-[#2d5fb8]/10 text-[#2d5fb8] flex items-center justify-center text-[17px]">
            <Icon />
        </span>
        <div>
            <p className="m-0 text-[16px] font-semibold text-[#13233f]">{title}</p>
            <p className="m-0 mt-0.5 text-[14.5px] text-[#1a2b4a]/65 leading-relaxed">{text}</p>
        </div>
    </div>
);

const DENTAL_SLIDE = {
    eyebrow: 'New',
    title: 'Dental Records',
    body: 'Dictate the dental the way you would say it to a tech. PetWise charts every tooth and writes the record next to it. It’s included in your plan.',
    dental: true
};

const DESKTOP_SLIDES = [
    {
        eyebrow: 'What’s new',
        title: 'PetWise has been upgraded',
        body: 'Your records are now organised into cases. Each patient visit is one case, with every record for that visit in one place.',
        visual: true
    },
    DENTAL_SLIDE,
    {
        eyebrow: 'How it works now',
        title: 'Start a case, add records',
        features: [
            { icon: FiPlus, title: 'New case', text: 'Start a visit from the top of the sidebar, dictate, and generate.' },
            { icon: FiFolder, title: 'Cases', text: 'Find any patient and see all their records together.' },
            { icon: FiMic, title: 'Record types', text: 'SOAP, Summary, Callback and Dental can all live in the same case.' },
            { icon: FiSmartphone, title: 'Your phone', text: 'Open a patient’s case on your phone to add to it, or start a new case. Whatever you send goes into that case.' }
        ]
    },
    {
        eyebrow: 'Nothing lost',
        title: 'Your records came with you',
        body: 'Each of your existing records is now its own case, named after the patient. Older PetSOAP records are still in Saved Records, under More in the sidebar.',
        tip: true
    }
];

const MOBILE_SLIDES = [
    {
        eyebrow: 'What’s new',
        title: 'PetWise has been upgraded',
        body: 'Every patient visit is now a case. Start a new case or open an existing one, dictate, and the record goes into that case on your desktop.',
        visual: true
    },
    DENTAL_SLIDE,
    {
        eyebrow: 'Dictating',
        title: 'Say the name first',
        mobileSteps: true
    },
    {
        eyebrow: 'Cases',
        title: 'Your patients are here too',
        features: [
            { icon: FiFolder, title: 'Cases tab', text: 'Search and scroll every patient.' },
            { icon: FiPlus, title: 'Tap a patient', text: 'To add to their case, open it first and dictate from there. Otherwise you start a new case.' }
        ]
    }
];

const UpgradeAnnouncement = ({ isMobile, sub, onClose }) => {
    const navigate = useNavigate();
    const slides = isMobile ? MOBILE_SLIDES : DESKTOP_SLIDES;
    const [i, setI] = useState(0);
    const [guide, setGuide] = useState(false);
    const slide = slides[i];
    const last = i === slides.length - 1;

    const close = (after) => {
        markUpgradeSeen(sub);
        onClose();
        if (after) after();
    };

    const body = (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22, ease: EASE }}>
                <p className="m-0 mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[#2d5fb8]">{slide.eyebrow}</p>
                <h2 className={`m-0 mb-4 pb-1 font-bold tracking-[-0.03em] leading-tight ${i === 0 ? `${GRADIENT_TEXT} text-[32px] sm:text-[40px]` : slide.dental ? `${VIOLET_TEXT} text-[32px] sm:text-[40px]` : 'font-display text-[#13233f] text-[26px] sm:text-[32px]'}`}>{slide.title}</h2>
                {slide.body && <p className="m-0 mb-6 text-[16px] sm:text-[17px] text-[#1a2b4a]/70 leading-relaxed">{slide.body}</p>}
                {slide.visual && isMobile && <CaseMock compact />}
                {slide.dental && isMobile && <DentalCard compact />}
                {slide.dental && (
                    <ul className={`m-0 p-0 list-none space-y-2.5 ${isMobile ? 'mt-5' : ''}`}>
                        {DENTAL_POINTS.map((point) => (
                            <li key={point} className="flex items-center gap-2.5 text-[15px] text-[#1a2b4a]/75">
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                                {point}
                            </li>
                        ))}
                    </ul>
                )}
                {slide.features && (
                    <div className="space-y-5 mt-2">
                        {slide.features.map((f) => <Feature key={f.title} {...f} />)}
                    </div>
                )}
                {slide.mobileSteps && (
                    <StepBody
                        step={{
                            numbered: ['Tap New case, or open the patient from Cases.', 'Pick the record type.', 'Tap the mic. Start with the patient’s name.', 'Tap Done, then Send to desktop.'],
                            script: NAME_SCRIPT.slice(0, 2)
                        }}
                    />
                )}
                {slide.tip && (
                    <div className="rounded-[20px] bg-[#13233f] text-white p-5">
                        <p className="m-0 mb-1.5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#5cccf0]">
                            <FiMic /> One habit to pick up
                        </p>
                        <p className="m-0 text-[15.5px] leading-relaxed text-white/85">
                            Say the patient’s name at the start of every dictation. That’s how PetWise names the case so you can find it later.
                        </p>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );

    const primary = 'inline-flex items-center justify-center gap-1.5 h-12 px-6 rounded-full text-[15px] font-semibold text-white bg-[#2d5fb8] hover:bg-[#2350a3] border-none cursor-pointer shadow-[0_10px_30px_-12px_rgba(45,95,184,0.7)] transition-colors';
    const secondary = 'inline-flex items-center justify-center gap-1.5 h-12 px-5 rounded-full text-[15px] font-semibold text-[#13233f] bg-white border border-[#e7ecf3] hover:bg-[#f6f8fb] cursor-pointer transition-colors';

    const actions = last ? (
        isMobile ? (
            <button type="button" className={`${primary} w-full`} onClick={() => close(() => requestNewCase(navigate))}>
                <FiMic /> Start dictating
            </button>
        ) : (
            <>
                <button type="button" className={secondary} onClick={() => setGuide(true)}>
                    Show me how
                </button>
                <button type="button" className={primary} onClick={() => close(() => navigate('/dashboard/cases'))}>
                    Go to my cases <FiArrowRight />
                </button>
            </>
        )
    ) : (
        <button type="button" className={`${primary} ${isMobile ? 'w-full' : ''}`} onClick={() => setI(i + 1)}>
            {i === 0 ? 'See what’s new' : 'Next'} <FiArrowRight />
        </button>
    );

    const dots = (
        <div className="flex items-center gap-1.5">
            {slides.map((s, n) => (
                <button
                    key={s.title}
                    type="button"
                    onClick={() => setI(n)}
                    aria-label={`Slide ${n + 1}`}
                    className={`h-1.5 rounded-full border-none p-0 cursor-pointer transition-all ${n === i ? 'w-6 bg-[#2d5fb8]' : 'w-1.5 bg-[#1a2b4a]/15'}`}
                />
            ))}
        </div>
    );

    if (guide) {
        return <Guide id="records" onClose={() => close()} />;
    }

    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[9997] flex ${isMobile ? '' : 'items-center justify-center p-6 bg-[#13233f]/45 backdrop-blur-md'}`}
            style={{ fontFamily: "var(--font-sans)" }}
        >
            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: EASE }}
                className={
                    isMobile
                        ? 'w-full h-full bg-gradient-to-b from-[#f3f7fd] to-white flex flex-col'
                        : 'w-full max-w-[1040px] h-[min(680px,calc(100vh-48px))] rounded-[32px] bg-white overflow-hidden flex shadow-[0_40px_120px_-40px_rgba(19,35,63,0.6)]'
                }
            >
                {!isMobile && (
                    <div className={`w-[44%] shrink-0 relative ${BRAND_WASH} flex items-center justify-center p-10 overflow-hidden`}>
                        <div className="absolute -top-20 -left-16 w-72 h-72 rounded-full bg-[#5cccf0]/25 blur-3xl" />
                        <div className="absolute -bottom-24 -right-10 w-80 h-80 rounded-full bg-[#2d5fb8]/20 blur-3xl" />
                        <AnimatePresence mode="wait" initial={false}>
                            {slide.dental ? (
                                <motion.div key="dental" className="relative w-full max-w-[380px]" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }}>
                                    <h3 className={`m-0 mb-5 pb-1 text-[38px] font-bold tracking-[-0.03em] leading-none ${VIOLET_TEXT}`}>Dental</h3>
                                    <DentalCard />
                                </motion.div>
                            ) : (
                                <motion.div key="cases" className="relative w-full max-w-[340px]" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}>
                                    <h3 className={`m-0 mb-5 pb-1 text-[38px] font-bold tracking-[-0.03em] leading-none ${GRADIENT_TEXT}`}>Cases</h3>
                                    <CaseDiagram />
                                    <div className="absolute -right-4 -bottom-5 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#2d5fb8] shadow-[0_14px_30px_-16px_rgba(19,35,63,0.5)]">
                                        <FiSend className="text-[12px]" /> From your phone
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col">
                    <div className={`flex justify-end ${isMobile ? 'px-4 pt-[max(14px,env(safe-area-inset-top))]' : 'px-6 pt-5'}`}>
                        <button type="button" onClick={() => close()} title="Close" className="w-10 h-10 rounded-full flex items-center justify-center text-[#1a2b4a]/50 hover:bg-[#f6f8fb] bg-transparent border-none cursor-pointer text-[20px]">
                            <FiX />
                        </button>
                    </div>
                    <div className={`flex-1 min-h-0 overflow-y-auto ${isMobile ? 'px-6 pb-6' : 'px-12 pb-6 flex flex-col justify-center'}`}>
                        <div className="max-w-[520px]">{body}</div>
                    </div>
                    <div className={isMobile ? 'px-6 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] space-y-4' : 'px-12 py-6 flex items-center justify-between border-t border-[#eef2f7]'}>
                        {isMobile ? (
                            <>
                                <div className="flex justify-center">{dots}</div>
                                {actions}
                            </>
                        ) : (
                            <>
                                {dots}
                                <div className="flex items-center gap-2">{actions}</div>
                            </>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>,
        document.body
    );
};

export default UpgradeAnnouncement;
