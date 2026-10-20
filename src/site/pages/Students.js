import React from 'react';
import { FiBookOpen, FiClipboard, FiMessageCircle, FiTrendingUp } from 'react-icons/fi';
import SiteLayout from '../SiteLayout';
import { Seo, faqLd } from '../seo';
import { ButtonLink, CtaBand, FaqSection, FeatureGrid, Highlight, PageHero, Reveal, Section, SectionHeading, Steps } from '../ui';

const MAILTO = 'mailto:support@petwise.vet?subject=I%E2%80%99m%20a%20vet%20student!';

const BENEFITS = [
    { icon: FiClipboard, title: 'SOAP notes in seconds', body: 'Practice writing cases and compare your work with a complete, structured note.' },
    { icon: FiMessageCircle, title: 'PetQuery on rotations', body: 'Dosages, treatments and client friendly explanations when you need them.' },
    { icon: FiBookOpen, title: 'Learn faster', body: 'See how a clear assessment and plan comes together, case after case.' },
    { icon: FiTrendingUp, title: 'Be clinic ready', body: 'Build the workflow you will use in practice from day one.' }
];

const STEPS = [
    { title: 'Email us', body: 'Send a note to support@petwise.vet from your student email with the subject “I’m a vet student!”' },
    { title: 'Get your code', body: 'We reply with a free access code, usually within one business day.' },
    { title: 'Redeem it', body: 'Create your account, open Profile then Subscription, and enter your code. No credit card.' }
];

const FAQS = [
    {
        q: 'Is PetWise really free for vet students?',
        a: 'Yes. Students enrolled in a veterinary program get full PetWise access free while they study.'
    },
    {
        q: 'Who qualifies?',
        a: 'Students currently enrolled in a DVM, VMD or equivalent veterinary program. Use your school email so we can verify quickly.'
    },
    {
        q: 'What happens when I graduate?',
        a: 'Your records stay with you. Choose a paid plan or continue on PetWise Free.'
    }
];

const Students = () => (
    <SiteLayout overlayHeader>
        <Seo
            title="Free AI Scribe for Veterinary Students | PetWise"
            description="Veterinary students get PetWise free. AI SOAP notes and PetQuery, a clinical assistant for dosages and treatments, to help you learn faster and be clinic ready."
            path="/students"
            jsonLd={faqLd(FAQS)}
        />
        <PageHero
            below="tint"
            eyebrow="For vet students"
            title={
                <>
                    Vet school is tough. <Highlight>PetWise is free.</Highlight>
                </>
            }
            body="Spend less time on SOAP notes and drug look ups, and more time learning medicine. Every veterinary student gets PetWise at no cost."
            image="/site/young-vet.jpg"
            imageAlt="A young veterinarian in scrubs smiling in a clinic"
            photo
            photoClassName="object-[50%_30%]"
        >
            <ButtonLink href={MAILTO} trackAs="student_email" variant="light">
                Get my free access code
            </ButtonLink>
        </PageHero>

        <Section tone="tint">
            <SectionHeading eyebrow="Why PetWise" title="Your study partner through clinics and rotations." />
            <FeatureGrid items={BENEFITS} columns={2} />
        </Section>

        <Section>
            <SectionHeading eyebrow="How it works" title="Three steps to free access." />
            <Steps items={STEPS} />
        </Section>

        <Section tone="tint">
            <Reveal className="max-w-3xl">
                <blockquote className="text-[1.6rem] sm:text-[2rem] leading-[1.3] font-medium tracking-[-0.02em] text-[#13233f]">
                    “As a practicing veterinarian for over 30 years, I know how overwhelming vet school can feel. We created PetWise to give the next generation a head start.”
                </blockquote>
                <div className="mt-8 flex items-center gap-4">
                    <img src="/site/dr-gastis.jpg" alt="Dr. Stacey Gastis" className="w-12 h-12 rounded-full object-cover" loading="lazy" />
                    <div>
                        <p className="font-medium text-[#13233f]">Dr. Stacey Gastis, BSc, DVM</p>
                        <p className="text-[14px] text-[#1a2b4a]/55">Co-founder, PetWise</p>
                    </div>
                </div>
            </Reveal>
        </Section>

        <FaqSection faqs={FAQS} />
        <CtaBand title="Start vet school with an edge." body="Email us for your free student access code." />
    </SiteLayout>
);

export default Students;
