import React, { useState } from 'react';

const TermsOfService = ({ onAccept, onBack }) => {
    const [hasAccepted, setHasAccepted] = useState(false);

    const handleAccept = () => {
        if (hasAccepted) {
            onAccept({ emailOptOut: false });
        }
    };

    return (
        <div 
            className="fixed inset-0 z-50 bg-gradient-to-br from-[#1e3a6e] via-[#2a5298] to-[#3468bd] flex flex-col"
            style={{ overscrollBehavior: 'none' }}
        >
            {/* Progress bar area with back button */}
            <div className="flex-shrink-0 w-full px-4 sm:px-10 pt-4 sm:pt-6 relative z-10">
                <div className="max-w-5xl mx-auto flex items-center gap-3">
                    {onBack ? (
                        <button onClick={onBack} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-all">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    ) : (
                        <div className="w-8 flex-shrink-0" />
                    )}
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-[#3db6fd] rounded-full transition-all duration-700 ease-out"
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="flex-shrink-0 px-4 pt-4 pb-2 sm:px-8 sm:pt-5 sm:pb-3 text-center">
                <h1 className="text-xl sm:text-3xl font-bold text-white mb-1">Terms of Service & Privacy Policy</h1>
                <p className="text-white/60 text-xs sm:text-sm">Please read and accept our terms to continue</p>
            </div>

            {/* Scrollable terms area */}
            <div className="flex-1 overflow-y-auto mx-4 sm:mx-8 border border-white/10 rounded-xl bg-white/10 backdrop-blur-sm leading-relaxed p-4 sm:p-6" style={{ WebkitOverflowScrolling: 'touch' }}>
                <h2 className="text-2xl font-bold text-white mb-4 mt-6 first:mt-0">Terms of Service</h2>
                <p className="mb-4"><strong className="text-white/90">Effective Date:</strong> <span className="text-white/80">January 1, 2025</span></p>
                <p className="mb-4 text-white/85">
                    These Terms and Conditions govern the use of the PetWise service and website
                    (collectively referred to as "the Service"). By using the Service, you agree to be
                    bound by these Terms and Conditions.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">1. Acceptance of Terms</h3>
                <p className="mb-4 text-white/85">
                    By accessing or using PetWise, you acknowledge that you have read, understood, and
                    agree to be bound by these Terms and Conditions, including any additional terms,
                    conditions, or policies incorporated by reference.
                </p>
                <p className="mb-4 text-white/85">
                    Users must expressly acknowledge critical disclaimers, including limitations of
                    liability and the informational nature of AI-generated content, during onboarding.
                    Continued use of the Service constitutes acceptance of these Terms.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">2. Service Description</h3>
                <p className="mb-4 text-white/85">
                    PetWise is an AI-powered application designed to assist veterinary professionals in
                    generating detailed veterinary prognosis records ("Record Generator") and providing
                    quick medical suggestions ("QuickMed Query"). The Service enables users to input
                    patient information (such as species, breed, weight, clinical findings) and receive
                    AI-generated records or suggestions based on the provided data.
                </p>
                <p className="mb-4 text-white/85">
                    PetWise explicitly states that the Service is not a substitute for professional
                    veterinary judgment or advice.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">3. User Responsibilities</h3>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Accurate Information</h4>
                <p className="mb-4 text-white/85">
                    Users must provide accurate and complete information when using the Service. PetWise
                    is not responsible for any inaccuracies in the information provided by the user.
                </p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Verification by Licensed Veterinarian</h4>
                <p className="mb-4 text-white/85">
                    All veterinary records generated by the Record Generator and all outputs from the
                    QuickMed Query are intended for informational purposes only and must be reviewed and
                    verified by a licensed veterinarian. PetWise does not provide veterinary advice or
                    medical opinions and disclaims any liability for decisions made based on AI-generated
                    content.
                </p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Assumption of Risk</h4>
                <p className="mb-4 text-white/85">
                    Users acknowledge and accept that AI-generated records or suggestions from the
                    Record Generator and QuickMed Query may contain errors, omissions, or inaccuracies
                    and assume all risks associated with their use. Users waive any claims against
                    PetWise arising from reliance on AI-generated content.
                </p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Treatment Responsibility</h4>
                <p className="mb-4 text-white/85">
                    PetWise is not responsible for any treatments, diagnoses, or medical procedures
                    performed based on the information provided by the Record Generator or QuickMed Query.
                    Licensed veterinarians are solely responsible for all decisions and actions taken
                    based on these outputs.
                </p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Inputting and Storing Data</h4>
                <p className="mb-4 text-white/85">
                    Users are solely responsible for the content they input, generate, or save using the
                    Service. The platform is not intended for storing sensitive or personally
                    identifiable information ("PII") about clients, including but not limited to names,
                    addresses, phone numbers, and email addresses.
                </p>
                <ul className="list-disc list-inside mb-4 text-white/85 space-y-2 ml-4">
                    <li>Users agree not to input, store, or save any PII in records or other fields.</li>
                    <li>
                        Any PII entered or saved by users is done at their own risk, and users agree to
                        comply with applicable privacy laws and regulations.
                    </li>
                    <li>
                        PetWise reserves the right to delete or anonymize data suspected of containing PII.
                    </li>
                    <li>
                        PetWise does not monitor, review, or verify the content input or stored by users.
                        Users are solely responsible for ensuring compliance with applicable laws regarding
                        the data they input.
                    </li>
                </ul>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Consent for Third-Party Data</h4>
                <p className="mb-4 text-white/85">
                    Users must obtain all necessary consents from individuals whose data is input into
                    the Service. PetWise disclaims all liability for data input without proper
                    authorization or consent.
                </p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Indemnification</h4>
                <p className="mb-4 text-white/85">
                    Users agree to defend, indemnify, and hold PetWise harmless from any claims, damages,
                    or liabilities arising from their use of the Service, including but not limited to:
                </p>
                <ul className="list-disc list-inside mb-4 text-white/85 space-y-2 ml-4">
                    <li>Misuse of the platform, Record Generator, or QuickMed Query.</li>
                    <li>Input, storage, or sharing of unauthorized or sensitive data.</li>
                    <li>
                        Claims from third parties related to reliance on outputs from the Record Generator
                        or QuickMed Query.
                    </li>
                </ul>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">4. Subscription and Payment</h3>
                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Free Trial</h4>
                <p className="mb-4 text-white/85">PetWise offers a 14-day free trial for new users.</p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Subscription Fees</h4>
                <p className="mb-4 text-white/85">Subscriptions are charged on a monthly or yearly basis, as selected by the user.</p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Refunds</h4>
                <p className="mb-4 text-white/85">
                    Refunds for subscription payments are only available under exceptional circumstances,
                    such as incorrect billing or technical issues that prevent access to the Service. If
                    you believe you are entitled to a refund, please contact our support team within 30
                    days of the charge.
                </p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">No Refund for Record Generation or Queries</h4>
                <p className="mb-4 text-white/85">
                    Since PetWise provides digital content, all charges for record generation or QuickMed
                    Query usage are non-refundable. Users are encouraged to thoroughly review the Service
                    during their free trial.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">5. Data Protection and Privacy</h3>
                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Personal Information</h4>
                <p className="mb-4 text-white/85">
                    When signing up, PetWise collects personal information such as your name, email
                    address, and payment details through Auth0 and Stripe.
                </p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Veterinary Records and Queries</h4>
                <p className="mb-4 text-white/85">
                    Users may input and store patient-related data (species, breed, diagnosis, etc.) for
                    generating records or queries. The Service is not designed to store client data
                    (e.g., client names, phone numbers, addresses), and users are advised not to include
                    such information in stored records or query inputs.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">6. Limitation of Liability</h3>
                <p className="mb-4 text-white/85">To the fullest extent permitted by law:</p>
                <ul className="list-disc list-inside mb-4 text-white/85 space-y-2 ml-4">
                    <li>
                        PetWise is not liable for any direct, indirect, incidental, special, or
                        consequential damages arising from the use of the Service, including the Record
                        Generator or QuickMed Query.
                    </li>
                    <li>
                        PetWise is not responsible for the misuse of the platform, Record Generator, or
                        QuickMed Query by users.
                    </li>
                    <li>
                        PetWise disclaims all liability for errors, omissions, or decisions made based on
                        AI-generated content from the Record Generator or QuickMed Query.
                    </li>
                    <li>
                        Users waive all claims against PetWise related to the content or usage of
                        AI-generated records or suggestions.
                    </li>
                </ul>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">7. Governing Law and Dispute Resolution</h3>
                <p className="mb-4 text-white/85">
                    These Terms are governed by the laws of the jurisdiction in which PetWise operates.
                    Any disputes arising from the use of the Service will be resolved through binding
                    arbitration, with users waiving their right to participate in class action lawsuits.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">8. Modifications to Terms</h3>
                <p className="mb-4 text-white/85">
                    PetWise reserves the right to update these Terms and Conditions at any time. Changes
                    will be effective upon posting on the Service. Continued use of the Service
                    constitutes acceptance of the updated Terms.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">9. Contact Information</h3>
                <p className="mb-4 text-white/85">For any questions or concerns, please contact us at: support@petwise.vet</p>

                <h2 className="text-2xl font-bold text-white mb-4 mt-8">Privacy Policy</h2>
                <p className="mb-4"><strong className="text-white/85">Effective Date:</strong> January 1, 2025</p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">1. Data Collection</h3>
                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Personal Information</h4>
                <p className="mb-4 text-white/85">
                    We collect personal information such as your name, email address, and payment details through secure integrations with <strong>Auth0</strong> for authentication and <strong>Stripe</strong> for payment processing. Additional optional profile information may also be collected to improve user experience.
                </p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Veterinary Reports</h4>
                <p className="mb-4 text-white/85">
                    Users may input and store patient-related data, such as species, breed, diagnosis, and treatment details, to generate reports. The Service is not intended for storing sensitive client data (e.g., client names, phone numbers, addresses), and users are strongly advised not to input such information.
                </p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Device and Usage Data</h4>
                <p className="mb-4 text-white/85">
                    We may collect technical data, including device type, IP address, browser type, and usage patterns, to improve the Service's functionality and security. This data is anonymized and used for analytical purposes only.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">2. Data Usage</h3>
                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">User Authentication</h4>
                <p className="mb-4 text-white/85">We use <strong>Auth0</strong> to securely verify user identities and maintain secure account access.</p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Report Generation</h4>
                <p className="mb-4 text-white/85">
                    Data input into the platform is processed solely for creating detailed veterinary prognosis reports and is not shared with third parties for marketing or other purposes.
                </p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Subscription and Billing</h4>
                <p className="mb-4 text-white/85">Payment information is securely processed through <strong>Stripe</strong>, and we do not store credit card details on our servers.</p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Analytics and Improvements</h4>
                <p className="mb-4 text-white/85">
                    Anonymized and aggregated data may be used to identify trends, improve the Service, and ensure optimal performance.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">3. Data Security and Retention</h3>
                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Data Storage</h4>
                <p className="mb-4 text-white/85">All user data is securely stored using <strong>Supabase</strong>, with encryption applied during transmission and while at rest. Our systems are regularly updated to meet industry-leading security standards.</p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Reports Retention</h4>
                <p className="mb-4 text-white/85">
                    Reports are retained as long as your account remains active or until you delete them. Upon account deletion, all associated data, including veterinary reports, will be permanently removed unless retention is required by law (e.g., for tax or compliance reasons).
                </p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Access Controls</h4>
                <p className="mb-4 text-white/85">
                    Access to user data is restricted to authenticated users. Administrative access to system data is strictly limited to authorized personnel and audited regularly.
                </p>

                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Incident Response</h4>
                <p className="mb-4 text-white/85">
                    In the unlikely event of a data breach, affected users will be notified promptly, and corrective measures will be taken immediately.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">4. User Responsibility</h3>
                <ul className="list-disc list-inside mb-4 text-white/85 space-y-2 ml-4">
                    <li>Ensure that any data input complies with applicable privacy laws and regulations.</li>
                    <li>Avoid storing sensitive or personally identifiable client information in reports or other fields.</li>
                    <li>Obtain proper consent from clients or patients before inputting any data into the Service.</li>
                </ul>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">5. International Customers</h3>
                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Compliance with Global Standards</h4>
                <p className="mb-4 text-white/85">
                    PetWise is committed to complying with global data protection regulations, including:
                </p>
                <ul className="list-disc list-inside mb-4 text-white/85 space-y-2 ml-4">
                    <li>
                        <strong>GDPR (General Data Protection Regulation):</strong> For users in the European Union, ensuring lawful data processing, user rights, and data portability.
                    </li>
                    <li>
                        <strong>PIPEDA (Personal Information Protection and Electronic Documents Act):</strong> For Canadian users, ensuring compliance with federal and provincial privacy laws.
                    </li>
                </ul>
                <p className="mb-4 text-white/85">Users outside these jurisdictions are encouraged to ensure compliance with their local data privacy regulations.</p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">6. User Rights</h3>
                <p className="mb-4 text-white/85">We respect your rights to control your data. These include:</p>
                <ul className="list-disc list-inside mb-4 text-white/85 space-y-2 ml-4">
                    <li><strong>Right to Access:</strong> Users may request a copy of their stored data.</li>
                    <li><strong>Right to Rectification:</strong> Users may request corrections to inaccuracies in their data.</li>
                    <li><strong>Right to Erasure:</strong> Users may request deletion of their personal data at any time.</li>
                    <li>
                        <strong>Right to Restriction:</strong> Users may limit the processing of their data in specific scenarios.
                    </li>
                </ul>
                <p className="mb-4 text-white/85">
                    Requests can be sent to <strong>support@petwise.vet</strong>, and we will respond within the timeframe required by applicable laws.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">7. Third-Party Services</h3>
                <h4 className="text-lg font-medium text-white/85 mb-2 mt-4">Data Sharing</h4>
                <p className="mb-4 text-white/85">
                    PetWise integrates with trusted third-party services to provide seamless functionality:
                </p>
                <ul className="list-disc list-inside mb-4 text-white/85 space-y-2 ml-4">
                    <li><strong>Auth0:</strong> For secure user authentication.</li>
                    <li><strong>Stripe:</strong> For processing payments and subscriptions securely.</li>
                </ul>
                <p className="mb-4 text-white/85">
                    We do not sell or share your data with any third-party advertisers. Each third-party service has its own privacy policies, and we encourage users to review them.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">8. Cookies and Tracking</h3>
                <p className="mb-4 text-white/85">PetWise uses cookies to:</p>
                <ul className="list-disc list-inside mb-4 text-white/85 space-y-2 ml-4">
                    <li>Enhance user experience by remembering preferences.</li>
                    <li>Track usage patterns and analyze performance for service improvements.</li>
                </ul>
                <p className="mb-4 text-white/85">
                    Users can control cookie preferences through browser settings. Disabling cookies may affect certain features of the Service.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">9. Incident Reporting</h3>
                <p className="mb-4 text-white/85">
                    If you notice any suspicious activity related to your account or suspect a data breach, contact us immediately at <strong>support@petwise.vet</strong>. Our team will investigate and respond promptly.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">10. Updates to Privacy Policy</h3>
                <p className="mb-4 text-white/85">
                    We may update this Privacy Policy to reflect changes in regulations, technology, or our practices. Updates will be posted on our website, and significant changes will be communicated via email to registered users.
                </p>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">Acknowledgment of Responsibility</h3>
                <p className="mb-4 text-white/85">
                    By using PetWise, you agree to:
                </p>
                <ul className="list-disc list-inside mb-4 text-white/85 space-y-2 ml-4">
                    <li>Provide only necessary and lawful data.</li>
                    <li>Avoid storing sensitive or personally identifiable client information.</li>
                    <li>Take full responsibility for the accuracy and legality of any data you input or store on the platform.</li>
                </ul>

                <h3 className="text-xl font-semibold text-white mb-3 mt-6">Contact Us</h3>
                <p className="mb-4 text-white/85">
                    For questions, concerns, or requests regarding this Privacy Policy, please contact us at:
                </p>
                <p className="mb-4 text-white/85"><strong>Email:</strong> support@petwise.vet</p>

            </div>

            {/* Fixed bottom controls */}
            <div className="flex-shrink-0 px-4 py-3 sm:px-8 sm:py-4 bg-gradient-to-t from-[#1e3a6e] to-[#1e3a6e]/95 border-t border-white/10">
                <label className="flex items-center gap-3 p-2 sm:p-3 rounded-lg transition-colors duration-200 hover:bg-white/5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={hasAccepted}
                        onChange={(e) => setHasAccepted(e.target.checked)}
                        className="w-5 h-5 flex-shrink-0 text-[#3db6fd] bg-white/10 border-2 border-white/30 rounded focus:ring-[#3db6fd] focus:ring-2"
                    />
                    <span className="text-white/80 font-medium text-xs sm:text-sm">I have read and agree to the Terms of Service and Privacy Policy</span>
                </label>

                <button
                    onClick={handleAccept}
                    disabled={!hasAccepted}
                    className="w-full py-3 sm:py-3.5 bg-[#3db6fd] text-white font-semibold rounded-lg hover:bg-[#2da8ef] disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed transition-colors duration-200 mt-2 text-base sm:text-lg"
                >
                    Accept & Continue
                </button>
            </div>
        </div>
    );
};

export default TermsOfService;
