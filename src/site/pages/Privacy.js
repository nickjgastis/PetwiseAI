import React from 'react';
import SiteLayout from '../SiteLayout';
import { Seo } from '../seo';
import { Container } from '../ui';
import PrivacyContent from '../../legal/PrivacyContent';

const Privacy = () => {
    return (
        <SiteLayout>
            <Seo
                title="Privacy Policy | PetWise"
                description="How PetWise collects, uses and protects your information, including authentication, payments and veterinary report data."
                path="/privacy"
            />
            <Container className="pt-14 sm:pt-24 pb-24 sm:pb-32">
                <div className="max-w-[720px] mx-auto">
                    <p className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#3468bd] mb-4">Legal</p>
                    <h1 className="text-[2.5rem] sm:text-[3.5rem] leading-[1.04] font-semibold tracking-[-0.035em] text-[#13233f]">Privacy Policy</h1>
                    <section className="site-prose mt-10">
                        <PrivacyContent />
                    </section>
                </div>
            </Container>
        </SiteLayout>
    );
};

export default Privacy; 