import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { BsArrowRight } from 'react-icons/bs';
import { HiChevronDoubleDown } from 'react-icons/hi';
import Footer from '../components/Footer';
import '../styles/HomePage.css';

const HomePage = () => {
    const { loginWithRedirect } = useAuth0();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Wait for images to load
        Promise.all(
            Array.from(document.images)
                .filter(img => !img.complete)
                .map(img => new Promise(resolve => {
                    img.onload = img.onerror = resolve;
                }))
        ).then(() => {
            setIsLoading(false);
        });

        // Fallback in case there are no images
        const fallbackTimer = setTimeout(() => {
            setIsLoading(false);
        }, 500);

        return () => clearTimeout(fallbackTimer);
    }, []);

    if (isLoading) {
        return (
            <div className="homepage-loading-container">
                <div className="homepage-loading-spinner"></div>
            </div>
        );
    }

    const signUpOptions = {
        authorizationParams: {
            screen_hint: "signup"
        }
    };

    return (
        <>
            <div className="page-content loaded">
                <section className="homepage-hero">
                    <div className="homepage-hero-content">
                        <div className="homepage-hero-left">
                            <h1>Veterinary Medical Records Fast</h1>
                            <p>Let AI do the work</p>
                            <button
                                onClick={() => loginWithRedirect(signUpOptions)}
                                className="hero-cta-button"
                            >
                                Start Your Free 14 Day Trial
                            </button>
                            <p className="no-card-text">No credit card required</p>
                        </div>
                        <div className="homepage-hero-right">
                            <img src="/desktop3.png" alt="Desktop Preview" className="desktop-preview" />
                        </div>
                    </div>
                    <div className="hero-extra-content">
                        <div className="process-squares">
                            <div className="process-square">
                                <img src="/form.png" alt="Input Form" className="process-icon" />
                                <span>Input</span>
                            </div>
                            <div className="process-square">
                                <img src="/ai.png" alt="Generate" className="process-icon" />
                                <span>Generate</span>
                            </div>
                            <div className="process-square">
                                <img src="/review.png" alt="Review" className="process-icon" />
                                <span>Review</span>
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
                                title: 'Input Exam Findings',
                                description: 'Enter patient symptoms and clinical findings into our intuitive interface',
                                image: '/exam.png'
                            },
                            {
                                title: 'Generate Report',
                                description: 'Our AI processes the information and generates comprehensive medical records in seconds',
                                image: '/ai.png'
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

                <section className="quickmed-section">
                    <div className="quickmed-header">
                        <h2>QuickMed Query</h2>
                        <p>Your 24/7 AI veterinary assistant, providing instant answers to all your medical research questions</p>
                    </div>

                    <div className="quickmed-content">
                        <div className="quickmed-image">
                            <img
                                src="/quickmed.png"
                                alt="QuickMed Query Interface"
                                className="quickmed-preview"
                            />
                        </div>
                        <div className="quickmed-features">
                            <ul>
                                <li>
                                    <span className="feature-title">Instant Research</span>
                                    <p>Get immediate answers about treatments, medications, and protocols</p>
                                </li>
                                <li>
                                    <span className="feature-title">Drug Information</span>
                                    <p>Access detailed drug dosages, interactions, and contraindications</p>
                                </li>
                                <li>
                                    <span className="feature-title">Treatment Guidelines</span>
                                    <p>Evidence-based treatment recommendations for various conditions</p>
                                </li>
                                <li>
                                    <span className="feature-title">Clinical Updates</span>
                                    <p>Stay current with the latest veterinary medical research and practices</p>
                                </li>
                            </ul>
                        </div>
                    </div>
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
            <Footer />
        </>
    );
};

export default HomePage;
