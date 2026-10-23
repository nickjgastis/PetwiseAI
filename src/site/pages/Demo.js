import React from 'react';
import SiteLayout from '../SiteLayout';
import { Seo } from '../seo';
import { Container, Highlight } from '../ui';

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
                <div className="max-w-4xl mx-auto overflow-hidden rounded-[28px] bg-white border border-[#e7ecf3] shadow-[0_30px_70px_-40px_rgba(19,35,63,0.35)]">
                    <iframe
                        title="Book a PetWise demo"
                        src="https://calendar.google.com/calendar/appointments/schedules/AcZssZ3PQ4gY09WOIVkRUKVviprRA-IcY_6RX1z_lfVZxwFFl2LLaC4wnTtRVwQgebSr0rRN2X3sxnIe?gv=true"
                        className="block w-full h-[1400px] md:h-[820px] border-0"
                        frameBorder="0"
                    />
                </div>
            </Container>
        </section>
    </SiteLayout>
);

export default Demo;
