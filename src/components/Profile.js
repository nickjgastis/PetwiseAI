import React, { useEffect, useState, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { useSubscription } from '../hooks/useSubscription';
import { useUsage } from '../hooks/useUsage';
import UsageMeter from './UsageMeter';
import ManageAccount from './ManageAccount';
import StudentRedeem from './StudentRedeem';
import ManageSubscription from './ManageSubscription';
import {
    FaUser, FaChartPie, FaCreditCard, FaShieldAlt, FaMobile,
    FaGraduationCap, FaEnvelope, FaCircle
} from 'react-icons/fa';
import { clearAppLocalStorage } from '../utils/clearUserData';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

// Row inside a settings card: label left, value right
const InfoRow = ({ label, children }) => (
    <div className="flex items-center justify-between py-3.5 border-b border-gray-100 last:border-b-0">
        <span className="text-[13px] font-medium text-gray-500">{label}</span>
        <span className="text-[13px] font-semibold text-gray-800 text-right">{children}</span>
    </div>
);

const SectionCard = ({ title, subtitle, children, className = '' }) => (
    <div className={`rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 ${className}`}>
        {title && <h3 className="text-sm font-bold text-gray-900">{title}</h3>}
        {subtitle && <p className="text-[13px] text-gray-500 mt-0.5 mb-4">{subtitle}</p>}
        {!subtitle && title && <div className="mb-4" />}
        {children}
    </div>
);

const Profile = ({ isMobileSignup = false }) => {
    const { user, isAuthenticated, isLoading: auth0Loading, logout } = useAuth0();
    const navigate = useNavigate();
    const location = useLocation();
    const [subscriptionStatus, setSubscriptionStatus] = useState(null);
    const [subscriptionEndDate, setSubscriptionEndDate] = useState(null);
    const { isSubscribed, cancelAtPeriodEnd } = useSubscription();
    const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const usage = useUsage();

    // Settings navigation
    const [activeSection, setActiveSection] = useState('profile');
    const [showStudentRedeem, setShowStudentRedeem] = useState(false);

    // Mobile-only sub-pages
    const [showCheckout, setShowCheckout] = useState(false);
    const [showManageAccount, setShowManageAccount] = useState(false);

    // Helper function to check if user is in student mode
    const isStudentMode = () => {
        return userData?.plan_label === 'student' &&
            userData?.subscription_end_date &&
            new Date(userData.subscription_end_date) > new Date();
    };

    // Helper function to check if user can redeem student access
    const canRedeemStudentAccess = () => {
        if (userData?.student_grad_year) {
            const gradYear = userData.student_grad_year;
            const cutoffDate = new Date(Date.UTC(gradYear, 7, 31, 23, 59, 59, 999)); // Aug 31
            return new Date() < cutoffDate;
        }
        return true;
    };

    const getGracePeriodDays = () => {
        if (userData?.grace_period_end && subscriptionStatus === 'past_due') {
            const daysLeft = Math.ceil((new Date(userData.grace_period_end) - new Date()) / (1000 * 60 * 60 * 24));
            return daysLeft > 0 ? daysLeft : 0;
        }
        return null;
    };

    const handleStudentRedeemSuccess = () => {
        setShowStudentRedeem(false);
        window.location.reload();
    };

    const checkSubscription = useCallback(async () => {
        if (!user?.sub) return;

        setIsSubscriptionLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select(`
                    subscription_status,
                    subscription_end_date,
                    stripe_customer_id,
                    subscription_interval,
                    cancel_at_period_end,
                    dvm_name,
                    grace_period_end,
                    plan_label,
                    student_school_email,
                    student_grad_year
                `)
                .eq('auth0_user_id', user.sub)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Subscription check error:', error);
                return;
            }

            if (data) {
                setSubscriptionStatus(data.subscription_status);
                setSubscriptionEndDate(data.subscription_end_date);
                setUserData(data);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setIsSubscriptionLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (isAuthenticated && user) {
            checkSubscription();
        }
    }, [isAuthenticated, user, checkSubscription]);

    // Deep links from elsewhere in the app
    useEffect(() => {
        if (location.state?.openCheckout) {
            setActiveSection('billing');
            setShowCheckout(true); // mobile path
            navigate(location.pathname, { replace: true });
        } else if (location.state?.scrollToUsage) {
            setActiveSection('usage');
            navigate(location.pathname, { replace: true });
        }
    }, [location, navigate]);

    const handleBillingPortal = async () => {
        try {
            const response = await fetch(`${API_URL}/create-customer-portal`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.sub }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to access billing portal');
            }

            window.location.href = data.url;
        } catch (error) {
            console.error('Billing portal error:', error);
            alert(`Unable to access billing portal: ${error.message}`);
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    const planLabel = () => {
        if (isStudentMode()) return 'Student';
        if (subscriptionStatus === 'active' && userData?.subscription_interval === 'yearly') return 'Yearly';
        if (subscriptionStatus === 'active' && userData?.subscription_interval === 'monthly') return 'Monthly';
        return 'Free';
    };

    const planBadge = () => {
        const label = planLabel();
        const styles = {
            Student: 'bg-purple-50 text-purple-700 border-purple-200',
            Yearly: 'bg-amber-50 text-amber-700 border-amber-200',
            Monthly: 'bg-blue-50 text-[#3468bd] border-blue-200',
            Free: 'bg-gray-100 text-gray-600 border-gray-200'
        };
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${styles[label]}`}>
                {label === 'Student' && <FaGraduationCap className="text-[10px]" />}
                {label} plan
            </span>
        );
    };

    // Show loading state only when auth0 is loading or subscription is loading
    if (auth0Loading || (isAuthenticated && isSubscriptionLoading)) {
        return (
            <div className="min-h-screen bg-[#f7f8fb] flex items-center justify-center">
                <div className="text-base text-gray-500 font-medium">Loading ...</div>
            </div>
        );
    }

    if (!isAuthenticated) return null;

    const manageSubscriptionUser = {
        ...user,
        ...userData,
        cancel_at_period_end: cancelAtPeriodEnd
    };

    const pastDueBanner = subscriptionStatus === 'past_due' && (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 flex items-start gap-3"
        >
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
                <h3 className="text-red-800 text-sm font-bold mb-0.5">Subscription Past Due</h3>
                <p className="text-red-700 text-[13px]">
                    Your payment is past due.
                    {getGracePeriodDays() !== null && getGracePeriodDays() > 0 && ` Your subscription will be canceled in ${getGracePeriodDays()} ${getGracePeriodDays() === 1 ? 'day' : 'days'} unless payment is resolved.`}
                    {getGracePeriodDays() === 0 && ' Your grace period has expired. Please update your payment method immediately.'}
                    {getGracePeriodDays() === null && ' Please update your payment method in Billing Settings.'}
                </p>
            </div>
            {userData?.stripe_customer_id && (
                <button
                    className="bg-red-600 text-white px-4 py-2 rounded-xl font-semibold text-xs hover:bg-red-700 transition-all whitespace-nowrap"
                    onClick={handleBillingPortal}
                >
                    Fix Payment
                </button>
            )}
        </motion.div>
    );

    // ================ MOBILE (PWA) LAYOUT ================
    if (isMobileSignup) {
        if (showCheckout) {
            return (
                <div className="min-h-screen bg-[#f7f8fb] px-4 py-6">
                    <ManageSubscription
                        user={manageSubscriptionUser}
                        subscriptionStatus={subscriptionStatus}
                        subscriptionInterval={userData?.subscription_interval}
                        onBack={() => setShowCheckout(false)}
                        onSubscriptionChange={checkSubscription}
                    />
                </div>
            );
        }
        if (showManageAccount) {
            return (
                <div className="min-h-screen bg-[#f7f8fb] px-4 py-6">
                    <ManageAccount user={user} onBack={() => setShowManageAccount(false)} />
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-[#f7f8fb]">
                <div className="px-4 py-6 space-y-4">
                    {/* Profile Header Card */}
                    <div className="bg-gradient-to-br from-[#3468bd] to-[#2a5298] rounded-2xl p-5 text-white shadow-lg">
                        <div className="flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold truncate">
                                    {userData?.dvm_name ? `Dr. ${userData.dvm_name}` : user?.name || 'Welcome'}
                                </h2>
                                <p className="text-white/80 text-sm truncate">{user?.email}</p>
                                <div className="mt-1.5">{planBadge()}</div>
                            </div>
                        </div>
                    </div>

                    {pastDueBanner}

                    {/* Usage */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="text-sm font-bold text-gray-900 mb-4">Monthly Usage</h3>
                        <UsageMeter usage={usage} onUpgrade={() => setShowCheckout(true)} />
                    </div>

                    {/* Subscription */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <FaCircle className={`text-[8px] ${isSubscribed ? 'text-emerald-500' : 'text-gray-300'}`} />
                                Your Plan
                            </h3>
                        </div>
                        <div className="p-4 space-y-2.5">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 text-[13px]">Plan</span>
                                <span className="text-gray-800 font-semibold text-[13px]">{planLabel()}</span>
                            </div>
                            {subscriptionEndDate && subscriptionStatus === 'active' && (
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 text-[13px]">{cancelAtPeriodEnd ? 'Ends' : 'Renews'}</span>
                                    <span className="text-gray-800 font-semibold text-[13px]">{formatDate(subscriptionEndDate)}</span>
                                </div>
                            )}
                        </div>
                        <div className="p-4 pt-0">
                            <button
                                className="w-full bg-[#3468bd] text-white py-3 rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform"
                                onClick={() => setShowCheckout(true)}
                            >
                                {planLabel() === 'Free' ? 'Upgrade Plan' : 'Manage Subscription'}
                            </button>
                        </div>
                    </div>

                    {/* Account actions */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                        <button
                            className="w-full flex items-center justify-between p-4 text-left active:bg-gray-50 transition-colors"
                            onClick={() => setShowManageAccount(true)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                                    <FaShieldAlt className="text-[#3468bd] text-sm" />
                                </div>
                                <div>
                                    <p className="text-gray-800 font-medium text-sm">Account Settings</p>
                                    <p className="text-gray-400 text-xs">Security and account management</p>
                                </div>
                            </div>
                            <span className="text-gray-300">›</span>
                        </button>
                        <button
                            className="w-full flex items-center justify-between p-4 text-left active:bg-gray-50 transition-colors"
                            onClick={() => {
                                const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                                    window.navigator.standalone === true;
                                clearAppLocalStorage();
                                localStorage.removeItem('auth0.is.authenticated');
                                logout({
                                    logoutParams: {
                                        returnTo: isStandalone ? 'https://app.petwise.vet' : 'https://petwise.vet'
                                    }
                                });
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
                                    <FaUser className="text-red-500 text-sm" />
                                </div>
                                <div>
                                    <p className="text-red-600 font-medium text-sm">Log Out</p>
                                    <p className="text-gray-400 text-xs">Sign out of your account</p>
                                </div>
                            </div>
                            <span className="text-gray-300">›</span>
                        </button>
                    </div>

                    <p className="text-center text-gray-400 text-xs pt-2">Petwise.vet • Version 1.0</p>
                </div>
            </div>
        );
    }

    // ================ DESKTOP SETTINGS LAYOUT ================
    const NAV_ITEMS = [
        { id: 'profile', label: 'Profile', icon: FaUser },
        { id: 'usage', label: 'Usage', icon: FaChartPie },
        { id: 'billing', label: 'Plan & Billing', icon: FaCreditCard },
        { id: 'account', label: 'Account', icon: FaShieldAlt },
        { id: 'mobile', label: 'Mobile App', icon: FaMobile },
    ];

    const SECTION_TITLES = {
        profile: { title: 'Profile', subtitle: 'Your details as they appear on reports' },
        usage: { title: 'Usage', subtitle: 'Your monthly allowance at a glance' },
        billing: { title: 'Plan & Billing', subtitle: 'Manage your plan, payment, and invoices' },
        account: { title: 'Account', subtitle: 'Security and account management' },
        mobile: { title: 'Mobile App', subtitle: 'Take PetWise into the exam room' },
    };

    return (
        <div className="min-h-screen bg-[#f7f8fb]">
            {/* Student redeem modal (desktop) */}
            {showStudentRedeem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <StudentRedeem
                        onSuccess={handleStudentRedeemSuccess}
                        onCancel={() => setShowStudentRedeem(false)}
                        userData={userData}
                    />
                </div>
            )}

            <div className="max-w-6xl mx-auto px-6 py-10">
                {/* Page header */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-8"
                >
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage your profile, plan, and account</p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-[230px,1fr] gap-8 items-start">
                    {/* Left nav */}
                    <motion.nav
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                        className="md:sticky md:top-8"
                    >
                        {/* User chip */}
                        <div className="flex items-center gap-3 px-3 py-3 mb-4 rounded-2xl bg-white border border-gray-200">
                            <div className="min-w-0">
                                <p className="text-[13px] font-bold text-gray-900 truncate">
                                    {userData?.dvm_name ? `Dr. ${userData.dvm_name}` : user?.name}
                                </p>
                                <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
                            </div>
                        </div>

                        <ul className="space-y-0.5">
                            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
                                const isActive = activeSection === id;
                                return (
                                    <li key={id} className="relative">
                                        <button
                                            onClick={() => setActiveSection(id)}
                                            className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                                                isActive ? 'text-[#3468bd]' : 'text-gray-500 hover:text-gray-800'
                                            }`}
                                        >
                                            {isActive && (
                                                <motion.span
                                                    layoutId="settings-active-pill"
                                                    className="absolute inset-0 rounded-xl bg-blue-50 border border-blue-100"
                                                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                                                />
                                            )}
                                            <Icon className={`relative text-xs ${isActive ? 'text-[#3468bd]' : 'text-gray-400'}`} />
                                            <span className="relative">{label}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </motion.nav>

                    {/* Content panel */}
                    <div className="min-w-0">
                        {pastDueBanner}

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeSection}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                            >
                                <div className="mb-5">
                                    <h2 className="text-lg font-bold text-gray-900">{SECTION_TITLES[activeSection].title}</h2>
                                    <p className="text-[13px] text-gray-500">{SECTION_TITLES[activeSection].subtitle}</p>
                                </div>

                                {/* ===== Profile ===== */}
                                {activeSection === 'profile' && (
                                    <div className="space-y-5">
                                        <div className="rounded-2xl border border-gray-200 bg-white p-6 flex items-center gap-5">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-bold text-gray-900 truncate">
                                                    {userData?.dvm_name ? `Dr. ${userData.dvm_name}` : user?.name}
                                                </h3>
                                                <p className="text-[13px] text-gray-500 flex items-center gap-1.5 truncate">
                                                    <FaEnvelope className="text-[10px] text-gray-400" />
                                                    {user?.email}
                                                </p>
                                            </div>
                                            {planBadge()}
                                        </div>

                                        <SectionCard>
                                            <InfoRow label="DVM name">
                                                {isStudentMode() ? 'Student Mode' : (userData?.dvm_name ? `Dr. ${userData.dvm_name}` : 'Not set')}
                                            </InfoRow>
                                            <InfoRow label="Nickname">{user?.nickname || 'Not set'}</InfoRow>
                                            <InfoRow label="Email">{user?.email}</InfoRow>
                                            <InfoRow label="Last updated">
                                                {user?.updated_at ? new Date(user.updated_at).toLocaleDateString() : '—'}
                                            </InfoRow>
                                            {isStudentMode() && (
                                                <>
                                                    <InfoRow label="Student email">{userData?.student_school_email || 'Not provided'}</InfoRow>
                                                    <InfoRow label="Graduation year">{userData?.student_grad_year || 'Not set'}</InfoRow>
                                                </>
                                            )}
                                        </SectionCard>
                                    </div>
                                )}

                                {/* ===== Usage ===== */}
                                {activeSection === 'usage' && (
                                    <div className="space-y-5">
                                        <SectionCard>
                                            <UsageMeter usage={usage} onUpgrade={() => setActiveSection('billing')} />
                                        </SectionCard>
                                        {!usage.isUnlimited && (
                                            <div className="rounded-2xl bg-gradient-to-br from-[#3468bd] to-[#2a5298] p-6 text-white flex flex-wrap items-center justify-between gap-4">
                                                <div>
                                                    <h3 className="text-base font-bold">Go unlimited</h3>
                                                    <p className="text-white/75 text-[13px] mt-0.5">
                                                        Unlimited SOAP notes and PetQuery, every month.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => setActiveSection('billing')}
                                                    className="px-5 py-2.5 bg-white text-[#3468bd] font-bold rounded-xl text-sm hover:bg-blue-50 transition-colors"
                                                >
                                                    View plans
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ===== Billing ===== */}
                                {activeSection === 'billing' && (
                                    <div className="space-y-5">
                                        {subscriptionStatus === 'active' && subscriptionEndDate && (
                                            <SectionCard>
                                                <InfoRow label="Status">
                                                    <span className="text-emerald-600">● Active</span>
                                                </InfoRow>
                                                <InfoRow label={cancelAtPeriodEnd ? 'Access ends' : 'Renews'}>
                                                    {formatDate(subscriptionEndDate)}
                                                    {cancelAtPeriodEnd && <span className="text-amber-600 ml-1.5">(will not renew)</span>}
                                                </InfoRow>
                                            </SectionCard>
                                        )}
                                        <ManageSubscription
                                            user={manageSubscriptionUser}
                                            subscriptionStatus={subscriptionStatus}
                                            subscriptionInterval={userData?.subscription_interval}
                                            onSubscriptionChange={checkSubscription}
                                        />
                                    </div>
                                )}

                                {/* ===== Account ===== */}
                                {activeSection === 'account' && (
                                    <ManageAccount user={user} />
                                )}

                                {/* ===== Mobile App ===== */}
                                {activeSection === 'mobile' && (
                                    <SectionCard>
                                        <div className="flex flex-col sm:flex-row items-center gap-8">
                                            <img
                                                src="/PW QR CODE.png"
                                                alt="PetWise Mobile App QR Code"
                                                className="w-52 h-52 rounded-2xl border border-gray-200 shadow-sm"
                                            />
                                            <div className="text-center sm:text-left">
                                                <h3 className="text-base font-bold text-gray-900 mb-2">PetWise on your phone</h3>
                                                <p className="text-[13px] text-gray-500 leading-relaxed mb-4 max-w-sm">
                                                    Scan the QR code with your phone's camera, or go to{' '}
                                                    <span className="font-semibold text-[#3468bd]">petwise.vet</span>{' '}
                                                    on your phone and log in. Dictate in the exam room and your notes
                                                    appear here on desktop.
                                                </p>
                                                {canRedeemStudentAccess() && !isStudentMode() && (
                                                    <button
                                                        onClick={() => setShowStudentRedeem(true)}
                                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 font-semibold rounded-xl text-sm hover:bg-purple-100 transition-all border border-purple-100"
                                                    >
                                                        <FaGraduationCap />
                                                        Student Access
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </SectionCard>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
