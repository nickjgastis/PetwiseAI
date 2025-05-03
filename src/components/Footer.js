import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Footer.css';
import { FaFacebook, FaInstagram } from 'react-icons/fa';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-section">
                    <h4>petwise.vet</h4>
                    <p>Revolutionizing veterinary care with AI-powered solutions.</p>
                </div>

                <div className="footer-section">
                    <h4>Quick Links</h4>
                    <ul>
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/about">About</Link></li>
                        <li><Link to="/product">Product</Link></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Resources</h4>
                    <ul>
                        <li><Link to="/help">Help Center</Link></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Legal</h4>
                    <ul>
                        <li><Link to="/privacy">Privacy Policy</Link></li>
                        <li><Link to="/terms">Terms of Service</Link></li>
                    </ul>
                </div>
            </div>

            <div className="footer-social">
                <h3>Connect with us!</h3>
                <div className="social-links">
                    <a href="https://www.facebook.com/petwise.vet" target="_blank" rel="noopener noreferrer" className="social-link">
                        <FaFacebook size={24} />
                    </a>
                    <a href="https://www.instagram.com/petwise.vet/" target="_blank" rel="noopener noreferrer" className="social-link">
                        <FaInstagram size={24} />
                    </a>
                </div>
            </div>

            <div className="footer-bottom">
                <p>&copy; {currentYear} PETWISE TECHNOLOGIES. All rights reserved.</p>
            </div>
        </footer>
    );
};

export default Footer; 