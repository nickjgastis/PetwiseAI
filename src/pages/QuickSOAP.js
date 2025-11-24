import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../supabaseClient';
import { FaMicrophone, FaStop, FaCopy, FaChevronDown, FaChevronUp, FaTimes, FaPause, FaPlay, FaSave, FaQuestionCircle, FaArrowRight, FaArrowLeft } from 'react-icons/fa';

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
    const [input, setInput] = useState('');
    const [dictations, setDictations] = useState([]); // Array of {id, fullText, summary, expanded}
    const [report, setReport] = useState('');
    const [parsedReport, setParsedReport] = useState({ sections: [], rawText: '' });
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [lastInput, setLastInput] = useState('');
    const [copiedSection, setCopiedSection] = useState(null);
    const [hasReport, setHasReport] = useState(false);
    const [audioLevels, setAudioLevels] = useState([]);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [isReportTransitioning, setIsReportTransitioning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessageVisible, setSaveMessageVisible] = useState(false);
    const [reportName, setReportName] = useState('');
    const [isEditingReportName, setIsEditingReportName] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const textareaRefs = useRef({});
    const inputTextareaRef = useRef(null);
    const sidebarInputTextareaRef = useRef(null);
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

    // Check for tutorial flag from Help center
    useEffect(() => {
        const openTutorialFlag = localStorage.getItem('openQuickSOAPTutorial');
        if (openTutorialFlag === 'true') {
            setShowTutorial(true);
            setTutorialStep(0);
            localStorage.removeItem('openQuickSOAPTutorial');
        }
    }, []);

    // Load from localStorage on mount (check for loaded QuickSOAP data first)
    useEffect(() => {
        // Check if we're loading a saved QuickSOAP record
        const loadedQuickSOAPData = localStorage.getItem('loadQuickSOAPData');
        const loadedDictations = localStorage.getItem('quickSOAP_dictations');
        const loadedInput = localStorage.getItem('quickSOAP_input');
        const loadedReport = localStorage.getItem('quickSOAP_report');
        const loadedLastInput = localStorage.getItem('quickSOAP_lastInput');

        const savedReportName = localStorage.getItem('quickSOAP_reportName');

        if (loadedQuickSOAPData === 'true') {
            // Loading from SavedReports - use the loaded data
            if (loadedDictations) {
                try {
                    setDictations(JSON.parse(loadedDictations));
                } catch (e) {
                    console.error('Failed to parse loaded dictations:', e);
                }
            }
            if (loadedInput) {
                setInput(loadedInput);
            }
            if (loadedLastInput) {
                setLastInput(loadedLastInput);
            }
            if (loadedReport) {
                setReport(loadedReport);
            }
            if (savedReportName) {
                setReportName(savedReportName);
            }
            // Keep currentQuickSOAPReportId for updates (set by handleLoadQuickSOAP)
            // Clear the load flag
            localStorage.removeItem('loadQuickSOAPData');
        } else {
            // Normal localStorage persistence (existing behavior)
            const savedDictations = localStorage.getItem('quickSOAP_dictations');
            const savedInput = localStorage.getItem('quickSOAP_input');
            const savedReport = localStorage.getItem('quickSOAP_report');
            const savedLastInput = localStorage.getItem('quickSOAP_lastInput');

            if (savedDictations) {
                try {
                    setDictations(JSON.parse(savedDictations));
                } catch (e) {
                    console.error('Failed to parse saved dictations:', e);
                }
            }
            if (savedInput) {
                setInput(savedInput);
            }
            if (savedLastInput) {
                setLastInput(savedLastInput);
            }
            if (savedReport) {
                setReport(savedReport);
            }
            if (savedReportName) {
                setReportName(savedReportName);
            }
        }
    }, []);

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
                setDictations(prev => [...prev, newDictation]);
                setLastInput(response.data.text);
            } else {
                throw new Error('No transcription received');
            }
        } catch (err) {
            console.error('Transcription error:', err);
            setError('Failed to transcribe audio. Please try again.');
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleGenerateSOAP = async () => {
        // Combine all dictations and manual input
        const allDictations = dictations.map(d => d.fullText).join('\n\n');
        const combinedInput = allDictations + (input.trim() ? '\n\n' + input.trim() : '');

        if (!combinedInput.trim()) {
            setError('Please enter or record some notes first.');
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
                        setReport(response.data.report);
                        // Set default report name if not already set
                        if (!reportName) {
                            setReportName(`QuickSOAP - ${new Date().toLocaleString()}`);
                        }
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
                    // Start transition - fade out center input
                    setIsTransitioning(true);
                    setTimeout(() => {
                        setReport(response.data.report);
                        // Set default report name if not already set
                        if (!reportName) {
                            setReportName(`QuickSOAP - ${new Date().toLocaleString()}`);
                        }
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
            const formData = {
                record_type: 'quicksoap',
                dictations: dictations,
                input: input,
                report: report,
                lastInput: lastInput
            };

            // Use reportName if set, otherwise generate default
            const finalReportName = reportName.trim() || `QuickSOAP - ${new Date().toLocaleString()}`;

            if (loadedReportId) {
                // Update existing report
                const { error: updateError } = await supabase
                    .from('saved_reports')
                    .update({
                        report_name: finalReportName,
                        report_text: report,
                        form_data: formData,
                        record_type: 'quicksoap' // Set record_type if column exists
                    })
                    .eq('id', loadedReportId)
                    .eq('user_id', userId);

                if (updateError) throw updateError;
            } else {
                // Create new report
                const { data: newReport, error: insertError } = await supabase
                    .from('saved_reports')
                    .insert([{
                        user_id: userId,
                        report_name: finalReportName,
                        report_text: report,
                        form_data: formData,
                        record_type: 'quicksoap' // Set record_type if column exists
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

    const removeDictation = (id) => {
        setDictations(prev => prev.filter(d => d.id !== id));
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
            `}</style>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex overflow-hidden relative w-full">
                {/* Left Side - Input Area */}
                <div
                    className={`fixed top-0 bottom-0 z-40`}
                    style={{
                        ...(hasReport ? {
                            left: '224px',
                            width: '25%',
                            backgroundColor: 'white',
                            borderRight: '2px solid #e5e7eb',
                            opacity: isTransitioning ? 0 : 1,
                            transform: isTransitioning ? 'translateX(-150px)' : 'translateX(0)',
                            transition: 'opacity 0.4s ease-in-out, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                        } : {
                            left: '224px',
                            width: 'calc(100% - 224px)',
                            backgroundColor: 'transparent',
                            opacity: isTransitioning ? 0 : 1,
                            transform: isTransitioning ? 'scale(0.95)' : 'scale(1)',
                            transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out'
                        })
                    }}
                >
                    {!hasReport ? (
                        // Centered floating input before report generation
                        <div className="h-full flex flex-col items-center justify-center px-8">
                            {/* Header */}
                            <div className="mb-8 text-center relative">
                                <div className="flex items-center justify-center gap-3">
                                    <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent mb-2">
                                        QuickSOAP
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
                                    Record dictations or type notes to generate SOAP reports
                                </p>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="mb-6 w-full max-w-2xl bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
                                    <p className="text-red-600 text-sm text-center">{error}</p>
                                </div>
                            )}

                            {/* Dictation Bubbles - Above center */}
                            {dictations.length > 0 && (
                                <div className="mb-6 w-full max-w-2xl space-y-3 max-h-64 overflow-y-auto">
                                    {dictations.map((dictation) => (
                                        <div
                                            key={dictation.id}
                                            className="bg-white border border-gray-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-1 rounded">
                                                            {dictation.expanded ? 'Full Transcript' : 'Dictation Summary'}
                                                        </span>
                                                        <button
                                                            onClick={() => toggleDictationExpand(dictation.id)}
                                                            className="text-gray-500 hover:text-gray-700 text-xs flex items-center gap-1 transition-colors"
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
                                                    <p className="text-sm text-gray-700 leading-relaxed">
                                                        {dictation.expanded ? dictation.fullText : dictation.summary}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => removeDictation(dictation.id)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                                                    title="Remove dictation"
                                                >
                                                    <FaTimes className="text-sm" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Waveform Visualization */}
                            {isRecording && !isPaused && audioLevels.length > 0 && (
                                <div className="mb-6 flex items-end justify-center gap-1 h-20 px-2">
                                    {audioLevels.map((level, index) => (
                                        <div
                                            key={index}
                                            className="bg-primary-500 rounded-t transition-all duration-75 ease-out"
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
                                {!isRecording && dictations.length === 0 && (
                                    <div className="flex justify-center mb-6">
                                        <button
                                            onClick={startRecording}
                                            disabled={isTranscribing || isGenerating}
                                            className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none"
                                            title="Start Recording"
                                        >
                                            <FaMicrophone className="text-2xl" />
                                        </button>
                                    </div>
                                )}

                                {/* Recording Controls */}
                                {isRecording && (
                                    <div className="flex flex-col items-center gap-4 mb-6">
                                        <div className="flex items-center gap-4">
                                            {!isPaused ? (
                                                <button
                                                    onClick={pauseRecording}
                                                    className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center"
                                                    title="Pause Recording"
                                                >
                                                    <FaPause className="text-xl" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={resumeRecording}
                                                    className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center"
                                                    title="Resume Recording"
                                                >
                                                    <FaPlay className="text-xl" />
                                                </button>
                                            )}
                                            <button
                                                onClick={stopRecording}
                                                className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center animate-pulse"
                                                title="Stop Recording"
                                            >
                                                <FaStop className="text-2xl" />
                                            </button>
                                        </div>
                                        <p className="text-sm font-medium text-gray-600">
                                            {isPaused ? 'Paused' : 'Listening...'}
                                        </p>
                                    </div>
                                )}

                                {/* Transcribing Indicator */}
                                {isTranscribing && (
                                    <div className="flex justify-center mb-6">
                                        <div className="flex items-center gap-3 text-gray-600">
                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-500 border-t-transparent"></div>
                                            <span className="text-sm font-medium">Transcribing...</span>
                                        </div>
                                    </div>
                                )}

                                {/* Input Bar - ChatGPT style */}
                                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 hover:border-gray-300 transition-all duration-200">
                                    <div className="flex items-end gap-2 p-3">
                                        <div className="flex-1">
                                            <textarea
                                                ref={inputTextareaRef}
                                                value={input}
                                                onChange={(e) => {
                                                    setInput(e.target.value);
                                                    adjustInputTextareaHeight();
                                                }}
                                                placeholder="Add additional notes (optional)..."
                                                className="w-full resize-none border-0 focus:outline-none text-gray-900 placeholder-gray-400 text-sm leading-5"
                                                style={{
                                                    whiteSpace: 'pre-wrap',
                                                    wordWrap: 'break-word',
                                                    minHeight: '24px',
                                                    maxHeight: '120px',
                                                    overflowY: 'auto',
                                                    height: '24px'
                                                }}
                                                disabled={isTranscribing || isGenerating}
                                                onKeyDown={(e) => {
                                                    const hasContent = dictations.length > 0 || input.trim();
                                                    if (e.key === 'Enter' && !e.shiftKey && !isGenerating && !isTranscribing && hasContent) {
                                                        e.preventDefault();
                                                        handleGenerateSOAP();
                                                    }
                                                }}
                                                rows={1}
                                            />
                                        </div>
                                        <button
                                            onClick={handleGenerateSOAP}
                                            disabled={(dictations.length === 0 && !input.trim()) || isGenerating || isTranscribing}
                                            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-all duration-200 shadow-sm hover:shadow disabled:shadow-none flex-shrink-0"
                                        >
                                            {isGenerating ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                    <span>Generating</span>
                                                </div>
                                            ) : (
                                                'Generate'
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Helper Text */}
                                <p className="text-xs text-gray-400 text-center mt-3">
                                    Press Enter to generate • Shift+Enter for new line
                                </p>
                            </div>
                        </div>
                    ) : (
                        // Sidebar layout when report is generated
                        <div className="h-full overflow-y-auto px-6 py-8 bg-white">
                            {/* Header */}
                            <div className="mb-6">
                                <h1 className="text-2xl font-bold text-primary-500 mb-2">
                                    QuickSOAP
                                </h1>
                                <p className="text-sm text-gray-600">
                                    Type or dictate your clinical notes
                                </p>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-3 rounded-r-lg">
                                    <p className="text-red-600 text-xs">{error}</p>
                                </div>
                            )}

                            {/* Dictation Bubbles */}
                            {dictations.length > 0 && (
                                <div className="mb-4 space-y-2">
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
                                                    onClick={() => removeDictation(dictation.id)}
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

                            {/* Input Textarea */}
                            <div className="mb-4">
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

                            {/* Buttons */}
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="flex justify-center items-center gap-3">
                                        {isRecording && !isPaused && (
                                            <button
                                                onClick={pauseRecording}
                                                disabled={isTranscribing || isGenerating}
                                                className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg bg-yellow-500 hover:bg-yellow-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                                                title="Pause Recording"
                                            >
                                                <FaPause className="text-sm" />
                                            </button>
                                        )}
                                        {isRecording && isPaused && (
                                            <button
                                                onClick={resumeRecording}
                                                disabled={isTranscribing || isGenerating}
                                                className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                                                title="Resume Recording"
                                            >
                                                <FaPlay className="text-sm" />
                                            </button>
                                        )}
                                        <button
                                            onClick={isRecording ? stopRecording : startRecording}
                                            disabled={isTranscribing || isGenerating}
                                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${isRecording
                                                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                                                : 'bg-primary-500 hover:bg-primary-600 text-white'
                                                } disabled:bg-gray-300 disabled:cursor-not-allowed disabled:animate-none`}
                                            title={isRecording ? 'Stop Recording' : 'Start Recording'}
                                        >
                                            {isRecording ? <FaStop className="text-lg" /> : <FaMicrophone className="text-lg" />}
                                        </button>
                                    </div>
                                    {isRecording && (
                                        <p className="text-xs font-medium text-gray-600">
                                            {isPaused ? 'Paused' : 'Listening...'}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={handleGenerateSOAP}
                                    disabled={(dictations.length === 0 && !input.trim()) || isGenerating || isTranscribing}
                                    className="w-full px-6 py-3 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                                >
                                    {isGenerating ? 'Generating...' : 'Generate SOAP'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side - Report Display */}
                {hasReport && (
                    <div
                        ref={(el) => {
                            if (el) reportScrollContainerRef.current = el;
                        }}
                        className="fixed top-0 right-0 bottom-0 bg-gray-50 overflow-y-auto z-30"
                        style={{
                            // Start after sidebar (224px) + input (25% of viewport)
                            left: 'calc(224px + 25%)',
                            width: 'calc(75% - 224px)', // Remaining space after sidebar
                            paddingTop: '20px',
                            paddingBottom: '40px',
                            opacity: isTransitioning ? 0 : 1,
                            transform: isTransitioning ? 'translateX(100px)' : 'translateX(0)',
                            transition: 'opacity 0.4s ease-in-out, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                        <div className="max-w-5xl mx-auto px-8 py-4">
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
                                        className="w-full text-lg font-semibold text-gray-800 bg-transparent border-b-2 border-gray-300 focus:border-primary-500 focus:outline-none pb-1"
                                        autoFocus
                                    />
                                ) : (
                                    <h2
                                        className="text-lg font-semibold text-gray-800 cursor-text hover:text-primary-600 transition-colors pb-1 border-b-2 border-transparent hover:border-gray-200"
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
                                        opacity: isReportTransitioning ? 0 : 1,
                                        transform: isReportTransitioning ? 'translateX(100px)' : 'translateX(0)',
                                        transition: 'opacity 0.4s ease-in-out, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
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
                {showTutorial && (
                    <div
                        className="fixed bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fadeIn"
                        onClick={() => setShowTutorial(false)}
                        style={{
                            left: '224px',
                            right: '0',
                            top: '0',
                            bottom: '0',
                            animation: 'fadeIn 0.3s ease-out'
                        }}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col transform transition-all"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                animation: 'slideUpScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                            }}
                        >
                            {/* Tutorial Header */}
                            <div className="bg-gradient-to-r from-primary-500 to-primary-700 px-6 py-4 flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-white">QuickSOAP Tutorial</h2>
                                <button
                                    onClick={() => setShowTutorial(false)}
                                    className="text-white hover:text-gray-200 transition-colors"
                                >
                                    <FaTimes className="text-xl" />
                                </button>
                            </div>

                            {/* Tutorial Content */}
                            <div className="flex-1 overflow-y-auto p-8">
                                {tutorialStep === 0 && (
                                    <div className="space-y-6">
                                        <div className="text-center">
                                            <h3 className="text-2xl font-bold text-gray-800 mb-3">Welcome to QuickSOAP</h3>
                                            <p className="text-gray-600 text-lg">QuickSOAP helps you create professional SOAP reports quickly using voice dictation or manual input.</p>
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
                                        <h3 className="text-2xl font-bold text-gray-800 mb-4">Adding Manual Notes</h3>
                                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                            <div className="space-y-4">
                                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                                                    <textarea
                                                        disabled
                                                        className="w-full resize-none border-0 focus:outline-none text-gray-900 placeholder-gray-400 text-sm"
                                                        placeholder="Add additional notes (optional)..."
                                                        rows={3}
                                                        value="You can type additional clinical notes here..."
                                                    />
                                                </div>
                                                <p className="text-sm text-gray-600">Type any additional notes or observations in the text field</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {tutorialStep === 3 && (
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
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {tutorialStep === 4 && (
                                    <div className="space-y-6">
                                        <h3 className="text-2xl font-bold text-gray-800 mb-4">Reviewing & Editing Your Report</h3>
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
                                                        <div className="bg-blue-50 px-6 py-4">
                                                            <textarea
                                                                disabled
                                                                className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white text-sm"
                                                                rows={3}
                                                                value="Your report content appears here and can be edited..."
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-600">Each SOAP section is color-coded and fully editable. Click any section to modify the content.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {tutorialStep === 5 && (
                                    <div className="space-y-6">
                                        <h3 className="text-2xl font-bold text-gray-800 mb-4">Saving Your Report</h3>
                                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 justify-center">
                                                    <button disabled className="px-3 py-1.5 rounded text-sm bg-[#3369bd] text-white cursor-not-allowed opacity-75 flex items-center gap-1.5">
                                                        <FaSave className="text-xs" />
                                                        Save
                                                    </button>
                                                    <button disabled className="px-3 py-1.5 rounded text-sm bg-[#3369bd] text-white cursor-not-allowed opacity-75">
                                                        Copy All
                                                    </button>
                                                    <button disabled className="px-3 py-1.5 rounded text-sm bg-red-200 text-red-800 cursor-not-allowed opacity-75">
                                                        Clear
                                                    </button>
                                                </div>
                                                <div className="mt-4 space-y-2">
                                                    <p className="text-sm font-semibold text-gray-800">Save your report to:</p>
                                                    <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                                                        <li>Access it later from Saved Records</li>
                                                        <li>Load it back into QuickSOAP for editing</li>
                                                        <li>Keep a permanent record</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tutorial Footer */}
                            <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
                                <div className="flex items-center gap-2">
                                    {[0, 1, 2, 3, 4, 5].map((step) => (
                                        <div
                                            key={step}
                                            className={`w-2 h-2 rounded-full transition-all ${tutorialStep === step ? 'bg-[#3369bd] w-8' : 'bg-gray-300'}`}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center gap-3">
                                    {tutorialStep > 0 && (
                                        <button
                                            onClick={() => setTutorialStep(tutorialStep - 1)}
                                            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all flex items-center gap-2"
                                        >
                                            <FaArrowLeft className="text-sm" />
                                            Previous
                                        </button>
                                    )}
                                    {tutorialStep < 5 ? (
                                        <button
                                            onClick={() => setTutorialStep(tutorialStep + 1)}
                                            className="px-4 py-2 rounded-lg bg-[#3369bd] text-white hover:bg-[#2c5aa3] transition-all flex items-center gap-2"
                                        >
                                            Next
                                            <FaArrowRight className="text-sm" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setShowTutorial(false)}
                                            className="px-4 py-2 rounded-lg bg-[#3369bd] text-white hover:bg-[#2c5aa3] transition-all"
                                        >
                                            Get Started
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default QuickSOAP;
