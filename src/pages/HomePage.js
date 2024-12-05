import React, { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import '../styles/HomePage.css'; // Import the CSS file
import { BsArrowRight } from 'react-icons/bs';  // Add this import at the top
import { HiChevronDoubleDown } from 'react-icons/hi';  // Add this import

const HomePage = () => {
    const { loginWithRedirect } = useAuth0();

    useEffect(() => {
        const sections = document.querySelectorAll('.fade-in-section');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('show');
                }
            });
        }, { threshold: 0.5 });

        sections.forEach((section) => observer.observe(section));
    }, []);

    const signUpOptions = {
        authorizationParams: {
            screen_hint: "signup"
        }
    };

    const features = [
        {
            title: 'Patient History & Symptoms',
            detail: `• Species, breed, age, sex documentation
• Current complaints and history
• Diet and medication information`
        },
        {
            title: 'Physical Examination',
            detail: `• Vital signs and body condition score
• Full body system observations
• Detailed abnormal findings`
        },
        {
            title: 'Diagnostic Planning',
            detail: `• AI-assisted test selection
• Lab work recommendations
• Imaging study suggestions`
        },
        {
            title: 'Assessment & Diagnosis',
            detail: `• Primary diagnosis analysis
• Differential diagnoses list
• Evidence-based conclusions`
        },
        {
            title: 'Treatment Plan',
            detail: `• Medication recommendations
• Monitoring parameters
• Lifestyle modifications`
        },
        {
            title: 'Follow-up & Monitoring',
            detail: `• Follow-up schedule
• Home care instructions
• Emergency guidelines`
        }
    ];

    return (
        <div className="page-content">
            <section className="homepage-hero">
                <div className="homepage-hero-content">
                    <div className="homepage-hero-left">
                        <h1>Create Veterinary Medical Records In Seconds</h1>
                        <img src="/PW.png" alt="Petwise Logo" className="homepage-hero-logo" />
                        <p>Save 90% of your medical record entry time. Let AI do the work.</p>
                        <button
                            onClick={() => loginWithRedirect(signUpOptions)}
                            className="hero-cta-button"
                        >
                            Start Your Free Trial - No Credit Card Required
                        </button>
                    </div>
                    <div className="homepage-hero-right">
                        <div className="homepage-hero-features">
                            {features.map((feature, index) => (
                                <React.Fragment key={index}>
                                    <div className="homepage-hero-feature">
                                        <h3>{feature.title}</h3>
                                        <p className="feature-detail">{feature.detail}</p>
                                    </div>
                                    {index < features.length - 1 && (
                                        <div className="feature-arrow">
                                            <HiChevronDoubleDown size={24} />
                                        </div>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="workflow-section">
                <div className="workflow-header">
                    <h2>Three-Step Workflow</h2>
                    <p>Transform your veterinary practice with our simple three-step process</p>
                </div>
                <div className="workflow-steps">
                    {[
                        {
                            title: 'Input Exam Data',
                            description: 'Enter patient symptoms and clinical findings into our intuitive interface',
                            image: '/exam.png'
                        },
                        {
                            title: 'Generate Report',
                            description: 'Our AI processes the information and generates comprehensive medical records',
                            image: '/generate.png'
                        },
                        {
                            title: 'Review & Approve',
                            description: 'Review, edit if needed, and approve the AI-generated documentation',
                            image: '/report.png'
                        }
                    ].map((step, index, array) => (
                        <React.Fragment key={index}>
                            <div className="workflow-step">
                                <img
                                    src={step.image}
                                    alt={step.title}
                                    className="workflow-image"
                                />
                                <h3>{step.title}</h3>
                                <p>{step.description}</p>
                            </div>
                            {index < array.length - 1 && (
                                <div className="workflow-arrow">
                                    <BsArrowRight size={30} />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
                <button
                    onClick={() => loginWithRedirect(signUpOptions)}
                    className="workflow-cta-button"
                >
                    Start Your Free Trial - No Credit Card Required
                </button>
            </section>

            <section className="video-section">
                <div className="video-header">
                    <h2>How It Works</h2>
                </div>
                <div className="video-container">
                    <iframe
                        src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
                        title="How Petwise AI Works"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>
            </section>

            <section className="pricing-section">
                <div className="pricing-header">
                    <h2>Choose Your Plan</h2>
                    <p>Get full access to all premium features</p>
                </div>
                <div className="pricing-container">
                    <div className="pricing-card free">
                        <div className="pricing-header">
                            <h3>Free Trial</h3>
                            <p className="price">$0<span>/14 days</span></p>
                        </div>
                        <ul className="pricing-features">
                            <li>10 reports per day</li>
                            <li>No credit card required</li>
                            <li>Quick Query</li>
                        </ul>
                        <div className="pricing-footer">
                            <button
                                onClick={() => loginWithRedirect(signUpOptions)}
                                className="trial-button"
                            >
                                Start Free Trial - No Credit Card Required
                            </button>
                        </div>
                    </div>

                    <div className="pricing-card">
                        <div className="pricing-header">
                            <h3>Single User</h3>
                            <div className="price-options">
                                <p className="price">$79.99<span>/mo</span></p>
                                <span className="price-divider">|</span>
                                <p className="price yearly">$859.99<span>/yr</span></p>
                            </div>
                        </div>
                        <ul className="pricing-features">
                            <li>25 reports per day</li>
                            <li>Saved reports</li>
                            <li>Quick Query</li>
                            <li>For 1 user</li>
                        </ul>
                        <div className="pricing-footer">
                            <button
                                onClick={() => loginWithRedirect(signUpOptions)}
                                className="subscribe-button"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>

                    <div className="pricing-card">
                        <div className="pricing-header">
                            <h3>Multi User</h3>
                            <div className="price-options">
                                <p className="price">$249.99<span>/mo</span></p>
                                <span className="price-divider">|</span>
                                <p className="price yearly">$2849.99<span>/yr</span></p>
                            </div>
                        </div>
                        <ul className="pricing-features">
                            <li>120 reports per day</li>
                            <li>Saved reports</li>
                            <li>Quick Query</li>
                            <li>For 2-5 users</li>
                        </ul>
                        <div className="pricing-footer">
                            <button
                                onClick={() => loginWithRedirect(signUpOptions)}
                                className="subscribe-button"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>

                    <div className="pricing-card">
                        <div className="pricing-header">
                            <h3>Clinic Subscription</h3>
                            <div className="price-options">
                                <p className="price">$479.99<span>/mo</span></p>
                                <span className="price-divider">|</span>
                                <p className="price yearly">$5199.99<span>/yr</span></p>
                            </div>
                        </div>
                        <ul className="pricing-features">
                            <li>400 reports per day</li>
                            <li>Saved reports</li>
                            <li>Quick Query</li>
                            <li>For full clinics</li>
                        </ul>
                        <div className="pricing-footer">
                            <button
                                onClick={() => loginWithRedirect(signUpOptions)}
                                className="subscribe-button"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default HomePage;
