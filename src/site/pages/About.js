import React from 'react';
import SiteLayout from '../SiteLayout';
import { Seo, organizationLd } from '../seo';
import {
    CtaBand,
    SplitHero,
    Highlight,
    Photo,
    Reveal,
    Section,
    SectionHeading,
    Testimonials
} from '../ui';

const VALUES = [
    { title: 'Built with vets', body: 'Every feature starts in the clinic. If it does not save a vet time on a real day, it does not ship.' },
    { title: 'Your judgment first', body: 'PetWise drafts, you decide. Nothing goes into a record until you have reviewed it.' },
    { title: 'Simple on purpose', body: 'No training days and no new hardware. Open it on your next appointment and it works.' }
];

const About = () => (
    <SiteLayout>
        <Seo
            title="About PetWise | Built by a Veterinarian and a Developer"
            description="PetWise was founded by Dr. Stacey Gastis, DVM, with over 30 years in clinical practice, and his son Nick Gastis, a developer, to give veterinarians their time back."
            path="/about"
            jsonLd={organizationLd}
        />

        <SplitHero
            eyebrow="About PetWise"
            title={
                <>
                    Built by a vet, <Highlight dark>for vets.</Highlight>
                </>
            }
            body="A father and son on a simple mission: give veterinarians their evenings back."
            image="/site/founders.jpg"
            imageAlt="Nick Gastis and Dr. Stacey Gastis fly fishing"
            imageClassName="object-[center_60%]"
        />

        <Section>
            <div className="grid lg:grid-cols-12 gap-12">
                <Reveal className="lg:col-span-4">
                    <h2 className="text-[2rem] sm:text-[2.5rem] leading-[1.1] font-semibold tracking-[-0.025em] text-[#13233f]">Our story</h2>
                    <div className="mt-8 overflow-hidden rounded-[24px] aspect-[4/3] max-w-sm">
                        <Photo src="/site/dr-gastis.jpg" alt="Dr. Stacey Gastis, DVM, co-founder of PetWise" />
                    </div>
                </Reveal>
                <Reveal className="lg:col-span-7 lg:col-start-6 space-y-6 text-lg leading-relaxed text-[#1a2b4a]/70" delay={100}>
                    <p>
                        Dr. Stacey Gastis, BSc, DVM, has spent more than 30 years in clinical practice. Like most vets, he watched the paperwork grow every year, until the records took longer than the appointments.
                    </p>
                    <p>
                        His son Nick, a developer, saw the same thing from the outside: talented vets staying late, night after night, just to finish their notes. So he built a solution.
                    </p>
                    <p>
                        Together they created PetWise, a veterinary AI scribe and clinical assistant shaped by real clinic days. Today it helps veterinarians and their teams across North America save hours every week.
                    </p>
                </Reveal>
            </div>
        </Section>

        <Section tone="tint">
            <SectionHeading eyebrow="What we believe" title="Technology should fit the clinic, not the other way around." />
            <div className="grid gap-10 md:grid-cols-3">
                {VALUES.map((v, i) => (
                    <Reveal key={v.title} delay={i * 90}>
                        <div className="h-px bg-[#13233f]/10" />
                        <h3 className="mt-6 text-xl font-semibold tracking-tight text-[#13233f]">{v.title}</h3>
                        <p className="mt-2 text-[15px] leading-relaxed text-[#1a2b4a]/60">{v.body}</p>
                    </Reveal>
                ))}
            </div>
        </Section>

        <Section>
            <SectionHeading eyebrow="Founders" title="The people behind PetWise." />
            <div className="grid gap-5 md:grid-cols-2">
                {[
                    { name: 'Dr. Stacey Gastis, BSc, DVM', role: 'Co-founder', bio: 'Practicing veterinarian with over 30 years of clinical experience. Leads clinical direction and makes sure every record reads like a vet wrote it.', photo: '/site/dr-gastis.jpg' },
                    { name: 'Nick Gastis', role: 'CEO and Chief Developer', bio: 'Builds the product and works directly with clinics to turn their feedback into features, often within days.', photo: '/site/nick-gastis.png' }
                ].map((f, i) => (
                    <Reveal key={f.name} delay={i * 90}>
                        <div className="h-full rounded-[28px] border border-[#e7ecf3] p-8 flex gap-5">
                            <img src={f.photo} alt={f.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" loading="lazy" />
                            <div>
                                <h3 className="text-lg font-semibold text-[#13233f]">{f.name}</h3>
                                <p className="text-[14px] text-[#3468bd]">{f.role}</p>
                                <p className="mt-3 text-[15px] leading-relaxed text-[#1a2b4a]/60">{f.bio}</p>
                            </div>
                        </div>
                    </Reveal>
                ))}
            </div>
        </Section>

        <Testimonials tone="tint" />
        <div className="pt-3 sm:pt-5 bg-white">
            <CtaBand />
        </div>
    </SiteLayout>
);

export default About;
