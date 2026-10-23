import React from 'react';
import { FiClipboard, FiFileText, FiMessageCircle, FiMic, FiPhoneCall, FiUsers } from 'react-icons/fi';
import { FaClipboardList, FaFileAlt, FaPhoneAlt } from 'react-icons/fa';
import { PiTooth } from 'react-icons/pi';
import SiteLayout from '../SiteLayout';
import { Seo, faqLd, organizationLd, softwareLd } from '../seo';
import { PRESS } from '../siteConfig';
import { SoapNote } from '../demos';
import DictationDemo from '../DictationDemo';
import { DentalSection } from '../DentalDemo';
import { PRICES } from '../../constants/pricing';
import { BRAND_WASH } from '../../brand';
import {
    ButtonLink,
    Container,
    CtaBand,
    FaqSection,
    FeatureGrid,
    Highlight,
    PhotoHero,
    Photo,
    PhotoStrip,
    Reveal,
    Section,
    SectionHeading,
    SignupButton,
    SplitFeature,
    Steps,
    Testimonials
} from '../ui';

const FEATURES = [
    {
        icon: FiClipboard,
        title: 'AI SOAP notes',
        body: 'Let PetWise listen to the appointment and get a complete, structured SOAP note when you walk out.',
        to: '/features'
    },
    {
        icon: FiMic,
        title: 'Dictation, anywhere',
        body: 'Dictate on your phone between rooms. The record is waiting on your desktop when you sit down.',
        to: '/veterinary-dictation'
    },
    {
        icon: FiMessageCircle,
        title: 'Clinical assistant',
        body: 'Ask PetQuery about dosages, differentials and protocols. Get answers grounded in veterinary references.',
        to: '/veterinary-clinical-assistant'
    },
    {
        icon: FiPhoneCall,
        title: 'Callback notes',
        body: 'Turn client phone calls into a clean record of what was discussed and what happens next.',
        to: '/features'
    },
    {
        icon: FiFileText,
        title: 'Clinical summaries',
        body: 'Organized summaries with treatments, medications and vaccines laid out for fast review.',
        to: '/features'
    },
    {
        icon: FiUsers,
        title: 'Client communication',
        body: 'Explain a diagnosis in plain language your clients understand, ready to print or email.',
        to: '/features'
    }
];

const STEPS = [
    { title: 'Open PetWise', body: 'On your phone or computer. Your next appointment can be your first record.' },
    { title: 'Practice normally', body: 'Talk to your client and examine your patient. PetWise listens, or you dictate when it suits you.' },
    { title: 'Review and paste', body: 'A finished SOAP is ready to review, edit and move into your PIMS.' }
];

const FAQS = [
    {
        q: 'What is a veterinary AI scribe?',
        a: 'A veterinary AI scribe listens to the appointment or your dictation and writes the medical record for you. PetWise produces a structured SOAP note in seconds, so you review and approve instead of writing from scratch.'
    },
    {
        q: 'What makes PetWise different from other veterinary scribes?',
        a: 'PetWise was built with a practicing veterinarian of over 30 years, and it goes past the SOAP. The same workspace handles callback notes, clinical summaries, client communication and PetQuery, a clinical assistant for dosages, differentials and protocols.'
    },
    {
        q: 'Does PetWise work with my practice management software?',
        a: 'Yes. PetWise works alongside any PIMS. Copy the finished record and paste it into your system, or save it as a PDF.'
    },
    {
        q: 'Can I use my own SOAP template?',
        a: 'Yes. Save templates with the sections and phrasing you like, and PetWise follows them on every record.'
    },
    {
        q: 'How fast is the SOAP note ready?',
        a: 'Seconds after you stop recording. Most vets review and finish the record before the next patient is in the room.'
    },
    {
        q: 'Do I need special hardware?',
        a: 'No. PetWise runs in the browser on your computer and installs on your phone like an app. Records sync between devices automatically.'
    },
    {
        q: 'Is there a free trial?',
        a: 'Yes. Every account starts with 10 days of unlimited use and no credit card. After that, choose a paid plan or keep PetWise Free with 2 SOAPs and 3 PetQuery questions a day.'
    },
    {
        q: 'How accurate is it with veterinary terminology?',
        a: 'PetWise is tuned for clinic language: abbreviations, drug names and species specific terms. You always review the record before it goes into the chart.'
    }
];

const RECORD_TYPES = [
    { label: 'SOAP', icon: FaClipboardList, className: 'from-blue-500 to-blue-600 shadow-blue-600/25' },
    { label: 'Summary', icon: FaFileAlt, className: 'from-emerald-500 to-emerald-600 shadow-emerald-600/25' },
    { label: 'Callback', icon: FaPhoneAlt, className: 'from-amber-500 to-amber-600 shadow-amber-600/25' },
    { label: 'Dental', icon: PiTooth, className: 'from-violet-500 to-violet-600 shadow-violet-600/25' }
];

