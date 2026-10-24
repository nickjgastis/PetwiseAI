import React from 'react';
import { FiDownload, FiLayers, FiSmartphone, FiUsers, FiZap } from 'react-icons/fi';
import { FaClipboardList, FaFileAlt, FaPhoneAlt } from 'react-icons/fa';
import { PiTooth } from 'react-icons/pi';
import SiteLayout from '../SiteLayout';
import { DentalSection } from '../DentalDemo';
import DictationDemo from '../DictationDemo';
import { CaseCard, PetQueryAnswer } from '../demos';
import { Seo, softwareLd } from '../seo';
import { ButtonLink, Container, CtaBand, FeatureGrid, Highlight, ImageBand, Reveal, Section, SectionHeading, SignupButton, SplitFeature } from '../ui';

const RECORD_TYPES = [
    {
        label: 'SOAP',
        icon: FaClipboardList,
        pill: 'from-blue-400 to-blue-500 shadow-blue-500/30',
        ring: 'hover:border-blue-200',
        body: 'The full medical record. Subjective, objective, assessment and plan, from the appointment or your dictation.'
    },
    {
        label: 'Summary',
        icon: FaFileAlt,
        pill: 'from-emerald-400 to-emerald-500 shadow-emerald-500/30',
        ring: 'hover:border-emerald-200',
        body: 'A clear write up for the client or the referral: treatments, medications, vaccines and home care.'
    },
    {
        label: 'Callback',
        icon: FaPhoneAlt,
        pill: 'from-amber-400 to-amber-500 shadow-amber-500/30',
        ring: 'hover:border-amber-200',
        body: 'Talk through the follow up call. PetWise records what was discussed, what you advised and what comes next.'
    },
    {
        label: 'Dental',
        icon: PiTooth,
        pill: 'from-violet-400 to-violet-500 shadow-violet-500/30',
        ring: 'hover:border-violet-200',
        body: 'Dictate the dental and every tooth is charted, dog or cat, with the record and a PDF ready to go.',
        isNew: true
    }
];

const EVERYTHING_ELSE = [
    { icon: FiLayers, title: 'Templates', body: 'Save your preferred sections and phrasing. PetWise follows them on every record.' },
    { icon: FiUsers, title: 'Client communication', body: 'Plain language handouts, side effects and home care notes for pet owners.' },
    { icon: FiDownload, title: 'Copy or PDF', body: 'Paste into any PIMS, copy a whole case at once, or export a clean PDF.' },
    { icon: FiZap, title: 'PetSOAP', body: 'Fill in a few exam fields and generate a full record with diagnosis and treatment plan.' },
    { icon: FiSmartphone, title: 'Installs on your phone', body: 'Add PetWise to your home screen. No app store needed.', to: '/install' }
];

