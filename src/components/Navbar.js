// src/components/Navbar.js

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth0 } from "@auth0/auth0-react";
import LoginButton from './LoginButton';
import '../styles/Navbar.css'

const Navbar = () => {
    const { isAuthenticated, isLoading } = useAuth0();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-text">Loading...</div>
            </div>
        );
    }

    // Hide navbar on dashboard routes
    if (location.pathname.startsWith('/dashboard')) {
        return null;
    }

    return (
        <nav className="navbar">
            <div className="navbar-logo">
                <img src="/PW.png" alt="Petwise Logo" className="navbar-logo-image" />
                <Link to="/">petwise.vet</Link>
            </div>
            <button className="hamburger" onClick={() => setIsOpen(!isOpen)}>
                <span></span>
                <span></span>
                <span></span>
            </button>
            <ul className={`navbar-links ${isOpen ? 'active' : ''}`}>
                {!isAuthenticated && (
                    <>
                        <li><Link to="/" onClick={() => setIsOpen(false)}>Home</Link></li>
                        <li><Link to="/about" onClick={() => setIsOpen(false)}>About</Link></li>
                        <li><Link to="/product" onClick={() => setIsOpen(false)}>Product</Link></li>
                    </>
                )}
                {isAuthenticated && <li><Link to="/dashboard" onClick={() => setIsOpen(false)}>Dashboard</Link></li>}
                {!isAuthenticated && <li className="login-container"><LoginButton /></li>}
            </ul>
        </nav>
    );
};

export default Navbar;
