import React from 'react';
import { FiActivity, FiBookOpen, FiDroplet, FiList, FiMessageSquare, FiUsers } from 'react-icons/fi';
import SiteLayout from '../SiteLayout';
import { Seo, faqLd, softwareLd } from '../seo';
import { CtaBand, FaqSection, FeatureGrid, ImageBand, PageHero, Reveal, Section, SectionHeading, SignupButton, SplitFeature } from '../ui';
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
        <PageHero
            eyebrow="Veterinary clinical assistant"
            title="Clinical answers in seconds."
            body="Ask PetQuery about dosages, differentials, protocols, or how to explain a diagnosis to a client. Stop digging through PDFs and tabs mid exam."
        >
            <SignupButton placement="petquery_hero">Try PetQuery free</SignupButton>
        </PageHero>

        <section className="bg-white pb-20 sm:pb-28 px-5 sm:px-8">
            <Reveal className="max-w-5xl mx-auto">
                <div className="rounded-[28px] bg-gradient-to-br from-[#e9f6fd] to-[#f6f8fb] p-3 sm:p-5">
                    <img
                        src="/site/petquery.png"
                        alt="PetQuery answering a question about fluoxetine and trazodone dosing"
                        className="w-full h-auto rounded-[18px] shadow-[0_30px_60px_-30px_rgba(19,35,63,0.35)]"
                        width="1600"
                        height="1097"
                    />
                </div>
            </Reveal>
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
