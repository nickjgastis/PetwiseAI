import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { BsArrowRight } from 'react-icons/bs';
import { HiChevronDoubleDown } from 'react-icons/hi';
import { FaBook, FaPills, FaClipboardList } from 'react-icons/fa';
import Footer from '../components/Footer';
import '../styles/HomePage.css';

const HomePage = () => {
    const { loginWithRedirect } = useAuth0();
    const [isLoading, setIsLoading] = useState(true);
    const [contentVisible, setContentVisible] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;

        // Hide content initially
        document.body.style.overflow = 'hidden';

        // Wait for images to load
        Promise.all(
            Array.from(document.images)
                .filter(img => !img.complete)
                .map(img => new Promise(resolve => {
                    img.onload = img.onerror = resolve;
                }))
        ).then(() => {
            setIsLoading(false);
            // Small delay before showing content
            setTimeout(() => {
                setContentVisible(true);
                document.body.style.overflow = '';
            }, 100);
        });

        // Fallback timer
        const fallbackTimer = setTimeout(() => {
            setIsLoading(false);
            setTimeout(() => {
                setContentVisible(true);
                document.body.style.overflow = '';
            }, 100);
        }, 1000);

        return () => {
            clearTimeout(fallbackTimer);
            document.body.style.overflow = '';
        };
    }, []);

    // Update the className based on both loading states
    const contentClassName = `homepage-content${contentVisible ? ' loaded' : ''}`;

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
            <div className={contentClassName} style={{ visibility: isLoading ? 'hidden' : 'visible' }}>
                <section className="homepage-hero">
                    <div className="homepage-hero-content">
                        <div className="homepage-hero-left">
                            <h1>Veterinary Medical Records Quick</h1>
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
                            <h2>because you deserve this</h2>
                        </div>
                    </div>
                </section>

                <section className="workflow-section">
                    <div className="workflow-header">
                        <h2>PetNote</h2>
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
                                title: 'Generate Record',
                                description: 'Our AI processes the information and generates comprehensive medical records in seconds',
                                image: '/ai.png'
                            },
                            {
                                title: 'Review & Edit',
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
                        <h2>PetQuery™</h2>
                        <p>Research any medical question instantly</p>
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

                <section className="literature-section">
                    <div className="literature-header">
                        <h2>Trusted Veterinary Sources</h2>
                        <p>Access the latest research and clinical information from industry-leading references</p>
                    </div>
                    <div className="literature-sources">
                        <div className="source-card">
                            <div className="source-icon">
                                <FaBook size={50} color="#0090d7" />
                            </div>
                            <h3>The Merck Veterinary Manual</h3>
                            <p>Comprehensive clinical reference covering diseases, diagnosis and treatment across species</p>
                        </div>
                        <div className="source-card">
                            <div className="source-icon">
                                <FaPills size={50} color="#0090d7" />
                            </div>
                            <h3>Plumb's Veterinary Drug Handbook</h3>
                            <p>Detailed pharmacological information including dosages, indications, and contraindications</p>
                        </div>
                        <div className="source-card">
                            <div className="source-icon">
                                <FaClipboardList size={50} color="#0090d7" />
                            </div>
                            <h3>Blackwell's Five-Minute Veterinary Consult</h3>
                            <p>Quick reference for diagnosis and treatment of common conditions in clinical practice</p>
                        </div>
                    </div>
                    <p className="more-sources-note">Visit our help center for a full list of sources</p>
                </section>

                <section className="video-section">
                    <div className="video-header">
                        <h2>How It Works</h2>
                    </div>
                    <div className="video-container">
                        <iframe
                            src="https://www.youtube.com/embed/BZtpas--SL4?si=DwlVcfKJawf-LxZ4&controls=1&modestbranding=1&rel=0&showinfo=0&playlist=BZtpas--SL4&autoplay=1&mute=1"
                            title="How Petwise AI Works"
                            frameBorder="0"
                            allowFullScreen
                        ></iframe>
                    </div>
                </section>

                <section className="events-section">
                    <div className="events-header">
                        <h2>Have your team join us live this Tuesday</h2>
                    </div>
                    <ul className="events-list">
                        <li className="event-item">
                            <span className="event-info">Live Demo 1 - 12:15 PM Eastern</span>
                            <a href="https://meet.google.com/rvc-ordw-uwa" className="event-link">Join Demo</a>
                        </li>
                        <li className="event-item">
                            <span className="event-info">Live Demo 2 - 12:15 PM Central</span>
                            <a href="https://meet.google.com/rvc-ordw-uwa" className="event-link">Join Demo</a>
                        </li>
                        <li className="event-item">
                            <span className="event-info">Live Demo 3 - 12:15 PM Mountain</span>
                            <a href="https://meet.google.com/rvc-ordw-uwa" className="event-link">Join Demo</a>
                        </li>
                        <li className="event-item">
                            <span className="event-info">Live Demo 4 - 12:15 PM Pacific</span>
                            <a href="https://meet.google.com/rvc-ordw-uwa" className="event-link">Join Demo</a>
                        </li>
                    </ul>
                </section>

                <section className="pricing-section">
                    <div className="pricing-header">
                        <h2>Choose Your Plan</h2>
                        <p>Get full access to all premium features</p>
                    </div>
                    <div className="pricing-container">
                        <div className="pricing-card free">
                            <div className="pricing-header">
                                <h3>14 Day Free Trial</h3>
                                <p className="price">$0<span>/mo</span></p>
                            </div>
                            <ul className="pricing-features">
                                <li>No credit card required</li>
                                <li>50 records per day</li>
                                <li>Quick Query</li>
                            </ul>
                            <div className="pricing-footer">
                                <button
                                    onClick={() => loginWithRedirect(signUpOptions)}
                                    className="trial-button"
                                >
                                    Start Free Trial
                                </button>
                            </div>
                        </div>

                        <div className="pricing-card">
                            <div className="pricing-header">
                                <h3>Monthly</h3>
                                <p className="price">$129<span> USD/Vet/Month</span></p>
                            </div>
                            <ul className="pricing-features">
                                <li>Unlimited SOAP reports</li>
                                <li>Unlimited Quick Query</li>
                                <li>Saved reports</li>
                                <li>Priority support</li>

                            </ul>
                            <div className="pricing-footer">
                                <button
                                    onClick={() => loginWithRedirect(signUpOptions)}
                                    className="subscribe-button"
                                >
                                    Sign Up Now
                                </button>
                            </div>
                        </div>

                        <div className="pricing-card">
                            <div className="pricing-header">
                                <h3>Yearly</h3>
                                <p className="price">$89<span> USD/Vet/Month</span></p>
                                <p className="savings">Save 31%</p>
                            </div>
                            <ul className="pricing-features">
                                <li>Unlimited SOAP reports</li>
                                <li>Unlimited Quick Query</li>
                                <li>Saved reports</li>
                                <li>Priority support</li>

                            </ul>
                            <div className="pricing-footer">
                                <button
                                    onClick={() => loginWithRedirect(signUpOptions)}
                                    className="subscribe-button"
                                >
                                    Sign Up Now
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="enterprise-section">
                        <h3>Looking to sign up your whole clinic staff, or multiple clinics?</h3>
                        <p>We've got you covered! Contact <a href="mailto:support@petwise.vet">support@petwise.vet</a></p>
                    </div>
                </section>
            </div>
            <Footer />
        </>
    );
};

export default HomePage;
