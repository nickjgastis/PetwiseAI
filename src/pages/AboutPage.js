import React, { useEffect } from 'react';
import '../styles/AboutPage.css';

const AboutPage = () => {
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

    return (
        <div className="about-page">
            <header className="about-hero fade-in-section">
                <h1>Revolutionizing Veterinary Care with AI</h1>
                <p>Petwise AI: Your intelligent partner in animal health</p>
            </header>

            <section className="about-mission fade-in-section">
                <h2>Our Mission</h2>
                <p>At Petwise AI, we're dedicated to empowering veterinary professionals with cutting-edge AI technology, enabling them to provide superior care for animals while optimizing their practice efficiency.</p>
            </section>

            <section className="about-features fade-in-section">
                <h2>Key Features</h2>
                <div className="feature-grid">
                    <div className="feature-item">
                        <h3>Instant Prognosis Reports</h3>
                        <p>Generate comprehensive, clinic-ready reports in seconds, not hours.</p>
                    </div>
                    <div className="feature-item">
                        <h3>AI-Powered Diagnostics</h3>
                        <p>Leverage machine learning algorithms trained on millions of veterinary cases.</p>
                    </div>
                    <div className="feature-item">
                        <h3>Customizable Templates</h3>
                        <p>Tailor reports to your clinic's specific needs and branding.</p>
                    </div>
                    <div className="feature-item">
                        <h3>Seamless Integration</h3>
                        <p>Easily integrate with your existing practice management software.</p>
                    </div>
                </div>
            </section>

            <section className="about-stats fade-in-section">
                <h2>Petwise AI by the Numbers</h2>
                <div className="stats-container">
                    <div className="stat-item">
                        <h3>75%</h3>
                        <p>Reduction in report writing time</p>
                    </div>
                    <div className="stat-item">
                        <h3>30%</h3>
                        <p>Increase in patient throughput</p>
                    </div>
                    <div className="stat-item">
                        <h3>95%</h3>
                        <p>User satisfaction rate</p>
                    </div>
                    <div className="stat-item">
                        <h3>24/7</h3>
                        <p>AI-assisted support</p>
                    </div>
                </div>
            </section>

            <section className="about-testimonial fade-in-section">
                <blockquote>
                    "Petwise AI has transformed our practice. We're able to see more patients, provide more comprehensive care, and reduce our administrative workload. It's an indispensable tool for the modern veterinary clinic."
                </blockquote>
                <p>- Dr. Sarah Thompson, Chief Veterinarian at PetCare Plus</p>
            </section>

            <section className="about-cta fade-in-section">
                <h2>Experience the Future of Veterinary Care</h2>
                <p>Join thousands of satisfied veterinary professionals and revolutionize your practice with Petwise AI.</p>
                <button className="cta-button">Start Your Free Trial Today</button>
            </section>
        </div>
    );
};

export default AboutPage;
