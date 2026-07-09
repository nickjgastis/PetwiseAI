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
// Tailwind classes will be used instead of CSS file
import { supabase } from '../supabaseClient';
import { FaFileAlt, FaSearch, FaSave, FaUser, FaSignOutAlt, FaQuestionCircle, FaClipboard, FaMicrophone, FaCircle, FaTimes, FaMobile, FaCommentMedical, FaChevronUp, FaChevronDown, FaChartPie, FaCreditCard } from 'react-icons/fa';
import { clearAppLocalStorage, checkAndClearForUserChange } from '../utils/clearUserData';
import InstallPrompt from '../components/InstallPrompt';
import OnboardingFlow from '../components/onboarding/OnboardingFlow';
import AppTour from '../components/onboarding/AppTour';
import UsageRing from '../components/UsageRing';
import { useUsage } from '../hooks/useUsage';
// import BookingBanner from '../components/BookingBanner'; // Disabled for now — see usage block below

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
    @keyframes pwaFadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    .pwa-fade-in {
        animation: pwaFadeIn 0.4s ease-out forwards;
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
    const [isLoading, setIsLoading] = useState(true);
    const [subscriptionStatus, setSubscriptionStatus] = useState(null);
    const [userData, setUserData] = useState(null);
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [needsWelcome, setNeedsWelcome] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showMobileProfile, setShowMobileProfile] = useState(false);
    const [hasPendingDictation, setHasPendingDictation] = useState(false);
    const [mobileAppVisible, setMobileAppVisible] = useState(false); // For PWA fade-in animation
    const [hasNewMobileSOAP, setHasNewMobileSOAP] = useState(false);
    const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true); // Default true for existing users
    const [onboardingData, setOnboardingData] = useState(null); // New onboarding flow data (null = no row = skip)
    const [showAppTour, setShowAppTour] = useState(false); // First-run tutorial for brand-new users
    const [showAccountMenu, setShowAccountMenu] = useState(false); // Sidebar footer account popup
    const [showQRModal, setShowQRModal] = useState(false); // Mobile app QR popup
    const accountMenuRef = useRef(null);
    const usage = useUsage(); // Free-tier usage (drives the sidebar ring)

    // Close the sidebar account popup on any outside click
    useEffect(() => {
        if (!showAccountMenu) return;
        const handler = (e) => {
            if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
                setShowAccountMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showAccountMenu]);
    const [mobileSOAPCount, setMobileSOAPCount] = useState(0);
    const [showMobileSOAPNotification, setShowMobileSOAPNotification] = useState(false);
    const [mobileReportsGenerating, setMobileReportsGenerating] = useState(0);
    const [draftsWaitingForLimit, setDraftsWaitingForLimit] = useState(0); // Mobile drafts blocked by the daily free cap
    const limitBlockedUntilRef = useRef(0); // Backoff so we don't hammer the API with 403s while capped
    const [mobileReportTypes, setMobileReportTypes] = useState({ soap: 0, summary: 0, callback: 0 }); // Track types being generated
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

    // Free tier gives everyone app access — this only decides whether to show
    // upgrade UI / usage meters (paid or student = unlimited).
    const hasPaidPlan = () => {
        if (isStudentMode()) return true;
        return ['active', 'past_due'].includes(userData?.subscription_status) &&
            ['monthly', 'yearly'].includes(userData?.subscription_interval);
    };

    // ================ USER CHANGE DETECTION ================
    // Clear localStorage if a different user logs in on the same device
    useEffect(() => {
        if (isAuthenticated && user?.sub) {
            checkAndClearForUserChange(user.sub);
        }
    }, [isAuthenticated, user?.sub]);

    // ================ EVENT HANDLERS ================
    const handleLogout = () => {
        // Check if running as installed PWA
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                            window.navigator.standalone === true;
        
        const returnUrl = process.env.NODE_ENV === 'production'
            ? (isStandalone ? 'https://app.petwise.vet' : 'https://petwise.vet')
            : 'http://localhost:3000';
        
        // Clear all app data from localStorage
        clearAppLocalStorage();
        localStorage.removeItem('auth0.is.authenticated');
        
        logout({
            logoutParams: {
                returnTo: returnUrl
            }
        });
    };

    // ================ MOBILE DETECTION ================
    useEffect(() => {
        const checkMobile = () => {
            // DEV ONLY: Allow forcing mobile view via localStorage
            const forceMobile = process.env.NODE_ENV === 'development' && localStorage.getItem('forceMobile') === 'true';
            
            // Only use user agent to avoid triggering on split-screen desktops
            // Don't use touch or width checks as touchscreen laptops would be falsely detected
            const isMobileUserAgent = forceMobile || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            setIsMobile(isMobileUserAgent);
        };

        checkMobile(); // Check on initial load
        // Don't listen to resize - we want device type, not window size
    }, []);

    // ================ PWA FADE-IN ANIMATION ================
    useEffect(() => {
        // Only trigger fade-in for PWA after loading completes
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                            window.navigator.standalone === true;
        
        if (isStandalone && !isLoading && isMobile) {
            // Small delay to ensure DOM is ready, then fade in
            const timer = setTimeout(() => {
                setMobileAppVisible(true);
            }, 50);
            return () => clearTimeout(timer);
        } else if (!isStandalone || !isMobile) {
            // On desktop or browser, show immediately
            setMobileAppVisible(true);
        }
    }, [isLoading, isMobile]);

    // ================ FETCH NEW MOBILE DICTATIONS (Background polling with queue) ================
    // This runs continuously even when QuickSOAP tab is not active, so sidebar can show alerts
    useEffect(() => {
        if (isMobile || !isAuthenticated || !user) {
            // Reset count when logged out
            setMobileReportsGenerating(0);
            setMobileReportTypes({ soap: 0, summary: 0, callback: 0 });
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

                // Auto-generate report from mobile dictation
                const formData = draft.form_data;
                const dictations = formData.dictations || [];
                const input = formData.input || '';
                // Get record type from form_data (defaults to 'soap' for backwards compatibility)
                const draftRecordType = formData.record_type || 'soap';

                // Combine all dictations and manual input
                const allDictations = dictations.map(d => d.fullText || d.summary || '').join('\n\n');
                const combinedInput = allDictations + (input.trim() ? '\n\n' + input.trim() : '');

                if (!combinedInput.trim()) {
                    console.error('No dictation content to generate report from');
                    // Delete draft if no content
                    await supabase
                        .from('saved_reports')
                        .delete()
                        .eq('id', draftId);
                    return false;
                }

                // Generate report with appropriate record type
                const response = await axios.post(`${API_URL}/api/generate-soap`, {
                    input: combinedInput.trim(),
                    user: user ? { sub: user.sub } : null,
                    recordType: draftRecordType,
                    tz: Intl.DateTimeFormat().resolvedOptions().timeZone
                });

                if (!response.data || !response.data.report) {
                    console.error('No report generated from API response:', response.data);
                    return false;
                }

                const generatedReport = response.data.report;
                const extractedPetName = response.data.petName;

                const dateStr = new Date().toLocaleString();
                // Get type label for report name
                const typeLabel = draftRecordType === 'soap' || draftRecordType === 'quicksoap' 
                    ? 'QuickSOAP' 
                    : draftRecordType === 'summary' 
                        ? 'Summary' 
                        : 'Callback';
                // Handle empty strings, null, undefined - only use pet name if it's a valid non-empty string
                const reportName = (extractedPetName && extractedPetName.trim && extractedPetName.trim())
                    ? `${extractedPetName.trim()} - ${typeLabel} - ${dateStr}`
                    : `${typeLabel} Mobile - ${dateStr}`;

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
                // Daily free cap reached — the draft is safe, it just has to wait
                // for the local-midnight reset (or an upgrade). Signal the queue to stop.
                if (genError.response?.status === 403 && genError.response?.data?.error === 'USAGE_LIMIT_REACHED') {
                    console.log('Daily free limit reached — parking mobile drafts until reset/upgrade');
                    return 'limit';
                }
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
                // Include all dictation-based record types: quicksoap, soap, summary, callback
                const { data: allDrafts, error: draftError } = await supabase
                    .from('saved_reports')
                    .select('id, form_data, report_text, created_at, record_type')
                    .eq('user_id', userId)
                    .in('record_type', ['quicksoap', 'soap', 'summary', 'callback'])
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
            // While capped, don't retry every poll — the backoff clears on
            // upgrade (subscriptionUpdated) and naturally after it expires.
            if (Date.now() < limitBlockedUntilRef.current) return;

            try {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth0_user_id', user.sub)
                    .single();

                if (userError || !userData) {
                    setMobileReportsGenerating(0);
                    setMobileReportTypes({ soap: 0, summary: 0, callback: 0 });
                    return;
                }

                const userId = userData.id;

                // Fetch all drafts that were explicitly sent from mobile (sent_to_desktop: true)
                // Only get drafts that don't have report_text (haven't been processed yet)
                // Include all dictation-based record types: quicksoap, soap, summary, callback
                const { data: allDrafts, error: draftError } = await supabase
                    .from('saved_reports')
                    .select('id, form_data, report_text, created_at, record_type')
                    .eq('user_id', userId)
                    .in('record_type', ['quicksoap', 'soap', 'summary', 'callback'])
                    .is('report_text', null)
                    .order('created_at', { ascending: true }) // Process oldest first
                    .limit(20);

                if (draftError || !allDrafts || allDrafts.length === 0) {
                    setMobileReportsGenerating(0);
                    setMobileReportTypes({ soap: 0, summary: 0, callback: 0 });
                    return;
                }

                // Filter to only drafts with sent_to_desktop: true and no report_text
                const sentDrafts = allDrafts.filter(d =>
                    d.form_data?.sent_to_desktop === true &&
                    !d.report_text
                );

                if (sentDrafts.length === 0) {
                    setMobileReportsGenerating(0);
                    setMobileReportTypes({ soap: 0, summary: 0, callback: 0 });
                    return;
                }

                // Count types being generated
                const typeCounts = { soap: 0, summary: 0, callback: 0 };
                sentDrafts.forEach(d => {
                    const type = d.record_type || d.form_data?.record_type || 'soap';
                    const normalizedType = type === 'quicksoap' ? 'soap' : type;
                    if (typeCounts[normalizedType] !== undefined) {
                        typeCounts[normalizedType]++;
                    } else {
                        typeCounts.soap++; // Default to soap for unknown types
                    }
                });
                setMobileReportTypes(typeCounts);

                // Update count of pending reports
                setMobileReportsGenerating(sentDrafts.length);

                // Process queue sequentially - one at a time
                isProcessingQueueRef.current = true;

                for (let i = 0; i < sentDrafts.length; i++) {
                    const draft = sentDrafts[i];
                    // Update count before processing (remaining count)
                    const remaining = sentDrafts.length - i;
                    setMobileReportsGenerating(remaining);

                    const result = await processMobileDictation(draft);

                    if (result === 'limit') {
                        // Park the rest of the queue: show the waiting banner and
                        // back off for 10 minutes (or until upgrade clears it).
                        setDraftsWaitingForLimit(sentDrafts.length - i);
                        setMobileReportsGenerating(0);
                        setMobileReportTypes({ soap: 0, summary: 0, callback: 0 });
                        limitBlockedUntilRef.current = Date.now() + 10 * 60 * 1000;
                        return;
                    }

                    // Small delay between processing to avoid overwhelming the API
                    if (i < sentDrafts.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }

                // Full pass without hitting the cap — nothing is parked
                setDraftsWaitingForLimit(0);

                // Check if there are more after processing
                const { data: remainingDrafts } = await supabase
                    .from('saved_reports')
                    .select('id, form_data, report_text, record_type')
                    .eq('user_id', userId)
                    .in('record_type', ['quicksoap', 'soap', 'summary', 'callback'])
                    .is('report_text', null);

                const remainingSentDrafts = remainingDrafts?.filter(d =>
                    d.form_data?.sent_to_desktop === true &&
                    !d.report_text
                ) || [];

                // Update type counts for remaining
                const remainingTypeCounts = { soap: 0, summary: 0, callback: 0 };
                remainingSentDrafts.forEach(d => {
                    const type = d.record_type || d.form_data?.record_type || 'soap';
                    const normalizedType = type === 'quicksoap' ? 'soap' : type;
                    if (remainingTypeCounts[normalizedType] !== undefined) {
                        remainingTypeCounts[normalizedType]++;
                    } else {
                        remainingTypeCounts.soap++;
                    }
                });
                setMobileReportTypes(remainingTypeCounts);
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

        // Upgrading lifts the cap immediately — clear the backoff and retry
        const handleSubscriptionUpdated = () => {
            limitBlockedUntilRef.current = 0;
            setDraftsWaitingForLimit(0);
            processQueue();
        };
        window.addEventListener('subscriptionUpdated', handleSubscriptionUpdated);

        return () => {
            clearInterval(pollingInterval);
            window.removeEventListener('subscriptionUpdated', handleSubscriptionUpdated);
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
                .select('subscription_status, subscription_interval, stripe_customer_id, has_accepted_terms, email, nickname, dvm_name, grace_period_end, subscription_end_date, plan_label, student_school_email, student_grad_year, has_completed_onboarding, has_used_trial, has_activated_stripe_trial, welcome_email_sent_at, has_seen_app_tour')
                .eq('auth0_user_id', user.sub)
                .single();
            let userData = data;
            
            if (error) {
                // PGRST116 = no rows found, also handle 406 status (Not Acceptable = no rows for .single())
                console.log('Supabase error:', JSON.stringify(error));
                const isNoRowsError = error.code === 'PGRST116' || error.message?.includes('JSON object requested') || error.details?.includes('0 rows') || error.code === '406';
                console.log('isNoRowsError:', isNoRowsError);
                if (isNoRowsError) {
                    // User doesn't exist - try to create
                    if (!user.email) {
                        console.error('No email provided from Auth0');
                        throw new Error('Email is required for registration');
                    }

                    const { data: newUser, error: createError } = await supabase
                        .from('users')
                        .insert([{
                            auth0_user_id: user.sub,
                            email: user.email,
                            nickname: user.nickname || user.name,
                            subscription_status: 'inactive',
                            has_accepted_terms: false,
                            dvm_name: null,
                            created_at: new Date().toISOString(),
                            email_opt_out: false
                        }])
                        .select()
                        .single();

                    if (createError) {
                        // Handle race condition - App.js might have created user already
                        console.log('Create error:', JSON.stringify(createError));
                        if (createError.code === '23505' || createError.message?.includes('duplicate') || createError.message?.includes('unique constraint')) {
                            // Fetch the existing user
                            const { data: existingUser, error: fetchError } = await supabase
                                .from('users')
                                .select('subscription_status, subscription_interval, stripe_customer_id, has_accepted_terms, email, nickname, dvm_name, grace_period_end, subscription_end_date, plan_label, student_school_email, student_grad_year, has_completed_onboarding, has_used_trial, has_activated_stripe_trial, welcome_email_sent_at, has_seen_app_tour')
                                .eq('auth0_user_id', user.sub)
                                .single();
                            
                            if (fetchError) {
                                console.log('Fetch existing user error:', JSON.stringify(fetchError));
                                throw fetchError;
                            }
                            console.log('Fetched existing user:', existingUser?.email);
                            userData = existingUser;
                            
                            // Update email if missing (App.js doesn't capture email)
                            if (user.email && !existingUser.email) {
                                console.log('Updating missing email in database to:', user.email);
                                const { error: emailUpdateError } = await supabase
                                    .from('users')
                                    .update({ email: user.email, nickname: user.nickname || user.name })
                                    .eq('auth0_user_id', user.sub);
                                if (emailUpdateError) {
                                    console.error('Failed to update email:', emailUpdateError);
                                } else {
                                    console.log('Email updated successfully');
                                    userData.email = user.email;
                                }
                            }
                        } else {
                            throw createError;
                        }
                    } else {
                        userData = newUser;
                    }
                } else {
                    // Add retry for other errors
                    console.error('Error fetching user data:', error, 'Code:', error.code, 'Message:', error.message);
                    setTimeout(() => checkSubscription(), 2000);
                    return;
                }
            }
            
            // Send welcome email if not sent yet (works for both new and existing users)
            // Using sessionStorage to prevent double sends in React Strict Mode
            const welcomeEmailKey = `welcome_email_sent_${user.sub}`;
            const alreadySentThisSession = sessionStorage.getItem(welcomeEmailKey);
            
            if (userData && user.email && !userData.welcome_email_sent_at && !alreadySentThisSession) {
                sessionStorage.setItem(welcomeEmailKey, 'true');
                console.log('Sending welcome email to:', user.email);
                fetch(`${API_URL}/email/welcome`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        auth0_user_id: user.sub,
                        email: user.email,
                        nickname: user.nickname || user.name
                    })
                })
                .then(res => res.json())
                .then(result => console.log('Welcome email response:', result))
                .catch(err => console.error('Welcome email error:', err));
            }
            
            // Update email if changed
            if (user.email && userData.email !== user.email) {
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ email: user.email })
                    .eq('auth0_user_id', user.sub);

                if (updateError) console.error('Error updating email:', updateError);
                userData.email = user.email;
            }

            // Add retry for pending states
            if (userData.subscription_status === 'pending' || userData.subscription_status === 'incomplete') {
                setTimeout(() => checkSubscription(), 2000);
                return;
            }

            setHasAcceptedTerms(userData.has_accepted_terms);
            setSubscriptionStatus(userData.subscription_status);
            setUserData(userData);
            // First-run tutorial for brand-new users (backfilled true for existing users)
            setShowAppTour(userData.has_seen_app_tour === false);

            // Check new onboarding flow table (find or create for new users)
            try {
                const { data: onboarding, error: onboardingError } = await supabase
                    .from('onboarding')
                    .select('*')
                    .eq('auth0_user_id', user.sub)
                    .single();
                
                if (onboardingError && onboardingError.code === 'PGRST116') {
                    // No onboarding row — check if this is a brand new user
                    const isNewUser = !userData.has_accepted_terms && !userData.dvm_name && 
                                      (!userData.subscription_status || userData.subscription_status === 'inactive') &&
                                      !userData.has_completed_onboarding && !userData.has_used_trial;
                    
                    if (isNewUser) {
                        // Create onboarding row now (upsert to handle race conditions)
                        const { data: newOnboarding } = await supabase
                            .from('onboarding')
                            .upsert([{
                                auth0_user_id: user.sub,
                                status: 'in_progress',
                                current_step: 'congrats',
                                quiz_answers: {},
                            }], { onConflict: 'auth0_user_id' })
                            .select()
                            .single();
                        
                        if (newOnboarding && newOnboarding.status === 'in_progress') {
                            console.log('Onboarding row created for new user');
                            setOnboardingData(newOnboarding);
                        } else {
                            setOnboardingData(null);
                        }
                    } else {
                        setOnboardingData(null); // Existing user, skip
                    }
                } else if (onboardingError) {
                    console.error('Error fetching onboarding:', onboardingError);
                    setOnboardingData(null);
                } else if (onboarding && onboarding.status === 'in_progress') {
                    // (Trial step removed — OnboardingFlow bounces stale steps itself)
                    setOnboardingData(onboarding);
                } else {
                    setOnboardingData(null); // Completed or no row — skip
                }
            } catch (onboardingErr) {
                console.error('Error checking onboarding:', onboardingErr);
                setOnboardingData(null);
            }

            // Onboarding is complete if:
            // 1. has_completed_onboarding is explicitly true, OR
            // 2. User has previously used trial (they went through flow before, just expired/canceled)
            const hasCompletedOnboardingBefore = userData.has_completed_onboarding === true || userData.has_used_trial === true;
            setHasCompletedOnboarding(hasCompletedOnboardingBefore);

            if (!userData.dvm_name || userData.dvm_name === null || userData.dvm_name === '') {
                setNeedsWelcome(true);
            } else {
                setNeedsWelcome(false);
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

    // Listen for subscription updates from PlanSelection/ManageSubscription components
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
        return null;
    }

    // ================ NEW ONBOARDING FLOW ================
    // If onboardingData exists with in_progress status, this is a new user — show the new flow
    // Existing users have no onboarding row, so this is skipped entirely
    if (onboardingData && onboardingData.status === 'in_progress') {
        return <OnboardingFlow 
            onboardingData={onboardingData}
            userData={userData}
            refreshSubscription={checkSubscription}
            onComplete={() => {
                setOnboardingData(null);
                setHasAcceptedTerms(true);
                setHasCompletedOnboarding(true);
                setNeedsWelcome(false);
                checkSubscription(); // Refresh everything
            }}
        />;
    }

    // ================ LEGACY ONBOARDING (existing users only) ================
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

    // Terms accepted + DVM name set ⇒ straight into the app on the free tier.
    // (Old PlanSelection / WelcomeToPetwise / TrialEnded gates removed — access
    // is no longer plan-gated; usage caps are enforced per-feature instead.)

    // PWA install gate — mobile browser users must install to home screen
    // For legacy users who somehow end up here on mobile browser
    if (isMobile && process.env.NODE_ENV !== 'development') {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                             window.navigator.standalone === true;
        if (!isStandalone) {
            return <InstallPrompt />;
        }
    }

    // After onboarding, check if on mobile
    if (isMobile && !isLoading) {
        // Check if this is the admin route - allow access on mobile for admins
        const isAdminRoute = window.location.pathname.includes('/admin');
        if (isAdminRoute && user?.sub === process.env.REACT_APP_ADMIN_USER_ID) {
            // Allow admin access on mobile - return null so the admin route renders
            return null;
        }

        // QuickSOAP route — available to all users (free tier included)
        const isQuickSOAPRoute = window.location.pathname.includes('/quicksoap');
        if (isQuickSOAPRoute) {
            // Render QuickSOAP with mobile header and bottom nav
            return (
                <div className={mobileAppVisible ? 'pwa-fade-in' : 'opacity-0'}>
                    <style>{slideDownStyle}</style>
                    {/* Mobile Header */}
                    <div className="flex fixed top-0 left-0 right-0 h-16 bg-[#3369bd] items-center justify-between px-4 z-50 shadow-md">
                        <div className="text-white text-2xl font-inter flex items-center gap-2.5 tracking-wide">
                            <img src="/PW.png" alt="PW" className="w-8 h-8 object-contain" />
                            <span>
                                <span className="font-bold text-white">Petwise</span>
                                <span className="font-normal text-white">.vet</span>
                            </span>
                        </div>
                    </div>
                    {/* QuickSOAP Component */}
                    <div className="bg-[#3369bd]" style={{ paddingTop: '64px', paddingBottom: '64px', minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
                        <div style={{ height: 'calc(100vh - 128px)', overflow: 'hidden' }}>
                            <QuickSOAP />
                        </div>
                    </div>
                    {/* Bottom Navigation Bar */}
                    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                        <div className="flex items-center justify-around h-16">
                            <Link
                                to="/dashboard/quicksoap"
                                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${location.pathname === '/dashboard/quicksoap' ? 'text-primary-600' : 'text-gray-500'}`}
                            >
                                <FaMicrophone className={`text-2xl mb-1 ${location.pathname === '/dashboard/quicksoap' ? 'text-primary-600' : 'text-gray-500'}`} />
                                <span className="text-xs font-medium">QuickSOAP</span>
                            </Link>
                            {/* PetQuery hidden for now - keeping code
                            <Link
                                to="/dashboard/quick-query"
                                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${location.pathname === '/dashboard/quick-query' ? 'text-primary-600' : 'text-gray-500'}`}
                            >
                                <FaCommentMedical className={`text-2xl mb-1 ${location.pathname === '/dashboard/quick-query' ? 'text-primary-600' : 'text-gray-500'}`} />
                                <span className="text-xs font-medium">PetQuery</span>
                            </Link>
                            */}
                            <Link
                                to="/dashboard/profile"
                                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${location.pathname === '/dashboard/profile' ? 'text-primary-600' : 'text-gray-500'}`}
                            >
                                <FaUser className={`text-2xl mb-1 ${location.pathname === '/dashboard/profile' ? 'text-primary-600' : 'text-gray-500'}`} />
                                <span className="text-xs font-medium">Profile</span>
                            </Link>
                        </div>
                    </nav>
                </div>
            );
        }

        // PetQuery route — available to all users (free tier included)
        const isPetQueryRoute = window.location.pathname.includes('/quick-query');
        if (isPetQueryRoute) {
            // Render PetQuery with mobile header and bottom nav
            return (
                <div className={mobileAppVisible ? 'pwa-fade-in' : 'opacity-0'}>
                    <style>{slideDownStyle}</style>
                    {/* Mobile Header */}
                    <div className="flex fixed top-0 left-0 right-0 h-16 bg-[#3369bd] items-center justify-between px-4 z-50 shadow-md">
                        <div className="text-white text-2xl font-inter flex items-center gap-2.5 tracking-wide">
                            <img src="/PW.png" alt="PW" className="w-8 h-8 object-contain" />
                            <span>
                                <span className="font-bold text-white">Petwise</span>
                                <span className="font-normal text-white">.vet</span>
                            </span>
                        </div>
                    </div>
                    {/* PetQuery Component */}
                    <div className="bg-white flex flex-col overflow-hidden" style={{ paddingTop: '64px', paddingBottom: '64px', height: '100vh', touchAction: 'pan-y' }}>
                        <QuickQuery isMobile={true} />
                    </div>
                    {/* Bottom Navigation Bar */}
                    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                        <div className="flex items-center justify-around h-16">
                            <Link
                                to="/dashboard/quicksoap"
                                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${location.pathname === '/dashboard/quicksoap' ? 'text-primary-600' : 'text-gray-500'}`}
                            >
                                <FaMicrophone className={`text-2xl mb-1 ${location.pathname === '/dashboard/quicksoap' ? 'text-primary-600' : 'text-gray-500'}`} />
                                <span className="text-xs font-medium">QuickSOAP</span>
                            </Link>
                            {/* PetQuery hidden for now - keeping code
                            <Link
                                to="/dashboard/quick-query"
                                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${location.pathname === '/dashboard/quick-query' ? 'text-primary-600' : 'text-gray-500'}`}
                            >
                                <FaCommentMedical className={`text-2xl mb-1 ${location.pathname === '/dashboard/quick-query' ? 'text-primary-600' : 'text-gray-500'}`} />
                                <span className="text-xs font-medium">PetQuery</span>
                            </Link>
                            */}
                            <Link
                                to="/dashboard/profile"
                                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${location.pathname === '/dashboard/profile' ? 'text-primary-600' : 'text-gray-500'}`}
                            >
                                <FaUser className={`text-2xl mb-1 ${location.pathname === '/dashboard/profile' ? 'text-primary-600' : 'text-gray-500'}`} />
                                <span className="text-xs font-medium">Profile</span>
                            </Link>
                        </div>
                    </nav>
                </div>
            );
        }

        // Default mobile route — everyone lands on QuickSOAP
        if (!window.location.pathname.includes('/profile') && !window.location.pathname.includes('/quicksoap') && !window.location.pathname.includes('/quick-query')) {
            navigate('/dashboard/quicksoap', { replace: true });
            return null;
        }

        // If on profile route, allow it but hide sidebar and only show profile with bottom nav
        if (window.location.pathname.includes('/profile')) {
            return (
                <div className={mobileAppVisible ? 'pwa-fade-in' : 'opacity-0'}>
                    <style>{slideDownStyle}</style>
                    {/* Mobile Header */}
                    <div className="flex fixed top-0 left-0 right-0 h-16 bg-[#3369bd] items-center justify-between px-4 z-50 shadow-md">
                        <div className="text-white text-2xl font-inter flex items-center gap-2.5 tracking-wide">
                            <img src="/PW.png" alt="PW" className="w-8 h-8 object-contain" />
                            <span>
                                <span className="font-bold text-white">Petwise</span>
                                <span className="font-normal text-white">.vet</span>
                            </span>
                        </div>
                    </div>
                    <div className="min-h-screen bg-[#3369bd] p-0" style={{ paddingTop: '64px', paddingBottom: '64px' }}>
                        <Profile isMobileSignup={true} />
                    </div>
                    {/* Bottom Navigation Bar */}
                    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                        <div className="flex items-center justify-around h-16">
                            <Link
                                to="/dashboard/quicksoap"
                                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${location.pathname === '/dashboard/quicksoap' ? 'text-primary-600' : 'text-gray-500'}`}
                            >
                                <FaMicrophone className={`text-2xl mb-1 ${location.pathname === '/dashboard/quicksoap' ? 'text-primary-600' : 'text-gray-500'}`} />
                                <span className="text-xs font-medium">QuickSOAP</span>
                            </Link>
                            {/* PetQuery hidden for now - keeping code
                            <Link
                                to="/dashboard/quick-query"
                                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${location.pathname === '/dashboard/quick-query' ? 'text-primary-600' : 'text-gray-500'}`}
                            >
                                <FaCommentMedical className={`text-2xl mb-1 ${location.pathname === '/dashboard/quick-query' ? 'text-primary-600' : 'text-gray-500'}`} />
                                <span className="text-xs font-medium">PetQuery</span>
                            </Link>
                            */}
                            <Link
                                to="/dashboard/profile"
                                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${location.pathname === '/dashboard/profile' ? 'text-primary-600' : 'text-gray-500'}`}
                            >
                                <FaUser className={`text-2xl mb-1 ${location.pathname === '/dashboard/profile' ? 'text-primary-600' : 'text-gray-500'}`} />
                                <span className="text-xs font-medium">Profile</span>
                            </Link>
                        </div>
                    </nav>
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

    // Sidebar footer account popup (Profile / Usage / Billing / Log out).
    // positionClass positions it relative to whichever trigger opened it.
    const renderAccountMenu = (positionClass) => (
        <div className={`absolute ${positionClass} rounded-2xl bg-white shadow-[0_16px_48px_-8px_rgba(15,23,42,0.45)] border border-gray-100 overflow-hidden py-1.5 z-[70]`}>
            {[
                { Icon: FaUser, label: 'Profile', navState: undefined },
                { Icon: FaChartPie, label: 'Usage', navState: { scrollToUsage: true } },
                { Icon: FaCreditCard, label: 'Billing', navState: { openCheckout: true } },
            ].map(({ Icon, label, navState }) => (
                <button
                    key={label}
                    onClick={() => {
                        setShowAccountMenu(false);
                        closeMobileMenu();
                        navigate('/dashboard/profile', navState ? { state: navState } : undefined);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors bg-transparent border-none cursor-pointer text-left"
                >
                    <Icon className="text-[#3468bd] text-xs w-4 flex-shrink-0" />
                    {label}
                </button>
            ))}
            <button
                onClick={() => {
                    setShowAccountMenu(false);
                    closeMobileMenu();
                    setShowQRModal(true);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors bg-transparent border-none cursor-pointer text-left"
            >
                <FaMobile className="text-[#3468bd] text-xs w-4 flex-shrink-0" />
                Mobile App
            </button>
            <div className="h-px bg-gray-100 my-1" />
            <button
                onClick={() => {
                    setShowAccountMenu(false);
                    closeMobileMenu();
                    handleLogout();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors bg-transparent border-none cursor-pointer text-left"
            >
                <FaSignOutAlt className="text-xs w-4 flex-shrink-0" />
                Log out
            </button>
        </div>
    );

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
            {/* First-run tutorial — brand-new users only, shown once */}
            {showAppTour && (
                <AppTour
                    dvmName={userData?.dvm_name}
                    isMobile={isMobile}
                    onComplete={() => setShowAppTour(false)}
                />
            )}
            {/* Mobile app QR popup (from sidebar account menu) */}
            {showQRModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-[80] flex items-center justify-center p-4"
                    onClick={() => setShowQRModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Mobile App</h2>
                                <p className="text-[13px] text-gray-500 mt-0.5">Take PetWise into the exam room</p>
                            </div>
                            <button
                                onClick={() => setShowQRModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <FaTimes className="text-lg" />
                            </button>
                        </div>
                        <div className="flex flex-col items-center text-center">
                            <img src="/PW QR CODE.png" alt="PetWise Mobile App QR Code" className="w-52 h-52 rounded-2xl border border-gray-200 shadow-sm mb-4" />
                            <p className="text-[13px] text-gray-500 leading-relaxed max-w-xs">
                                Scan this code, or go to <span className="font-semibold text-[#3468bd]">petwise.vet</span> on your phone and log in.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex h-screen bg-white">
                {/* Mobile Header */}
                {window.innerWidth <= 768 && (
                    <>
                        <div className="flex fixed top-0 left-0 right-0 h-16 bg-[#3369bd] items-center justify-between px-4 z-50 shadow-md">
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
                <aside
                    className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 ${isMobileMenuOpen ? 'left-0' : 'left-[-250px]'} ${isSidebarCollapsed ? 'w-20 sidebar-collapsed' : 'w-56'} md:left-0`}
                    style={{
                        background: 'linear-gradient(180deg, #2d5fb8 0%, #1e4a94 50%, #183d7a 100%)',
                        boxShadow: '2px 0 20px rgba(30,74,148,0.15)',
                        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    }}
                >
                    {/* Logo Section */}
                    <div className="px-4 py-5 flex flex-col items-center justify-center relative" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <Link to="/dashboard" className={`text-white no-underline transition-colors duration-300 flex items-center text-xl gap-3 tracking-wide group ${isSidebarCollapsed ? 'justify-center' : 'justify-center'}`}>
                            <div className="relative">
                                <img src="/PW.png" alt="PW" className={`w-10 h-10 object-contain transition-transform duration-300 group-hover:scale-110 ${isSidebarCollapsed ? 'ml-1' : ''}`} />
                                {!isSidebarCollapsed && (
                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent-400 rounded-full animate-pulse" style={{ boxShadow: '0 0 6px rgba(92,204,240,0.5)' }}></div>
                                )}
                            </div>
                            <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
                                <span className="font-bold text-white" style={{ letterSpacing: '0.02em' }}>Petwise</span>
                                <span className="font-light text-white/70" style={{ letterSpacing: '0.02em' }}>.vet</span>
                            </span>
                        </Link>
                    </div>
                    {/* Navigation Menu (user info now lives in the footer below) */}
                    <ul className="list-none p-0 m-0 flex-1 mt-1">
                        {/* QuickSOAP */}
                        <li className="mx-3 my-0.5 relative">
                                    <Link
                                        to="/dashboard/quicksoap"
                                        onClick={closeMobileMenu}
                                        data-tooltip="QuickSOAP"
                                        data-tour="quicksoap"
                                        className={`flex items-center text-white/80 no-underline text-[13px] font-medium py-2 px-2.5 rounded-xl transition-all duration-200 w-full whitespace-nowrap group ${isSidebarCollapsed ? 'justify-center' : 'text-left'} ${location.pathname === '/dashboard/quicksoap' ? 'text-white' : 'hover:text-white'}`}
                                        style={location.pathname === '/dashboard/quicksoap' ? { background: 'rgba(255,255,255,0.12)' } : {}}
                                        onMouseEnter={(e) => { if (location.pathname !== '/dashboard/quicksoap') e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                                        onMouseLeave={(e) => { if (location.pathname !== '/dashboard/quicksoap') e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 relative`} style={{ background: location.pathname === '/dashboard/quicksoap' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)' }}>
                                            <FaMicrophone className="text-xs" />
                                            {/* Notification dot for pending dictations */}
                                            {hasPendingDictation && !isMobile && (
                                                <FaCircle className="absolute -top-1 -right-1 text-[#5cccf0] text-xs animate-pulse" style={{ fontSize: '8px' }} />
                                            )}
                                        </div>
                                        <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'} relative`}>
                                            QuickSOAP
                                            {/* Notification dot next to text when expanded */}
                                            {hasPendingDictation && !isMobile && !isSidebarCollapsed && (
                                                <FaCircle className="inline-block ml-2 text-[#5cccf0] text-xs animate-pulse" style={{ fontSize: '8px' }} />
                                            )}
                                        </span>
                                    </Link>
                                </li>
                                <li className="mx-3 my-0.5 relative">
                                    <Link
                                        to="/dashboard/quick-query"
                                        onClick={closeMobileMenu}
                                        data-tooltip="QuickMed Query"
                                        data-tour="petquery"
                                        className={`flex items-center text-white/80 no-underline text-[13px] font-medium py-2 px-2.5 rounded-xl transition-all duration-200 w-full whitespace-nowrap group ${isSidebarCollapsed ? 'justify-center' : 'text-left'} ${location.pathname === '/dashboard/quick-query' ? 'text-white' : 'hover:text-white'}`}
                                        style={location.pathname === '/dashboard/quick-query' ? { background: 'rgba(255,255,255,0.12)' } : {}}
                                        onMouseEnter={(e) => { if (location.pathname !== '/dashboard/quick-query') e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                                        onMouseLeave={(e) => { if (location.pathname !== '/dashboard/quick-query') e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200" style={{ background: location.pathname === '/dashboard/quick-query' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)' }}>
                                            <FaSearch className="text-xs" />
                                        </div>
                                        <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'}`}>PetQUERY</span>
                                    </Link>
                                </li>
                                <li className="mx-3 my-0.5 relative">
                                    <Link
                                        to="/dashboard/saved-reports"
                                        data-tooltip="Saved Reports"
                                        className={`flex items-center text-white/80 no-underline text-[13px] font-medium py-2 px-2.5 rounded-xl transition-all duration-200 w-full whitespace-nowrap group ${isSidebarCollapsed ? 'justify-center' : 'text-left'} ${location.pathname === '/dashboard/saved-reports' ? 'text-white' : 'hover:text-white'}`}
                                        style={location.pathname === '/dashboard/saved-reports' ? { background: 'rgba(255,255,255,0.12)' } : {}}
                                        onMouseEnter={(e) => { if (location.pathname !== '/dashboard/saved-reports') e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                                        onMouseLeave={(e) => { if (location.pathname !== '/dashboard/saved-reports') e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 relative" style={{ background: location.pathname === '/dashboard/saved-reports' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)' }}>
                                            <FaSave className="text-xs" />
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
                                <li className="mx-3 my-0.5 relative">
                                    <Link
                                        to="/dashboard/templates"
                                        data-tooltip="My Templates"
                                        className={`flex items-center text-white/80 no-underline text-[13px] font-medium py-2 px-2.5 rounded-xl transition-all duration-200 w-full whitespace-nowrap group ${isSidebarCollapsed ? 'justify-center' : 'text-left'} ${location.pathname === '/dashboard/templates' ? 'text-white' : 'hover:text-white'}`}
                                        style={location.pathname === '/dashboard/templates' ? { background: 'rgba(255,255,255,0.12)' } : {}}
                                        onMouseEnter={(e) => { if (location.pathname !== '/dashboard/templates') e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                                        onMouseLeave={(e) => { if (location.pathname !== '/dashboard/templates') e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200" style={{ background: location.pathname === '/dashboard/templates' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)' }}>
                                            <FaClipboard className="text-xs" />
                                        </div>
                                        <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'}`}>My Templates</span>
                                    </Link>
                                </li>
                        {subscriptionStatus === 'past_due' && (
                            <li className={`mx-3 my-1 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
                                <Link
                                    to="/dashboard/profile"
                                    className="flex items-center text-amber-200 no-underline font-medium rounded-xl p-2.5 transition-all duration-200 text-xs"
                                    style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.15)' }}
                                >
                                    <div className="w-6 h-6 rounded-md flex items-center justify-center mr-2" style={{ background: 'rgba(245,158,11,0.2)' }}>
                                        <span className="text-[10px]">💳</span>
                                    </div>
                                    <span className="text-[11px]">Payment needs attention</span>
                                </Link>
                            </li>
                        )}
                        <li className="mx-3 my-0.5 relative" style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <Link
                                to="/dashboard/report-form"
                                onClick={closeMobileMenu}
                                data-tooltip="Report Generator"
                                className={`flex items-center text-white/80 no-underline text-[13px] font-medium py-2 px-2.5 rounded-xl transition-all duration-200 w-full whitespace-nowrap group ${isSidebarCollapsed ? 'justify-center' : 'text-left'} ${location.pathname === '/dashboard/report-form' || location.pathname === '/dashboard' ? 'text-white' : 'hover:text-white'}`}
                                style={location.pathname === '/dashboard/report-form' || location.pathname === '/dashboard' ? { background: 'rgba(255,255,255,0.12)' } : {}}
                                onMouseEnter={(e) => { if (location.pathname !== '/dashboard/report-form' && location.pathname !== '/dashboard') e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                                onMouseLeave={(e) => { if (location.pathname !== '/dashboard/report-form' && location.pathname !== '/dashboard') e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200" style={{ background: location.pathname === '/dashboard/report-form' || location.pathname === '/dashboard' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)' }}>
                                    <FaFileAlt className="text-xs" />
                                </div>
                                <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'}`}>PetSOAP</span>
                            </Link>
                        </li>
                        <li className="mx-3 my-0.5 relative">
                            <Link
                                to="/dashboard/help"
                                onClick={closeMobileMenu}
                                data-tooltip="Help"
                                className={`flex items-center text-white/80 no-underline text-[13px] font-medium py-2 px-2.5 rounded-xl transition-all duration-200 w-full whitespace-nowrap group ${isSidebarCollapsed ? 'justify-center' : 'text-left'} ${location.pathname === '/dashboard/help' ? 'text-white' : 'hover:text-white'} relative`}
                                style={location.pathname === '/dashboard/help' ? { background: 'rgba(255,255,255,0.12)' } : {}}
                                onMouseEnter={(e) => { if (location.pathname !== '/dashboard/help') e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                                onMouseLeave={(e) => { if (location.pathname !== '/dashboard/help') e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200" style={{ background: location.pathname === '/dashboard/help' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)' }}>
                                    <FaQuestionCircle className="text-xs" />
                                </div>
                                <span className={`transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto ml-3'}`}>Help</span>
                                {!isSidebarCollapsed && (
                                    <span className="absolute top-1/2 -translate-y-1/2 right-2.5 text-[8px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(92,204,240,0.2)', color: '#5cccf0', letterSpacing: '0.05em' }}>NEW</span>
                                )}
                            </Link>
                        </li>
                    </ul>

                    {/* User Footer — name, plan, usage ring */}
                    <div className="mt-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        {isSidebarCollapsed ? (
                            <div className="flex flex-col items-center gap-2 py-3 relative" ref={accountMenuRef}>
                                <UsageRing usage={usage} size={36} onNavigate={closeMobileMenu} />
                                <button
                                    onClick={() => setShowAccountMenu((v) => !v)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-all cursor-pointer border-none"
                                    style={{ background: showAccountMenu ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)' }}
                                    data-tooltip="Account"
                                    aria-label="Account menu"
                                >
                                    <span className="flex flex-col items-center justify-center leading-none">
                                        <FaChevronUp className="text-[8px]" />
                                        <FaChevronDown className="text-[8px] mt-[1px]" />
                                    </span>
                                </button>
                                {showAccountMenu && renderAccountMenu('left-full bottom-0 ml-2 w-44')}
                            </div>
                        ) : (
                            <div className="mx-3 my-3 relative" ref={accountMenuRef}>
                                <div
                                    className="p-3 rounded-xl flex items-center gap-3 transition-colors duration-200"
                                    style={{ background: showAccountMenu ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.06)' }}
                                    onMouseEnter={(e) => { if (!showAccountMenu) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                                    onMouseLeave={(e) => { if (!showAccountMenu) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                                >
                                    <button
                                        onClick={() => setShowAccountMenu((v) => !v)}
                                        className="flex items-center gap-2 flex-1 min-w-0 bg-transparent border-none cursor-pointer text-left p-0"
                                        aria-label="Account menu"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white text-sm font-semibold truncate">
                                                {isStudentMode()
                                                    ? (userData?.nickname || 'Student')
                                                    : (userData?.dvm_name ? `Dr. ${userData.dvm_name}` : (user?.email || ''))}
                                            </div>
                                            <div className="text-white/50 text-[11px] mt-0.5 truncate">
                                                {isStudentMode()
                                                    ? `🎓 Student · until ${new Date(userData.subscription_end_date).toLocaleDateString()}`
                                                    : hasPaidPlan()
                                                        ? `${userData?.subscription_interval === 'yearly' ? 'Yearly' : 'Monthly'} plan`
                                                        : 'Free plan'}
                                            </div>
                                        </div>
                                        <span className={`flex flex-col items-center justify-center leading-none flex-shrink-0 transition-colors ${showAccountMenu ? 'text-white' : 'text-white/40'}`}>
                                            <FaChevronUp className="text-[8px]" />
                                            <FaChevronDown className="text-[8px] mt-[1px]" />
                                        </span>
                                    </button>
                                    <UsageRing usage={usage} size={40} onNavigate={closeMobileMenu} />
                                </div>
                                {showAccountMenu && renderAccountMenu('bottom-full left-0 right-0 mb-2')}
                            </div>
                        )}

                        {/* Toggle Button */}
                        <div className="flex justify-center py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <button
                                className="w-7 h-7 rounded-lg text-white/40 hover:text-white/70 text-[10px] flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
                                style={{ background: 'rgba(255,255,255,0.06)' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                onClick={toggleSidebar}
                                aria-label="Toggle Sidebar"
                            >
                                {isSidebarCollapsed ? '›' : '‹'}
                            </button>
                        </div>
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
                                        {(() => {
                                            const parts = [];
                                            if (mobileReportTypes.soap > 0) {
                                                parts.push(`${mobileReportTypes.soap} SOAP${mobileReportTypes.soap > 1 ? 's' : ''}`);
                                            }
                                            if (mobileReportTypes.summary > 0) {
                                                parts.push(`${mobileReportTypes.summary} Summary${mobileReportTypes.summary > 1 ? 's' : ''}`);
                                            }
                                            if (mobileReportTypes.callback > 0) {
                                                parts.push(`${mobileReportTypes.callback} Callback${mobileReportTypes.callback > 1 ? 's' : ''}`);
                                            }
                                            if (parts.length === 0) {
                                                return mobileReportsGenerating === 1 
                                                    ? '1 report generating from mobile'
                                                    : `${mobileReportsGenerating} reports generating from mobile`;
                                            }
                                            return `${parts.join(', ')} generating from mobile`;
                                        })()}
                                    </p>
                                    <p className="text-sm opacity-90">Will appear in Saved Records when complete</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mobile drafts parked by the daily free limit */}
                    {draftsWaitingForLimit > 0 && !isMobile && (
                        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-6 py-4 shadow-sm mb-4 mx-4 mt-4 rounded-xl flex items-center justify-between gap-4" style={{ animation: 'fadeUp 0.5s ease-out' }}>
                            <div className="flex items-center gap-3">
                                <FaMobile className="text-xl flex-shrink-0 text-amber-500" />
                                <div>
                                    <p className="font-semibold text-base">
                                        {draftsWaitingForLimit === 1
                                            ? '1 mobile dictation waiting'
                                            : `${draftsWaitingForLimit} mobile dictations waiting`}
                                        {' '}— you've finished today's free SOAP notes
                                    </p>
                                    <p className="text-sm opacity-80">
                                        Your dictations are saved. They'll generate automatically after your allowance resets at midnight
                                        {usage.hoursUntilReset ? ` (in ${usage.hoursUntilReset}h)` : ''}, or upgrade now for unlimited use.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => navigate('/dashboard/profile', { state: { openCheckout: true } })}
                                className="flex-shrink-0 px-4 py-2 bg-[#3468bd] text-white text-sm font-semibold rounded-lg hover:bg-[#2a5298] transition-colors whitespace-nowrap"
                            >
                                Upgrade
                            </button>
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
                        {/* All features are open to every authenticated user — free tier
                            caps are enforced per-generation, not at the route level. */}
                        <Route
                            path="/"
                            element={
                                <Navigate to={isMobile ? "/dashboard/profile" : "/dashboard/quicksoap"} replace />
                            }
                        />
                        <Route path="quick-query" element={<QuickQuery />} />
                        <Route path="quicksoap" element={<QuickSOAP />} />
                        <Route
                            path="report-form"
                            element={
                                <ReportForm
                                    subscriptionType={userData?.subscription_type}
                                    subscriptionStatus={subscriptionStatus}
                                />
                            }
                        />
                        <Route path="saved-reports" element={<SavedReports />} />
                        <Route path="templates" element={<Templates />} />
                        <Route path="profile" element={<Profile />} />
                        <Route path="help" element={<Help />} />
                    </Routes>
                </main>
            </div>
            {/* Book-a-demo nudge — disabled for now. Re-enable by uncommenting below.
                File at src/components/BookingBanner.js is kept in repo.
                {hasCompletedOnboarding
                    && userData?.subscription_status === 'active'
                    && userData?.subscription_interval === 'trial'
                    && <BookingBanner user={user} />}
            */}
        </>
    );
};

export default Dashboard;