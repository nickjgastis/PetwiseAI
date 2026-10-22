import React from 'react';
import { FiBookOpen, FiCopy, FiDownload } from 'react-icons/fi';

const SECTIONS = [
    {
        name: 'Subjective',
        header: 'bg-gradient-to-r from-blue-500 to-blue-600',
        border: '#3b82f6',
        bg: 'bg-blue-50',
        content: 'Bella, 7 yo FS Labrador retriever, 32 kg. Presented for vomiting x4 overnight, last episode this morning. Still eating small amounts.'
    },
    {
        name: 'Objective',
        header: 'bg-gradient-to-r from-emerald-500 to-emerald-600',
        border: '#10b981',
        bg: 'bg-emerald-50',
        content: 'T 101.8 °F, HR 110 bpm, RR 28. BCS 6/9. Abdomen soft with mild cranial abdominal discomfort on palpation.'
    },
    {
        name: 'Assessment',
        header: 'bg-gradient-to-r from-amber-500 to-amber-600',
        border: '#f59e0b',
        bg: 'bg-amber-50',
        content: 'Acute gastroenteritis. R/O dietary indiscretion, foreign body, pancreatitis.'
    },
    {
        name: 'Plan',
        header: 'bg-gradient-to-r from-red-500 to-red-600',
        border: '#ef4444',
        bg: 'bg-red-50',
        content: 'Maropitant (Cerenia) 1 mg/kg SQ. LRS 250 mL SQ. Bland diet for 3 to 5 days. Recheck if not improving within 24 hours.'
    }
];

export const SoapNote = ({ compact = false }) => (
    <div className="rounded-[28px] bg-gradient-to-br from-[#e9f6fd] to-[#f6f8fb] p-3 sm:p-5">
        <div className="rounded-[18px] bg-white overflow-hidden shadow-[0_30px_60px_-30px_rgba(19,35,63,0.35)] ring-1 ring-black/5">
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-100">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                <span className="ml-3 text-[11px] text-gray-400">petwise.vet</span>
            </div>
            <div className="px-4 sm:px-5 pt-4 pb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[#13233f] truncate">Bella · SOAP</p>
                    <p className="text-[11px] tracking-[0.08em] uppercase text-gray-400">Generated from your dictation</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0" aria-hidden>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3468bd] text-white text-[11px] font-semibold px-3 py-1.5">
                        <FiCopy /> Copy all
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-gray-200 text-gray-500 text-[11px] font-semibold px-3 py-1.5">
                        <FiDownload /> PDF
                    </span>
                </div>
            </div>
            <div className="mx-4 sm:mx-5 mb-4 sm:mb-5 rounded-2xl overflow-hidden border border-gray-100">
                {SECTIONS.map((s, i) => (
                    <div key={s.name} className={i < SECTIONS.length - 1 ? 'border-b border-gray-100' : ''}>
                        <div className={`${s.header} px-4 py-2.5 flex items-center gap-2.5`} style={{ borderLeft: `3px solid ${s.border}` }}>
                            <span className="w-5 h-5 rounded-md flex items-center justify-center text-white font-bold text-[11px] bg-white/20">{s.name[0]}</span>
                            <span className="text-white font-semibold uppercase text-[11px] tracking-[0.08em]">{s.name}</span>
                        </div>
                        <div className={`${s.bg} px-4 py-2.5`}>
                            <p className={`text-gray-800 leading-relaxed ${compact ? 'text-[12px]' : 'text-[13px]'}`}>{s.content}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const ANSWER = [
    { header: 'Mild signs', body: 'Vomiting, diarrhea and polydipsia from about 20 mg/kg theobromine and caffeine combined.' },
    { header: 'Cardiac signs', body: 'Tachycardia and arrhythmias are expected from 40 to 50 mg/kg.' },
    { header: 'Seizures', body: 'Possible at 60 mg/kg and above.' },
    { header: 'Decontamination', body: 'Induce emesis if ingestion was recent and the patient is asymptomatic, then activated charcoal with repeat doses.' }
];

const REFERENCES = [
    'Merck Veterinary Manual: Chocolate Toxicosis in Animals',
    'Blackwell’s Five-Minute Veterinary Consult: Chocolate (Methylxanthine) Toxicosis'
];

export const PetQueryAnswer = () => (
    <div className="rounded-[28px] bg-gradient-to-br from-[#e9f6fd] to-[#f6f8fb] p-3 sm:p-5">
        <div className="rounded-[18px] bg-white overflow-hidden shadow-[0_30px_60px_-30px_rgba(19,35,63,0.35)] ring-1 ring-black/5 p-4 sm:p-6">
            <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-[#3468bd] text-white text-[13px] leading-relaxed px-4 py-2.5">
                    Chocolate toxicity thresholds in dogs and when to decontaminate?
                </p>
            </div>
            <div className="mt-5 text-[13px] leading-relaxed text-gray-800">
                <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#3468bd]">PetQuery</p>
                <ol className="mt-3 space-y-2.5">
                    {ANSWER.map((a, i) => (
                        <li key={a.header} className="flex gap-2">
                            <span className="w-4 shrink-0 text-right font-bold text-[#3468bd]">{i + 1}.</span>
                            <span>
                                <span className="font-semibold text-gray-900">{a.header}:</span> {a.body}
                            </span>
                        </li>
                    ))}
                </ol>
                <div className="mt-5 rounded-xl border border-gray-100 bg-[#f6f8fb] p-3.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase text-gray-500">
                        <FiBookOpen aria-hidden /> References
                    </p>
                    <ul className="mt-2 space-y-1.5">
                        {REFERENCES.map((r, i) => (
                            <li key={r} className="flex gap-2 text-[12px] text-gray-600">
                                <span className="w-5 h-5 shrink-0 rounded-md bg-white border border-gray-200 text-[10px] font-semibold text-[#3468bd] flex items-center justify-center">{i + 1}</span>
                                <span>{r}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    </div>
);
