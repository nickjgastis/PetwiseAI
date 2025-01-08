import React, { useEffect } from 'react';
import Footer from '../components/Footer';
import '../styles/AboutPage.css';

const AboutPage = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;    // For Safari
        document.documentElement.scrollTop = 0;  // For Chrome, Firefox, IE and Opera
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

    return (
        <>
            <div className="about-page">
                <header className="about-hero fade-in-section">
                    <h1>Revolutionizing Veterinary Care with AI</h1>
                    <p>Petwise: Your intelligent partner in animal health</p>
                </header>

                <section className="about-mission fade-in-section">
                    <h2>PetWise</h2>
                    <p>Our mission is simple: save veterinarians valuable time by automating the report writing process, allowing you to focus on what matters most - caring for animals.</p>
                </section>

                <section className="about-features fade-in-section">
                    <h2>Key Features</h2>
                    <div className="feature-grid">
                        <div className="feature-item">
                            <h3>AI-Powered Report Generation</h3>
                            <p>Generate complete veterinary reports in seconds, including patient information, diagnostics, treatment plans, physical exams, and follow-ups - all structured and clinic-ready.</p>
                        </div>
                        <div className="feature-item">
                            <h3>QuickMed Query AI</h3>
                            <p>Your 24/7 veterinary knowledge assistant. Get instant, accurate answers about treatments, drug dosages, protocols, and medical information without the need for research.</p>
                        </div>
                        <div className="feature-item">
                            <h3>Clinical Decision Support</h3>
                            <p>Receive evidence-based treatment recommendations, drug interaction warnings, and diagnostic suggestions to support your clinical decisions in real-time.</p>
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
                        "PetWise saves me hours every day. What used to take 20-30 minutes per patient report now takes just minutes. The AI assistant helps me make faster, more informed decisions, and I can spend that extra time where it matters most - with my patients."
                    </blockquote>
                    <p>- Dr. Stacey Gastis, DVM</p>
                </section>

                <section className="about-cta fade-in-section">
                    <h2>Experience the Future of Veterinary Care</h2>
                    <p>Join thousands of satisfied veterinary professionals and revolutionize your practice with Petwise AI.</p>
                    <button className="cta-button">Start Your Free Trial Today</button>
                </section>
            </div>
            <Footer />
        </>
    );
};

export default AboutPage;
