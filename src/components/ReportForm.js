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
const mainHeaders = [
    'Veterinary Medical Record:',
    'Patient Information:',
    'Staff:',
    'Presenting Complaint:',
    'History:',
    'Physical Exam Findings:',
    'Diagnostic Tests:',
    'Assessment:',
    'Diagnosis:',
    'Differential Diagnoses:',
    'PLAN',
    'Treatment:',
    'Monitoring:',
    'Drug Interactions/Side Effects:',
    'Naturopathic Medicine:',
    'Client Communications:',
    'Follow-Up:',
    'Patient Visit Summary:',
    'Notes:'
];

const PDFDocument = ({ reportText }) => {
    const styles = StyleSheet.create({
        page: {
            padding: 40,
            fontSize: 12,
            fontFamily: 'Helvetica',
            lineHeight: 1.1
        },
        text: {
            marginBottom: 2,
            whiteSpace: 'pre-wrap',
            fontFamily: 'Helvetica'
        },
        strongText: {
            fontFamily: 'Helvetica-Bold',
            marginBottom: 8,
            marginTop: 16,
            fontSize: 12
        },
        indentedText: {
            marginLeft: 20,
            marginBottom: 2,
            fontFamily: 'Helvetica'
        }
    });

    const formatText = (text) => {
        const paragraphs = text.split('\n');
        let isInPatientInfo = false;
        let mainContent = [];
        let summaryAndNotes = [];
        let isInSummaryOrNotes = false;

        paragraphs.forEach((paragraph, index) => {
            let trimmedParagraph = paragraph.trim();
            if (!trimmedParagraph) return;

            // Check if we're entering summary or notes section
            if (trimmedParagraph === 'Patient Visit Summary:' || trimmedParagraph === 'Notes:') {
                isInSummaryOrNotes = true;
            }

            // Update the header check to include date-containing headers
            const isHeader = trimmedParagraph.startsWith('Physical Exam Findings: -') ||
                trimmedParagraph.endsWith(':') ||
                mainHeaders.some(header => trimmedParagraph.startsWith(header));

            // Clean the text only if it's not a header
            if (!isInPatientInfo && !isHeader) {
                trimmedParagraph = trimmedParagraph
                    .replace(/^[•\-]\s*/, '')
                    .replace(/\*\*(\w[^*]*\w)\*\*/g, '$1')
                    .trim();
            }

            // Update patient info tracking
            if (trimmedParagraph === 'Patient Information:') {
                isInPatientInfo = true;
            } else if (mainHeaders.some(header => trimmedParagraph.endsWith(':'))) {
                isInPatientInfo = false;
            }

            // Create text element with appropriate styling
            let textElement;
            if (isHeader) {
                textElement = <Text key={index} style={styles.strongText}>{trimmedParagraph}</Text>;
            } else if (isInPatientInfo) {
                textElement = <Text key={index} style={styles.text}>{trimmedParagraph}</Text>;
            } else if (paragraph.startsWith('    ')) {
                textElement = <Text key={index} style={styles.indentedText}>{trimmedParagraph}</Text>;
            } else {
                textElement = <Text key={index} style={styles.text}>{trimmedParagraph}</Text>;
            }

            // Add to appropriate array
            if (isInSummaryOrNotes) {
                summaryAndNotes.push(textElement);
            } else {
                mainContent.push(textElement);
            }
        });

        return { mainContent, summaryAndNotes };
    };

    const { mainContent, summaryAndNotes } = formatText(reportText);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {mainContent}
            </Page>
            {summaryAndNotes.length > 0 && (
                <Page size="A4" style={styles.page}>
                    {summaryAndNotes}
                </Page>
            )}
        </Document>
    );
};

