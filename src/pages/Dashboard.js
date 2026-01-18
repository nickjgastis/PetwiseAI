// ================ IMPORTS ================
import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuth0 } from "@auth0/auth0-react";
import axios from 'axios';
import ReportForm from '../components/ReportForm';
import SavedReports from '../components/SavedReports';
import Profile from '../components/Profile';
import TermsOfService from '../components/TermsOfService';
import QuickQuery from '../components/QuickQuery';
import QuickSOAP from '../pages/QuickSOAP';
import Help from '../components/Help';
import Welcome from '../components/Welcome';
import Templates from '../components/Templates';
import PlanSelection from '../components/PlanSelection';
import WelcomeToPetwise from '../components/WelcomeToPetwise';
// Tailwind classes will be used instead of CSS file
import { supabase } from '../supabaseClient';
import { FaFileAlt, FaSearch, FaSave, FaUser, FaSignOutAlt, FaQuestionCircle, FaClipboard, FaMicrophone, FaCircle, FaTimes, FaMobile } from 'react-icons/fa';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

// Add slideDown animation style
const slideDownStyle = `
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    @keyframes fadeUp {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    @keyframes fadeDown {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(-10px);
        }
    }
`;

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
    const [hasPendingDictation, setHasPendingDictation] = useState(false);
    const [hasNewMobileSOAP, setHasNewMobileSOAP] = useState(false);
    const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true); // Default true for existing users
    const [showWelcomePage, setShowWelcomePage] = useState(false); // Show welcome after plan selection
    const [mobileSOAPCount, setMobileSOAPCount] = useState(0);
    const [showMobileSOAPNotification, setShowMobileSOAPNotification] = useState(false);
    const [mobileReportsGenerating, setMobileReportsGenerating] = useState(0);
    const isProcessingQueueRef = useRef(false);
    const processingDraftIdsRef = useRef(new Set()); // Track which drafts are currently being processed

    const { logout, user, isAuthenticated } = useAuth0();
    const navigate = useNavigate();
    const location = useLocation();

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

        // Check for trial - trial has subscription_status='active' and subscription_interval='trial'
        const hasTrial = userData?.subscription_status === 'active' &&
            userData?.subscription_interval === 'trial';

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

    // ================ FETCH NEW MOBILE DICTATIONS (Background polling with queue) ================
    // This runs continuously even when QuickSOAP tab is not active, so sidebar can show alerts
    useEffect(() => {
        if (isMobile || !isAuthenticated || !user) {
            // Reset count when logged out
            setMobileReportsGenerating(0);
            return;
        }

        const processMobileDictation = async (draft) => {
            const draftId = draft.id;

            // Prevent concurrent processing of the same draft
            if (processingDraftIdsRef.current.has(draftId)) {
                console.log('Draft already being processed:', draftId);
                return false;
            }

            // Mark as processing
            processingDraftIdsRef.current.add(draftId);

            try {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth0_user_id', user.sub)
                    .single();

                if (userError || !userData) {
                    return false;
                }

                const userId = userData.id;

                // Check if the draft still exists and is still a draft (has no report_text)
                const { data: draftCheck } = await supabase
                    .from('saved_reports')
                    .select('id, report_text')
                    .eq('id', draftId)
                    .eq('user_id', userId)
                    .maybeSingle();

                if (!draftCheck) {
                    // Draft doesn't exist anymore - already processed or deleted
                    return false;
                }

                // If draft already has a report_text, it was already processed
                if (draftCheck.report_text) {
                    return true; // Already processed, consider success
                }

                // Auto-generate SOAP report from mobile dictation
                const formData = draft.form_data;
                const dictations = formData.dictations || [];
                const input = formData.input || '';

                // Combine all dictations and manual input
                const allDictations = dictations.map(d => d.fullText || d.summary || '').join('\n\n');
                const combinedInput = allDictations + (input.trim() ? '\n\n' + input.trim() : '');

                if (!combinedInput.trim()) {
                    console.error('No dictation content to generate SOAP from');
                    // Delete draft if no content
                    await supabase
                        .from('saved_reports')
                        .delete()
                        .eq('id', draftId);
                    return false;
                }

                // Generate SOAP report
                const response = await axios.post(`${API_URL}/api/generate-soap`, {
                    input: combinedInput.trim()
                });

                if (!response.data || !response.data.report) {
                    console.error('No report generated from API response:', response.data);
                    return false;
                }

                const generatedReport = response.data.report;
                const extractedPetName = response.data.petName;

                const dateStr = new Date().toLocaleString();
                // Handle empty strings, null, undefined - only use pet name if it's a valid non-empty string
                const reportName = (extractedPetName && extractedPetName.trim && extractedPetName.trim())
                    ? `${extractedPetName.trim()} - ${dateStr}`
                    : `QuickSOAP Mobile - ${dateStr}`;

                // Double-check the draft still exists and hasn't been processed by another instance
                const { data: finalDraftCheck } = await supabase
                    .from('saved_reports')
                    .select('id, report_text, form_data')
                    .eq('id', draftId)
                    .eq('user_id', userId)
                    .maybeSingle();

                if (!finalDraftCheck) {
                    // Draft was deleted (likely by user on mobile) - this is okay, just skip it
                    console.log('Draft was deleted before processing completed (likely deleted by user):', draftId);
                    return true; // Consider success - user may have deleted it intentionally
                }

                if (finalDraftCheck.report_text) {
                    console.log('Draft was already processed by another instance:', draftId);
                    return true; // Already processed, consider success
                }

                // Update the draft to a report instead of inserting new (prevents duplicates)
                const { data: savedReport, error: saveError } = await supabase
                    .from('saved_reports')
                    .update({
                        report_name: reportName,
                        report_text: generatedReport,
                        form_data: {
                            ...formData,
                            reportName: reportName, // Ensure reportName in form_data matches report_name
                            petName: extractedPetName || formData.petName || null, // Store pet name in form_data
                            from_mobile: true,
                            auto_generated: true,
                            generated_at: new Date().toISOString()
                        }
                    })
                    .eq('id', draftId)
                    .eq('user_id', userId)
                    .select()
                    .single();

                if (saveError) {
                    console.error('Error updating draft to report:', saveError, 'Draft ID:', draftId);
                    // Don't delete draft on error so it can retry
                    return false;
                }

                if (!savedReport) {
                    console.error('No report returned after update:', draftId);
                    return false;
                }

                // Set notification flag for Saved Records tab
                setHasNewMobileSOAP(true);
                localStorage.setItem('hasNewMobileSOAP', 'true');
                localStorage.setItem('newMobileSOAPId', savedReport.id);

                // Dispatch custom event to notify Saved Reports component and update count
                window.dispatchEvent(new CustomEvent('newMobileSOAPGenerated', {
                    detail: { reportId: savedReport.id }
                }));

                console.log('Successfully processed mobile dictation:', draftId, 'Report ID:', savedReport.id);
                return true;
            } catch (genError) {
                console.error('Error generating SOAP from mobile dictation:', genError, 'Draft ID:', draftId);
                // Don't delete draft on error so it can retry
                return false;
            } finally {
                // Ensure we always remove from processing set
                processingDraftIdsRef.current.delete(draftId);
            }
        };

        const checkPendingCount = async () => {
            try {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth0_user_id', user.sub)
                    .single();

                if (userError || !userData) return 0;

                const userId = userData.id;

                // Fetch all drafts that were explicitly sent from mobile (sent_to_desktop: true)
                // Only count drafts that don't have report_text (haven't been processed yet)
                const { data: allDrafts, error: draftError } = await supabase
                    .from('saved_reports')
                    .select('id, form_data, report_text, created_at')
                    .eq('user_id', userId)
                    .eq('record_type', 'quicksoap')
                    .is('report_text', null)
                    .order('created_at', { ascending: true })
                    .limit(20);

                if (draftError || !allDrafts || allDrafts.length === 0) {
                    return 0;
                }

                // Filter to only drafts with sent_to_desktop: true and no report_text
                const sentDrafts = allDrafts.filter(d =>
                    d.form_data?.sent_to_desktop === true &&
                    !d.report_text
                );
                return sentDrafts.length;
            } catch (err) {
                console.error('Error checking pending count:', err);
                return 0;
            }
        };

        const processQueue = async () => {
            // Don't start processing if already processing
            if (isProcessingQueueRef.current) return;

            try {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth0_user_id', user.sub)
                    .single();

                if (userError || !userData) {
                    setMobileReportsGenerating(0);
                    return;
                }

                const userId = userData.id;

                // Fetch all drafts that were explicitly sent from mobile (sent_to_desktop: true)
                // Only get drafts that don't have report_text (haven't been processed yet)
                const { data: allDrafts, error: draftError } = await supabase
                    .from('saved_reports')
                    .select('id, form_data, report_text, created_at')
                    .eq('user_id', userId)
                    .eq('record_type', 'quicksoap')
                    .is('report_text', null)
                    .order('created_at', { ascending: true }) // Process oldest first
                    .limit(20);

                if (draftError || !allDrafts || allDrafts.length === 0) {
                    setMobileReportsGenerating(0);
                    return;
                }

                // Filter to only drafts with sent_to_desktop: true and no report_text
                const sentDrafts = allDrafts.filter(d =>
                    d.form_data?.sent_to_desktop === true &&
                    !d.report_text
                );

                if (sentDrafts.length === 0) {
                    setMobileReportsGenerating(0);
                    return;
                }

                // Update count of pending reports
                setMobileReportsGenerating(sentDrafts.length);

                // Process queue sequentially - one at a time
                isProcessingQueueRef.current = true;

                for (let i = 0; i < sentDrafts.length; i++) {
                    const draft = sentDrafts[i];
                    // Update count before processing (remaining count)
                    const remaining = sentDrafts.length - i;
                    setMobileReportsGenerating(remaining);

                    const success = await processMobileDictation(draft);

                    // Small delay between processing to avoid overwhelming the API
                    if (i < sentDrafts.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }

                // Check if there are more after processing
                const { data: remainingDrafts } = await supabase
                    .from('saved_reports')
                    .select('id, form_data, report_text')
                    .eq('user_id', userId)
                    .eq('record_type', 'quicksoap')
                    .is('report_text', null);

                const remainingSentDrafts = remainingDrafts?.filter(d =>
                    d.form_data?.sent_to_desktop === true &&
                    !d.report_text
                ) || [];

                setMobileReportsGenerating(remainingSentDrafts.length);
            } catch (err) {
                console.error('Error processing mobile dictations queue:', err);
            } finally {
                isProcessingQueueRef.current = false;
            }
        };

        // Immediate check on login to show banner and start processing
        const immediateCheck = async () => {
            const count = await checkPendingCount();
            setMobileReportsGenerating(count);
            if (count > 0) {
                // Start processing immediately if there are pending reports
                processQueue();
            }
        };

        // Run immediately when authenticated
        immediateCheck();

        // Poll every 5 seconds for new mobile dictations (but only if not currently processing)
        const pollingInterval = setInterval(() => {
            processQueue();
        }, 5000);

        return () => {
            clearInterval(pollingInterval);
        };
    }, [isMobile, isAuthenticated, user]);

    // Check for new mobile SOAP on mount and listen for events
    useEffect(() => {
        if (isMobile || !isAuthenticated) return;

        // Check localStorage on mount for count
        const savedCount = parseInt(localStorage.getItem('mobileSOAPCount') || '0', 10);
        if (savedCount > 0) {
            setMobileSOAPCount(savedCount);
            setShowMobileSOAPNotification(true);
        }

        const hasNewSOAP = localStorage.getItem('hasNewMobileSOAP') === 'true';
        if (hasNewSOAP) {
            setHasNewMobileSOAP(true);
        }

        // Listen for new mobile SOAP events
        const handleNewMobileSOAP = (event) => {
            setHasNewMobileSOAP(true);
            // Increment count
            const currentCount = parseInt(localStorage.getItem('mobileSOAPCount') || '0', 10);
            const newCount = currentCount + 1;
            setMobileSOAPCount(newCount);
            setShowMobileSOAPNotification(true);
            localStorage.setItem('mobileSOAPCount', newCount.toString());
        };

        // Listen for clear notification event (when SavedReports is viewed)
        const handleClearNotification = () => {
            setHasNewMobileSOAP(false);
            setMobileSOAPCount(0);
            setShowMobileSOAPNotification(false);
            localStorage.removeItem('mobileSOAPCount');
        };

        window.addEventListener('newMobileSOAPGenerated', handleNewMobileSOAP);
        window.addEventListener('clearMobileSOAPNotification', handleClearNotification);

        return () => {
            window.removeEventListener('newMobileSOAPGenerated', handleNewMobileSOAP);
            window.removeEventListener('clearMobileSOAPNotification', handleClearNotification);
        };
    }, [isMobile, isAuthenticated]);

    // ================ CHECK FOR PENDING DICTATIONS ================
    useEffect(() => {
        if (isMobile || !isAuthenticated || !user) return; // Only check on desktop when authenticated

        let lastSupabaseCheck = 0;
        const SUPABASE_CHECK_INTERVAL = 15000; // Check Supabase every 15 seconds (optimized)

        const checkPendingDictation = async (forceSupabaseCheck = false) => {
            const pendingSentAt = localStorage.getItem('pendingMobileDictation');
            const pendingId = localStorage.getItem('pendingMobileDictationId');

            // Quick localStorage check first
            if (!pendingSentAt || !pendingId) {
                setHasPendingDictation(false);
                return;
            }

            // Check if user dismissed this dictation
            const dismissedDictations = JSON.parse(localStorage.getItem('dismissedMobileDictations') || '[]');
            if (dismissedDictations.includes(pendingId)) {
                setHasPendingDictation(false);
                return;
            }

            // Verify with Supabase periodically (optimized - only when tab is active and enough time has passed)
            const now = Date.now();
            const shouldCheckSupabase = forceSupabaseCheck || (now - lastSupabaseCheck > SUPABASE_CHECK_INTERVAL);
            const isTabActive = !document.hidden;

            if (shouldCheckSupabase && isTabActive) {
                try {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('id')
                        .eq('auth0_user_id', user.sub)
                        .single();

                    if (userData) {
                        // Check if the pending dictation still exists and is still pending
                        const { data: pendingDraft } = await supabase
                            .from('saved_reports')
                            .select('id, form_data')
                            .eq('id', pendingId)
                            .eq('user_id', userData.id)
                            .maybeSingle();

                        if (pendingDraft && pendingDraft.form_data?.sent_to_desktop === true) {
                            // Still pending - show indicator
                            setHasPendingDictation(true);
                            lastSupabaseCheck = now;
                        } else {
                            // No longer pending - clear localStorage
                            localStorage.removeItem('pendingMobileDictation');
                            localStorage.removeItem('pendingMobileDictationId');
                            setHasPendingDictation(false);
                        }
                    }
                } catch (err) {
                    console.error('Error checking pending dictation:', err);
                    // Fallback to localStorage state if Supabase check fails
                    setHasPendingDictation(true);
                }
            } else {
                // Use localStorage state (faster, no DB query)
                setHasPendingDictation(true);
            }
        };

        // Check on mount
        checkPendingDictation(true); // Force Supabase check on mount

        // Listen for storage changes (when dictations arrive or are dismissed from other tabs)
        const handleStorageChange = (e) => {
            if (e.key === 'pendingMobileDictation' || e.key === 'pendingMobileDictationId' || e.key === 'dismissedMobileDictations') {
                checkPendingDictation(false);
            }
        };

        // Listen for custom events (when dictations arrive or are dismissed in same tab)
        const handlePendingDictationChange = (e) => {
            setHasPendingDictation(e.detail.hasPending);
        };

        // Listen for tab visibility changes (only poll when tab is active)
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                // Tab became active - check immediately
                checkPendingDictation(true);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('pendingDictationChanged', handlePendingDictationChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Check periodically (optimized - only when tab is active, less frequent)
        const interval = setInterval(() => {
            if (!document.hidden) {
                checkPendingDictation(false);
            }
        }, 5000); // Check every 5 seconds (localStorage only, Supabase check happens less frequently)

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('pendingDictationChanged', handlePendingDictationChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(interval);
        };
    }, [isMobile, isAuthenticated, user]);

    // ================ SUBSCRIPTION CHECK ================
    const checkSubscription = async () => {
        if (!user?.sub) return;

        try {
            const { data, error } = await supabase
                .from('users')
                .select('subscription_status, subscription_interval, stripe_customer_id, has_accepted_terms, email, nickname, dvm_name, grace_period_end, subscription_end_date, plan_label, student_school_email, student_grad_year, has_completed_onboarding')
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

                // Check if user has active subscription OR student access OR trial
                const hasActiveSubscription = ['active', 'past_due'].includes(data.subscription_status);
                const hasTrial = data.subscription_status === 'active' && data.subscription_interval === 'trial';
                const isStudentMode = data.plan_label === 'student' &&
                    data.subscription_end_date &&
                    new Date(data.subscription_end_date) > new Date();

                setIsSubscribed(hasActiveSubscription || hasTrial || isStudentMode);
                setUserData(data);
                setHasCompletedOnboarding(data.has_completed_onboarding !== false); // Treat null/true as completed

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

    useEffect(() => {
        if (isAuthenticated && user) {
            checkSubscription();
        }
    }, [isAuthenticated, user]);

    // Listen for subscription updates from Checkout component
    useEffect(() => {
        const handleSubscriptionUpdate = () => {
            // Small delay to ensure database has updated
            setTimeout(() => {
                checkSubscription();
            }, 300);
        };

        window.addEventListener('subscriptionUpdated', handleSubscriptionUpdate);
        return () => {
            window.removeEventListener('subscriptionUpdated', handleSubscriptionUpdate);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Refetch subscription status when navigating to QuickSOAP (in case user just signed up)
    useEffect(() => {
        if (location.pathname === '/dashboard/quicksoap' && isAuthenticated && user) {
            // Small delay to ensure database has updated
            const timer = setTimeout(() => {
                checkSubscription();
            }, 500);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, isAuthenticated, user]);

    // Redirect mobile users from QuickSOAP to profile if they don't have an active plan
    useEffect(() => {
        if (isMobile && location.pathname === '/dashboard/quicksoap' && !isLoading && userData) {
            // Wait a bit for subscription status to update after trial activation
            const timer = setTimeout(() => {
                if (!hasActivePlan()) {
                    navigate('/dashboard/profile', { replace: true });
                }
            }, 1000); // Give time for subscription check to complete
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMobile, location.pathname, isLoading, userData]);

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
        // On mobile, skip welcome page and go to profile
        if (isMobile) {
            // Still show welcome for DVM name setup, but navigate to profile after
            return <Welcome onComplete={(updatedData) => {
                setNeedsWelcome(false);
                setUserData(updatedData);
                // Navigate to profile on mobile after DVM name is set
                navigate('/dashboard/profile');
            }} />;
        }
        // On desktop, show welcome normally
        return <Welcome onComplete={(updatedData) => {
            setNeedsWelcome(false);
            setUserData(updatedData);
        }} />;
    }

    // Check if user needs to complete onboarding (select plan + see welcome page)
    if (!hasCompletedOnboarding) {
        // If they haven't selected a plan yet, show plan selection
        if (!subscriptionStatus || subscriptionStatus === 'inactive') {
            return <PlanSelection 
                user={{ ...user, sub: user.sub }} 
                onTrialActivated={() => {
                    // Trial was activated, show welcome page
                    setShowWelcomePage(true);
                    setSubscriptionStatus('active');
                    checkSubscription(); // Refresh data
                }}
            />;
        }
        
        // They have a plan but haven't completed onboarding - show welcome page
        return <WelcomeToPetwise 
            user={user}
            onComplete={() => {
                setHasCompletedOnboarding(true);
                setShowWelcomePage(false);
            }}
        />;
    }

    // If showWelcomePage is true (just activated trial), show welcome
    if (showWelcomePage) {
        return <WelcomeToPetwise 
            user={user}
            onComplete={() => {
                setHasCompletedOnboarding(true);
                setShowWelcomePage(false);
            }}
        />;
    }

    // After onboarding, check if on mobile
    if (isMobile && !isLoading) {
        // Check if this is the admin route - allow access on mobile for admins
        const isAdminRoute = window.location.pathname.includes('/admin');
        if (isAdminRoute && user?.sub === process.env.REACT_APP_ADMIN_USER_ID) {
            // Allow admin access on mobile - return null so the admin route renders
            return null;
        }

        // Check QuickSOAP route - only allow if user has active plan
        const isQuickSOAPRoute = window.location.pathname.includes('/quicksoap');
        if (isQuickSOAPRoute) {
            // Don't render if no active plan - useEffect will handle redirect
            if (!hasActivePlan()) {
                return null;
            }
            // Render QuickSOAP with mobile header and bottom nav
            return (
                <>
                    {/* Mobile Header */}
                    <div className="flex fixed top-0 left-0 right-0 h-16 bg-primary-600 items-center justify-between px-4 z-50 shadow-md">
                        <div className="text-white text-2xl font-inter flex items-center gap-2.5 tracking-wide">
                            <img src="/PW.png" alt="PW" className="w-8 h-8 object-contain" />
                            <span>
                                <span className="font-bold text-white">Petwise</span>
                                <span className="font-normal text-white">.vet</span>
                            </span>
                        </div>
                    </div>
                    {/* QuickSOAP Component */}
                    <div style={{ paddingTop: '64px', paddingBottom: '80px' }}>
                        <QuickSOAP />
                    </div>
                    {/* Bottom Navigation Bar */}
                    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg">
                        <div className={`flex items-center ${hasActivePlan() ? 'justify-around' : 'justify-center'} h-16`}>
                            {hasActivePlan() && (
                                <Link
                                    to="/dashboard/quicksoap"
                                    className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${location.pathname === '/dashboard/quicksoap' ? 'text-primary-600' : 'text-gray-500'
                                        }`}
                                >
                                    <FaMicrophone className={`text-xl mb-1 ${location.pathname === '/dashboard/quicksoap' ? 'text-primary-600' : 'text-gray-500'}`} />
                                    <span className="text-xs font-medium">
                                        QuickSOAP
                                        <span className="ml-0.5 text-[8px] font-semibold text-yellow-400 uppercase tracking-wide">beta</span>
                                    </span>
                                </Link>
                            )}
                            <Link
                                to="/dashboard/profile"
                                className={`flex flex-col items-center justify-center ${hasActivePlan() ? 'flex-1' : 'px-8'} h-full transition-colors duration-200 ${location.pathname === '/dashboard/profile' ? 'text-primary-600' : 'text-gray-500'
                                    }`}
                            >
                                <FaUser className={`text-xl mb-1 ${location.pathname === '/dashboard/profile' ? 'text-primary-600' : 'text-gray-500'}`} />
                                <span className="text-xs font-medium">Profile</span>
                            </Link>
                        </div>
                    </nav>
                </>
            );
        }

        // Redirect based on subscription status if not on a specific route
        if (!window.location.pathname.includes('/profile') && !window.location.pathname.includes('/quicksoap')) {
            // Route to QuickSOAP if user has active plan, otherwise route to Profile
            if (hasActivePlan()) {
                navigate('/dashboard/quicksoap', { replace: true });
            } else {
                navigate('/dashboard/profile', { replace: true });
            }
            return null;
        }

        // If on profile route, allow it but hide sidebar and only show profile with bottom nav
        if (window.location.pathname.includes('/profile')) {
            return (
                <>
                    {/* Mobile Header */}
                    <div className="flex fixed top-0 left-0 right-0 h-16 bg-primary-600 items-center justify-between px-4 z-50 shadow-md">
                        <div className="text-white text-2xl font-inter flex items-center gap-2.5 tracking-wide">
                            <img src="/PW.png" alt="PW" className="w-8 h-8 object-contain" />
                            <span>
                                <span className="font-bold text-white">Petwise</span>
                                <span className="font-normal text-white">.vet</span>
                            </span>
                        </div>
                    </div>
                    <div className="min-h-screen bg-white p-0" style={{ paddingTop: '64px', paddingBottom: '80px' }}>
                        <Profile isMobileSignup={true} />
                    </div>
                    {/* Bottom Navigation Bar */}
                    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg">
                        <div className={`flex items-center ${hasActivePlan() ? 'justify-around' : 'justify-center'} h-16`}>
                            {hasActivePlan() && (
                                <Link
                                    to="/dashboard/quicksoap"
                                    className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${location.pathname === '/dashboard/quicksoap' ? 'text-primary-600' : 'text-gray-500'
                                        }`}
                                >
                                    <FaMicrophone className={`text-xl mb-1 ${location.pathname === '/dashboard/quicksoap' ? 'text-primary-600' : 'text-gray-500'}`} />
                                    <span className="text-xs font-medium">
                                        QuickSOAP
                                        <span className="ml-0.5 text-[8px] font-semibold text-yellow-400 uppercase tracking-wide">beta</span>
                                    </span>
                                </Link>
                            )}
                            <Link
                                to="/dashboard/profile"
                                className={`flex flex-col items-center justify-center ${hasActivePlan() ? 'flex-1' : 'px-8'} h-full transition-colors duration-200 ${location.pathname === '/dashboard/profile' ? 'text-primary-600' : 'text-gray-500'
                                    }`}
                            >
                                <FaUser className={`text-xl mb-1 ${location.pathname === '/dashboard/profile' ? 'text-primary-600' : 'text-gray-500'}`} />
                                <span className="text-xs font-medium">Profile</span>
                            </Link>
                        </div>
                    </nav>
                </>
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
            <style>{`
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
            {/* Tooltip styles for collapsed sidebar */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
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
            `}} />
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
                        {hasActivePlan() && (
                            <>
                                {/* QuickSOAP */}
                                <li className="mx-2 my-1 relative">
                                    <Link
                                        to="/dashboard/quicksoap"
                                        onClick={closeMobileMenu}
                                        data-tooltip="QuickSOAP"
                                        className={`flex items-center text-white no-underline text-base py-2.5 px-3 rounded-lg transition-all duration-200 w-full whitespace-nowrap hover:bg-white hover:bg-opacity-20 hover:text-accent-400 group ${isSidebarCollapsed ? 'justify-center' : 'text-left'} ${location.pathname === '/dashboard/quicksoap' ? 'bg-white bg-opacity-30' : ''}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 relative ${location.pathname === '/dashboard/quicksoap' ? 'bg-white bg-opacity-30' : 'bg-white bg-opacity-20'}`}>
                                            <FaMicrophone className="text-sm" />
                                            {/* Notification dot for pending dictations */}
                                            {hasPendingDictation && !isMobile && (
                                                <FaCircle className="absolute -top-1 -right-1 text-[#5cccf0] text-xs animate-pulse" style={{ fontSize: '8px' }} />
                                            )}
                                        </div>
                                        <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'} relative`}>
                                            QuickSOAP
                                            <span className="ml-1.5 text-[10px] font-semibold text-yellow-300 uppercase tracking-wide">beta</span>
                                            {/* Notification dot next to text when expanded */}
                                            {hasPendingDictation && !isMobile && !isSidebarCollapsed && (
                                                <FaCircle className="inline-block ml-2 text-[#5cccf0] text-xs animate-pulse" style={{ fontSize: '8px' }} />
                                            )}
                                        </span>
                                    </Link>
                                </li>
                            </>
                        )}
                        {isSubscribed && (
                            <>
                                <li className="mx-2 my-1 relative">
                                    <Link
                                        to="/dashboard/report-form"
                                        onClick={closeMobileMenu}
                                        data-tooltip="Report Generator"
                                        className={`flex items-center text-white no-underline text-base py-2.5 px-3 rounded-lg transition-all duration-200 w-full whitespace-nowrap hover:bg-white hover:bg-opacity-20 hover:text-accent-400 group ${isSidebarCollapsed ? 'justify-center' : 'text-left'} ${location.pathname === '/dashboard/report-form' || location.pathname === '/dashboard' ? 'bg-white bg-opacity-30' : ''}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 ${location.pathname === '/dashboard/report-form' || location.pathname === '/dashboard' ? 'bg-white bg-opacity-30' : 'bg-white bg-opacity-20'}`}>
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
                                        className={`flex items-center text-white no-underline text-base py-2.5 px-3 rounded-lg transition-all duration-200 w-full whitespace-nowrap hover:bg-white hover:bg-opacity-20 hover:text-accent-400 group ${isSidebarCollapsed ? 'justify-center' : 'text-left'} ${location.pathname === '/dashboard/quick-query' ? 'bg-white bg-opacity-30' : ''}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 ${location.pathname === '/dashboard/quick-query' ? 'bg-white bg-opacity-30' : 'bg-white bg-opacity-20'}`}>
                                            <FaSearch className="text-sm" />
                                        </div>
                                        <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'}`}>PetQUERY</span>
                                    </Link>
                                </li>
                                <li className="mx-2 my-1 relative">
                                    <Link
                                        to="/dashboard/saved-reports"
                                        data-tooltip="Saved Reports"
                                        className={`flex items-center text-white no-underline text-base py-2.5 px-3 rounded-lg transition-all duration-200 w-full whitespace-nowrap hover:bg-white hover:bg-opacity-20 hover:text-accent-400 group ${isSidebarCollapsed ? 'justify-center' : 'text-left'} ${location.pathname === '/dashboard/saved-reports' ? 'bg-white bg-opacity-30' : ''}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 relative ${location.pathname === '/dashboard/saved-reports' ? 'bg-white bg-opacity-30' : 'bg-white bg-opacity-20'}`}>
                                            <FaSave className="text-sm" />
                                            {/* Notification dot for new mobile SOAP */}
                                            {hasNewMobileSOAP && !isMobile && (
                                                <FaCircle className="absolute -top-1 -right-1 text-[#5cccf0] text-xs animate-pulse" style={{ fontSize: '8px' }} />
                                            )}
                                        </div>
                                        <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'} relative`}>
                                            Saved Records
                                            {/* Notification dot next to text when expanded */}
                                            {hasNewMobileSOAP && !isMobile && !isSidebarCollapsed && (
                                                <FaCircle className="inline-block ml-2 text-[#5cccf0] text-xs animate-pulse" style={{ fontSize: '8px' }} />
                                            )}
                                        </span>
                                    </Link>
                                </li>
                                <li className="mx-2 my-1 relative">
                                    <Link
                                        to="/dashboard/templates"
                                        data-tooltip="My Templates"
                                        className={`flex items-center text-white no-underline text-base py-2.5 px-3 rounded-lg transition-all duration-200 w-full whitespace-nowrap hover:bg-white hover:bg-opacity-20 hover:text-accent-400 group ${isSidebarCollapsed ? 'justify-center' : 'text-left'} ${location.pathname === '/dashboard/templates' ? 'bg-white bg-opacity-30' : ''}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 ${location.pathname === '/dashboard/templates' ? 'bg-white bg-opacity-30' : 'bg-white bg-opacity-20'}`}>
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
                                className={`flex items-center text-white no-underline text-base py-2.5 px-3 rounded-lg transition-all duration-200 w-full whitespace-nowrap hover:bg-white hover:bg-opacity-20 hover:text-accent-400 group ${isSidebarCollapsed ? 'justify-center' : 'text-left'} ${location.pathname === '/dashboard/profile' ? 'bg-white bg-opacity-30' : ''}`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 ${location.pathname === '/dashboard/profile' ? 'bg-white bg-opacity-30' : 'bg-white bg-opacity-20'}`}>
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
                                className={`flex items-center text-white no-underline text-base py-2.5 px-3 rounded-lg transition-all duration-200 w-full whitespace-nowrap hover:bg-white hover:bg-opacity-20 hover:text-accent-400 group ${isSidebarCollapsed ? 'justify-center' : 'text-left'} ${location.pathname === '/dashboard/help' ? 'bg-white bg-opacity-30' : ''} relative`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 ${location.pathname === '/dashboard/help' ? 'bg-white bg-opacity-30' : 'bg-white bg-opacity-20'}`}>
                                    <FaQuestionCircle className="text-sm" />
                                </div>
                                <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'}`}>Help</span>
                                {!isSidebarCollapsed && (
                                    <span className="absolute top-1/2 -translate-y-1/2 right-2 bg-yellow-400/80 backdrop-blur-sm text-yellow-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-yellow-500/30">NEW</span>
                                )}
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

                    {/* Mobile Reports Generating Banner */}
                    {mobileReportsGenerating > 0 && !isMobile && (
                        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-4 shadow-lg mb-4 mx-4 mt-4 rounded-xl flex items-center justify-between relative transition-all duration-500 ease-out" style={{ animation: 'fadeUp 0.5s ease-out', zIndex: 9999 }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                                <div>
                                    <p className="font-semibold text-base">
                                        {mobileReportsGenerating === 1
                                            ? '1 report generating from mobile'
                                            : `${mobileReportsGenerating} reports generating from mobile`
                                        }
                                    </p>
                                    <p className="text-sm opacity-90">Reports will appear in Saved Records when complete</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Site-wide Mobile SOAP Notification Banner */}
                    {showMobileSOAPNotification && mobileSOAPCount > 0 && !isMobile && mobileReportsGenerating === 0 && (
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 shadow-lg mb-4 mx-4 mt-4 rounded-xl flex items-center justify-between relative transition-all duration-500 ease-out" style={{ animation: 'fadeUp 0.5s ease-out', zIndex: 9999 }}>
                            <div className="flex items-center gap-3">
                                <FaMobile className="text-xl flex-shrink-0" />
                                <div>
                                    <p className="font-semibold text-base">
                                        {mobileSOAPCount === 1
                                            ? 'New record saved from mobile'
                                            : `${mobileSOAPCount} new records saved from mobile`
                                        }
                                    </p>
                                    <p className="text-sm opacity-90">Click to view in Saved Records</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3" style={{ position: 'relative', zIndex: 10000 }}>
                                <button
                                    onClick={() => {
                                        navigate('/dashboard/saved-reports');
                                    }}
                                    className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg font-medium text-sm transition-all relative"
                                    style={{ zIndex: 10001 }}
                                >
                                    View
                                </button>
                                <button
                                    onClick={() => {
                                        setShowMobileSOAPNotification(false);
                                        setMobileSOAPCount(0);
                                        localStorage.removeItem('mobileSOAPCount');
                                    }}
                                    className="text-white hover:text-gray-200 transition-colors flex-shrink-0"
                                    title="Dismiss"
                                >
                                    <FaTimes className="text-lg" />
                                </button>
                            </div>
                        </div>
                    )}

                    <Routes>
                        <Route
                            path="/"
                            element={
                                <Navigate to={
                                    isMobile
                                        ? "/dashboard/profile"
                                        : (hasActivePlan() ? "/dashboard/quicksoap" : "/dashboard/profile")
                                } replace />
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
                            path="quicksoap"
                            element={
                                // Only allow QuickSOAP if user has an active plan (trial, paid, or student)
                                hasActivePlan() ?
                                    <QuickSOAP /> :
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