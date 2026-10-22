import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    FiArrowLeft,
    FiArrowRight,
    FiCheck,
    FiCopy,
    FiEdit3,
    FiFolder,
    FiMessageCircle,
    FiMic,
    FiMonitor,
    FiPlus,
    FiSearch,
    FiSend,
    FiSmartphone,
    FiX,
    FiZap
} from 'react-icons/fi';
import { TYPE_STYLES, GRADIENT_TEXT } from './caseStyles';

const EASE = [0.2, 0.7, 0.2, 1];

export const NAME_SCRIPT = [
    'This is Bella, a 6 year old spayed female Labrador, 28 kilos.',
    'Owner says she has been vomiting for two days and eating less.',
    'Temp 39.4, heart rate 120, mild pain on cranial abdomen.',
    'Plan: maropitant 1 mg per kg subQ once daily for 3 days, bland diet, recheck Friday.'
];

export const SPEAK_TIPS = [
    { title: 'Say the name first', text: 'Name, species, age, sex and weight. The name is what labels the case.' },
    { title: 'Talk like you would to a colleague', text: 'Normal pace, full sentences. No need to say "subjective" or "objective".' },
    { title: 'Give doses in full', text: 'Drug, dose with units, route, how often and for how long.' },
    { title: 'Say "correction" to fix something', text: '"Correction, temp was 38.4." The new value replaces the old one.' },
    { title: 'Pause instead of going quiet', text: 'Stepping away? Tap Pause, then Resume.' }
];

