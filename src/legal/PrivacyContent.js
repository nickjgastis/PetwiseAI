import React from 'react';
import { LEGAL } from './meta';

const PrivacyContent = () => (
    <>
        <p><strong>Last updated:</strong> {LEGAL.updated}</p>
        <p>
            This policy explains what {LEGAL.operator} ("PetWise", "we", "us") collects when you use the PetWise
            website, web app and mobile app (the "Service"), how we use it, who we share it with, and the choices
            you have.
        </p>

        <h3>1. What we collect</h3>
        <ul>
            <li>
                <strong>Account details:</strong> name, email, phone number, account type, and for students, school
                email and graduation year. Sign in is handled by Auth0.
            </li>
            <li>
                <strong>Clinical content:</strong> what you dictate, type or upload, and what the Service produces
                from it. This includes transcripts, notes, records, dental charts, pet names, case details,
                templates and PetQuery questions and answers.
            </li>
            <li>
                <strong>Billing details:</strong> plan, billing history and the last digits of your card. Stripe
                processes payments, and we never see or store full card numbers.
            </li>
            <li>
                <strong>Usage data:</strong> which features you use and when, such as the number of records and
                questions per day.
            </li>
            <li>
                <strong>Device data:</strong> IP address, browser, device type, pages viewed and similar data
                collected through cookies, local storage, Google Analytics and the Meta Pixel.
            </li>
            <li>
                <strong>Communications:</strong> emails, calls and support requests between you and us.
            </li>
        </ul>

        <h3>2. Audio recordings</h3>
        <p>
            When you dictate, audio is recorded in your browser and sent to our servers and to OpenAI to be
            transcribed. We do not keep the audio after it is transcribed. The transcript and the records made
            from it are saved to your account until you delete them.
        </p>

        <h3>3. How we use it</h3>
        <ul>
            <li>to provide the Service, including generating records and answering questions;</li>
            <li>to run your account, process payments and enforce plan limits;</li>
            <li>to send account, billing and product emails, and to contact you by email or phone about your account;</li>
            <li>to provide support and to understand and improve the Service;</li>
            <li>to measure and advertise PetWise, using Google Analytics and the Meta Pixel; and</li>
            <li>to keep the Service secure, prevent abuse, and meet legal obligations.</li>
        </ul>
        <p>
            We may create de-identified or aggregated data that does not identify you, a client or a clinic, and
            use it to improve the Service.
        </p>

        <h3>4. AI processing</h3>
        <p>
            Your clinical content is sent to OpenAI to transcribe audio, write records and answer questions.
            Under OpenAI's API terms, this data is not used to train OpenAI's models, and OpenAI may keep it for up
            to 30 days to monitor for abuse before deleting it. We do not use your clinical content to train AI
            models.
        </p>

        <h3>5. Client and owner information</h3>
        <p>
            Please include only the client and owner details you need. If your records do contain personal
            information about clients or other people, you or your clinic decide what is collected and why, and
            we process it on your behalf, only to provide the Service. Requests from your clients about that
            information should go to you, and we will help you respond to them.
        </p>

        <h3>6. Who we share it with</h3>
        <p>
            We share information with service providers that help us run PetWise, including OpenAI for AI
            processing, and providers for hosting, databases, sign in, payments, email, customer support,
            analytics and advertising. We may also share information when the law requires it, to protect the
            rights or safety of PetWise, our users or others, or as part of a business transfer such as forming
            a company or selling the Service.
        </p>
        <p>
            We do not sell your information for money. Google Analytics and the Meta Pixel collect device and
            usage data for analytics and advertising, which some state laws treat as "sharing" or "targeted
            advertising". We never send clinical content to Google or Meta.
        </p>

        <h3>7. Cookies and similar technology</h3>
        <p>
            We use cookies and browser storage to keep you signed in, remember settings and drafts, and measure
            use. Google Analytics and the Meta Pixel set their own cookies. You can block or delete cookies in
            your browser, use the{' '}
            <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">
                Google Analytics opt-out add-on
            </a>
            , and manage ad settings in your{' '}
            <a href="https://www.facebook.com/adpreferences" target="_blank" rel="noopener noreferrer">
                Meta account
            </a>
            . Blocking essential cookies or storage may stop the app working.
        </p>

        <h3>8. How long we keep it</h3>
        <p>
            We keep your records until you delete them or your account. When you delete your account, we delete
            your account and records from our systems. Some information may be kept longer where the law
            requires it, in backups until they expire, or in our service providers' and support records.
        </p>

        <h3>9. Security</h3>
        <p>
            We use reasonable safeguards, including encryption in transit and access controls. No system is completely secure, and we cannot guarantee the security of
            information. If a breach affects your personal information, we will notify you as the law requires.
            Keep your login private and tell us at {LEGAL.email} if you suspect a problem.
        </p>

        <h3>10. Your choices and rights</h3>
        <ul>
            <li>See and edit your profile in the app, and delete records at any time.</li>
            <li>Delete your account in the app under Profile, Account.</li>
            <li>Unsubscribe from marketing emails with the link in any of them. Account and billing emails still apply.</li>
            <li>
                Depending on where you live, you may have the right to access, correct, delete or get a copy of
                your personal information, and to opt out of targeted advertising. Email {LEGAL.email}. We will
                verify your identity and respond within the time the law requires, and will not treat you
                differently for asking.
            </li>
        </ul>

        <h3>11. Where we process data</h3>
        <p>
            PetWise is offered in the United States and Canada. Your information is stored and processed in the
            United States and other countries where our providers operate, where privacy laws may differ from
            those where you live, and it may be accessible to authorities in those countries.
        </p>

        <h3>12. Children</h3>
        <p>
            The Service is for adult professionals and is not directed to anyone under 18. We do not knowingly
            collect information from children.
        </p>

        <h3>13. Changes to this policy</h3>
        <p>
            We may update this policy and will change the date at the top when we do. For material changes we
            will email you or notify you in the app before they take effect.
        </p>

        <h3>14. Contact</h3>
        <p>
            {LEGAL.operator}
            <br />
            {LEGAL.address}
            <br />
            <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
        </p>
    </>
);

export default PrivacyContent;
