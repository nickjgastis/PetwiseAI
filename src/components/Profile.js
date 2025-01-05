import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate, useLocation } from 'react-router-dom'; // Import useNavigate and useLocation
import "../styles/Profile.css";
import Checkout from './Checkout';
import { supabase } from '../supabaseClient';
import { useSubscription } from '../hooks/useSubscription';
import ManageAccount from './ManageAccount';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const PricingOptions = ({ onSubscribe, hasUsedTrial }) => {
    return (
        <div className="pricing-container">
            {!hasUsedTrial && (
                <div className="pricing-card free">
                    <div className="pricing-header">
                        <h3>14 Day Free Trial</h3>
                        <p className="price">$0<span>/mo</span></p>
                    </div>
                    <ul className="pricing-features">
                        <li>No credit card required</li>
                        <li>10 reports per day</li>
                        <li>Quick Query</li>
                    </ul>
                    <div className="pricing-footer">
                        <button onClick={onSubscribe} className="trial-button">
                            Start Free Trial
                        </button>
                    </div>
                </div>
            )}

            <div className="pricing-card">
                <div className="pricing-header">
                    <h3>Monthly</h3>
                    <p className="price">$129<span>/Vet/Month</span></p>
                </div>
                <ul className="pricing-features">
                    <li>Unlimited SOAP reports</li>
                    <li>Unlimited Quick Query</li>
                    <li>Saved reports</li>
                    <li>Priority support</li>

                </ul>
                <div className="pricing-footer">
                    <button
                        onClick={() => onSubscribe('monthly')}
                        className="subscribe-button"
                    >
                        Sign Up Now
                    </button>
                </div>
            </div>

            <div className="pricing-card">
                <div className="pricing-header">
                    <h3>Yearly</h3>
                    <p className="price">$89<span>/Vet/Month</span></p>
                    <p className="savings">Save 31%</p>
                </div>
                <ul className="pricing-features">
                    <li>Unlimited SOAP reports</li>
                    <li>Unlimited Quick Query</li>
                    <li>Saved reports</li>
                    <li>Priority support</li>

                </ul>
                <div className="pricing-footer">
                    <button
                        onClick={() => onSubscribe('yearly')}
                        className="subscribe-button"
                    >
                        Sign Up Now
                    </button>
                </div>
            </div>
        </div>
    );
};

const Profile = () => {
    const { user, isAuthenticated, isLoading: auth0Loading } = useAuth0();
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

    useEffect(() => {
        if (user) {
            console.log('Auth0 user full object:', JSON.stringify(user, null, 2));
            console.log('Auth0 picture URL:', user.picture);
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
                        cancel_at_period_end
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
            console.log('Full user object:', user);
            console.log('Picture URL:', user?.picture);
        }
    }, [user]);

    // Show loading state only when auth0 is loading or subscription is loading
    if (auth0Loading || (isAuthenticated && isSubscriptionLoading)) {
        return <div className="profile-loading">Loading ...</div>;
    }

    const handleBillingClick = () => {
        setShowCheckout(true);
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
            <div className="profile-container">
                {showCheckout ? (
                    <Checkout
                        user={{
                            ...user,
                            ...userData,
                            cancel_at_period_end: cancelAtPeriodEnd
                        }}
                        onBack={() => setShowCheckout(false)}
                        subscriptionStatus={subscriptionStatus}
                    />
                ) : showManageAccount ? (
                    <ManageAccount
                        user={user}
                        onBack={() => setShowManageAccount(false)}
                    />
                ) : (
                    <>
                        {!isSubscriptionLoading && (!subscriptionStatus || subscriptionStatus === 'inactive') && (
                            <div className="pricing-section">
                                <h3>Choose Your Plan</h3>
                                <p className="pricing-subtext">
                                    Experience the full power of PetwiseAI! Start with a free trial - no credit card required.
                                </p>
                                <PricingOptions
                                    onSubscribe={handleBillingClick}
                                    hasUsedTrial={userData?.has_used_trial}
                                />
                            </div>
                        )}

                        <div className="profile-header">
                            <div className="profile-picture-container">
                                <img
                                    src={getOptimizedImageUrl(user?.picture)}
                                    alt={user?.name || 'User'}
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
                            <h2>{user.name}</h2>
                            <p className="profile-email">{user.email}</p>
                        </div>
                        <div className="profile-details">
                            <h3>Profile Information</h3>
                            <div className="profile-info">
                                <div className="info-item">
                                    <span className="info-label">Nickname:</span>
                                    <span className="info-value">{user.nickname || 'Not set'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Email Verified:</span>
                                    <span className="info-value">{user.email_verified ? 'Yes' : 'No'}</span>
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
                        <div className="profile-actions">
                            <button className="profile-button" onClick={handleBillingClick}>
                                Manage Subscription
                            </button>
                            <button className="profile-button" onClick={() => setShowManageAccount(true)}>
                                Manage Account
                            </button>
                        </div>
                    </>
                )}
            </div>
        )
    );
};

export default Profile;