const RecordTypeCard = ({ label, icon: Icon, pill, ring, body, isNew, i }) => (
    <Reveal delay={i * 70} className="h-full">
        <div className={`h-full rounded-[28px] border border-[#e7ecf3] bg-white p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgba(19,35,63,0.25)] ${ring}`}>
            <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-[15px] font-semibold text-white bg-gradient-to-b shadow-[0_8px_18px_-8px] ${pill}`}>
                    <Icon className="text-[14px]" />
                    {label}
                </span>
                {isNew && <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-600">New</span>}
            </div>
            <p className="mt-5 text-[15px] leading-relaxed text-[#1a2b4a]/65">{body}</p>
        </div>
    </Reveal>
);

const Features = () => (
    <SiteLayout>
        <Seo
            title="Features | Veterinary AI Scribe and Clinical Assistant | PetWise"
            description="Everything in PetWise: AI SOAP notes, summaries, callback notes and dental charting from your dictation, cases that keep each patient together, and PetQuery, a veterinary clinical assistant."
            path="/features"
            jsonLd={softwareLd}
        />
        <section className="bg-[#f6f8fb]">
            <Container className="pt-10 sm:pt-14 pb-20 sm:pb-28">
                <div className="max-w-3xl mb-10 sm:mb-14">
                    <p className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#2d5fb8]">Features</p>
                    <h1 className="mt-4 text-[2.5rem] sm:text-[3.5rem] leading-[1.03] font-semibold tracking-[-0.04em] text-[#13233f] text-balance">
                        Every record you write, <Highlight dark>written for you.</Highlight>
                    </h1>
                    <p className="mt-5 text-lg sm:text-xl text-[#1a2b4a]/65 max-w-2xl">
                        Pick the record type, say the patient’s name and talk. PetWise writes it, files it in the patient’s case and has it ready to paste.
                    </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{RECORD_TYPES.map((t, i) => <RecordTypeCard key={t.label} {...t} i={i} />)}</div>
                <div className="mt-10 flex flex-col sm:flex-row gap-3">
                    <SignupButton placement="features_hero" />
                    <ButtonLink to="/demo" variant="outline" arrow={false} trackAs="book_demo_features_hero" className="bg-white">
                        Book a demo
                    </ButtonLink>
                </div>
            </Container>
        </section>

        <DentalSection />

        <Section tone="tint">
            <SplitFeature
                eyebrow="PetQuery"
                title="A clinical assistant in the same tab."
                body="Ask about dosages, differentials, toxicities and protocols mid appointment. Answers are grounded in veterinary references you can check."
                points={['Dosages and drug interactions', 'Differentials from the signs in front of you', 'References listed with every answer']}
                media={<PetQueryAnswer />}
            >
                <div className="mt-8">
                    <ButtonLink to="/veterinary-clinical-assistant" variant="outline">
                        More about PetQuery
                    </ButtonLink>
                </div>
            </SplitFeature>
        </Section>

        <Section>
            <SplitFeature
                reverse
                eyebrow="Cases"
                title="Every patient, every record, one place."
                body="Each visit becomes a case. The SOAP, the discharge summary, tomorrow’s callback and next week’s dental all land together, searchable by patient."
                points={['Add a record to any case from your phone or desk', 'Copy the whole case into your PIMS at once', 'Find any patient in seconds']}
                media={<CaseCard />}
            />
        </Section>

        <section className="bg-white px-3 sm:px-5">
            <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(160deg,#3f7ad6_0%,#2d5fb8_45%,#2350a3_100%)] text-white">
                <div aria-hidden className="absolute inset-0 bg-[radial-gradient(55%_50%_at_50%_0%,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0)_70%)]" />
                <div aria-hidden className="absolute inset-0 bg-[radial-gradient(40%_50%_at_50%_85%,rgba(92,204,240,0.45)_0%,rgba(92,204,240,0)_70%)]" />
                <Container className="relative pt-16 sm:pt-24 text-center">
                    <Reveal>
                        <h2 className="mx-auto max-w-3xl text-[2.25rem] sm:text-[3.25rem] leading-[1.04] font-semibold tracking-[-0.04em] text-balance">
                            Dictate between rooms. <Highlight>Finish at your desk.</Highlight>
                        </h2>
                        <p className="mx-auto mt-5 max-w-xl text-lg text-white/75">
                            Record on your phone and the finished record is waiting in the patient’s case on your desktop.
                        </p>
                    </Reveal>
                    <Reveal delay={120} className="mx-auto mt-10 sm:mt-14 max-w-4xl pb-12 sm:pb-20">
                        <div role="img" aria-label="Dictating on a phone, then the finished record appearing on the PetWise desktop app">
                            <DictationDemo maxScale={1.4} />
                        </div>
                    </Reveal>
                </Container>
            </div>
        </section>

        <Section>
            <SectionHeading eyebrow="And the rest" title="Everything around the record." />
            <FeatureGrid items={EVERYTHING_ELSE} />
        </Section>

        <ImageBand
            src="/site/vet-client-handoff.jpg"
            alt="A veterinarian handing a printed summary to a smiling client"
            imageClassName="object-[70%_center]"
            title="Clients who understand the plan."
            body="Turn the diagnosis into a plain language summary your clients can read, keep and follow at home."
        />

        <div className="pt-3 sm:pt-5 bg-white">
            <CtaBand />
        </div>
    </SiteLayout>
);

export default Features;
