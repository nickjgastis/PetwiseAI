import React from 'react';
import { FiArrowUpRight, FiCheck, FiPlus } from 'react-icons/fi';
import SiteLayout from '../SiteLayout';
import { Seo } from '../seo';
import { Container, CtaBand, Highlight, Reveal } from '../ui';

const KINDS = {
    new: { label: 'New', className: 'bg-[#e6f6ec] text-[#1f7a43]', Icon: FiPlus },
    improved: { label: 'Improved', className: 'bg-[#e8f0fc] text-[#2d5fb8]', Icon: FiArrowUpRight },
    plans: { label: 'Plans', className: 'bg-[#fdf1e3] text-[#a35a12]', Icon: FiCheck }
};

const RELEASES = [
    {
        date: 'October 2026',
        kind: 'new',
        title: 'Cases and dental charting',
        body: 'Start a new case, pick a record type and dictate. Every SOAP, summary, callback and dental record for that patient now stays together in its case, on your phone and your desktop.',
        points: [
            'New case replaces QuickSOAP',
            'Dental records: dictate the exam and get a fully charted mouth',
            'Add more records to a case any time',
            'Copy every record in a case at once',
            'Dictate from your phone into the case you have open'
        ]
    },
    {
        date: 'August 2026',
        kind: 'plans',
        title: '10 days unlimited, then PetWise Free',
        body: 'Every new account now starts with 10 days of unlimited PetWise, no credit card. When the trial ends you keep PetWise Free with a daily allowance of SOAPs and PetQuery questions.',
        points: ['Unlimited SOAPs and PetQuery for 10 days', 'PetWise Free: 2 SOAPs and 3 questions a day', 'Upgrade any time from your profile']
    },
    {
        date: '2026',
        kind: 'improved',
        title: 'Smarter, faster, more accurate records',
        body: 'We upgraded the intelligence behind PetWise. Records are generated with deeper clinical understanding across SOAP, Summary and Callback.',
        points: ['Catches more nuance, medications and clinical detail', 'Noticeably faster generation', 'Better terminology and fewer corrections']
    },
    {
        date: '2026',
        kind: 'improved',
        title: 'Redesigned dictation workspace',
        body: 'Dictation controls moved to a dedicated top bar above your record, giving you a wider editing area and a cleaner flow.',
        points: ['Full width SOAP sections', 'Dictations, notes and controls in one place', 'Regenerate with extra context in one click']
    },
    {
        date: 'January 2026',
        kind: 'new',
        title: 'Callback Notes and Clinical Summaries',
        body: 'Two new record types. Callback Notes document client phone conversations and next steps. Clinical Summaries create clear, organized summaries with treatments, medications and vaccines laid out.',
        points: ['Choose SOAP, Summary or Callback before recording', 'Each appears as a single editable field', 'Works on phone and desktop']
    },
    {
        date: 'November 2025',
        kind: 'new',
        title: 'Voice powered SOAP notes',
        body: 'Create complete SOAP reports with your voice. Record on your phone or desktop, and your dictations sync instantly to your dashboard for review.',
        points: ['Speak naturally, PetWise handles formatting', 'Phone to desktop sync', 'Trained for veterinary language and abbreviations']
    },
    {
        date: '2025',
        kind: 'improved',
        title: 'PetSOAP 2.0: smarter client facing output',
        body: 'PetSOAP gained dedicated Diagnosis, Treatment, Client Communications and Notes sections, with client content placed on its own page of the PDF for easy printing or emailing.',
        points: ['Treatment plans respect what you enter', 'Client handouts written for pet owners', 'Cleaner, more professional PDFs']
    }
];

const Release = ({ release, latest }) => {
    const kind = KINDS[release.kind];
    return (
        <Reveal as="li" className="relative pl-8 sm:pl-12">
            <span
                aria-hidden
                className={`absolute left-0 top-7 -translate-x-1/2 rounded-full ring-4 ring-white ${
                    latest ? 'w-3.5 h-3.5 bg-[#2d5fb8] shadow-[0_0_0_6px_rgba(45,95,184,0.15)]' : 'w-2.5 h-2.5 bg-[#c9d6ea]'
                }`}
            />
            <article
                className={`rounded-[24px] bg-white p-6 sm:p-8 border ${
                    latest ? 'border-[#2d5fb8]/25 shadow-[0_18px_50px_-24px_rgba(45,95,184,0.45)]' : 'border-[#e7ecf3]'
                }`}
            >
                <div className="flex flex-wrap items-center gap-2.5">
                    <span className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[12px] font-semibold ${kind.className}`}>
                        <kind.Icon className="text-[12px]" /> {kind.label}
                    </span>
                    {latest && (
                        <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[12px] font-semibold bg-[#2d5fb8] text-white">
                            Latest
                        </span>
                    )}
                    <time className="ml-auto text-[13px] font-medium text-[#1a2b4a]/50">{release.date}</time>
                </div>
                <h2 className="mt-4 text-[1.35rem] sm:text-[1.55rem] leading-tight font-semibold tracking-[-0.02em] text-[#13233f]">
                    {release.title}
                </h2>
                <p className="mt-3 text-[16px] leading-relaxed text-[#1a2b4a]/65">{release.body}</p>
                <ul className="mt-5 pt-5 border-t border-[#eef2f7] space-y-2.5">
                    {release.points.map((p) => (
                        <li key={p} className="flex items-start gap-3 text-[15px] leading-snug text-[#13233f]/85">
                            <span className="mt-[3px] flex-shrink-0 w-[18px] h-[18px] rounded-full bg-[#e8f0fc] text-[#2d5fb8] flex items-center justify-center">
                                <FiCheck className="text-[11px]" strokeWidth={3} />
                            </span>
                            {p}
                        </li>
                    ))}
                </ul>
            </article>
        </Reveal>
    );
};

const Updates = () => (
    <SiteLayout>
        <Seo
            title="Product Updates | What’s New in PetWise"
            description="The latest PetWise releases: cases, dental charting, record types, voice dictation, faster and more accurate records, and the 10 day unlimited trial."
            path="/updates"
        />
        <section className="relative bg-white overflow-hidden">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_45%_at_50%_0%,#e2edfc_0%,rgba(255,255,255,0)_70%)]" />
            <Container className="relative pt-10 sm:pt-16 pb-12 sm:pb-16">
                <div className="max-w-2xl mx-auto text-center">
                    <p className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#2d5fb8]">Changelog</p>
                    <h1 className="mt-3 text-[2.5rem] sm:text-[3.5rem] leading-[1.03] font-semibold tracking-[-0.04em] text-[#13233f]">
                        What’s new in <Highlight dark>PetWise.</Highlight>
                    </h1>
                    <p className="mt-4 text-lg text-[#1a2b4a]/65 text-balance">
                        We ship improvements every month, most of them straight from vet feedback.
                    </p>
                </div>
            </Container>
        </section>
        <section className="bg-white">
            <Container className="pb-24 sm:pb-32">
                <ol className="relative max-w-3xl mx-auto ml-1.5 sm:mx-auto space-y-6 sm:space-y-8 border-l border-[#e3eaf4]">
                    {RELEASES.map((r, i) => (
                        <Release key={r.title} release={r} latest={i === 0} />
                    ))}
                </ol>
            </Container>
        </section>
        <CtaBand />
    </SiteLayout>
);

export default Updates;
