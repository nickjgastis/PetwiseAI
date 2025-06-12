import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate, useLocation } from 'react-router-dom'; // Import useNavigate and useLocation
import "../styles/Profile.css";
import Checkout from './Checkout';
import { supabase } from '../supabaseClient';
import { useSubscription } from '../hooks/useSubscription';
import ManageAccount from './ManageAccount';
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
                        grace_period_end
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
        return <div className="profile-loading">Loading ...</div>;
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
                <span className="subscription-plan">{planInterval}</span>
            </>
        );
    };

    const getSubscriptionStatus = () => {
        if (isSubscriptionLoading) {
            return <span>Loading...</span>;
        }

        if (subscriptionStatus !== 'active') {
            return <span className="status-inactive">Inactive - Subscribe to access all features</span>;
        }

        return (
            <>
                <span className="status-active">Active</span>
                {subscriptionEndDate && (
                    <span className="subscription-end">
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
            <div className={`profile-container ${isMobileSignup ? 'mobile-signup-mode' : ''}`}>
                {isMobileSignup && (
                    <>
                        <div className="mobile-desktop-reminder">
                            <h3>📱 ➡️ 💻</h3>
                            <p>For full access to all PetWise features, please switch to your desktop computer.</p>
                        </div>
                        {!isSubscribed && (
                            <div className="mobile-signup-header">
                                <h2>Complete Your Subscription</h2>
                                <p>Choose a plan to get started with PetWise</p>
                            </div>
                        )}
                    </>
                )}

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
                ) : (
                    <>
                        {!isSubscriptionLoading &&
                            (!subscriptionStatus || subscriptionStatus === 'inactive' || subscriptionStatus === 'canceled') && (
                                <div className="pricing-section">
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
                            )}

                        {!isMobileSignup && (
                            <>
                                {/* Past Due Warning Banner */}
                                {subscriptionStatus === 'past_due' && (
                                    <div className="past-due-banner">
                                        <div className="past-due-content">
                                            <div className="past-due-icon">⚠️</div>
                                            <div className="past-due-text">
                                                <h3>Subscription Past Due</h3>
                                                <p>
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
                                                <button className="past-due-action-button" onClick={handleBillingPortal}>
                                                    Go to Billing Management
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="profile-header">
                                    <div className="profile-picture-container">
                                        <img
                                            src={getOptimizedImageUrl(user?.picture)}
                                            alt={userData?.dvm_name || user?.name || 'User'}
                                            className="profile-picture"
                                            crossOrigin="anonymous"
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                                console.log('Profile image error, falling back to SVG');
                                                e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ccc' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
                                            }}
                                            style={{
                                                width: '100px',
                                                height: '100px',
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                                border: '2px solid #eee',
                                                backgroundColor: '#f5f5f5'
                                            }}
                                        />
                                    </div>
                                    <h2>{userData?.dvm_name ? `Dr. ${userData.dvm_name}` : user.name}</h2>
                                    <p className="profile-email">{user.email}</p>
                                </div>
                                <div className="profile-actions">
                                    <button className="profile-button" onClick={handleBillingClick}>
                                        Manage Subscription
                                    </button>
                                    {userData?.stripe_customer_id && (
                                        <button className="profile-button" onClick={handleBillingPortal}>
                                            Billing Management
                                        </button>
                                    )}
                                    <button className="profile-button" onClick={() => setShowManageAccount(true)}>
                                        Manage Account
                                    </button>
                                </div>
                                <div className="profile-details">
                                    <h3>Profile Information</h3>
                                    <div className="profile-info">
                                        <div className="info-item">
                                            <span className="info-label">DVM Name:</span>
                                            <span className="info-value">
                                                {userData?.dvm_name ? `Dr. ${userData.dvm_name}` : 'Not set'}
                                            </span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Nickname:</span>
                                            <span className="info-value">{user.nickname || 'Not set'}</span>
                                        </div>

                                        <div className="info-item">
                                            <span className="info-label">Last Updated:</span>
                                            <span className="info-value">{new Date(user.updated_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Subscription Status:</span>
                                            <span className="info-value">
                                                {getSubscriptionStatus()}
                                            </span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Subscription Type:</span>
                                            <span className="info-value">
                                                {getSubscriptionDisplay()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Add mobile subscription management for subscribed users */}
                        {isMobileSignup && isSubscribed && (
                            <>
                                {/* Mobile Past Due Warning Banner */}
                                {subscriptionStatus === 'past_due' && (
                                    <div className="mobile-past-due-banner">
                                        <div className="mobile-past-due-content">
                                            <div className="mobile-past-due-icon">⚠️</div>
                                            <div className="mobile-past-due-text">
                                                <h3>Payment Past Due</h3>
                                                <p>
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
                                                <button className="mobile-past-due-button" onClick={handleBillingPortal}>
                                                    Fix Payment Issue
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="mobile-subscription-management">
                                    <h3>Your Subscription</h3>
                                    <div className="subscription-info">
                                        <p><strong>Status:</strong> {getSubscriptionStatus()}</p>
                                        <p><strong>Plan:</strong> {getSubscriptionDisplay()}</p>
                                    </div>
                                    <div className="mobile-subscription-actions">
                                        <button className="profile-button" onClick={handleBillingClick}>
                                            Manage Subscription
                                        </button>
                                        {userData?.stripe_customer_id && (
                                            <button className="profile-button" onClick={handleBillingPortal}>
                                                Billing Management
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Add mobile account management for all mobile users */}
                        {isMobileSignup && (
                            <div className="mobile-account-management">
                                <h3>Account Management</h3>
                                <p>View and manage your account settings, or delete your account.</p>
                                <div className="mobile-account-actions">
                                    <button className="profile-button" onClick={() => setShowManageAccount(true)}>
                                        Manage Account
                                    </button>
                                    <button
                                        className="profile-button logout-button"
                                        onClick={() => logout({ returnTo: window.location.origin })}
                                    >
                                        Log Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        )
    );
};

export default Profile;
