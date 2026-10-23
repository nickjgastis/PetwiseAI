import React from 'react';
import {
    FiClipboard,
    FiDownload,
    FiFileText,
    FiFolder,
    FiLayers,
    FiMessageCircle,
    FiMic,
    FiPhoneCall,
    FiRefreshCw,
    FiSmartphone,
    FiUsers,
    FiZap
} from 'react-icons/fi';
import SiteLayout from '../SiteLayout';
import { DentalSection } from '../DentalDemo';
import { Seo, softwareLd } from '../seo';
import { Container, CtaBand, FeatureGrid, ImageBand, Highlight, Section, SectionHeading, SplitFeature } from '../ui';

const DOCUMENTATION = [
    { icon: FiClipboard, title: 'SOAP notes', body: 'AI SOAP notes from the appointment or your dictation.', to: '/' },
    { icon: FiFileText, title: 'Clinical summaries', body: 'Treatments, medications and vaccines clearly organized for review and sharing.' },
    { icon: FiPhoneCall, title: 'Callback notes', body: 'Document client calls: what was discussed, what you advised, what comes next.' },
    { icon: FiZap, title: 'PetSOAP', body: 'Fill in a few exam fields and generate a full record with diagnosis and treatment plan.' },
    { icon: FiUsers, title: 'Client communication', body: 'Plain language handouts, side effects and home care notes for pet owners.' },
    { icon: FiLayers, title: 'Templates', body: 'Save your preferred structure and phrasing. PetWise follows it every time.' }
];

const WORKFLOW = [
    { icon: FiMic, title: 'Voice dictation', body: 'Speak naturally. No commands or special phrasing.', to: '/veterinary-dictation' },
    { icon: FiMessageCircle, title: 'PetQuery', body: 'A clinical assistant for dosages, differentials and protocols.', to: '/veterinary-clinical-assistant' },
    { icon: FiRefreshCw, title: 'Phone to desktop sync', body: 'Record on your phone, finish on your computer.' },
    { icon: FiFolder, title: 'Cases', body: 'Each patient gets a case with all its records together, searchable and ready to revisit.' },
    { icon: FiDownload, title: 'Copy or PDF', body: 'Paste into any PIMS, or export a clean PDF for clients.' },
    { icon: FiSmartphone, title: 'Installs on your phone', body: 'Add PetWise to your home screen. No app store needed.', to: '/install' }
];

const Features = () => (
    <SiteLayout>
        <Seo
            title="Features | Veterinary AI Scribe and Clinical Assistant | PetWise"
            description="Everything in PetWise: AI SOAP notes, veterinary dictation, callback notes, clinical summaries, client communication, templates and PetQuery, a veterinary clinical assistant."
            path="/features"
            jsonLd={softwareLd}
        />
        <section className="bg-[#f6f8fb]">
            <Container className="pt-10 sm:pt-14 pb-20 sm:pb-28">
                <div className="max-w-2xl mb-10 sm:mb-14">
                    <p className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#2d5fb8]">Documentation</p>
                    <h1 className="mt-4 text-[2.25rem] sm:text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.035em] text-[#13233f]">
                        Every kind of note, <Highlight dark>written for you.</Highlight>
                    </h1>
                    <p className="mt-4 text-lg text-[#1a2b4a]/65">SOAP notes, callback notes, clinical summaries and client handouts, from one appointment.</p>
                </div>
                <FeatureGrid items={DOCUMENTATION} />
            </Container>
        </section>

        <DentalSection />

        <div className="pt-3 sm:pt-5 bg-white">
            <ImageBand
                src="/site/vet-client-handoff.jpg"
                alt="A veterinarian handing a printed summary to a smiling client"
                imageClassName="object-[70%_center]"
                title="Clients who understand the plan."
                body="Turn the diagnosis into a plain language summary your clients can read, keep and follow at home."
            />
        </div>

        <Section>
            <SplitFeature
                eyebrow="Workspace"
                title="All your tools in one dashboard."
                body="Cases, PetQuery and templates live side by side. Move from a patient’s records to a clinical question and back without losing your place."
                image="/site/desk-quicksoap.png"
                imageAlt="The PetWise dashboard with cases, PetQuery and templates"
            />
        </Section>

        <Section tone="wash">
            <SectionHeading eyebrow="Workflow" title="Built around a real clinic day." />
            <FeatureGrid items={WORKFLOW} />
        </Section>

        <CtaBand />
    </SiteLayout>
);

export default Features;