export const GUIDES = {
    records: {
        title: 'Make a record',
        steps: [
            {
                icon: FiFolder,
                title: 'Every visit is a case',
                body: 'A case holds everything for one patient visit: the exam SOAP, the discharge summary, the callback the next day.',
                points: [
                    { title: 'New case', text: 'In the sidebar. Gives you a fresh page to dictate into.' },
                    { title: 'Cases', text: 'Every patient you have seen, newest first.' }
                ]
            },
            {
                icon: FiEdit3,
                title: 'Pick a record type',
                body: 'Choose it before you dictate. You can add the other types to the same case later.',
                types: true
            },
            {
                icon: FiMic,
                title: 'Say the patient\u2019s name first',
                body: 'Open every dictation with the name and signalment, then talk through the visit.',
                script: NAME_SCRIPT
            },
            {
                icon: FiMessageCircle,
                title: 'How to talk to it',
                tips: SPEAK_TIPS
            },
            {
                icon: FiZap,
                title: 'Dictate, then generate',
                numbered: [
                    'Tap the mic and talk.',
                    'Tap Done. Use Add more for anything you forgot.',
                    'Hit Generate. The record opens ready to edit and is already saved to the case.'
                ],
                note: 'Rather type? Use "Or type and paste notes instead" under the mic.'
            },
            {
                icon: FiCopy,
                title: 'Edit and copy it out',
                points: [
                    { title: 'Edit', text: 'Click into any section and type, then hit Save. If you leave with unsaved edits, PetWise asks first.' },
                    { title: 'Copy', text: 'Copy one section, or Copy all, and paste into your practice software.' },
                    { title: 'Back', text: 'Takes you to the case with all its records.' }
                ]
            }
        ]
    },
    cases: {
        title: 'Manage cases',
        steps: [
            {
                icon: FiSearch,
                title: 'Find a patient',
                body: 'Cases lists every patient, grouped by day.',
                points: [
                    { title: 'Search', text: 'Type the pet name in Find a patient.' },
                    { title: 'Blue dot', text: 'A record just arrived from your phone and you have not opened it yet.' }
                ]
            },
            {
                icon: FiFolder,
                title: 'Inside a case',
                body: 'Each record shows its type, a title and a one line summary, so you can tell them apart at a glance.',
                points: [
                    { title: 'Open a record', text: 'Click it to edit or copy.' },
                    { title: 'Rename', text: 'Click the pencil next to the patient name.' }
                ]
            },
            {
                icon: FiPlus,
                title: 'Add to a case',
                numbered: [
                    'Open the case and click Add a record.',
                    'Pick SOAP, Summary or Callback.',
                    'Dictate or type, then Create. It opens straight in the editor.'
                ],
                note: 'Tick "Include earlier dictation" to build on what you already said for this patient.'
            }
        ]
    },
    phone: {
        title: 'PetWise on your phone',
        steps: [
            {
                icon: FiSmartphone,
                title: 'Add PetWise to your home screen',
                install: true
            },
            {
                icon: FiMic,
                title: 'Dictate in the exam room',
                numbered: [
                    'Tap New case, or open the patient from Cases to add to their case.',
                    'Pick the record type.',
                    'Tap the mic and say the patient\u2019s name first.',
                    'Tap Done. Add more if you need to.'
                ],
                script: NAME_SCRIPT.slice(0, 2)
            },
            {
                icon: FiSend,
                title: 'Send it to your desktop',
                body: 'Tap Send to desktop. Keep PetWise open on your computer and it writes the record into the case you dictated in.',
                points: [
                    { title: 'Blue dot', text: 'New phone records are marked in Cases until you open them.' },
                    { title: 'Next patient', text: 'Tap Start the next case so it does not go into the last one.' },
                    { title: 'Same patient', text: 'Tap Add another record to this case, or open the patient from Cases first, e.g. for the callback later.' }
                ]
            },
            {
                icon: FiMessageCircle,
                title: 'How to talk to it',
                tips: SPEAK_TIPS
            }
        ]
    },
    petquery: {
        title: 'Use PetQuery',
        steps: [
            {
                icon: FiMessageCircle,
                title: 'Ask it like a specialist',
                body: 'Doses, differentials, protocols, workups. Ask in plain language.',
                examples: [
                    'Maropitant dose for a 4 kg cat with nausea?',
                    'Top differentials for acute vestibular signs in an older dog?',
                    'Fluid plan for a 20 kg dog, 8% dehydrated, PCV 52?'
                ]
            },
            {
                icon: FiEdit3,
                title: 'Give it the details',
                body: 'Species, weight, age and anything relevant like kidney disease or current meds. The more it knows, the more specific the answer.',
                compare: {
                    bad: 'Dose for gabapentin?',
                    good: 'Gabapentin dose for a 5 kg cat with CKD stage 2, for vet visit anxiety?'
                }
            },
            {
                icon: FiZap,
                title: 'Short or long',
                points: [
                    { title: 'Short answer', text: 'The quick answer. Good for a dose or a yes/no.' },
                    { title: 'Long answer', text: 'The full protocol, with monitoring and notes.' }
                ]
            },
            {
                icon: FiCheck,
                title: 'Follow up and check',
                points: [
                    { title: 'Follow up', text: 'Keep asking in the same chat. It remembers the patient.' },
                    { title: 'Copy or check sources', text: 'Buttons sit under each answer.' },
                    { title: 'New chat', text: 'Start fresh for the next patient.' }
                ],
                note: 'Always confirm doses with your own judgment before treating.'
            }
        ]
    }
};

