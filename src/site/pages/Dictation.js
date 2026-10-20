import React from 'react';
import { FiClock, FiMic, FiMonitor, FiRefreshCw, FiSmartphone, FiType } from 'react-icons/fi';
import SiteLayout from '../SiteLayout';
import { Seo, faqLd, softwareLd } from '../seo';
import DemoStage from '../../pages/landing/campaign/DemoStage';
import {
    ButtonLink,
    CheckList,
    CtaBand,
    Eyebrow,
    FaqSection,
    FeatureGrid,
    Hero,
    Highlight,
    ImageBand,
    Reveal,
    RoundedPhoto,
    Section,
    SectionHeading,
    SignupButton,
    SplitFeature,
    Steps
} from '../ui';

const STEPS = [
    { title: 'Dictate on the go', body: 'Between consults, walking out of treatment, or right after a case. Your phone is the microphone.' },
    { title: 'It syncs instantly', body: 'Every dictation lands in your PetWise dashboard on the desktop, already organized by patient.' },
    { title: 'Finish at your desk', body: 'Review the generated SOAP, polish anything you want, and paste it into your PIMS.' }
];

const BENEFITS = [
    { icon: FiMic, title: 'Speak naturally', body: 'No voice commands or awkward pauses. Say the section, then the findings.' },
    { icon: FiSmartphone, title: 'Phone or desktop', body: 'Install PetWise on your phone in seconds. No app store needed.' },
    { icon: FiRefreshCw, title: 'Synced automatically', body: 'Start a case on your phone and finish it on your computer.' },
    { icon: FiType, title: 'Type when you prefer', body: 'Add a quick typed note or extra context to any dictation.' },
    { icon: FiMonitor, title: 'Formatted for you', body: 'PetWise handles structure, terminology and clarity.' },
    { icon: FiClock, title: 'Done before you leave', body: 'Fewer notes waiting at the end of the day.' }
];

const FAQS = [
    {
        q: 'What is the best veterinary dictation software?',
        a: 'The best option is one built for veterinary language that writes the record for you, not just a transcript. PetWise turns dictation into a structured SOAP note, callback note or clinical summary, and syncs it from your phone to your desktop.'
    },
    {
        q: 'Is this just voice to text?',
        a: 'No. Generic voice to text gives you a transcript. PetWise gives you a finished, formatted medical record using correct veterinary terminology.'
    },
    {
        q: 'Do I need a special microphone?',
        a: 'No. Your phone or computer microphone works well. Speak at a normal pace and PetWise does the rest.'
    },
    {
        q: 'Can I dictate several patients and finish later?',
        a: 'Yes. Each dictation is saved and synced, so you can record through a busy block and review everything when you sit down.'
    },
    {
        q: 'How do I get PetWise on my phone?',
        a: 'Open petwise.vet on your phone, sign in, and add it to your home screen. It runs full screen like a native app.'
    }
];

const Dictation = () => (
    <SiteLayout>
        <Seo
            title="Veterinary Dictation Software | Voice to SOAP Notes | PetWise"
            description="Dictate on your phone between rooms and PetWise turns it into a finished SOAP note, synced to your desktop. Veterinary dictation built for clinic language. Try it free."
            path="/veterinary-dictation"
            jsonLd={[softwareLd, faqLd(FAQS)]}
        />

        <Hero
            eyebrow="Veterinary dictation"
            title={
                <>
                    Speak it. See it. <Highlight>Done.</Highlight>
                </>
            }
            body="Dictate on your phone between rooms. PetWise turns your voice into a finished SOAP note, and it is waiting on your desktop when you sit down."
            microcopy="Works on iPhone, Android and any modern browser."
            media={
                <div className="flex justify-center" role="img" aria-label="Dictating on a phone, then the finished SOAP note appearing on desktop">
                    <DemoStage host="petwise.vet" />
                </div>
            }
            mediaClassName="max-w-3xl"
            overlap="sm"
            below="tint"
        >
            <SignupButton placement="dictation_hero" variant="light" />
            <ButtonLink to="/install" variant="glass">
                Get it on your phone
            </ButtonLink>
        </Hero>

        <Section tone="tint">
            <SectionHeading eyebrow="How it works" title="Start on your phone. Finish on your desktop." />
            <Steps items={STEPS} />
            <Reveal className="mt-16 sm:mt-20">
                <RoundedPhoto
                    src="/site/quicksoap-phone-laptop.jpg"
                    alt="QuickSOAP on a phone with the synced SOAP note open on a laptop"
                    aspect="aspect-[16/10] sm:aspect-[21/9]"
                    className="object-[center_40%]"
                />
            </Reveal>
        </Section>

        <Section>
            <SplitFeature
                eyebrow="Between rooms"
                title="Your hands are busy. Your phone is not."
                body="Dictate while the case is fresh, walking out of the exam room or waiting on a lab result. PetWise writes the record while you move on to the next patient."
                photo="/site/vet-cat-phone.jpg"
                photoClassName="object-[60%_center]"
                imageAlt="A veterinarian dictating on her phone beside a cat"
            />
        </Section>

        <Section tone="tint">
            <SectionHeading
                eyebrow="Built for clinic life"
                title="Not generic voice to text."
                body="PetWise is trained for veterinary language and clinical flow, so the final record sounds like you, only clearer."
            />
            <FeatureGrid items={BENEFITS} />
        </Section>

        <div className="py-3 sm:py-5 bg-white">
            <ImageBand
                src="/site/vet-typing-crate.jpg"
                alt="A veterinarian finishing records at the computer next to a pet carrier"
                imageClassName="object-[75%_center]"
                title="Done before the next patient."
                body="Fewer notes waiting at the end of the day, and no more finishing records from memory at home."
            />
        </div>

        <Section tone="navy">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
                <Reveal>
                    <Eyebrow light>Three modes</Eyebrow>
                    <h2 className="text-[2rem] sm:text-[2.75rem] leading-[1.08] font-semibold tracking-[-0.025em]">One microphone for every kind of note.</h2>
                    <p className="mt-5 text-lg text-white/65">Pick the mode before you speak and PetWise formats the result for the job.</p>
                </Reveal>
                <Reveal delay={100}>
                    <CheckList
                        light
                        items={[
                            'SOAP: a complete record with assessment and plan',
                            'Summary: an organized clinical summary for fast review',
                            'Callback: a record of the client call and the next steps'
                        ]}
                    />
                </Reveal>
            </div>
        </Section>

        <FaqSection faqs={FAQS} />
        <CtaBand title="Dictate your next case with PetWise." />
    </SiteLayout>
);

export default Dictation;
