import React from 'react';
import SiteLayout from '../SiteLayout';
import { Seo } from '../seo';
import { Container, CtaBand, Reveal, RoundedPhoto } from '../ui';

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
        <section className="bg-white">
            <Container className="pt-14 sm:pt-24 pb-20 sm:pb-28">
                <div className="grid lg:grid-cols-12 gap-14 items-center">
                    <div className="lg:col-span-7">
                        <p className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#3468bd] mb-4">Mobile app</p>
                        <h1 className="text-[2.75rem] sm:text-[4rem] leading-[1.02] font-semibold tracking-[-0.04em] text-[#13233f]">PetWise, in your pocket.</h1>
                        <p className="mt-6 text-lg sm:text-xl leading-relaxed text-[#1a2b4a]/65 max-w-xl">
                            Install PetWise on your phone in seconds, no app store required. Dictate between rooms and finish on your desktop.
                        </p>
                    </div>
                    <div className="lg:col-span-4 lg:col-start-9">
                        <div className="rounded-[28px] border border-[#e7ecf3] p-8 text-center">
                            <img src="/PW QR CODE.png" alt="QR code to open PetWise on your phone" className="mx-auto w-48 h-48" loading="lazy" />
                            <p className="mt-5 text-[15px] text-[#1a2b4a]/60">
                                Scan with your phone camera, or go to <span className="font-medium text-[#13233f]">petwise.vet</span>
                            </p>
                        </div>
                    </div>
                </div>

                <Reveal className="mt-16 sm:mt-20">
                    <RoundedPhoto
                        src="/site/vet-phone.jpg"
                        alt="A veterinarian checking PetWise on his phone outside the clinic"
                        aspect="aspect-[16/10] sm:aspect-[21/9]"
                        className="object-[50%_30%]"
                    />
                </Reveal>

                <div className="mt-16 sm:mt-20 grid gap-5 md:grid-cols-2">
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
