// ================ IMPORTS ================
import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth0 } from "@auth0/auth0-react";
import ReportForm from '../components/ReportForm';
import SavedReports from '../components/SavedReports';
import Profile from '../components/Profile';
import TermsOfService from '../components/TermsOfService';
import QuickQuery from '../components/QuickQuery';
import '../styles/Dashboard.css';
import { supabase } from '../supabaseClient';
import { FaFileAlt, FaSearch, FaSave, FaUser, FaSignOutAlt } from 'react-icons/fa';

// ================ DASHBOARD COMPONENT ================
const Dashboard = () => {
    // ================ STATE AND HOOKS ================
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [subscriptionStatus, setSubscriptionStatus] = useState(null);
    const [userData, setUserData] = useState(null);
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);

    const { logout, user, isAuthenticated } = useAuth0();
    const navigate = useNavigate();

    // ================ SUBSCRIPTION CHECK ================
    useEffect(() => {
        const checkSubscription = async () => {
            if (!user?.sub) return;

            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('subscription_status, stripe_customer_id, has_accepted_terms')
                    .eq('auth0_user_id', user.sub)
                    .single();

                if (error) {
                    if (error.code === 'PGRST116') {
                        // Create new user
                        const { data: newUser, error: createError } = await supabase
                            .from('users')
                            .insert([{
                                auth0_user_id: user.sub,
                                email: user.email,
                                subscription_status: 'inactive',
                                has_accepted_terms: false
                            }])
                            .select()
                            .single();

                        if (createError) throw createError;

                        setHasAcceptedTerms(false);
                    } else {
                        throw error;
                    }
                } else {
                    setHasAcceptedTerms(data.has_accepted_terms);
                    setSubscriptionStatus(data.subscription_status);
                    setIsSubscribed(data.subscription_status === 'active');
                    setUserData(data);
                }
            } catch (err) {
                console.error('Error:', err);
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
            const { error } = await supabase
                .from('users')
                .update({
                    has_accepted_terms: true,
                    email_opt_out: emailOptOut
                })
                .eq('auth0_user_id', user.sub);

            if (error) throw error;
            setHasAcceptedTerms(true);
        } catch (err) {
            console.error('Error accepting terms:', err);
        }
    };

    // ================ LOADING STATE ================
    if (isLoading) {
        return <div>Loading...</div>;
    }

    // Show Terms of Service if not accepted
    if (!hasAcceptedTerms) {
        return <TermsOfService onAccept={handleAcceptTerms} />;
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

    // ================ RENDER COMPONENT ================
    return (
        <div className={`dashboard-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            {/* Sidebar Navigation */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <Link to="/dashboard">
                        <span className="logo-text">petwise.vet</span>
                        {isSidebarCollapsed && (
                            <img
                                src="/favicon.ico"
                                alt="PetWise"
                                className="sidebar-favicon"
                            />
                        )}
                    </Link>
                </div>
                <button className="sidebar-toggle" onClick={toggleSidebar}>
                    {isSidebarCollapsed ? '>' : '<'}
                </button>
                <ul className="sidebar-menu">
                    {isSubscribed && (
                        <>
                            <li className="sidebar-item">
                                <Link to="/dashboard/report-form" data-tooltip="Report Generator">
                                    <FaFileAlt className="sidebar-icon" />
                                    <span className="sidebar-text">Report Generator</span>
                                </Link>
                            </li>
                            <li className="sidebar-item">
                                <Link to="/dashboard/quick-query" data-tooltip="QuickMed Query">
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
                        <Link to="/dashboard/profile" data-tooltip="Profile">
                            <FaUser className="sidebar-icon" />
                            <span className="sidebar-text">Profile</span>
                        </Link>
                    </li>
                    <li className="sidebar-item">
                        <button onClick={handleLogout} className="sidebar-link logout-button" data-tooltip="Logout">
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
                </Routes>
            </main>
        </div>
    );
};

export default Dashboard;