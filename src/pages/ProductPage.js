import React, { useEffect } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import { Navigate } from 'react-router-dom';
import Footer from '../components/Footer';
import '../styles/AboutPage.css';
import '../styles/HomePage.css';

const ProductPage = () => {
    const { isAuthenticated, loginWithRedirect } = useAuth0();

    useEffect(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
    }, []);

    useEffect(() => {
        const sections = document.querySelectorAll('.fade-in-section');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('show');
                }
            });
        }, { threshold: 0.5 });

        sections.forEach((section) => {
            observer.observe(section);
        });
    }, []);

    const signUpOptions = {
        authorizationParams: {
            screen_hint: "signup"
        }
    };

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <>
            <div className="product-content">
                <section className="about-hero fade-in-section">
                    <h1>Our Product</h1>
                    <p>Discover how our AI-powered solution transforms veterinary practice</p>
                </section>

                <section className="video-section fade-in-section" style={{ marginTop: '-4rem' }}>
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '3rem' }}>
                        <button
                            onClick={() => loginWithRedirect(signUpOptions)}
                            className="hero-cta-button"
                        >
                            Start Your Free 14 Day Trial
                        </button>
                        <p className="no-card-text" style={{ color: '#666', marginTop: '0.5rem' }}>
                            No credit card required
                        </p>
                    </div>
                </section>

                <section className="pricing-section fade-in-section">
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

export default ProductPage; 