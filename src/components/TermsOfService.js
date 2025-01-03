import React, { useState, useEffect } from 'react';
import '../styles/TermsOfService.css';

const TermsOfService = ({ onAccept }) => {
    const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
    const [hasAccepted, setHasAccepted] = useState(false);
    const [emailOptOut, setEmailOptOut] = useState(false);

    useEffect(() => {
        const element = document.querySelector('.terms-content');
        if (element) {
            const checkScroll = () => {
                const scrolledToBottom =
                    Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) <= 1;
                setIsScrolledToBottom(scrolledToBottom);
            };

            // Check initial state
            checkScroll();

            // Add scroll listener
            element.addEventListener('scroll', checkScroll);

            // Cleanup
            return () => element.removeEventListener('scroll', checkScroll);
        }
    }, []);

    const handleAccept = () => {
        if (isScrolledToBottom && hasAccepted) {
            console.log('Email opt out value:', emailOptOut);
            onAccept({ emailOptOut });
        }
    };

    return (
        <div className="terms-container">
            <h2>Terms of Service & Privacy Policy</h2>

            {!isScrolledToBottom && (
                <div className="scroll-notice">
                    Please scroll to the bottom to accept
                </div>
            )}

            <div className="terms-content">
                <h2>Terms and Conditions</h2>
                <p><strong>Effective Date: January 1, 2024</strong></p>

                <p>These Terms and Conditions govern the use of the PetwiseAI service and website (collectively referred to as "the Service"). By using the Service, you agree to be bound by these Terms and Conditions.</p>

                <h3>1. Acceptance of Terms</h3>
                <p>By accessing or using PetwiseAI, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions, including any additional terms, conditions, or policies incorporated by reference.</p>

                <h3>2. Service Description</h3>
                <p>PetwiseAI is an AI-powered application designed to assist veterinary professionals in generating detailed veterinary prognosis reports. The service enables users to input patient information (such as species, breed, weight, clinical findings) and receive AI-generated veterinary reports based on the provided data.</p>

                <h3>3. User Responsibilities</h3>

                <h4>Accurate Information</h4>
                <p>Users must provide accurate and complete information when using the Service. PetwiseAI is not responsible for any inaccuracies in the information provided by the user.</p>

                <h4>Verification by Licensed Veterinarian</h4>
                <p>All veterinary reports generated by PetwiseAI are intended for informational purposes only and must be reviewed and verified by a licensed veterinarian. PetwiseAI does not provide veterinary advice or medical opinions and is not a substitute for professional veterinary judgment.</p>

                <h4>Treatment Responsibility</h4>
                <p>PetwiseAI is not responsible for any treatments, diagnoses, or medical procedures performed based on the information provided by the generated reports.</p>

                <h4>Inputting and Storing Data</h4>
                <p>Users are solely responsible for the content they input, generate, or save using the Service. The platform is not intended for storing sensitive or personally identifiable information ("PII") about clients, including but not limited to names, addresses, phone numbers, and email addresses.</p>

                <ul>
                    <li>Users agree not to input, store, or save any PII in reports or other fields.</li>
                    <li>Any PII entered or saved by users is done at their own risk, and users agree to comply with applicable privacy laws and regulations.</li>
                    <li>PetwiseAI reserves the right to delete or anonymize data suspected of containing PII.</li>
                    <li>PetwiseAI does not monitor, review, or verify the content input or stored by users. Users are solely responsible for ensuring compliance with applicable laws regarding the data they input.</li>
                </ul>

                <h3>4. Subscription and Payment</h3>

                <h4>Free Trial</h4>
                <p>PetwiseAI offers a 7-day free trial for new users.</p>

                <h4>Subscription Fees</h4>
                <p>Subscriptions are charged on a monthly or yearly basis, as selected by the user.</p>

                <h4>Refunds</h4>
                <p>All subscription fees are non-refundable except under exceptional circumstances.</p>

                <h3>5. Data Protection and Privacy</h3>
                <p>PetwiseAI is committed to safeguarding your personal data. Please refer to our Privacy Policy for details on how we collect, store, and protect your data.</p>

                <h4>Security Disclaimer</h4>
                <p>PetwiseAI employs industry-standard security measures to protect data, including encryption in transit and at rest. However, no system can guarantee absolute security. By using the Service, you acknowledge that data breaches, hacking, or other unauthorized access may occur and agree that PetwiseAI is not liable for such incidents.</p>

                <h3>6. Limitation of Liability</h3>
                <p>To the fullest extent permitted by law:</p>
                <ol>
                    <li>PetwiseAI is not liable for any direct, indirect, incidental, special, or consequential damages arising from the use of the Service.</li>
                    <li>PetwiseAI is not responsible for the misuse of the platform by users, including the storage or sharing of PII.</li>
                    <li>Users agree to indemnify and hold PetwiseAI harmless from any claims or damages arising from their use of the Service, including claims related to stored client or patient information.</li>
                    <li>PetwiseAI disclaims all liability for errors, omissions, or decisions made based on AI-generated content.</li>
                    <li>PetwiseAI is not liable for data loss, service interruptions, or technical issues. Users are encouraged to back up their data regularly.</li>
                </ol>

                <h3>7. Prohibited Uses</h3>
                <p>Users agree not to:</p>
                <ul>
                    <li>Use the Service for any unlawful purpose.</li>
                    <li>Attempt to manipulate or reverse engineer the Service.</li>
                    <li>Input, store, or save sensitive or personally identifiable client data (e.g., names, addresses, phone numbers, email addresses).</li>
                    <li>Use the Service to transmit harmful, defamatory, or unlawful content.</li>
                    <li>Store data obtained unlawfully or without proper authorization.</li>
                </ul>

                <h3>8. Contact Information</h3>
                <p>Email: support@petwise.vet</p>

                <hr className="section-divider" />

                <h2>Return and Refund Policy</h2>
                <p><strong>Effective Date: January 1, 2024</strong></p>

                <p>At PetwiseAI, we strive to provide the best service to veterinary professionals. Please read our return and refund policy carefully:</p>

                <h3>1. Trial and Subscription</h3>

                <h4>Free Trial</h4>
                <p>PetwiseAI offers a 7-day free trial for users to explore the premium features of the application. No charges will be applied during the trial period.</p>

                <h4>Subscription Charges</h4>
                <p>After the free trial period ends, users will lose access to premium features. To continue using the service, users can sign up for a subscription plan of their choice (monthly or yearly). No credit card is required for the free trial.</p>

                <h3>2. Refunds</h3>

                <h4>Subscription Payments</h4>
                <p>Refunds for subscription payments are only available under exceptional circumstances, such as incorrect billing or technical issues that prevent access to the service. If you believe you are entitled to a refund, please contact our support team at support@petwise.vet within 30 days of the charge.</p>

                <h4>No Refund for Report Generation</h4>
                <p>Since PetwiseAI provides digital content, all charges for report generation are non-refundable. Please review the service thoroughly during your free trial to ensure it meets your needs.</p>

                <h3>3. Cancellation and Processing</h3>

                <h4>Cancellation</h4>
                <p>You may cancel your subscription at any time by visiting the Stripe Customer Portal from your profile settings. Once canceled, no further payments will be charged, and your access will continue until the end of the current billing period.</p>

                <h4>Refund Process</h4>
                <p>If approved, refunds will be processed via the original payment method within 10 business days. The refunded amount will not include any fees charged by third-party payment processors.</p>

                <hr className="section-divider" />

                <h2>Data Protection Policy</h2>
                <p><strong>Effective Date: January 1, 2024</strong></p>

                <p>PetwiseAI is committed to safeguarding your privacy and ensuring the protection of your personal data. This policy explains how we collect, use, and protect the data you provide.</p>

                <h3>1. Data Collection</h3>

                <h4>Personal Information</h4>
                <p>When signing up, we collect personal information such as your name, email address, and payment details through Auth0 and Stripe.</p>

                <h4>Veterinary Reports</h4>
                <p>Users may input and store patient-related data (species, breed, diagnosis, etc.) for generating reports. The Service is not designed to store client data (e.g., client names, phone numbers, addresses), and users are advised not to include such information in stored reports.</p>

                <h3>2. Data Usage</h3>

                <h4>User Authentication</h4>
                <p>We use Auth0 to securely authenticate users.</p>

                <h4>Report Generation</h4>
                <p>Data provided is used to process and generate accurate reports.</p>

                <h4>Subscription and Billing</h4>
                <p>Payment information is securely handled by Stripe.</p>

                <h3>3. Data Storage and Security</h3>
                <ul>
                    <li><strong>Storage:</strong> All data is stored securely in Supabase databases with encryption in transit and at rest.</li>
                    <li><strong>Access Control:</strong> Access is restricted to authenticated users only.</li>
                    <li><strong>Retention:</strong> Reports are retained as long as your account is active or until you delete them. Upon account deletion, all associated data will be permanently removed unless retention is required by law.</li>
                </ul>

                <h4>Third-Party Services</h4>
                <p>PetwiseAI integrates with third-party services such as Auth0 for authentication and Stripe for payment processing. PetwiseAI is not responsible for any errors, issues, or breaches occurring within these third-party services. Users should review the terms and privacy policies of these third-party providers.</p>

                <h3>4. User Responsibility</h3>
                <ul>
                    <li>Users are responsible for ensuring that any data they input complies with applicable data privacy laws.</li>
                    <li>PetwiseAI is not responsible for any sensitive or personally identifiable data stored by users in reports or other text fields.</li>
                </ul>

                <h3>5. International Customers</h3>
                <p>PetwiseAI complies with global data protection regulations, including GDPR for users in the European Union. Users outside Canada should ensure compliance with their local data privacy regulations when using the Service.</p>

                <h3>Acknowledgment of Responsibility</h3>
                <p>By using PetwiseAI, you agree to:</p>
                <ul>
                    <li>Input only necessary and lawful data.</li>
                    <li>Avoid storing sensitive or personally identifiable client information.</li>
                    <li>Take full responsibility for any data you choose to input or store on the platform.</li>
                </ul>

                <p>For questions or concerns about these policies, please contact us at support@petwise.vet.</p>
            </div>

            <div className="terms-actions">
                <label className={`accept-checkbox ${!isScrolledToBottom ? 'disabled' : ''}`}>
                    <input
                        type="checkbox"
                        checked={hasAccepted}
                        onChange={(e) => setHasAccepted(e.target.checked)}
                        disabled={!isScrolledToBottom}
                    />
                    I have read and agree to the Terms of Service and Privacy Policy
                </label>

                <label className="marketing-checkbox">
                    <input
                        type="checkbox"
                        checked={emailOptOut}
                        onChange={(e) => setEmailOptOut(e.target.checked)}
                    />
                    Don't send me promotional or marketing materials
                </label>

                <button
                    onClick={handleAccept}
                    disabled={!hasAccepted || !isScrolledToBottom}
                    className="accept-button"
                >
                    Accept & Continue
                </button>
            </div>
        </div>
    );
};

export default TermsOfService; 