import React, { useState, useEffect, useRef } from 'react';
import '../styles/ReportForm.css';
import GenerateReport from './GenerateReport';
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../supabaseClient';
import { pdf } from '@react-pdf/renderer';
import { Document, Page, Text, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer';
import { createEditor } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import { withHistory } from 'slate-history';
import { Node } from 'slate';
import { Link, useNavigate } from 'react-router-dom';

// Add this before PDFDocument component
// const mainHeaders = [ ... ];

const PDFDocument = ({ reportText }) => {
    const styles = StyleSheet.create({
        page: {
            padding: 40,
            fontSize: 12,
            fontFamily: 'Helvetica',
            lineHeight: 1.2
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

    // Split content into main content and summary sections
    const splitContent = (text) => {
        const lines = text.split('\n');
        const summaryIndex = lines.findIndex(line =>
            line.includes('**Patient Visit Summary:**') ||
            line.includes('**Notes:**')
        );

        if (summaryIndex === -1) return { mainContent: text, summaryContent: '' };

        const mainContent = lines.slice(0, summaryIndex).join('\n');
        const summaryContent = lines.slice(summaryIndex).join('\n');
        return { mainContent, summaryContent };
    };

    const renderContent = (content) => {
        if (!content) return null;
        const lines = content.split('\n');
        return lines.map((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                return <Text key={`break-${index}`} style={styles.lineBreak}>{'\n'}</Text>;
            }
            if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                return (
                    <Text key={index} style={styles.strongText}>
                        {trimmedLine.slice(2, -2)}
                        {'\n'}
                    </Text>
                );
            }
            return (
                <Text key={index} style={styles.text}>
                    {line}
                    {'\n'}
                </Text>
            );
        });
    };

    const { mainContent, summaryContent } = splitContent(reportText);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {renderContent(mainContent)}
            </Page>
            {summaryContent && (
                <Page size="A4" style={styles.page}>
                    {renderContent(summaryContent)}
                </Page>
            )}
        </Document>
    );
};

// Update processSlateForPDF to handle pasted content
const processSlateForPDF = (nodes) => {
    let formattedText = '';
    let previousWasEmpty = false;

    nodes.forEach((node) => {
        const text = Node.string(node);
        const trimmedText = text.trim();

        if (!trimmedText) {
            if (!previousWasEmpty) {
                formattedText += '\n';
            }
            previousWasEmpty = true;
            return;
        }
        previousWasEmpty = false;

        // Check if node is already bold or has ** markers
        const isBold = node.type === 'heading' ||
            node.children[0]?.bold ||
            trimmedText.startsWith('**') && trimmedText.endsWith('**');

        if (isBold) {
            // Ensure we don't double-wrap in **
            const cleanText = trimmedText.replace(/^\*\*|\*\*$/g, '');
            formattedText += `**${cleanText}**\n`;
        } else {
            formattedText += `${text}\n`;
        }
    });

    return formattedText;
};

// Update PDFButton component
const PDFButton = ({ reportText, patientName, editor }) => {
    const [isPreparing, setIsPreparing] = useState(false);

    const generatePDF = async () => {
        try {
            setIsPreparing(true);

            // Get current content from Slate editor
            const slateContent = editor.children;
            // Process Slate content to preserve formatting
            const formattedText = processSlateForPDF(slateContent);

            const doc = <PDFDocument reportText={formattedText} />;
            const blob = await pdf(doc).toBlob();
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `${patientName || 'Report'}-${new Date().toLocaleDateString()}.pdf`;
            link.click();

            URL.revokeObjectURL(url);
            setIsPreparing(false);
        } catch (error) {
            console.error('PDF generation error:', error);
        } finally {
            setIsPreparing(false);
        }
    };

    return (
        <button
            className="copy-button"
            onClick={generatePDF}
            disabled={isPreparing}
        >
            {isPreparing ? 'Preparing PDF...' : 'Download PDF'}
        </button>
    );
};

// Update PrintButton similarly
const PrintButton = ({ reportText, editor }) => {
    const handlePrint = async () => {
        try {
            const slateContent = editor.children;
            const formattedText = processSlateForPDF(slateContent);

            const doc = <PDFDocument reportText={formattedText} />;
            const blob = await pdf(doc).toBlob();
            const url = URL.createObjectURL(blob);

            // Open PDF in new window and print
            const printWindow = window.open(url, '_blank');
            printWindow.onload = () => {
                printWindow.print();
                // Only close and cleanup after print dialog is closed
                printWindow.onafterprint = () => {
                    printWindow.close();
                    URL.revokeObjectURL(url);
                };
            };
        } catch (error) {
            console.error('Print error:', error);
        }
    };

    return (
        <button className="copy-button" onClick={handlePrint}>
            Print Report
        </button>
    );
};

const ToggleSwitch = ({ fieldName, enabled, onChange }) => (
    <div className="toggle-switch">
        <label className="switch">
            <input
                type="checkbox"
                checked={enabled}
                onChange={() => onChange(fieldName)}
                tabIndex="-1"
            />
            <span className="slider round"></span>
        </label>
    </div>
);

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const PETWISE_DEFAULT_PHYSICAL_EXAM = `General Appearance:   Bright, Alert
Temperature:   Within normal limits
Heart Rate:   Within normal limits
Respiratory Rate:   Within normal limits
Body Condition Score:   5/9 (Ideal=5/9)
Mucous Membranes:   Pink, moist, CRT <2s
Eyes:   No abnormal findings
Ears:   No abnormal findings
Nose:   No abnormal findings
Throat:   No abnormal findings
Oral:   Gd. 1 tartar
Heart:   No abnormal findings
Lungs:   Clear on auscultation, no abnormal sounds
Abdomen Palpation:   No abnormal findings
Lymph Nodes:   No enlargement 
Skin and Coat:   No lesions, normal coat condition, no ectoparasites observed
Musculoskeletal:   No abnormal findings
Neurologic:   No abnormal findings
Urogenital:   No abnormal findings`;

const DEFAULT_DIAGNOSTIC_TESTS = '';

const deserializeSlateValue = (text) => {
    if (!text) {
        return [{
            type: 'paragraph',
            children: [{ text: '' }]
        }];
    }

    return text.split('\n').map((line) => {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
            return {
                type: 'paragraph',
                children: [{ text: '' }]
            };
        }

        // Check for ** bold formatting
        if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
            return {
                type: 'heading',
                children: [{
                    text: trimmedLine.slice(2, -2),
                    bold: true
                }]
            };
        }

        // Check for other patterns that should be bold
        if (trimmedLine.endsWith(':') ||
            trimmedLine.match(/^\d+\.\s+[^:]+$/) ||
            trimmedLine.match(/^[A-Za-z\s]+:$/)) {
            return {
                type: 'heading',
                children: [{
                    text: trimmedLine,
                    bold: true
                }]
            };
        }

        return {
            type: 'paragraph',
            children: [{
                text: line
            }]
        };
    });
};

// Update the renderElement to add proper spacing
const renderElement = props => {
    switch (props.element.type) {
        case 'heading':
            return <div {...props.attributes} style={{
                fontWeight: 'bold',
                marginBottom: '4px',    // Consistent margin for all headers
                marginTop: '4px',       // Consistent margin for all headers
                lineHeight: '1.2'
            }}>{props.children}</div>;
        default:
            return <div {...props.attributes} style={{
                marginBottom: '4px',
                minHeight: '1em',
                lineHeight: '1.2'
            }}>{props.children}</div>;
    }
};

