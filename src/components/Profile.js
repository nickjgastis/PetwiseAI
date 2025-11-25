import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate, useLocation } from 'react-router-dom'; // Import useNavigate and useLocation
import Checkout from './Checkout';
import { supabase } from '../supabaseClient';
import { useSubscription } from '../hooks/useSubscription';
import ManageAccount from './ManageAccount';
import StudentRedeem from './StudentRedeem';
import { loadStripe } from '@stripe/stripe-js';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const stripePromise = loadStripe(
    process.env.NODE_ENV === 'production'
        ? process.env.REACT_APP_STRIPE_PUBLIC_KEY_LIVE
        : process.env.REACT_APP_STRIPE_PUBLIC_KEY
);

const Profile = ({ isMobileSignup = false }) => {
    const { user, isAuthenticated, isLoading: auth0Loading, logout } = useAuth0();
    const navigate = useNavigate();
    const location = useLocation();
    const [subscriptionStatus, setSubscriptionStatus] = useState(null);
    const [subscriptionEndDate, setSubscriptionEndDate] = useState(null);
    const [showCheckout, setShowCheckout] = useState(false);
    const { timeLeft, isSubscribed, cancelAtPeriodEnd } = useSubscription();
    const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const [showManageAccount, setShowManageAccount] = useState(false);
    const [showStudentRedeem, setShowStudentRedeem] = useState(false);

    const getOptimizedImageUrl = (url) => {
        if (!url) return null;

        // For Google profile pictures
        if (url.includes('googleusercontent.com')) {
            // Remove size parameter and add a new one
            const baseUrl = url.split('=')[0];
            return `${baseUrl}=s200-c`;
        }

        // For Gravatar URLs
        if (url.includes('gravatar.com')) {
            const hash = url.split('/').pop().split('?')[0];
            return `https://secure.gravatar.com/avatar/${hash}?s=200&d=mp`;
        }

        // For Auth0 default avatars
        if (url.includes('cdn.auth0.com')) {
            return url.split('?')[0]; // Remove any query parameters
        }

        return url;
    };

    const getGracePeriodDays = () => {
        if (userData?.grace_period_end && subscriptionStatus === 'past_due') {
            const daysLeft = Math.ceil((new Date(userData.grace_period_end) - new Date()) / (1000 * 60 * 60 * 24));
            return daysLeft > 0 ? daysLeft : 0;
        }
        return null;
    };

    // Helper function to check if user is in student mode
    const isStudentMode = () => {
        return userData?.plan_label === 'student' &&
            userData?.subscription_end_date &&
            new Date(userData.subscription_end_date) > new Date();
    };

    // Helper function to check if user can redeem student access
    const canRedeemStudentAccess = () => {
        // If user has a graduation year set, check if it has passed
        if (userData?.student_grad_year) {
            const gradYear = userData.student_grad_year;
            const cutoffDate = new Date(Date.UTC(gradYear, 7, 31, 23, 59, 59, 999)); // Aug 31
            return new Date() < cutoffDate;
        }

        // If no graduation year set, can redeem
        return true;
    };

    const handleStudentRedeemSuccess = () => {
        setShowStudentRedeem(false);
        // Refresh user data to show updated subscription
        window.location.reload();
    };

    useEffect(() => {
        if (user) {
            // console.log('Auth0 user full object:', JSON.stringify(user, null, 2));
            // console.log('Auth0 picture URL:', user.picture);
        }
    }, [user]);

    useEffect(() => {
        const checkSubscription = async () => {
            if (!user?.sub) return;

            setIsSubscriptionLoading(true);
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select(`
                        subscription_status,
                        subscription_end_date,
                        stripe_customer_id,
                        has_used_trial,
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
        };

        if (isAuthenticated && user) {
            checkSubscription();
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        if (location.state?.openCheckout) {
            setShowCheckout(true);
            navigate(location.pathname, { replace: true });
        }
    }, [location, navigate]);

    useEffect(() => {
        if (user) {
            // console.log('Full user object:', user);
            // console.log('Picture URL:', user?.picture);
        }
    }, [user]);

    // Show loading state only when auth0 is loading or subscription is loading
    if (auth0Loading || (isAuthenticated && isSubscriptionLoading)) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-xl text-gray-600 font-medium">Loading ...</div>
            </div>
        );
    }

    const handleBillingClick = () => {
        setShowCheckout(true);
    };

    const handleBillingPortal = async () => {
        try {
            const response = await fetch(`${API_URL}/create-customer-portal`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: user.sub
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to access billing portal');
            }

            // Redirect to Stripe Customer Portal
            window.location.href = data.url;
        } catch (error) {
            console.error('Billing portal error:', error);
            alert(`Unable to access billing portal: ${error.message}`);
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getSubscriptionDisplay = () => {
        if (isSubscriptionLoading) {
            return <span>Loading...</span>;
        }

        if (isStudentMode()) {
            return <span className="text-purple-600 font-medium">🎓 Student Access</span>;
        }

        if (subscriptionStatus !== 'active') {
            return <span>None</span>;
        }

        const planType = userData?.subscription_interval === 'trial' ? 'Trial' : 'Full Access';
        const planInterval = userData?.subscription_interval
            ? ` (${userData.subscription_interval.charAt(0).toUpperCase() + userData.subscription_interval.slice(1)})`
            : '';

        return (
            <>
                {planType}
                <span className="text-primary-600 text-sm ml-1 font-medium">{planInterval}</span>
            </>
        );
    };

    const getSubscriptionStatus = () => {
        if (isSubscriptionLoading) {
            return <span>Loading...</span>;
        }

        if (subscriptionStatus !== 'active') {
            return <span className="text-red-600 font-medium">Inactive - Subscribe to access all features</span>;
        }

        return (
            <>
                <span className="text-green-600 font-medium">Active</span>
                {subscriptionEndDate && (
                    <span className="text-gray-500 text-sm ml-2">
                        {' '}(Expires: {formatDate(subscriptionEndDate)}
                        {userData?.subscription_interval !== 'trial' && userData?.stripe_customer_id ? (
                            userData.cancel_at_period_end ?
                                ' - Will not renew' :
                                ' - Will renew automatically'
                        ) : null}
                        )
                    </span>
                )}
            </>
        );
    };

    return (
        isAuthenticated && (
            <div className={`min-h-screen ${isMobileSignup ? 'bg-gray-50' : 'bg-white'}`}>
                <div className={`${isMobileSignup ? 'w-full' : 'max-w-6xl mx-auto px-6 py-6'}`}>
                    {/* Removed mobile banner and subscription header for cleaner mobile experience */}

                    {showCheckout ? (
                        <Checkout
                            user={{
                                ...user,
                                ...userData,
                                cancel_at_period_end: cancelAtPeriodEnd
                            }}
                            onBack={() => setShowCheckout(false)}
                            subscriptionStatus={subscriptionStatus}
                            isMobileSignup={isMobileSignup}
                        />
                    ) : showManageAccount ? (
                        <ManageAccount
                            user={user}
                            onBack={() => setShowManageAccount(false)}
                        />
                    ) : showStudentRedeem ? (
                        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                            <StudentRedeem
                                onSuccess={handleStudentRedeemSuccess}
                                onCancel={() => setShowStudentRedeem(false)}
                                userData={userData}
                            />
                        </div>
                    ) : (
                        <>
                            {!isSubscriptionLoading &&
                                !isStudentMode() &&
                                (!subscriptionStatus || subscriptionStatus === 'inactive' || subscriptionStatus === 'canceled') && (
                                    <div className="py-12 bg-white">
                                        <div className="max-w-4xl mx-auto px-6">
                                            <div className="text-center mb-8">
                                                <h2 className="text-3xl font-bold text-primary-400 mb-3">Get Started with PetWise</h2>
                                                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                                                    {isMobileSignup
                                                        ? "Start with a free trial. No credit card required."
                                                        : "Choose the perfect plan for your veterinary practice. Start with a free trial or select a subscription that fits your needs."
                                                    }
                                                </p>
                                            </div>
                                            <Checkout
                                                user={{
                                                    ...user,
                                                    ...userData,
                                                    cancel_at_period_end: cancelAtPeriodEnd
                                                }}
                                                subscriptionStatus={subscriptionStatus}
                                                onBack={null}
                                                embedded={true}
                                                isMobileSignup={isMobileSignup}
                                            />
                                        </div>
                                    </div>
                                )}

                            {!isMobileSignup && (
                                <>
                                    {/* Past Due Warning Banner */}
                                    {subscriptionStatus === 'past_due' && (
                                        <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 rounded-2xl p-5 mb-6 shadow-lg">
                                            <div className="flex items-center gap-4">
                                                <div className="text-3xl flex-shrink-0">⚠️</div>
                                                <div className="flex-1">
                                                    <h3 className="text-red-800 text-lg font-bold mb-2">Subscription Past Due</h3>
                                                    <p className="text-red-700 font-medium leading-relaxed">
                                                        Your subscription payment is past due.
                                                        {getGracePeriodDays() !== null && getGracePeriodDays() > 0 && (
                                                            ` Your subscription will be canceled in ${getGracePeriodDays()} ${getGracePeriodDays() === 1 ? 'day' : 'days'} unless payment is resolved.`
                                                        )}
                                                        {getGracePeriodDays() === 0 && (
                                                            ` Your grace period has expired. Please update your payment method immediately.`
                                                        )}
                                                        {getGracePeriodDays() === null && (
                                                            ` To continue with the service, please update your payment method or pay your outstanding invoice using Billing Management.`
                                                        )}
                                                    </p>
                                                </div>
                                                {userData?.stripe_customer_id && (
                                                    <button
                                                        className="bg-gradient-to-r from-red-600 to-red-700 text-white px-5 py-3 rounded-xl font-semibold hover:from-red-700 hover:to-red-800 transition-all duration-200 hover:-translate-y-0.5 shadow-lg whitespace-nowrap"
                                                        onClick={handleBillingPortal}
                                                    >
                                                        Go to Billing Management
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="text-center mb-6">
                                        <div className="inline-block mb-4">
                                            <img
                                                src={getOptimizedImageUrl(user?.picture)}
                                                alt={userData?.dvm_name || user?.name || 'User'}
                                                className="w-20 h-20 rounded-full object-cover border-3 border-primary-100 shadow-lg hover:scale-105 transition-all duration-300 bg-gray-100"
                                                crossOrigin="anonymous"
                                                referrerPolicy="no-referrer"
                                                onError={(e) => {
                                                    console.log('Profile image error, falling back to SVG');
                                                    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ccc' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
                                                }}
                                            />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-800 mb-1">{userData?.dvm_name ? `Dr. ${userData.dvm_name}` : user.name}</h2>
                                        <p className="text-gray-600 font-medium">{user.email}</p>
                                    </div>
                                    <div className="flex justify-center gap-4 mb-6">
                                        {!isStudentMode() && (
                                            <button
                                                className="px-7 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all duration-200 hover:-translate-y-0.5 shadow-lg"
                                                onClick={handleBillingClick}
                                            >
                                                Manage Subscription
                                            </button>
                                        )}
                                        {isStudentMode() && (
                                            <button
                                                className="px-7 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all duration-200 hover:-translate-y-0.5 shadow-lg"
                                                onClick={handleBillingClick}
                                            >
                                                Upgrade to Paid Plan
                                            </button>
                                        )}
                                        {userData?.stripe_customer_id && (
                                            <button
                                                className="px-7 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all duration-200 hover:-translate-y-0.5 shadow-lg"
                                                onClick={handleBillingPortal}
                                            >
                                                Billing Management
                                            </button>
                                        )}
                                        {canRedeemStudentAccess() && (
                                            <button
                                                className="px-7 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-purple-800 transition-all duration-200 hover:-translate-y-0.5 shadow-lg"
                                                onClick={() => setShowStudentRedeem(true)}
                                            >
                                                🎓 Student Access
                                            </button>
                                        )}
                                        <button
                                            className="px-7 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all duration-200 hover:-translate-y-0.5 shadow-lg"
                                            onClick={() => setShowManageAccount(true)}
                                        >
                                            Manage Account
                                        </button>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 mb-6 shadow-sm">
                                        <h3 className="text-primary-600 text-xl font-semibold border-b-2 border-primary-100 pb-2 mb-4">Profile Information</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                                                <span className="font-semibold text-gray-700">DVM Name:</span>
                                                <span className="text-gray-800 font-medium">
                                                    {isStudentMode() ? 'Student Mode' : (userData?.dvm_name ? `Dr. ${userData.dvm_name}` : 'Not set')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                                                <span className="font-semibold text-gray-700">Nickname:</span>
                                                <span className="text-gray-800 font-medium">{user.nickname || 'Not set'}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                                                <span className="font-semibold text-gray-700">Last Updated:</span>
                                                <span className="text-gray-800 font-medium">{new Date(user.updated_at).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                                                <span className="font-semibold text-gray-700">Subscription Status:</span>
                                                <span className="text-gray-800 font-medium">
                                                    {getSubscriptionStatus()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                                                <span className="font-semibold text-gray-700">Subscription Type:</span>
                                                <span className="text-gray-800 font-medium">
                                                    {getSubscriptionDisplay()}
                                                </span>
                                            </div>
                                            {isStudentMode() && (
                                                <>
                                                    <div className="flex justify-between items-center p-4 bg-purple-50 rounded-xl border border-purple-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                                                        <span className="font-semibold text-purple-700">Student Email:</span>
                                                        <span className="text-purple-800 font-medium">
                                                            {userData?.student_school_email || 'Not provided'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center p-4 bg-purple-50 rounded-xl border border-purple-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                                                        <span className="font-semibold text-purple-700">Graduation Year:</span>
                                                        <span className="text-purple-800 font-medium">
                                                            {userData?.student_grad_year || 'Not set'}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Add mobile subscription management for subscribed users */}
                            {isMobileSignup && isSubscribed && (
                                <>
                                    {/* Mobile Past Due Warning Banner */}
                                    {subscriptionStatus === 'past_due' && (
                                        <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 p-4 w-full">
                                            <div className="flex flex-col items-center gap-3 text-center">
                                                <div className="text-2xl">⚠️</div>
                                                <div>
                                                    <h3 className="text-red-800 text-lg font-bold mb-1">Payment Past Due</h3>
                                                    <p className="text-red-700 font-medium text-sm leading-relaxed">
                                                        Your payment is past due.
                                                        {getGracePeriodDays() !== null && getGracePeriodDays() > 0 && (
                                                            ` Service will be canceled in ${getGracePeriodDays()} ${getGracePeriodDays() === 1 ? 'day' : 'days'} unless resolved.`
                                                        )}
                                                        {getGracePeriodDays() === 0 && (
                                                            ` Grace period expired. Update payment immediately.`
                                                        )}
                                                        {getGracePeriodDays() === null && (
                                                            ` Please update your payment method to continue service.`
                                                        )}
                                                    </p>
                                                </div>
                                                {userData?.stripe_customer_id && (
                                                    <button
                                                        className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all duration-200 hover:-translate-y-0.5 shadow-lg w-full max-w-xs min-h-[44px]"
                                                        onClick={handleBillingPortal}
                                                    >
                                                        Fix Payment Issue
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white p-4 border-t border-b border-gray-200 mb-5">
                                        <h3 className="text-gray-800 text-lg font-semibold mb-3 text-center">Your Subscription</h3>
                                        <div className="bg-primary-50 p-3 rounded-lg border-l-4 border-primary-600 mb-4">
                                            <p className="text-sm text-gray-700 font-medium mb-1"><strong>Status:</strong> {getSubscriptionStatus()}</p>
                                            <p className="text-sm text-gray-700 font-medium"><strong>Plan:</strong> {getSubscriptionDisplay()}</p>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button
                                                className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-3 rounded-lg font-semibold hover:from-primary-700 hover:to-primary-800 transition-all duration-200 hover:-translate-y-0.5 shadow-lg w-full min-h-[44px]"
                                                onClick={handleBillingClick}
                                            >
                                                Manage Subscription
                                            </button>
                                            {userData?.stripe_customer_id && (
                                                <button
                                                    className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-3 rounded-lg font-semibold hover:from-primary-700 hover:to-primary-800 transition-all duration-200 hover:-translate-y-0.5 shadow-lg w-full min-h-[44px]"
                                                    onClick={handleBillingPortal}
                                                >
                                                    Billing Management
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Add mobile account management for all mobile users */}
                            {isMobileSignup && (
                                <div className="bg-white p-4 border-t border-b border-gray-200 mb-5">
                                    <h3 className="text-gray-800 text-lg font-semibold mb-3 text-center">Account Management</h3>
                                    <p className="text-gray-600 text-sm text-center mb-4">View and manage your account settings, or delete your account.</p>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-3 rounded-lg font-semibold hover:from-primary-700 hover:to-primary-800 transition-all duration-200 hover:-translate-y-0.5 shadow-lg w-full min-h-[44px]"
                                            onClick={() => setShowManageAccount(true)}
                                        >
                                            Manage Account
                                        </button>
                                        <button
                                            className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all duration-200 hover:-translate-y-0.5 shadow-lg w-full min-h-[44px]"
                                            onClick={() => logout({
                                                logoutParams: {
                                                    returnTo: 'https://petwise.vet'
                                                }
                                            })}
                                        >
                                            Log Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        )
    );
};

export default Profile;
