import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCheck } from 'react-icons/fi';
import SiteLayout from '../SiteLayout';
import { Seo, faqLd, softwareLd } from '../seo';
import { FREE_DAILY, PLAN_FEATURES, PRICES, TRIAL_DAYS } from '../../constants/pricing';
import { Container, CtaBand, FaqSection, Hero, Highlight, ImageBand, Reveal, SignupButton } from '../ui';

const FAQS = [
    {
        q: 'How does the free trial work?',
        a: `Every new account gets ${TRIAL_DAYS} days of unlimited PetWise with no credit card. When the trial ends you can pick a paid plan or stay on PetWise Free.`
    },
    {
        q: 'What is included in PetWise Free?',
        a: `${FREE_DAILY.soap} SOAP notes and ${FREE_DAILY.query} PetQuery questions every day, with your saved records kept. Upgrade any time for unlimited use.`
    },
    {
        q: 'Can I cancel any time?',
        a: 'Yes. Manage or cancel your subscription from your profile in a few clicks. You keep access until the end of your billing period.'
    },
    {
        q: 'Do you offer clinic or team pricing?',
        a: 'Yes. For multi vet clinics and groups, email support@petwise.vet and we will put together a plan for your team.'
    },
    {
        q: 'Is PetWise free for veterinary students?',
        a: 'Yes. Vet students get PetWise free while they study. See the students page for how to get your access code.'
    },
    {
        q: 'Which currencies do you support?',
        a: 'Plans are available in US dollars and Canadian dollars.'
    }
];

const PlanCard = ({ name, price, unit, note, features, cta, featured = false, badge }) => (
    <div
        className={`relative h-full rounded-[28px] p-8 sm:p-9 flex flex-col ${
            featured ? 'bg-[linear-gradient(160deg,#3f7ad6_0%,#2d5fb8_45%,#2350a3_100%)] text-white shadow-[0_40px_80px_-40px_rgba(35,80,163,0.8)]' : 'bg-white border border-[#e7ecf3]'
        }`}
    >
        {badge && (
            <span className="absolute top-8 right-8 rounded-full bg-white/15 text-white px-3 py-1 text-[12px] font-semibold">{badge}</span>
        )}
        <h2 className={`text-[15px] font-semibold ${featured ? 'text-white/80' : 'text-[#13233f]/60'}`}>{name}</h2>
        <div className="mt-5 flex items-baseline gap-2">
            <span className="text-[3.25rem] leading-none font-semibold tracking-[-0.04em]">{price}</span>
            <span className={`text-[14px] ${featured ? 'text-white/70' : 'text-[#1a2b4a]/50'}`}>{unit}</span>
        </div>
        <p className={`mt-3 text-[14px] min-h-[21px] ${featured ? 'text-white/70' : 'text-[#1a2b4a]/50'}`}>{note}</p>
        <div className="mt-8">{cta}</div>
        <ul className="mt-8 space-y-3.5">
            {features.map((f) => (
                <li key={f} className="flex gap-3 text-[15px]">
                    <FiCheck className={`mt-1 flex-shrink-0 ${featured ? 'text-[#c6f1ff]' : 'text-[#3468bd]'}`} aria-hidden />
                    <span className={featured ? 'text-white/90' : 'text-[#1a2b4a]/75'}>{f}</span>
                </li>
            ))}
        </ul>
    </div>
);

