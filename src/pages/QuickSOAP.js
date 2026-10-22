import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../supabaseClient';
import { FaMicrophone, FaStop, FaCopy, FaChevronDown, FaChevronUp, FaTimes, FaPause, FaPlay, FaDesktop, FaCheckCircle, FaPrint, FaClipboardList, FaFileAlt, FaPhoneAlt } from 'react-icons/fa';
import ChunkedRecorder from '../utils/chunkedRecorder';
import { pdf } from '@react-pdf/renderer';
import { Document, Page, Text, StyleSheet } from '@react-pdf/renderer';
import { AnimatePresence, motion } from 'framer-motion';
import { FiMic, FiPause, FiPlay, FiSquare, FiRefreshCw, FiSave, FiCopy, FiPrinter, FiChevronDown, FiEdit3, FiCheck, FiX, FiArrowRight, FiHelpCircle, FiSmartphone } from 'react-icons/fi';
import { useUsage, useTrialUpgradePrompt, notifyUsageUpdated, getBrowserTimezone } from '../hooks/useUsage';
import UpgradeNudge from '../components/UpgradeNudge';
import UpgradeModal from '../components/UpgradeModal';
import { useNavigate } from 'react-router-dom';
import {
    CASE_KEY,
    NEW_CASE_EVENT,
    NOTE_LABELS,
    NAME_LABELS,
    formatRecordWhen,
    NOTE_TYPE_KEY,
    SAVED_SNAPSHOT_KEY,
    ensureCase,
    getActiveCaseId,
    normalizeType,
    setActiveCaseId,
    takeNewCaseRequest
} from '../utils/cases';
import CaseTarget from '../components/CaseTarget';
import { CaseBar, CaseCreatedOverlay } from '../components/CaseBar';
import WaveBars, { RecordingStatus } from '../components/WaveBars';
import { BRAND_WASH, GRADIENT_TEXT, TYPE_STYLES, RECORD_TYPES } from '../components/caseStyles';
import GeneratingLoader from '../components/GeneratingLoader';
import Guide from '../components/Guide';
import DentalWorkspace from '../components/DentalWorkspace';
import RecordName from '../components/RecordName';
import DentalPDFDocument from '../components/DentalPDF';
import CountBadge from '../components/CountBadge';

const TEXT_RECORDS = {
    summary: { bar: 'from-emerald-500 to-emerald-600', icon: FaFileAlt, title: 'Clinical Summary', placeholder: 'Your clinical summary will appear here...' },
    callback: { bar: 'from-amber-500 to-amber-600', icon: FaPhoneAlt, title: 'Callback Notes', placeholder: 'Your callback notes will appear here...' }
};

const readStoredDental = () => {
    try {
        return JSON.parse(localStorage.getItem('quickSOAP_dental')) || null;
    } catch {
        return null;
    }
};

// PDF Document component for print/export
const QuickSOAPPDFDocument = ({ reportText, title }) => {
    const styles = StyleSheet.create({
        page: {
            padding: 40,
            fontSize: 12,
            fontFamily: 'Helvetica',
            lineHeight: 1.2
        },
        title: {
            fontSize: 16,
            fontFamily: 'Helvetica-Bold',
            marginBottom: 20
        },
        text: {
            marginBottom: 0,
            whiteSpace: 'pre-wrap',
            fontFamily: 'Helvetica'
        },
        strongText: {
            fontFamily: 'Helvetica-Bold',
            marginBottom: 0,
            fontSize: 12
        },
        lineBreak: {
            height: 8
        }
    });

    const renderContent = (content) => {
        if (!content) return null;
        const lines = content.split('\n');
        return lines.map((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                return <Text key={`break-${index}`} style={styles.lineBreak}>{'\n'}</Text>;
            }
            // Check for bold markers or section headers (lines ending with colon that are headers)
            const isBold = (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) ||
                (trimmedLine.endsWith(':') && /^(Subjective|Objective|Assessment|Plan|Problem List|Primary Diagnosis|Differential Diagnoses|Prognosis|Treatment|Monitoring|Client Communication|Follow-up|Follow-Up|Presenting Complaint|History|Owner Observations|Physical Exam|Vital Signs|Diagnostics):$/i.test(trimmedLine));

            if (isBold) {
                const cleanText = trimmedLine.replace(/^\*\*|\*\*$/g, '');
                return (
                    <Text key={index} style={styles.strongText}>
                        {cleanText}
                        {'\n'}
                    </Text>
                );
            }
            // Clean any remaining markdown from the line
            const cleanLine = line.replace(/\*\*/g, '').replace(/#{1,6}\s*/g, '');
            return (
                <Text key={index} style={styles.text}>
                    {cleanLine}
                    {'\n'}
                </Text>
            );
        });
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.title}>{title}</Text>
                {renderContent(reportText)}
            </Page>
        </Document>
    );
};

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

// Normalize spacing before headers (add blank line before headers ending with colon)
const normalizeHeaderSpacing = (content) => {
    if (!content) return content;

    const lines = content.split('\n');
    const normalized = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check if this line is a header (ends with colon and matches common header patterns)
        const isHeader = trimmed.endsWith(':') &&
            (trimmed.match(/^[A-Z][a-zA-Z\s]+:$/) ||
                /^(Problem List|Primary Diagnosis|Differential Diagnoses|Prognosis|Treatment|Client Communication|Follow-up|Follow-Up|Presenting Complaint|History|Skin & Coat|Diet\/Appetite|V\/D\/C\/S|Current Medication|Risk Factors|Additional Information|Owner Observations|Physical Exam|Vital Signs|Diagnostics|Assessment|Plan):$/i.test(trimmed));

        // If this is a header and not the first line, ensure there's a blank line before it
        if (isHeader && i > 0) {
            const prevLine = normalized[normalized.length - 1];
            // If previous line isn't blank, add a blank line
            if (prevLine && prevLine.trim() !== '') {
                normalized.push('');
            }
        }

        normalized.push(line);
    }

    return normalized.join('\n');
};

