import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiArrowRight, FiChrome, FiFileText, FiMousePointer, FiX } from 'react-icons/fi';
import { BRAND_WASH, GRADIENT_TEXT } from './caseStyles';
import { canInstallSmartPaste, SMARTPASTE_STORE_URL, useSmartPasteInstalled } from '../utils/smartPasteBridge';

const EASE = [0.2, 0.7, 0.2, 1];

// Static replicas of the extension, at its real size. The store screenshots are 1280px wide and got cropped in this panel.
const Logo = () => <img src="/favicon-96x96.png" alt="" className="w-7 h-7 shrink-0 rounded-full mr-1.5" />;

const Chip = ({ label, extra, tools = true }) => (
    <div className="inline-flex items-center max-w-full h-10 pl-1.5 pr-1 rounded-full bg-white border border-[#c3ddf5] shadow-[0_0_0_3px_rgba(63,141,219,0.12),0_8px_24px_rgba(19,35,63,0.16)] text-[13px] text-[#13233f]">
        <Logo />
        <span className="font-semibold">Bella</span>
        <span className="ml-1.5 px-1.5 py-px rounded-full bg-[#e7f2fc] text-[#2f7bc8] text-[10.5px] font-bold">SOAP</span>
        <span className="mx-2 w-px h-5 bg-[#dfe6f0] shrink-0" />
        {extra}
        <span className="h-[30px] px-3 rounded-full bg-[#3f8ddb] text-white text-[12.5px] font-semibold flex items-center whitespace-nowrap">{label}</span>
        {tools && <span className="w-7 shrink-0 text-center text-[#5b6b85] text-[15px]">{'\u2699'}</span>}
        {tools && <span className="w-6 shrink-0 text-center text-[#5b6b85] text-[18px] leading-none">{'\u00d7'}</span>}
    </div>
);

const Preview = () => (
    <div className="w-full max-w-[320px] rounded-[10px] border border-[#dfe6f0] bg-white px-2.5 py-2 shadow-[0_12px_32px_rgba(19,35,63,0.16)]">
        <p className="m-0 mb-1 text-[11px] font-bold text-[#5b6b85]">Bella · SOAP · Subjective</p>
        <p className="m-0 text-[12px] leading-snug text-[#13233f] whitespace-pre-wrap">{'Presenting Complaint:\nAcute vomiting of 24 hours duration.'}</p>
        <p className="m-0 mt-1 text-[11px] text-[#5b6b85]">+11 more lines</p>
    </div>
);

const Field = ({ label, filled, children }) => (
    <div>
        <p className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b6b85]">{label}</p>
        <div className={`rounded-[12px] border-2 bg-white px-3 py-2.5 text-[12.5px] leading-snug whitespace-pre-wrap ${filled ? 'border-[#d7e3f2] text-[#13233f]' : 'border-[#3f8ddb] text-[#13233f]/30'}`}>
            {children || '|'}
        </div>
    </div>
);

const PasteScene = () => (
    <div className="w-full max-w-[420px] rounded-[24px] bg-white border border-[#e7ecf3] p-4 shadow-[0_30px_60px_-36px_rgba(19,35,63,0.45)]" aria-hidden="true">
        <Field label="Subjective">
            <div className="flex flex-col items-start gap-2">
                <Chip label="Paste Subjective" />
                <Preview />
            </div>
        </Field>
    </div>
);

const SectionsScene = () => (
    <div className="w-full max-w-[420px] rounded-[24px] bg-white border border-[#e7ecf3] p-4 shadow-[0_30px_60px_-36px_rgba(19,35,63,0.45)] space-y-3" aria-hidden="true">
        <Field label="Objective" filled>
            {'Temperature: 102.6 F\nPulse: 120 bpm\nWeight: 24.2 kg'}
        </Field>
        <p className="m-0 inline-flex rounded-[10px] border border-[#a7f3d0] bg-[#ecfdf5] px-2.5 py-1.5 text-[12.5px] font-medium text-[#047857]">Pasted Bella&rsquo;s Objective.</p>
        <Field label="Assessment">
            <Chip label="Paste Assessment" tools={false} extra={<span className="h-[30px] mr-1 px-2.5 rounded-full bg-[#f2f8fd] border border-[#c3ddf5] text-[#3f8ddb] text-[12px] font-semibold flex items-center whitespace-nowrap">Paste all</span>} />
        </Field>
    </div>
);

