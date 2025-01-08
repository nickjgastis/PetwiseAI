import React, { useEffect } from 'react';
import '../styles/Legal.css';
import Footer from './Footer';

const PrivacyPolicy = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;    // For Safari
        document.documentElement.scrollTop = 0;  // For Chrome, Firefox, IE and Opera
    }, []);

    return (
        <>
            <div className="legal-container">


                <div className="legal-content">
                    <section>
                        <h2>Privacy Policy</h2>
                        <p><strong>Effective Date:</strong> January 1, 2024</p>

                        <h3>1. Data Collection</h3>
                        <h4>Personal Information</h4>
                        <p>
                            We collect personal information such as your name, email address, and payment details through secure integrations with <strong>Auth0</strong> for authentication and <strong>Stripe</strong> for payment processing. Additional optional profile information may also be collected to improve user experience.
                        </p>

                        <h4>Veterinary Reports</h4>
                        <p>
                            Users may input and store patient-related data, such as species, breed, diagnosis, and treatment details, to generate reports. The Service is not intended for storing sensitive client data (e.g., client names, phone numbers, addresses), and users are strongly advised not to input such information.
                        </p>

                        <h4>Device and Usage Data</h4>
                        <p>
                            We may collect technical data, including device type, IP address, browser type, and usage patterns, to improve the Service's functionality and security. This data is anonymized and used for analytical purposes only.
                        </p>

                        <h3>2. Data Usage</h3>
                        <h4>User Authentication</h4>
                        <p>We use <strong>Auth0</strong> to securely verify user identities and maintain secure account access.</p>

                        <h4>Report Generation</h4>
                        <p>
                            Data input into the platform is processed solely for creating detailed veterinary prognosis reports and is not shared with third parties for marketing or other purposes.
                        </p>

                        <h4>Subscription and Billing</h4>
                        <p>Payment information is securely processed through <strong>Stripe</strong>, and we do not store credit card details on our servers.</p>

                        <h4>Analytics and Improvements</h4>
                        <p>
                            Anonymized and aggregated data may be used to identify trends, improve the Service, and ensure optimal performance.
                        </p>

                        <h3>3. Data Security and Retention</h3>
                        <h4>Data Storage</h4>
                        <p>All user data is securely stored using <strong>Supabase</strong>, with encryption applied during transmission and while at rest. Our systems are regularly updated to meet industry-leading security standards.</p>

                        <h4>Reports Retention</h4>
                        <p>
                            Reports are retained as long as your account remains active or until you delete them. Upon account deletion, all associated data, including veterinary reports, will be permanently removed unless retention is required by law (e.g., for tax or compliance reasons).
                        </p>

                        <h4>Access Controls</h4>
                        <p>
                            Access to user data is restricted to authenticated users. Administrative access to system data is strictly limited to authorized personnel and audited regularly.
                        </p>

                        <h4>Incident Response</h4>
                        <p>
                            In the unlikely event of a data breach, affected users will be notified promptly, and corrective measures will be taken immediately.
                        </p>

                        <h3>4. User Responsibility</h3>
                        <ul>
                            <li>Ensure that any data input complies with applicable privacy laws and regulations.</li>
                            <li>Avoid storing sensitive or personally identifiable client information in reports or other fields.</li>
                            <li>Obtain proper consent from clients or patients before inputting any data into the Service.</li>
                        </ul>

                        <h3>5. International Customers</h3>
                        <h4>Compliance with Global Standards</h4>
                        <p>
                            PetWise is committed to complying with global data protection regulations, including:
                        </p>
                        <ul>
                            <li>
                                <strong>GDPR (General Data Protection Regulation):</strong> For users in the European Union, ensuring lawful data processing, user rights, and data portability.
                            </li>
                            <li>
                                <strong>PIPEDA (Personal Information Protection and Electronic Documents Act):</strong> For Canadian users, ensuring compliance with federal and provincial privacy laws.
                            </li>
                        </ul>
                        <p>Users outside these jurisdictions are encouraged to ensure compliance with their local data privacy regulations.</p>

                        <h3>6. User Rights</h3>
                        <p>We respect your rights to control your data. These include:</p>
                        <ul>
                            <li><strong>Right to Access:</strong> Users may request a copy of their stored data.</li>
                            <li><strong>Right to Rectification:</strong> Users may request corrections to inaccuracies in their data.</li>
                            <li><strong>Right to Erasure:</strong> Users may request deletion of their personal data at any time.</li>
                            <li>
                                <strong>Right to Restriction:</strong> Users may limit the processing of their data in specific scenarios.
                            </li>
                        </ul>
                        <p>
                            Requests can be sent to <strong>support@petwise.vet</strong>, and we will respond within the timeframe required by applicable laws.
                        </p>

                        <h3>7. Third-Party Services</h3>
                        <h4>Data Sharing</h4>
                        <p>
                            PetWise integrates with trusted third-party services to provide seamless functionality:
                        </p>
                        <ul>
                            <li><strong>Auth0:</strong> For secure user authentication.</li>
                            <li><strong>Stripe:</strong> For processing payments and subscriptions securely.</li>
                        </ul>
                        <p>
                            We do not sell or share your data with any third-party advertisers. Each third-party service has its own privacy policies, and we encourage users to review them.
                        </p>

                        <h3>8. Cookies and Tracking</h3>
                        <p>PetWise uses cookies to:</p>
                        <ul>
                            <li>Enhance user experience by remembering preferences.</li>
                            <li>Track usage patterns and analyze performance for service improvements.</li>
                        </ul>
                        <p>
                            Users can control cookie preferences through browser settings. Disabling cookies may affect certain features of the Service.
                        </p>

                        <h3>9. Incident Reporting</h3>
                        <p>
                            If you notice any suspicious activity related to your account or suspect a data breach, contact us immediately at <strong>support@petwise.vet</strong>. Our team will investigate and respond promptly.
                        </p>

                        <h3>10. Updates to Privacy Policy</h3>
                        <p>
                            We may update this Privacy Policy to reflect changes in regulations, technology, or our practices. Updates will be posted on our website, and significant changes will be communicated via email to registered users.
                        </p>

                        <h3>Acknowledgment of Responsibility</h3>
                        <p>
                            By using PetWise, you agree to:
                        </p>
                        <ul>
                            <li>Provide only necessary and lawful data.</li>
                            <li>Avoid storing sensitive or personally identifiable client information.</li>
                            <li>Take full responsibility for the accuracy and legality of any data you input or store on the platform.</li>
                        </ul>

                        <h3>Contact Us</h3>
                        <p>
                            For questions, concerns, or requests regarding this Privacy Policy, please contact us at:
                        </p>
                        <p><strong>Email:</strong> support@petwise.vet</p>
                    </section>
                </div>
            </div>
            <Footer />
        </>
    );
};

export default PrivacyPolicy; 