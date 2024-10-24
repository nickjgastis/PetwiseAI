// src/components/Navbar.js

import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Navbar.css'

const Navbar = () => {
    return (
        <>
            {/* Top Navbar */}
            <nav className="navbar">
                <div className="navbar-container">
                    <Link to="/" className="navbar-logo">
                        PetwiseAI
                    </Link>
                    <ul className="nav-menu">
                        <li className="nav-item">
                            <Link to="/" className="nav-links">
                                Home
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link to="/signup" className="nav-links">
                                Signup
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link to="/login" className="nav-links">
                                Login
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link to="/dashboard" className="nav-links">
                                Dashboard
                            </Link>
                        </li>
                    </ul>
                </div>
            </nav>


        </>
    );
};

export default Navbar;