const Pricing = () => {
    const [currency, setCurrency] = useState('usd');
    const p = PRICES[currency];
    const savings = p.monthlyAnnual - p.yearlyTotal;

    return (
        <SiteLayout overlayHeader>
            <Seo
                title="Pricing | Veterinary AI Scribe Plans | PetWise"
                description={`PetWise pricing: ${TRIAL_DAYS} days unlimited free, then $${PRICES.usd.monthly} USD a month or $${PRICES.usd.yearly} USD a month billed yearly. PetWise Free stays available. No credit card to start.`}
                path="/pricing"
                jsonLd={[softwareLd, faqLd(FAQS)]}
            />

            <Hero
                eyebrow="Pricing"
                title={
                    <>
                        Unlimited records. <Highlight>One simple price.</Highlight>
                    </>
                }
                body={`Start with ${TRIAL_DAYS} days of everything, free. No credit card.`}
                after={
                    <div className="mt-10 inline-flex rounded-full border border-white/20 bg-white/[0.08] p-1 backdrop-blur" role="group" aria-label="Currency">
                        {['usd', 'cad'].map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setCurrency(c)}
                                aria-pressed={currency === c}
                                className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all ${
                                    currency === c ? 'bg-white text-[#2d5fb8] shadow-sm' : 'text-white/75 hover:text-white'
                                }`}
                            >
                                {c.toUpperCase()}
                            </button>
                        ))}
                    </div>
                }
            />

            <section className="bg-white">
                <Container className="pt-16 sm:pt-20 pb-20 sm:pb-28">
                    <div className="grid gap-5 lg:grid-cols-3 max-w-6xl mx-auto">
                        <Reveal>
                            <PlanCard
                                name="Free"
                                price={`${p.symbol}0`}
                                unit={`${p.code} / month`}
                                note={`After your ${TRIAL_DAYS} day trial`}
                                features={[
                                    `${TRIAL_DAYS} days unlimited to start`,
                                    `${FREE_DAILY.soap} SOAP notes a day`,
                                    `${FREE_DAILY.query} PetQuery questions a day`,
                                    'Saved records',
                                    'No credit card required'
                                ]}
                                cta={<SignupButton placement="pricing_free" variant="outline" className="w-full">Start free</SignupButton>}
                            />
                        </Reveal>
                        <Reveal delay={80}>
                            <PlanCard
                                featured
                                badge={`Save ${p.symbol}${savings}`}
                                name="Yearly"
                                price={`${p.symbol}${p.yearly}`}
                                unit={`${p.code} / month`}
                                note={`${p.symbol}${p.yearlyTotal.toLocaleString('en-US')} ${p.code} billed yearly`}
                                features={PLAN_FEATURES}
                                cta={<SignupButton placement="pricing_yearly" variant="light" className="w-full">Start free trial</SignupButton>}
                            />
                        </Reveal>
                        <Reveal delay={160}>
                            <PlanCard
                                name="Monthly"
                                price={`${p.symbol}${p.monthly}`}
                                unit={`${p.code} / month`}
                                note="Billed monthly. Cancel any time."
                                features={PLAN_FEATURES}
                                cta={<SignupButton placement="pricing_monthly" className="w-full">Start free trial</SignupButton>}
                            />
                        </Reveal>
                    </div>

                    <div className="mt-10 grid gap-4 sm:grid-cols-2 max-w-6xl mx-auto">
                        <div className="rounded-[24px] bg-[#f6f8fb] p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="font-semibold text-[#13233f]">Clinics and groups</h2>
                                <p className="mt-1 text-[15px] text-[#1a2b4a]/60">Team pricing for multi vet practices.</p>
                            </div>
                            <a href="mailto:support@petwise.vet?subject=Clinic%20pricing" className="text-[15px] font-medium text-[#3468bd] hover:underline underline-offset-4">
                                Contact us
                            </a>
                        </div>
                        <div className="rounded-[24px] bg-[#f6f8fb] p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="font-semibold text-[#13233f]">Vet students</h2>
                                <p className="mt-1 text-[15px] text-[#1a2b4a]/60">PetWise is free while you study.</p>
                            </div>
                            <Link to="/students" className="text-[15px] font-medium text-[#3468bd] hover:underline underline-offset-4">
                                Learn more
                            </Link>
                        </div>
                    </div>
                </Container>
            </section>

            <ImageBand
                src="/site/vet-on-petsoap.jpg"
                alt="A smiling veterinarian with a finished SOAP note on her computer"
                imageClassName="object-[60%_25%]"
                title="Every tool, every day, no limits."
                body="QuickSOAP, dictation, PetQuery, templates and client communication. One plan covers all of it."
            />
            <div className="h-3 sm:h-5 bg-white" />

            <FaqSection faqs={FAQS} tone="tint" />
            <div className="pt-3 sm:pt-5 bg-white">
                <CtaBand />
            </div>
        </SiteLayout>
    );
};

export default Pricing;
