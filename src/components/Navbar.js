// src/components/Navbar.js

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth0 } from "@auth0/auth0-react";
import LoginButton from './LoginButton';
import LogoutButton from './LogoutButton';
import '../styles/Navbar.css'

const Navbar = () => {
    const { isAuthenticated, isLoading } = useAuth0();

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-text">Loading...</div>
            </div>
        );
    }

    return (
        <nav className="navbar">
            <div className="navbar-logo">
                <Link to="/">PetWise</Link>
            </div>
            <ul className="navbar-links">
                {!isAuthenticated && (
                    <>
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/about">About</Link></li>
                    </>
                )}
                {isAuthenticated && <li><Link to="/dashboard">Dashboard</Link></li>}
                {isAuthenticated ? (
                    <li><LogoutButton /></li>
                ) : (
                    <li><LoginButton /></li>
                )}
            </ul>
        </nav>
    );
};

export default Navbar;
