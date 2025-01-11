// ================ IMPORTS ================
import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth0 } from "@auth0/auth0-react";
import ReportForm from '../components/ReportForm';
import SavedReports from '../components/SavedReports';
import Profile from '../components/Profile';
import TermsOfService from '../components/TermsOfService';
import QuickQuery from '../components/QuickQuery';
import Help from '../components/Help';
import Welcome from '../components/Welcome';
import '../styles/Dashboard.css';
import { supabase } from '../supabaseClient';
import { FaFileAlt, FaSearch, FaSave, FaUser, FaSignOutAlt, FaQuestionCircle } from 'react-icons/fa';

// ================ DASHBOARD COMPONENT ================
const Dashboard = () => {
    // ================ STATE AND HOOKS ================
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [subscriptionStatus, setSubscriptionStatus] = useState(null);
    const [userData, setUserData] = useState(null);
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [needsWelcome, setNeedsWelcome] = useState(false);

    const { logout, user, isAuthenticated } = useAuth0();
    const navigate = useNavigate();

    // ================ SUBSCRIPTION CHECK ================
    useEffect(() => {
        const checkSubscription = async () => {
            if (!user?.sub) return;

            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('subscription_status, stripe_customer_id, has_accepted_terms, email, nickname, dvm_name')
                    .eq('auth0_user_id', user.sub)
                    .single();

                if (error) {
                    if (error.code === 'PGRST116') {
                        // Create new user - ensure email is captured
                        if (!user.email) {
                            console.error('No email provided from Auth0');
                            throw new Error('Email is required for registration');
                        }

                        const { data: newUser, error: createError } = await supabase
                            .from('users')
                            .insert([{
                                auth0_user_id: user.sub,
                                email: user.email,  // This is already being captured
                                nickname: user.nickname || user.name,
                                subscription_status: 'inactive',
                                has_accepted_terms: false,
                                dvm_name: null,
                                created_at: new Date().toISOString() // Add creation timestamp
                            }])
                            .select()
                            .single();

                        if (createError) throw createError;
                        setHasAcceptedTerms(false);
                        setNeedsWelcome(true);
                        setUserData(newUser);
                    } else {
                        // Add retry for other errors
                        console.error('Error fetching user data:', error);
                        setTimeout(() => checkSubscription(), 2000);
                        return;
                    }
                } else {
                    // Add retry for pending states
                    if (data.subscription_status === 'pending' || data.subscription_status === 'incomplete') {
                        setTimeout(() => checkSubscription(), 2000);
                        return;
                    }

                    setHasAcceptedTerms(data.has_accepted_terms);
                    setSubscriptionStatus(data.subscription_status);
                    setIsSubscribed(data.subscription_status === 'active');
                    setUserData(data);

                    if (!data.dvm_name || data.dvm_name === null || data.dvm_name === '') {
                        setNeedsWelcome(true);
                    }
                }
            } catch (err) {
                console.error('Error:', err);
                // Add retry for any other errors
                setTimeout(() => checkSubscription(), 2000);
            } finally {
                setIsLoading(false);
            }
        };

        if (isAuthenticated && user) {
            checkSubscription();
        }
    }, [isAuthenticated, user]);

    const handleAcceptTerms = async ({ emailOptOut }) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .update({
                    has_accepted_terms: true,
                    email_opt_out: emailOptOut
                })
                .eq('auth0_user_id', user.sub)
                .select()
                .single();

            if (error) throw error;
            setHasAcceptedTerms(true);
            setUserData(data);
            setNeedsWelcome(true);
        } catch (err) {
            console.error('Error accepting terms:', err);
        }
    };

    // ================ LOADING STATE ================
    if (isLoading) {
        return <div>Loading...</div>;
    }

    // Check terms first
    if (!hasAcceptedTerms) {
        return <TermsOfService onAccept={handleAcceptTerms} />;
    }

    // Then check if they need to set their DVM name
    if (needsWelcome || !userData?.dvm_name) {
        return <Welcome onComplete={(updatedData) => {
            setNeedsWelcome(false);
            setUserData(updatedData);
        }} />;
    }

    // ================ EVENT HANDLERS ================
    const toggleSidebar = () => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    };

    const handleLogout = () => {
        logout({
            logoutParams: {
                returnTo: `${window.location.origin}/`
            }
        });
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    // ================ RENDER COMPONENT ================
    return (
        <div className={`dashboard-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            {/* Mobile Header */}
            {window.innerWidth <= 768 && (
                <>
                    <div className="mobile-header">
                        <button
                            className="mobile-hamburger"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            <span></span>
                            <span></span>
                            <span></span>
                        </button>
                        <div className="mobile-logo">
                            <img src="/PW.png" alt="PW" className="logo-img" />
                            petwise.vet
                        </div>
                    </div>
                    <div
                        className={`sidebar-overlay ${isMobileMenuOpen ? 'active' : ''}`}
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                </>
            )}

            {/* Sidebar Navigation */}
            <aside className={`sidebar ${isMobileMenuOpen ? 'active' : ''}`}>
                <div className="sidebar-logo">
                    <Link to="/dashboard">
                        <img src="/PW.png" alt="PW" className="logo-img" />
                        <span className="logo-text">petwise.vet</span>
                    </Link>
                </div>
                {userData?.dvm_name && (
                    <div className="dvm-section">Dr. {userData.dvm_name}</div>
                )}
                <button className="sidebar-toggle" onClick={toggleSidebar} aria-label="Toggle Sidebar">
                    {isSidebarCollapsed ? '›' : '‹'}
                </button>
                <ul className="sidebar-menu">
                    {isSubscribed && (
                        <>
                            <li className="sidebar-item">
                                <Link to="/dashboard/report-form" onClick={closeMobileMenu} data-tooltip="Report Generator">
                                    <FaFileAlt className="sidebar-icon" />
                                    <span className="sidebar-text">Report Generator</span>
                                </Link>
                            </li>
                            <li className="sidebar-item">
                                <Link to="/dashboard/quick-query" onClick={closeMobileMenu} data-tooltip="QuickMed Query">
                                    <FaSearch className="sidebar-icon" />
                                    <span className="sidebar-text">QuickMed Query</span>
                                </Link>
                            </li>
                            {userData?.stripe_customer_id && (
                                <li className="sidebar-item">
                                    <Link to="/dashboard/saved-reports" data-tooltip="Saved Reports">
                                        <FaSave className="sidebar-icon" />
                                        <span className="sidebar-text">Saved Reports</span>
                                    </Link>
                                </li>
                            )}
                        </>
                    )}
                    <li className="sidebar-item">
                        <Link to="/dashboard/profile" onClick={closeMobileMenu} data-tooltip="Profile">
                            <FaUser className="sidebar-icon" />
                            <span className="sidebar-text">Profile</span>
                        </Link>
                    </li>
                    <li className="sidebar-item">
                        <Link to="/dashboard/help" onClick={closeMobileMenu} data-tooltip="Help">
                            <FaQuestionCircle className="sidebar-icon" />
                            <span className="sidebar-text">Help</span>
                        </Link>
                    </li>
                    <li className="sidebar-item">
                        <button
                            onClick={() => {
                                closeMobileMenu();
                                handleLogout();
                            }}
                            className="sidebar-link logout-button"
                            data-tooltip="Logout"
                        >
                            <FaSignOutAlt className="sidebar-icon" />
                            <span className="sidebar-text">Logout</span>
                        </button>
                    </li>
                </ul>
            </aside>

            {/* Main Content Area */}
            <main className="main-content">
                <Routes>
                    <Route
                        path="/"
                        element={
                            <Navigate to={isSubscribed ? "/dashboard/report-form" : "/dashboard/profile"} replace />
                        }
                    />
                    <Route
                        path="quick-query"
                        element={
                            isSubscribed ?
                                <QuickQuery /> :
                                <Navigate to="/dashboard/profile" replace />
                        }
                    />
                    <Route
                        path="report-form"
                        element={
                            isSubscribed ?
                                <ReportForm
                                    subscriptionType={userData?.subscription_type}
                                    subscriptionStatus={subscriptionStatus}
                                /> :
                                <Navigate to="/dashboard/profile" replace />
                        }
                    />
                    <Route
                        path="saved-reports"
                        element={
                            (isSubscribed && userData?.stripe_customer_id) ?
                                <SavedReports /> :
                                <Navigate to="/dashboard/profile" replace />
                        }
                    />
                    <Route path="profile" element={<Profile />} />
                    <Route path="help" element={<Help />} />
                </Routes>
            </main>
        </div>
    );
};

export default Dashboard;