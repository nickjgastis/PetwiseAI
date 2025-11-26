import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../supabaseClient';
import { FaMicrophone, FaStop, FaCopy, FaChevronDown, FaChevronUp, FaTimes, FaPause, FaPlay, FaSave, FaQuestionCircle, FaArrowRight, FaArrowLeft, FaDesktop, FaCheckCircle, FaMobile, FaPlus } from 'react-icons/fa';

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
                /^(Problem List|Primary Diagnosis|Differential Diagnoses|Prognosis|Treatment|Monitoring|Client Communication|Follow-up|Follow-Up|Presenting Complaint|History|Owner Observations|Physical Exam|Vital Signs|Diagnostics|Assessment|Plan):$/i.test(trimmed));

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
            if (loadedReport) {
                const parsed = parseSOAPReport(loadedReport);
                return parsed.sections.length > 0;
            }
        }
        return false;
    });
    const [audioLevels, setAudioLevels] = useState([]);
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
    const [isEditingReportName, setIsEditingReportName] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);
    const [isMobile, setIsMobile] = useState(() => {
        // Check on initial render to avoid layout shift
        if (typeof window !== 'undefined') {
            return window.innerWidth <= 768;
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
    const pollingIntervalRef = useRef(null);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const textareaRefs = useRef({});
    const inputTextareaRef = useRef(null);
    const sidebarInputTextareaRef = useRef(null);
    const draftRecordIdRef = useRef(null);
    const reportScrollContainerRef = useRef(null);
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

    // Adjust input textarea height when input changes
    useEffect(() => {
        if (inputTextareaRef.current) {
            adjustInputTextareaHeight();
        }
        if (sidebarInputTextareaRef.current) {
            adjustSidebarInputTextareaHeight();
        }
    }, [input]);

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

    // Mobile detection
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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
            setTutorialStep(0);
            localStorage.removeItem('openQuickSOAPTutorial');
        }
    }, []);

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
                if (!hasReport && parsed.sections.length > 0) {
                    setHasReport(true);
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

    // Helper to load draft data into component state
    const loadDraftData = useCallback((draftData, skipIfSameDraft = false) => {
        if (!draftData.form_data) return;

        // Skip reloading if we're already on this draft (prevents glitchy reloads)
        if (skipIfSameDraft && draftRecordIdRef.current === draftData.id) {
            return;
        }

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
        // Check if dictations have been sent to desktop (mobile only)
        if (isMobile && formData.sent_to_desktop === true) {
            setHasBeenSentToDesktop(true);
        }
        draftRecordIdRef.current = draftData.id;
        setDraftRecordId(draftData.id);
        localStorage.setItem('currentQuickSOAPReportId', draftData.id);
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

            // If no saved draft ID, try to find most recent mobile draft
            const { data: allDrafts } = await supabase
                .from('saved_reports')
                .select('id, report_name, form_data, created_at')
                .eq('user_id', userId)
                .eq('record_type', 'quicksoap')
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

    // Parse report when it changes (but skip if manually editing)
    useEffect(() => {
        if (isManualEditRef.current) {
            isManualEditRef.current = false;
            return;
        }

        if (report) {
            const parsed = parseSOAPReport(report);
            setParsedReport(parsed);
            setHasReport(parsed.sections.length > 0);
        } else {
            setHasReport(false);
        }
    }, [report]);


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

    const startRecording = async () => {
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

    const pauseRecording = () => {
        if (mediaRecorderRef.current && isRecording && !isPaused) {
            try {
                mediaRecorderRef.current.pause();
                setIsPaused(true);
            } catch (err) {
                console.error('Error pausing recording:', err);
            }
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && isRecording && isPaused) {
            try {
                mediaRecorderRef.current.resume();
                setIsPaused(false);
            } catch (err) {
                console.error('Error resuming recording:', err);
            }
        }
    };

    const stopRecording = () => {
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

    // Auto-save helper function (extracted from handleSaveRecord)
    const autoSaveRecord = async (generatedReport, extractedPetName = null) => {
        if (!isAuthenticated || !user) return;

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

            // Prepare form_data with QuickSOAP structure
            const formData = {
                record_type: 'quicksoap',
                dictations: dictations,
                input: input,
                report: generatedReport,
                lastInput: lastInput,
                petName: petNameToUse || null,
                auto_generated: true,
                generated_at: new Date().toISOString()
            };

            // Calculate report name with pet name if available
            const dateStr = new Date().toLocaleString();
            let finalReportName;
            const trimmedReportName = reportName.trim();

            // Always prioritize pet name when available (from parameter, not state)
            // This ensures we use the pet name even if reportName state hasn't updated yet
            if (petNameToUse) {
                finalReportName = `${petNameToUse} - ${dateStr}`;
            } else if (trimmedReportName && !trimmedReportName.match(/^QuickSOAP/i)) {
                // If reportName is set and doesn't start with generic "QuickSOAP", use it
                finalReportName = trimmedReportName;
            } else if (trimmedReportName) {
                // If reportName is set but is generic, use it (user may have customized it)
                finalReportName = trimmedReportName;
            } else {
                // Default fallback
                finalReportName = `QuickSOAP - ${dateStr}`;
            }

            const reportIdToUse = loadedReportId || draftRecordId;

            if (reportIdToUse) {
                // Update existing report
                const { error: updateError } = await supabase
                    .from('saved_reports')
                    .update({
                        report_name: finalReportName,
                        report_text: generatedReport,
                        form_data: formData,
                        record_type: 'quicksoap'
                    })
                    .eq('id', reportIdToUse)
                    .eq('user_id', userId);

                if (updateError) {
                    console.error('Error auto-saving QuickSOAP record:', updateError);
                } else {
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
                        record_type: 'quicksoap'
                    }])
                    .select()
                    .single();

                if (insertError) {
                    console.error('Error auto-saving QuickSOAP record:', insertError);
                } else {
                    // Store the new report ID
                    localStorage.setItem('currentQuickSOAPReportId', newReport.id);
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
        // Combine all dictations and manual input
        const allDictations = dictations.map(d => d.fullText).join('\n\n');
        const combinedInput = allDictations + (input.trim() ? '\n\n' + input.trim() : '');

        if (!combinedInput.trim() || dictations.length === 0) {
            setError('Please record at least one dictation first.');
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
                        input: combinedInput.trim()
                    });

                    if (response.data.report) {
                        const generatedReport = response.data.report;
                        const extractedPetName = response.data.petName;
                        setReport(generatedReport);
                        // Store pet name if extracted
                        if (extractedPetName) {
                            setPetName(extractedPetName);
                        }
                        // Set report name with pet name if available, otherwise use default
                        if (!reportName) {
                            const dateStr = new Date().toLocaleString();
                            if (extractedPetName) {
                                setReportName(`${extractedPetName} - ${dateStr}`);
                            } else {
                                setReportName(`QuickSOAP - ${dateStr}`);
                            }
                        } else if (extractedPetName && !reportName.includes(extractedPetName)) {
                            // Update existing report name if pet name was extracted and not already included
                            const dateStr = new Date().toLocaleString();
                            setReportName(`${extractedPetName} - ${dateStr}`);
                            setPetName(extractedPetName);
                        }
                        // Auto-save after generation with pet name
                        await autoSaveRecord(generatedReport, extractedPetName);
                        setTimeout(() => {
                            setIsReportTransitioning(false);
                        }, 100);
                    } else {
                        throw new Error('No report generated');
                    }
                } catch (err) {
                    console.error('SOAP generation error:', err);
                    setError(err.response?.data?.error || 'Failed to generate SOAP report. Please try again.');
                    setIsReportTransitioning(false);
                } finally {
                    setIsGenerating(false);
                }
            }, 400);
        } else {
            // First time generation - transition from center to sidebar
            try {
                const response = await axios.post(`${API_URL}/api/generate-soap`, {
                    input: combinedInput.trim()
                });

                if (response.data.report) {
                    const generatedReport = response.data.report;
                    const extractedPetName = response.data.petName;
                    // Start transition - fade out center input
                    setIsTransitioning(true);
                    setTimeout(() => {
                        setReport(generatedReport);
                        // Store pet name if extracted
                        if (extractedPetName) {
                            setPetName(extractedPetName);
                        }
                        // Set report name with pet name if available, otherwise use default
                        if (!reportName) {
                            const dateStr = new Date().toLocaleString();
                            if (extractedPetName) {
                                setReportName(`${extractedPetName} - ${dateStr}`);
                            } else {
                                setReportName(`QuickSOAP - ${dateStr}`);
                            }
                        } else if (extractedPetName && !reportName.includes(extractedPetName)) {
                            // Update existing report name if pet name was extracted and not already included
                            const dateStr = new Date().toLocaleString();
                            setReportName(`${extractedPetName} - ${dateStr}`);
                            setPetName(extractedPetName);
                        }
                        // Auto-save after generation with pet name
                        autoSaveRecord(generatedReport, extractedPetName);
                        // Fade in sidebar and report after a delay to allow center to fade out first
                        setTimeout(() => {
                            setIsTransitioning(false);
                        }, 100);
                    }, 400);
                } else {
                    throw new Error('No report generated');
                }
            } catch (err) {
                console.error('SOAP generation error:', err);
                setError(err.response?.data?.error || 'Failed to generate SOAP report. Please try again.');
            } finally {
                setIsGenerating(false);
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
            setIsEditingReportName(false);
            setHasBeenSentToDesktop(false);
            setPetName(null);
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
            // Transition back to center: fade in centered input
            setTimeout(() => {
                setIsTransitioning(false);
            }, 100);
        }, 400);
    };

    const handleSaveAndClear = async () => {
        if (!isAuthenticated || !hasReport || !report) {
            setError('Please generate a SOAP report before saving.');
            return;
        }

        try {
            // Save first
            await handleSaveRecord();

            // Wait a moment for save to complete, then clear
            setTimeout(() => {
                handleClearReport();
            }, 500);
        } catch (err) {
            console.error('Error in save and clear:', err);
            // Don't clear if save failed
        }
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

            // Prepare form_data with QuickSOAP structure
            // Desktop saves don't include sent_to_desktop flag (desktop origin)
            const formData = {
                record_type: 'quicksoap',
                dictations: dictations,
                input: input,
                report: report,
                lastInput: lastInput,
                petName: petName || null,
                // Desktop saves don't have sent_to_desktop flag - this is desktop-originated
                sent_to_desktop: undefined
            };

            // Use reportName if set, otherwise prioritize pet name
            const dateStr = new Date().toLocaleString();
            let finalReportName;
            const trimmedReportName = reportName.trim();

            // If pet name exists and reportName doesn't include it, use pet name
            if (petName && (!trimmedReportName || !trimmedReportName.includes(petName))) {
                finalReportName = `${petName} - ${dateStr}`;
            } else if (trimmedReportName) {
                // If reportName is set (and may already include pet name), use it
                finalReportName = trimmedReportName;
            } else if (petName) {
                // If pet name exists but no reportName, use pet name
                finalReportName = `${petName} - ${dateStr}`;
            } else {
                // Default fallback
                finalReportName = `QuickSOAP - ${dateStr}`;
            }

            const reportIdToUse = loadedReportId || draftRecordId;

            if (reportIdToUse) {
                // Update existing report (could be draft or completed)
                // Note: updated_at is automatically updated by database trigger
                const { error: updateError } = await supabase
                    .from('saved_reports')
                    .update({
                        report_name: finalReportName,
                        report_text: report, // Now has report - no longer a draft
                        form_data: formData,
                        record_type: 'quicksoap'
                    })
                    .eq('id', reportIdToUse)
                    .eq('user_id', userId);

                if (updateError) throw updateError;

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
                        record_type: 'quicksoap'
                    }])
                    .select()
                    .single();

                if (insertError) throw insertError;

                // Store the new report ID
                localStorage.setItem('currentQuickSOAPReportId', newReport.id);
            }

            setSaveMessageVisible(true);
            setTimeout(() => setSaveMessageVisible(false), 2000);
        } catch (err) {
            console.error('Error saving QuickSOAP record:', err);
            setError('Failed to save record. Please try again.');
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
            const draftName = `QuickSOAP Draft - ${new Date().toLocaleDateString()}`;

            // Prepare form_data with sent_to_desktop flag
            const formData = {
                record_type: 'quicksoap',
                dictations: dictations,
                input: input,
                report: null,
                lastInput: lastInput,
                sent_to_desktop: true, // Mark as sent to desktop
                sent_to_desktop_at: new Date().toISOString() // Timestamp
            };

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
                    record_type: 'quicksoap'
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
                setTimeout(() => setShowSendSuccessModal(false), 3000);
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

    const getSectionColor = (sectionName) => {
        const name = sectionName.toLowerCase();
        if (name.includes('subjective')) return {
            border: '#3b82f6',
            header: 'bg-gradient-to-r from-blue-500 to-blue-700',
            bg: 'bg-blue-50'
        };
        if (name.includes('objective')) return {
            border: '#10b981',
            header: 'bg-gradient-to-r from-green-500 to-green-700',
            bg: 'bg-green-50'
        };
        if (name.includes('assessment')) return {
            border: '#f59e0b',
            header: 'bg-gradient-to-r from-amber-500 to-amber-700',
            bg: 'bg-amber-50'
        };
        if (name.includes('plan')) return {
            border: '#ef4444',
            header: 'bg-gradient-to-r from-red-500 to-red-700',
            bg: 'bg-red-50'
        };
        return {
            border: '#6b7280',
            header: 'bg-gradient-to-r from-gray-500 to-gray-700',
            bg: 'bg-gray-50'
        };
    };

    return (
        <>
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


            {/* Save Prompt Modal (Desktop - when loading new dictation with report open) */}

            {/* Success Modal (Send to Desktop) */}
            {showSendSuccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50" style={{ left: isMobile ? '0' : (isSidebarCollapsed ? '80px' : '224px') }}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 animate-fadeIn">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaCheckCircle className="text-2xl text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Dictations Sent!</h3>
                            <p className="text-gray-600 mb-4">
                                Check <span className="font-semibold text-primary-600">Saved Records</span> on your desktop
                            </p>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                <p className="text-xs text-blue-600 mb-1">
                                    ⏱️ It may take 1-2 minutes for the report to appear
                                </p>
                                <p className="text-xs text-blue-600 font-medium">
                                    ✓ Dictations saved to cloud
                                </p>
                            </div>
                            <button
                                onClick={() => setShowSendSuccessModal(false)}
                                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-all"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Start New Confirmation Modal (Mobile only) */}
            {showStartNewModal && isMobile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50" style={{ left: '0' }}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 animate-fadeIn">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">Start New</h3>
                            <button
                                onClick={() => setShowStartNewModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <FaTimes className="text-lg" />
                            </button>
                        </div>
                        <div className="mb-6">
                            <p className="text-gray-700 mb-3">
                                If you start new and haven't sent this dictation to desktop it will be deleted.
                            </p>
                            <p className="text-gray-600 font-medium">
                                Are you sure you want to start a new dictation?
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowStartNewModal(false)}
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    // Clear all state
                                    setDictations([]);
                                    setInput('');
                                    setLastInput('');
                                    setHasBeenSentToDesktop(false);
                                    setPetName(null);
                                    setReport('');
                                    setParsedReport({ sections: [], rawText: '' });
                                    setHasReport(false);
                                    setReportName('');
                                    setIsEditingReportName(false);
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
                                    setShowStartNewModal(false);
                                }}
                                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-all"
                            >
                                Start New
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={`${isMobile ? 'h-screen overflow-hidden' : 'min-h-screen overflow-hidden'} bg-gradient-to-br from-gray-50 via-white to-gray-50 flex relative w-full`} style={isMobile ? { overflowY: 'hidden', height: '100vh', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } : {}}>
                {/* Left Side - Input Area */}
                <div
                    className={isMobile ? 'relative w-full h-full z-40 overflow-hidden' : 'fixed top-0 bottom-0 z-40'}
                    style={{
                        ...(isMobile ? { overflowY: 'hidden', height: '100vh' } : {}),
                        ...(hasReport ? {
                            left: isMobile ? '0' : (isSidebarCollapsed ? '80px' : '224px'),
                            width: isMobile ? '100%' : '25%',
                            backgroundColor: 'white',
                            borderRight: isMobile ? 'none' : '2px solid #e5e7eb',
                            opacity: isTransitioning ? 0 : 1,
                            transform: isTransitioning ? 'translateX(-150px)' : 'translateX(0)',
                            transition: 'opacity 0.4s ease-in-out, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s ease-in-out, width 0.3s ease-in-out'
                        } : {
                            left: isMobile ? '0' : (isSidebarCollapsed ? '80px' : '224px'),
                            width: isMobile ? '100%' : (isSidebarCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 224px)'),
                            backgroundColor: isMobile ? 'white' : 'transparent',
                            opacity: isTransitioning ? 0 : 1,
                            transform: isTransitioning ? 'scale(0.95)' : 'scale(1)',
                            transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out, left 0.3s ease-in-out, width 0.3s ease-in-out'
                        })
                    }}
                >
                    {!hasReport && !isLoadingFromSaved ? (
                        // Centered floating input before report generation
                        <div className={`h-full flex flex-col ${dictations.length > 0 && isMobile && !isRecording ? 'items-center justify-start' : 'items-center justify-center'} px-8 ${isMobile ? 'overflow-hidden' : ''}`} style={dictations.length > 0 && isMobile && !isRecording ? { maxHeight: '100vh', overflowY: 'hidden', height: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', paddingTop: '6rem' } : (isMobile ? { maxHeight: '100vh', overflowY: 'hidden', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' } : {})}>
                            {/* Header */}
                            {(!isRecording || !isMobile) && (
                                <div className={`${dictations.length > 0 && isMobile ? 'mb-4' : (isMobile ? 'mb-4' : 'mb-8')} text-center relative flex-shrink-0 w-full`}>
                                    {dictations.length === 0 || !isMobile ? (
                                        <>
                                            {/* Disclaimer */}
                                            {!isMobile && (
                                                <div className="mb-12 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg max-w-2xl mx-auto">
                                                    <p className="text-sm text-blue-800">
                                                        🎉 QuickSOAP is a new feature we're excited to share with you! Please bear with us as we continue to improve it, and we'd love to hear your feedback at{' '}
                                                        <a href="mailto:support@petwise.vet" className="font-semibold underline hover:text-blue-900">support@petwise.vet</a>
                                                    </p>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-center gap-3">
                                                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent mb-2 flex items-center gap-2">
                                                    QuickSOAP
                                                    <span className="text-sm font-semibold text-yellow-500 uppercase tracking-wide">beta</span>
                                                </h1>
                                                <div className="relative group mb-2">
                                                    <button
                                                        onClick={() => {
                                                            setShowTutorial(true);
                                                            setTutorialStep(0);
                                                        }}
                                                        className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-all cursor-pointer"
                                                        title="Quick SOAP tutorial"
                                                    >
                                                        <FaQuestionCircle className="text-gray-600 text-sm" />
                                                    </button>
                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                        Quick SOAP tutorial
                                                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-gray-500 text-sm">
                                                {isMobile
                                                    ? 'Record dictations to generate SOAP reports, then send to your desktop'
                                                    : 'Record dictations or type notes to generate SOAP reports'
                                                }
                                            </p>
                                        </>
                                    ) : (
                                        <h2 className="text-xl font-semibold text-primary-700 text-center w-full">
                                            Your Dictations
                                        </h2>
                                    )}
                                </div>
                            )}

                            {/* Error Message */}
                            {error && (
                                <div className={`${dictations.length > 0 && isMobile ? 'mb-2' : (isMobile ? 'mb-4' : 'mb-6')} w-full max-w-2xl bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm flex-shrink-0`}>
                                    <p className="text-red-600 text-sm text-center">{error}</p>
                                </div>
                            )}

                            {/* Generation Banner - Desktop Only */}
                            {isGenerating && !isMobile && !hasReport && (
                                <div className="mb-6 w-full max-w-2xl bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 flex-shrink-0">
                                    <FaSave className="text-xl flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="font-semibold text-base">Generating your SOAP report...</p>
                                        <p className="text-sm opacity-90">This report will be automatically saved to your records. Feel free to name it and edit it once it's generated.</p>
                                    </div>
                                </div>
                            )}

                            {/* Dictation Bubbles - Above center */}
                            {dictations.length > 0 && (!isRecording || !isMobile) && (
                                <div className={`${dictations.length > 0 && isMobile ? 'mb-6 flex-shrink-0' : (isMobile ? 'mb-4 flex-shrink-0' : 'mb-6')} w-full max-w-2xl ${isMobile ? 'overflow-y-auto max-h-40' : 'overflow-y-auto max-h-80'} ${isMobile ? 'space-y-2' : 'space-y-3'}`} style={isMobile ? {
                                    WebkitOverflowScrolling: 'touch',
                                    overflowY: 'auto'
                                } : {}}>
                                    {(isMobile ? [...dictations].reverse() : dictations).map((dictation) => (
                                        <div
                                            key={dictation.id}
                                            className={`bg-white border border-gray-200 rounded-xl ${isMobile ? 'p-2' : 'p-4'} shadow-md hover:shadow-lg transition-shadow`}
                                        >
                                            <div className={`flex items-start justify-between ${isMobile ? 'gap-2' : 'gap-3'}`}>
                                                <div className="flex-1 min-w-0">
                                                    <div className={`flex items-center ${isMobile ? 'gap-1 mb-1' : 'gap-2 mb-2'}`}>
                                                        <span className={`${isMobile ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'} font-semibold text-primary-600 bg-primary-50 rounded`}>
                                                            {dictation.expanded ? 'Full Transcript' : 'Dictation Summary'}
                                                        </span>
                                                        <button
                                                            onClick={() => toggleDictationExpand(dictation.id)}
                                                            className={`text-gray-500 hover:text-gray-700 ${isMobile ? 'text-[10px]' : 'text-xs'} flex items-center gap-1 transition-colors`}
                                                        >
                                                            {dictation.expanded ? (
                                                                <>
                                                                    <FaChevronUp className={isMobile ? 'text-[10px]' : 'text-xs'} />
                                                                    <span>Collapse</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <FaChevronDown className={isMobile ? 'text-[10px]' : 'text-xs'} />
                                                                    <span>Expand</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-700 ${isMobile ? 'leading-tight' : 'leading-relaxed'}`}>
                                                        {dictation.expanded ? dictation.fullText : dictation.summary}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteDictationClick(dictation.id)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                                                    title="Remove dictation"
                                                >
                                                    <FaTimes className={isMobile ? 'text-xs' : 'text-sm'} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Waveform Visualization */}
                            {isRecording && !isPaused && audioLevels.length > 0 && (
                                <div className={`${isMobile ? 'mb-4' : 'mb-6'} flex items-end justify-center gap-1 h-20 px-2 flex-shrink-0`}>
                                    {audioLevels.map((level, index) => (
                                        <div
                                            key={index}
                                            className="bg-primary-600 rounded-t transition-all duration-75 ease-out"
                                            style={{
                                                width: '5px',
                                                height: `${level}%`,
                                                minHeight: '12px',
                                                maxHeight: '80px',
                                                opacity: 0.8 + (level / 100) * 0.2
                                            }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Main Input Container - ChatGPT style */}
                            <div className="w-full max-w-2xl">
                                {/* Large Microphone Button - Front and Center */}
                                {/* Desktop: Only show when no dictations exist (one dictation before generating) */}
                                {/* Mobile: Only show when no dictations exist (one dictation at a time) */}
                                {!isRecording && dictations.length === 0 && !hasReport && !isLoadingFromSaved && (
                                    <div className={`flex justify-center ${isMobile ? 'mb-4 flex-shrink-0' : 'mb-6'}`}>
                                        <button
                                            onClick={startRecording}
                                            disabled={isTranscribing || isGenerating}
                                            className={`${isMobile ? 'w-24 h-24' : 'w-28 h-28'} rounded-full bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none`}
                                            title="Start Recording"
                                        >
                                            <FaMicrophone className={isMobile ? 'text-3xl' : 'text-4xl'} />
                                        </button>
                                    </div>
                                )}

                                {/* Recording Controls */}
                                {isRecording && (
                                    <div className={`flex flex-col items-center gap-4 ${isMobile ? 'mb-4 flex-shrink-0' : 'mb-6'}`}>
                                        <div className="flex items-center gap-4">
                                            {!isPaused ? (
                                                <button
                                                    onClick={pauseRecording}
                                                    className={`${isMobile ? 'w-20 h-20' : 'w-20 h-20'} rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center`}
                                                    title="Pause Recording"
                                                >
                                                    <FaPause className={isMobile ? 'text-2xl' : 'text-xl'} />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={resumeRecording}
                                                    className={`${isMobile ? 'w-20 h-20' : 'w-20 h-20'} rounded-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center`}
                                                    title="Resume Recording"
                                                >
                                                    <FaPlay className={isMobile ? 'text-2xl' : 'text-xl'} />
                                                </button>
                                            )}
                                            <button
                                                onClick={stopRecording}
                                                className={`${isMobile ? 'w-24 h-24' : 'w-24 h-24'} rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center animate-pulse`}
                                                title="Stop Recording"
                                            >
                                                <FaStop className={isMobile ? 'text-3xl' : 'text-2xl'} />
                                            </button>
                                        </div>
                                        <p className="text-sm font-medium text-gray-600">
                                            {isPaused ? 'Paused' : 'Listening...'}
                                        </p>
                                    </div>
                                )}

                                {/* Transcribing Indicator */}
                                {isTranscribing && (
                                    <div className={`flex flex-col items-center gap-2 ${isMobile ? 'mb-4 flex-shrink-0' : 'mb-6'}`}>
                                        <div className="flex items-center gap-3 text-gray-600">
                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-600 border-t-transparent"></div>
                                            <span className="text-sm font-medium">Transcribing...</span>
                                        </div>
                                        {needsSegmentation && (
                                            <span className="text-xs text-gray-500 text-center px-4">
                                                Hang tight! Longer recordings can take up to 3 minutes to transcribe.
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Add More Dictation Button - Show after transcription completes */}
                                {!isRecording && dictations.length > 0 && !isTranscribing && !hasReport && !isLoadingFromSaved && (
                                    <div className={`flex justify-center ${dictations.length > 0 && isMobile ? 'mt-4 mb-2 flex-shrink-0' : (isMobile ? 'mb-4 flex-shrink-0' : 'mb-6')}`}>
                                        <button
                                            onClick={startRecording}
                                            disabled={isGenerating}
                                            className={`${isMobile ? 'w-24 h-24' : 'w-28 h-28'} rounded-full bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none relative`}
                                            title="Add More Dictation"
                                        >
                                            <FaMicrophone className={isMobile ? 'text-3xl' : 'text-4xl'} />
                                            <FaPlus className={`absolute ${isMobile ? 'text-lg' : 'text-xl'} bottom-1 right-1 bg-white text-primary-600 rounded-full p-1`} />
                                        </button>
                                    </div>
                                )}

                                {/* Generate Button - Show only after dictation is complete (Desktop only) */}
                                {!isMobile && !hasReport && dictations.length > 0 && !isTranscribing && (
                                    <div className="flex justify-center mt-4">
                                        <button
                                            onClick={handleGenerateSOAP}
                                            disabled={isGenerating}
                                            className="px-8 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-base transition-all duration-200 shadow-md hover:shadow-lg disabled:shadow-none"
                                        >
                                            {isGenerating ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                                    <span>Generating...</span>
                                                </div>
                                            ) : (
                                                'Generate SOAP'
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* Mobile: Send to Desktop Button */}
                                {isMobile && dictations.length > 0 && !isRecording && (
                                    <div className="w-full max-w-2xl mt-3 space-y-2 flex-shrink-0">
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
                        // Sidebar layout when report is generated
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

                            {/* Error Message */}
                            {error && (
                                <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-3 rounded-r-lg flex-shrink-0">
                                    <p className="text-red-600 text-xs">{error}</p>
                                </div>
                            )}

                            {/* Dictation Bubbles - Scrollable Container */}
                            {dictations.length > 0 && (
                                <div className="mb-4 overflow-y-auto max-h-48 space-y-2 flex-shrink-0">
                                    {dictations.map((dictation) => (
                                        <div
                                            key={dictation.id}
                                            className="bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-semibold text-blue-700">
                                                            {dictation.expanded ? 'Full Transcript' : 'Dictation Summary'}
                                                        </span>
                                                        <button
                                                            onClick={() => toggleDictationExpand(dictation.id)}
                                                            className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                                                        >
                                                            {dictation.expanded ? (
                                                                <>
                                                                    <FaChevronUp className="text-xs" />
                                                                    <span>Collapse</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <FaChevronDown className="text-xs" />
                                                                    <span>Expand</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                    <p className="text-sm text-gray-700">
                                                        {dictation.expanded ? dictation.fullText : dictation.summary}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteDictationClick(dictation.id)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Remove dictation"
                                                >
                                                    <FaTimes className="text-xs" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add More Dictation Button - Show in generated view */}
                            {!isMobile && !isRecording && dictations.length > 0 && !isTranscribing && hasReport && (
                                <div className="mb-4 flex justify-center flex-shrink-0">
                                    <button
                                        onClick={startRecording}
                                        disabled={isGenerating}
                                        className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none relative"
                                        title="Add More Dictation"
                                    >
                                        <FaMicrophone className="text-xl" />
                                        <FaPlus className="absolute text-sm bottom-1 right-1 bg-white text-primary-600 rounded-full p-1" />
                                    </button>
                                </div>
                            )}

                            {/* Transcribing Indicator */}
                            {isTranscribing && (
                                <div className="mb-4 flex flex-col items-center gap-2 flex-shrink-0">
                                    <div className="flex items-center gap-3 text-gray-600">
                                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-600 border-t-transparent"></div>
                                        <span className="text-sm font-medium">Transcribing...</span>
                                    </div>
                                    {needsSegmentation && (
                                        <span className="text-xs text-gray-500 text-center px-4">
                                            Hang tight! Longer recordings can take up to 3 minutes to transcribe.
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Input Textarea (Desktop only) */}
                            {!isMobile && (
                                <div className="mb-4 flex-shrink-0">
                                    <textarea
                                        ref={sidebarInputTextareaRef}
                                        value={input}
                                        onChange={(e) => {
                                            setInput(e.target.value);
                                            setTimeout(() => adjustSidebarInputTextareaHeight(), 0);
                                        }}
                                        onInput={() => adjustSidebarInputTextareaHeight()}
                                        placeholder="Add additional notes here (optional)..."
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary-400 focus:ring-4 focus:ring-primary-100 focus:outline-none resize-none text-gray-900 placeholder-gray-400 text-sm"
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            wordWrap: 'break-word',
                                            height: 'auto',
                                            overflow: 'hidden'
                                        }}
                                        disabled={isTranscribing || isGenerating}
                                    />
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex flex-col gap-3 flex-shrink-0">
                                {/* Recording Controls - Only show when recording in generated view, always show in ungenerated view */}
                                {(isRecording || !hasReport) && (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="flex justify-center items-center gap-3">
                                            {isRecording && !isPaused && (
                                                <button
                                                    onClick={pauseRecording}
                                                    disabled={isTranscribing || isGenerating}
                                                    className={`rounded-full flex items-center justify-center transition-all duration-200 shadow-lg bg-yellow-500 hover:bg-yellow-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed ${isMobile ? 'w-20 h-20' : 'w-16 h-16'}`}
                                                    title="Pause Recording"
                                                >
                                                    <FaPause className={isMobile ? 'text-xl' : 'text-lg'} />
                                                </button>
                                            )}
                                            {isRecording && isPaused && (
                                                <button
                                                    onClick={resumeRecording}
                                                    disabled={isTranscribing || isGenerating}
                                                    className={`rounded-full flex items-center justify-center transition-all duration-200 shadow-lg bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed ${isMobile ? 'w-20 h-20' : 'w-16 h-16'}`}
                                                    title="Resume Recording"
                                                >
                                                    <FaPlay className={isMobile ? 'text-xl' : 'text-lg'} />
                                                </button>
                                            )}
                                            <button
                                                onClick={isRecording ? stopRecording : startRecording}
                                                disabled={isTranscribing || isGenerating}
                                                className={`rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${isRecording
                                                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                                                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                                                    } disabled:bg-gray-300 disabled:cursor-not-allowed disabled:animate-none ${isMobile ? 'w-24 h-24' : 'w-20 h-20'}`}
                                                title={isRecording ? 'Stop Recording' : 'Start Recording'}
                                            >
                                                {isRecording ? <FaStop className={isMobile ? 'text-2xl' : 'text-xl'} /> : <FaMicrophone className={isMobile ? 'text-2xl' : 'text-xl'} />}
                                            </button>
                                        </div>
                                        {isRecording && (
                                            <p className="text-xs font-medium text-gray-600">
                                                {isPaused ? 'Paused' : 'Listening...'}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {!isMobile && dictations.length > 0 && !isTranscribing && (
                                    <>
                                        <button
                                            onClick={handleGenerateSOAP}
                                            disabled={isGenerating}
                                            className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                                        >
                                            {isGenerating ? 'Generating...' : hasReport ? 'Regenerate SOAP' : 'Generate SOAP'}
                                        </button>
                                        {hasReport && (
                                            <button
                                                onClick={handleClearReport}
                                                disabled={isGenerating}
                                                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200 shadow-sm text-sm"
                                            >
                                                Start New
                                            </button>
                                        )}
                                    </>
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
                    )}
                </div>

                {/* Right Side - Report Display */}
                {hasReport && !isMobile && (
                    <div
                        ref={(el) => {
                            if (el) reportScrollContainerRef.current = el;
                        }}
                        className="fixed top-0 right-0 bottom-0 bg-gray-50 overflow-y-auto z-30"
                        style={{
                            // Start after sidebar + input (25% of viewport)
                            left: isMobile ? '0' : (isSidebarCollapsed ? 'calc(80px + 25%)' : 'calc(224px + 25%)'),
                            width: isMobile ? '100%' : (isSidebarCollapsed ? 'calc(75% - 80px)' : 'calc(75% - 224px)'),
                            paddingTop: '20px',
                            paddingBottom: '40px',
                            opacity: isTransitioning ? 0 : 1,
                            transform: isTransitioning ? 'translateX(100px)' : 'translateX(0)',
                            transition: 'opacity 0.4s ease-in-out, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s ease-in-out, width 0.3s ease-in-out'
                        }}>
                        <div className="max-w-5xl mx-auto px-8 py-4">
                            {/* Generation Banner - Desktop Only */}
                            {isGenerating && !isMobile && (
                                <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-4 rounded-xl shadow-lg mb-6 flex items-center gap-3">
                                    <FaSave className="text-xl flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="font-semibold text-base">Generating your SOAP report...</p>
                                        <p className="text-sm opacity-90">This report will be automatically saved to your records. Feel free to name it and edit it once it's generated.</p>
                                    </div>
                                </div>
                            )}
                            {/* Report Title - Editable */}
                            <div className="mb-3">
                                {isEditingReportName ? (
                                    <input
                                        type="text"
                                        value={reportName}
                                        onChange={(e) => setReportName(e.target.value)}
                                        onBlur={() => setIsEditingReportName(false)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                setIsEditingReportName(false);
                                            }
                                        }}
                                        className="w-full text-lg font-semibold text-black bg-transparent border-b-2 border-gray-300 focus:border-primary-600 focus:outline-none pb-1"
                                        autoFocus
                                    />
                                ) : (
                                    <h2
                                        className="text-lg font-semibold text-black cursor-text transition-colors pb-1 border-b-2 border-transparent hover:border-primary-600"
                                        onClick={() => setIsEditingReportName(true)}
                                        title="Click to edit report name"
                                    >
                                        {reportName || `QuickSOAP - ${new Date().toLocaleString()}`}
                                    </h2>
                                )}
                            </div>

                            {/* Report Header */}
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500">Generated from your clinical notes</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isAuthenticated && (
                                        <button
                                            onClick={handleSaveRecord}
                                            disabled={isSaving || !hasReport}
                                            className={`px-3 py-1.5 rounded text-sm transition-all border-none cursor-pointer ${saveMessageVisible
                                                ? 'bg-[#5cccf0] text-white'
                                                : 'bg-[#3369bd] text-white hover:bg-[#2c5aa3]'
                                                } disabled:bg-[#95a5a6] disabled:cursor-not-allowed flex items-center gap-1.5`}
                                            style={{ fontSize: '0.9rem' }}
                                            title="Save record"
                                        >
                                            <FaSave className="text-xs" />
                                            {isSaving ? 'Saving...' : saveMessageVisible ? 'Saved!' : 'Save'}
                                        </button>
                                    )}
                                    <button
                                        onClick={copyAll}
                                        className={`px-3 py-1.5 rounded text-sm transition-all border-none cursor-pointer ${copiedSection === 'all'
                                            ? 'bg-[#5cccf0] text-white'
                                            : 'bg-[#3369bd] text-white hover:bg-[#2c5aa3]'
                                            }`}
                                        style={{ fontSize: '0.9rem' }}
                                    >
                                        {copiedSection === 'all' ? '✓ Copied!' : 'Copy All'}
                                    </button>
                                    {isAuthenticated && hasReport && (
                                        <button
                                            onClick={handleSaveAndClear}
                                            disabled={isSaving || !hasReport}
                                            className="px-3 py-1.5 rounded text-sm transition-all border-none cursor-pointer bg-green-200 text-green-800 hover:bg-green-300 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-1.5"
                                            style={{ fontSize: '0.9rem' }}
                                            title="Save record and clear"
                                        >
                                            <FaSave className="text-xs" />
                                            Save & Clear
                                        </button>
                                    )}
                                    <button
                                        onClick={handleClearReport}
                                        className="px-3 py-1.5 rounded text-sm transition-all border-none cursor-pointer bg-red-200 text-red-800 hover:bg-red-300"
                                        style={{ fontSize: '0.9rem' }}
                                        title="Clear report and return to input"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {/* Loader or Report Content */}
                            {isGenerating && isReportTransitioning ? (
                                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-16 flex flex-col items-center justify-center min-h-[400px]">
                                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mb-4"></div>
                                    <p className="text-gray-600 text-lg font-medium">Generating SOAP report...</p>
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
                                    {/* Unified SOAP Record Card */}
                                    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                                        {parsedReport.sections.map((section, index) => {
                                            const colors = getSectionColor(section.name);

                                            return (
                                                <div
                                                    key={index}
                                                    className={`border-l-4 ${index < parsedReport.sections.length - 1 ? 'border-b border-gray-200' : ''}`}
                                                    style={{ borderLeftColor: colors.border }}
                                                >
                                                    {/* Section Header */}
                                                    <div className={`${colors.header} px-6 py-3 flex items-center justify-between`}>
                                                        <h3 className="text-white font-semibold text-lg tracking-wide">
                                                            {section.name.charAt(0)} – {section.name}
                                                        </h3>
                                                        <button
                                                            onClick={() => copySection(section.name, section.content)}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${copiedSection === section.name
                                                                ? 'bg-white text-blue-600'
                                                                : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                                                                }`}
                                                        >
                                                            <FaCopy className="text-xs" />
                                                            {copiedSection === section.name ? 'Copied!' : 'Copy'}
                                                        </button>
                                                    </div>

                                                    {/* Section Content */}
                                                    <div className={`${colors.bg} px-6 py-4`}>
                                                        <textarea
                                                            ref={(el) => {
                                                                if (el) {
                                                                    textareaRefs.current[`section-${index}`] = el;
                                                                    // One time auto size when mounted
                                                                    setTimeout(() => adjustTextareaHeight(index, el), 0);
                                                                }
                                                            }}
                                                            value={section.content}
                                                            onChange={(e) => {
                                                                isManualEditRef.current = true;
                                                                const newSections = [...parsedReport.sections];
                                                                newSections[index].content = e.target.value;

                                                                // Update parsed sections
                                                                setParsedReport(prev => ({ ...prev, sections: newSections }));

                                                                // Update full report string for persistence
                                                                const newReport = newSections
                                                                    .map(s => `${s.name}:\n${s.content}`)
                                                                    .join('\n\n');
                                                                setReport(newReport);

                                                                // Resize this textarea only (no scroll manipulation)
                                                                adjustTextareaHeight(index, e.target);
                                                            }}
                                                            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none text-gray-800 leading-relaxed bg-white text-sm"
                                                            style={{
                                                                fontFamily: 'inherit',
                                                                lineHeight: '1.6',
                                                                height: 'auto',
                                                                overflowY: 'auto',
                                                                whiteSpace: 'pre-wrap',
                                                                wordWrap: 'break-word',
                                                                scrollMargin: '0px',
                                                                scrollPadding: '0px',
                                                                scrollBehavior: 'auto'
                                                            }}
                                                            onFocus={(e) => {
                                                                // Prevent scroll-into-view when focusing
                                                                e.target.scrollIntoView = () => { };
                                                            }}
                                                            onInput={(e) => {
                                                                // Prevent scroll during input by restoring scroll position
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
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tutorial Modal */}
                {showTutorial && (() => {
                    // Check mobile status directly to ensure accurate detection
                    const isMobileDevice = typeof window !== 'undefined' && window.innerWidth <= 768;
                    return (
                        <div
                            className="fixed bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fadeIn"
                            onClick={() => setShowTutorial(false)}
                            style={{
                                left: isMobileDevice ? '0' : (isSidebarCollapsed ? '80px' : '224px'),
                                right: '0',
                                top: '0',
                                bottom: '0',
                                animation: 'fadeIn 0.3s ease-out'
                            }}
                        >
                            <div
                                className={`bg-white rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col transform transition-all ${isMobileDevice ? 'max-w-full mx-1 max-h-[95vh]' : 'max-w-4xl max-h-[90vh]'}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    animation: 'slideUpScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                }}
                            >
                                {/* Tutorial Header */}
                                <div className={`bg-gradient-to-r from-primary-600 to-primary-700 flex items-center justify-between flex-shrink-0 ${isMobileDevice ? 'px-3 py-2' : 'px-6 py-4'}`}>
                                    <h2 className={`font-bold text-white ${isMobileDevice ? 'text-base' : 'text-2xl'}`}>
                                        {isMobileDevice ? 'QuickSOAP Mobile Tutorial' : 'QuickSOAP Tutorial'}
                                    </h2>
                                    <button
                                        onClick={() => setShowTutorial(false)}
                                        className="text-white hover:text-gray-200 transition-colors flex-shrink-0"
                                    >
                                        <FaTimes className={isMobileDevice ? 'text-base' : 'text-xl'} />
                                    </button>
                                </div>

                                {/* Tutorial Content */}
                                <div className={`flex-1 overflow-y-auto ${isMobileDevice ? 'p-3' : 'p-8'}`}>
                                    {isMobileDevice ? (
                                        // Mobile Tutorial
                                        <>
                                            {tutorialStep === 0 && (
                                                <div className={`${isMobileDevice ? 'space-y-3' : 'space-y-6'}`}>
                                                    <div className="text-center">
                                                        <h3 className={`font-bold text-gray-800 mb-2 ${isMobileDevice ? 'text-lg' : 'text-2xl'}`}>Welcome to QuickSOAP Mobile</h3>
                                                        <p className={`text-gray-600 ${isMobileDevice ? 'text-sm' : 'text-lg'}`}>Record dictations on your mobile device and send them to your desktop to generate professional SOAP reports.</p>
                                                    </div>
                                                    <div className={`bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 ${isMobileDevice ? 'p-4' : 'p-6'}`}>
                                                        <div className="flex flex-col items-center justify-center space-y-3">
                                                            <div className={`rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg ${isMobileDevice ? 'w-16 h-16' : 'w-20 h-20'}`}>
                                                                <FaMicrophone className={`text-white ${isMobileDevice ? 'text-2xl' : 'text-3xl'}`} />
                                                            </div>
                                                            <div className="text-center">
                                                                <p className={`text-gray-700 font-semibold mb-1 ${isMobileDevice ? 'text-sm' : 'mb-2'}`}>Step 1: Record Dictation</p>
                                                                <p className={`text-gray-600 ${isMobileDevice ? 'text-xs' : 'text-sm'}`}>Tap the microphone button to start recording your clinical notes</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className={`bg-blue-50 border border-blue-200 rounded-lg ${isMobileDevice ? 'p-2' : 'p-4'}`}>
                                                        <p className={`text-blue-700 text-center font-medium ${isMobileDevice ? 'text-[10px]' : 'text-xs'}`}>💡 Perfect for recording notes during patient exams in exam rooms</p>
                                                    </div>
                                                </div>
                                            )}

                                            {tutorialStep === 1 && (
                                                <div className={`${isMobileDevice ? 'space-y-3' : 'space-y-6'}`}>
                                                    <h3 className={`font-bold text-gray-800 mb-3 ${isMobileDevice ? 'text-lg' : 'text-2xl mb-4'}`}>Recording Your Dictation</h3>
                                                    <div className={`bg-gray-50 rounded-xl border border-gray-200 ${isMobileDevice ? 'p-3' : 'p-6'}`}>
                                                        <div className={`${isMobileDevice ? 'space-y-3' : 'space-y-4'}`}>
                                                            <div className={`flex items-center ${isMobileDevice ? 'gap-2' : 'gap-4'}`}>
                                                                <div className={`rounded-full bg-primary-600 flex items-center justify-center shadow-md flex-shrink-0 ${isMobileDevice ? 'w-10 h-10' : 'w-12 h-12'}`}>
                                                                    <FaMicrophone className={`text-white ${isMobileDevice ? 'text-xs' : 'text-sm'}`} />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className={`font-semibold text-gray-800 ${isMobileDevice ? 'text-xs' : ''}`}>Start Recording</p>
                                                                    <p className={`text-gray-600 ${isMobileDevice ? 'text-xs' : 'text-sm'}`}>Tap the large microphone button to begin recording</p>
                                                                </div>
                                                            </div>
                                                            <div className={`flex items-center ${isMobileDevice ? 'gap-2 mt-2' : 'gap-4 mt-4'}`}>
                                                                <div className={`rounded-full bg-yellow-500 flex items-center justify-center shadow-md flex-shrink-0 ${isMobileDevice ? 'w-10 h-10' : 'w-12 h-12'}`}>
                                                                    <FaPause className={`text-white ${isMobileDevice ? 'text-xs' : 'text-sm'}`} />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className={`font-semibold text-gray-800 ${isMobileDevice ? 'text-xs' : ''}`}>Pause/Resume</p>
                                                                    <p className={`text-gray-600 ${isMobileDevice ? 'text-xs' : 'text-sm'}`}>Pause if you need a moment, then resume</p>
                                                                </div>
                                                            </div>
                                                            <div className={`flex items-center ${isMobileDevice ? 'gap-2 mt-2' : 'gap-4 mt-4'}`}>
                                                                <div className={`rounded-full bg-red-500 flex items-center justify-center shadow-md flex-shrink-0 ${isMobileDevice ? 'w-10 h-10' : 'w-12 h-12'}`}>
                                                                    <FaStop className={`text-white ${isMobileDevice ? 'text-xs' : 'text-sm'}`} />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className={`font-semibold text-gray-800 ${isMobileDevice ? 'text-xs' : ''}`}>Stop Recording</p>
                                                                    <p className={`text-gray-600 ${isMobileDevice ? 'text-xs' : 'text-sm'}`}>Tap stop when you're finished speaking</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {tutorialStep === 2 && (
                                                <div className={`${isMobileDevice ? 'space-y-3' : 'space-y-6'}`}>
                                                    <h3 className={`font-bold text-gray-800 mb-3 ${isMobileDevice ? 'text-lg' : 'text-2xl mb-4'}`}>Review Your Dictation</h3>
                                                    <div className={`bg-gray-50 rounded-xl border border-gray-200 ${isMobileDevice ? 'p-3' : 'p-6'}`}>
                                                        <div className={`${isMobileDevice ? 'space-y-3' : 'space-y-4'}`}>
                                                            <div className={`bg-white rounded-lg border border-gray-200 ${isMobileDevice ? 'p-3' : 'p-4'}`}>
                                                                <div className={`flex items-center gap-2 ${isMobileDevice ? 'mb-1' : 'mb-2'}`}>
                                                                    <span className={`font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded ${isMobileDevice ? 'text-[10px]' : 'text-xs'}`}>Dictation Summary</span>
                                                                </div>
                                                                <p className={`text-gray-700 italic ${isMobileDevice ? 'text-xs' : 'text-sm'}`}>Your transcribed dictation will appear here...</p>
                                                            </div>
                                                            <p className={`text-gray-600 ${isMobileDevice ? 'text-xs' : 'text-sm'}`}>Review your dictation summary. You can expand to see the full transcript or remove it if needed.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {tutorialStep === 3 && (
                                                <div className={`${isMobileDevice ? 'space-y-3' : 'space-y-6'}`}>
                                                    <h3 className={`font-bold text-gray-800 mb-3 ${isMobileDevice ? 'text-lg' : 'text-2xl mb-4'}`}>Send to Desktop</h3>
                                                    <div className={`bg-gray-50 rounded-xl border border-gray-200 ${isMobileDevice ? 'p-3' : 'p-6'}`}>
                                                        <div className={`${isMobileDevice ? 'space-y-3' : 'space-y-4'}`}>
                                                            <div className="flex items-center justify-center">
                                                                <button
                                                                    disabled
                                                                    className={`bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg font-semibold shadow-md cursor-not-allowed opacity-75 flex items-center gap-2 ${isMobileDevice ? 'px-4 py-2 text-xs' : 'px-6 py-3'}`}
                                                                >
                                                                    <FaDesktop className={isMobileDevice ? 'text-sm' : 'text-base'} />
                                                                    Send to Desktop
                                                                </button>
                                                            </div>
                                                            <p className={`text-gray-600 text-center ${isMobileDevice ? 'text-xs' : 'text-sm'}`}>Once you've recorded your dictation, tap "Send to Desktop" to transfer it to your desktop computer</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {tutorialStep === 4 && (
                                                <div className={`${isMobileDevice ? 'space-y-3' : 'space-y-6'}`}>
                                                    <h3 className={`font-bold text-gray-800 mb-3 ${isMobileDevice ? 'text-lg' : 'text-2xl mb-4'}`}>Send to Desktop & Generate Report</h3>
                                                    <div className={`bg-gray-50 rounded-xl border border-gray-200 ${isMobileDevice ? 'p-3' : 'p-6'}`}>
                                                        <div className={`${isMobileDevice ? 'space-y-3' : 'space-y-4'}`}>
                                                            <div className="text-center">
                                                                <div className={`rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg mx-auto ${isMobileDevice ? 'w-12 h-12 mb-2' : 'w-16 h-16 mb-4'}`}>
                                                                    <FaDesktop className={`text-white ${isMobileDevice ? 'text-lg' : 'text-2xl'}`} />
                                                                </div>
                                                                <p className={`font-semibold text-gray-800 ${isMobileDevice ? 'text-xs mb-1' : 'mb-2'}`}>Generate Your SOAP Report</p>
                                                                <p className={`text-gray-600 ${isMobileDevice ? 'text-xs' : 'text-sm'}`}>After sending, generate your SOAP report on desktop. It will automatically save to Saved Records.</p>
                                                            </div>
                                                            <div className={`${isMobileDevice ? 'mt-2 space-y-2' : 'mt-4 space-y-3'}`}>
                                                                <div className={`flex items-start ${isMobileDevice ? 'gap-2' : 'gap-3'}`}>
                                                                    <div className={`rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold ${isMobileDevice ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'}`}>1</div>
                                                                    <p className={`text-gray-700 ${isMobileDevice ? 'text-xs' : 'text-sm'}`}>Go to <span className="font-semibold text-primary-600">Saved Records</span> on your desktop</p>
                                                                </div>
                                                                <div className={`flex items-start ${isMobileDevice ? 'gap-2' : 'gap-3'}`}>
                                                                    <div className={`rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold ${isMobileDevice ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'}`}>2</div>
                                                                    <p className={`text-gray-700 ${isMobileDevice ? 'text-xs' : 'text-sm'}`}>Open your dictation and click "Generate SOAP"</p>
                                                                </div>
                                                                <div className={`flex items-start ${isMobileDevice ? 'gap-2' : 'gap-3'}`}>
                                                                    <div className={`rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold ${isMobileDevice ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'}`}>3</div>
                                                                    <p className={`text-gray-700 ${isMobileDevice ? 'text-xs' : 'text-sm'}`}>Edit, add more dictations, or save changes - your report auto-saves</p>
                                                                </div>
                                                            </div>
                                                            <div className={`bg-green-50 border border-green-200 rounded-lg ${isMobileDevice ? 'mt-2 p-2' : 'mt-4 p-4'}`}>
                                                                <p className={`text-green-700 text-center font-medium ${isMobileDevice ? 'text-[10px]' : 'text-xs'}`}>✅ Your report automatically saves to Saved Records once generated</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        // Desktop Tutorial
                                        <>
                                            {tutorialStep === 0 && (
                                                <div className="space-y-6">
                                                    <div className="text-center">
                                                        <h3 className="text-2xl font-bold text-gray-800 mb-3">Welcome to QuickSOAP</h3>
                                                        <p className="text-gray-600 text-lg">Type or dictate your clinical notes to generate a SOAP report. Your record will automatically save to Saved Records.</p>
                                                    </div>
                                                    <div className="bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-300">
                                                        <div className="flex flex-col items-center justify-center space-y-4">
                                                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
                                                                <FaMicrophone className="text-white text-3xl" />
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-gray-700 font-semibold mb-2">Step 1: Record or Type</p>
                                                                <p className="text-gray-600 text-sm">Click the microphone to record dictations or type notes directly</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                                        <p className="text-sm text-blue-700 text-center font-medium">💾 Your record will automatically save to Saved Records once generated</p>
                                                    </div>
                                                </div>
                                            )}

                                            {tutorialStep === 1 && (
                                                <div className="space-y-6">
                                                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Recording Dictations</h3>
                                                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                                        <div className="space-y-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-md">
                                                                    <FaStop className="text-white text-xl" />
                                                                </div>
                                                                <div>
                                                                    <p className="font-semibold text-gray-800">Recording Controls</p>
                                                                    <p className="text-sm text-gray-600">Click the microphone to start, pause/resume as needed, and stop when finished</p>
                                                                </div>
                                                            </div>
                                                            <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded">Dictation Summary</span>
                                                                </div>
                                                                <p className="text-sm text-gray-700 italic">Your transcribed dictation will appear here...</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {tutorialStep === 2 && (
                                                <div className="space-y-6">
                                                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Generating Your SOAP Report</h3>
                                                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-center">
                                                                <button
                                                                    disabled
                                                                    className="px-6 py-3 bg-[#3369bd] text-white rounded-lg font-semibold shadow-md cursor-not-allowed opacity-75"
                                                                >
                                                                    Generate SOAP
                                                                </button>
                                                            </div>
                                                            <p className="text-sm text-gray-600 text-center">Click "Generate SOAP" to create your report from all dictations and notes</p>
                                                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                                                                <p className="text-sm text-green-700 text-center font-medium">✅ Your report will automatically save to Saved Records once generated</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {tutorialStep === 3 && (
                                                <div className="space-y-6">
                                                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Editing Your Report</h3>
                                                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                                        <div className="space-y-4">
                                                            <p className="text-sm text-gray-600 mb-4">Once your report is generated, you can:</p>
                                                            <div className="space-y-3">
                                                                <div className="flex items-start gap-3">
                                                                    <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold">1</div>
                                                                    <p className="text-sm text-gray-700"><strong>Add more dictations</strong> - Record additional notes that will be added to your report</p>
                                                                </div>
                                                                <div className="flex items-start gap-3">
                                                                    <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold">2</div>
                                                                    <p className="text-sm text-gray-700"><strong>Type additional notes</strong> - Add manual notes in the text field</p>
                                                                </div>
                                                                <div className="flex items-start gap-3">
                                                                    <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold">3</div>
                                                                    <p className="text-sm text-gray-700"><strong>Edit directly</strong> - Click any section to edit the content directly</p>
                                                                </div>
                                                            </div>
                                                            <div className="mt-4 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                                                                <div className="border-l-4 border-b border-gray-200" style={{ borderLeftColor: '#3b82f6' }}>
                                                                    <div className="bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-3 flex items-center justify-between">
                                                                        <h3 className="text-white font-semibold text-lg">S – Subjective</h3>
                                                                        <button disabled className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-white bg-opacity-20 text-white cursor-not-allowed">
                                                                            <FaCopy className="text-xs" />
                                                                            Copy
                                                                        </button>
                                                                    </div>
                                                                    <div className="bg-blue-50 px-6 py-4">
                                                                        <textarea
                                                                            disabled
                                                                            className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white text-sm"
                                                                            rows={3}
                                                                            value="Click here to edit this section directly..."
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {tutorialStep === 4 && (
                                                <div className="space-y-6">
                                                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Copy Sections & Save Changes</h3>
                                                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                                        <div className="space-y-4">
                                                            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                                                                <div className="border-l-4 border-b border-gray-200" style={{ borderLeftColor: '#3b82f6' }}>
                                                                    <div className="bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-3 flex items-center justify-between">
                                                                        <h3 className="text-white font-semibold text-lg">S – Subjective</h3>
                                                                        <button disabled className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-white bg-opacity-20 text-white cursor-not-allowed">
                                                                            <FaCopy className="text-xs" />
                                                                            Copy
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <p className="text-sm text-gray-600 mb-4">Each SOAP section has a <strong>Copy</strong> button to copy that section's content.</p>
                                                            <div className="flex items-center gap-2 justify-center">
                                                                <button disabled className="px-3 py-1.5 rounded text-sm bg-[#3369bd] text-white cursor-not-allowed opacity-75 flex items-center gap-1.5">
                                                                    <FaSave className="text-xs" />
                                                                    Save Changes
                                                                </button>
                                                            </div>
                                                            <p className="text-sm text-gray-600 text-center">Use <strong>Save Changes</strong> to update your report in Saved Records. Changes are automatically saved as you edit.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {tutorialStep === 5 && (
                                                <div className="space-y-6">
                                                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Use QuickSOAP on Mobile</h3>
                                                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                                        <div className="space-y-4">
                                                            <div className="text-center">
                                                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg mx-auto mb-4">
                                                                    <FaMobile className="text-white text-3xl" />
                                                                </div>
                                                                <p className="font-semibold text-gray-800 mb-2">Record Dictations in Exam Rooms</p>
                                                                <p className="text-sm text-gray-600">Use QuickSOAP on your phone to record notes during patient exams, then send them to your desktop to generate reports.</p>
                                                            </div>
                                                            <div className="mt-4 space-y-3">
                                                                <div className="flex items-start gap-3">
                                                                    <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold">1</div>
                                                                    <p className="text-sm text-gray-700">Open PetWise on your mobile device</p>
                                                                </div>
                                                                <div className="flex items-start gap-3">
                                                                    <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold">2</div>
                                                                    <p className="text-sm text-gray-700">Record your dictation in QuickSOAP Mobile</p>
                                                                </div>
                                                                <div className="flex items-start gap-3">
                                                                    <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold">3</div>
                                                                    <p className="text-sm text-gray-700">Send it to your desktop - you'll see a notification when it arrives</p>
                                                                </div>
                                                                <div className="flex items-start gap-3">
                                                                    <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold">4</div>
                                                                    <p className="text-sm text-gray-700">Generate and edit your SOAP report on desktop</p>
                                                                </div>
                                                            </div>
                                                            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                                                <p className="text-xs text-blue-600 text-center font-medium">💡 Perfect for recording notes during patient exams, then generating professional reports back at your desk</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                        </>
                                    )}
                                </div>

                                {/* Tutorial Footer */}
                                <div className={`border-t border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0 ${isMobileDevice ? 'px-2 py-2' : 'px-6 py-4'}`}>
                                    <div className={`flex items-center ${isMobileDevice ? 'gap-1' : 'gap-2'}`}>
                                        {(isMobileDevice ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5]).map((step) => (
                                            <div
                                                key={step}
                                                className={`rounded-full transition-all ${isMobileDevice ? 'h-1.5' : 'h-2'} ${tutorialStep === step ? `bg-[#3369bd] ${isMobileDevice ? 'w-6' : 'w-8'}` : `bg-gray-300 ${isMobileDevice ? 'w-1.5' : 'w-2'}`}`}
                                            />
                                        ))}
                                    </div>
                                    <div className={`flex items-center ${isMobileDevice ? 'gap-1.5' : 'gap-3'}`}>
                                        {tutorialStep > 0 && (
                                            <button
                                                onClick={() => setTutorialStep(tutorialStep - 1)}
                                                className={`rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all flex items-center gap-1 ${isMobileDevice ? 'px-2 py-1 text-xs' : 'px-4 py-2'}`}
                                            >
                                                <FaArrowLeft className={isMobileDevice ? 'text-xs' : 'text-sm'} />
                                                <span className={isMobileDevice ? 'hidden sm:inline' : ''}>Previous</span>
                                            </button>
                                        )}
                                        {tutorialStep < (isMobileDevice ? 4 : 5) ? (
                                            <button
                                                onClick={() => setTutorialStep(tutorialStep + 1)}
                                                className={`rounded-lg bg-[#3369bd] text-white hover:bg-[#2c5aa3] transition-all flex items-center gap-1 ${isMobileDevice ? 'px-2 py-1 text-xs' : 'px-4 py-2'}`}
                                            >
                                                <span className={isMobileDevice ? 'hidden sm:inline' : ''}>Next</span>
                                                <FaArrowRight className={isMobileDevice ? 'text-xs' : 'text-sm'} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setShowTutorial(false)}
                                                className={`rounded-lg bg-[#3369bd] text-white hover:bg-[#2c5aa3] transition-all ${isMobileDevice ? 'px-2 py-1 text-xs' : 'px-4 py-2'}`}
                                            >
                                                Get Started
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </>
    );
};

export default QuickSOAP;