const Home = () => (
    <SiteLayout>
        <Seo
            title="PetWise | Veterinary AI Scribe for SOAP Notes"
            description="PetWise is the veterinary AI scribe built by a veterinarian. Record the appointment or dictate, and get a finished SOAP note in seconds. Try it free for 10 days."
            path="/"
            jsonLd={[organizationLd, softwareLd, faqLd(FAQS)]}
        />

        <PhotoHero
            eyebrow="Veterinary AI scribe"
            title={
                <>
                    Finish your notes <Highlight dark>before you leave.</Highlight>
                </>
            }
            body="PetWise listens to the appointment and writes the SOAP note for you."
            afterBody={
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                    {RECORD_TYPES.map(({ label, icon: Icon, className }) => (
                        <span key={label} className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[13.5px] font-semibold text-white bg-gradient-to-b shadow-[0_6px_14px_-6px] ${className}`}>
                            <Icon className="text-[12px]" />
                            {label}
                        </span>
                    ))}
                </div>
            }
            microcopy="10 days unlimited. No credit card."
            image="/site/hero-cat.jpg"
            imageAlt="A tabby cat held in its owner's lap, raising a paw"
            imagePosition="55% 40%"
            badge={
                PRESS.length > 0 && (
                    <div className="inline-flex items-center gap-3 sm:gap-4 rounded-[20px] bg-white/90 backdrop-blur p-2.5 pl-4 sm:p-3 sm:pl-5 shadow-[0_24px_50px_-20px_rgba(19,35,63,0.45)] ring-1 ring-[#13233f]/[0.06]">
                        <span className="text-[12px] font-semibold tracking-[0.16em] uppercase text-[#13233f]/50">As seen on</span>
                        {PRESS.map((p) => (
                            <span key={p.name} className="inline-flex items-center rounded-2xl bg-[#13233f] px-4 py-3 sm:px-5 sm:py-3.5">
                                <img src={p.logo} alt={p.name} className="h-6 sm:h-7 w-auto" />
                            </span>
                        ))}
                    </div>
                )
            }
        >
            <SignupButton placement="home_hero" />
            <ButtonLink href="#how-it-works" variant="outline" arrow={false} className="bg-white/60 backdrop-blur">
                See how it works
            </ButtonLink>
        </PhotoHero>

        <DentalSection />

        <Section>
            <Reveal as="figure" className="max-w-4xl mx-auto text-center">
                <span aria-hidden className="block font-serif text-[7rem] leading-[0.6] text-[#5cccf0]">
                    “
                </span>
                <blockquote className="mt-6 text-[1.9rem] sm:text-[2.9rem] leading-[1.12] font-semibold tracking-[-0.03em] text-[#13233f] text-balance">
                    Without PetWise I could not possibly be as <Highlight dark>productive or efficient.</Highlight>
                </blockquote>
                <figcaption className="mt-8 text-[15px] text-[#1a2b4a]/60">
                    <span className="font-medium text-[#13233f]">Dr. Tammi Whelan</span>, DVM
                </figcaption>
            </Reveal>
        </Section>

        <section className="bg-white px-3 sm:px-5">
            <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(160deg,#3f7ad6_0%,#2d5fb8_45%,#2350a3_100%)] text-white">
                <div aria-hidden className="absolute inset-0 bg-[radial-gradient(55%_50%_at_50%_0%,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0)_70%)]" />
                <div aria-hidden className="absolute inset-0 bg-[radial-gradient(40%_50%_at_50%_85%,rgba(92,204,240,0.45)_0%,rgba(92,204,240,0)_70%)]" />
                <Container className="relative pt-16 sm:pt-28 text-center">
                    <Reveal>
                        <h2 className="mx-auto max-w-3xl text-[2.25rem] sm:text-[3.5rem] leading-[1.04] font-semibold tracking-[-0.04em] text-balance">
                            On your desk. <Highlight>In your pocket.</Highlight>
                        </h2>
                        <p className="mx-auto mt-5 max-w-xl text-lg text-white/75">
                            Record on your phone between rooms. The finished SOAP is waiting on your desktop when you sit down.
                        </p>
                    </Reveal>
                    <Reveal delay={120} className="mx-auto mt-10 sm:mt-14 max-w-4xl pb-12 sm:pb-20">
                        <div role="img" aria-label="Dictating on a phone, then the finished SOAP note appearing on the PetWise desktop app">
                            <DictationDemo maxScale={1.4} />
                        </div>
                    </Reveal>
                </Container>
            </div>
        </section>

        <Section id="how-it-works">
            <SectionHeading
                eyebrow="How it works"
                title="Three steps. No new habits."
                body="You talk to the client. PetWise handles the documentation."
            />
            <Steps items={STEPS} />
            <div className="mt-16 sm:mt-20">
                <PhotoStrip
                    photos={[
                        { src: '/site/vet-dog-owner.jpg', alt: 'A veterinarian examining a happy dog with its owner' },
                        { src: '/site/vet-rabbit.jpg', alt: 'A veterinarian holding a rabbit outdoors', className: 'object-[40%_center]' },
                        { src: '/site/vet-client-desk.jpg', alt: 'A veterinarian talking with a client at the front desk' }
                    ]}
                />
            </div>
        </Section>

        <Section tone="wash">
            <SectionHeading
                eyebrow="One workspace"
                title="The SOAP is only the beginning."
                body="Most scribes stop at the note. PetWise stays with the whole case."
            />
            <FeatureGrid items={FEATURES} />
        </Section>

        <Section>
            <SplitFeature
                eyebrow="Built for the exam room"
                title="Records that sound like you wrote them."
                body="PetWise understands clinic language, follows your templates and keeps every record structured the same way, across every vet on your team."
                points={[
                    'Subjective, objective, assessment and plan, every time',
                    'Veterinary abbreviations, drug names and species specific terms',
                    'Your own templates and preferred phrasing',
                    'Copy into any PIMS or export as a PDF'
                ]}
                media={<SoapNote />}
            />
        </Section>


        <Testimonials />

        <Section tone="tint">
            <div className="grid lg:grid-cols-12 gap-12 items-center">
                <Reveal className="lg:col-span-5">
                    <div className="overflow-hidden rounded-[28px] aspect-[4/3]">
                        <Photo src="/site/dr-gastis.jpg" alt="Dr. Stacey Gastis, DVM, co-founder of PetWise" />
                    </div>
                </Reveal>
                <Reveal className="lg:col-span-6 lg:col-start-7" delay={100}>
                    <p className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#3468bd] mb-4">Built by a veterinarian</p>
                    <h2 className="text-[2rem] sm:text-[2.5rem] leading-[1.1] font-semibold tracking-[-0.025em] text-[#13233f]">
                        Shaped by 30 years in clinical practice.
                    </h2>
                    <p className="mt-5 text-lg leading-relaxed text-[#1a2b4a]/65">
                        Dr. Stacey Gastis, DVM, built PetWise with his son Nick after watching vets lose their evenings to paperwork. Every feature is designed around how a real clinic day works.
                    </p>
                    <div className="mt-8">
                        <ButtonLink to="/about" variant="outline">
                            Our story
                        </ButtonLink>
                    </div>
                </Reveal>
            </div>
        </Section>

        <Section>
            <div className="grid lg:grid-cols-12 gap-12 items-end">
                <Reveal className="lg:col-span-6">
                    <p className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#3468bd] mb-4">Pricing</p>
                    <h2 className="text-[2rem] sm:text-[2.75rem] leading-[1.08] font-semibold tracking-[-0.025em] text-[#13233f]">
                        Simple pricing. Unlimited records.
                    </h2>
                    <p className="mt-5 text-lg leading-relaxed text-[#1a2b4a]/65">
                        Start with 10 days of everything, free. Then go unlimited from ${PRICES.usd.yearly} USD a month, or keep PetWise Free.
                    </p>
                </Reveal>
                <Reveal className="lg:col-span-5 lg:col-start-8" delay={100}>
                    <div className={`rounded-[28px] border border-[#e3ecf8] ${BRAND_WASH} p-8`}>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-semibold tracking-[-0.03em] text-[#13233f]">${PRICES.usd.yearly}</span>
                            <span className="text-[15px] text-[#1a2b4a]/55">USD / month, billed yearly</span>
                        </div>
                        <p className="mt-2 text-[15px] text-[#1a2b4a]/55">or ${PRICES.usd.monthly} USD billed monthly</p>
                        <div className="mt-7 flex flex-col sm:flex-row gap-3">
                            <SignupButton placement="home_pricing">Start free</SignupButton>
                            <ButtonLink to="/pricing" variant="outline" arrow={false}>
                                Compare plans
                            </ButtonLink>
                        </div>
                    </div>
                </Reveal>
            </div>
        </Section>

        <FaqSection faqs={FAQS} tone="tint" />
        <div className="pt-3 sm:pt-5 bg-white">
            <CtaBand />
        </div>
    </SiteLayout>
);

export default Home;
