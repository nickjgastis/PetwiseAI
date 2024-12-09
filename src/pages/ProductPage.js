import React from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import { Navigate } from 'react-router-dom';
import Footer from '../components/Footer';
import '../styles/AboutPage.css';
import '../styles/HomePage.css';

const ProductPage = () => {
    const { isAuthenticated, loginWithRedirect } = useAuth0();

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
            <div className="page-content">
                <section className="about-hero">
                    <h1>Our Product</h1>
                    <p>Discover how our AI-powered solution transforms veterinary practice</p>
                </section>

                <section className="video-section" style={{ marginTop: '-4rem', textAlign: 'center' }}>
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

export default ProductPage; 