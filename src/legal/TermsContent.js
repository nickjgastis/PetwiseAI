import React from 'react';
import { FREE_DAILY, TRIAL_DAYS } from '../constants/pricing';
import { LEGAL } from './meta';

const TermsContent = () => (
    <>
        <p><strong>Last updated:</strong> {LEGAL.updated}</p>
        <p>
            These Terms of Service ("Terms") are an agreement between you and {LEGAL.operator} ("PetWise", "we",
            "us"). They cover the PetWise website, web app, mobile app and every feature in them (the "Service").
            Please read them, especially Sections 4, 12, 13 and 15, which limit our liability and require
            disputes to be resolved by individual arbitration.
        </p>

        <h3>1. Agreeing to these Terms</h3>
        <p>
            You accept these Terms when you check the box at sign up, or by using the Service. If you use
            PetWise for a clinic or company, you confirm you can bind it, and "you" includes that clinic or
            company. If you do not agree, do not use the Service.
        </p>

        <h3>2. Who can use PetWise</h3>
        <ul>
            <li>You must be at least 18.</li>
            <li>
                PetWise is for licensed veterinarians, and for veterinary staff working under a licensed
                veterinarian's supervision.
            </li>
            <li>
                Veterinary students may use PetWise for education and supervised training only, not to make
                independent clinical decisions.
            </li>
            <li>The Service is offered in the United States and Canada.</li>
        </ul>

        <h3>3. The Service</h3>
        <p>
            PetWise turns dictations and typed notes into veterinary records (including SOAP notes, summaries,
            callbacks and dental charts), groups them into cases, and answers clinical questions through
            PetQuery. We use third-party artificial intelligence ("AI") models to do this. We may add, change or
            remove features at any time. Features labelled beta or new may be less reliable.
        </p>

        <h3>4. AI output and your professional responsibility</h3>
        <p>
            <strong>
                PetWise is a documentation and reference tool. It does not practice veterinary medicine, give
                veterinary advice, or create a veterinarian-client-patient relationship.
            </strong>
        </p>
        <ul>
            <li>
                AI output can be wrong, incomplete or out of date. It can mishear dictation, omit findings, or
                state incorrect doses, drug interactions or diagnoses.
            </li>
            <li>
                You must review and correct every record before it is used or filed, and verify every dose,
                drug and treatment against current references and product labels.
            </li>
            <li>
                You are the author of any record you sign, file or share, and you alone are responsible for
                diagnoses, treatment and every other clinical decision.
            </li>
            <li>Do not rely on the Service in an emergency or where a delay could harm an animal.</li>
        </ul>

        <h3>5. Medical records</h3>
        <p>
            PetWise is not a practice management or records system. You are responsible for keeping complete
            medical records in your own system for as long as the law and your licensing board require. Copy
            final records out of PetWise. We do not guarantee that anything stored in the Service will be kept,
            and it may be lost or deleted, including when an account is closed.
        </p>

        <h3>6. Your account</h3>
        <p>
            Keep your login private and do not share your account. Each subscription is for one person. You are
            responsible for activity under your account. Tell us right away at {LEGAL.email} if you think your
            account has been accessed without permission.
        </p>

        <h3>7. Your content</h3>
        <ul>
            <li>
                <strong>You own it.</strong> Recordings, notes, questions and other material you put in
                ("Inputs"), and the records and answers you get back ("Outputs"), are yours, as between you and
                us.
            </li>
            <li>
                <strong>License to us.</strong> You let us host, copy, process and transmit your Inputs and
                Outputs, including through our service providers, to run, secure, support and improve the
                Service.
            </li>
            <li>
                <strong>Aggregate data.</strong> We may create de-identified or aggregated data that does not
                identify you, a client or a clinic, and use it for any lawful purpose, including improving the
                Service.
            </li>
            <li>
                <strong>Client information.</strong> Include only the client and owner information you need. You
                are responsible for having the right to enter any personal information about clients or other
                people, and for following the privacy laws that apply to you. For that information we act on
                your behalf, as your service provider.
            </li>
            <li>
                <strong>Feedback.</strong> If you send us suggestions, we can use them without any obligation to
                you.
            </li>
        </ul>

        <h3>8. Acceptable use</h3>
        <p>You agree not to:</p>
        <ul>
            <li>use the Service for anything unlawful, or to harm animals or people;</li>
            <li>copy, resell, sublicense or share access to the Service;</li>
            <li>reverse engineer the Service, or try to extract its prompts, models or source code;</li>
            <li>scrape the Service or use automated tools against it, except as we allow;</li>
            <li>use the Service or its Outputs to build or train a competing product or AI model;</li>
            <li>probe, test or get around our security or usage limits; or</li>
            <li>upload malware or content you do not have the right to use.</li>
        </ul>

        <h3>9. Plans, trials and billing</h3>
        <ul>
            <li>
                <strong>Trial.</strong> New accounts get a {TRIAL_DAYS} day free trial with no credit card. When
                it ends, the account moves to PetWise Free unless you choose a paid plan.
            </li>
            <li>
                <strong>PetWise Free.</strong> Free accounts get a limited number of records and PetQuery
                questions each day (currently {FREE_DAILY.soap} SOAP notes and {FREE_DAILY.query} PetQuery
                questions). We may change these limits.
            </li>
            <li>
                <strong>Automatic renewal.</strong> Paid plans are billed in advance, monthly or yearly, and{' '}
                <strong>
                    renew automatically at the then-current price until you cancel
                </strong>
                . Payments are processed by Stripe.
            </li>
            <li>
                <strong>Cancelling.</strong> You can cancel any time in the app under Profile, Manage Subscription, or by
                emailing {LEGAL.email}. Your plan stays active until the end of the period you paid for and does
                not renew after that.
            </li>
            <li>
                <strong>Refunds.</strong> Except where the law requires otherwise, payments are non-refundable,
                including for partly used periods. We will refund billing errors and may give other refunds at
                our discretion. Contact us within 30 days of the charge.
            </li>
            <li>
                <strong>Price changes.</strong> We will email you at least 30 days before a price change takes
                effect on your renewal. You can cancel before then.
            </li>
            <li>
                <strong>Taxes and failed payments.</strong> Prices do not include taxes, which you pay where they
                apply. If a payment fails, we may retry it and may limit your account to PetWise Free until it
                is paid.
            </li>
            <li>
                <strong>Student access.</strong> Free student access is at our discretion and may be checked,
                changed or ended at any time.
            </li>
        </ul>

        <h3>10. Third-party services</h3>
        <p>
            The Service relies on providers such as OpenAI, Stripe, Auth0, Supabase and Vercel. We are not
            responsible for their outages, errors or changes, or for any third-party sites or services you
            choose to use with PetWise.
        </p>

        <h3>11. Suspension and termination</h3>
        <p>
            You can stop using PetWise and delete your account at any time in the app. We may suspend or end
            your access if you break these Terms, do not pay, create risk or legal exposure for us or others, or
            if we stop offering the Service. Where reasonable we will give notice first. When an account ends,
            its data may be deleted as described in our Privacy Policy, so export anything you need beforehand.
            Sections 4, 5, 7, 12, 13, 14, 15 and 17 survive termination.
        </p>

        <h3>12. Disclaimer of warranties</h3>
        <p>
            <strong>
                THE SERVICE AND ALL OUTPUTS ARE PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY
                KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
                PURPOSE, ACCURACY, TITLE AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT OUTPUTS WILL BE ACCURATE,
                COMPLETE OR CLINICALLY APPROPRIATE, OR THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE OR ERROR
                FREE, OR THAT DATA WILL NOT BE LOST.
            </strong>
        </p>

        <h3>13. Limitation of liability</h3>
        <p>
            <strong>
                TO THE FULLEST EXTENT PERMITTED BY LAW: (A) PETWISE WILL NOT BE LIABLE FOR ANY INDIRECT,
                INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE,
                DATA OR GOODWILL, OR FOR THE INJURY, ILLNESS OR DEATH OF ANY ANIMAL, ARISING FROM THE SERVICE OR
                ANY OUTPUT, EVEN IF WE WERE TOLD THEY WERE POSSIBLE; AND (B) OUR TOTAL LIABILITY FOR ALL CLAIMS
                RELATING TO THE SERVICE OR THESE TERMS WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU PAID US IN
                THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM, OR US$100.
            </strong>
        </p>
        <p>
            These limits apply to every theory of liability, including contract, tort and negligence, and are
            part of the basis of our prices. Some places do not allow certain limits, so some of them may not
            apply to you.
        </p>

        <h3>14. Indemnification</h3>
        <p>
            You will defend, indemnify and hold harmless PetWise and its owners, contractors and agents from
            claims, losses and costs (including reasonable legal fees) brought by third parties, including
            clients, animal owners and regulators, that arise from your Inputs, your clinical decisions or use
            of Outputs, your breach of these Terms, or your violation of any law or anyone else's rights.
        </p>

        <h3>15. Disputes and arbitration</h3>
        <ul>
            <li>
                <strong>Governing law.</strong> These Terms are governed by the laws of the State of{' '}
                {LEGAL.state} and applicable US federal law, without regard to conflict of laws rules.
            </li>
            <li>
                <strong>Talk to us first.</strong> Before filing any claim, email {LEGAL.email} with a description
                of the dispute. We both agree to try in good faith to resolve it within 30 days.
            </li>
            <li>
                <strong>Arbitration.</strong> If it is not resolved, any dispute arising from these Terms or the
                Service will be decided by binding individual arbitration administered by the American
                Arbitration Association under its applicable rules, held in {LEGAL.state} or by video, and judgment
                on the award may be entered in any court with jurisdiction. Either of us may instead bring an
                individual claim in small claims court, or seek a court order to stop infringement or misuse of
                intellectual property.
            </li>
            <li>
                <strong>
                    No class actions or jury trials. Claims may be brought only individually, not as a plaintiff
                    or class member in any class, collective or representative proceeding, and we both waive the
                    right to a jury trial.
                </strong>
            </li>
            <li>
                <strong>Opting out.</strong> You can opt out of arbitration by emailing {LEGAL.email} within 30
                days of first accepting these Terms, with your name, account email and a clear statement that
                you opt out.
            </li>
            <li>
                <strong>Time limit.</strong> To the extent the law allows, any claim must be brought within one
                year after it arises.
            </li>
            <li>
                Any claim not subject to arbitration will be heard only in the state or federal courts located
                in {LEGAL.state}, and we both consent to their jurisdiction.
            </li>
        </ul>

        <h3>16. Changes to these Terms</h3>
        <p>
            We may update these Terms. For material changes we will email you or ask you to accept the new
            version in the app, and the changes take effect 30 days after notice, or when you accept them if
            sooner. Changes do not apply to disputes that arose before they took effect. If you do not agree,
            stop using the Service and cancel before the changes take effect.
        </p>

        <h3>17. General</h3>
        <ul>
            <li>These Terms and our Privacy Policy are the entire agreement between us about the Service.</li>
            <li>If any part of these Terms is unenforceable, the rest stays in effect.</li>
            <li>Not enforcing a term is not a waiver of it.</li>
            <li>
                You may not transfer these Terms without our consent. We may transfer them, including to a
                company we form or a buyer of the Service.
            </li>
            <li>We are not responsible for delays or failures caused by events outside our reasonable control.</li>
            <li>We can send you notices by email to your account address or in the app.</li>
        </ul>

        <h3>18. Contact</h3>
        <p>
            {LEGAL.operator}
            <br />
            {LEGAL.address}
            <br />
            <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
        </p>
    </>
);

export default TermsContent;
