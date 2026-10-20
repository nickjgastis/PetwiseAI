import React from 'react';
import SiteLayout from '../SiteLayout';
import { Seo } from '../seo';
import { Container, CtaBand, Highlight, Reveal, SplitHero } from '../ui';

const PLATFORMS = [
    {
        name: 'iPhone and iPad',
        browser: 'Use Safari',
        steps: ['Open petwise.vet in Safari', 'Tap the Share button', 'Tap “Add to Home Screen”', 'Open PetWise from your home screen and sign in']
    },
    {
        name: 'Android',
        browser: 'Use Chrome',
        steps: ['Open petwise.vet in Chrome', 'Tap the menu in the top right', 'Tap “Install app” or “Add to Home screen”', 'Open PetWise from your home screen and sign in']
    }
];

const Install = () => (
    <SiteLayout>
        <Seo
            title="Get the PetWise App on iPhone and Android"
            description="Install PetWise on your phone in seconds. Dictate SOAP notes between rooms and they sync to your desktop automatically. No app store needed."
            path="/install"
        />
        <SplitHero
            eyebrow="Mobile app"
            title={
                <>
                    PetWise, <Highlight dark>in your pocket.</Highlight>
                </>
            }
            body="Install PetWise on your phone in seconds, no app store required. Dictate between rooms and finish on your desktop."
            image="/site/vet-phone.jpg"
            imageAlt="A veterinarian checking PetWise on his phone outside the clinic"
            imageClassName="object-[30%_center]"
            badge={
                <div className="hidden sm:flex items-center gap-4 rounded-2xl bg-white p-3 pr-6 shadow-[0_24px_50px_-20px_rgba(19,35,63,0.45)] ring-1 ring-[#13233f]/[0.06]">
                    <img src="/PW QR CODE.png" alt="QR code to open PetWise on your phone" className="w-20 h-20" />
                    <div>
                        <p className="text-[15px] font-semibold text-[#13233f]">Scan to open</p>
                        <p className="text-[13px] text-[#1a2b4a]/55">Point your phone camera here</p>
                    </div>
                </div>
            }
        />
        <section className="bg-white">
            <Container className="pb-20 sm:pb-28">
                <div className="grid gap-5 md:grid-cols-2">
                    {PLATFORMS.map((p, i) => (
                        <Reveal key={p.name} delay={i * 90}>
                            <div className="h-full rounded-[28px] bg-[#f6f8fb] p-8 sm:p-10">
                                <h2 className="text-2xl font-semibold tracking-tight text-[#13233f]">{p.name}</h2>
                                <p className="mt-1 text-[14px] text-[#3468bd]">{p.browser}</p>
                                <ol className="mt-8 space-y-5">
                                    {p.steps.map((s, n) => (
                                        <li key={s} className="flex gap-4">
                                            <span className="w-7 h-7 flex-shrink-0 rounded-full bg-white text-[13px] font-semibold text-[#13233f] flex items-center justify-center">
                                                {n + 1}
                                            </span>
                                            <span className="pt-0.5 text-[16px] text-[#1a2b4a]/75">{s}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        </Reveal>
                    ))}
                </div>
                <p className="mt-8 text-[14px] text-[#1a2b4a]/50">
                    Opening from Instagram or Facebook? Open the link in Safari or Chrome first. In-app browsers cannot install apps.
                </p>
            </Container>
        </section>
        <CtaBand title="New to PetWise? Start free on your phone or desktop." />
    </SiteLayout>
);

export default Install;