// Parse SOAP report and remove markdown formatting
const parseSOAPReport = (text) => {
    if (!text) return { sections: [] };

    // Remove markdown formatting
    let cleanText = text
        .replace(/\*\*/g, '') // Remove bold markers
        .replace(/#{1,6}\s*/g, '') // Remove headers
        .replace(/###\s*/g, '')
        .replace(/##\s*/g, '')
        .replace(/#\s*/g, '')
        .trim();

    const sections = [];
    const sectionNames = ['Subjective', 'Objective', 'Assessment', 'Plan'];

    // Try to find sections by name
    sectionNames.forEach(sectionName => {
        // Look for section header (case insensitive) - handle both "S - Subjective" and "Subjective:" formats
        const regex = new RegExp(`(?:^|\\n)\\s*(?:[SOAP]\\s*-\\s*)?${sectionName}:?\\s*\\n?`, 'gi');
        const match = cleanText.match(regex);

        if (match) {
            const startIndex = cleanText.search(regex);
            const sectionStart = startIndex + match[0].length;

            // Find the next section or end of text
            let sectionEnd = cleanText.length;
            for (let i = 0; i < sectionNames.length; i++) {
                if (sectionNames[i].toLowerCase() !== sectionName.toLowerCase()) {
                    const nextRegex = new RegExp(`(?:^|\\n)\\s*(?:[SOAP]\\s*-\\s*)?${sectionNames[i]}:?\\s*\\n?`, 'gi');
                    const nextMatch = cleanText.substring(sectionStart).search(nextRegex);
                    if (nextMatch !== -1) {
                        sectionEnd = sectionStart + nextMatch;
                        break;
                    }
                }
            }

            let content = cleanText.substring(sectionStart, sectionEnd).trim();
            // Normalize header spacing (only when parsing, not during user edits)
            if (content) {
                content = normalizeHeaderSpacing(content);
                sections.push({
                    name: sectionName,
                    content: content
                });
            }
        }
    });

    // If no sections found, try simpler parsing
    if (sections.length === 0) {
        const lines = cleanText.split('\n');
        let currentSection = null;
        let currentContent = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            const sectionMatch = sectionNames.find(name => {
                const lowerName = name.toLowerCase();
                return trimmed.toLowerCase().startsWith(lowerName + ':') ||
                    trimmed.toLowerCase() === lowerName ||
                    trimmed.toLowerCase().startsWith(lowerName.charAt(0) + ' –') ||
                    trimmed.toLowerCase().startsWith(lowerName.charAt(0) + ' -');
            });

            if (sectionMatch) {
                if (currentSection) {
                    let content = currentContent.join('\n').trim();
                    // Normalize header spacing (only when parsing, not during user edits)
                    content = normalizeHeaderSpacing(content);
                    sections.push({
                        name: currentSection,
                        content: content
                    });
                }
                currentSection = sectionMatch;
                currentContent = [];
            } else if (currentSection && trimmed) {
                currentContent.push(trimmed);
            }
        });

        if (currentSection) {
            let content = currentContent.join('\n').trim();
            // Normalize header spacing (only when parsing, not during user edits)
            content = normalizeHeaderSpacing(content);
            sections.push({
                name: currentSection,
                content: content
            });
        }
    }

    // Sort sections in SOAP order
    const sectionOrder = ['Subjective', 'Objective', 'Assessment', 'Plan'];
    sections.sort((a, b) => {
        const indexA = sectionOrder.indexOf(a.name);
        const indexB = sectionOrder.indexOf(b.name);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    return { sections, rawText: cleanText };
};


const QuickSOAP = () => {
    const { user, isAuthenticated } = useAuth0();
    const navigate = useNavigate();
    const [activeCaseId, setActiveCaseIdState] = useState(() => (typeof window !== 'undefined' ? getActiveCaseId() : null));
    const [caseAnnouncement, setCaseAnnouncement] = useState(null);
    const [caseBarKey, setCaseBarKey] = useState(0);
    const selectCase = useCallback((id) => {
        setActiveCaseId(id);
        setActiveCaseIdState(id);
    }, []);
    const [input, setInput] = useState(() => {
        // Initialize input synchronously from localStorage
        if (typeof window !== 'undefined') {
            const loadedInput = localStorage.getItem('quickSOAP_input');
            return loadedInput || '';
        }
        return '';
    });
    const [dictations, setDictations] = useState(() => {
        // Initialize dictations synchronously from localStorage
        if (typeof window !== 'undefined') {
            const loadedDictations = localStorage.getItem('quickSOAP_dictations');
            if (loadedDictations) {
                try {
                    return JSON.parse(loadedDictations);
                } catch (e) {
                    console.error('Failed to parse loaded dictations:', e);
                }
            }
        }
        return [];
    });
    const [report, setReport] = useState(() => {
        // Initialize report synchronously from localStorage
        if (typeof window !== 'undefined') {
            const loadedReport = localStorage.getItem('quickSOAP_report');
            return loadedReport || '';
        }
        return '';
    });
    const [parsedReport, setParsedReport] = useState(() => {
        // Initialize parsedReport synchronously from localStorage
        if (typeof window !== 'undefined') {
            const loadedReport = localStorage.getItem('quickSOAP_report');
            if (loadedReport) {
                return parseSOAPReport(loadedReport);
            }
        }
        return { sections: [], rawText: '' };
    });
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [needsSegmentation, setNeedsSegmentation] = useState(false);
    const [error, setError] = useState('');

    // Free-tier daily usage: show nothing below 80%, banner at 1 SOAP left,
    // upgrade screen at 0. Dismissal is keyed to the local date so it resets daily.
    const usage = useUsage();
    const trialPrompt = useTrialUpgradePrompt(usage);
    const [lastUsage, setLastUsage] = useState(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const nudgeKey = `quicksoap-nudge-dismissed-${new Date().toDateString()}`;
    const [nudgeDismissed, setNudgeDismissed] = useState(
        () => sessionStorage.getItem(nudgeKey) === 'true'
    );
    const soapRemaining = lastUsage
        ? Math.max(lastUsage.limit - lastUsage.used, 0)
        : usage.soap.remaining;
    const showNudge = usage.loaded && !usage.isUnlimited && !nudgeDismissed && soapRemaining === 1;

    // Drafts sent from the phone spend a SOAP when the desktop generates them, so they count against
    // today's allowance now. Kept in state: an await before getUserMedia breaks the mic prompt on iOS.
    const [queuedSoaps, setQueuedSoaps] = useState(0);
    const refreshQueuedSoaps = useCallback(async () => {
        if (usage.isUnlimited || !isAuthenticated) return setQueuedSoaps(0);
        const { count } = await supabase
            .from('saved_reports')
            .select('id', { count: 'exact', head: true })
            .is('report_text', null)
            .eq('form_data->>sent_to_desktop', 'true');
        setQueuedSoaps(count || 0);
    }, [usage.isUnlimited, isAuthenticated]);
    useEffect(() => { refreshQueuedSoaps(); }, [refreshQueuedSoaps, usage.soap.used]);
    const outOfSoaps = !usage.isUnlimited && usage.soap.remaining - queuedSoaps <= 0;
    const dismissNudge = () => {
        setNudgeDismissed(true);
        sessionStorage.setItem(nudgeKey, 'true');
    };
    const [lastInput, setLastInput] = useState(() => {
        // Initialize lastInput synchronously from localStorage
        if (typeof window !== 'undefined') {
            const loadedLastInput = localStorage.getItem('quickSOAP_lastInput');
            return loadedLastInput || '';
        }
        return '';
    });
    const [copiedSection, setCopiedSection] = useState(null);
    const [hasReport, setHasReport] = useState(() => {
        // Initialize hasReport synchronously based on report existence
        if (typeof window !== 'undefined') {
            const loadedReport = localStorage.getItem('quickSOAP_report');
            const loadedRecordType = localStorage.getItem('quickSOAP_recordType') || 'soap';
            if (loadedReport) {
                // For Summary/Callback, just check if report has content
                if (loadedRecordType !== 'soap') {
                    return loadedReport.trim().length > 0;
                }
                // For SOAP, check if sections were parsed
                const parsed = parseSOAPReport(loadedReport);
                return parsed.sections.length > 0;
            }
        }
        return false;
    });
    const [audioLevels, setAudioLevels] = useState([]);
    const waveLevels = (audioLevels.length ? audioLevels : new Array(20).fill(10)).map((l) => Math.max(0, (l - 10) / 90));
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [isReportTransitioning, setIsReportTransitioning] = useState(false);
    const [isLoadingFromSaved, setIsLoadingFromSaved] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('loadQuickSOAPData') === 'true';
    });
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessageVisible, setSaveMessageVisible] = useState(false);
    const [petName, setPetName] = useState(null);
    const [reportName, setReportName] = useState(() => {
        // Initialize reportName synchronously from localStorage
        if (typeof window !== 'undefined') {
            const savedReportName = localStorage.getItem('quickSOAP_reportName');
            return savedReportName || '';
        }
        return '';
    });
    const [showTutorial, setShowTutorial] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [isMobile, setIsMobile] = useState(() => {
        // Check on initial render - use device detection, not just width
        if (typeof window !== 'undefined') {
            // DEV ONLY: Allow forcing mobile view via localStorage
            const forceMobile = process.env.NODE_ENV === 'development' && localStorage.getItem('forceMobile') === 'true';

            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            const isMobileUserAgent = forceMobile || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
            return (isTouchDevice && isMobileUserAgent) || (isStandalone && window.innerWidth <= 1024);
        }
        return false;
    });
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        // Check sidebar collapse state on initial render (desktop only)
        if (typeof window !== 'undefined' && window.innerWidth > 768) {
            const sidebar = document.querySelector('aside');
            return sidebar?.classList.contains('sidebar-collapsed') || false;
        }
        return false;
    });
    const [draftRecordId, setDraftRecordId] = useState(null);
    const [lastDictationCount, setLastDictationCount] = useState(0);
    const [isSendingToDesktop, setIsSendingToDesktop] = useState(false);
    const [showSendSuccessModal, setShowSendSuccessModal] = useState(false);
    const [hasBeenSentToDesktop, setHasBeenSentToDesktop] = useState(false);
    const [showDeleteDictationModal, setShowDeleteDictationModal] = useState(false);
    const [dictationToDelete, setDictationToDelete] = useState(null);
    const [showStartNewModal, setShowStartNewModal] = useState(false);
    const [recordType, setRecordType] = useState(() => {
        // Initialize recordType synchronously from localStorage
        if (typeof window !== 'undefined') {
            const savedRecordType = localStorage.getItem('quickSOAP_recordType');
            return savedRecordType || 'soap';
        }
        return 'soap';
    });
    const [dental, setDental] = useState(() => (typeof window !== 'undefined' ? readStoredDental() : null));
    const pollingIntervalRef = useRef(null);

    // New chunked recording state
    const [chunkProgress, setChunkProgress] = useState(null);
    const [currentChunkTranscript, setCurrentChunkTranscript] = useState('');
    const chunkedRecorderRef = useRef(null);

    // Template system state
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('quickSOAP_selectedTemplate');
            if (saved) {
                try { return JSON.parse(saved); } catch (e) { return null; }
            }
        }
        return null;
    });
    const [showTemplateSelector, setShowTemplateSelector] = useState(false);
    const [templateSearchQuery, setTemplateSearchQuery] = useState('');

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const textareaRefs = useRef({});
    const inputTextareaRef = useRef(null);
    const sidebarInputTextareaRef = useRef(null);
    const draftRecordIdRef = useRef(null);
    const reportScrollContainerRef = useRef(null);
    const topBarRef = useRef(null);
    const [topBarHeight, setTopBarHeight] = useState(0);
    const topInputBarRef = useRef(null);
    const [, setShowStickyBar] = useState(false);
    const [showDictations, setShowDictations] = useState(false);
    const [showStartNotes, setShowStartNotes] = useState(false);
    const openTypedNotes = () => {
        setShowDictations(true);
        setTimeout(() => sidebarInputTextareaRef.current?.focus(), 340);
    };
    const [recordSeconds, setRecordSeconds] = useState(0);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);
    const streamRef = useRef(null);
    const isManualEditRef = useRef(false);

    // Auto-resize SOAP section textareas - prevent all automatic scrolling
    const adjustTextareaHeight = (index, textarea) => {
        if (!textarea) {
            textarea = textareaRefs.current[`section-${index}`];
        }
        if (!textarea) return;

        // Use cached scroll container ref or find it
        const scrollContainer = reportScrollContainerRef.current ||
            textarea.closest('.overflow-y-auto') ||
            document.querySelector('.fixed.top-0.right-0.bottom-0.overflow-y-auto');

        // Store scroll position BEFORE resize to prevent jumps
        const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : (window.pageYOffset || document.documentElement.scrollTop);

        // Resize the textarea
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;

        // Immediately restore scroll position synchronously
        if (scrollContainer) {
            scrollContainer.scrollTop = savedScrollTop;
        }

        // Restore again after browser processes layout (double protection)
        requestAnimationFrame(() => {
            if (scrollContainer) {
                scrollContainer.scrollTop = savedScrollTop;
            }
        });

        // One more time after a microtask to catch any delayed scrolls
        setTimeout(() => {
            if (scrollContainer) {
                scrollContainer.scrollTop = savedScrollTop;
            }
        }, 0);
    };

    // Auto-resize input textarea
    const adjustInputTextareaHeight = () => {
        const textarea = inputTextareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const newHeight = Math.min(Math.max(textarea.scrollHeight, 24), 120);
            textarea.style.height = `${newHeight}px`;
        }
    };

    // Auto-resize sidebar input textarea
    const adjustSidebarInputTextareaHeight = () => {
        const textarea = sidebarInputTextareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    };

    // Note: Additional notes textareas now use fixed scrollable heights (maxHeight: 200px)
    // so we don't auto-resize them anymore

    // One-time initial resize when sections are first created (not on every report change)
    useEffect(() => {
        if (parsedReport.sections.length > 0) {
            parsedReport.sections.forEach((_, index) => {
                const textarea = textareaRefs.current[`section-${index}`];
                if (textarea) {
                    adjustTextareaHeight(index, textarea);
                }
            });
        }
    }, [parsedReport.sections.length]);

    // Mobile detection - device-based, not width-based (won't change on rotation)
    useEffect(() => {
        const checkMobile = () => {
            // DEV ONLY: Allow forcing mobile view via localStorage
            const forceMobile = process.env.NODE_ENV === 'development' && localStorage.getItem('forceMobile') === 'true';

            // Only use user agent to avoid triggering on split-screen desktops
            // Don't use touch or width checks as touchscreen laptops would be falsely detected
            const isMobileUserAgent = forceMobile || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            setIsMobile(isMobileUserAgent);
        };
        checkMobile();
        // Don't listen to resize - we want device type, not window size
    }, []);

    // Handle visibility change (iOS/mobile backgrounding kills mic access)
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                console.log('[QuickSOAP] App became visible');

                // If we're recording (paused or active), check stream health
                if (isRecording && chunkedRecorderRef.current) {
                    const streamHealthy = chunkedRecorderRef.current.isStreamHealthy();
                    console.log('[QuickSOAP] Stream healthy after visibility change:', streamHealthy);

                    if (!streamHealthy && !isPaused) {
                        // Stream died while actively recording - warn user
                        console.warn('[QuickSOAP] Stream died while recording in background!');
                        setError('Recording may have been interrupted. Please stop and review your audio.');
                    }

                    // iOS: Resume audio context if suspended
                    if (audioContextRef.current?.state === 'suspended') {
                        try {
                            await audioContextRef.current.resume();
                            console.log('[QuickSOAP] AudioContext resumed after visibility change');
                        } catch (err) {
                            console.error('[QuickSOAP] Failed to resume AudioContext:', err);
                        }
                    }
                }
            } else {
                console.log('[QuickSOAP] App going to background');
                // On mobile, if recording, warn that mic may be interrupted
                if (isMobile && isRecording && !isPaused) {
                    console.warn('[QuickSOAP] Recording while going to background - mic may be interrupted');
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isRecording, isPaused, isMobile]);

    // Measure top bar height for desktop layout
    useEffect(() => {
        const el = topBarRef.current;
        if (!el || !hasReport || isMobile) { setTopBarHeight(0); return; }
        const ro = new ResizeObserver(() => setTopBarHeight(el.offsetHeight));
        ro.observe(el);
        return () => ro.disconnect();
    }, [hasReport, isMobile]);

    useEffect(() => {
        if (!isRecording) {
            setRecordSeconds(0);
            return undefined;
        }
        if (isPaused) return undefined;
        const t = setInterval(() => setRecordSeconds((n) => n + 1), 1000);
        return () => clearInterval(t);
    }, [isRecording, isPaused]);

    // Show sticky bar when top input bar scrolls out of view
    useEffect(() => {
        const el = topInputBarRef.current;
        const root = reportScrollContainerRef.current;
        if (!el || !root || !hasReport || isMobile) { setShowStickyBar(false); return; }
        const observer = new IntersectionObserver(
            ([entry]) => setShowStickyBar(!entry.isIntersecting),
            { root, threshold: 0 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasReport, isMobile]);

    // Watch for sidebar collapse state changes (desktop only)
    useEffect(() => {
        if (isMobile) return;

        const checkSidebarCollapse = () => {
            const sidebar = document.querySelector('aside');
            if (sidebar) {
                const collapsed = sidebar.classList.contains('sidebar-collapsed');
                setIsSidebarCollapsed(collapsed);
            }
        };

        // Check initially
        checkSidebarCollapse();

        // Watch for changes using MutationObserver
        const sidebar = document.querySelector('aside');
        if (sidebar) {
            const observer = new MutationObserver(checkSidebarCollapse);
            observer.observe(sidebar, {
                attributes: true,
                attributeFilter: ['class']
            });

            return () => observer.disconnect();
        }
    }, [isMobile]);

    // Check for tutorial flag from Help center
    useEffect(() => {
        const openTutorialFlag = localStorage.getItem('openQuickSOAPTutorial');
        if (openTutorialFlag === 'true') {
            setShowTutorial(true);
            localStorage.removeItem('openQuickSOAPTutorial');
        }
    }, []);

    // Fetch user templates for template selector
    useEffect(() => {
        const fetchTemplates = async () => {
            if (!user?.sub) return;
            try {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth0_user_id', user.sub)
                    .single();
                if (userError || !userData) return;

                const { data, error } = await supabase
                    .from('templates')
                    .select('id, template_name, template_text')
                    .eq('user_id', userData.id)
                    .order('created_at', { ascending: false });
                if (!error && data) setTemplates(data);
            } catch (err) {
                console.error('Failed to fetch templates:', err);
            }
        };
        fetchTemplates();
    }, [user?.sub]);

    // Persist selectedTemplate to localStorage
    useEffect(() => {
        if (selectedTemplate) {
            localStorage.setItem('quickSOAP_selectedTemplate', JSON.stringify(selectedTemplate));
        } else {
            localStorage.removeItem('quickSOAP_selectedTemplate');
        }
    }, [selectedTemplate]);

    // Load from localStorage on mount (only when loading from saved records)
    useEffect(() => {
        // Only handle loading from SavedReports - normal localStorage is already loaded synchronously
        const loadedQuickSOAPData = localStorage.getItem('loadQuickSOAPData');

        if (loadedQuickSOAPData === 'true') {
            // Loading from SavedReports - skip ungenerated view fade-out, go straight to blank then fade in generated report
            setIsLoadingFromSaved(true);

            const loadedDictations = localStorage.getItem('quickSOAP_dictations');
            const loadedInput = localStorage.getItem('quickSOAP_input');
            const loadedReport = localStorage.getItem('quickSOAP_report');
            const loadedLastInput = localStorage.getItem('quickSOAP_lastInput');
            const savedReportName = localStorage.getItem('quickSOAP_reportName');
            const savedRecordType = localStorage.getItem('quickSOAP_recordType');

            // Load record type - important for Summary/Callback records
            if (savedRecordType && savedRecordType !== recordType) {
                setRecordType(savedRecordType);
            }
            setDental(readStoredDental());

            // Only update if values are different (avoid unnecessary re-renders)
            if (loadedDictations) {
                try {
                    const parsed = JSON.parse(loadedDictations);
                    if (JSON.stringify(dictations) !== JSON.stringify(parsed)) {
                        setDictations(parsed);
                    }
                } catch (e) {
                    console.error('Failed to parse loaded dictations:', e);
                }
            }
            if (loadedInput && input !== loadedInput) {
                setInput(loadedInput);
            }
            if (loadedLastInput && lastInput !== loadedLastInput) {
                setLastInput(loadedLastInput);
            }
            if (loadedReport && report !== loadedReport) {
                setReport(loadedReport);
                const parsed = parseSOAPReport(loadedReport);
                if (JSON.stringify(parsedReport) !== JSON.stringify(parsed)) {
                    setParsedReport(parsed);
                }
                // For Summary/Callback, check if report has content (not sections)
                // For SOAP, check if sections were parsed
                const loadedType = savedRecordType || 'soap';
                if (!hasReport) {
                    if (loadedType !== 'soap') {
                        // Summary/Callback - just check if report has content
                        setHasReport(loadedReport.trim().length > 0);
                    } else if (parsed.sections.length > 0) {
                        setHasReport(true);
                    }
                }
            }
            if (savedReportName && reportName !== savedReportName) {
                setReportName(savedReportName);
            }

            // Fade in the generated report after a brief delay to allow smooth transition
            setTimeout(() => {
                setIsLoadingFromSaved(false);
            }, 50);

            // Keep currentQuickSOAPReportId for updates (set by handleLoadQuickSOAP)
            // Clear the load flag
            localStorage.removeItem('loadQuickSOAPData');
        }
        // Note: Normal localStorage persistence is handled synchronously in useState initializers
        // No need to reload here - state is already initialized correctly
    }, []);

    // Helper to clear all QuickSOAP state and localStorage (for fresh starts)
    const clearAllQuickSOAPData = useCallback(() => {
        // Clear state
        setDictations([]);
        setInput('');
        setLastInput('');
        setReport('');
        setParsedReport({ sections: [], rawText: '' });
        setHasReport(false);
        setReportName('');
        setPetName(null);
        setHasBeenSentToDesktop(false);
        setDraftRecordId(null);
        draftRecordIdRef.current = null;
        setLastDictationCount(0);
        setSelectedTemplate(null);
        setDental(null);

        // Clear localStorage
        localStorage.removeItem('quickSOAP_dictations');
        localStorage.removeItem('quickSOAP_input');
        localStorage.removeItem('quickSOAP_report');
        localStorage.removeItem('quickSOAP_lastInput');
        localStorage.removeItem('currentQuickSOAPReportId');
        localStorage.removeItem('quickSOAP_reportName');
        localStorage.removeItem('quickSOAP_selectedTemplate');
        localStorage.removeItem('quickSOAP_dental');
        localStorage.removeItem(CASE_KEY);
        localStorage.removeItem(NOTE_TYPE_KEY);
        localStorage.removeItem(SAVED_SNAPSHOT_KEY);
        setActiveCaseIdState(null);
    }, []);

    // Helper to load draft data into component state
    const loadDraftData = useCallback((draftData, skipIfSameDraft = false) => {
        if (!draftData.form_data) return;

        // Skip reloading if we're already on this draft (prevents glitchy reloads)
        if (skipIfSameDraft && draftRecordIdRef.current === draftData.id) {
            return;
        }

        // IMPORTANT: Clear existing data before loading new draft to prevent contamination
        // This ensures old dictations don't mix with new ones
        setDictations([]);
        setInput('');
        setLastInput('');
        localStorage.removeItem('quickSOAP_dictations');
        localStorage.removeItem('quickSOAP_input');
        localStorage.removeItem('quickSOAP_lastInput');

        const formData = draftData.form_data;
        if (formData.dictations) {
            setDictations(formData.dictations);
            setLastDictationCount(formData.dictations.length);
        }
        if (formData.input !== undefined) {
            setInput(formData.input);
        }
        if (formData.lastInput !== undefined) {
            setLastInput(formData.lastInput);
        }
        if (formData.reportName !== undefined) {
            setReportName(formData.reportName);
        }
        // Load record type from draft (soap, summary, callback)
        // Also check the top-level record_type from the database
        const draftRecordType = formData.record_type || draftData.record_type;
        if (draftRecordType) {
            // Normalize 'quicksoap' to 'soap' for the UI
            const normalizedType = draftRecordType === 'quicksoap' ? 'soap' : draftRecordType;
            setRecordType(normalizedType);
            localStorage.setItem('quickSOAP_recordType', normalizedType);
        }
        // Check if dictations have been sent to desktop (mobile only)
        if (isMobile && formData.sent_to_desktop === true) {
            setHasBeenSentToDesktop(true);
        }
        draftRecordIdRef.current = draftData.id;
        setDraftRecordId(draftData.id);
        localStorage.setItem('currentQuickSOAPReportId', draftData.id);
        localStorage.removeItem(NOTE_TYPE_KEY);
    }, [isMobile]);

    // Load draft dictations from Supabase (for desktop)
    // Only loads drafts that were explicitly sent from mobile (sent_to_desktop flag)
    const loadDraftDictations = useCallback(async () => {
        if (!isAuthenticated || !user || isMobile) return;

        try {
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('auth0_user_id', user.sub)
                .single();

            if (userError || !userData) {
                console.log('No user data found, skipping draft load');
                return;
            }

            const userId = userData.id;

            // Only load desktop-originated drafts on mount
            // Desktop should NOT auto-load mobile drafts - only when explicitly sent via checkForNewDictations
            // Check localStorage for existing desktop draft first
            const savedDraftId = localStorage.getItem('currentQuickSOAPReportId');
            if (savedDraftId && !hasReport) {
                const { data: savedDraft } = await supabase
                    .from('saved_reports')
                    .select('id, report_name, form_data')
                    .eq('id', savedDraftId)
                    .eq('user_id', userId)
                    .maybeSingle();

                // Only load if it's a desktop-created draft (sent_to_desktop is undefined = desktop origin)
                // Do NOT load mobile drafts (sent_to_desktop: false) - those need to be sent first
                // Do NOT load drafts that were sent from mobile - those are handled by checkForNewDictations polling
                if (savedDraft && savedDraft.form_data && !savedDraft.report_text) {
                    const isDesktopDraft = savedDraft.form_data.sent_to_desktop === undefined;

                    // Only load desktop-originated drafts on mount
                    // Mobile drafts (sent_to_desktop: false or true) are handled separately via polling
                    if (isDesktopDraft) {
                        loadDraftData(savedDraft);
                    } else {
                        // This is a mobile draft - clear localStorage so desktop doesn't try to load it
                        localStorage.removeItem('currentQuickSOAPReportId');
                        draftRecordIdRef.current = null;
                        setDraftRecordId(null);
                    }
                }
            }
        } catch (err) {
            console.error('Error loading draft dictations (non-critical):', err);
            // Don't throw - allow component to render even if draft load fails
        }
    }, [isAuthenticated, user, isMobile, hasReport, loadDraftData]);


    // Load mobile drafts on mount (mobile only - loads its own drafts, not desktop ones)
    const loadMobileDrafts = useCallback(async () => {
        if (!isAuthenticated || !user || !isMobile) return;

        // On mobile, prioritize localStorage - only load from Supabase if localStorage is empty
        // This ensures deleted dictations don't reappear
        const savedDictations = localStorage.getItem('quickSOAP_dictations');
        if (savedDictations) {
            // localStorage has dictations - use those instead of Supabase
            // This prevents deleted dictations from reloading
            return;
        }

        try {
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('auth0_user_id', user.sub)
                .single();

            if (userError || !userData) return;

            const userId = userData.id;

            // Only load from Supabase if localStorage is empty
            // Check localStorage first for draft ID
            const savedDraftId = localStorage.getItem('currentQuickSOAPReportId');
            if (savedDraftId) {
                const { data: savedDraft } = await supabase
                    .from('saved_reports')
                    .select('id, report_name, form_data')
                    .eq('id', savedDraftId)
                    .eq('user_id', userId)
                    .maybeSingle();

                // Only load if it's a mobile draft (sent_to_desktop is false/undefined, not true)
                if (savedDraft && savedDraft.form_data && !savedDraft.report_text) {
                    const isMobileDraft = savedDraft.form_data.sent_to_desktop !== true;
                    if (isMobileDraft) {
                        // Skip reload if we're already on this draft (prevents glitchy reloads)
                        loadDraftData(savedDraft, true);
                        return;
                    }
                }
            }

            // If no saved draft ID, try to find most recent mobile draft (any record type)
            const { data: allDrafts } = await supabase
                .from('saved_reports')
                .select('id, report_name, form_data, created_at, record_type')
                .eq('user_id', userId)
                .in('record_type', ['quicksoap', 'soap', 'summary', 'callback', 'dental'])
                .is('report_text', null)
                .order('created_at', { ascending: false })
                .limit(5);

            if (allDrafts && allDrafts.length > 0) {
                // Find most recent mobile draft (sent_to_desktop !== true)
                const mobileDraft = allDrafts.find(d =>
                    d.form_data && d.form_data.sent_to_desktop !== true
                );
                if (mobileDraft) {
                    // Skip reload if we're already on this draft (prevents glitchy reloads)
                    loadDraftData(mobileDraft, true);
                }
            }
        } catch (err) {
            console.error('Error loading mobile drafts:', err);
        }
    }, [isAuthenticated, user, isMobile, loadDraftData]);

    // Restore pending dictation banner on mount (desktop only)

    // Load draft dictations and set up polling (desktop only)
    useEffect(() => {
        if (!isAuthenticated || !user) return;

        if (isMobile) {
            // Mobile: Load its own drafts on mount
            loadMobileDrafts();
        } else {
            // Desktop: Load desktop drafts
            loadDraftDictations();
        }
    }, [isAuthenticated, user, isMobile, loadDraftDictations, loadMobileDrafts]);

    // Save reportName to localStorage
    useEffect(() => {
        if (reportName.trim()) {
            localStorage.setItem('quickSOAP_reportName', reportName);
        } else {
            localStorage.removeItem('quickSOAP_reportName');
        }
    }, [reportName]);

    // Save dictations to localStorage
    useEffect(() => {
        if (dictations.length > 0) {
            localStorage.setItem('quickSOAP_dictations', JSON.stringify(dictations));
        } else {
            localStorage.removeItem('quickSOAP_dictations');
        }
    }, [dictations]);

    // Save input to localStorage
    useEffect(() => {
        if (input.trim()) {
            localStorage.setItem('quickSOAP_input', input);
        } else {
            localStorage.removeItem('quickSOAP_input');
        }
    }, [input]);

    // Save report to localStorage
    useEffect(() => {
        if (report) {
            localStorage.setItem('quickSOAP_report', report);
        } else {
            localStorage.removeItem('quickSOAP_report');
        }
    }, [report]);

    // Save lastInput to localStorage
    useEffect(() => {
        if (lastInput) {
            localStorage.setItem('quickSOAP_lastInput', lastInput);
        } else {
            localStorage.removeItem('quickSOAP_lastInput');
        }
    }, [lastInput]);

    // Save recordType to localStorage
    useEffect(() => {
        localStorage.setItem('quickSOAP_recordType', recordType);
    }, [recordType]);

    useEffect(() => {
        if (dental) localStorage.setItem('quickSOAP_dental', JSON.stringify(dental));
        else localStorage.removeItem('quickSOAP_dental');
    }, [dental]);

    // Parse report when it changes (but skip if manually editing)
    useEffect(() => {
        if (isManualEditRef.current) {
            isManualEditRef.current = false;
            return;
        }

        if (report) {
            const parsed = parseSOAPReport(report);
            setParsedReport(parsed);
            // For Summary/Callback, hasReport should be true if report has content
            // For SOAP, check if sections were parsed
            setHasReport(recordType !== 'soap' ? report.trim().length > 0 : parsed.sections.length > 0);
        } else {
            setHasReport(false);
        }
    }, [report, recordType]);


    // Prevent body scrolling on mobile QuickSOAP
    useEffect(() => {
        if (isMobile) {
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            return () => {
                // Restore body scroll on unmount
                document.body.style.overflow = '';
                document.documentElement.style.overflow = '';
            };
        }
    }, [isMobile]);

    // Cleanup audio visualization on unmount
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                try {
                    audioContextRef.current.close().catch(() => {
                        // Already closing or closed
                    });
                } catch (err) {
                    // Already closed
                }
                audioContextRef.current = null;
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
    }, []);

    // Waveform visualization
    const visualizeAudio = () => {
        if (!analyserRef.current) return;

        const analyser = analyserRef.current;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        // Get average and create bars for waveform visualization
        const bars = 20; // Number of bars in waveform
        const step = Math.floor(dataArray.length / bars);
        const levels = [];

        for (let i = 0; i < bars; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) {
                sum += dataArray[i * step + j];
            }
            const average = sum / step;
            // Normalize to 0-100, with minimum threshold for visibility
            const normalized = (average / 255) * 100;
            levels.push(Math.max(10, Math.min(100, normalized)));
        }

        setAudioLevels(levels);
        animationFrameRef.current = requestAnimationFrame(visualizeAudio);
    };

    // NEW: Chunked recording system (replaces old single-blob recording)
    const startRecording = async () => {
        // Free-tier gate: no recording at all once today's SOAPs are used up or already queued —
        // otherwise mobile dictations pile up as drafts that can never generate.
        if (outOfSoaps) {
            setShowUpgradeModal(true);
            return;
        }

        try {
            console.log('[QuickSOAP] Starting chunked recording...');
            setError('');
            setChunkProgress({ chunkIndex: 0, status: 'starting', message: 'Starting recording...' });
            setCurrentChunkTranscript('');

            // Initialize ChunkedRecorder
            const recorder = new ChunkedRecorder({
                chunkDuration: 30000, // 30 seconds
                apiUrl: API_URL,
                onChunkReady: (blob, chunkIndex) => {
                    console.log(`Chunk ${chunkIndex + 1} ready, size: ${blob.size} bytes`);
                },
                onChunkTranscript: (transcript, chunkIndex) => {
                    console.log(`Chunk ${chunkIndex + 1} transcribed: ${transcript.substring(0, 50)}...`);
                    setCurrentChunkTranscript(prev => prev + ' ' + transcript);
                },
                onProgress: (progress) => {
                    setChunkProgress(progress);
                },
                onError: (err, chunkIndex) => {
                    console.error(`Chunk ${chunkIndex !== undefined ? chunkIndex + 1 : 'unknown'} error:`, err);
                    // Continue recording even if a chunk fails
                }
            });

            chunkedRecorderRef.current = recorder;

            // Get stream for visualization first
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Set up audio visualization
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(stream);

            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            microphone.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            // Start visualization
            setAudioLevels(new Array(20).fill(0));
            visualizeAudio();

            // Start chunked recording with existing stream
            await recorder.start(stream);
            setIsRecording(true);
            setIsPaused(false);  // Ensure pause state is reset
            setChunkProgress({ chunkIndex: 1, status: 'recording', message: 'Recording chunk 1...' });
            console.log('[QuickSOAP] Chunked recording started successfully');
        } catch (err) {
            console.error('[QuickSOAP] Error starting recording:', err);
            setError('Failed to access microphone. Please check permissions.');
            setChunkProgress(null);
        }
    };

    /* DEPRECATED — Old single-blob recording system (no longer used)
    const startRecording_OLD = async () => {
        try {
            setError('');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            // Set up audio visualization
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(stream);

            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            microphone.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            // Start visualization
            setAudioLevels(new Array(20).fill(0));
            visualizeAudio();

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // Stop visualization
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                    animationFrameRef.current = null;
                }
                if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                    try {
                        await audioContextRef.current.close();
                    } catch (err) {
                        console.log('AudioContext already closed or closing');
                    }
                    audioContextRef.current = null;
                }
                analyserRef.current = null;
                setAudioLevels([]);

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await transcribeAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error starting recording:', err);
            setError('Failed to access microphone. Please check permissions.');
        }
    };
    */

    // Pause/resume for chunked recording
    const pauseRecording = () => {
        if (chunkedRecorderRef.current && isRecording && !isPaused) {
            chunkedRecorderRef.current.pause();
            setIsPaused(true);

            // Stop visualization to save battery on mobile
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            setAudioLevels([]);

            console.log('[QuickSOAP] Recording paused');
        }
    };

    const resumeRecording = async () => {
        if (chunkedRecorderRef.current && isRecording && isPaused) {
            console.log('[QuickSOAP] Resuming recording...');

            try {
                const success = await chunkedRecorderRef.current.resume();

                if (success) {
                    // Check if stream was re-acquired (mobile scenario)
                    // Reconnect visualizer to new stream if needed
                    const newStream = chunkedRecorderRef.current.getStream();
                    if (newStream && newStream !== streamRef.current) {
                        console.log('[QuickSOAP] Stream was re-acquired, reconnecting visualizer...');

                        // Clean up old audio context
                        if (audioContextRef.current) {
                            try {
                                await audioContextRef.current.close();
                            } catch (err) {
                                // Already closed
                            }
                        }

                        // Set up new visualization with new stream
                        streamRef.current = newStream;
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const analyser = audioContext.createAnalyser();
                        const microphone = audioContext.createMediaStreamSource(newStream);

                        analyser.fftSize = 256;
                        microphone.connect(analyser);

                        audioContextRef.current = audioContext;
                        analyserRef.current = analyser;

                        // iOS: Resume audio context if suspended
                        if (audioContext.state === 'suspended') {
                            await audioContext.resume();
                        }

                        // Restart visualization
                        visualizeAudio();
                    } else {
                        // Stream wasn't re-acquired, but visualization was stopped on pause
                        // Resume AudioContext if suspended (iOS) and restart visualization
                        if (audioContextRef.current?.state === 'suspended') {
                            await audioContextRef.current.resume();
                        }
                        // Restart visualization (was stopped on pause)
                        visualizeAudio();
                    }

                    setIsPaused(false);
                    console.log('[QuickSOAP] Recording resumed successfully');
                } else {
                    console.error('[QuickSOAP] Resume failed');
                    setError('Failed to resume recording. Please stop and start a new recording.');
                }
            } catch (err) {
                console.error('[QuickSOAP] Error resuming recording:', err);
                setError('Failed to resume recording. Please stop and start a new recording.');
            }
        }
    };

    // NEW: Stop chunked recording and process final transcript
    const stopRecording = async () => {
        if (chunkedRecorderRef.current && isRecording) {
            console.log('[QuickSOAP] Stopping chunked recording...');
            setIsRecording(false);
            setIsPaused(false);
            setIsTranscribing(true); // Show transcribing loader immediately
            setError('');

            // Stop visualization
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                try {
                    audioContextRef.current.close().catch(() => {
                        // Already closing or closed
                    });
                } catch (err) {
                    // Already closed
                }
                audioContextRef.current = null;
            }
            analyserRef.current = null;
            setAudioLevels([]);

            // DO NOT stop stream tracks here - let chunkedRecorder handle it after tail chunk
            // The stream will be stopped by chunkedRecorder.finalizeWithTail() after tail chunk completes

            // Stop recorder and get merged transcript from streaming Whisper uploads
            setChunkProgress({ status: 'processing', message: 'Finishing transcription...' });
            try {
                // Wait for recorder to stop and all chunk transcripts to complete
                // Each chunk was sent to Whisper while recording - this just waits for completion
                const finalTranscript = await chunkedRecorderRef.current.stop();

                // Now safe to clear streamRef after chunkedRecorder has finished
                if (streamRef.current) {
                    streamRef.current = null;
                }

                if (!finalTranscript || finalTranscript.trim().length === 0) {
                    console.error('[QuickSOAP] No transcript generated');
                    setError('No speech detected. Please try recording again.');
                    setChunkProgress(null);
                    setIsTranscribing(false);
                    return;
                }

                console.log(`[QuickSOAP] Recording stopped, transcript: ${finalTranscript.length} chars`);

                // Send merged transcript to backend for cleanup only (Whisper already done)
                await processFinalTranscript(finalTranscript);
            } catch (err) {
                console.error('[QuickSOAP] Error stopping recording:', err);
                setError('Failed to process recording. Please try again.');
                setChunkProgress(null);
                setIsTranscribing(false);

                // Clean up stream on error
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }
            }
        }
    };

    /* DEPRECATED — Old stop recording (no longer used)
    const stopRecording_OLD = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
            // Stop visualization
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                try {
                    audioContextRef.current.close().catch(() => {
                        // Already closing or closed
                    });
                } catch (err) {
                    // Already closed
                }
                audioContextRef.current = null;
            }
            analyserRef.current = null;
            setAudioLevels([]);
        }
    };
    */

    // Process merged transcript through backend cleanup pipeline
    // Client handles: audio recording → Whisper chunk streaming (while recording)
    // Backend handles: cleanup + VetCorrector + summary generation
    // SOAP generation happens when user clicks "Generate SOAP" button
    // Note: isTranscribing is already set to true in stopRecording() before this is called
    const processFinalTranscript = async (transcript) => {
        console.log(`[QuickSOAP] Processing final transcript: ${transcript.length} chars`);
        setError('');

        try {
            const processStartTime = Date.now();
            setChunkProgress({ status: 'processing', message: 'Cleaning up transcript...' });

            // Send text-only to backend cleanup endpoint
            // (Whisper transcription already happened client-side during recording)
            const response = await axios.post(`${API_URL}/api/cleanup-transcript`, {
                transcript: transcript
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const processTime = Date.now() - processStartTime;
            console.log(`[QuickSOAP] Cleanup completed in ${processTime}ms`);

            if (response.data && response.data.correctedTranscript) {
                const correctedText = response.data.correctedTranscript;

                // Create dictation entry with generated summary (1-2 sentences) or fallback to first 100 chars
                const newDictation = {
                    id: Date.now(),
                    fullText: correctedText,
                    summary: response.data.summary || correctedText.substring(0, 100) + (correctedText.length > 100 ? '...' : ''),
                    expanded: false
                };

                setDictations(prev => {
                    const updated = [...prev, newDictation];
                    // Auto-save draft after transcription
                    if (isAuthenticated) {
                        saveDraftDictations(updated, input, correctedText);
                    }
                    return updated;
                });
                setLastInput(correctedText);
            } else {
                const errorMsg = response.data?.error || response.data?.detail || 'No transcript received from server';
                throw new Error(errorMsg);
            }
        } catch (err) {
            console.error('[QuickSOAP] Cleanup processing error:', err);
            if (err.response?.data) {
                const errorMsg = err.response.data.error || err.response.data.detail || 'Unknown error';
                console.error('[QuickSOAP] Server error details:', err.response.data);
                setError(`Cleanup failed: ${errorMsg}`);
            } else {
                setError('Failed to process transcript. Please try again.');
            }
        } finally {
            setIsTranscribing(false);
            setChunkProgress(null);
            setCurrentChunkTranscript('');
        }
    };

    /* DEPRECATED — Old transcription endpoint (no longer used with client-side chunking)
    const transcribeAudio = async (audioBlob) => {
        setIsTranscribing(true);
        setError('');

        // Check if segmentation is likely needed (file size > 8MB or estimate > 3 minutes)
        // WebM files are roughly 1-2MB per minute, so 8MB suggests ~4+ minutes
        const blobSizeMB = audioBlob.size / (1024 * 1024);
        const likelyNeedsSegmentation = blobSizeMB > 8;
        setNeedsSegmentation(likelyNeedsSegmentation);

        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            const response = await axios.post(`${API_URL}/api/transcribe`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.text) {
                const newDictation = {
                    id: Date.now(),
                    fullText: response.data.text,
                    summary: response.data.summary || response.data.text.substring(0, 100) + (response.data.text.length > 100 ? '...' : ''),
                    expanded: false
                };
                const newLastInput = response.data.text;
                setDictations(prev => {
                    const updated = [...prev, newDictation];
                    // Auto-save draft after transcription (especially important for mobile)
                    if (isAuthenticated) {
                        saveDraftDictations(updated, input, newLastInput);
                    }
                    return updated;
                });
                setLastInput(newLastInput);
            } else {
                throw new Error('No transcription received');
            }
        } catch (err) {
            console.error('Transcription error:', err);
            setError('Failed to transcribe audio. Please try again.');
        } finally {
            setIsTranscribing(false);
            setNeedsSegmentation(false);
        }
    };
    */

    // A different note type in the same case gets its own record instead of overwriting the
    // loaded one. Drafts (no type yet) are always filled in place.
    const noteIdForType = (noteId, typeToSave) => {
        const loadedType = localStorage.getItem(NOTE_TYPE_KEY);
        if (noteId && loadedType && normalizeType(loadedType) !== normalizeType(typeToSave)) return null;
        return noteId;
    };

    // Last saved text of the open note, keyed by note id so a different note gets a fresh baseline.
    const readSavedSnapshot = () => {
        try {
            return JSON.parse(localStorage.getItem(SAVED_SNAPSHOT_KEY));
        } catch {
            return null;
        }
    };
    const markSaved = (text) => {
        localStorage.setItem(
            SAVED_SNAPSHOT_KEY,
            JSON.stringify({ id: localStorage.getItem('currentQuickSOAPReportId'), text })
        );
    };

    useEffect(() => {
        if (!hasReport || !report) return;
        const snap = readSavedSnapshot();
        if (!snap || snap.id !== localStorage.getItem('currentQuickSOAPReportId')) markSaved(report);
    }, [hasReport, report]);

    // Chart edits save straight to the open note, debounced so a run of taps is one write.
    const dentalSaveRef = useRef(null);
    const handleDentalChange = (next) => {
        setDental(next);
        clearTimeout(dentalSaveRef.current);
        dentalSaveRef.current = setTimeout(async () => {
            const id = localStorage.getItem('currentQuickSOAPReportId');
            if (!id || !isAuthenticated) return;
            const { data } = await supabase.from('saved_reports').select('form_data').eq('id', id).maybeSingle();
            if (!data) return;
            const { error: saveError } = await supabase
                .from('saved_reports')
                .update({ form_data: { ...(data.form_data || {}), dental: next } })
                .eq('id', id);
            if (saveError) console.error('[QuickSOAP] Dental chart save failed:', saveError);
        }, 700);
    };

    const hasUnsavedWork = () => {
        if (hasReport) {
            const snap = readSavedSnapshot();
            return !!snap && snap.text !== report;
        }
        return dictations.length > 0 || !!input.trim();
    };

    // { kind: 'new', caseId } or { kind: 'back' }, waiting on the save prompt.
    const [pendingLeave, setPendingLeave] = useState(null);

    const leaveToCase = () => {
        const caseId = activeCaseId;
        clearAllQuickSOAPData();
        localStorage.removeItem('quickSOAP_recordType');
        navigate(caseId ? `/dashboard/cases/${caseId}` : '/dashboard/cases');
    };

    const startFreshCase = (caseId = null) => {
        clearAllQuickSOAPData();
        setShowStartNotes(false);
        setShowDictations(false);
        setError('');
        if (caseId) {
            setActiveCaseId(caseId);
            setActiveCaseIdState(caseId);
        }
    };

    // After a phone send: clear the screen but keep the case, so the next dictation joins it.
    const stayOnCase = () => {
        const caseId = activeCaseId;
        clearAllQuickSOAPData();
        if (caseId) selectCase(caseId);
    };

    const runLeave = (action) => {
        if (action.kind === 'back') leaveToCase();
        else startFreshCase(action.caseId);
    };

    const requestLeave = (action) => {
        if (isRecording || isTranscribing) {
            setError('Tap Done on your dictation first.');
            return;
        }
        if (action.kind === 'new' && action.caseId && !hasReport) {
            selectCase(action.caseId);
            return;
        }
        if (hasUnsavedWork()) setPendingLeave(action);
        else runLeave(action);
    };

    const requestLeaveRef = useRef(requestLeave);
    requestLeaveRef.current = requestLeave;
    useLayoutEffect(() => {
        const handle = () => {
            const req = takeNewCaseRequest();
            if (req) requestLeaveRef.current({ kind: 'new', caseId: req.caseId || null });
        };
        handle();
        window.addEventListener(NEW_CASE_EVENT, handle);
        return () => window.removeEventListener(NEW_CASE_EVENT, handle);
    }, []);

    // Auto-save helper function (extracted from handleSaveRecord)
    const autoSaveRecord = async (generatedReport, extractedPetName = null, saveRecordType = null, dentalData = null) => {
        if (!isAuthenticated || !user) return;

        // Use provided recordType or fall back to current state
        const typeToSave = saveRecordType || recordType || 'soap';

        try {
            // Get user's UUID from users table
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('auth0_user_id', user.sub)
                .single();

            if (userError || !userData) {
                console.error('User not found in Supabase for auto-save.');
                return;
            }

            const userId = userData.id;
            const loadedReportId = localStorage.getItem('currentQuickSOAPReportId');

            // Use extracted pet name if provided, otherwise use state
            // Handle empty strings by checking truthiness and trimming
            const petNameToUse = (extractedPetName && extractedPetName.trim()) || (petName && petName.trim()) || null;

            // Prepare form_data with record structure
            const formData = {
                record_type: typeToSave,
                dictations: dictations,
                input: input,
                report: generatedReport,
                lastInput: lastInput,
                petName: petNameToUse || null,
                ...(typeToSave === 'dental' && dentalData ? { dental: dentalData } : {}),
                auto_generated: true,
                generated_at: new Date().toISOString()
            };

            // Calculate report name with pet name if available
            const dateStr = formatRecordWhen();
            let finalReportName;
            const trimmedReportName = reportName.trim();
            const typeLabel = NAME_LABELS[typeToSave] || 'Record';

            // Always prioritize pet name when available (from parameter, not state)
            // This ensures we use the pet name even if reportName state hasn't updated yet
            if (petNameToUse) {
                finalReportName = `${petNameToUse} - ${typeLabel} - ${dateStr}`;
            } else if (trimmedReportName && !trimmedReportName.match(/^(QuickSOAP|Summary|Callback|Dental)/i)) {
                // If reportName is set and doesn't start with generic labels, use it
                finalReportName = trimmedReportName;
            } else if (trimmedReportName) {
                // If reportName is set but is generic, use it (user may have customized it)
                finalReportName = trimmedReportName;
            } else {
                // Default fallback
                finalReportName = `${typeLabel} - ${dateStr}`;
            }

            const caseId = await ensureCase(petNameToUse);
            setActiveCaseIdState(caseId);
            const reportIdToUse = noteIdForType(loadedReportId || draftRecordId, typeToSave);
            const bumpCaseBar = () => setCaseBarKey((k) => k + 1);

            if (reportIdToUse) {
                // Update existing report
                const { error: updateError } = await supabase
                    .from('saved_reports')
                    .update({
                        report_name: finalReportName,
                        report_text: generatedReport,
                        form_data: formData,
                        record_type: typeToSave,
                        case_id: caseId || undefined
                    })
                    .eq('id', reportIdToUse)
                    .eq('user_id', userId);

                if (updateError) {
                    console.error('Error auto-saving QuickSOAP record:', updateError);
                } else {
                    bumpCaseBar();
                    localStorage.setItem(NOTE_TYPE_KEY, typeToSave);
                    markSaved(generatedReport);
                    // Clear draft flag since it's now a completed report
                    draftRecordIdRef.current = null;
                    setDraftRecordId(null);
                    // Mark as unopened if it wasn't already opened
                    const unopenedReports = JSON.parse(localStorage.getItem('unopenedDesktopQuickSOAPReports') || '[]');
                    const viewedReports = JSON.parse(localStorage.getItem('viewedDesktopQuickSOAPReports') || '[]');
                    if (!viewedReports.includes(reportIdToUse) && !unopenedReports.includes(reportIdToUse)) {
                        unopenedReports.push(reportIdToUse);
                        localStorage.setItem('unopenedDesktopQuickSOAPReports', JSON.stringify(unopenedReports));
                        // Set notification flags in localStorage
                        localStorage.setItem('hasNewDesktopQuickSOAP', 'true');
                        localStorage.setItem('newDesktopQuickSOAPId', reportIdToUse);
                        // Dispatch event to notify SavedReports
                        window.dispatchEvent(new CustomEvent('newDesktopQuickSOAPGenerated', { detail: { reportId: reportIdToUse } }));
                    }
                }
            } else {
                // Create new report
                const { data: newReport, error: insertError } = await supabase
                    .from('saved_reports')
                    .insert([{
                        user_id: userId,
                        report_name: finalReportName,
                        report_text: generatedReport,
                        form_data: formData,
                        record_type: typeToSave,
                        case_id: caseId || undefined
                    }])
                    .select()
                    .single();

                if (insertError) {
                    console.error('Error auto-saving QuickSOAP record:', insertError);
                } else {
                    // Store the new report ID
                    bumpCaseBar();
                    localStorage.setItem('currentQuickSOAPReportId', newReport.id);
                    localStorage.setItem(NOTE_TYPE_KEY, typeToSave);
                    markSaved(generatedReport);
                    // Mark as unopened and trigger notification
                    const unopenedReports = JSON.parse(localStorage.getItem('unopenedDesktopQuickSOAPReports') || '[]');
                    if (!unopenedReports.includes(newReport.id)) {
                        unopenedReports.push(newReport.id);
                        localStorage.setItem('unopenedDesktopQuickSOAPReports', JSON.stringify(unopenedReports));
                        // Set notification flags in localStorage
                        localStorage.setItem('hasNewDesktopQuickSOAP', 'true');
                        localStorage.setItem('newDesktopQuickSOAPId', newReport.id);
                        // Dispatch event to notify SavedReports
                        window.dispatchEvent(new CustomEvent('newDesktopQuickSOAPGenerated', { detail: { reportId: newReport.id } }));
                    }
                }
            }
        } catch (err) {
            console.error('Error auto-saving QuickSOAP record:', err);
            // Don't show error to user for auto-save failures
        }
    };

    const handleGenerateSOAP = async () => {
        // Combine template (if any) + all dictations + manual input
        const templatePrefix = selectedTemplate ? `[TEMPLATE - Use as baseline for this record]\n${selectedTemplate.template_text}\n\n[DICTATION - Additional findings and observations]\n` : '';
        const allDictations = dictations.map(d => d.fullText || '').filter(text => text.trim()).join('\n\n');
        const combinedInput = templatePrefix + allDictations + (input.trim() ? '\n\n' + input.trim() : '');

        console.log('[QuickSOAP] Generate clicked:', {
            dictationsCount: dictations.length,
            allDictationsLength: allDictations.length,
            inputLength: input.length,
            combinedInputLength: combinedInput.length
        });

        if (!combinedInput.trim()) {
            setError('Please add at least one dictation or additional notes first.');
            console.log('[QuickSOAP] Rejected - empty combined input');
            return;
        }

        // Preemptive free-tier check — saves a wasted API round-trip at 0 left
        if (!usage.isUnlimited && usage.soap.remaining <= 0) {
            setShowUpgradeModal(true);
            return;
        }

        setIsGenerating(true);
        setError('');
        setLastInput(combinedInput);

        // If we're already showing a report, only transition the report section
        if (hasReport) {
            setIsReportTransitioning(true);
            setTimeout(async () => {
                try {
                    const response = await axios.post(`${API_URL}/api/generate-soap`, {
                        input: combinedInput.trim(),
                        user: user ? { sub: user.sub } : null,
                        recordType,
                        tz: getBrowserTimezone()
                    });

                    console.log('[QuickSOAP] Server response:', {
                        hasReport: !!response.data.report,
                        reportLength: response.data.report?.length || 0,
                        hasPetName: !!response.data.petName,
                        recordType: response.data.recordType
                    });

                    if (response.data.report) {
                        const generatedReport = response.data.report;
                        const extractedPetName = response.data.petName;
                        setLastUsage(response.data.usage || null);
                        notifyUsageUpdated();
                        setReport(generatedReport);
                        setDental(response.data.dental || null);
                        // Store pet name if extracted
                        if (extractedPetName) {
                            setPetName(extractedPetName);
                        }
                        // Set report name with pet name if available, otherwise use default
                        const typeLabel = NAME_LABELS[recordType] || 'Record';
                        if (!reportName) {
                            const dateStr = formatRecordWhen();
                            if (extractedPetName) {
                                setReportName(`${extractedPetName} - ${typeLabel} - ${dateStr}`);
                            } else {
                                setReportName(`${typeLabel} - ${dateStr}`);
                            }
                        } else if (extractedPetName && !reportName.includes(extractedPetName)) {
                            // Update existing report name if pet name was extracted and not already included
                            const dateStr = formatRecordWhen();
                            setReportName(`${extractedPetName} - ${typeLabel} - ${dateStr}`);
                            setPetName(extractedPetName);
                        }
                        // Auto-save after generation with pet name and record type
                        await autoSaveRecord(generatedReport, extractedPetName, recordType, response.data.dental);

                        // NOTE: Do NOT clear dictations here - user may want to regenerate
                        // with additional dictations or edited notes. Clearing only happens
                        // on explicit "Clear"/"Start New" or when loading a different record.

                        setTimeout(() => {
                            setIsReportTransitioning(false);
                        }, 100);
                    } else {
                        throw new Error('No report generated');
                    }
                } catch (err) {
                    console.error('SOAP generation error:', err);
                    if (err.response?.status === 403 && err.response?.data?.error === 'USAGE_LIMIT_REACHED') {
                        setShowUpgradeModal(true);
                    } else {
                        setError(err.response?.data?.error || 'Failed to generate SOAP report. Please try again.');
                    }
                    setIsReportTransitioning(false);
                } finally {
                    setIsGenerating(false);
                }
            }, 400);
        } else {
            // First time generation - transition from center to sidebar
            try {
                const response = await axios.post(`${API_URL}/api/generate-soap`, {
                    input: combinedInput.trim(),
                    user: user ? { sub: user.sub } : null,
                    recordType,
                    tz: getBrowserTimezone()
                });

                if (response.data.report) {
                    const generatedReport = response.data.report;
                    const extractedPetName = response.data.petName;
                    setLastUsage(response.data.usage || null);
                    notifyUsageUpdated();
                    const noteLabel = NOTE_LABELS[normalizeType(recordType)] || 'Record';
                    const announcement = isAuthenticated ? {
                        kind: activeCaseId ? 'added' : 'created',
                        title: `${extractedPetName || noteLabel} · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                        typeLabel: noteLabel === 'SOAP' ? 'SOAP' : noteLabel.toLowerCase()
                    } : null;
                    setCaseAnnouncement(announcement);
                    // Start transition - fade out loader smoothly
                    setIsTransitioning(true);

                    // Delay before showing report to allow loader fade (longer when announcing the case)
                    setTimeout(() => {
                        setReport(generatedReport);
                        setDental(response.data.dental || null);
                        // Store pet name if extracted
                        if (extractedPetName) {
                            setPetName(extractedPetName);
                        }
                        // Set report name with pet name if available, otherwise use default
                        const typeLabel = NAME_LABELS[recordType] || 'Record';
                        if (!reportName) {
                            const dateStr = formatRecordWhen();
                            if (extractedPetName) {
                                setReportName(`${extractedPetName} - ${typeLabel} - ${dateStr}`);
                            } else {
                                setReportName(`${typeLabel} - ${dateStr}`);
                            }
                        } else if (extractedPetName && !reportName.includes(extractedPetName)) {
                            // Update existing report name if pet name was extracted and not already included
                            const dateStr = formatRecordWhen();
                            setReportName(`${extractedPetName} - ${typeLabel} - ${dateStr}`);
                            setPetName(extractedPetName);
                        }
                        // Auto-save after generation with pet name and record type
                        autoSaveRecord(generatedReport, extractedPetName, recordType, response.data.dental);

                        // NOTE: Do NOT clear dictations here - user may want to regenerate
                        // with additional dictations or edited notes. Clearing only happens
                        // on explicit "Clear"/"Start New" or when loading a different record.

                        // Hide loader and fade in report smoothly
                        setIsGenerating(false);

                        // Fade in sidebar and report after a short delay
                        setTimeout(() => {
                            setIsTransitioning(false);
                            setCaseAnnouncement(null);
                        }, 100);
                    }, announcement ? 2400 : 300);
                } else {
                    throw new Error('No report generated');
                }
            } catch (err) {
                console.error('SOAP generation error:', err);
                if (err.response?.status === 403 && err.response?.data?.error === 'USAGE_LIMIT_REACHED') {
                    setShowUpgradeModal(true);
                } else {
                    setError(err.response?.data?.error || 'Failed to generate SOAP report. Please try again.');
                }
                setIsTransitioning(false);
                setIsGenerating(false);
                setCaseAnnouncement(null);
            }
        }
    };

    const handleClearReport = () => {
        // Transition out: sidebar and report fade out and slide away
        setIsTransitioning(true);
        setTimeout(() => {
            // Clear all state
            setReport('');
            setParsedReport({ sections: [], rawText: '' });
            setHasReport(false);
            setDictations([]);
            setInput('');
            setLastInput('');
            setReportName('');
            setHasBeenSentToDesktop(false);
            setPetName(null);
            setSelectedTemplate(null);
            // Clear draft record ID to prevent replacing old records
            setDraftRecordId(null);
            draftRecordIdRef.current = null;
            // Clear localStorage
            localStorage.removeItem('quickSOAP_dictations');
            localStorage.removeItem('quickSOAP_input');
            localStorage.removeItem('quickSOAP_report');
            localStorage.removeItem('quickSOAP_lastInput');
            localStorage.removeItem('currentQuickSOAPReportId');
            localStorage.removeItem('quickSOAP_reportName');
            localStorage.removeItem('quickSOAP_selectedTemplate');
            localStorage.removeItem(CASE_KEY);
            localStorage.removeItem(NOTE_TYPE_KEY);
            localStorage.removeItem(SAVED_SNAPSHOT_KEY);
            setActiveCaseIdState(null);
            // Transition back to center: fade in centered input
            setTimeout(() => {
                setIsTransitioning(false);
            }, 100);
        }, 400);
    };

    // Save draft dictations to localStorage only (not to Supabase - records only save when user clicks Save)
    const saveDraftDictations = async (dictationsToSave, inputToSave, lastInputToSave) => {
        // Only save to localStorage - do NOT save to Supabase until user explicitly clicks Save
        // This prevents blank draft records from appearing in Saved Records
        try {
            // Save to localStorage for persistence across sessions
            localStorage.setItem('quickSOAP_dictations', JSON.stringify(dictationsToSave));
            localStorage.setItem('quickSOAP_input', inputToSave);
            localStorage.setItem('quickSOAP_lastInput', lastInputToSave);
        } catch (err) {
            console.error('Error saving draft dictations to localStorage:', err);
        }
    };


    const handleSaveRecord = async () => {
        if (!isAuthenticated) {
            setError('Please log in to save the record.');
            return;
        }

        if (!report || !hasReport) {
            setError('Please generate a SOAP report before saving.');
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            // Get user's UUID from users table
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('auth0_user_id', user.sub)
                .single();

            if (userError || !userData) {
                throw new Error('User not found in Supabase.');
            }

            const userId = userData.id;
            const loadedReportId = localStorage.getItem('currentQuickSOAPReportId');

            // Get the current record type (soap, summary, or callback)
            const typeToSave = recordType || 'soap';
            const typeLabel = NAME_LABELS[typeToSave] || 'Record';

            // Prepare form_data with record structure
            // Desktop saves don't include sent_to_desktop flag (desktop origin)
            const formData = {
                record_type: typeToSave,
                dictations: dictations,
                input: input,
                report: report,
                lastInput: lastInput,
                petName: petName || null,
                ...(typeToSave === 'dental' && dental ? { dental } : {}),
                // Desktop saves don't have sent_to_desktop flag - this is desktop-originated
                sent_to_desktop: undefined
            };

            // Use reportName if set, otherwise prioritize pet name
            const dateStr = formatRecordWhen();
            let finalReportName;
            const trimmedReportName = reportName.trim();

            // If pet name exists and reportName doesn't include it, use pet name
            if (petName && (!trimmedReportName || !trimmedReportName.includes(petName))) {
                finalReportName = `${petName} - ${typeLabel} - ${dateStr}`;
            } else if (trimmedReportName) {
                // If reportName is set (and may already include pet name), use it
                finalReportName = trimmedReportName;
            } else if (petName) {
                // If pet name exists but no reportName, use pet name
                finalReportName = `${petName} - ${typeLabel} - ${dateStr}`;
            } else {
                // Default fallback
                finalReportName = `${typeLabel} - ${dateStr}`;
            }

            const caseId = await ensureCase(petName);
            setActiveCaseIdState(caseId);
            const reportIdToUse = noteIdForType(loadedReportId || draftRecordId, typeToSave);

            if (reportIdToUse) {
                // Update existing report (could be draft or completed)
                // Note: updated_at is automatically updated by database trigger
                const { error: updateError } = await supabase
                    .from('saved_reports')
                    .update({
                        report_name: finalReportName,
                        report_text: report, // Now has report - no longer a draft
                        form_data: formData,
                        record_type: typeToSave,
                        case_id: caseId || undefined
                    })
                    .eq('id', reportIdToUse)
                    .eq('user_id', userId);

                if (updateError) throw updateError;
                localStorage.setItem(NOTE_TYPE_KEY, typeToSave);

                // Clear draft flag since it's now a completed report
                draftRecordIdRef.current = null;
                setDraftRecordId(null);
            } else {
                // Create new report
                const { data: newReport, error: insertError } = await supabase
                    .from('saved_reports')
                    .insert([{
                        user_id: userId,
                        report_name: finalReportName,
                        report_text: report,
                        form_data: formData,
                        record_type: typeToSave,
                        case_id: caseId || undefined
                    }])
                    .select()
                    .single();

                if (insertError) throw insertError;

                // Store the new report ID
                localStorage.setItem('currentQuickSOAPReportId', newReport.id);
                localStorage.setItem(NOTE_TYPE_KEY, typeToSave);
            }

            markSaved(report);
            setSaveMessageVisible(true);
            setTimeout(() => setSaveMessageVisible(false), 2000);
            return true;
        } catch (err) {
            console.error('Error saving QuickSOAP record:', err);
            setError('Failed to save record. Please try again.');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const toggleDictationExpand = (id) => {
        setDictations(prev => prev.map(d =>
            d.id === id ? { ...d, expanded: !d.expanded } : d
        ));
    };

    const handleDeleteDictationClick = (id) => {
        setDictationToDelete(id);
        setShowDeleteDictationModal(true);
    };

    const removeDictation = async (id) => {
        const updatedDictations = dictations.filter(d => d.id !== id);
        setDictations(updatedDictations);

        // Update localStorage immediately
        if (updatedDictations.length === 0) {
            // Clear localStorage if no dictations left
            localStorage.removeItem('quickSOAP_dictations');
        } else {
            localStorage.setItem('quickSOAP_dictations', JSON.stringify(updatedDictations));
        }

        if (isAuthenticated && user) {
            if (isMobile && draftRecordId) {
                // On mobile: Delete the draft record entirely from Supabase
                // Mobile should be one dictation at a time, so deleting removes it completely
                // This ensures deleted dictations don't reappear on reload
                try {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('id')
                        .eq('auth0_user_id', user.sub)
                        .single();

                    if (userData) {
                        // Check if draft has been sent to desktop or is being processed before deleting
                        const { data: draftCheck } = await supabase
                            .from('saved_reports')
                            .select('form_data, report_text, created_at')
                            .eq('id', draftRecordId)
                            .eq('user_id', userData.id)
                            .maybeSingle();

                        if (!draftCheck) {
                            // Draft doesn't exist, nothing to delete
                            draftRecordIdRef.current = null;
                            setDraftRecordId(null);
                            localStorage.removeItem('currentQuickSOAPReportId');
                            return;
                        }

                        // Never delete if:
                        // 1. It was sent to desktop (sent_to_desktop: true)
                        // 2. It's already been processed (has report_text)
                        // 3. It was created recently (within last 5 minutes) - might be processing
                        const wasSentToDesktop = draftCheck.form_data?.sent_to_desktop === true;
                        const isProcessed = !!draftCheck.report_text;
                        const isRecent = draftCheck.created_at &&
                            (new Date() - new Date(draftCheck.created_at)) < 5 * 60 * 1000; // 5 minutes

                        if (wasSentToDesktop || isProcessed) {
                            // Draft was sent to desktop or already processed - don't delete
                            console.log('Draft was sent to desktop or processed, not deleting from database');
                            // Just clear local state
                            draftRecordIdRef.current = null;
                            setDraftRecordId(null);
                            localStorage.removeItem('currentQuickSOAPReportId');
                            return;
                        }

                        if (isRecent) {
                            // Recent draft - might be processing, be cautious
                            console.log('Draft is recent, checking if it was sent to desktop...');
                            // Wait a moment and check again
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            const { data: recheck } = await supabase
                                .from('saved_reports')
                                .select('form_data, report_text')
                                .eq('id', draftRecordId)
                                .eq('user_id', userData.id)
                                .maybeSingle();

                            if (recheck?.form_data?.sent_to_desktop || recheck?.report_text) {
                                console.log('Draft was sent to desktop after recheck, not deleting');
                                draftRecordIdRef.current = null;
                                setDraftRecordId(null);
                                localStorage.removeItem('currentQuickSOAPReportId');
                                return;
                            }
                        }

                        // Safe to delete - draft wasn't sent to desktop and isn't processed
                        await supabase
                            .from('saved_reports')
                            .delete()
                            .eq('id', draftRecordId)
                            .eq('user_id', userData.id);

                        // Clear the draft record ID
                        draftRecordIdRef.current = null;
                        setDraftRecordId(null);
                        localStorage.removeItem('currentQuickSOAPReportId');
                    }
                } catch (err) {
                    console.error('Error deleting mobile dictation from database:', err);
                }
            } else {
                // On desktop: Just update localStorage (don't save to Supabase until user clicks Save)
                saveDraftDictations(updatedDictations, input, lastInput).catch(err => {
                    console.error('Error saving dictation removal:', err);
                });
            }
        }
    };

    // Send to desktop directly (mobile only) - no confirmation modal
    const handleSendToDesktopClick = () => {
        if (!isAuthenticated || !user || !isMobile) return;
        // Free-tier gate: don't queue drafts the desktop can't generate today
        if (outOfSoaps) {
            setShowUpgradeModal(true);
            return;
        }
        sendToDesktop();
    };

    // Send dictations to desktop (mobile only)
    const sendToDesktop = async () => {
        if (!isAuthenticated || !user || !isMobile) return;

        setIsSendingToDesktop(true);
        try {
            // Get user's UUID from users table
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('auth0_user_id', user.sub)
                .single();

            if (userError || !userData) {
                console.error('Error fetching user for send to desktop:', userError);
                setIsSendingToDesktop(false);
                return;
            }

            const userId = userData.id;
            const typeLabel = NOTE_LABELS[recordType] || 'Record';
            const draftName = `${typeLabel} Draft - ${new Date().toLocaleDateString()}`;

            // Prepare form_data with sent_to_desktop flag
            const formData = {
                record_type: recordType,
                dictations: dictations,
                input: input,
                report: null,
                lastInput: lastInput,
                sent_to_desktop: true, // Mark as sent to desktop
                sent_to_desktop_at: new Date().toISOString() // Timestamp
            };

            const caseId = activeCaseId || await ensureCase(null);
            if (caseId) setActiveCaseIdState(caseId);

            // Always create a new record when sending to desktop
            // This allows users to send the same dictation multiple times
            // Each send creates a new record, so if something goes wrong, they can send again
            const { data: newDraft, error: insertError } = await supabase
                .from('saved_reports')
                .insert([{
                    user_id: userId,
                    report_name: draftName,
                    report_text: null,
                    form_data: formData,
                    record_type: recordType,
                    case_id: caseId || undefined
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Error creating draft for desktop:', insertError);
                setIsSendingToDesktop(false);
            } else if (newDraft) {
                // Update draftRecordId to the new record so mobile knows about it
                // But don't prevent future sends from creating new records
                draftRecordIdRef.current = newDraft.id;
                setDraftRecordId(newDraft.id);
                localStorage.setItem('currentQuickSOAPReportId', newDraft.id);
                setIsSendingToDesktop(false);
                setHasBeenSentToDesktop(true);
                setShowSendSuccessModal(true);
                refreshQueuedSoaps();
                // NOTE: Do NOT clear here - user may need to re-send if something fails
                // Clearing happens when SOAP generation starts (on desktop)
            }
        } catch (err) {
            console.error('Error sending to desktop:', err);
            setIsSendingToDesktop(false);
        }
    };

    const copySection = async (sectionName, content) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedSection(sectionName);
            setTimeout(() => setCopiedSection(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const copyAll = async () => {
        try {
            await navigator.clipboard.writeText(report);
            setCopiedSection('all');
            setTimeout(() => setCopiedSection(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handlePrint = async () => {
        try {
            const title = reportName || 'SOAP Report';
            const doc = recordType === 'dental'
                ? <DentalPDFDocument title={reportName || 'Dental record'} report={report} dental={dental} />
                : <QuickSOAPPDFDocument reportText={report} title={title} />;
            const blob = await pdf(doc).toBlob();
            const url = URL.createObjectURL(blob);

            // Open PDF in new window and print
            const printWindow = window.open(url, '_blank');
            printWindow.onload = () => {
                printWindow.print();
                // Cleanup after print dialog is closed
                printWindow.onafterprint = () => {
                    printWindow.close();
                    URL.revokeObjectURL(url);
                };
            };
        } catch (error) {
            console.error('Print error:', error);
        }
    };

    const getSectionColor = (sectionName) => {
        const name = sectionName.toLowerCase();
        if (name.includes('subjective')) return {
            border: '#3b82f6',
            header: 'bg-gradient-to-r from-blue-500 to-blue-600',
            bg: 'bg-blue-50',
            focusRing: '0 0 0 2px rgba(59,130,246,0.15)',
            copyHover: 'rgba(255,255,255,0.25)',
        };
        if (name.includes('objective')) return {
            border: '#10b981',
            header: 'bg-gradient-to-r from-emerald-500 to-emerald-600',
            bg: 'bg-emerald-50',
            focusRing: '0 0 0 2px rgba(16,185,129,0.15)',
            copyHover: 'rgba(255,255,255,0.25)',
        };
        if (name.includes('assessment')) return {
            border: '#f59e0b',
            header: 'bg-gradient-to-r from-amber-500 to-amber-600',
            bg: 'bg-amber-50',
            focusRing: '0 0 0 2px rgba(245,158,11,0.15)',
            copyHover: 'rgba(255,255,255,0.25)',
        };
        if (name.includes('plan')) return {
            border: '#ef4444',
            header: 'bg-gradient-to-r from-red-500 to-red-600',
            bg: 'bg-red-50',
            focusRing: '0 0 0 2px rgba(239,68,68,0.15)',
            copyHover: 'rgba(255,255,255,0.25)',
        };
        return {
            border: '#6b7280',
            header: 'bg-gradient-to-r from-gray-500 to-gray-600',
            bg: 'bg-gray-50',
            focusRing: '0 0 0 2px rgba(107,114,128,0.15)',
            copyHover: 'rgba(255,255,255,0.25)',
        };
    };

    const startCard = !hasReport && !isLoadingFromSaved && dictations.length === 0 && !isRecording && !isTranscribing;
    const dictCard = !hasReport && !isLoadingFromSaved && dictations.length > 0 && !isRecording && !isTranscribing;
    const CARD = `w-full ${isMobile ? 'max-w-[560px]' : 'max-w-[680px]'} mx-auto rounded-[28px] bg-white border border-[#e7ecf3] shadow-[0_30px_70px_-40px_rgba(19,35,63,0.35)]`;
    const MIC_BG = { background: 'linear-gradient(160deg,#3f7ad6 0%,#2d5fb8 45%,#2350a3 100%)' };

    const noteTypeControl = (
        <div className={`flex w-full gap-1 p-1 rounded-full ${isMobile ? 'bg-[#f3f6fa]' : 'bg-[#eef2f8] border border-[#e3e9f2]'}`}>
            {RECORD_TYPES.map((t) => {
                const s = TYPE_STYLES[t];
                const Icon = s.icon;
                const on = recordType === t;
                return (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setRecordType(t)}
                        className={`relative flex-1 rounded-full font-semibold border-none cursor-pointer bg-transparent transition-colors ${isMobile ? 'h-9 text-[12.5px]' : 'h-10 text-[14.5px] font-display tracking-[-0.01em]'} ${on ? 'text-white' : 'text-[#1a2b4a]/60 hover:text-[#13233f]'}`}
                    >
                        {on && (
                            <motion.span
                                layoutId="start-note-type"
                                className={`absolute inset-0 rounded-full ${s.solid} shadow-sm`}
                                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                            />
                        )}
                        <span className="relative inline-flex items-center justify-center gap-1.5">
                            <Icon className="text-[13px]" /> {s.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );

    const SECTION_LABEL = 'm-0 mb-3 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#1a2b4a]/45';

    return (
        <>
            <CaseCreatedOverlay announcement={caseAnnouncement} />
            <style>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
                @keyframes slideUpScale {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>


            {/* Free-tier out-of-usage upgrade screen */}
            <AnimatePresence>
                {(showUpgradeModal || trialPrompt.show) && (
                    <UpgradeModal
                        user={user}
                        feature="soap"
                        reason={trialPrompt.show ? trialPrompt.reason : 'limit'}
                        resetsAt={lastUsage?.resetsAt || usage.resetsAt}
                        onClose={() => {
                            setShowUpgradeModal(false);
                            trialPrompt.dismiss();
                        }}
                        onSubscribed={() => usage.refresh()}
                    />
                )}
            </AnimatePresence>

            {/* Save Prompt Modal (Desktop - when loading new dictation with report open) */}

            {/* Success Modal (Send to Desktop) */}
            <AnimatePresence>
                {showSendSuccessModal && (
                    <motion.div
                        key="sent"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-[#13233f]/30 backdrop-blur-sm"
                        style={{ left: isMobile ? '0' : (isSidebarCollapsed ? '80px' : '224px') }}
                        onClick={() => setShowSendSuccessModal(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 14, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-[400px] bg-white rounded-[28px] px-6 pt-8 pb-6 text-center shadow-[0_30px_80px_-30px_rgba(19,35,63,0.45)]"
                        >
                            <motion.span
                                className="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-white text-[22px] shadow-[0_14px_34px_-12px_rgba(45,95,184,0.8)]"
                                style={MIC_BG}
                                initial={{ scale: 0.4, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.06 }}
                            >
                                <FiCheck />
                            </motion.span>
                            <h3 className={`mt-4 mb-0 pb-0.5 text-[24px] font-bold tracking-[-0.02em] ${GRADIENT_TEXT}`}>Sent to your desktop</h3>
                            <p className="mt-2 mb-0 text-[14.5px] leading-relaxed text-[#1a2b4a]/60">
                                Your record will be waiting in <span className="font-semibold text-[#13233f]">Cases</span> in a minute or two.
                            </p>
                            <div className="mt-6 flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSendSuccessModal(false);
                                        clearAllQuickSOAPData();
                                    }}
                                    className="w-full h-12 rounded-full text-[15px] font-semibold text-white bg-[#2d5fb8] hover:bg-[#2350a3] border-none cursor-pointer shadow-[0_10px_30px_-12px_rgba(45,95,184,0.7)] transition-colors flex items-center justify-center gap-2"
                                >
                                    <FiMic /> Start a new case
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSendSuccessModal(false);
                                        stayOnCase();
                                    }}
                                    className="w-full h-12 rounded-full text-[15px] font-semibold text-[#13233f] bg-[#f6f8fb] hover:bg-[#eef2f7] border-none cursor-pointer transition-colors"
                                >
                                    Add another record to this case
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Dictation Confirmation Modal */}
            {showDeleteDictationModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50" style={{ left: isMobile ? '0' : (isSidebarCollapsed ? '80px' : '224px') }}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 animate-fadeIn">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">Delete Dictation</h3>
                            <button
                                onClick={() => {
                                    setShowDeleteDictationModal(false);
                                    setDictationToDelete(null);
                                }}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <FaTimes className="text-lg" />
                            </button>
                        </div>
                        <div className="mb-6">
                            <p className="text-gray-700 mb-3">
                                {isMobile
                                    ? "If you haven't sent this to desktop it will not be saved."
                                    : "If you haven't generated this it will not be saved."
                                }
                            </p>
                            <p className="text-gray-600 font-medium">
                                Are you sure you want to remove this dictation?
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteDictationModal(false);
                                    setDictationToDelete(null);
                                }}
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (dictationToDelete) {
                                        removeDictation(dictationToDelete);
                                    }
                                    setShowDeleteDictationModal(false);
                                    setDictationToDelete(null);
                                }}
                                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {pendingLeave && (
                    <motion.div
                        key="leave-prompt"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 z-[120] flex items-center justify-center px-4 bg-[#13233f]/30 backdrop-blur-sm"
                        onClick={() => !isSaving && setPendingLeave(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 12, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-[440px] bg-white rounded-[24px] p-6 shadow-[0_30px_80px_-30px_rgba(19,35,63,0.45)]"
                        >
                            <h3 className={`m-0 pb-0.5 text-[22px] font-bold tracking-[-0.02em] ${GRADIENT_TEXT}`}>
                                {hasReport ? 'Save your changes?' : 'Discard this dictation?'}
                            </h3>
                            <p className="mt-2 mb-6 text-[14.5px] leading-relaxed text-[#1a2b4a]/65">
                                {hasReport
                                    ? "You've edited this record since it was last saved. If you leave now those edits will be lost."
                                    : "Your dictation hasn't been turned into a record yet. Leaving will clear it."}
                            </p>
                            <div className="flex flex-wrap justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPendingLeave(null)}
                                    disabled={isSaving}
                                    className="h-10 px-4 rounded-full text-[14px] font-semibold text-[#1a2b4a]/70 bg-transparent border-none hover:bg-[#f6f8fb] cursor-pointer transition-colors disabled:opacity-50"
                                >
                                    Keep editing
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const action = pendingLeave;
                                        setPendingLeave(null);
                                        runLeave(action);
                                    }}
                                    disabled={isSaving}
                                    className="h-10 px-4 rounded-full text-[14px] font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 cursor-pointer transition-colors disabled:opacity-50"
                                >
                                    Discard
                                </button>
                                {hasReport && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const action = pendingLeave;
                                            const ok = await handleSaveRecord();
                                            if (!ok) return;
                                            setPendingLeave(null);
                                            runLeave(action);
                                        }}
                                        disabled={isSaving}
                                        className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-[14px] font-semibold text-white bg-[#2d5fb8] hover:bg-[#2350a3] border-none cursor-pointer shadow-[0_10px_30px_-12px_rgba(45,95,184,0.7)] transition-colors disabled:opacity-60"
                                    >
                                        {isSaving ? (
                                            <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                                        ) : (
                                            <FiSave className="text-[14px]" />
                                        )}
                                        {pendingLeave.kind === 'back' ? 'Save and go back' : 'Save and start new'}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Start New Confirmation Modal (Mobile only) */}
            <AnimatePresence>
                {showStartNewModal && isMobile && (
                    <motion.div
                        key="start-new"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 z-[100] flex items-end justify-center px-3 pb-3 bg-[#13233f]/30 backdrop-blur-sm"
                        onClick={() => setShowStartNewModal(false)}
                    >
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 40, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md bg-white rounded-[28px] p-6 shadow-[0_30px_80px_-30px_rgba(19,35,63,0.45)]"
                        >
                            <h3 className={`m-0 pb-0.5 text-[22px] font-bold tracking-[-0.02em] ${GRADIENT_TEXT}`}>
                                {hasBeenSentToDesktop ? 'Start a new case?' : 'Discard this dictation?'}
                            </h3>
                            <p className="mt-2 mb-6 text-[14.5px] leading-relaxed text-[#1a2b4a]/60">
                                {hasBeenSentToDesktop
                                    ? 'This one is already on your desktop. Clear the screen and start the next visit.'
                                    : 'It hasn’t been sent to your desktop yet, so starting new will delete it.'}
                            </p>
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        clearAllQuickSOAPData();
                                        setShowStartNewModal(false);
                                    }}
                                    className={`w-full h-12 rounded-full text-[15px] font-semibold border-none cursor-pointer transition-colors ${hasBeenSentToDesktop
                                        ? 'text-white bg-[#2d5fb8] hover:bg-[#2350a3] shadow-[0_10px_30px_-12px_rgba(45,95,184,0.7)]'
                                        : 'text-white bg-red-500 hover:bg-red-600'}`}
                                >
                                    {hasBeenSentToDesktop ? 'Start new case' : 'Discard and start new'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowStartNewModal(false)}
                                    className="w-full h-12 rounded-full text-[15px] font-semibold text-[#13233f] bg-[#f6f8fb] hover:bg-[#eef2f7] border-none cursor-pointer transition-colors"
                                >
                                    Keep it
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Fullscreen Animated Loader - Desktop Only */}
            {isGenerating && !isMobile && !hasReport && (
                <GeneratingLoader recordType={recordType} left={isSidebarCollapsed ? '80px' : '224px'} />
            )}

            <div className={`${isMobile ? 'h-full overflow-hidden' : 'min-h-screen overflow-hidden'} bg-gradient-to-br from-gray-50 via-white to-gray-50 flex relative w-full ${isGenerating && !isMobile && !hasReport ? 'invisible' : ''}`} style={isMobile ? { height: '100%', minHeight: '100%', overflow: 'hidden' } : {}}>
                {/* Left Side - Input Area (top bar when report exists on desktop) */}
                <div
                    ref={hasReport && !isMobile ? topBarRef : undefined}
                    className={isMobile ? 'relative w-full h-full z-40 overflow-hidden' : 'fixed z-40'}
                    style={{
                        ...(isMobile ? { height: '100%', overflow: 'hidden' } : {}),
                        ...(hasReport && !isMobile ? {
                            display: 'none',
                        } : hasReport && isMobile ? {
                            left: '0',
                            width: '100%',
                            backgroundColor: 'white',
                            opacity: isTransitioning ? 0 : 1,
                            transform: isTransitioning ? 'translateX(-150px)' : 'translateX(0)',
                            transition: 'opacity 0.4s ease-in-out, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                        } : {
                            left: isMobile ? '0' : (isSidebarCollapsed ? '80px' : '224px'),
                            width: isMobile ? '100%' : (isSidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 224px)'),
                            top: '0',
                            bottom: '0',
                            backgroundColor: 'transparent',
                            opacity: isTransitioning ? 0 : 1,
                            transform: isTransitioning ? 'scale(0.95)' : 'scale(1)',
                            transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out, left 0.3s ease-in-out, width 0.3s ease-in-out'
                        })
                    }}
                >
                    {!hasReport && !isLoadingFromSaved ? (
                        // Centered floating input before report generation
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
                            className={`h-full flex flex-col items-center ${isMobile
                            ? (dictations.length === 0 || isRecording
                                ? 'justify-center px-4'
                                : 'justify-start px-4 pt-6 pb-6 overflow-hidden')
                            : 'relative justify-start px-8 py-12 overflow-y-auto [&>*:first-child]:mt-auto [&>*:last-child]:mb-auto'
                            }`}>
                            {/* Header */}
                            {(!isRecording || !isMobile) && (
                                <div className={`${isMobile ? 'mb-5' : 'mb-8'} text-center relative flex-shrink-0 w-full flex flex-col items-center`}>
                                    <div className="relative">
                                        <h1 className={`m-0 ${isMobile ? (dictations.length ? 'text-[1.6rem]' : 'text-[2rem]') : 'text-[2.75rem]'} leading-[1.1] pb-1 font-bold tracking-[-0.03em] ${GRADIENT_TEXT}`}>
                                            {activeCaseId ? 'Add a record' : 'Start a new case'}
                                        </h1>
                                        {isMobile ? (
                                            <button type="button" onClick={() => setShowTutorial(true)} title="How it works" className="absolute left-full top-1/2 -translate-y-1/2 ml-1.5 w-8 h-8 rounded-full flex items-center justify-center text-[16px] text-[#1a2b4a]/35 active:text-[#2d5fb8] bg-transparent border-none cursor-pointer">
                                                <FiHelpCircle />
                                            </button>
                                        ) : (
                                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 flex items-center gap-1">
                                                <button type="button" onClick={() => setShowTutorial(true)} title="How it works" className="w-8 h-8 rounded-full flex items-center justify-center text-[16px] text-[#1a2b4a]/35 hover:text-[#2d5fb8] hover:bg-[#2d5fb8]/[0.07] bg-transparent border-none cursor-pointer transition-colors">
                                                    <FiHelpCircle />
                                                </button>
                                                <button type="button" onClick={() => setShowQRModal(true)} title="Dictate from your phone" className="w-8 h-8 rounded-full flex items-center justify-center text-[16px] text-[#1a2b4a]/35 hover:text-[#2d5fb8] hover:bg-[#2d5fb8]/[0.07] bg-transparent border-none cursor-pointer transition-colors">
                                                    <FiSmartphone />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {!isMobile && (
                                        <p className="mt-1.5 mb-0 text-[15px] text-[#1a2b4a]/55">
                                            {dictations.length
                                                ? 'Add more, or generate when you’re ready.'
                                                : activeCaseId ? 'Dictate and it goes straight into this case.' : 'Dictate the visit and we’ll write the record.'}
                                        </p>
                                    )}
                                    <div className={isMobile ? 'mt-3' : 'mt-5'}>
                                        <CaseTarget caseId={activeCaseId} onChange={selectCase} disabled={isRecording || isGenerating} />
                                    </div>
                                </div>
                            )}

                            {/* Error Message */}
                            {error && (
                                <div className={`${isMobile ? 'mb-3' : 'mb-6'} w-full max-w-2xl bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm flex-shrink-0`}>
                                    <p className="text-red-600 text-sm text-center">{error}</p>
                                </div>
                            )}


                            {/* Main Input Container - ChatGPT style */}
                            <div className={`w-full ${isMobile ? 'max-w-full flex flex-col items-center' : 'max-w-[680px] flex-shrink-0'}`}>
                                {startCard && (
                                    <div className={isMobile ? 'mb-3 w-full max-w-[560px]' : 'mb-4'}>{noteTypeControl}</div>
                                )}
                                {dictCard && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                                        className={`${CARD} ${isMobile ? 'px-5 pt-5 pb-5' : 'px-7 pt-7 pb-6'}`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="m-0 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#1a2b4a]/45">
                                                {dictations.length === 1 ? '1 dictation' : `${dictations.length} dictations`}
                                            </p>
                                        </div>
                                        <div className={`${isMobile ? 'max-h-[28vh]' : 'max-h-[38vh]'} overflow-y-auto -mx-1 px-1 space-y-2`}>
                                            {dictations.map((dictation, i) => (
                                                <motion.div
                                                    key={dictation.id}
                                                    layout
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="group rounded-2xl bg-[#f6f8fb] px-4 py-3"
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[12px] font-semibold text-[#1a2b4a]/50">Dictation {i + 1}</span>
                                                        <span className="text-[#1a2b4a]/25">·</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleDictationExpand(dictation.id)}
                                                            className="p-0 text-[12px] font-medium text-[#2d5fb8] hover:text-[#2350a3] bg-transparent border-none cursor-pointer"
                                                        >
                                                            {dictation.expanded ? 'Show summary' : 'Show full transcript'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteDictationClick(dictation.id)}
                                                            title="Remove dictation"
                                                            className={`ml-auto w-7 h-7 -mr-1.5 rounded-full flex items-center justify-center text-[#1a2b4a]/35 hover:text-red-500 hover:bg-white bg-transparent border-none cursor-pointer transition-[opacity,color,background-color] ${isMobile ? '' : 'opacity-0 group-hover:opacity-100'}`}
                                                        >
                                                            <FiX className="text-[14px]" />
                                                        </button>
                                                    </div>
                                                    <p className="m-0 text-[14.5px] leading-relaxed text-[#13233f]/85 whitespace-pre-wrap">
                                                        {dictation.expanded ? dictation.fullText : dictation.summary}
                                                    </p>
                                                </motion.div>
                                            ))}
                                        </div>

                                        {isMobile ? (
                                            <div className="mt-4 flex items-center justify-center gap-2 text-[12.5px] text-[#1a2b4a]/50">
                                                Record type
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${TYPE_STYLES[normalizeType(recordType)].soft}`}>
                                                    {React.createElement(TYPE_STYLES[normalizeType(recordType)].icon, { className: 'text-[12px]' })}
                                                    {TYPE_STYLES[normalizeType(recordType)].label}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="mt-6 pt-6 border-t border-[#eef2f7]">
                                                <p className={SECTION_LABEL}>Record type</p>
                                                {noteTypeControl}
                                            </div>
                                        )}

                                        <div className="mt-5 pt-5 border-t border-[#eef2f7] flex items-center justify-center gap-3">
                                            <motion.button
                                                type="button"
                                                onClick={startRecording}
                                                disabled={isGenerating}
                                                whileHover={{ scale: 1.06 }}
                                                whileTap={{ scale: 0.94 }}
                                                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                                                className="w-12 h-12 rounded-full border-none cursor-pointer text-white flex items-center justify-center shadow-[0_12px_28px_-12px_rgba(45,95,184,0.8)] disabled:opacity-50 disabled:cursor-not-allowed"
                                                style={MIC_BG}
                                                title="Add more dictation"
                                            >
                                                <FiMic className="text-[20px]" />
                                            </motion.button>
                                            <div className="text-left">
                                                <p className="m-0 text-[14.5px] font-semibold text-[#13233f]">Add more</p>
                                                <p className="m-0 text-[12.5px] text-[#1a2b4a]/50">It all goes into the same record.</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                <div className={startCard ? `${CARD} ${isMobile ? 'px-6 pt-8 pb-8' : 'px-10 pt-8 pb-9'} flex flex-col items-center` : 'contents'}>
                                {/* Mic: front and center before the first dictation, "Add more" after */}
                                {!dictCard && !isRecording && !isTranscribing && !hasReport && !isLoadingFromSaved && (
                                    <div className={`flex flex-col items-center ${startCard ? '' : isMobile ? 'mb-5 flex-shrink-0' : 'mb-6'}`}>
                                        <div className={`relative flex items-center justify-center ${startCard ? 'mt-2' : ''}`}>
                                            <motion.button
                                                type="button"
                                                onClick={startRecording}
                                                disabled={isGenerating}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                                                className={`relative ${startCard ? (isMobile ? 'w-24 h-24' : 'w-28 h-28') : dictations.length ? 'w-20 h-20' : 'w-24 h-24'} rounded-full border-none cursor-pointer text-white flex items-center justify-center shadow-[0_22px_44px_-14px_rgba(45,95,184,0.75),inset_0_1px_0_rgba(255,255,255,0.25)] disabled:opacity-50 disabled:cursor-not-allowed`}
                                                style={{ background: 'linear-gradient(160deg,#3f7ad6 0%,#2d5fb8 45%,#2350a3 100%)' }}
                                                title={dictations.length ? 'Add more dictation' : 'Start dictating'}
                                            >
                                                <FiMic className={`relative ${startCard ? (isMobile ? 'text-[36px]' : 'text-[40px]') : dictations.length ? 'text-3xl' : 'text-4xl'}`} />
                                            </motion.button>
                                        </div>
                                        <p className={`${startCard ? 'mt-3 font-display text-[19px] tracking-[-0.01em]' : 'mt-4 text-[15px]'} mb-0 font-semibold text-[#13233f]`}>
                                            {dictations.length ? 'Add more' : startCard && !isMobile ? 'Click to dictate' : 'Tap to dictate'}
                                        </p>
                                    </div>
                                )}

                                {/* Record Type Selector - Show before first dictation (mobile; desktop shows the cards above) */}
                                {!startCard && !isRecording && !isTranscribing && dictations.length === 0 && !hasReport && !isLoadingFromSaved && (
                                    <div className={startCard ? 'w-full mt-7 pt-6 border-t border-[#eef2f7]' : 'w-full max-w-[400px] mb-6'}>
                                        <p className="text-center mb-2.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#1a2b4a]/45">Record type</p>
                                        {noteTypeControl}
                                    </div>
                                )}
                                </div>

                                {/* Recording */}
                                {isRecording && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.97 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.2 }}
                                        className={`w-full mx-auto rounded-[28px] ${BRAND_WASH} border border-[#e3ecf8] flex flex-col items-center ${isMobile ? 'max-w-md px-6 py-6 mb-5' : 'max-w-[680px] px-10 py-12 mb-6 shadow-[0_30px_70px_-40px_rgba(19,35,63,0.35)]'}`}
                                    >
                                        <RecordingStatus live={!isPaused} seconds={recordSeconds} className="mb-3" />
                                        <WaveBars levels={waveLevels} live={!isPaused} height={isMobile ? 64 : 96} barWidth={isMobile ? 5 : 6} gap={isMobile ? 4 : 5} />
                                        <div className="flex items-center gap-2 mt-5">
                                            <button type="button" onClick={isPaused ? resumeRecording : pauseRecording} className={`inline-flex items-center gap-2 h-11 px-5 rounded-full text-[14px] font-semibold text-white border-none ${isPaused ? 'bg-emerald-500 hover:bg-emerald-600 shadow-[0_10px_24px_-12px_rgba(16,185,129,0.8)]' : 'bg-amber-500 hover:bg-amber-600 shadow-[0_10px_24px_-12px_rgba(245,158,11,0.8)]'} cursor-pointer transition-colors`}>
                                                {isPaused ? <><FiPlay /> Resume</> : <><FiPause /> Pause</>}
                                            </button>
                                            <button type="button" onClick={stopRecording} className="inline-flex items-center gap-2 h-11 px-5 rounded-full text-[14px] font-semibold text-white bg-red-500 hover:bg-red-600 border-none cursor-pointer shadow-[0_10px_24px_-12px_rgba(239,68,68,0.8)] transition-colors">
                                                <FiSquare className="text-[12px]" /> Done
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Transcribing */}
                                {isTranscribing && (
                                    <div className={`flex flex-col items-center gap-2 ${isMobile ? 'mb-4 flex-shrink-0' : 'mb-6'}`}>
                                        <span className="w-8 h-8 rounded-full border-[3px] border-[#2d5fb8]/20 border-t-[#2d5fb8] animate-spin" />
                                        <span className="text-[14px] font-medium text-[#13233f]">Transcribing…</span>
                                        {needsSegmentation && (
                                            <span className="text-xs text-[#1a2b4a]/55 text-center px-4">
                                                Hang tight! Longer recordings can take up to 3 minutes to transcribe.
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Additional Notes Section - Show in un-generated view */}
                                {!hasReport && !isMobile && !isRecording && !isTranscribing && !showStartNotes && !input.trim() && (
                                    <div className={`flex justify-center mb-4 ${startCard || dictCard ? 'mt-5' : ''}`}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowStartNotes(true);
                                                setTimeout(() => inputTextareaRef.current?.focus(), 50);
                                            }}
                                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium text-[#1a2b4a]/55 hover:text-[#2d5fb8] hover:bg-white bg-transparent border-none cursor-pointer transition-colors"
                                        >
                                            <FiEdit3 className="text-[13px]" /> Or type and paste notes instead
                                        </button>
                                    </div>
                                )}
                                {!hasReport && !isMobile && (showStartNotes || input.trim()) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
                                        className={`mb-4 w-full max-w-[680px] mx-auto flex-shrink-0 ${startCard || dictCard ? 'mt-6' : ''}`}
                                    >
                                        <textarea
                                            ref={inputTextareaRef}
                                            value={input}
                                            onChange={(e) => {
                                                setInput(e.target.value);
                                            }}
                                            placeholder="Weight, vitals, history, anything you want included"
                                            className="w-full px-4 py-3 bg-white border border-[#e7ecf3] rounded-2xl focus:border-[#2d5fb8]/30 focus:outline-none resize-none text-[#13233f] placeholder:text-[#1a2b4a]/40 text-[15px] overflow-y-auto shadow-[0_6px_20px_-16px_rgba(19,35,63,0.3)] transition-colors"
                                            style={{
                                                whiteSpace: 'pre-wrap',
                                                wordWrap: 'break-word',
                                                maxHeight: '200px',
                                                minHeight: '80px'
                                            }}
                                            disabled={isTranscribing || isGenerating}
                                        />
                                    </motion.div>
                                )}

                                {/* Mobile: Send to Desktop and Start New buttons - Show when dictations exist and not recording */}
                                {isMobile && dictations.length > 0 && !isRecording && !isTranscribing && !hasReport && (
                                    <div className="w-full max-w-[560px] mx-auto mt-5 flex flex-col gap-2 flex-shrink-0">
                                        {hasBeenSentToDesktop ? (
                                            <>
                                                <p className="m-0 mb-1 flex items-center justify-center gap-1.5 text-[13.5px] font-medium text-[#2d5fb8]">
                                                    <FiCheck /> On its way to your desktop
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => clearAllQuickSOAPData()}
                                                    className="w-full h-12 rounded-full text-[15px] font-semibold text-white bg-[#2d5fb8] active:bg-[#2350a3] border-none cursor-pointer shadow-[0_10px_30px_-12px_rgba(45,95,184,0.7)] flex items-center justify-center gap-2"
                                                >
                                                    <FiMic /> Start the next case
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={stayOnCase}
                                                    className="w-full h-12 rounded-full text-[15px] font-semibold text-[#13233f] bg-[#f6f8fb] active:bg-[#eef2f7] border-none cursor-pointer"
                                                >
                                                    Add another record to this case
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSendToDesktopClick}
                                                    disabled={isSendingToDesktop}
                                                    className="w-full h-11 rounded-full text-[14px] font-semibold text-[#1a2b4a]/60 bg-transparent border-none cursor-pointer disabled:opacity-50"
                                                >
                                                    {isSendingToDesktop ? 'Sending…' : 'Send again'}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={handleSendToDesktopClick}
                                                    disabled={isGenerating || isSendingToDesktop}
                                                    className="w-full h-12 rounded-full text-[15px] font-semibold text-white bg-[#2d5fb8] active:bg-[#2350a3] border-none cursor-pointer shadow-[0_10px_30px_-12px_rgba(45,95,184,0.7)] disabled:opacity-60 flex items-center justify-center gap-2"
                                                >
                                                    {isSendingToDesktop ? (
                                                        <>
                                                            <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                                                            Sending…
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FaDesktop className="text-[15px]" /> Send to desktop
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowStartNewModal(true)}
                                                    disabled={isGenerating || isSendingToDesktop}
                                                    className="w-full h-11 rounded-full text-[14px] font-semibold text-[#1a2b4a]/60 bg-transparent border-none cursor-pointer disabled:opacity-50"
                                                >
                                                    Start over
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Generate Button - Show when dictations or additional notes exist (Desktop only) */}
                                {!isMobile && !hasReport && (dictations.length > 0 || input.trim()) && !isTranscribing && (
                                    <div className="flex justify-center mt-5">
                                        <button
                                            type="button"
                                            onClick={handleGenerateSOAP}
                                            disabled={isGenerating}
                                            className="group w-full max-w-[680px] h-14 inline-flex items-center justify-center gap-2.5 rounded-[18px] border-none cursor-pointer text-white font-display font-semibold text-[16.5px] tracking-[-0.01em] bg-gradient-to-r from-[#6aa5ef] via-[#4f8ce2] to-[#3d78d2] shadow-[0_16px_34px_-16px_rgba(61,120,210,0.75),inset_0_1px_0_rgba(255,255,255,0.3)] hover:brightness-[1.05] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                                                    Generating…
                                                </>
                                            ) : (
                                                <>
                                                    Generate {NOTE_LABELS[recordType] || 'Record'}
                                                    <FiArrowRight className="text-[18px] transition-transform duration-200 group-hover:translate-x-0.5" />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* Free-tier daily usage: banner only when 1 SOAP left */}
                                <UpgradeNudge show={showNudge} feature="soap" remaining={soapRemaining} onDismiss={dismissNudge} />

                            </div>
                        </motion.div>
                    ) : isMobile ? (
                        // Mobile sidebar layout when report is generated (unchanged)
                        <div className="h-full flex flex-col overflow-hidden px-6 py-8 bg-white">
                            {/* Header */}
                            <div className="mb-6 flex-shrink-0">
                                <h1 className="text-2xl font-bold text-primary-600 mb-2">
                                    QuickSOAP
                                </h1>
                                <p className="text-sm text-gray-600">
                                    Type or dictate your clinical notes
                                </p>
                            </div>

                            {error && (
                                <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-3 rounded-r-lg flex-shrink-0">
                                    <p className="text-red-600 text-xs">{error}</p>
                                </div>
                            )}

                            {dictations.length > 0 && (
                                <div className="mb-4 overflow-y-auto max-h-48 space-y-2 flex-shrink-0">
                                    {dictations.map((dictation) => (
                                        <div key={dictation.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-semibold text-blue-700">
                                                            {dictation.expanded ? 'Full Transcript' : 'Dictation Summary'}
                                                        </span>
                                                        <button onClick={() => toggleDictationExpand(dictation.id)} className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1">
                                                            {dictation.expanded ? (<><FaChevronUp className="text-xs" /><span>Collapse</span></>) : (<><FaChevronDown className="text-xs" /><span>Expand</span></>)}
                                                        </button>
                                                    </div>
                                                    <p className="text-sm text-gray-700">{dictation.expanded ? dictation.fullText : dictation.summary}</p>
                                                </div>
                                                <button onClick={() => handleDeleteDictationClick(dictation.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Remove dictation">
                                                    <FaTimes className="text-xs" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col gap-3 flex-shrink-0">
                                {(isRecording || !hasReport) && (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="flex justify-center items-center gap-3">
                                            {isRecording && !isPaused && (
                                                <button onClick={pauseRecording} disabled={isTranscribing || isGenerating} className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg bg-yellow-500 hover:bg-yellow-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed" title="Pause Recording">
                                                    <FaPause className="text-xl" />
                                                </button>
                                            )}
                                            {isRecording && isPaused && (
                                                <button onClick={resumeRecording} disabled={isTranscribing || isGenerating} className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed" title="Resume Recording">
                                                    <FaPlay className="text-xl" />
                                                </button>
                                            )}
                                            <button onClick={isRecording ? stopRecording : startRecording} disabled={isTranscribing || isGenerating} className={`rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'bg-primary-600 hover:bg-primary-700 text-white'} disabled:bg-gray-300 disabled:cursor-not-allowed disabled:animate-none w-24 h-24`} title={isRecording ? 'Stop Recording' : 'Start Recording'}>
                                                {isRecording ? <FaStop className="text-2xl" /> : <FaMicrophone className="text-2xl" />}
                                            </button>
                                        </div>
                                        {isRecording && <p className="text-xs font-medium text-gray-600">{isPaused ? 'Paused' : 'Listening...'}</p>}
                                    </div>
                                )}
                                {isMobile && dictations.length > 0 && (
                                    <div className="w-full space-y-2">
                                        <button
                                            onClick={handleSendToDesktopClick}
                                            disabled={isTranscribing || isGenerating || isSendingToDesktop}
                                            className="w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg font-semibold text-sm hover:from-primary-700 hover:to-primary-800 transition-all shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {isSendingToDesktop ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                    <span>Sending...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FaDesktop className="text-base" />
                                                    {hasBeenSentToDesktop ? 'Send Again' : 'Send to Desktop'}
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setShowStartNewModal(true)}
                                            disabled={isTranscribing || isGenerating || isSendingToDesktop}
                                            className="w-full px-3 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium text-xs hover:bg-gray-300 transition-all shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
                                        >
                                            Start New
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Desktop top bar when report is generated
                        <div
                            className="flex flex-col gap-3"
                            style={{
                                fontFamily: "var(--font-sans)",
                                background: 'linear-gradient(180deg, #ffffff 0%, #f8faff 100%)',
                                padding: '16px 24px',
                            }}
                        >
                            {/* Row 1: Mic + Actions + Notes */}
                            <div className="flex items-center gap-3">
                                {/* Mic / Recording controls */}
                                {!isRecording && !isTranscribing && (
                                    <button
                                        onClick={startRecording}
                                        disabled={isGenerating}
                                        className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-xl hover:shadow-2xl flex items-center justify-center flex-shrink-0 transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none relative"
                                        title={dictations.length > 0 ? 'Add More Dictation' : 'Start Dictation'}
                                    >
                                        <FaMicrophone className="text-xl" />
                                        {dictations.length > 0 && (
                                            <span className="absolute -top-0.5 -right-0.5 bg-white rounded-full flex items-center justify-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.15)', width: '20px', height: '20px' }}>
                                                <span className="text-primary-600 text-xs font-bold leading-none">+</span>
                                            </span>
                                        )}
                                    </button>
                                )}
                                {isRecording && (
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {!isPaused ? (
                                            <button onClick={pauseRecording} disabled={isTranscribing || isGenerating} className="w-12 h-12 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white flex items-center justify-center shadow-lg transition-all duration-200" title="Pause">
                                                <FaPause className="text-sm" />
                                            </button>
                                        ) : (
                                            <button onClick={resumeRecording} disabled={isTranscribing || isGenerating} className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg transition-all duration-200" title="Resume">
                                                <FaPlay className="text-sm" />
                                            </button>
                                        )}
                                        <button onClick={stopRecording} disabled={isTranscribing || isGenerating} className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg animate-pulse transition-all duration-200" title="Stop Recording">
                                            <FaStop className="text-base" />
                                        </button>
                                        <span className="text-xs text-gray-500 font-medium">{isPaused ? 'Paused' : 'Listening...'}</span>
                                    </div>
                                )}
                                {isTranscribing && (
                                    <div className="flex items-center gap-2.5 flex-shrink-0 bg-blue-50 rounded-xl px-4 py-2.5">
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent" />
                                        <span className="text-xs text-primary-600 font-medium">Transcribing...</span>
                                    </div>
                                )}

                                {/* Action buttons */}
                                {(dictations.length > 0 || input.trim()) && !isTranscribing && (
                                    <div className="flex items-center gap-2.5 flex-shrink-0">
                                        <button
                                            type="button"
                                            onClick={handleGenerateSOAP}
                                            disabled={isGenerating}
                                            className="px-6 py-3 text-white rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                                            style={{
                                                background: 'linear-gradient(135deg, #4f7fd9 0%, #3369bd 100%)',
                                                boxShadow: '0 2px 8px rgba(51,105,189,0.2)',
                                            }}
                                        >
                                            {isGenerating ? 'Generating...' : 'Regenerate'}
                                        </button>
                                        <button
                                            onClick={handleClearReport}
                                            disabled={isGenerating}
                                            className="px-5 py-3 text-white rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                                            style={{ background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)', boxShadow: '0 2px 8px rgba(16,185,129,0.2)' }}
                                        >
                                            Start New
                                        </button>
                                    </div>
                                )}

                                {/* Error inline */}
                                {error && (
                                    <div className="flex-shrink-0 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                                        <p className="text-red-500 text-xs font-medium">{error}</p>
                                    </div>
                                )}

                                {/* Additional notes - auto-grows */}
                                <textarea
                                    ref={sidebarInputTextareaRef}
                                    value={input}
                                    onChange={(e) => {
                                        setInput(e.target.value);
                                        const el = e.target;
                                        el.style.height = 'auto';
                                        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                                    }}
                                    placeholder="Add extra notes or context..."
                                    className="flex-1 min-w-[200px] px-4 py-2.5 bg-white text-sm resize-none focus:outline-none text-gray-700 rounded-xl transition-shadow placeholder:text-xs placeholder:italic placeholder:text-gray-300 placeholder:font-light"
                                    style={{
                                        maxHeight: '120px',
                                        minHeight: '42px',
                                        fontFamily: "var(--font-sans)",
                                        overflow: 'auto',
                                        border: '1px solid #e8ecf2',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                    }}
                                    onFocus={(e) => { e.target.style.borderColor = '#93b4e8'; e.target.style.boxShadow = '0 0 0 3px rgba(51,105,189,0.08)'; }}
                                    onBlur={(e) => { e.target.style.borderColor = '#e8ecf2'; e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
                                    disabled={isTranscribing || isGenerating}
                                />
                            </div>

                            {/* Row 2: Dictation cards */}
                            {dictations.length > 0 && (
                                <div className="flex flex-wrap gap-2 overflow-y-auto rounded-xl" style={{ maxHeight: '160px' }}>
                                    {dictations.map((dictation, idx) => (
                                        <div
                                            key={dictation.id}
                                            className={`bg-white rounded-xl transition-all ${dictation.expanded ? 'w-full' : 'flex-1 min-w-[220px]'}`}
                                            style={{
                                                border: '1px solid #e0e8f5',
                                                padding: '8px 12px',
                                                boxShadow: '0 1px 3px rgba(51,105,189,0.04)',
                                            }}
                                        >
                                            <div className="flex items-start justify-between gap-1.5">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span
                                                            className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                                                            style={{ backgroundColor: '#eef3fb' }}
                                                        >
                                                            <FaMicrophone className="text-[7px] text-primary-400" />
                                                        </span>
                                                        <span className="text-[10px] font-semibold text-primary-500 tracking-wide uppercase">
                                                            {dictation.expanded ? 'Transcript' : `Dictation ${idx + 1}`}
                                                        </span>
                                                        <button
                                                            onClick={() => toggleDictationExpand(dictation.id)}
                                                            className="ml-auto px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                                                            style={{ background: dictation.expanded ? 'rgba(51,105,189,0.12)' : 'rgba(51,105,189,0.07)', color: '#3369bd' }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(51,105,189,0.18)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = dictation.expanded ? 'rgba(51,105,189,0.12)' : 'rgba(51,105,189,0.07)'}
                                                        >
                                                            {dictation.expanded ? (
                                                                <><FaChevronUp className="text-[10px]" /><span>Less</span></>
                                                            ) : (
                                                                <><FaChevronDown className="text-[10px]" /><span>Expand</span></>
                                                            )}
                                                        </button>
                                                    </div>
                                                    <p className="text-[11px] text-gray-500 leading-snug">
                                                        {dictation.expanded ? dictation.fullText : dictation.summary}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteDictationClick(dictation.id)}
                                                    className="text-gray-200 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                                                    title="Remove dictation"
                                                >
                                                    <FaTimes className="text-[8px]" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Side - Report Display */}
                {hasReport && !isMobile && (
                    <div
                        ref={(el) => {
                            if (el) reportScrollContainerRef.current = el;
                        }}
                        className="fixed right-0 bottom-0 overflow-y-auto z-30"
                        style={{
                            background: 'linear-gradient(180deg, #f8f9fb 0%, #f1f3f7 100%)',
                            left: isSidebarCollapsed ? '80px' : '224px',
                            top: '0',
                            paddingBottom: '40px',
                            opacity: isTransitioning ? 0 : 1,
                            transform: isTransitioning ? 'translateY(20px)' : 'translateY(0)',
                            transition: 'opacity 0.4s ease-in-out, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s ease-in-out, top 0.2s ease-in-out'
                        }}>
                        {/* Sticky header: the case you're in, then the tools for this note */}
                        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-[#e7ecf3] shadow-[0_10px_30px_-24px_rgba(19,35,63,0.35)]">
                            <CaseBar caseId={activeCaseId} recordType={recordType} onBack={() => requestLeave({ kind: 'back' })} refreshKey={caseBarKey} />
                            <div className="flex flex-wrap items-center gap-2 px-5 sm:px-6 py-2.5 border-t border-[#eef2f7]" style={{ fontFamily: "var(--font-sans)" }}>
                                <AnimatePresence mode="wait" initial={false}>
                                    {isRecording ? (
                                        <motion.div key="rec" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.18 }} className="flex items-center gap-2 shrink-0 rounded-full bg-[#f3f7fd] border border-[#e3ecf8] pl-3.5 pr-1 py-1">
                                            <RecordingStatus live={!isPaused} seconds={recordSeconds} />
                                            <WaveBars levels={waveLevels} live={!isPaused} height={24} barWidth={3} gap={2} className="w-[110px]" />
                                            <button type="button" onClick={isPaused ? resumeRecording : pauseRecording} title={isPaused ? 'Resume' : 'Pause'} className={`w-8 h-8 rounded-full flex items-center justify-center text-white border-none ${isPaused ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'} cursor-pointer transition-colors`}>
                                                {isPaused ? <FiPlay className="text-[12px]" /> : <FiPause className="text-[12px]" />}
                                            </button>
                                            <button type="button" onClick={stopRecording} className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 border-none cursor-pointer transition-colors">
                                                <FiSquare className="text-[10px]" /> Done
                                            </button>
                                        </motion.div>
                                    ) : isTranscribing ? (
                                        <motion.div key="tx" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 shrink-0 rounded-full bg-[#f3f7fd] border border-[#e3ecf8] px-4 h-10 text-[13px] font-medium text-[#2d5fb8]">
                                            <span className="w-3.5 h-3.5 rounded-full border-2 border-[#2d5fb8]/25 border-t-[#2d5fb8] animate-spin" /> Transcribing…
                                        </motion.div>
                                    ) : (
                                        <motion.button key="mic" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={startRecording} disabled={isGenerating} className="inline-flex items-center gap-2 h-10 pl-1.5 pr-4 rounded-full text-[13.5px] font-semibold text-[#13233f] bg-white border border-[#e7ecf3] hover:border-[#2d5fb8]/30 hover:bg-[#f6f8fb] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
                                            <span className="w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ background: 'linear-gradient(160deg,#3f7ad6 0%,#2d5fb8 45%,#2350a3 100%)' }}><FiMic className="text-[13px]" /></span>
                                            {dictations.length > 0 ? 'Dictate more' : 'Dictate'}
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                                {!isRecording && !isTranscribing && (
                                    <button
                                        type="button"
                                        onClick={openTypedNotes}
                                        disabled={isGenerating}
                                        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-[13.5px] font-semibold text-[#13233f] bg-white border border-[#e7ecf3] hover:border-[#2d5fb8]/30 hover:bg-[#f6f8fb] cursor-pointer transition-colors disabled:opacity-50 shrink-0"
                                    >
                                        <FiEdit3 className="text-[14px] text-[#2d5fb8]" /> Type
                                    </button>
                                )}
                                {(dictations.length > 0 || input.trim()) && (
                                    <button
                                        type="button"
                                        onClick={handleGenerateSOAP}
                                        disabled={isGenerating || isRecording || isTranscribing}
                                        className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13.5px] font-semibold text-white bg-[#2d5fb8] hover:bg-[#2350a3] border-none cursor-pointer shadow-[0_8px_20px_-10px_rgba(45,95,184,0.7)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                    >
                                        <FiRefreshCw className={`text-[13px] ${isGenerating ? 'animate-spin' : ''}`} /> {isGenerating ? 'Generating…' : 'Regenerate'}
                                    </button>
                                )}
                                <span className="flex-1" />
                                <div className="flex items-center gap-2 shrink-0">
                                    {isAuthenticated && (
                                        <button type="button" onClick={handleSaveRecord} disabled={isSaving || !hasReport} title="Save" className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13.5px] font-semibold cursor-pointer transition-colors shrink-0 border disabled:opacity-40 disabled:cursor-not-allowed ${saveMessageVisible ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-[#e9f6fd] text-[#2d5fb8] border-[#cde6f8] hover:bg-[#d8effb]'}`}>
                                            {saveMessageVisible ? <FiCheck className="text-[15px]" /> : <FiSave className="text-[15px]" />}
                                            {isSaving ? 'Saving…' : saveMessageVisible ? 'Saved' : 'Save'}
                                        </button>
                                    )}
                                    <button type="button" onClick={copyAll} title="Copy all" className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13.5px] font-semibold cursor-pointer transition-colors shrink-0 border ${copiedSection === 'all' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-[#13233f] border-[#dfe6f0] hover:border-[#2d5fb8]/30 hover:bg-[#f6f8fb]'}`}>
                                        {copiedSection === 'all' ? <FiCheck className="text-[15px]" /> : <FiCopy className="text-[15px] text-[#2d5fb8]" />}
                                        {copiedSection === 'all' ? 'Copied' : 'Copy all'}
                                    </button>
                                    <button type="button" onClick={handlePrint} title="Print" className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13.5px] font-semibold cursor-pointer transition-colors shrink-0 border bg-white text-[#13233f] border-[#dfe6f0] hover:border-[#2d5fb8]/30 hover:bg-[#f6f8fb]">
                                        <FiPrinter className="text-[15px] text-[#2d5fb8]" /> Print
                                    </button>
                                </div>
                            </div>
                            <AnimatePresence initial={false}>
                                {error && (
                                    <motion.p key="err" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-6 pb-2 m-0 text-[13px] text-red-500 overflow-hidden">{error}</motion.p>
                                )}
                            </AnimatePresence>
                            <div className="border-t border-[#eef2f7]" style={{ fontFamily: "var(--font-sans)" }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowDictations((v) => !v)}
                                        className="w-full flex items-center gap-2 px-5 sm:px-6 h-10 text-[13px] font-medium text-[#13233f] bg-transparent hover:bg-[#f6f8fb] border-none cursor-pointer transition-colors"
                                    >
                                        <FiMic className="text-[13px] text-[#2d5fb8]" />
                                        Dictations & notes
                                        <CountBadge count={dictations.length + (input.trim() ? 1 : 0)} />
                                        <span className="ml-auto text-[12.5px] text-[#1a2b4a]/50">{showDictations ? 'Hide' : 'Show'}</span>
                                        <FiChevronDown className={`text-[14px] text-[#1a2b4a]/50 transition-transform duration-300 ${showDictations ? 'rotate-180' : ''}`} />
                                    </button>
                                    <AnimatePresence initial={false}>
                                        {showDictations && (
                                            <motion.div key="dict" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }} className="overflow-hidden">
                                                <div className="px-5 sm:px-6 pb-4 pt-1 grid gap-3 md:grid-cols-2 max-h-[40vh] overflow-y-auto">
                                                    {dictations.map((dictation, idx) => (
                                                        <div key={dictation.id} className="rounded-[20px] bg-white border border-[#e7ecf3] px-4 py-3 shadow-[0_6px_20px_-16px_rgba(19,35,63,0.3)]">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-[13px] font-semibold text-[#13233f]">Dictation {idx + 1}</span>
                                                                <div className="ml-auto bg-[#f6f8fb] rounded-full p-0.5 inline-flex">
                                                                    {[['Summary', false], ['Full transcript', true]].map(([label, full]) => (
                                                                        <button
                                                                            key={label}
                                                                            type="button"
                                                                            onClick={() => { if (!!dictation.expanded !== full) toggleDictationExpand(dictation.id); }}
                                                                            className={`px-2.5 py-1 rounded-full text-[11.5px] font-medium border-none cursor-pointer transition-colors ${!!dictation.expanded === full ? 'bg-white text-[#2d5fb8] shadow-sm' : 'bg-transparent text-[#1a2b4a]/55 hover:text-[#13233f]'}`}
                                                                        >
                                                                            {label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                <button type="button" onClick={() => handleDeleteDictationClick(dictation.id)} title="Remove dictation" className="w-7 h-7 rounded-full flex items-center justify-center text-[#1a2b4a]/30 hover:text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer transition-colors">
                                                                    <FiX className="text-[13px]" />
                                                                </button>
                                                            </div>
                                                            <p className="m-0 text-[13.5px] text-[#1a2b4a]/75 leading-relaxed whitespace-pre-wrap">{dictation.expanded ? dictation.fullText : dictation.summary}</p>
                                                        </div>
                                                    ))}
                                                    <div className="md:col-span-2 rounded-[20px] bg-white border border-[#e7ecf3] px-4 py-3 shadow-[0_6px_20px_-16px_rgba(19,35,63,0.3)]">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <FiEdit3 className="text-[13px] text-[#2d5fb8]" />
                                                            <span className="text-[13px] font-semibold text-[#13233f]">Typed notes</span>
                                                            <span className="ml-auto text-[12px] text-[#1a2b4a]/45">Included when you regenerate</span>
                                                        </div>
                                                        <textarea
                                                            ref={sidebarInputTextareaRef}
                                                            value={input}
                                                            rows={2}
                                                            onChange={(e) => {
                                                                setInput(e.target.value);
                                                                const el = e.target;
                                                                el.style.height = 'auto';
                                                                el.style.height = Math.min(el.scrollHeight, 200) + 'px';
                                                            }}
                                                            placeholder="Anything to add or correct, e.g. weight was 12.4 kg, add recheck in 2 weeks"
                                                            className="w-full px-3.5 py-2.5 rounded-2xl bg-[#f6f8fb] border border-transparent text-[14px] text-[#13233f] leading-relaxed resize-none focus:outline-none focus:bg-white focus:border-[#2d5fb8]/30 transition-colors placeholder:text-[#1a2b4a]/40"
                                                            style={{ maxHeight: '200px', overflow: 'auto', fontFamily: "var(--font-sans)" }}
                                                            disabled={isTranscribing || isGenerating}
                                                        />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                            </div>
                        </div>

                        <div className="mx-auto w-full max-w-[1680px] px-6 pt-3">
                            {isGenerating && (
                                <div className="mb-5 rounded-[20px] bg-[#eef4fc] border border-[#d6e3f7] px-5 py-3.5 flex items-center gap-3" style={{ fontFamily: "var(--font-sans)" }}>
                                    <span className="w-4 h-4 rounded-full border-2 border-[#2d5fb8]/25 border-t-[#2d5fb8] animate-spin shrink-0" />
                                    <p className="m-0 text-[14px] font-medium text-[#13233f]">Writing your {recordType === 'soap' ? 'SOAP' : recordType === 'dental' ? 'dental record' : recordType}. It saves to this case automatically.</p>
                                </div>
                            )}
                            {/* Loader or Report Content */}
                            {isGenerating && isReportTransitioning ? (
                                <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
                                    {/* Animated orbs background */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white">
                                        <div className="absolute w-16 h-16 rounded-full opacity-60 blur-xl"
                                            style={{ background: '#3b82f6', animation: 'loaderFloat1 8s ease-in-out infinite' }}
                                        />
                                        <div className="absolute w-14 h-14 rounded-full opacity-60 blur-xl"
                                            style={{ background: '#10b981', animation: 'loaderFloat2 10s ease-in-out infinite' }}
                                        />
                                        <div className="absolute w-20 h-20 rounded-full opacity-50 blur-xl"
                                            style={{ background: '#f59e0b', animation: 'loaderFloat3 9s ease-in-out infinite' }}
                                        />
                                        <div className="absolute w-12 h-12 rounded-full opacity-50 blur-xl"
                                            style={{ background: '#ef4444', animation: 'loaderFloat4 11s ease-in-out infinite' }}
                                        />
                                    </div>
                                    {/* Center text */}
                                    <div className="relative z-10 text-center">
                                        <p className="text-primary-700 text-lg font-semibold mb-1">Generating {recordType === 'soap' ? 'SOAP report' : recordType === 'summary' ? 'summary' : recordType === 'dental' ? 'dental record' : 'callback notes'}...</p>
                                        <p className="text-primary-500/70 text-sm">This will be saved automatically</p>
                                    </div>
                                    <style>{`
                                        @keyframes loaderFloat1 {
                                            0%, 100% { top: 10%; left: 15%; transform: scale(1); }
                                            25% { top: 55%; left: 65%; transform: scale(1.1); }
                                            50% { top: 70%; left: 25%; transform: scale(0.9); }
                                            75% { top: 25%; left: 60%; transform: scale(1.05); }
                                        }
                                        @keyframes loaderFloat2 {
                                            0%, 100% { top: 65%; left: 55%; transform: scale(1); }
                                            25% { top: 15%; left: 10%; transform: scale(0.95); }
                                            50% { top: 35%; left: 70%; transform: scale(1.15); }
                                            75% { top: 75%; left: 35%; transform: scale(1); }
                                        }
                                        @keyframes loaderFloat3 {
                                            0%, 100% { top: 35%; left: 75%; transform: scale(1); }
                                            25% { top: 70%; left: 40%; transform: scale(1.1); }
                                            50% { top: 15%; left: 50%; transform: scale(0.9); }
                                            75% { top: 55%; left: 10%; transform: scale(1.05); }
                                        }
                                        @keyframes loaderFloat4 {
                                            0%, 100% { top: 80%; left: 15%; transform: scale(1); }
                                            25% { top: 20%; left: 50%; transform: scale(1.1); }
                                            50% { top: 60%; left: 80%; transform: scale(0.85); }
                                            75% { top: 10%; left: 30%; transform: scale(1.05); }
                                        }
                                    `}</style>
                                </div>
                            ) : (
                                <div
                                    style={{
                                        opacity: (isReportTransitioning || isLoadingFromSaved) ? 0 : 1,
                                        transform: (isReportTransitioning || isLoadingFromSaved) ? 'translateX(100px)' : 'translateX(0)',
                                        transition: 'opacity 0.5s ease-in-out, transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                        animation: isLoadingFromSaved ? 'fadeIn 0.5s ease-in-out' : 'none'
                                    }}
                                >
                                    {/* Record Card - SOAP has sections, Summary/Callback have single textarea */}
                                    {recordType === 'dental' ? (
                                        <DentalWorkspace
                                            name={reportName}
                                            onNameChange={setReportName}
                                            report={report}
                                            onReportChange={setReport}
                                            dental={dental}
                                            onDentalChange={handleDentalChange}
                                            onCopy={copyAll}
                                            onPrint={handlePrint}
                                            copied={copiedSection === 'all'}
                                        />
                                    ) : (
                                    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)' }}>
                                        {recordType === 'soap' ? (
                                            // SOAP Record - Section-based display
                                            <>
                                                <div className="px-4 py-2 flex items-center gap-2 border-b border-gray-100 bg-[#fafbfd]">
                                                    <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11.5px] font-semibold ${TYPE_STYLES.soap.soft}`}>
                                                        {React.createElement(TYPE_STYLES.soap.icon, { className: 'text-[11px]' })} SOAP
                                                    </span>
                                                    <RecordName name={reportName} onChange={setReportName} />
                                                </div>
                                                {parsedReport.sections.map((section, index) => {
                                                    const colors = getSectionColor(section.name);

                                                    return (
                                                        <div
                                                            key={index}
                                                            className={index < parsedReport.sections.length - 1 ? 'border-b border-gray-100' : ''}
                                                        >
                                                            {/* Section Header */}
                                                            <div
                                                                className={`${colors.header} px-5 py-4 flex items-center justify-between`}
                                                                style={{ borderLeft: `3px solid ${colors.border}` }}
                                                            >
                                                                <div className="flex items-center gap-2.5">
                                                                    <span
                                                                        className="w-6 h-6 rounded-md flex items-center justify-center text-white font-bold"
                                                                        style={{ fontSize: '12px', backgroundColor: 'rgba(255,255,255,0.2)' }}
                                                                    >
                                                                        {section.name.charAt(0)}
                                                                    </span>
                                                                    <h3
                                                                        className="text-white font-semibold tracking-wider uppercase"
                                                                        style={{ fontFamily: "var(--font-sans)", fontSize: '12px', letterSpacing: '0.08em' }}
                                                                    >
                                                                        {section.name}
                                                                    </h3>
                                                                </div>
                                                                <button
                                                                    onClick={() => copySection(section.name, section.content)}
                                                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${copiedSection === section.name
                                                                        ? 'bg-white text-gray-700'
                                                                        : 'text-white hover:bg-white/20'
                                                                        }`}
                                                                    style={{ fontFamily: "var(--font-sans)", backgroundColor: copiedSection === section.name ? undefined : 'rgba(255,255,255,0.1)' }}
                                                                >
                                                                    <FaCopy className="text-[9px]" />
                                                                    {copiedSection === section.name ? 'Copied!' : 'Copy'}
                                                                </button>
                                                            </div>

                                                            {/* Section Content */}
                                                            <div className={`${colors.bg} px-5 py-3`}>
                                                                <textarea
                                                                    ref={(el) => {
                                                                        if (el) {
                                                                            textareaRefs.current[`section-${index}`] = el;
                                                                            setTimeout(() => adjustTextareaHeight(index, el), 0);
                                                                        }
                                                                    }}
                                                                    value={section.content}
                                                                    onChange={(e) => {
                                                                        isManualEditRef.current = true;
                                                                        const newSections = [...parsedReport.sections];
                                                                        newSections[index].content = e.target.value;

                                                                        setParsedReport(prev => ({ ...prev, sections: newSections }));

                                                                        const newReport = newSections
                                                                            .map(s => `${s.name}:\n${s.content}`)
                                                                            .join('\n\n');
                                                                        setReport(newReport);

                                                                        adjustTextareaHeight(index, e.target);
                                                                    }}
                                                                    className="w-full bg-white resize-none text-gray-800 focus:outline-none rounded-lg transition-shadow"
                                                                    style={{
                                                                        fontFamily: "var(--font-sans)",
                                                                        fontSize: '14px',
                                                                        lineHeight: '1.8',
                                                                        height: 'auto',
                                                                        overflowY: 'auto',
                                                                        whiteSpace: 'pre-wrap',
                                                                        wordWrap: 'break-word',
                                                                        scrollMargin: '0px',
                                                                        scrollPadding: '0px',
                                                                        scrollBehavior: 'auto',
                                                                        padding: '12px 14px',
                                                                    }}
                                                                    onFocus={(e) => {
                                                                        e.target.scrollIntoView = () => { };
                                                                        e.target.style.boxShadow = colors.focusRing;
                                                                    }}
                                                                    onBlur={(e) => {
                                                                        e.target.style.boxShadow = 'none';
                                                                    }}
                                                                    onInput={(e) => {
                                                                        const scrollContainer = e.target.closest('.overflow-y-auto') ||
                                                                            document.querySelector('.fixed.top-0.right-0.bottom-0.overflow-y-auto');
                                                                        if (scrollContainer) {
                                                                            const savedScroll = scrollContainer.scrollTop;
                                                                            requestAnimationFrame(() => {
                                                                                scrollContainer.scrollTop = savedScroll;
                                                                            });
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        ) : (
                                            // Summary/Callback Record - Single textarea display
                                            <div className="flex flex-col h-full">
                                                <div className={`px-5 py-2 flex-shrink-0 flex items-center gap-2.5 bg-gradient-to-r ${(TEXT_RECORDS[recordType] || TEXT_RECORDS.callback).bar}`}>
                                                    <span
                                                        className="w-6 h-6 rounded-md flex items-center justify-center text-white font-bold"
                                                        style={{ fontSize: '12px', backgroundColor: 'rgba(255,255,255,0.2)' }}
                                                    >
                                                        {React.createElement((TEXT_RECORDS[recordType] || TEXT_RECORDS.callback).icon, { className: 'text-[11px]' })}
                                                    </span>
                                                    <h3
                                                        className="m-0 shrink-0 whitespace-nowrap text-white font-semibold tracking-wider uppercase"
                                                        style={{ fontFamily: "var(--font-sans)", fontSize: '12px', letterSpacing: '0.08em' }}
                                                    >
                                                        {(TEXT_RECORDS[recordType] || TEXT_RECORDS.callback).title}
                                                    </h3>
                                                    <RecordName name={reportName} onChange={setReportName} tone="onColor" />
                                                </div>
                                                <textarea
                                                    value={report}
                                                    onChange={(e) => {
                                                        setReport(e.target.value);
                                                    }}
                                                    className="w-full px-5 py-4 border-none focus:outline-none resize-none text-gray-800 bg-white flex-1 rounded-b-2xl"
                                                    style={{
                                                        fontFamily: "var(--font-sans)",
                                                        fontSize: '14px',
                                                        lineHeight: '1.8',
                                                        minHeight: 'calc(100vh - 350px)',
                                                        whiteSpace: 'pre-wrap',
                                                        wordWrap: 'break-word'
                                                    }}
                                                    placeholder={(TEXT_RECORDS[recordType] || TEXT_RECORDS.callback).placeholder}
                                                />
                                            </div>
                                        )}

                                        {/* Copy All & Print Buttons at Bottom */}
                                        <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-100 flex justify-end gap-1.5">
                                            <button
                                                onClick={copyAll}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border-none cursor-pointer ${copiedSection === 'all'
                                                    ? 'bg-primary-100 text-primary-700'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                                                    }`}
                                                style={{ fontFamily: "var(--font-sans)" }}
                                            >
                                                {copiedSection === 'all' ? '✓ Copied!' : 'Copy All'}
                                            </button>
                                            <button
                                                onClick={handlePrint}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border-none cursor-pointer bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 flex items-center gap-1.5"
                                                style={{ fontFamily: "var(--font-sans)" }}
                                                title="Print report"
                                            >
                                                <FaPrint className="text-[10px]" />
                                                Print
                                            </button>
                                        </div>
                                    </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* QR Code Modal */}
                {showQRModal && (
                    <div
                        className="fixed bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
                        onClick={() => setShowQRModal(false)}
                        style={{
                            left: isSidebarCollapsed ? '80px' : '224px',
                            right: '0',
                            top: '0',
                            bottom: '0'
                        }}
                    >
                        <div
                            className="bg-gradient-to-b from-primary-600 to-primary-700 rounded-2xl shadow-2xl p-8 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-white">Mobile App</h2>
                                <button
                                    onClick={() => setShowQRModal(false)}
                                    className="text-white hover:text-gray-200 transition-colors"
                                >
                                    <FaTimes className="text-xl" />
                                </button>
                            </div>
                            <div className="text-center">
                                <p className="text-white mb-6">Scan this QR code or go to <span className="font-semibold text-accent-300">petwise.vet</span> on your phone and click log in</p>
                                <div className="flex justify-center mb-4">
                                    <img src="/PW QR CODE.png" alt="QuickSOAP Mobile App QR Code" className="w-64 h-64 border-4 border-white rounded-lg shadow-lg" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Template Selector Modal */}
                {showTemplateSelector && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
                        onClick={() => { setShowTemplateSelector(false); setTemplateSearchQuery(''); }}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-900">Select a Template</h3>
                                <button
                                    onClick={() => { setShowTemplateSelector(false); setTemplateSearchQuery(''); }}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                            <div className="px-6 py-3 border-b border-gray-100">
                                <input
                                    type="text"
                                    value={templateSearchQuery}
                                    onChange={(e) => setTemplateSearchQuery(e.target.value)}
                                    placeholder="Search templates..."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                                    autoFocus
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto px-6 py-3">
                                {templates
                                    .filter(t => t.template_name.toLowerCase().includes(templateSearchQuery.toLowerCase()))
                                    .map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => {
                                                setSelectedTemplate(template);
                                                setShowTemplateSelector(false);
                                                setTemplateSearchQuery('');
                                            }}
                                            className={`w-full text-left px-4 py-3 rounded-xl mb-2 transition-all duration-150 border ${selectedTemplate?.id === template.id
                                                    ? 'bg-primary-50 border-primary-300 ring-2 ring-primary-100'
                                                    : 'bg-gray-50 border-gray-100 hover:bg-primary-50 hover:border-primary-200'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                                                    <FaClipboardList className="text-primary-500 text-sm" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{template.template_name}</p>
                                                    <p className="text-xs text-gray-400 truncate mt-0.5">
                                                        {template.template_text?.replace(/[*#\n]/g, ' ').slice(0, 80)}...
                                                    </p>
                                                </div>
                                                {selectedTemplate?.id === template.id && (
                                                    <FaCheckCircle className="text-primary-500 flex-shrink-0 ml-auto" />
                                                )}
                                            </div>
                                        </button>
                                    ))
                                }
                                {templates.filter(t => t.template_name.toLowerCase().includes(templateSearchQuery.toLowerCase())).length === 0 && (
                                    <p className="text-sm text-gray-400 text-center py-8">
                                        {templates.length === 0 ? 'No templates yet. Create one in the Templates tab.' : 'No matching templates.'}
                                    </p>
                                )}
                            </div>
                            <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
                                Template content will be used as baseline context for your SOAP generation
                            </div>
                        </div>
                    </div>
                )}

                <AnimatePresence>
                    {showTutorial && <Guide id={isMobile ? 'phone' : 'records'} onClose={() => setShowTutorial(false)} />}
                </AnimatePresence>
            </div>
        </>
    );
};

export default QuickSOAP;
