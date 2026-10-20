import React from 'react';
import { FiActivity, FiBookOpen, FiDroplet, FiList, FiMessageSquare, FiUsers } from 'react-icons/fi';
import SiteLayout from '../SiteLayout';
import { Seo, faqLd, softwareLd } from '../seo';
import { Container, CtaBand, FaqSection, FeatureGrid, ImageBand, Highlight, Reveal, Section, SectionHeading, SplitFeature } from '../ui';
import PetQueryLive from '../PetQueryLive';
import { PetQueryAnswer } from '../demos';

const QUESTIONS = [
    'Metronidazole dose for a 25 lb dog',
    'Top differentials for PU/PD in a senior cat',
    'Fluid therapy plan for a 12 kg dehydrated dog',
    'Explain IMHA to a worried owner in plain language',
    'Trazodone and fluoxetine protocol for separation anxiety',
    'Seizure management plan for a new epileptic patient'
];

const USES = [
    { icon: FiDroplet, title: 'Dosages', body: 'Doses, routes, frequency and duration, with notes on what to monitor.' },
    { icon: FiList, title: 'Differentials', body: 'Ranked differential lists to sanity check a tricky presentation.' },
    { icon: FiActivity, title: 'Protocols', body: 'Treatment and diagnostic protocols laid out step by step.' },
    { icon: FiUsers, title: 'Client explanations', body: 'Turn a diagnosis into words a pet owner understands.' },
    { icon: FiBookOpen, title: 'Trusted references', body: 'Built on established veterinary references, not open forums.' },
    { icon: FiMessageSquare, title: 'Right beside your notes', body: 'In the same workspace as your SOAPs. No new tab, no lost place.' }
];

const FAQS = [
    {
        q: 'What is PetQuery?',
        a: 'PetQuery is the clinical assistant inside PetWise. Ask about dosages, differentials, treatment protocols or client communication and get a clear, structured answer in seconds.'
    },
    {
        q: 'Is PetQuery just ChatGPT?',
        a: 'PetQuery uses the same class of AI technology but is tuned for veterinary medicine and draws on veterinary references such as the Merck Veterinary Manual and Blackwell’s Five-Minute Veterinary Consult.'
    },
    {
        q: 'Can I rely on the answers?',
        a: 'PetQuery is a fast starting point, not a replacement for your judgment. Always verify critical information, especially doses, before acting on it.'
    },
    {
        q: 'Is PetQuery included in my plan?',
        a: 'Yes. Paid plans include unlimited PetQuery. PetWise Free includes 5 questions a day.'
    }
];

const ClinicalAssistant = () => (
    <SiteLayout>
        <Seo
            title="Veterinary Clinical AI Assistant | PetQuery by PetWise"
            description="PetQuery is a veterinary AI assistant for dosages, differentials, protocols and client explanations, built on trusted veterinary references. Included with PetWise."
            path="/veterinary-clinical-assistant"
            jsonLd={[softwareLd, faqLd(FAQS)]}
        />
        <section className="relative bg-white overflow-hidden">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_45%_at_50%_0%,#e2edfc_0%,rgba(255,255,255,0)_70%)]" />
            <Container className="relative pt-10 sm:pt-14 pb-16 sm:pb-24">
                <div className="max-w-3xl mx-auto text-center">
                    <p className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#2d5fb8]">Veterinary clinical assistant</p>
                    <h1 className="mt-4 text-[2.5rem] sm:text-[3.5rem] leading-[1.03] font-semibold tracking-[-0.04em] text-[#13233f] text-balance">
                        Clinical answers <Highlight dark>in seconds.</Highlight>
                    </h1>
                    <p className="mt-5 text-lg text-[#1a2b4a]/65 text-balance">
                        Try PetQuery right here. Ask about a dose, a differential or a protocol. Two free questions, no sign up.
                    </p>
                </div>
                <div className="site-hero-media mt-10 sm:mt-12 max-w-5xl mx-auto">
                    <PetQueryLive />
                </div>
            </Container>
        </section>

        <Section tone="tint">
            <SectionHeading eyebrow="Ask it anything clinical" title="Questions vets ask PetQuery every day." />
            <div className="flex flex-wrap gap-3">
                {QUESTIONS.map((q, i) => (
                    <Reveal key={q} delay={i * 50}>
                        <span className="inline-block rounded-full bg-white border border-[#e7ecf3] px-5 py-3 text-[15px] text-[#13233f]/80">{q}</span>
                    </Reveal>
                ))}
            </div>
        </Section>

        <Section>
            <SectionHeading title="Everything you would look up, in one place." />
            <FeatureGrid items={USES} />
        </Section>

        <ImageBand
            src="/site/vet-textbooks.jpg"
            alt="A tired veterinarian surrounded by textbooks"
            imageClassName="object-[65%_center]"
            title="Stop digging through textbooks mid exam."
            body="Ask the question the way you would ask a colleague. Get a clear answer with the references to back it up, in seconds."
        />
        <div className="h-3 sm:h-5 bg-white" />

        <Section tone="tint">
            <SplitFeature
                eyebrow="Sources"
                title="Grounded in veterinary references."
                body="General AI tools pull from the open internet. PetQuery is tuned for veterinary medicine and draws on established clinical references."
                points={['Merck Veterinary Manual', 'Blackwell’s Five-Minute Veterinary Consult', 'Peer reviewed veterinary literature']}
                media={<PetQueryAnswer />}
            />
        </Section>

        <FaqSection faqs={FAQS} />
        <CtaBand title="Ask your first clinical question today." />
    </SiteLayout>
);

export default ClinicalAssistant;
