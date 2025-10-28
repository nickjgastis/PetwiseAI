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
import Templates from '../components/Templates';
// Tailwind classes will be used instead of CSS file
import { supabase } from '../supabaseClient';
import { FaFileAlt, FaSearch, FaSave, FaUser, FaSignOutAlt, FaQuestionCircle, FaClipboard } from 'react-icons/fa';

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
    const [isMobile, setIsMobile] = useState(false);
    const [showMobileProfile, setShowMobileProfile] = useState(false);

    const { logout, user, isAuthenticated } = useAuth0();
    const navigate = useNavigate();

    // Helper function to check if user is in student mode
    const isStudentMode = () => {
        return userData?.plan_label === 'student' &&
            userData?.subscription_end_date &&
            new Date(userData.subscription_end_date) > new Date();
    };

    // Helper function to check if user has any active plan (trial, subscription, or student)
    const hasActivePlan = () => {
        if (isStudentMode()) return true;

        // Check for active subscription
        const hasActiveSubscription = ['active', 'past_due'].includes(userData?.subscription_status);

        // Check for trial - only specific trial statuses
        const hasTrial = userData?.subscription_status === 'trialing' ||
            userData?.plan_label === 'trial';

        return hasActiveSubscription || hasTrial;
    };

    // ================ EVENT HANDLERS ================
    const handleLogout = () => {
        logout({
            logoutParams: {
                returnTo: process.env.NODE_ENV === 'production'
                    ? 'https://petwise.vet'
                    : 'http://localhost:3000'
            }
        });
    };

    // ================ MOBILE DETECTION ================
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        checkMobile(); // Check on initial load
        window.addEventListener('resize', checkMobile);

        return () => {
            window.removeEventListener('resize', checkMobile);
        };
    }, []);

    // ================ SUBSCRIPTION CHECK ================
    useEffect(() => {
        const checkSubscription = async () => {
            if (!user?.sub) return;

            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('subscription_status, stripe_customer_id, has_accepted_terms, email, nickname, dvm_name, grace_period_end, subscription_end_date, plan_label, student_school_email, student_grad_year')
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
                    // Add email check and update
                    if (user.email && data.email !== user.email) {
                        const { error: updateError } = await supabase
                            .from('users')
                            .update({ email: user.email })
                            .eq('auth0_user_id', user.sub);

                        if (updateError) console.error('Error updating email:', updateError);
                        data.email = user.email; // Update local data
                    }

                    // Add retry for pending states
                    if (data.subscription_status === 'pending' || data.subscription_status === 'incomplete') {
                        setTimeout(() => checkSubscription(), 2000);
                        return;
                    }

                    setHasAcceptedTerms(data.has_accepted_terms);
                    setSubscriptionStatus(data.subscription_status);

                    // Check if user has active subscription OR student access
                    const hasActiveSubscription = ['active', 'past_due'].includes(data.subscription_status);
                    const isStudentMode = data.plan_label === 'student' &&
                        data.subscription_end_date &&
                        new Date(data.subscription_end_date) > new Date();

                    setIsSubscribed(hasActiveSubscription || isStudentMode);
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

    // After onboarding, check if on mobile
    if (isMobile && !isLoading) {
        // Check if this is the admin route - allow access on mobile for admins
        const isAdminRoute = window.location.pathname.includes('/admin');
        if (isAdminRoute && user?.sub === process.env.REACT_APP_ADMIN_USER_ID) {
            // Allow admin access on mobile - return null so the admin route renders
            return null;
        }

        // Only show mobile notification if NOT on profile route
        if (!window.location.pathname.includes('/profile')) {
            return (
                <div className="min-h-screen bg-white">
                    <div className="flex flex-col items-center justify-center text-center min-h-screen p-5 bg-white bg-gradient-to-br from-white to-blue-50">
                        <img src="/PW.png" alt="Petwise Logo" className="w-30 h-30 mb-5" />
                        <h1 className="text-primary-500 text-3xl mb-5">Welcome to Petwise!</h1>
                        {isSubscribed ? (
                            <p className="text-lg leading-relaxed text-gray-600 mb-4 max-w-lg">PetWise is designed as a desktop application. You can manage your subscription here, but please use your desktop computer to access all features.</p>
                        ) : (
                            <p className="text-lg leading-relaxed text-gray-600 mb-4 max-w-lg">PetWise is designed as a desktop application, but you can sign up for a subscription here.</p>
                        )}
                        <p className="text-lg leading-relaxed text-gray-600 mb-6 max-w-lg">After subscribing, please use your desktop computer to access all features.</p>
                        <button
                            className="px-5 py-3 bg-primary-500 text-white border-none rounded-lg text-base transition-colors duration-300 cursor-pointer hover:bg-primary-600"
                            onClick={() => navigate('/dashboard/profile')}
                        >
                            {isSubscribed ? 'Continue to Profile' : 'Continue to Sign Up'}
                        </button>
                    </div>
                </div>
            );
        }

        // If on profile route, allow it but hide sidebar and only show profile
        if (window.location.pathname.includes('/profile')) {
            return (
                <div className="min-h-screen bg-white p-0">
                    <Profile isMobileSignup={true} />
                </div>
            );
        }

        // Redirect any other mobile routes to profile
        navigate('/dashboard/profile', { replace: true });
        return null;
    }

    // ================ EVENT HANDLERS ================
    const toggleSidebar = () => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    // ================ RENDER COMPONENT ================
    return (
        <>
            {/* Tooltip styles for collapsed sidebar */}
            <style jsx>{`
                .sidebar-collapsed [data-tooltip]:hover::after {
                    content: attr(data-tooltip);
                    position: absolute;
                    left: 100%;
                    top: 50%;
                    transform: translateY(-50%);
                    background: rgba(0, 0, 0, 0.9);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    white-space: nowrap;
                    margin-left: 12px;
                    z-index: 1000;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    animation: tooltipFadeIn 0.1s ease-out;
                    pointer-events: none;
                }
                
                .sidebar-collapsed [data-tooltip]:hover::before {
                    content: '';
                    position: absolute;
                    left: 100%;
                    top: 50%;
                    transform: translateY(-50%);
                    border: 5px solid transparent;
                    border-right-color: rgba(0, 0, 0, 0.9);
                    margin-left: 2px;
                    z-index: 1001;
                    pointer-events: none;
                }
                
                @keyframes tooltipFadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-50%) scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(-50%) scale(1);
                    }
                }
            `}</style>
            <div className="flex h-screen bg-white">
                {/* Mobile Header */}
                {window.innerWidth <= 768 && (
                    <>
                        <div className="flex fixed top-0 left-0 right-0 h-16 bg-primary-500 items-center justify-between px-4 z-50 shadow-md">
                            <button
                                className="flex flex-col justify-around w-8 h-6 bg-transparent border-none cursor-pointer p-0 z-50"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            >
                                <span className="w-8 h-0.5 bg-white rounded transition-all duration-300"></span>
                                <span className="w-8 h-0.5 bg-white rounded transition-all duration-300"></span>
                                <span className="w-8 h-0.5 bg-white rounded transition-all duration-300"></span>
                            </button>
                            <div className="text-white text-2xl font-inter flex items-center gap-2.5 tracking-wide">
                                <img src="/PW.png" alt="PW" className="w-8 h-8 object-contain" />
                                <span>
                                    <span className="font-bold text-white">Petwise</span>
                                    <span className="font-normal text-white">.vet</span>
                                </span>
                            </div>
                        </div>
                        <div
                            className={`fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                }`}
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                    </>
                )}

                {/* Sidebar Navigation */}
                <aside className={`fixed top-0 left-0 h-full bg-gradient-to-b from-primary-600 to-primary-700 shadow-2xl z-50 flex flex-col transition-all duration-300 ${isMobileMenuOpen ? 'left-0' : 'left-[-250px]'
                    } ${isSidebarCollapsed ? 'w-20 sidebar-collapsed' : 'w-56'} md:left-0`}>
                    {/* Logo Section */}
                    <div className="p-4 text-center border-b border-white border-opacity-20 flex flex-col items-center justify-center relative">
                        <Link to="/dashboard" className={`text-white no-underline font-inter transition-colors duration-300 flex items-center text-xl gap-3 tracking-wide group ${isSidebarCollapsed ? 'justify-center' : 'justify-center'}`}>
                            <div className="relative">
                                <img src="/PW.png" alt="PW" className={`w-10 h-10 object-contain transition-transform duration-300 group-hover:scale-110 ${isSidebarCollapsed ? 'ml-1' : ''}`} />
                                {!isSidebarCollapsed && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent-400 rounded-full animate-pulse"></div>
                                )}
                            </div>
                            <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
                                <span className="font-bold text-white">Petwise</span>
                                <span className="font-normal text-white opacity-90">.vet</span>
                            </span>
                        </Link>
                    </div>
                    {/* User Info Section */}
                    {isStudentMode() ? (
                        <div className={`mx-2 my-2 p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg border border-white border-opacity-20 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                                    <span className="text-white text-sm">🎓</span>
                                </div>
                                <div className="text-white text-sm font-bold tracking-wide uppercase">Student</div>
                            </div>
                            <div className="text-white text-base font-semibold mb-1">{userData?.nickname || 'Student'}</div>
                            <div className="text-white text-xs opacity-85">
                                Access until {new Date(userData.subscription_end_date).toLocaleDateString()}
                            </div>
                        </div>
                    ) : (
                        userData?.dvm_name && (
                            <div className={`mx-2 my-2 p-3 bg-white bg-opacity-10 rounded-lg border border-white border-opacity-20 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
                                <div className="flex items-center gap-3">
                                    {hasActivePlan() && (
                                        <div className="w-8 h-8 bg-accent-400 rounded-full flex items-center justify-center">
                                            <span className="text-white text-sm font-bold">Dr.</span>
                                        </div>
                                    )}
                                    <div className="text-white text-base font-medium">{userData.dvm_name}</div>
                                </div>
                            </div>
                        )
                    )}
                    {/* Navigation Menu */}
                    <ul className="list-none p-0 m-0 flex-1">
                        {isSubscribed && (
                            <>
                                <li className="mx-2 my-1 relative">
                                    <Link
                                        to="/dashboard/report-form"
                                        onClick={closeMobileMenu}
                                        data-tooltip="Report Generator"
                                        className={`flex items-center text-white no-underline text-base py-2.5 px-3 rounded-lg transition-all duration-200 w-full whitespace-nowrap hover:bg-white hover:bg-opacity-20 hover:text-accent-400 group ${isSidebarCollapsed ? 'justify-center' : 'text-left'}`}
                                    >
                                        <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center transition-colors duration-200">
                                            <FaFileAlt className="text-sm" />
                                        </div>
                                        <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'}`}>PetSOAP</span>
                                    </Link>
                                </li>
                                <li className="mx-2 my-1 relative">
                                    <Link
                                        to="/dashboard/quick-query"
                                        onClick={closeMobileMenu}
                                        data-tooltip="QuickMed Query"
                                        className={`flex items-center text-white no-underline text-base py-2.5 px-3 rounded-lg transition-all duration-200 w-full whitespace-nowrap hover:bg-white hover:bg-opacity-20 hover:text-accent-400 group ${isSidebarCollapsed ? 'justify-center' : 'text-left'}`}
                                    >
                                        <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center transition-colors duration-200">
                                            <FaSearch className="text-sm" />
                                        </div>
                                        <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'}`}>PetQuery</span>
                                    </Link>
                                </li>
                                <li className="mx-2 my-1 relative">
                                    <Link
                                        to="/dashboard/saved-reports"
                                        data-tooltip="Saved Reports"
                                        className={`flex items-center text-white no-underline text-base py-2.5 px-3 rounded-lg transition-all duration-200 w-full whitespace-nowrap hover:bg-white hover:bg-opacity-20 hover:text-accent-400 group ${isSidebarCollapsed ? 'justify-center' : 'text-left'}`}
                                    >
                                        <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center transition-colors duration-200">
                                            <FaSave className="text-sm" />
                                        </div>
                                        <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'}`}>Saved Records</span>
                                    </Link>
                                </li>
                                <li className="mx-2 my-1 relative">
                                    <Link
                                        to="/dashboard/templates"
                                        data-tooltip="My Templates"
                                        className={`flex items-center text-white no-underline text-base py-2.5 px-3 rounded-lg transition-all duration-200 w-full whitespace-nowrap hover:bg-white hover:bg-opacity-20 hover:text-accent-400 group ${isSidebarCollapsed ? 'justify-center' : 'text-left'}`}
                                    >
                                        <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center transition-colors duration-200">
                                            <FaClipboard className="text-sm" />
                                        </div>
                                        <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'}`}>My Templates</span>
                                    </Link>
                                </li>
                            </>
                        )}
                        <li className="mx-2 my-1 relative">
                            <Link
                                to="/dashboard/profile"
                                onClick={closeMobileMenu}
                                data-tooltip="Profile"
                                className={`flex items-center text-white no-underline text-base py-2.5 px-3 rounded-lg transition-all duration-200 w-full whitespace-nowrap hover:bg-white hover:bg-opacity-20 hover:text-accent-400 group ${isSidebarCollapsed ? 'justify-center' : 'text-left'}`}
                            >
                                <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center transition-colors duration-200">
                                    <FaUser className="text-sm" />
                                </div>
                                <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'}`}>Profile</span>
                            </Link>
                        </li>
                        {subscriptionStatus === 'past_due' && (
                            <li className={`mx-2 my-1 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
                                <Link
                                    to="/dashboard/profile"
                                    className="flex items-center text-orange-800 no-underline font-medium bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-400 rounded-lg p-2.5 hover:from-orange-100 hover:to-orange-200 transition-all duration-200"
                                >
                                    <div className="w-6 h-6 bg-orange-200 rounded flex items-center justify-center mr-2">
                                        <span className="text-orange-600 text-xs">💳</span>
                                    </div>
                                    <span className="text-xs">Payment needs attention</span>
                                </Link>
                            </li>
                        )}
                        <li className="mx-2 my-1 relative">
                            <Link
                                to="/dashboard/help"
                                onClick={closeMobileMenu}
                                data-tooltip="Help"
                                className={`flex items-center text-white no-underline text-base py-2.5 px-3 rounded-lg transition-all duration-200 w-full whitespace-nowrap hover:bg-white hover:bg-opacity-20 hover:text-accent-400 group ${isSidebarCollapsed ? 'justify-center' : 'text-left'}`}
                            >
                                <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center transition-colors duration-200">
                                    <FaQuestionCircle className="text-sm" />
                                </div>
                                <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'}`}>Help</span>
                            </Link>
                        </li>
                        <li className="mx-2 my-1 relative">
                            <button
                                onClick={() => {
                                    closeMobileMenu();
                                    handleLogout();
                                }}
                                className={`flex items-center text-white no-underline text-base py-2.5 px-3 rounded-lg transition-all duration-200 w-full whitespace-nowrap hover:bg-red-500 hover:bg-opacity-20 hover:text-red-300 group bg-transparent border-none cursor-pointer ${isSidebarCollapsed ? 'justify-center' : 'text-left'}`}
                                data-tooltip="Logout"
                            >
                                <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center group-hover:bg-red-500 transition-colors duration-200">
                                    <FaSignOutAlt className="text-sm" />
                                </div>
                                <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'}`}>Logout</span>
                            </button>
                        </li>
                    </ul>

                    {/* Toggle Button - Below Logout */}
                    <div className="flex justify-center py-2">
                        <button
                            className="w-6 h-6 bg-white bg-opacity-20 hover:bg-opacity-30 rounded text-white text-xs flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
                            onClick={toggleSidebar}
                            aria-label="Toggle Sidebar"
                        >
                            &lt;
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className={`flex-1 bg-white transition-all duration-300 min-h-screen ${isSidebarCollapsed ? 'ml-20' : 'ml-56'}`} style={{ width: isSidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 224px)' }}>
                    {/* Mobile padding for header */}
                    <div className="md:hidden h-16"></div>
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
                                isSubscribed ?
                                    <SavedReports /> :
                                    <Navigate to="/dashboard/profile" replace />
                            }
                        />
                        <Route
                            path="templates"
                            element={
                                isSubscribed ?
                                    <Templates /> :
                                    <Navigate to="/dashboard/profile" replace />
                            }
                        />
                        <Route path="profile" element={<Profile />} />
                        <Route path="help" element={<Help />} />
                    </Routes>
                </main>
            </div>
        </>
    );
};

export default Dashboard;