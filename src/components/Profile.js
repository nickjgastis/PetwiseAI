import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from 'react-router-dom'; // Import useNavigate
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
                    <h3>Single User</h3>
                    <div className="price-options">
                        <p className="price">$79.99<span>/mo</span></p>
                        <span className="price-divider">|</span>
                        <p className="price yearly">
                            $859.99<span>/yr</span>
                        </p>
                    </div>
                </div>
                <ul className="pricing-features">
                    <li>25 reports per day</li>
                    <li>Saved reports</li>
                    <li>Quick Query</li>
                    <li>For 1 user</li>
                </ul>
                <div className="pricing-footer">
                    <button
                        onClick={() => onSubscribe('monthly')}
                        className="subscribe-button"
                    >
                        Monthly Plan
                    </button>
                    <button
                        onClick={() => onSubscribe('yearly')}
                        className="subscribe-button yearly"
                    >
                        Yearly Plan
                    </button>
                </div>
            </div>

            <div className="pricing-card">
                <div className="pricing-header">
                    <h3>Multi User</h3>
                    <div className="price-options">
                        <p className="price">$199.99<span>/mo</span></p>
                        <span className="price-divider">|</span>
                        <p className="price yearly">
                            $2159.99<span>/yr</span>
                        </p>
                    </div>
                </div>
                <ul className="pricing-features">
                    <li>120 reports per day</li>
                    <li>Saved reports</li>
                    <li>Quick Query</li>
                    <li>For 2-5 users</li>
                </ul>
                <div className="pricing-footer">
                    <button
                        onClick={() => onSubscribe('multiUserMonthly')}
                        className="subscribe-button"
                    >
                        Monthly Plan
                    </button>
                    <button
                        onClick={() => onSubscribe('multiUserYearly')}
                        className="subscribe-button yearly"
                    >
                        Yearly Plan
                    </button>
                </div>
            </div>

            <div className="pricing-card">
                <div className="pricing-header">
                    <h3>Clinic Subscription</h3>
                    <div className="price-options">
                        <p className="price">$499.99<span>/mo</span></p>
                        <span className="price-divider">|</span>
                        <p className="price yearly">
                            $5399.99<span>/yr</span>
                        </p>
                    </div>
                </div>
                <ul className="pricing-features">
                    <li>400 reports per day</li>
                    <li>Saved reports</li>
                    <li>Quick Query</li>
                    <li>For full clinics</li>
                </ul>
                <div className="pricing-footer">
                    <button
                        onClick={() => onSubscribe('clinicMonthly')}
                        className="subscribe-button"
                    >
                        Monthly Plan
                    </button>
                    <button
                        onClick={() => onSubscribe('clinicYearly')}
                        className="subscribe-button yearly"
                    >
                        Yearly Plan
                    </button>
                </div>
            </div>
        </div>
    );
};

const Profile = () => {
    const { user, isAuthenticated, isLoading: auth0Loading } = useAuth0();
    const navigate = useNavigate();
    const [subscriptionStatus, setSubscriptionStatus] = useState(null);
    const [subscriptionEndDate, setSubscriptionEndDate] = useState(null);
    const [showCheckout, setShowCheckout] = useState(false);
    const { timeLeft, isSubscribed, cancelAtPeriodEnd } = useSubscription();
    const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const [showManageAccount, setShowManageAccount] = useState(false);

    useEffect(() => {
        const checkSubscription = async () => {
            if (!user?.sub) return;

            setIsSubscriptionLoading(true);
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('subscription_status, subscription_end_date, stripe_customer_id, has_used_trial, subscription_type, subscription_interval')
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
        const location = window.location;
        if (location.state?.openCheckout) {
            setShowCheckout(true);
            // Clean up the state
            window.history.replaceState({}, document.title)
        }
    }, []);

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
                        {!isSubscriptionLoading && subscriptionStatus !== 'active' && (
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
                            <img src={user.picture} alt={user.name} className="profile-picture" />
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
                                        {isSubscriptionLoading ? (
                                            <span>Loading...</span>
                                        ) : subscriptionStatus === 'active' ? (
                                            <>
                                                <span className="status-active">Active</span>
                                                {subscriptionEndDate && (
                                                    <span className="subscription-end">
                                                        {' '}(Expires: {formatDate(subscriptionEndDate)}
                                                        {userData?.stripe_customer_id ? (
                                                            cancelAtPeriodEnd ?
                                                                ' - Will not renew' :
                                                                ' - Will renew automatically'
                                                        ) : null}
                                                        )
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <span className="status-inactive">Inactive - Subscribe to access all features</span>
                                        )}
                                    </span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Subscription Type:</span>
                                    <span className="info-value">
                                        {isSubscriptionLoading ? (
                                            <span>Loading...</span>
                                        ) : subscriptionStatus === 'active' ? (
                                            <>
                                                {userData?.subscription_type === 'singleUser' && 'Single User'}
                                                {userData?.subscription_type === 'multiUser' && 'Multi User'}
                                                {userData?.subscription_type === 'clinic' && 'Clinic'}
                                                {userData?.subscription_type === 'trial' && 'Trial'}
                                                <span className="subscription-plan">
                                                    {userData?.subscription_interval && (
                                                        userData?.subscription_interval === 'trial'
                                                            ? ' (Trial)'
                                                            : ` (${userData.subscription_interval.charAt(0).toUpperCase() + userData.subscription_interval.slice(1)} Plan)`
                                                    )}
                                                </span>
                                            </>
                                        ) : (
                                            <span>None</span>
                                        )}
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
