import React from 'react';
import {
    FiArchive,
    FiClipboard,
    FiDownload,
    FiFileText,
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
import { Seo, softwareLd } from '../seo';
import { CtaBand, FeatureGrid, ImageBand, Highlight, PageHero, Section, SectionHeading, SignupButton, SplitFeature } from '../ui';

const DOCUMENTATION = [
    { icon: FiClipboard, title: 'QuickSOAP', body: 'AI SOAP notes from the appointment or your dictation.', to: '/' },
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
    { icon: FiArchive, title: 'Saved records', body: 'Every record saved, searchable and ready to revisit.' },
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
        <PageHero
            below="tint"
            eyebrow="Features"
            title={
                <>
                    Everything the record needs. <Highlight>Nothing it doesn’t.</Highlight>
                </>
            }
            body="PetWise brings documentation, clinical questions and client communication into one simple workspace."
            image="/site/laptop-soap.jpg"
            imageAlt="A veterinarian reviewing a PetWise SOAP note on a laptop"
            photo
        >
            <SignupButton placement="features_hero" variant="light" />
        </PageHero>

        <Section tone="tint">
            <SectionHeading eyebrow="Documentation" title="Every kind of note, written for you." />
            <FeatureGrid items={DOCUMENTATION} />
        </Section>

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
                body="QuickSOAP, PetQuery, saved records and templates live side by side. Move from documentation to a clinical question and back without losing your place."
                image="/site/desk-quicksoap.png"
                imageAlt="The PetWise dashboard with QuickSOAP, PetQuery, saved records and templates"
            />
        </Section>

        <Section tone="tint">
            <SectionHeading eyebrow="Workflow" title="Built around a real clinic day." />
            <FeatureGrid items={WORKFLOW} />
        </Section>

        <CtaBand />
    </SiteLayout>
);

export default Features;