const TypeCards = () => {
    const blurbs = {
        soap: 'The full exam: subjective, objective, assessment and plan.',
        summary: 'Discharge notes, referrals and case histories.',
        callback: 'A phone call with the owner: what they said and what you advised.'
    };
    return (
        <div className="grid gap-3">
            {Object.entries(TYPE_STYLES).map(([key, t]) => {
                const Icon = t.icon;
                return (
                    <div key={key} className="flex items-start gap-4 rounded-[20px] bg-white border border-[#e7ecf3] p-4">
                        <span className={`w-11 h-11 shrink-0 rounded-2xl ${t.solid} text-white flex items-center justify-center text-[18px]`}>
                            <Icon />
                        </span>
                        <div>
                            <p className="m-0 text-[16px] font-semibold text-[#13233f]">{t.label}</p>
                            <p className="m-0 mt-0.5 text-[14.5px] text-[#1a2b4a]/65 leading-relaxed">{blurbs[key]}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const Script = ({ lines }) => (
    <div className="rounded-[22px] bg-[#13233f] text-white p-5 sm:p-6">
        <p className="m-0 mb-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#5cccf0]">
            <FiMic /> Example dictation
        </p>
        <div className="space-y-2">
            {lines.map((l, i) => (
                <p key={i} className={`m-0 text-[15px] sm:text-[16px] leading-relaxed ${i === 0 ? 'text-white font-medium' : 'text-white/75'}`}>
                    {i === 0 ? <span className="bg-[#5cccf0]/20 rounded px-1 -mx-1">{l}</span> : l}
                </p>
            ))}
        </div>
    </div>
);

const Install = () => (
    <div className="grid sm:grid-cols-[180px_1fr] gap-6 items-start">
        <div className="hidden sm:flex flex-col items-center text-center">
            <img src="/PW QR CODE.png" alt="Scan to open PetWise" className="w-[180px] h-[180px] rounded-[20px] border border-[#e7ecf3] bg-white p-2" />
            <p className="m-0 mt-2 text-[12.5px] text-[#1a2b4a]/55">Scan with your phone camera</p>
        </div>
        <div className="space-y-4">
            <p className="m-0 text-[15px] text-[#1a2b4a]/75 leading-relaxed">
                Open <span className="font-semibold text-[#2d5fb8]">petwise.vet</span> on your phone and log in. Then add it to your home screen so it opens like an app.
            </p>
            {[
                { label: 'iPhone', steps: ['Open petwise.vet in Safari', 'Tap the Share button', 'Tap Add to Home Screen'] },
                { label: 'Android', steps: ['Open petwise.vet in Chrome', 'Tap the \u22EE menu', 'Tap Install app or Add to Home screen'] }
            ].map((p) => (
                <div key={p.label} className="rounded-[20px] bg-white border border-[#e7ecf3] p-4">
                    <p className="m-0 mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-[#2d5fb8]">{p.label}</p>
                    <ol className="m-0 pl-0 list-none space-y-1.5">
                        {p.steps.map((s, i) => (
                            <li key={i} className="flex gap-2.5 text-[15px] text-[#13233f]">
                                <span className="w-5 h-5 mt-0.5 shrink-0 rounded-full bg-[#2d5fb8]/10 text-[#2d5fb8] text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                                {s}
                            </li>
                        ))}
                    </ol>
                </div>
            ))}
        </div>
    </div>
);

export const StepBody = ({ step }) => (
    <div className="space-y-5">
        {step.body && <p className="m-0 text-[16px] sm:text-[17px] text-[#1a2b4a]/75 leading-relaxed">{step.body}</p>}
        {step.types && <TypeCards />}
        {step.install && <Install />}
        {step.numbered && (
            <ol className="m-0 pl-0 list-none space-y-3">
                {step.numbered.map((s, i) => (
                    <li key={i} className="flex items-start gap-3.5 text-[16px] text-[#13233f] leading-relaxed">
                        <span className="w-7 h-7 shrink-0 rounded-full bg-[#2d5fb8] text-white text-[13px] font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="pt-0.5">{s}</span>
                    </li>
                ))}
            </ol>
        )}
        {step.script && <Script lines={step.script} />}
        {step.points && (
            <div className="grid gap-3">
                {step.points.map((p) => (
                    <div key={p.title} className="rounded-[20px] bg-white border border-[#e7ecf3] px-5 py-4">
                        <p className="m-0 text-[15.5px] font-semibold text-[#13233f]">{p.title}</p>
                        <p className="m-0 mt-0.5 text-[14.5px] text-[#1a2b4a]/65 leading-relaxed">{p.text}</p>
                    </div>
                ))}
            </div>
        )}
        {step.tips && (
            <div className="grid gap-2.5">
                {step.tips.map((p) => (
                    <div key={p.title} className="flex items-start gap-3 rounded-[18px] bg-white border border-[#e7ecf3] px-4 py-3.5">
                        <span className="w-6 h-6 mt-0.5 shrink-0 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[13px]"><FiCheck /></span>
                        <div>
                            <p className="m-0 text-[15px] font-semibold text-[#13233f]">{p.title}</p>
                            <p className="m-0 mt-0.5 text-[14px] text-[#1a2b4a]/65 leading-relaxed">{p.text}</p>
                        </div>
                    </div>
                ))}
            </div>
        )}
        {step.examples && (
            <div className="grid gap-2.5">
                {step.examples.map((e) => (
                    <div key={e} className="self-start max-w-full rounded-[20px] rounded-br-md bg-[#2d5fb8] text-white px-4 py-3 text-[15px] leading-relaxed ml-auto">
                        {e}
                    </div>
                ))}
            </div>
        )}
        {step.compare && (
            <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-[20px] bg-white border border-[#e7ecf3] p-4">
                    <p className="m-0 mb-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#1a2b4a]/40">Vague</p>
                    <p className="m-0 text-[15px] text-[#1a2b4a]/70">{step.compare.bad}</p>
                </div>
                <div className="rounded-[20px] bg-white border border-[#2d5fb8]/30 p-4 shadow-[0_12px_30px_-22px_rgba(45,95,184,0.6)]">
                    <p className="m-0 mb-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#2d5fb8]">Better</p>
                    <p className="m-0 text-[15px] text-[#13233f]">{step.compare.good}</p>
                </div>
            </div>
        )}
        {step.note && (
            <p className="m-0 text-[14.5px] text-[#1a2b4a]/65 leading-relaxed pl-3.5 border-l-2 border-[#2d5fb8]/30">{step.note}</p>
        )}
    </div>
);

const Guide = ({ id, onClose }) => {
    const guide = GUIDES[id];
    const [step, setStep] = useState(0);
    const [mobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
    const left = mobile ? 0 : Math.max(0, document.querySelector('main')?.getBoundingClientRect().left || 0);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') setStep((s) => Math.min(s + 1, guide.steps.length - 1));
            if (e.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, 0));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [guide, onClose]);

    if (!guide) return null;
    const current = guide.steps[step];
    const Icon = current.icon;
    const last = step === guide.steps.length - 1;

    const nav = (
        <div className="flex items-center gap-2">
            {step > 0 && (
                <button type="button" onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full text-[14.5px] font-semibold text-[#13233f] bg-white border border-[#e7ecf3] hover:bg-[#f6f8fb] cursor-pointer transition-colors">
                    <FiArrowLeft /> Back
                </button>
            )}
            <button
                type="button"
                onClick={() => (last ? onClose() : setStep(step + 1))}
                className="inline-flex items-center gap-1.5 h-11 px-6 rounded-full text-[14.5px] font-semibold text-white bg-[#2d5fb8] hover:bg-[#2350a3] border-none cursor-pointer shadow-[0_10px_30px_-12px_rgba(45,95,184,0.7)] transition-colors"
            >
                {last ? 'Done' : <>Next <FiArrowRight /></>}
            </button>
        </div>
    );

    const content = (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22, ease: EASE }}>
                <span className="inline-flex w-14 h-14 rounded-[18px] text-white items-center justify-center text-[24px] mb-5 shadow-[0_14px_30px_-14px_rgba(45,95,184,0.8)]" style={{ background: 'linear-gradient(160deg,#3f7ad6 0%,#2d5fb8 45%,#2350a3 100%)' }}>
                    <Icon />
                </span>
                <p className="m-0 mb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[#1a2b4a]/40">
                    Step {step + 1} of {guide.steps.length}
                </p>
                <h2 className="m-0 mb-5 text-[26px] sm:text-[32px] font-bold tracking-[-0.02em] text-[#13233f] leading-tight">{current.title}</h2>
                <StepBody step={current} />
            </motion.div>
        </AnimatePresence>
    );

    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[130] flex ${mobile ? '' : 'items-center justify-center p-6 bg-[#13233f]/35 backdrop-blur-sm'}`}
            style={{ left }}
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.3, ease: EASE }}
                onClick={(e) => e.stopPropagation()}
                className={
                    mobile
                        ? 'w-full h-full bg-gradient-to-b from-[#f3f7fd] to-white flex flex-col'
                        : 'w-full max-w-[1120px] h-[min(780px,calc(100vh-48px))] rounded-[32px] bg-white overflow-hidden flex shadow-[0_40px_120px_-40px_rgba(19,35,63,0.55)]'
                }
                style={{ fontFamily: "var(--font-sans)" }}
            >
                {!mobile && (
                    <aside className="w-[300px] shrink-0 bg-gradient-to-b from-[#f3f7fd] to-[#e9f1fc] border-r border-[#2d5fb8]/10 p-7 flex flex-col">
                        <p className={`m-0 text-[22px] font-bold tracking-[-0.02em] ${GRADIENT_TEXT}`}>{guide.title}</p>
                        <p className="m-0 mt-1 mb-7 text-[13.5px] text-[#1a2b4a]/55">{guide.steps.length} quick steps</p>
                        <div className="space-y-1">
                            {guide.steps.map((s, i) => (
                                <button
                                    key={s.title}
                                    type="button"
                                    onClick={() => setStep(i)}
                                    className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-2xl border-none cursor-pointer transition-colors ${i === step ? 'bg-white shadow-sm' : 'bg-transparent hover:bg-white/60'}`}
                                >
                                    <span
                                        className={`w-6 h-6 shrink-0 rounded-full text-[11.5px] font-bold flex items-center justify-center ${i < step ? 'bg-[#2d5fb8] text-white' : i === step ? 'bg-[#2d5fb8]/[0.12] text-[#2d5fb8]' : 'bg-white text-[#1a2b4a]/40'}`}
                                    >
                                        {i < step ? <FiCheck /> : i + 1}
                                    </span>
                                    <span className={`text-[14px] leading-snug ${i === step ? 'font-semibold text-[#13233f]' : 'text-[#1a2b4a]/60'}`}>{s.title}</span>
                                </button>
                            ))}
                        </div>
                    </aside>
                )}
                <div className="flex-1 min-w-0 flex flex-col">
                    <div className={`flex items-center ${mobile ? 'justify-between px-5 pt-[max(16px,env(safe-area-inset-top))] pb-2' : 'justify-end px-6 pt-5'}`}>
                        {mobile && <p className={`m-0 text-[18px] font-bold tracking-[-0.02em] ${GRADIENT_TEXT}`}>{guide.title}</p>}
                        <button type="button" onClick={onClose} title="Close" className="w-10 h-10 rounded-full flex items-center justify-center text-[#1a2b4a]/50 hover:bg-[#f6f8fb] bg-transparent border-none cursor-pointer text-[20px]">
                            <FiX />
                        </button>
                    </div>
                    <div className={`flex-1 min-h-0 overflow-y-auto ${mobile ? 'px-5 pb-6' : 'px-12 pb-8'}`}>
                        <div className="max-w-[640px]">{content}</div>
                    </div>
                    <div className={`flex items-center justify-between border-t border-[#eef2f7] ${mobile ? 'px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-white' : 'px-12 py-5'}`}>
                        <div className="flex items-center gap-1.5">
                            {guide.steps.map((s, i) => (
                                <span key={s.title} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-[#2d5fb8]' : 'w-1.5 bg-[#1a2b4a]/15'}`} />
                            ))}
                        </div>
                        {nav}
                    </div>
                </div>
            </motion.div>
        </motion.div>,
        document.body
    );
};

export const GUIDE_ICONS = { records: FiMic, cases: FiFolder, petquery: FiMessageCircle, phone: FiSmartphone, desktop: FiMonitor };

export default Guide;
