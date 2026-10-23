import React from 'react';
import { FiArrowRight, FiCheck, FiVideo } from 'react-icons/fi';
import SiteLayout from '../SiteLayout';
import { Seo } from '../seo';
import { Container, Highlight } from '../ui';

const BOOKING_URL = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ3PQ4gY09WOIVkRUKVviprRA-IcY_6RX1z_lfVZxwFFl2LLaC4wnTtRVwQgebSr0rRN2X3sxnIe?gv=true';
const POINTS = ['A walkthrough of your real workflows', 'Free trial setup', 'Bring your team, share the link'];

const track = () => window.gtag?.('event', 'site_cta', { label: 'book_demo_open_calendar', page_path: '/demo' });

// Phones get Google's own booking page (full screen, native scrolling); the embed is desktop only.
const PhoneCard = () => (
    <div className="md:hidden max-w-md mx-auto rounded-[28px] bg-white border border-[#e7ecf3] shadow-[0_30px_70px_-40px_rgba(19,35,63,0.35)] p-6">
        <div className="flex items-center gap-3.5">
            <img src="/site/dr-gastis.jpg" alt="Dr. Stacey Gastis" className="w-14 h-14 rounded-full object-cover" />
            <div>
                <p className="m-0 text-[16px] font-semibold text-[#13233f]">Dr. Stacey Gastis, DVM</p>
                <p className="m-0 mt-0.5 inline-flex items-center gap-1.5 text-[13.5px] text-[#1a2b4a]/60">
                    <FiVideo className="text-[13px]" />
                    Video call on Google Meet
                </p>
            </div>
        </div>
        <ul className="m-0 mt-5 p-0 list-none space-y-2.5">
            {POINTS.map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-[15px] text-[#1a2b4a]/75">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-[#e9f6fd] text-[#3468bd] flex items-center justify-center">
                        <FiCheck className="text-[12px]" />
                    </span>
                    {p}
                </li>
            ))}
        </ul>
        <a
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={track}
            className="mt-6 flex items-center justify-center gap-2 w-full rounded-full px-6 py-3.5 text-[15px] font-medium text-white bg-[#2d5fb8] hover:bg-[#2350a3] shadow-[0_10px_30px_-12px_rgba(45,95,184,0.7)] no-underline"
        >
            Pick a time
            <FiArrowRight />
        </a>
    </div>
);

const Demo = () => (
    <SiteLayout>
        <Seo
            title="Book a Demo | PetWise Veterinary AI Scribe"
            description="Book a free one on one demo with Stacey Gastis, DVM. A walkthrough of your real clinical workflows, with free trial setup. Bring your team."
            path="/demo"
        />
        <section className="bg-[#f6f8fb]">
            <Container className="pt-10 sm:pt-14 pb-20 sm:pb-28">
                <div className="max-w-2xl mx-auto text-center mb-10 sm:mb-12">
                    <p className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#3468bd]">Book a demo</p>
                    <h1 className="mt-4 text-[2.25rem] sm:text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.035em] text-[#13233f]">
                        One on one with <span className="whitespace-nowrap"><Highlight dark>Dr. Gastis.</Highlight></span>
                    </h1>
                    <p className="mt-4 text-lg text-[#1a2b4a]/65">A walkthrough of your real workflows, with free trial setup. Bring your team.</p>
                </div>
                <PhoneCard />
                <div className="hidden md:block max-w-4xl mx-auto overflow-hidden rounded-[28px] bg-white border border-[#e7ecf3] shadow-[0_30px_70px_-40px_rgba(19,35,63,0.35)]">
                    <iframe title="Book a PetWise demo" src={BOOKING_URL} className="block w-full h-[820px] border-0" frameBorder="0" loading="lazy" />
                </div>
                <p className="hidden md:block mt-5 text-center text-[13.5px] text-[#1a2b4a]/50">
                    Calendar not loading?{' '}
                    <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" onClick={track} className="text-[#3468bd] font-medium">
                        Open it in Google Calendar
                    </a>
                </p>
            </Container>
        </section>
    </SiteLayout>
);

export default Demo;
