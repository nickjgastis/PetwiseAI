import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/HomePage.css'; // Import the CSS file

const HomePage = () => {
    useEffect(() => {
        const sections = document.querySelectorAll('.fade-in-section');
        const options = {
            threshold: 0.5,
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('show');
                }
            });
        }, options);

        sections.forEach((section) => {
            observer.observe(section);
        });
    }, []);

    return (
        <div className="page-content">
            <header className="hero-section">
                <div className="hero-text fade-in-section">
                    <h1>The World's First AI for Veterinary Prognosis Reports</h1>
                    <p>Get your veterinary reports done with Petwise AI in just a few clicks.</p>
                </div>
                <Link to="/signup" className="cta-button fade-in-section">
                    Try Petwise AI - Free to try, no credit card required
                </Link>
            </header>

            <section className="trusted-section fade-in-section">
                <h2>Trusted by veterinarians</h2>
                <p>Used and loved by veterinary clinics every day.</p>
                <div className="trusted-stats">
                    <div className="stat-box">
                        <h3>500+</h3>
                        <p>Clinics</p>
                    </div>
                    <div className="stat-box">
                        <h3>1000+</h3>
                        <p>Veterinarians</p>
                    </div>
                    <div className="stat-box">
                        <h3>1.5M+</h3>
                        <p>Reports Generated</p>
                    </div>
                </div>
            </section>

            <section className="how-it-works fade-in-section">
                <h2>How It Works</h2>
                <div className="steps">
                    <div className="step">
                        <h3>Sign Up</h3>
                        <p>Get started with a free trial and see how Petwise AI can save time.</p>
                    </div>
                    <div className="step">
                        <h3>Enter Details</h3>
                        <p>Input patient details, presenting complaints, and other relevant info.</p>
                    </div>
                    <div className="step">
                        <h3>Generate Report</h3>
                        <p>Generate detailed, AI-driven veterinary reports in seconds.</p>
                    </div>
                </div>
            </section>

            <footer className="homepage-footer fade-in-section">
                <p>&copy; 2024 Petwise AI. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default HomePage;
