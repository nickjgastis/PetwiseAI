import React from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiSmartphone, FiZap } from 'react-icons/fi';
import SiteLayout from '../SiteLayout';
import { Seo, faqLd } from '../seo';
import { ButtonLink, Container, CtaBand, FaqList, Hero, Highlight, ImageBand, Reveal, Section } from '../ui';

const GROUPS = [
    {
        title: 'Getting started',
        faqs: [
            {
                q: 'How do I create my first SOAP note?',
                a: 'Sign in, tap New case, choose SOAP as the record type and tap the microphone. Run the appointment or dictate your findings, then stop recording. Your SOAP appears in seconds, saved to the case and ready to review.'
            },
            {
                q: 'What should I say when dictating?',
                a: 'Speak naturally. For the best accuracy, say the section name and then list your findings, for example “Objective: heart and lungs normal, mild dental tartar.”'
            },
            {
                q: 'Can I add context after recording?',
                a: 'Yes. Type extra notes in the context box and press Regenerate. PetWise rebuilds the record with the new details.'
            }
        ]
    },
    {
        title: 'Cases and records',
        faqs: [
            {
                q: 'What is a case?',
                a: 'A case is one patient. Start one with New case, and every SOAP, summary and callback you make for that patient stays together in it. Open the case again any time to add another record.'
            },
            {
                q: 'What is the difference between SOAP, Summary and Callback?',
                a: 'They are the record types you pick before you dictate. SOAP creates a full medical record with assessment and plan. Summary creates a concise clinical summary. Callback documents a phone conversation with a client and the next steps.'
            },
            {
                q: 'Can I edit generated records?',
                a: 'Yes. Every section is editable. Change anything before you save, copy or download it.'
            },
            {
                q: 'How do I get a record into my PIMS?',
                a: 'Use Copy All and paste it into your practice management system, or download the record as a PDF.'
            },
            {
                q: 'Where are my saved records?',
                a: 'Open Cases in the dashboard and search by patient. Every record is inside its case, and you can reopen any of them to edit. Saved Records, under More, also lists them all in one place.'
            },
            {
                q: 'How do templates work?',
                a: 'Save a template with your preferred sections and phrasing under My Templates. PetWise follows it when generating your records.'
            }
        ]
    },
    {
        title: 'PetQuery',
        faqs: [
            {
                q: 'What can I ask PetQuery?',
                a: 'Drug doses, differentials, treatment protocols, diagnostic criteria, and plain language explanations for clients.'
            },
            {
                q: 'What sources does PetWise use?',
                a: 'PetQuery is tuned for veterinary medicine and draws on references including the Merck Veterinary Manual and Blackwell’s Five-Minute Veterinary Consult.'
            },
            {
                q: 'How accurate is the information?',
                a: 'PetQuery is a fast, well grounded starting point. Always verify critical information and use your professional judgment.'
            }
        ]
    },
    {
        title: 'Account and billing',
        faqs: [
            {
                q: 'What happens when my 10 day trial ends?',
                a: 'You move to PetWise Free automatically, with 2 SOAPs and 3 PetQuery questions a day. Upgrade any time for unlimited use.'
            },
            {
                q: 'How do I change or cancel my plan?',
                a: 'Open Profile in the dashboard and go to Subscription. You can switch plans or cancel, and you keep access until the end of the billing period.'
            },
            {
                q: 'Can I use PetWise on my phone?',
                a: 'Yes. Open petwise.vet on your phone, sign in and add it to your home screen. Dictations go into the case open on your phone and sync to your desktop automatically.'
            }
        ]
    },
    {
        title: 'Privacy',
        faqs: [
            {
                q: 'Should I enter client personal details?',
                a: 'No. PetWise is designed for patient medical information. Avoid entering client names, phone numbers or addresses.'
            },
            {
                q: 'Do you sell my data?',
                a: 'No. Read our privacy policy for exactly how data is stored and used.'
            }
        ]
    }
];

const ALL_FAQS = GROUPS.flatMap((g) => g.faqs);

const CARDS = [
    { icon: FiZap, title: 'New to PetWise?', body: 'Start a free 10 day trial and create your first SOAP in minutes.', link: { to: '/signup', label: 'Start free' } },
    { icon: FiSmartphone, title: 'Install on your phone', body: 'Step by step instructions for iPhone and Android.', link: { to: '/install', label: 'Get the app' } },
    { icon: FiMail, title: 'Talk to a person', body: 'Email support and we will get back to you quickly.', link: { href: 'mailto:support@petwise.vet', label: 'support@petwise.vet' } }
];

const Help = () => (
    <SiteLayout>
        <Seo
            title="Help Center | PetWise"
            description="Answers to common questions about PetWise: cases, record types, dictation, PetQuery, templates, billing and installing the app on your phone."
            path="/help"
            jsonLd={faqLd(ALL_FAQS)}
        />
        <Hero
            eyebrow="Help center"
            title={
                <>
                    How can <Highlight>we help?</Highlight>
                </>
            }
            body="Quick answers, setup guides and a real person on the other end of support@petwise.vet."
        />
        <section className="bg-white">
            <Container className="pt-16 sm:pt-20 pb-14">
                <div className="grid gap-4 md:grid-cols-3">
                    {CARDS.map(({ icon: Icon, title, body, link }) => (
                        <div key={title} className="rounded-[24px] bg-[#f6f8fb] p-7">
                            <Icon className="text-[20px] text-[#3468bd]" aria-hidden />
                            <h2 className="mt-5 font-semibold text-[#13233f]">{title}</h2>
                            <p className="mt-1.5 text-[15px] text-[#1a2b4a]/60">{body}</p>
                            {link.to ? (
                                <Link to={link.to} className="mt-4 inline-block text-[15px] font-medium text-[#3468bd] hover:underline underline-offset-4">
                                    {link.label}
                                </Link>
                            ) : (
                                <a href={link.href} className="mt-4 inline-block text-[15px] font-medium text-[#3468bd] hover:underline underline-offset-4">
                                    {link.label}
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            </Container>
        </section>

        <Section className="!pt-10">
            <div className="space-y-16">
                {GROUPS.map((g) => (
                    <Reveal key={g.title} className="grid lg:grid-cols-12 gap-6">
                        <h2 className="lg:col-span-4 text-xl font-semibold tracking-tight text-[#13233f]">{g.title}</h2>
                        <div className="lg:col-span-8">
                            <FaqList faqs={g.faqs} />
                        </div>
                    </Reveal>
                ))}
            </div>
        </Section>

        <ImageBand
            src="/site/support.jpg"
            alt="A smiling woman working at her computer"
            imageClassName="object-[70%_center]"
            title="Still stuck? Talk to a real person."
            body="Email us and a member of the PetWise team will get back to you quickly."
        >
            <div className="mt-8">
                <ButtonLink href="mailto:support@petwise.vet" variant="light" trackAs="help_email">
                    Email support
                </ButtonLink>
            </div>
        </ImageBand>
        <div className="h-3 sm:h-5 bg-white" />

        <CtaBand />
    </SiteLayout>
);

export default Help;
