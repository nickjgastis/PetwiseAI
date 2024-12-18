import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Footer.css';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-section">
                    <h4>PetWise</h4>
                    <p>Revolutionizing veterinary care with AI-powered solutions.</p>
                    <div className="social-links">
                        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">Twitter</a>
                        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">Facebook</a>
                    </div>
                </div>

                <div className="footer-section">
                    <h4>Quick Links</h4>
                    <ul>
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/about">About</Link></li>
                        <li><Link to="/pricing">Pricing</Link></li>
                        <li><Link to="/contact">Contact</Link></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Resources</h4>
                    <ul>
                        <li><Link to="/blog">Blog</Link></li>
                        <li><Link to="/help">Help Center</Link></li>
                        <li><Link to="/tutorials">Tutorials</Link></li>
                        <li><Link to="/api">API Documentation</Link></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Legal</h4>
                    <ul>
                        <li><Link to="/privacy">Privacy Policy</Link></li>
                        <li><Link to="/terms">Terms of Service</Link></li>
                        <li><Link to="/security">Security</Link></li>
                        <li><Link to="/compliance">Compliance</Link></li>
                    </ul>
                </div>
            </div>

            <div className="footer-bottom">
                <p>&copy; {currentYear} PETWISE TECHNOLOGIES. All rights reserved.</p>
            </div>
        </footer>
    );
};

export default Footer; 