const Row = ({ name, when, active, types }) => (
    <div className={`rounded-[10px] px-2 py-1.5 ${active ? 'bg-[#f2f8fd]' : ''}`}>
        <div className="flex items-center gap-2">
            <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${active ? 'border-[#3f8ddb] bg-[#3f8ddb] shadow-[inset_0_0_0_2px_#fff]' : 'border-[#c5d0e0]'}`} />
            <span className="text-[13px] font-semibold text-[#13233f]">{name}</span>
            <span className="ml-auto text-[11px] text-[#5b6b85]">{when}</span>
        </div>
        {types && (
            <div className="mt-1.5 ml-5 flex gap-1.5">
                {types.map((t) => (
                    <span key={t.label} className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${t.on ? t.on : 'bg-[#f4f6f9] text-[#5b6b85]'}`}>{t.label}</span>
                ))}
            </div>
        )}
    </div>
);

const PopupScene = () => (
    <div className="w-full max-w-[340px] rounded-[18px] bg-white border border-[#e7ecf3] p-3.5 shadow-[0_30px_60px_-36px_rgba(19,35,63,0.5)] text-[#13233f]" aria-hidden="true">
        <div className="flex items-center gap-2.5 px-0.5 pb-2">
            <img src="/favicon-96x96.png" alt="" className="w-8 h-8 rounded-full" />
            <div className="min-w-0">
                <p className="m-0 text-[16px] font-bold tracking-[-0.01em] leading-tight">SmartPaste</p>
                <p className="m-0 text-[11.5px] text-[#5b6b85]">by PetWise</p>
            </div>
            <span className="ml-auto relative w-[38px] h-[22px] rounded-full bg-[#3f8ddb]">
                <span className="absolute top-[3px] right-[3px] w-4 h-4 rounded-full bg-white shadow-[0_1px_3px_rgba(19,35,63,0.25)]" />
            </span>
        </div>
        <div className="rounded-[14px] border border-[#a7e0c9] bg-gradient-to-br from-[#f0fbf6] to-white px-3 py-2.5">
            <p className="m-0 flex items-center gap-1.5 text-[14px] font-bold"><span className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" /> On for your PIMS</p>
            <p className="m-0 mt-0.5 text-[12.5px] text-[#5b6b85]">Click a notes field and the paste button appears beside it.</p>
        </div>
        <div className="mt-2.5 rounded-[14px] border border-[#c3ddf5]/90 bg-white px-3 py-2.5 shadow-[0_6px_18px_-12px_rgba(35,80,163,0.35)]">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#5b6b85]">Paste from</span>
                <span className="px-2 py-0.5 rounded-full bg-[#e7f2fc] text-[#3f8ddb] text-[11px] font-semibold">From PetWise</span>
            </div>
            <Row name="Bella" when="9:12 AM" active types={[{ label: 'SOAP', on: 'bg-[#e7f2fc] text-[#2f7bc8]' }, { label: 'Callback', on: 'bg-[#fdf3e2] text-[#b45309]' }]} />
            <Row name="Max" when="10:05 AM" />
            <Row name="Luna" when="11:30 AM" />
            <p className="m-0 mt-2 text-[11.5px] text-[#5b6b85]">Cleared when you sign out of PetWise or quit Chrome.</p>
        </div>
    </div>
);

const SCENES = [PasteScene, SectionsScene, PopupScene];

const SLIDES = [
    {
        eyebrow: 'New',
        title: 'Paste into your PIMS',
        body: 'SmartPaste is a Chrome extension. The record you have open in PetWise shows up beside the notes field in your practice software. One click, no copying, no flipping back to this tab.',
        steps: null
    },
    {
        eyebrow: 'How it works',
        title: 'Open a record, click the field',
        body: null,
        steps: [
            { icon: FiChrome, title: 'Add it to Chrome', text: 'One click in the Chrome Web Store. Pin it from the puzzle piece so it stays in the toolbar.' },
            { icon: FiFileText, title: 'Open the record here', text: 'A SOAP, summary, callback or dental. SmartPaste picks it up on its own. Nothing else to sign in to.' },
            { icon: FiMousePointer, title: 'Paste in your PIMS', text: 'Verified in ezyVet. Click the notes field and Subjective goes into Subjective. Other PIMS may vary, and it only works when that PIMS runs in the browser.' }
        ]
    },
    {
        eyebrow: 'Chrome only',
        title: 'It only runs in Google Chrome',
        body: 'Install it in Chrome on a computer, and open your practice software in that same Chrome. It only works with browser-based PIMS, so a desktop app is out. It does not run in Safari, Firefox, or on your phone.'
    }
];

