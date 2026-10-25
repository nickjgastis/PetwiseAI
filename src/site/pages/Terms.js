import React from 'react';
import SiteLayout from '../SiteLayout';
import { Seo } from '../seo';
import { Container } from '../ui';
import TermsContent from '../../legal/TermsContent';

const Terms = () => {
    return (
        <SiteLayout>
            <Seo
                title="Terms of Service | PetWise"
                description="The terms and conditions that govern use of the PetWise veterinary AI scribe and clinical assistant."
                path="/terms"
            />
            <Container className="pt-14 sm:pt-24 pb-24 sm:pb-32">
                <div className="max-w-[720px] mx-auto">
                    <p className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#3468bd] mb-4">Legal</p>
                    <h1 className="text-[2.5rem] sm:text-[3.5rem] leading-[1.04] font-semibold tracking-[-0.035em] text-[#13233f]">Terms of Service</h1>
                    <section className="site-prose mt-10">
                        <TermsContent />
                    </section>
                </div>
            </Container>
        </SiteLayout>
    );
};

export default Terms; 