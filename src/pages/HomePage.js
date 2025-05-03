import React, { useEffect, useState, useRef } from 'react';
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

    // Add new ref for the protocol section
    const protocolSectionRef = useRef(null);

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

    // Add a new useEffect for scroll animation
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.1 }); // Trigger when 10% of element is visible

        // Apply to protocol section
        if (protocolSectionRef.current) {
            observer.observe(protocolSectionRef.current);
        }

        return () => {
            if (protocolSectionRef.current) {
                observer.unobserve(protocolSectionRef.current);
            }
        };
    }, [contentVisible]); // Run after content is loaded and visible

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
                    <div className="hero-image-container">
                        <img src="/landingpage_dog.png" alt="Veterinarian with tablet" className="hero-image" />
                    </div>
                    <div className="hero-content-container">
                        <div className="blue-blob-background"></div>
                        <div className="hero-content">
                            <h1>Patient records slowing down your day?</h1>
                            <h2>Try PetWise – faster, accurate records. Zero dictation!</h2>
                            <div className="cta-container">
                                <button
                                    onClick={() => loginWithRedirect(signUpOptions)}
                                    className="hero-cta-button"
                                >
                                    Start 30 Day Free Trial
                                </button>
                                <p className="no-card-text">No credit card required</p>
                            </div>
                            <div className="hero-logo">
                                <img src="/PW.png" alt="PetWise Logo" className="logo-image" />
                            </div>
                        </div>
                    </div>
                </section>


                <section className="petnote-protocol-section" ref={protocolSectionRef}>
                    <div className="petnote-protocol-header">

                    </div>
                    <div className="petnote-protocol-images">
                        <div className="protocol-image-container">
                            <picture>
                                <source media="(max-width: 768px)" srcSet="/petnoteinfomobile.png" />
                                <img src="/petnoteprotocol.png" alt="PetNote Protocol step 1" className="protocol-image" />
                            </picture>
                        </div>
                        <div className="protocol-image-container">
                            <picture>
                                <source media="(max-width: 768px)" srcSet="/petqueryinfomobile.png" />
                                <img src="/petqueryprotocol.png" alt="PetNote Protocol step 2" className="protocol-image" />
                            </picture>
                        </div>
                    </div>
                </section>

                <section className="cta-banner-section">
                    <div className="cta-banner-container">
                        <h2>Less paperwork. More pets!</h2>
                        <p className="cta-banner-text">Get 30 days free with unlimited PetQuery and 50 SOAP's per day!</p>
                        <p className="cta-banner-subtext">No credit card required</p>
                        <button
                            onClick={() => loginWithRedirect(signUpOptions)}
                            className="hero-cta-button"
                        >
                            Sign me up!
                        </button>
                    </div>
                </section>


                <section className="literature-section">
                    <div className="literature-header">
                        <h2>Trusted Veterinary Sources</h2>
                        <p>"It's like ChatGBT, but for vets! Provides info only from
                            trusted veterinary references."</p>
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

                        <div className="pricing-card free highlight-card">
                            <div className="pricing-header">
                                <h3>30 Day Free Trial</h3>
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
                        <p>We've got you covered! Contact support@petwise.vet for enterprise plans.</p>
                        <a href="mailto:support@petwise.vet" className="enterprise-contact-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383-4.708 2.825L15 11.105V5.383zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741zM1 11.105l4.708-2.897L1 5.383v5.722z" />
                            </svg>
                            Contact Us!
                        </a>
                    </div>
                </section>
            </div>
            <Footer />
        </>
    );
};

export default HomePage;
