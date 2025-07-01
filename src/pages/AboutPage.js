import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import Footer from '../components/Footer';
import '../styles/AboutPage.css';

const AboutPage = () => {
    const { loginWithRedirect } = useAuth0();
    const [currentTestimonial, setCurrentTestimonial] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const testimonials = [
        {
            text: "I am absolutely obsessed with the program. It is the only AI program I have enjoyed using. It is super user friendly and provides me with fast and accurate information. I have been reluctant to use AI for records because I like things written a certain way, and it can be hard to trust information from outside sources. I am impressed and comfortable distributing the information I get from PetWise to my clients.",
            author: "Dr. Amanda W., DVM"
        },
        {
            text: "PetWise saves me hours every day. What used to take 20–30 minutes per patient report now takes just minutes. The AI assistant helps me make faster, more informed decisions, and I can spend that extra time where it matters most – with my patients.",
            author: "Dr. Stacey Gastis, DVM"
        }
    ];

    const signUpOptions = {
        authorizationParams: {
            screen_hint: "signup"
        }
    };

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
        }, { threshold: 0.3 });

        sections.forEach((section) => {
            observer.observe(section);
        });

        return () => observer.disconnect();
    }, []);

    const changeTestimonial = (newIndex) => {
        if (isTransitioning) return;

        setIsTransitioning(true);
        setTimeout(() => {
            setCurrentTestimonial(newIndex);
            setTimeout(() => {
                setIsTransitioning(false);
            }, 50);
        }, 250);
    };

    useEffect(() => {
        const interval = setInterval(() => {
            const nextIndex = (currentTestimonial + 1) % testimonials.length;
            changeTestimonial(nextIndex);
        }, 7000);

        return () => clearInterval(interval);
    }, [currentTestimonial, testimonials.length]);

    const nextTestimonial = () => {
        const nextIndex = (currentTestimonial + 1) % testimonials.length;
        changeTestimonial(nextIndex);
    };

    const prevTestimonial = () => {
        const prevIndex = (currentTestimonial - 1 + testimonials.length) % testimonials.length;
        changeTestimonial(prevIndex);
    };

    const goToTestimonial = (index) => {
        changeTestimonial(index);
    };

    const handleStartTrial = () => {
        loginWithRedirect(signUpOptions);
    };

    return (
        <>
            <div className="about-page">
                {/* Hero Section */}
                <section className="hero-section fade-in-section">
                    <div className="container">
                        <div className="hero-content">
                            <h1>What is PetWise?</h1>
                            <p>An AI assistant built specifically for veterinarians, streamlining SOAP note generation and providing instant answers to clinical questions.</p>
                            <button className="trial-button" onClick={handleStartTrial}>
                                Start Free Trial
                            </button>
                        </div>
                    </div>
                </section>

                {/* Founding Story Section */}
                <section className="story-section fade-in-section">
                    <div className="container">
                        <h2>How PetWise Began</h2>
                        <div className="story-content">
                            <div className="story-text">
                                <p>Dr. Stacey Gastis, a practicing veterinarian, wanted to use AI to generate his medical records. After experimenting with ChatGPT, he asked his son, Nick Gastis, a software developer, to build something better—something tailored for real clinics.</p>
                                <p>Together, they created PetWise, and it's now helping veterinarians save hundreds of hours across North America.</p>
                            </div>
                            <div className="story-visual">
                                <img
                                    src="/nickanddad.jpeg"
                                    alt="Nick and Dr. Stacey Gastis - Father and son collaboration"
                                    className="collaboration-image"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Team Section */}
                <section className="team-section fade-in-section">
                    <div className="container">
                        <h2>Meet the Creators</h2>
                        <div className="team-grid">
                            <div className="team-member">
                                <div className="member-photo">
                                    <img
                                        src="/nickheadshot.PNG"
                                        alt="Nick Gastis - CEO, Chief Developer"
                                        className="member-headshot"
                                    />
                                </div>
                                <div className="member-info">
                                    <h3>Nick Gastis</h3>
                                    <p className="member-title">CEO, Chief Developer</p>
                                    <p className="member-bio">Full-stack developer and startup founder, Nick built PetWise from the ground up to help his dad, and now hundreds of vets, save time and simplify documentation.</p>
                                </div>
                            </div>
                            <div className="team-member">
                                <div className="member-photo">
                                    <img
                                        src="/drgastisheadshot.jpg"
                                        alt="Dr. Stacey Gastis, DVM - Veterinary Co-Founder"
                                        className="member-headshot"
                                    />
                                </div>
                                <div className="member-info">
                                    <h3>Dr. Stacey Gastis, DVM</h3>
                                    <p className="member-title">Veterinary Co-Founder</p>
                                    <p className="member-bio">A practicing veterinarian with decades of experience, Dr. Gastis helped design PetWise to reflect real clinic needs—SOAP formatting, treatment planning, and record trustworthiness.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Testimonials Section */}
                <section className="testimonials-section fade-in-section">
                    <div className="container">
                        <h2>What Vets Are Saying</h2>
                        <div className="testimonial-carousel">
                            <button className="carousel-btn prev-btn" onClick={prevTestimonial}>
                                &#8249;
                            </button>
                            <div className={`testimonial-content${isTransitioning ? ' transitioning' : ''}`}>
                                <blockquote>
                                    "{testimonials[currentTestimonial].text}"
                                </blockquote>
                                <p className="testimonial-author">— {testimonials[currentTestimonial].author}</p>
                            </div>
                            <button className="carousel-btn next-btn" onClick={nextTestimonial}>
                                &#8250;
                            </button>
                        </div>
                        <div className="carousel-indicators">
                            {testimonials.map((_, index) => (
                                <button
                                    key={index}
                                    className={`indicator ${index === currentTestimonial ? 'active' : ''}`}
                                    onClick={() => goToTestimonial(index)}
                                />
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="final-cta-section fade-in-section">
                    <div className="container">
                        <h2>Ready to Save Hours?</h2>
                        <p>Join hundreds of veterinarians using PetWise to work faster and smarter.</p>
                        <p>Start your 30-day free trial today.</p>
                        <div className="cta-container">
                            <button className="cta-button" onClick={handleStartTrial}>
                                Start Free Trial
                            </button>
                            <p className="no-card-text">No credit card required</p>
                        </div>
                    </div>
                </section>
            </div>
            <Footer />
        </>
    );
};

export default AboutPage;