const SmartPasteAnnouncement = ({ isMobile, onClose }) => {
    const [i, setI] = useState(0);
    const installed = useSmartPasteInstalled({ pollMs: 0 });
    const slide = SLIDES[i];
    const Scene = SCENES[i];
    const last = i === SLIDES.length - 1;
    const canAdd = canInstallSmartPaste() && installed !== true;

    const body = (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22, ease: EASE }}>
                <p className="m-0 mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[#2d5fb8]">{slide.eyebrow}</p>
                <h2 className={`m-0 mb-4 pb-1 font-bold tracking-[-0.03em] leading-tight ${i === 0 ? `${GRADIENT_TEXT} text-[32px] sm:text-[40px]` : 'font-display text-[#13233f] text-[26px] sm:text-[32px]'}`}>{slide.title}</h2>
                {slide.body && <p className="m-0 text-[16px] sm:text-[17px] text-[#1a2b4a]/70 leading-relaxed">{slide.body}</p>}
                {slide.steps && (
                    <div className="space-y-4 mt-1">
                        {slide.steps.map((step) => {
                            const Icon = step.icon;
                            return (
                                <div key={step.title} className="flex items-start gap-3.5">
                                    <span className="w-10 h-10 shrink-0 rounded-2xl bg-[#2d5fb8]/10 text-[#2d5fb8] flex items-center justify-center text-[17px]">
                                        <Icon />
                                    </span>
                                    <div>
                                        <p className="m-0 text-[16px] font-semibold text-[#13233f]">{step.title}</p>
                                        <p className="m-0 mt-0.5 text-[14.5px] text-[#1a2b4a]/65 leading-relaxed">{step.text}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {isMobile && (
                    <div className="mt-5 flex justify-center"><Scene /></div>
                )}
            </motion.div>
        </AnimatePresence>
    );

    const primary = 'inline-flex items-center justify-center gap-1.5 h-12 px-6 rounded-full text-[15px] font-semibold text-white bg-[#2d5fb8] hover:bg-[#2350a3] border-none cursor-pointer shadow-[0_10px_30px_-12px_rgba(45,95,184,0.7)] transition-colors';
    const secondary = 'inline-flex items-center justify-center gap-1.5 h-12 px-5 rounded-full text-[15px] font-semibold text-[#13233f] bg-white border border-[#e7ecf3] hover:bg-[#f6f8fb] cursor-pointer transition-colors';

    const actions = last ? (
        canAdd ? (
            <>
                <button type="button" className={secondary} onClick={onClose}>Not now</button>
                <a href={SMARTPASTE_STORE_URL} target="_blank" rel="noopener noreferrer" onClick={onClose} className={`${primary} no-underline`}>
                    <FiChrome /> Add to Chrome
                </a>
            </>
        ) : (
            <button type="button" className={`${primary} ${isMobile ? 'w-full' : ''}`} onClick={onClose}>
                Got it
            </button>
        )
    ) : (
        <button type="button" className={`${primary} ${isMobile ? 'w-full' : ''}`} onClick={() => setI(i + 1)}>
            {i === 0 ? 'See how it works' : 'Next'} <FiArrowRight />
        </button>
    );

    const dots = (
        <div className="flex items-center gap-1.5">
            {SLIDES.map((s, n) => (
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

    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[9997] flex ${isMobile ? '' : 'items-center justify-center p-6 bg-[#13233f]/45 backdrop-blur-md'}`}
            style={{ fontFamily: 'var(--font-sans)' }}
        >
            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: EASE }}
                className={
                    isMobile
                        ? 'w-full h-full bg-white flex flex-col'
                        : 'w-full max-w-[1040px] h-[min(680px,calc(100vh-48px))] rounded-[32px] bg-white overflow-hidden flex shadow-[0_40px_120px_-40px_rgba(19,35,63,0.6)]'
                }
            >
                {!isMobile && (
                    <div className={`w-[46%] shrink-0 ${BRAND_WASH} flex items-center justify-center p-8 overflow-auto`}>
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={slide.title}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.3, ease: EASE }}
                                className="w-full flex justify-center"
                            >
                                <Scene />
                            </motion.div>
                        </AnimatePresence>
                    </div>
                )}
                <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                    <div className={`flex justify-end ${isMobile ? 'px-4 pt-[max(14px,env(safe-area-inset-top))]' : 'px-6 pt-5'}`}>
                        <button type="button" onClick={onClose} title="Close" className="w-10 h-10 rounded-full flex items-center justify-center text-[#1a2b4a]/50 hover:bg-[#f6f8fb] bg-transparent border-none cursor-pointer text-[20px]">
                            <FiX />
                        </button>
                    </div>
                    <div className={`flex-1 min-h-0 overflow-y-auto ${isMobile ? 'px-6 pb-6' : 'px-10 pb-6 flex flex-col justify-center'}`}>
                        <div className="max-w-[460px]">{body}</div>
                    </div>
                    <div className={isMobile ? 'px-6 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] space-y-4' : 'px-10 py-6 flex items-center justify-between border-t border-[#eef2f7]'}>
                        {isMobile ? (
                            <>
                                <div className="flex justify-center">{dots}</div>
                                <div className="flex flex-col-reverse gap-2 [&_a]:w-full [&_button]:w-full">{actions}</div>
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

export default SmartPasteAnnouncement;
