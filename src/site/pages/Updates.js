import React from 'react';
import SiteLayout from '../SiteLayout';
import { Seo } from '../seo';
import {
    CheckList,
    Container,
    CtaBand,
    Hero,
    HeroPhoto,
    Highlight,
    Reveal
} from '../ui';

const RELEASES = [
    {
        date: 'August 2026',
        tag: 'Plans',
        title: '10 days unlimited, then PetWise Free',
        body: 'Every new account now starts with 10 days of unlimited PetWise, no credit card. When the trial ends you keep PetWise Free with a daily allowance of SOAPs and PetQuery questions.',
        points: ['Unlimited SOAPs and PetQuery for 10 days', 'PetWise Free: 2 SOAPs and 3 questions a day', 'Upgrade any time from your profile']
    },
    {
        date: '2026',
        tag: 'Major update',
        title: 'Smarter, faster, more accurate records',
        body: 'We upgraded the intelligence behind PetWise. Records are generated with deeper clinical understanding across SOAP, Summary and Callback.',
        points: ['Catches more nuance, medications and clinical detail', 'Noticeably faster generation', 'Better terminology and fewer corrections']
    },
    {
        date: '2026',
        tag: 'Workspace',
        title: 'Redesigned QuickSOAP workspace',
        body: 'Dictation controls moved to a dedicated top bar above your record, giving you a wider editing area and a cleaner flow.',
        points: ['Full width SOAP sections', 'Dictations, notes and controls in one place', 'Regenerate with extra context in one click']
    },
    {
        date: 'January 2026',
        tag: 'New features',
        title: 'Callback Notes and Clinical Summaries',
        body: 'Two new record types in QuickSOAP. Callback Notes document client phone conversations and next steps. Clinical Summaries create clear, organized summaries with treatments, medications and vaccines laid out.',
        points: ['Choose SOAP, Summary or Callback before recording', 'Each appears as a single editable field', 'Works on phone and desktop']
    },
    {
        date: 'November 2025',
        tag: 'New feature',
        title: 'QuickSOAP: voice powered SOAP notes',
        body: 'Create complete SOAP reports with your voice. Record on your phone or desktop, and your dictations sync instantly to your dashboard for review.',
        points: ['Speak naturally, PetWise handles formatting', 'Phone to desktop sync', 'Trained for veterinary language and abbreviations']
    },
    {
        date: '2025',
        tag: 'PetSOAP 2.0',
        title: 'Smarter client facing output',
        body: 'PetSOAP gained dedicated Diagnosis, Treatment, Client Communications and Notes sections, with client content placed on its own page of the PDF for easy printing or emailing.',
        points: ['Treatment plans respect what you enter', 'Client handouts written for pet owners', 'Cleaner, more professional PDFs']
    }
];

const Updates = () => (
    <SiteLayout>
        <Seo
            title="Product Updates | What’s New in PetWise"
            description="The latest PetWise releases: QuickSOAP voice dictation, Callback Notes, Clinical Summaries, faster and more accurate records, and the 10 day unlimited trial."
            path="/updates"
        />
        <Hero
            eyebrow="Updates"
            title={
                <>
                    What’s new in <Highlight>PetWise.</Highlight>
                </>
            }
            body="We ship improvements every month, most of them straight from vet feedback."
            media={<HeroPhoto src="/site/working-laptop.jpg" alt="A man smiling while working on his laptop" className="object-[50%_35%]" />}
        />
        <section className="bg-white">
            <Container className="pb-24 sm:pb-32">
                <ol className="space-y-16">
                    {RELEASES.map((r) => (
                        <Reveal as="li" key={r.title} className="grid lg:grid-cols-12 gap-6 lg:gap-10">
                            <div className="lg:col-span-3">
                                <p className="text-[15px] font-medium text-[#13233f]">{r.date}</p>
                                <p className="mt-1 text-[13px] text-[#3468bd]">{r.tag}</p>
                            </div>
                            <div className="lg:col-span-8 lg:border-l lg:border-[#13233f]/10 lg:pl-10">
                                <h2 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-[#13233f]">{r.title}</h2>
                                <p className="mt-4 text-[17px] leading-relaxed text-[#1a2b4a]/65">{r.body}</p>
                                <div className="mt-6">
                                    <CheckList items={r.points} />
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </ol>
            </Container>
        </section>
        <CtaBand />
    </SiteLayout>
);

export default Updates;