const renderLeaf = props => {
    return (
        <span
            {...props.attributes}
            style={{ fontWeight: props.leaf.bold ? 'bold' : 'normal' }}
        >
            {props.children}
        </span>
    );
};

// Add this helper function at the top of your file
const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    // If it's already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
    }
    // Otherwise, create a date and format it
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
};

const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
};

// Add this helper function at the top level
const formatDateForReport = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
};

const ReportForm = () => {
    const { user, isAuthenticated } = useAuth0();
    const [patientInfoSubmitted, setPatientInfoSubmitted] = useState(false);

    const formDataString = localStorage.getItem('form_data');
    const formData = formDataString ? JSON.parse(formDataString) : null;

    // Patient Info State
    const [patientName, setPatientName] = useState(() =>
        formData?.patientName || localStorage.getItem('patientName') || ''
    );
    const [species, setSpecies] = useState(() =>
        formData?.species || localStorage.getItem('species') || ''
    );
    const [sex, setSex] = useState(() =>
        formData?.sex || localStorage.getItem('sex') || ''
    );
    const [breed, setBreed] = useState(() => localStorage.getItem('breed') || '');
    const [colorMarkings, setColorMarkings] = useState(() => localStorage.getItem('colorMarkings') || '');
    const [weight, setWeight] = useState(() => localStorage.getItem('weight') || '');
    const [weightUnit, setWeightUnit] = useState(() => localStorage.getItem('weightUnit') || 'lbs');
    const [age, setAge] = useState(() => localStorage.getItem('age') || '');
    const [ownerName, setOwnerName] = useState(() => localStorage.getItem('ownerName') || '');
    const [address, setAddress] = useState(() => localStorage.getItem('address') || '');
    const [telephone, setTelephone] = useState(() => localStorage.getItem('telephone') || '');

    // Exam Info State
    const [examDate, setExamDate] = useState(() => {
        if (formData?.examDate) return formData.examDate;
        const savedDate = localStorage.getItem('examDate');
        if (savedDate) return savedDate;
        return new Date().toISOString().split('T')[0];
    });
    const [doctor, setDoctor] = useState(() => localStorage.getItem('doctor') || '');
    const [presentingComplaint, setPresentingComplaint] = useState(() => localStorage.getItem('presentingComplaint') || '');
    const [history, setHistory] = useState(() => localStorage.getItem('history') || '');
    const [physicalExamFindings, setPhysicalExamFindings] = useState(() => {
        // First check localStorage for user input
        const savedFindings = localStorage.getItem('physicalExamFindings');
        if (savedFindings) return savedFindings;

        // If no saved input, use custom template or default
        return PETWISE_DEFAULT_PHYSICAL_EXAM;
    });
    const [diagnosticTests, setDiagnosticTests] = useState(() =>
        localStorage.getItem('diagnosticTests') || DEFAULT_DIAGNOSTIC_TESTS
    );
    const [assessment, setAssessment] = useState(() => localStorage.getItem('assessment') || '');
    const [diagnosis, setDiagnosis] = useState(() => localStorage.getItem('diagnosis') || '');
    const [differentialDiagnosis, setDifferentialDiagnosis] = useState(() => localStorage.getItem('differentialDiagnosis') || '');
    const [treatment, setTreatment] = useState(() => localStorage.getItem('treatment') || '');
    const [clientCommunications, setClientCommunications] = useState(() => localStorage.getItem('clientCommunications') || '');
    const [planFollowUp, setPlanFollowUp] = useState(() => localStorage.getItem('planFollowUp') || '');

    // Loading and error states
    const [loading, setLoading] = useState(false);
    const [reportText, setReportText] = useState(() => {
        const savedText = localStorage.getItem('currentReportText');
        return savedText || '';
    });
    const [previewVisible, setPreviewVisible] = useState(() => localStorage.getItem('previewVisible') === 'true');
    const [error, setError] = useState('');

    const [savedMessageVisible, setSavedMessageVisible] = useState(false);
    const [copiedMessageVisible, setCopiedMessageVisible] = useState(false);
    const [copyButtonText, setCopyButtonText] = useState('Copy to Clipboard');

    const [customBreed, setCustomBreed] = useState('');
    const [isCustomBreed, setIsCustomBreed] = useState(false);

    const [naturopathicMedicine, setNaturopathicMedicine] = useState(() => localStorage.getItem('naturopathicMedicine') || '');

    const isGenerating = useRef(false); // Track if report generation is ongoing

    const speciesOptions = [
        'Canine', 'Feline', 'Avian', 'Reptile', 'Small Mammals', 'Fish', 'Amphibians',
        'Bovine', 'Equine', 'Ovine', 'Porcine'
    ];
    const sexOptions = ['Female Spayed', 'Female Intact', 'Male Neutered', 'Male Intact'];

    const dogBreeds = [
        'Australian Shepherd', 'Beagle', 'Bernese Mountain Dog', 'Bichon Frise', 'Border Collie', 'Boston Terrier',
        'Boxer', 'Bulldog', 'Cavalier King Charles Spaniel', 'Chihuahua', 'Cocker Spaniel', 'Collie',
        'Dachshund', 'Dalmatian', 'Doberman Pinscher', 'English Cocker Spaniel', 'English Springer Spaniel', 'French Bulldog',
        'German Shepherd', 'Golden Retriever', 'Great Dane', 'Havanese', 'Irish Setter', 'Jack Russell Terrier',
        'Labrador Retriever', 'Maltese', 'Miniature Pinscher', 'Miniature Schnauzer', 'Newfoundland', 'Pekingese',
        'Pembroke Welsh Corgi', 'Pomeranian', 'Poodle', 'Portuguese Water Dog', 'Pug', 'Rottweiler', 'Samoyed',
        'Schipperke', 'Shiba Inu', 'Shih Tzu', 'Siberian Husky', 'Soft-Coated Wheaten Terrier', 'Staffordshire Bull Terrier',
        'Standard Schnauzer', 'Weimaraner', 'West Highland White Terrier', 'Whippet', 'Wire Fox Terrier', 'Yorkshire Terrier'
    ];

    const felineBreeds = [
        'Domestic Long Hair', 'Domestic Short Hair', 'Domestic Medium Hair',
        'Abyssinian', 'American Curl', 'American Shorthair', 'Bengal', 'Birman',
        'Bombay', 'British Shorthair', 'Burmese', 'Burmilla', 'Chartreux', 'Cornish Rex',
        'Devon Rex', 'Egyptian Mau', 'Exotic Shorthair', 'Havana Brown', 'Himalayan',
        'Japanese Bobtail', 'Javanese', 'Khao Manee', 'Korat', 'LaPerm', 'Lykoi',
        'Maine Coon', 'Manx', 'Norwegian Forest Cat', 'Ocicat', 'Oriental Shorthair',
        'Persian', 'Peterbald', 'Pixie-Bob', 'Ragamuffin', 'Ragdoll', 'Russian Blue',
        'Savannah', 'Scottish Fold', 'Selkirk Rex', 'Serengeti', 'Siamese', 'Siberian',
        'Singapura', 'Snowshoe', 'Somali', 'Sphynx', 'Thai', 'Tonkinese',
        'Toyger', 'Turkish Angora', 'Turkish Van'
    ];

    // Add these new breed lists
    const smallMammalBreeds = [
        'Rabbit - Holland Lop',
        'Rabbit - Netherland Dwarf',
        'Rabbit - Mini Rex',
        'Guinea Pig - American',
        'Guinea Pig - Abyssinian',
        'Hamster - Syrian',
        'Hamster - Dwarf Campbell',
        'Ferret',
        'Chinchilla',
        'Gerbil'
    ];

    const fishBreeds = [
        'Betta Fish',
        'Goldfish',
        'Guppy',
        'Tetra',
        'Angelfish',
        'Molly',
        'Platy',
        'Discus',
        'Cichlid',
        'Koi'
    ];

    const amphibianBreeds = [
        'African Clawed Frog',
        'Fire-Bellied Toad',
        'Red-Eyed Tree Frog',
        'Axolotl',
        'Pac-Man Frog',
        'Tiger Salamander',
        'Fire Salamander',
        'Green Tree Frog',
        'Poison Dart Frog',
        'Japanese Fire-Bellied Newt'
    ];

    // Update the breedOptions logic in the component
    const breedOptions = species === 'Canine' ? dogBreeds
        : species === 'Feline' ? felineBreeds
            : species === 'Small Mammals' ? smallMammalBreeds
                : species === 'Fish' ? fishBreeds
                    : species === 'Amphibians' ? amphibianBreeds
                        : [];

    // Add near other state declarations
    const [enabledFields, setEnabledFields] = useState(() => {
        const savedFields = localStorage.getItem('enabledFields');
        return savedFields ? JSON.parse(savedFields) : {
            examDate: true,
            presentingComplaint: true,
            history: true,
            physicalExamFindings: true,
            diagnosticTests: true,
            assessment: true,
            diagnosis: true,
            differentialDiagnosis: true,
            treatment: true,
            monitoring: true,
            naturopathicMedicine: true,
            clientCommunications: true,
            planFollowUp: true,
            patientVisitSummary: true,
            notes: true
        };
    });

    const [reportsUsed, setReportsUsed] = useState(0);
    const [reportLimit, setReportLimit] = useState(0);

    const fetchReportUsage = async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('users')
                .select('reports_used_today, subscription_interval, last_report_date')
                .eq('auth0_user_id', user.sub)
                .single();

            if (error) throw error;

            const today = new Date().toISOString().split('T')[0];

            if (data.last_report_date !== today) {
                const { error: updateError } = await supabase
                    .from('users')
                    .update({
                        reports_used_today: 0,
                        last_report_date: today
                    })
                    .eq('auth0_user_id', user.sub);

                if (updateError) throw updateError;
                setReportsUsed(0);
            } else {
                setReportsUsed(data.reports_used_today);
            }

            // Get limit from server
            const response = await fetch(`${API_URL}/check-subscription/${user.sub}`);
            const limitData = await response.json();

            if (data.subscription_interval === 'trial') {
                setReportLimit(50); // Server enforces 50 limit
                // Only show warning if not loading a saved report
                const loadedReportId = localStorage.getItem('currentReportId');
                if (!loadedReportId) {
                    setShowLimitWarning(data.reports_used_today >= 50);
                }
            } else {
                setReportLimit(Infinity);
                setShowLimitWarning(false);
            }
        } catch (error) {
            console.error('Error fetching report usage:', error);
        }
    };

    // Add lastFetchTime to track when we last checked
    const lastFetchTime = useRef(0);
    const MIN_FETCH_INTERVAL = 30000; // 30 seconds minimum between fetches

    const debouncedFetchReportUsage = () => {
        const now = Date.now();
        if (now - lastFetchTime.current > MIN_FETCH_INTERVAL) {
            fetchReportUsage();
            lastFetchTime.current = now;
        }
    };

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                debouncedFetchReportUsage();
            }
        };

        // Initial fetch
        fetchReportUsage();
        lastFetchTime.current = Date.now();

        // Add visibility change listener
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 5-minute interval check
        const interval = setInterval(debouncedFetchReportUsage, 5 * 60 * 1000);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(interval);
        };
    }, [user]);

    useEffect(() => {
        // First check if we have form_data
        const formDataString = localStorage.getItem('form_data');
        if (formDataString) {
            const formData = JSON.parse(formDataString);

            // Load all fields from form_data
            setPatientName(formData.patientName || '');
            setSpecies(formData.species || '');
            setSex(formData.sex || '');
            setBreed(formData.breed || '');
            setColorMarkings(formData.colorMarkings || '');
            setWeight(formData.weight || '');
            setWeightUnit(formData.weightUnit || 'lbs');
            setAge(formData.age || '');
            setOwnerName(formData.ownerName || '');
            setAddress(formData.address || '');
            setTelephone(formData.telephone || '');
            setExamDate(formData.examDate || new Date().toISOString().split('T')[0]);
            setDoctor(formData.doctor || '');
            setPresentingComplaint(formData.presentingComplaint || '');
            setHistory(formData.history || '');
            setPhysicalExamFindings(formData.physicalExamFindings || PETWISE_DEFAULT_PHYSICAL_EXAM);
            setDiagnosticTests(formData.diagnosticTests || DEFAULT_DIAGNOSTIC_TESTS);
            setAssessment(formData.assessment || '');
            setDiagnosis(formData.diagnosis || '');
            setDifferentialDiagnosis(formData.differentialDiagnosis || '');
            setTreatment(formData.treatment || '');
            setNaturopathicMedicine(formData.naturopathicMedicine || '');
            setClientCommunications(formData.clientCommunications || '');
            setPlanFollowUp(formData.planFollowUp || '');
            setPatientVisitSummary(formData.patientVisitSummary || '');
            setNotes(formData.notes || '');

            // Also set individual localStorage items for compatibility
            Object.entries(formData).forEach(([key, value]) => {
                if (value) localStorage.setItem(key, value);
            });

            if (formData.enabledFields) {
                setEnabledFields(formData.enabledFields);
                localStorage.setItem('enabledFields', JSON.stringify(formData.enabledFields));
            }

            if (formData.patientName) {
                setPatientInfoSubmitted(true);
            }

            // After setting all the form values, trigger textarea growth
            setTimeout(() => {
                const textareas = document.querySelectorAll('textarea:not(.physical-exam-input)');
                textareas.forEach(textarea => {
                    const fieldName = textarea.getAttribute('name');
                    if (fieldName && textarea.value) {
                        // Create a synthetic event object
                        const event = { target: textarea };
                        handleTextareaGrow(event, fieldName);
                    }
                });
            }, 100); // Small delay to ensure state updates have completed

            // Set preview visible and clear warning banner
            setPreviewVisible(true);
            setShowLimitWarning(false);

            // Clear form_data from localStorage after loading
            localStorage.removeItem('form_data');
        } else {
            // Fall back to individual localStorage items
            // ... your existing localStorage loading code ...
            const savedReportText = localStorage.getItem('currentReportText');
            const savedPreviewVisible = localStorage.getItem('previewVisible') === 'true';

            if (savedReportText) {
                setReportText(savedReportText);
                setSlateValue(deserializeSlateValue(savedReportText));
            }

            setPreviewVisible(savedPreviewVisible);

            setPatientName(localStorage.getItem('patientName') || '');
            setSpecies(localStorage.getItem('species') || '');
            setSex(localStorage.getItem('sex') || '');
            setBreed(localStorage.getItem('breed') || '');
            setColorMarkings(localStorage.getItem('colorMarkings') || '');
            setWeight(localStorage.getItem('weight') || '');
            setWeightUnit(localStorage.getItem('weightUnit') || 'lbs');
            setAge(localStorage.getItem('age') || '');
            setOwnerName(localStorage.getItem('ownerName') || '');
            setAddress(localStorage.getItem('address') || '');
            setTelephone(localStorage.getItem('telephone') || '');
            setExamDate(localStorage.getItem('examDate') || new Date().toISOString().split('T')[0]);
            setDoctor(localStorage.getItem('doctor') || '');
            setPresentingComplaint(localStorage.getItem('presentingComplaint') || '');
            setHistory(localStorage.getItem('history') || '');
            setPhysicalExamFindings(localStorage.getItem('physicalExamFindings') || PETWISE_DEFAULT_PHYSICAL_EXAM);
            setDiagnosticTests(localStorage.getItem('diagnosticTests') || DEFAULT_DIAGNOSTIC_TESTS);
            setAssessment(localStorage.getItem('assessment') || '');
            setDiagnosis(localStorage.getItem('diagnosis') || '');
            setDifferentialDiagnosis(localStorage.getItem('differentialDiagnosis') || '');
            setTreatment(localStorage.getItem('treatment') || '');
            setNaturopathicMedicine(localStorage.getItem('naturopathicMedicine') || '');
            setClientCommunications(localStorage.getItem('clientCommunications') || '');
            setPlanFollowUp(localStorage.getItem('planFollowUp') || '');
            setPatientVisitSummary(localStorage.getItem('patientVisitSummary') || '');
            setNotes(localStorage.getItem('notes') || '');
        }
    }, []); // Empty dependency array for mount only

    useEffect(() => {
        localStorage.setItem('currentReportText', reportText);
        localStorage.setItem('previewVisible', previewVisible.toString());
        localStorage.setItem('patientName', patientName);
        localStorage.setItem('age', age);
        localStorage.setItem('doctor', doctor);
    }, [reportText, previewVisible, patientName, age, doctor]);

    // Remove fetch from handlePatientInfoSubmit
    const handlePatientInfoSubmit = async (e) => {
        e.preventDefault();
        setPatientInfoSubmitted(true);
    };

    // Add useEffect to fetch when component loads
    useEffect(() => {
        if (user && !patientInfoSubmitted) {
            fetchReportUsage();
            lastFetchTime.current = Date.now();
        }
    }, [user, patientInfoSubmitted]); // Add patientInfoSubmitted to dependencies

    // Go back to patient info form
    const handleBackToPatientInfo = () => {
        setPatientInfoSubmitted(false);
    };

    // Add this with your other refs at the top of the component
    const previewContentRef = useRef(null);

    // Modify the handleExamSubmit function
    const handleExamSubmit = async (e) => {
        e.preventDefault();
        if (isGenerating.current) return;

        setShowLimitWarning(false);

        if (reportsUsed >= reportLimit) {
            setError('Report limit reached. Please upgrade your plan for more reports.');
            return;
        }

        try {
            setLoading(true);
            isGenerating.current = true;

            const inputs = {
                patientName, species, sex, breed, colorMarkings, weight, weightUnit, age,
                ownerName, address, telephone, examDate: examDate,
                doctor: userData?.dvm_name || '',
                presentingComplaint, history,
                physicalExamFindings, diagnosticTests, assessment, diagnosis,
                differentialDiagnosis, treatment, clientCommunications, planFollowUp,
                naturopathicMedicine, patientVisitSummary, notes
            };

            const generatedReport = await GenerateReport(inputs, enabledFields);
            // console.log("Raw GPT Response:", generatedReport);
            setReportText(generatedReport);
            setPreviewVisible(true);

            // Force scroll to top immediately after state updates
            if (previewContentRef.current) {
                previewContentRef.current.scrollTop = 0;
            }

            // Update reports_used_today and weekly_reports_count
            if (user?.sub) {
                try {
                    const { data, error } = await supabase
                        .from('users')
                        .select('reports_used_today, weekly_reports_count')
                        .eq('auth0_user_id', user.sub)
                        .single();

                    if (!error && data) {
                        const reportsUsed = data.reports_used_today || 0;
                        const weeklyCount = data.weekly_reports_count || 0;

                        await supabase
                            .from('users')
                            .update({
                                reports_used_today: reportsUsed + 1,
                                weekly_reports_count: weeklyCount + 1
                            })
                            .eq('auth0_user_id', user.sub);
                    }
                } catch (err) {
                    console.error('Error updating report counts:', err);
                }
            }

            setReportsUsed(prev => prev + 1);
        } catch (error) {
            setError(error.message || 'An error occurred while generating the report.');
        } finally {
            setLoading(false);
            isGenerating.current = false;
        }
    };

    const saveReport = async () => {
        if (!isAuthenticated) {
            setError("Please log in to save the report.");
            return;
        }

        const saveBtn = document.querySelector('.report-preview-footer .submit-button');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';

        try {
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('auth0_user_id', user.sub)
                .single();

            if (userError || !userData) throw new Error("User not found in Supabase.");

            const formData = {
                patientName,
                species,
                sex,
                breed,
                colorMarkings,
                weight,
                weightUnit,
                age,
                ownerName,
                address,
                telephone,
                examDate,
                doctor,
                presentingComplaint,
                history,
                physicalExamFindings,
                diagnosticTests,
                assessment,
                diagnosis,
                differentialDiagnosis,
                treatment,
                naturopathicMedicine,
                clientCommunications,
                planFollowUp,
                patientVisitSummary,
                notes,
                enabledFields
            };

            // Check if we're working on a loaded report
            const loadedReportId = localStorage.getItem('currentReportId');

            if (loadedReportId) {
                // Update existing report
                const { error: updateError } = await supabase
                    .from('saved_reports')
                    .update({
                        report_name: `${patientName} - ${new Date().toLocaleString()}`,
                        report_text: reportText,
                        form_data: formData
                    })
                    .eq('id', loadedReportId)
                    .eq('user_id', userData.id);

                if (updateError) throw updateError;
            } else {
                // Create new report
                const { data: newReport, error: insertError } = await supabase
                    .from('saved_reports')
                    .insert([{
                        user_id: userData.id,
                        report_name: `${patientName} - ${new Date().toLocaleString()}`,
                        report_text: reportText,
                        form_data: formData
                    }])
                    .select()
                    .single();

                if (insertError) throw insertError;

                // Store the new report ID
                localStorage.setItem('currentReportId', newReport.id);
            }

            setSavedMessageVisible(true);
            setTimeout(() => setSavedMessageVisible(false), 2000);

            saveBtn.textContent = 'Saved!';
            setTimeout(() => {
                saveBtn.textContent = originalText;
            }, 2000);
        } catch (error) {
            console.error("Error saving report:", error);
            setError("Failed to save report. Please try again.");
            saveBtn.textContent = originalText;
        }
    };

    const resetEntireForm = () => {
        // Reset all textarea heights by removing inline styles
        const textareas = document.querySelectorAll('textarea:not(.physical-exam-input)');
        textareas.forEach(textarea => {
            textarea.style.removeProperty('height');
            const fieldName = textarea.getAttribute('name');
            if (fieldName) {
                localStorage.removeItem(`${fieldName}_height`);
            }
        });

        // Clear all form states
        setPatientName('');
        setSpecies('');
        setSex('');
        setBreed('');
        setColorMarkings('');
        setWeight('');
        setWeightUnit('lbs');
        setAge('');
        setOwnerName('');
        setAddress('');
        setTelephone('');
        setExamDate(new Date().toISOString().split('T')[0]);
        setPresentingComplaint('');
        setHistory('');
        // Use custom template if available, otherwise use default
        setPhysicalExamFindings(customTemplate || PETWISE_DEFAULT_PHYSICAL_EXAM);
        setDiagnosticTests(DEFAULT_DIAGNOSTIC_TESTS);
        setAssessment('');
        setDiagnosis('');
        setDifferentialDiagnosis('');
        setTreatment('');
        setMonitoring('');
        setNaturopathicMedicine('');
        setClientCommunications('');
        setPlanFollowUp('');
        setPatientVisitSummary('');
        setNotes('');

        // Reset report states
        setReportText('');
        setSlateValue([{ type: 'paragraph', children: [{ text: '' }] }]);
        setPreviewVisible(false);

        // Clear all localStorage items except enabledFields
        Object.keys(localStorage).forEach(key => {
            if (key !== 'enabledFields') {
                localStorage.removeItem(key);
            }
        });

        // Reset form to patient info step
        setShowExamInfo(false);
    };

    const copyToClipboard = () => {
        const htmlContent = slateValue.map(node => {
            if (node.children[0]?.bold) {
                return `<b style="background: none; background-color: transparent;">${Node.string(node)}</b>`;
            }
            return `<span style="background: none; background-color: transparent;">${Node.string(node)}</span>`;
        }).join('<br>');

        // Use plain text without asterisks
        const plainText = slateValue.map(node => Node.string(node)).join('\n');

        const wrappedHtml = `
            <div style="color: black; background: none; background-color: transparent;">
                ${htmlContent}
            </div>
        `;

        const clipboardData = new ClipboardItem({
            'text/html': new Blob([wrappedHtml], { type: 'text/html' }),
            'text/plain': new Blob([plainText], { type: 'text/plain' })
        });

        navigator.clipboard.write([clipboardData])
            .then(() => {
                setCopyButtonText('Copied!');
                setCopiedMessageVisible(true);
                setTimeout(() => {
                    setCopyButtonText('Copy to Clipboard');
                    setCopiedMessageVisible(false);
                }, 2000);
            })
            .catch(err => {
                console.error('Copy failed:', err);
                setCopyButtonText('Copy Failed');
                setTimeout(() => setCopyButtonText('Copy to Clipboard'), 2000);
            });
    };

    const handleBreedChange = (e) => {
        const selectedBreed = e.target.value;
        if (selectedBreed === 'custom') {
            setIsCustomBreed(true);
            setBreed('');
        } else {
            setIsCustomBreed(false);
            setBreed(selectedBreed);
        }
    };

    const handleCustomBreedChange = (e) => {
        setCustomBreed(e.target.value);
        setBreed(e.target.value);
    };

    useEffect(() => {
        // Save all form fields to localStorage
        localStorage.setItem('species', species);
        localStorage.setItem('sex', sex);
        localStorage.setItem('breed', breed);
        localStorage.setItem('colorMarkings', colorMarkings);
        localStorage.setItem('weight', weight);
        localStorage.setItem('weightUnit', weightUnit);
        localStorage.setItem('age', age);
        // Exam info
        localStorage.setItem('examDate', examDate);
        localStorage.setItem('doctor', doctor);
        localStorage.setItem('presentingComplaint', presentingComplaint);
        localStorage.setItem('history', history);
        localStorage.setItem('physicalExamFindings', physicalExamFindings);
        localStorage.setItem('diagnosticTests', diagnosticTests);
        localStorage.setItem('assessment', assessment);
        localStorage.setItem('diagnosis', diagnosis);
        localStorage.setItem('differentialDiagnosis', differentialDiagnosis);
        localStorage.setItem('treatment', treatment);
        localStorage.setItem('clientCommunications', clientCommunications);
        localStorage.setItem('planFollowUp', planFollowUp);
        localStorage.setItem('naturopathicMedicine', naturopathicMedicine);
    }, [species, sex, breed, colorMarkings, weight, weightUnit, age,
        examDate, doctor, presentingComplaint,
        history, physicalExamFindings, diagnosticTests, assessment,
        diagnosis, differentialDiagnosis, treatment, clientCommunications, planFollowUp, naturopathicMedicine]);

    // Add to useEffect for localStorage
    useEffect(() => {
        localStorage.setItem('enabledFields', JSON.stringify(enabledFields));
    }, [enabledFields]);

    const handleToggleField = (fieldName) => {
        // console.log('Before toggle:', enabledFields[fieldName]);
        setEnabledFields(prev => {
            const newFields = {
                ...prev,
                [fieldName]: !prev[fieldName]
            };
            // console.log('After toggle:', newFields[fieldName]);
            return newFields;
        });
    };

    // Modify handleInputChange to include the grow functionality
    const handleInputChange = (e, fieldName, setter) => {
        const value = e.target.value;
        setter(value);
        localStorage.setItem(fieldName, value);

        if (e.target.tagName.toLowerCase() === 'textarea') {
            handleTextareaGrow(e, fieldName);
        }

        if (!value.trim()) {
            localStorage.removeItem(fieldName);
            localStorage.removeItem(`${fieldName}_height`);
        }
    };

    // Add this function near your other handlers
    const handleTextareaGrow = (e, fieldName) => {
        if (fieldName === 'physicalExamFindings') return; // Skip for physical exam

        const textarea = e.target;
        const lineHeight = 20; // Height per line in pixels
        const minHeight = 100; // Default minimum height

        // Count number of newlines
        const lines = textarea.value.split('\n').length;
        const newHeight = Math.max(minHeight, lines * lineHeight);

        // Store the height in localStorage
        localStorage.setItem(`${fieldName}_height`, newHeight);

        // Apply the height
        textarea.style.height = `${newHeight}px`;
    };

    // Add new state with the other state declarations
    const [patientVisitSummary, setPatientVisitSummary] = useState(() => localStorage.getItem('patientVisitSummary') || '');
    const [notes, setNotes] = useState(() => localStorage.getItem('notes') || '');

    // Add this effect to save reportText changes
    useEffect(() => {
        if (reportText) {
            localStorage.setItem('currentReportText', reportText);
        }
    }, [reportText]);

    // Add this near your other useEffects
    useEffect(() => {
        if (reportText) {
            const previewContent = document.querySelector('.report-preview-content');
            if (previewContent) {
                previewContent.scrollTo({
                    top: 0,
                    behavior: 'instant'
                });
            }
        }
    }, [reportText]); // Trigger when reportText changes

    const [editor] = useState(() => withHistory(withReact(createEditor())));
    const [slateValue, setSlateValue] = useState(() => {
        const savedReport = localStorage.getItem('currentReportText');
        return deserializeSlateValue(savedReport);
    });

    useEffect(() => {
        if (reportText) {
            const initialValue = deserializeSlateValue(reportText);
            // Ensure we always have at least one paragraph node
            setSlateValue(initialValue.length > 0 ? initialValue : [{
                type: 'paragraph',
                children: [{ text: '' }]
            }]);
        }
    }, [reportText]);

    // Add this useEffect to handle initial load and page switches
    useEffect(() => {
        const savedReport = localStorage.getItem('currentReportText');
        if (savedReport) {
            setSlateValue(deserializeSlateValue(savedReport));
            setReportText(savedReport);
        }
    }, []);

    // Add near your other state declarations
    const [showLimitWarning, setShowLimitWarning] = useState(false);

    // Update the useEffect that monitors report usage
    useEffect(() => {
        if (reportLimit !== Infinity) {
            const loadedReportId = localStorage.getItem('currentReportId');
            if (!loadedReportId) {  // Only show warning if not loading a saved report
                const remainingReports = Math.max(0, reportLimit - reportsUsed);
                setShowLimitWarning(remainingReports <= 3 || reportsUsed >= reportLimit);
            } else {
                setShowLimitWarning(false);
            }
        } else {
            setShowLimitWarning(false);
        }
    }, [reportsUsed, reportLimit]);

    // Add this state to handle navigation
    const navigate = useNavigate(); // Add useNavigate import at the top

    // Modify the LimitWarningPopup component
    const LimitWarningPopup = () => {
        const remainingReports = Math.max(0, reportLimit - reportsUsed);
        const isAtLimit = reportsUsed >= reportLimit;

        return (
            <div className="limit-warning-popup">
                <button
                    className="close-warning"
                    onClick={() => setShowLimitWarning(false)}
                >
                    ×
                </button>
                {isAtLimit ? (
                    <p>You've reached your daily report limit. Sign up for unlimited reports!</p>
                ) : (
                    <p>You have {remainingReports} reports remaining today. Reports will reset tomorrow.</p>
                )}
                <p>Need more? <button
                    className="upgrade-link"
                    onClick={() => {
                        setShowLimitWarning(false);
                        navigate('/dashboard/profile', { state: { openCheckout: true } });
                    }}
                >
                    Upgrade your plan
                </button></p>
            </div>
        );
    };

    const [loadingText, setLoadingText] = useState('Generating report...');

    useEffect(() => {
        if (loading) {
            const messages = [
                'Generating Report...',
                'Analyzing Details...',
                'Fetching Insights...',
                'Compiling Data...',
                'Reviewing Inputs...',
                'Preparing Summary...',
                'Processing Request...',
                'Assembling Report...',
                'Finalizing Details...',
                'Optimizing Results...'
            ];
            let index = 0;
            const interval = setInterval(() => {
                setLoadingText(messages[index]);
                index = (index + 1) % messages.length;
            }, 2000);

            return () => clearInterval(interval);
        }
    }, [loading]);

    useEffect(() => {
        const lastUser = localStorage.getItem('lastUserId');
        const currentUser = user?.sub;

        // Clear storage if user changed
        if (lastUser && currentUser && lastUser !== currentUser) {
            // Clear all report-related localStorage items
            const keysToKeep = ['enabledFields']; // Keep any settings that should persist
            Object.keys(localStorage).forEach(key => {
                if (!keysToKeep.includes(key)) {
                    localStorage.removeItem(key);
                }
            });

            // Reset all state
            resetEntireForm();
        }

        // Update stored user
        if (currentUser) {
            localStorage.setItem('lastUserId', currentUser);
        }
    }, [user]);

    const [userData, setUserData] = useState(null);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!user?.sub) return;

            const { data, error } = await supabase
                .from('users')
                .select('dvm_name, custom_physical_exam_template')
                .eq('auth0_user_id', user.sub)
                .single();

            if (!error && data) {
                setUserData(data);
                setDoctor(`Dr. ${data.dvm_name}`);
                if (data.custom_physical_exam_template) {
                    setCustomTemplate(data.custom_physical_exam_template);
                }
            }
        };

        fetchUserData();
    }, [user]);

    // Add these new functions
    const saveCustomTemplate = async () => {
        if (!user?.sub) {
            setError("Please log in to save a custom template");
            return;
        }

        try {
            const { error } = await supabase
                .from('users')
                .update({ custom_physical_exam_template: physicalExamFindings })
                .eq('auth0_user_id', user.sub);

            if (error) throw error;

            setCustomTemplate(physicalExamFindings);
            // Show success message
            const templateBtn = document.querySelector('.save-template-button');
            const originalText = templateBtn.textContent;
            templateBtn.textContent = 'Template Saved!';
            setTimeout(() => {
                templateBtn.textContent = originalText;
            }, 2000);

        } catch (err) {
            setError("Failed to save custom template");
            console.error(err);
        }
    };

    const resetToDefault = async () => {
        try {
            // Update Supabase to clear the custom template
            if (user?.sub) {
                const { error } = await supabase
                    .from('users')
                    .update({ custom_physical_exam_template: null })
                    .eq('auth0_user_id', user.sub);

                if (error) throw error;
            }

            // Clear the custom template from state
            setCustomTemplate(null);

            // Reset to PetWise default
            setPhysicalExamFindings(PETWISE_DEFAULT_PHYSICAL_EXAM);
            localStorage.setItem('physicalExamFindings', PETWISE_DEFAULT_PHYSICAL_EXAM);

            // Show success message
            const defaultBtn = document.querySelector('.default-template-button');
            const originalText = defaultBtn.textContent;
            defaultBtn.textContent = 'Reset Complete!';
            setTimeout(() => {
                defaultBtn.textContent = originalText;
            }, 2000);

        } catch (err) {
            setError("Failed to reset template");
            console.error(err);
        }
    };

    // Add near your other state declarations at the top of ReportForm component
    const [customTemplate, setCustomTemplate] = useState(null);

    // Update useEffect to restore heights on component mount
    useEffect(() => {
        // Restore heights for all textareas except physical exam
        const textareas = document.querySelectorAll('textarea:not(.physical-exam-input)');
        textareas.forEach(textarea => {
            const fieldName = textarea.getAttribute('name');
            if (fieldName) {
                const savedHeight = localStorage.getItem(`${fieldName}_height`);
                if (savedHeight) {
                    textarea.style.height = `${savedHeight}px`;
                }
            }
        });
    }, [patientInfoSubmitted]); // Add patientInfoSubmitted as dependency

    const [monitoring, setMonitoring] = useState('');
    const [showExamInfo, setShowExamInfo] = useState(false);

    useEffect(() => {
        // Check if we're loading a saved report
        const isLoadingSavedReport = localStorage.getItem('currentReportId');
        const patientInfoSubmitted = localStorage.getItem('patientInfoSubmitted') === 'true';

        if (isLoadingSavedReport && patientInfoSubmitted) {
            setPatientInfoSubmitted(true);

            // Wait for DOM to update
            setTimeout(() => {
                const textareas = document.querySelectorAll('textarea:not(.physical-exam-input)');
                textareas.forEach(textarea => {
                    const fieldName = textarea.getAttribute('name');
                    if (fieldName && textarea.value) {
                        const event = { target: textarea };
                        handleTextareaGrow(event, fieldName);
                    }
                });
            }, 100);
        }
    }, []); // Run once on mount

    return (
        <div className="report-container">
            {!patientInfoSubmitted ? (
                <form className="report-form" onSubmit={handlePatientInfoSubmit}>
                    <h2>Patient Info</h2>

                    <div className="button-container">
                        <button type="button" className="clear-button" onClick={resetEntireForm}>
                            Clear All
                        </button>
                    </div>

                    <div className="form-field-container">
                        <div className="field-header">
                            <label className="form-label">Patient Name:</label>
                        </div>
                        <input
                            type="text"
                            className="form-input"
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                        />
                    </div>

                    <div className="form-field-container">
                        <div className="field-header">
                            <label className="form-label">Species:</label>
                        </div>
                        <select
                            className="form-input"
                            value={species}
                            onChange={(e) => setSpecies(e.target.value)}
                        >
                            <option value="">Select Species</option>
                            {speciesOptions.map((species, index) => (
                                <option key={index} value={species}>{species}</option>
                            ))}
                        </select>
                    </div>

                    <label className="form-label">Sex:</label>
                    <select className="form-input" value={sex} onChange={(e) => setSex(e.target.value)}>
                        <option value="">Select Sex</option>
                        {sexOptions.map((sex, index) => (
                            <option key={index} value={sex}>{sex}</option>
                        ))}
                    </select>

                    <div className="form-field-container">
                        <div className="field-header">
                            <label className="form-label">Breed:</label>
                        </div>
                        <select
                            className="form-input"
                            value={isCustomBreed ? 'custom' : breed}
                            onChange={handleBreedChange}
                        >
                            <option value="">Select Breed</option>
                            <option value="custom">Other (specify)</option>
                            {breedOptions.map((breed, index) => (
                                <option key={index} value={breed}>{breed}</option>
                            ))}
                        </select>
                        {isCustomBreed && (
                            <input
                                type="text"
                                className="form-input"
                                value={customBreed}
                                onChange={handleCustomBreedChange}
                                placeholder="Enter custom breed"
                            />
                        )}
                    </div>

                    <label className="form-label">Color/Markings:</label>
                    <input type="text" className="form-input" value={colorMarkings} onChange={(e) => setColorMarkings(e.target.value)} />

                    <label className="form-label">Weight:</label>
                    <div className="weight-container">
                        <input type="text" className="form-input weight-input" value={weight} onChange={(e) => setWeight(e.target.value)} />
                        <select className="form-input weight-unit" value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)}>
                            <option value="lbs">lbs</option>
                            <option value="kg">kg</option>
                        </select>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Age:</label>
                        <input
                            type="text"
                            className="form-input"
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                        />
                    </div>

                    <div className="button-container">
                        <button type="submit" className="continue-button">
                            Exam Info
                        </button>
                        <button type="button" className="clear-button" onClick={resetEntireForm}>
                            Clear All
                        </button>
                    </div>
                </form>
            ) : (
                <form className="report-form" onSubmit={handleExamSubmit}>
                    <h2>Exam Info</h2>

                    <div className="button-container">
                        <button type="button" className="clear-button" onClick={resetEntireForm}>
                            Clear All
                        </button>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Doctor:</label>
                        <input
                            type="text"
                            className="form-input doctor-input"
                            value={`Dr. ${userData?.dvm_name || ''}`}
                            disabled
                        />
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Exam Date:</label>
                        <div className="input-toggle-wrapper">
                            <input
                                type="date"
                                className={`form-input ${!enabledFields.examDate ? 'disabled' : ''}`}
                                value={formatDateForInput(examDate)}
                                onChange={(e) => {
                                    const date = e.target.value;
                                    handleInputChange(e, 'examDate', setExamDate);
                                    localStorage.setItem('examDate', date);
                                }}
                                disabled={!enabledFields.examDate}
                            />
                            <ToggleSwitch
                                fieldName="examDate"
                                enabled={enabledFields.examDate}
                                onChange={() => handleToggleField('examDate')}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Presenting Complaint:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                name="presentingComplaint"
                                className={`form-input ${!enabledFields.presentingComplaint ? 'disabled' : ''}`}
                                value={presentingComplaint}
                                onChange={(e) => handleInputChange(e, 'presentingComplaint', setPresentingComplaint)}
                                disabled={!enabledFields.presentingComplaint}
                                placeholder='Add data or leave blank to auto-populate'
                            />
                            <ToggleSwitch
                                fieldName="presentingComplaint"
                                enabled={enabledFields.presentingComplaint}
                                onChange={() => handleToggleField('presentingComplaint')}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">History:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                name="history"
                                className={`form-input ${!enabledFields.history ? 'disabled' : ''}`}
                                value={history}
                                onChange={(e) => handleInputChange(e, 'history', setHistory)}
                                disabled={!enabledFields.history}
                                placeholder='Add data or leave blank to auto-populate'
                            />
                            <ToggleSwitch
                                fieldName="history"
                                enabled={enabledFields.history}
                                onChange={() => handleToggleField('history')}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Physical Exam Findings:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                className={`form-input physical-exam-input ${!enabledFields.physicalExamFindings ? 'disabled' : ''}`}
                                value={physicalExamFindings}
                                onChange={(e) => handleInputChange(e, 'physicalExamFindings', setPhysicalExamFindings)}
                                disabled={!enabledFields.physicalExamFindings}
                            />
                            <ToggleSwitch
                                fieldName="physicalExamFindings"
                                enabled={enabledFields.physicalExamFindings}
                                onChange={() => handleToggleField('physicalExamFindings')}
                            />
                        </div>
                        <div className="template-controls">
                            <button
                                type="button"
                                className="save-template-button"
                                onClick={saveCustomTemplate}
                            >
                                Set as Template
                            </button>
                            <button
                                type="button"
                                className="default-template-button"
                                onClick={resetToDefault}
                            >
                                Reset to Default
                            </button>
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Diagnostic Tests:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                name="diagnosticTests"
                                className={`form-input diagnostic-tests-input ${!enabledFields.diagnosticTests ? 'disabled' : ''}`}
                                value={diagnosticTests}
                                onChange={(e) => handleInputChange(e, 'diagnosticTests', setDiagnosticTests)}
                                disabled={!enabledFields.diagnosticTests}
                                placeholder='Add data or leave blank to auto-populate'
                            />
                            <ToggleSwitch
                                fieldName="diagnosticTests"
                                enabled={enabledFields.diagnosticTests}
                                onChange={() => handleToggleField('diagnosticTests')}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Assessment:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                name="assessment"
                                className={`form-input ${!enabledFields.assessment ? 'disabled' : ''}`}
                                value={assessment}
                                onChange={(e) => handleInputChange(e, 'assessment', setAssessment)}
                                disabled={!enabledFields.assessment}
                                placeholder='Add data or leave blank to auto-populate'
                            />
                            <ToggleSwitch
                                fieldName="assessment"
                                enabled={enabledFields.assessment}
                                onChange={() => handleToggleField('assessment')}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Diagnosis:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                name="diagnosis"
                                className={`form-input ${!enabledFields.diagnosis ? 'disabled' : ''}`}
                                value={diagnosis}
                                onChange={(e) => handleInputChange(e, 'diagnosis', setDiagnosis)}
                                disabled={!enabledFields.diagnosis}
                                placeholder='Add data or leave blank to auto-populate'
                            />
                            <ToggleSwitch
                                fieldName="diagnosis"
                                enabled={enabledFields.diagnosis}
                                onChange={() => handleToggleField('diagnosis')}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Differential Diagnosis:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                name="differentialDiagnosis"
                                className={`form-input ${!enabledFields.differentialDiagnosis ? 'disabled' : ''}`}
                                value={differentialDiagnosis}
                                onChange={(e) => handleInputChange(e, 'differentialDiagnosis', setDifferentialDiagnosis)}
                                disabled={!enabledFields.differentialDiagnosis}
                                placeholder='Add data or leave blank to auto-populate'
                            />
                            <ToggleSwitch
                                fieldName="differentialDiagnosis"
                                enabled={enabledFields.differentialDiagnosis}
                                onChange={() => handleToggleField('differentialDiagnosis')}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Treatment:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                name="treatment"
                                className={`form-input ${!enabledFields.treatment ? 'disabled' : ''}`}
                                value={treatment}
                                onChange={(e) => handleInputChange(e, 'treatment', setTreatment)}
                                disabled={!enabledFields.treatment}
                                placeholder='Add data or leave blank to auto-populate'
                            />
                            <ToggleSwitch
                                fieldName="treatment"
                                enabled={enabledFields.treatment}
                                onChange={() => handleToggleField('treatment')}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Naturopathic Medicine:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                name="naturopathicMedicine"
                                className={`form-input ${!enabledFields.naturopathicMedicine ? 'disabled' : ''}`}
                                value={naturopathicMedicine}
                                onChange={(e) => handleInputChange(e, 'naturopathicMedicine', setNaturopathicMedicine)}
                                disabled={!enabledFields.naturopathicMedicine}
                                placeholder='Add data or leave blank to auto-populate'
                            />
                            <ToggleSwitch
                                fieldName="naturopathicMedicine"
                                enabled={enabledFields.naturopathicMedicine}
                                onChange={() => handleToggleField('naturopathicMedicine')}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Client Communications:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                name="clientCommunications"
                                className={`form-input ${!enabledFields.clientCommunications ? 'disabled' : ''}`}
                                value={clientCommunications}
                                onChange={(e) => handleInputChange(e, 'clientCommunications', setClientCommunications)}
                                disabled={!enabledFields.clientCommunications}
                                placeholder='Add data or leave blank to auto-populate'
                            />
                            <ToggleSwitch
                                fieldName="clientCommunications"
                                enabled={enabledFields.clientCommunications}
                                onChange={() => handleToggleField('clientCommunications')}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Follow-up:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                name="planFollowUp"
                                className={`form-input ${!enabledFields.planFollowUp ? 'disabled' : ''}`}
                                value={planFollowUp}
                                onChange={(e) => handleInputChange(e, 'planFollowUp', setPlanFollowUp)}
                                disabled={!enabledFields.planFollowUp}
                                placeholder='Add data or leave blank to auto-populate'
                            />
                            <ToggleSwitch
                                fieldName="planFollowUp"
                                enabled={enabledFields.planFollowUp}
                                onChange={() => handleToggleField('planFollowUp')}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Patient Visit Summary:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                name="patientVisitSummary"
                                className={`form-input ${!enabledFields.patientVisitSummary ? 'disabled' : ''}`}
                                value={patientVisitSummary}
                                onChange={(e) => handleInputChange(e, 'patientVisitSummary', setPatientVisitSummary)}
                                disabled={!enabledFields.patientVisitSummary}
                                placeholder='Add data or leave blank to auto-populate'
                            />
                            <ToggleSwitch
                                fieldName="patientVisitSummary"
                                enabled={enabledFields.patientVisitSummary}
                                onChange={() => handleToggleField('patientVisitSummary')}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Notes:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                name="notes"
                                className={`form-input ${!enabledFields.notes ? 'disabled' : ''}`}
                                value={notes}
                                onChange={(e) => handleInputChange(e, 'notes', setNotes)}
                                disabled={!enabledFields.notes}
                                placeholder='Add notes you wish to generate'
                            />
                            <ToggleSwitch
                                fieldName="notes"
                                enabled={enabledFields.notes}
                                onChange={() => handleToggleField('notes')}
                            />
                        </div>
                    </div>

                    <div className="button-container">
                        <button type="button" className="submit-button" onClick={handleBackToPatientInfo}>
                            Back to Patient Info
                        </button>
                        <button
                            type="submit"
                            className="generate-report-button"
                            disabled={loading || reportsUsed >= reportLimit}
                        >
                            {loading ? 'Generating...' : 'Generate Record'}
                        </button>
                        {showLimitWarning && <LimitWarningPopup />}
                        <button type="button" className="clear-button" onClick={resetEntireForm}>
                            Clear All
                        </button>
                    </div>

                    {error && <div className="error-message">{error}</div>}
                </form>
            )}

            <div className="report-preview">
                <div className="report-preview-header">
                    <h3>Record Preview</h3>
                    {previewVisible && (
                        <button className="close-button" onClick={() => setPreviewVisible(false)}>×</button>
                    )}
                </div>

                <div className="report-preview-content" ref={previewContentRef}>
                    {loading ? (
                        <div className="report-form-loading-container">
                            <div className="report-form-loading-spinner"></div>
                            <p className="loading-text">{loadingText}</p>
                        </div>
                    ) : previewVisible ? (
                        <div className="editor-wrapper" style={{
                            height: '100%',
                            overflowY: 'auto',
                            backgroundColor: 'white',
                            padding: '8px',          // Reduced from 10px
                            borderRadius: '4px'
                        }}>
                            <Slate
                                editor={editor}
                                initialValue={slateValue}
                                value={slateValue}
                                onChange={value => {
                                    setSlateValue(value);
                                    const newText = processSlateForPDF(value);
                                    setReportText(newText);
                                    localStorage.setItem('currentReportText', newText);
                                }}
                            >
                                <Editable
                                    renderElement={renderElement}
                                    renderLeaf={renderLeaf}
                                    style={{
                                        minHeight: '100%',
                                        padding: '8px',          // Reduced from 10px
                                        whiteSpace: 'pre-wrap',
                                        lineHeight: '1.2',       // Reduced from 1.5
                                        fontSize: '14px'         // Reduced from 14px
                                    }}
                                    onCopy={(event) => {
                                        event.preventDefault();
                                        const selection = window.getSelection();

                                        const selectedNodes = slateValue.filter(node => {
                                            const nodeText = Node.string(node);
                                            return selection.toString().includes(nodeText);
                                        });

                                        const formattedText = processSlateForPDF(selectedNodes);
                                        const plainText = formattedText.replace(/\*\*/g, '');

                                        const htmlContent = formattedText.split('\n').map(line => {
                                            if (line.startsWith('**') && line.endsWith('**')) {
                                                return `<b style="background: none; background-color: transparent;">${line.slice(2, -2)}</b>`;
                                            }
                                            return `<span style="background: none; background-color: transparent;">${line}</span>`;
                                        }).join('<br>');

                                        const wrappedHtml = `
                                            <div style="color: black; background: none; background-color: transparent;">
                                                ${htmlContent}
                                            </div>
                                        `;

                                        event.clipboardData.setData('text/html', wrappedHtml);
                                        event.clipboardData.setData('text/plain', plainText);
                                    }}
                                />
                            </Slate>
                        </div>
                    ) : (
                        <div className="report-placeholder">
                            <h2>Record will appear here</h2>
                            <p>Fill out the form and click "Generate Record" to see the preview</p>
                            <div className="ai-warning">
                                <p>Disclaimer: This record is generated using AI and is for educational purposes only. All content must be reviewed and verified by a licensed veterinarian before use. PetWise is not liable for any errors, omissions, or outcomes based on this record.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="report-preview-footer">
                    <div className="button-container">
                        <button className="submit-button" onClick={saveReport} disabled={loading}>Save Report</button>
                        <div className="copy-button-container">
                            <button className="copy-button" onClick={copyToClipboard} disabled={loading}>
                                {copyButtonText}
                            </button>
                            {copiedMessageVisible && <span className="copied-message">Copied</span>}
                        </div>
                        {reportText && (
                            <>
                                <div className="copy-button-container">
                                    <PDFButton
                                        reportText={reportText}
                                        patientName={patientName}
                                        editor={editor}
                                    />
                                </div>
                                <div className="copy-button-container">
                                    <PrintButton reportText={reportText} editor={editor} />
                                </div>
                            </>
                        )}
                    </div>

                    {error && <div className="error-message">{error}</div>}
                </div>
            </div>
        </div>
    );
};

export default ReportForm;