// Add this helper function to process the Slate value
const processSlateForPDF = (nodes) => {
    let formattedText = '';

    nodes.forEach(node => {
        const text = node.children[0].text;

        if (node.type === 'heading') {
            // Always ensure heading ends with a colon
            const formattedHeader = text.endsWith(':') ? text : `${text}:`;
            formattedText += `${formattedHeader}\n`;
        } else if (!text.trim()) {
            formattedText += '\n';
        } else {
            if (node.children[0].bold) {
                formattedText += `**${text}**\n`;
            } else {
                formattedText += `${text}\n`;
            }
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

const createSlateValue = (text) => {
    const paragraphs = text.split('\n');
    let isInPatientInfo = false;

    return paragraphs.map(paragraph => {
        const trimmedParagraph = paragraph.trim();

        // Check for Patient Information section start/end
        if (trimmedParagraph === 'Patient Information:') {
            isInPatientInfo = true;
        } else if (mainHeaders.some(header => trimmedParagraph === header) && isInPatientInfo) {
            isInPatientInfo = false;
        }

        // Update header detection to match PDF formatting
        const isHeader =
            mainHeaders.some(header =>
                trimmedParagraph === header ||
                trimmedParagraph === header.replace(':', '') ||
                trimmedParagraph === 'Veterinary Medical Record' ||
                trimmedParagraph === 'PLAN'
            ) ||
            trimmedParagraph.match(/^Physical Exam Findings: - \d+ \w+ \d{4}$/) ||
            (trimmedParagraph.endsWith(':') && !trimmedParagraph.includes(' '));

        if (isHeader) {
            return {
                type: 'heading',
                children: [{
                    text: trimmedParagraph,
                    bold: true
                }]
            };
        }

        // Handle patient info section with consistent indentation
        if (isInPatientInfo && trimmedParagraph.includes(':')) {
            return {
                type: 'paragraph',
                children: [{ text: paragraph }]
            };
        }

        // Remove bullets and dashes from the start of lines
        let cleanedText = paragraph;
        if (!isInPatientInfo) {
            cleanedText = paragraph.replace(/^[•\-]\s*/, '').trim();
        }

        // Default paragraph with consistent indentation
        return {
            type: 'paragraph',
            children: [{ text: cleanedText }]
        };
    });
};

const renderElement = props => {
    switch (props.element.type) {
        case 'heading':
            return <div {...props.attributes} style={{
                fontWeight: 'bold',
                marginTop: '10px',
                marginBottom: '5px'
            }}>{props.children}</div>;
        default:
            return <div {...props.attributes} style={{
                marginBottom: '3px'
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
const deserializeSlateValue = (text) => {
    if (!text) return [{ type: 'paragraph', children: [{ text: '' }] }];
    return createSlateValue(text);
};

// Add these helper functions at the top of the file
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

    // Patient Info State
    const [patientName, setPatientName] = useState(() => localStorage.getItem('patientName') || '');
    const [species, setSpecies] = useState(() => localStorage.getItem('species') || '');
    const [sex, setSex] = useState(() => localStorage.getItem('sex') || '');
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
        // First try to get from localStorage
        const savedDate = localStorage.getItem('examDate');
        if (savedDate) return savedDate;

        // If no saved date, use current date formatted as YYYY-MM-DD
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        return formattedDate;
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
        // Always default to all fields enabled
        const defaultFields = {
            examDate: true,
            doctor: true,
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
        return savedFields ? JSON.parse(savedFields) : defaultFields;
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
        // Load all saved form fields from localStorage
        const savedReportText = localStorage.getItem('currentReportText');
        const savedPreviewVisible = localStorage.getItem('previewVisible') === 'true';

        // Only set the report text if it exists in localStorage
        if (savedReportText) {
            setReportText(savedReportText);
        }

        setPreviewVisible(savedPreviewVisible);

        // Load other form fields...
        const savedPatientName = localStorage.getItem('patientName');
        const savedAge = localStorage.getItem('age');
        const savedDoctor = localStorage.getItem('doctor');
        // ... etc

        if (savedPatientName) setPatientName(savedPatientName);
        if (savedAge) setAge(savedAge);
        if (savedDoctor) setDoctor(savedDoctor);
    }, []); // Empty dependency array means this runs once on mount

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
                ownerName, address, telephone, examDate: examDate, doctor, presentingComplaint, history,
                physicalExamFindings, diagnosticTests, assessment, diagnosis,
                differentialDiagnosis, treatment, clientCommunications, planFollowUp,
                naturopathicMedicine, patientVisitSummary, notes
            };

            const generatedReport = await GenerateReport(inputs, enabledFields);
            setReportText(generatedReport);
            setPreviewVisible(true);

            // Force scroll to top immediately after state updates
            if (previewContentRef.current) {
                previewContentRef.current.scrollTop = 0;
            }

            // Update reports_used_today in Supabase
            const { error: updateError } = await supabase
                .from('users')
                .update({ reports_used_today: reportsUsed + 1 })
                .eq('auth0_user_id', user.sub);

            if (updateError) throw updateError;

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
            // Get user's UUID from users table using auth0_user_id directly
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('auth0_user_id', user.sub)
                .single();

            if (userError || !userData) {
                // console.error("Error fetching user:", userError);
                throw new Error("User not found in Supabase.");
            }

            const userId = userData.id; // This is the user's internal ID
            // console.log("User ID fetched:", userId); // Log user ID

            // console.log(userId)
            // Save report with user's UUID
            const { data, error: insertError } = await supabase
                .from('saved_reports')
                .insert([{
                    user_id: userId, // Ensure this matches the policy check
                    report_name: `${patientName} - ${new Date().toLocaleString()}` || `Report ${new Date().toLocaleString()}`,
                    report_text: reportText
                }]);

            if (insertError) {
                console.error("Insert error:", insertError); // Log error details
                throw insertError;
            }

            setSavedMessageVisible(true);
            setTimeout(() => setSavedMessageVisible(false), 2000);
            console.log("Report saved successfully to Supabase:", data);

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




    const clearPatientInfo = () => {
        setPatientName('');
        setSpecies('');
        setSex('');
        setBreed('');
        setColorMarkings('');
        setWeight('');
        setWeightUnit('lbs');
        setAge('');
        setDoctor('');

        // Clear localStorage for each field
        localStorage.removeItem('patientName');
        localStorage.removeItem('species');
        localStorage.removeItem('sex');
        localStorage.removeItem('breed');
        localStorage.removeItem('colorMarkings');
        localStorage.removeItem('weight');
        localStorage.removeItem('weightUnit');
        localStorage.removeItem('age');
        localStorage.removeItem('doctor');
    };

    const copyToClipboard = () => {
        // Create HTML content with explicit styling
        const htmlContent = slateValue.map(node => {
            if (node.type === 'heading' || (node.children[0] && node.children[0].bold)) {
                return `<b style="background: none; background-color: transparent;">${Node.string(node)}</b>`;
            }
            return `<span style="background: none; background-color: transparent;">${Node.string(node)}</span>`;
        }).join('<br>');

        // Wrap in a div with explicit styling
        const wrappedHtml = `
            <div style="color: black; background: none; background-color: transparent;">
                ${htmlContent}
            </div>
        `;

        // Use the Clipboard API instead of execCommand
        const clipboardData = new ClipboardItem({
            'text/html': new Blob([wrappedHtml], { type: 'text/html' }),
            'text/plain': new Blob([slateValue.map(node => Node.string(node)).join('\n')], { type: 'text/plain' })
        });

        navigator.clipboard.write([clipboardData]).then(() => {
            setCopyButtonText('Copied!');
            setCopiedMessageVisible(true);
            setTimeout(() => {
                setCopyButtonText('Copy to Clipboard');
                setCopiedMessageVisible(false);
            }, 2000);
        });
    };

    const resetEntireForm = () => {
        // Get current date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];

        // Clear all form states
        setPatientName('');
        setSpecies('');
        setSex('');
        setBreed('');
        setColorMarkings('');
        setWeight('');
        setWeightUnit('lbs');
        setAge('');
        setDoctor('');
        setPresentingComplaint('');
        setHistory('');
        // Use custom template if it exists, otherwise use default
        setPhysicalExamFindings(customTemplate || PETWISE_DEFAULT_PHYSICAL_EXAM);
        setDiagnosticTests(DEFAULT_DIAGNOSTIC_TESTS);
        setAssessment('');
        setDiagnosis('');
        setDifferentialDiagnosis('');
        setTreatment('');
        setNaturopathicMedicine('');
        setClientCommunications('');
        setPlanFollowUp('');
        setReportText('');
        setPreviewVisible(false);
        setPatientVisitSummary('');
        setNotes('');

        // Clear localStorage except for enabledFields
        const savedEnabledFields = localStorage.getItem('enabledFields');
        localStorage.clear();

        // Restore default templates and current date
        localStorage.setItem('physicalExamFindings', customTemplate || PETWISE_DEFAULT_PHYSICAL_EXAM);
        localStorage.setItem('diagnosticTests', DEFAULT_DIAGNOSTIC_TESTS);
        localStorage.setItem('examDate', today);

        // Restore enabled fields
        if (savedEnabledFields) {
            localStorage.setItem('enabledFields', savedEnabledFields);
        }
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
        setEnabledFields((prevFields) => {
            const updatedFields = {
                ...prevFields,
                [fieldName]: !prevFields[fieldName]
            };
            localStorage.setItem('enabledFields', JSON.stringify(updatedFields));
            return updatedFields;
        });
    };

    // Update the onChange handlers to also update localStorage immediately
    const handleInputChange = (e, fieldName, setter) => {
        const value = e.target.value;
        setter(value);
        localStorage.setItem(fieldName, value); // Update localStorage immediately

        // If field is cleared, remove from localStorage
        if (!value.trim()) {
            localStorage.removeItem(fieldName);
        }
    };

    // Add new state with the other state declarations
    const [patientVisitSummary, setPatientVisitSummary] = useState(() => localStorage.getItem('patientVisitSummary') || '');
    const [notes, setNotes] = useState(() => localStorage.getItem('notes') || '');

    // Add mainHeaders at the top of the component
    const mainHeaders = [
        'Veterinary Medical Record:',
        'Assessment:',
        'Diagnosis:',
        'Differential Diagnosis:',
        'Plan:',
        'Treatment:',
        'Monitoring:',
        'Drug Interactions/Side Effects:',
        'Naturopathic Medicine:',
        'Client Communications:',
        'Client Education:',
        'Follow-Up:',
        'Physical Exam Findings:',
        'History:',
        'Presenting Complaint:',
        'Diagnostic Tests:'
    ];

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
            const initialValue = createSlateValue(reportText);
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
            const remainingReports = Math.max(0, reportLimit - reportsUsed);
            setShowLimitWarning(remainingReports <= 3);
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
                setDoctor(data.dvm_name);
                // Only set custom template, don't update physicalExamFindings
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
                            padding: '20px',
                            borderRadius: '4px'
                        }}>
                            <Slate
                                editor={editor}
                                initialValue={slateValue}
                                value={slateValue}
                                onChange={value => {
                                    setSlateValue(value);
                                    const newText = value
                                        .map(n => Node.string(n))
                                        .join('\n');
                                    setReportText(newText);
                                    localStorage.setItem('currentReportText', newText);
                                }}
                            >
                                <Editable
                                    renderElement={renderElement}
                                    renderLeaf={renderLeaf}
                                    style={{
                                        minHeight: '100%',
                                        padding: '10px',
                                        whiteSpace: 'pre-wrap',
                                        lineHeight: '1.5',
                                        fontSize: '14px'
                                    }}
                                    onCopy={(event) => {
                                        event.preventDefault();
                                        const selection = window.getSelection();

                                        // Create HTML content for rich text copying with explicit styling
                                        const selectedNodes = slateValue.filter(node => {
                                            const nodeText = Node.string(node);
                                            return selection.toString().includes(nodeText);
                                        });

                                        const htmlContent = selectedNodes.map(node => {
                                            if (node.type === 'heading' || (node.children[0] && node.children[0].bold)) {
                                                return `<b style="background: none; background-color: transparent;">${Node.string(node)}</b>`;
                                            }
                                            return `<span style="background: none; background-color: transparent;">${Node.string(node)}</span>`;
                                        }).join('<br>');

                                        const wrappedHtml = `
                                            <div style="color: black; background: none; background-color: transparent;">
                                                ${htmlContent}
                                            </div>
                                        `;

                                        event.clipboardData.setData('text/html', wrappedHtml);
                                        event.clipboardData.setData('text/plain', selection.toString());
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
