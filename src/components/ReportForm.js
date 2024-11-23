import React, { useState, useEffect, useRef } from 'react';
import '../styles/ReportForm.css';
import GenerateReport from './GenerateReport';
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../supabaseClient';
import { pdf } from '@react-pdf/renderer';
import { Document, Page, Text, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer';

const PDFDocument = ({ reportText }) => {
    const styles = StyleSheet.create({
        page: {
            padding: 40,
            fontSize: 12,
            fontFamily: 'Helvetica',
            lineHeight: 1.5
        },
        text: {
            marginBottom: 10,
            whiteSpace: 'pre-wrap'
        }
    });

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.text}>{reportText}</Text>
            </Page>
        </Document>
    );
};

const PDFButton = ({ reportText, patientName }) => {
    const [isPreparing, setIsPreparing] = useState(false);

    const generatePDF = async () => {
        setIsPreparing(true);
        const doc = <PDFDocument reportText={reportText} />;
        const blob = await pdf(doc).toBlob();
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${patientName || 'Report'}-${new Date().toLocaleDateString()}.pdf`;
        link.click();

        URL.revokeObjectURL(url);
        setIsPreparing(false);
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

const ToggleSwitch = ({ fieldName, enabled, onChange }) => (
    <div className="toggle-switch">
        <label className="switch">
            <input
                type="checkbox"
                checked={enabled}
                onChange={() => onChange(fieldName)}
            />
            <span className="slider round"></span>
        </label>
    </div>
);

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

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
    const [birthdate, setBirthdate] = useState(() => localStorage.getItem('birthdate') || '');
    const [ownerName, setOwnerName] = useState(() => localStorage.getItem('ownerName') || '');
    const [address, setAddress] = useState(() => localStorage.getItem('address') || '');
    const [telephone, setTelephone] = useState(() => localStorage.getItem('telephone') || '');

    // Exam Info State
    const [examDate, setExamDate] = useState(() => localStorage.getItem('examDate') || '');
    const [staff, setStaff] = useState(() => localStorage.getItem('staff') || '');
    const [presentingComplaint, setPresentingComplaint] = useState(() => localStorage.getItem('presentingComplaint') || '');
    const [history, setHistory] = useState(() => localStorage.getItem('history') || '');
    const [physicalExamFindings, setPhysicalExamFindings] = useState(() => localStorage.getItem('physicalExamFindings') || `General Appearance: Bright, Alert
Temperature: 
Heart Rate:
Respiratory Rate:
Body Condition Score: 5/9 (Ideal=5/9)
Mucous Membranes: Pink, moist, CRT <2s
Eyes: No abnormal findings
Ears: No abnormal findings
Nose: No abnormal findings
Throat: No abnormal findings
Oral: Gd. 1 tartar
Heart: No abnormal findings
Lungs: Clear on auscultation, no abnormal sounds
Abdomen Palpation: No abnormal findings
Lymph Nodes: No enlargement 
Skin and Coat: No lesions, normal coat condition, no ectoparasites observed
Musculoskeletal: No abnormal findings
Neurologic: No abnormal findings
Urogenital: No abnormal findings`);
    const [diagnosticPlan, setDiagnosticPlan] = useState(() => localStorage.getItem('diagnosticPlan') || '');
    const [labResults, setLabResults] = useState(() => localStorage.getItem('labResults') || '');
    const [assessment, setAssessment] = useState(() => localStorage.getItem('assessment') || '');
    const [diagnosis, setDiagnosis] = useState(() => localStorage.getItem('diagnosis') || '');
    const [differentialDiagnosis, setDifferentialDiagnosis] = useState(() => localStorage.getItem('differentialDiagnosis') || '');
    const [treatment, setTreatment] = useState(() => localStorage.getItem('treatment') || '');
    const [clientCommunications, setClientCommunications] = useState(() => localStorage.getItem('clientCommunications') || '');
    const [planFollowUp, setPlanFollowUp] = useState(() => localStorage.getItem('planFollowUp') || '');

    // Loading and error states
    const [loading, setLoading] = useState(false);
    const [reportText, setReportText] = useState(() => localStorage.getItem('currentReportText') || '');
    const [previewVisible, setPreviewVisible] = useState(() => localStorage.getItem('previewVisible') === 'true');
    const [error, setError] = useState('');

    const [savedMessageVisible, setSavedMessageVisible] = useState(false);
    const [copiedMessageVisible, setCopiedMessageVisible] = useState(false);
    const [copyButtonText, setCopyButtonText] = useState('Copy to Clipboard');

    const [customBreed, setCustomBreed] = useState('');
    const [isCustomBreed, setIsCustomBreed] = useState(false);

    const [naturopathicMedicine, setNaturopathicMedicine] = useState(() => localStorage.getItem('naturopathicMedicine') || '');

    const isGenerating = useRef(false); // Track if report generation is ongoing

    const speciesOptions = ['Canine', 'Feline', 'Avian', 'Reptile', 'Bovine', 'Equine', 'Ovine', 'Porcine'];
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

    // Set breed options based on species
    const breedOptions = species === 'Canine' ? dogBreeds : species === 'Feline' ? felineBreeds : [];

    // Add near other state declarations
    const [enabledFields, setEnabledFields] = useState(() => {
        const saved = localStorage.getItem('enabledFields');
        return saved ? JSON.parse(saved) : {
            patientName: true,
            species: true,
            sex: true,
            breed: true,
            colorMarkings: true,
            weight: true,
            birthdate: true,
            ownerName: true,
            address: true,
            telephone: true,
            examDate: true,
            staff: true,
            presentingComplaint: true,
            history: true,
            physicalExamFindings: true,
            diagnosticPlan: true,
            labResults: true,
            assessment: true,
            diagnosis: true,
            differentialDiagnosis: true,
            treatment: true,
            naturopathicMedicine: true,
            clientCommunications: true,
            planFollowUp: true
        };
    });

    const [reportsUsed, setReportsUsed] = useState(0);
    const [reportLimit, setReportLimit] = useState(0);

    useEffect(() => {
        const fetchReportUsage = async () => {
            if (!user) return;

            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('reports_used_today, subscription_type')
                    .eq('auth0_user_id', user.sub)
                    .single();

                if (error) throw error;

                setReportsUsed(data.reports_used_today);

                // Set limit based on subscription type
                const limits = {
                    trial: 10,
                    singleUser: 25,
                    multiUser: 120,
                    clinic: 400
                };
                setReportLimit(limits[data.subscription_type] || 0);
            } catch (error) {
                console.error('Error fetching report usage:', error);
            }
        };

        fetchReportUsage();
    }, [user]);

    useEffect(() => {
        const savedReportText = localStorage.getItem('currentReportText');
        const savedPreviewVisible = localStorage.getItem('previewVisible') === 'true';

        if (savedReportText !== null && savedReportText !== '') {
            setReportText(savedReportText);
        }

        setPreviewVisible(savedPreviewVisible);
    }, []);

    useEffect(() => {
        localStorage.setItem('currentReportText', reportText);
        localStorage.setItem('previewVisible', previewVisible.toString());
        localStorage.setItem('patientName', patientName);
    }, [reportText, previewVisible, patientName]);

    // Submit patient info
    const handlePatientInfoSubmit = (e) => {
        e.preventDefault();
        setPatientInfoSubmitted(true);
    };

    // Go back to patient info form
    const handleBackToPatientInfo = () => {
        setPatientInfoSubmitted(false);
    };

    // Submit exam info and generate report
    const handleExamSubmit = async (e) => {
        e.preventDefault();
        if (isGenerating.current) return;
        if (reportsUsed >= reportLimit) {
            setError(`Daily report limit reached (${reportsUsed}/${reportLimit}). Please upgrade your plan for more reports.`);
            return;
        }

        setLoading(true);
        isGenerating.current = true;

        try {
            const inputs = {
                patientName, species, sex, breed, colorMarkings, weight, weightUnit, birthdate,
                ownerName, address, telephone, examDate, staff, presentingComplaint, history,
                physicalExamFindings, diagnosticPlan, labResults, assessment, diagnosis,
                differentialDiagnosis, treatment, clientCommunications, planFollowUp,
                naturopathicMedicine
            };

            const generatedReport = await GenerateReport(inputs, enabledFields);
            setReportText(generatedReport);
            setPreviewVisible(true);
            localStorage.setItem('currentReportText', generatedReport);
            localStorage.setItem('previewVisible', 'true');
            localStorage.setItem('patientName', patientName);

            // Update reports_used_today in Supabase
            const { error: updateError } = await supabase
                .from('users')
                .update({ reports_used_today: reportsUsed + 1 })
                .eq('auth0_user_id', user.sub);

            if (updateError) throw updateError;

            // Update local state
            setReportsUsed(prev => prev + 1);
        } catch (error) {
            if (error.message.includes('Daily report limit reached')) {
                setError(`Daily report limit reached (${reportsUsed}/${reportLimit}). Please upgrade your plan for more reports.`);
            } else {
                setError(error.message || 'An error occurred while generating the report.');
            }
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
        setBirthdate('');
        setOwnerName('');
        setAddress('');
        setTelephone('');
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(reportText).then(() => {
            setCopyButtonText('Copied!');
            setCopiedMessageVisible(true);
            setTimeout(() => {
                setCopyButtonText('Copy to Clipboard');
                setCopiedMessageVisible(false);
            }, 2000); // Reset after 2 seconds
        }, (err) => {
            console.error('Could not copy text: ', err);
        });
    };

    const resetEntireForm = () => {
        // Reset patient info
        setPatientName('');
        setSpecies('');
        setSex('');
        setBreed('');
        setColorMarkings('');
        setWeight('');
        setWeightUnit('lbs');
        setBirthdate('');
        setOwnerName('');
        setAddress('');
        setTelephone('');

        // Reset exam info
        setExamDate('');
        setStaff('');
        setPresentingComplaint('');
        setHistory('');
        setPhysicalExamFindings(`General Appearance: Bright, Alert
Temperature: 
Heart Rate:
Respiratory Rate:
Body Condition Score: 5/9 (Ideal=5/9)
Mucous Membranes: Pink, moist, CRT <2s
Eyes: No abnormal findings
Ears: No abnormal findings
Nose: No abnormal findings
Throat: No abnormal findings
Oral: Gd. 1 tartar
Heart: No abnormal findings
Lungs: Clear on auscultation, no abnormal sounds
Abdomen Palpation: No abnormal findings
Lymph Nodes: No enlargement 
Skin and Coat: No lesions, normal coat condition, no ectoparasites observed
Musculoskeletal: No abnormal findings
Neurologic: No abnormal findings
Urogenital: No abnormal findings`);
        setDiagnosticPlan('');
        setLabResults('');
        setAssessment('');
        setDiagnosis('');
        setDifferentialDiagnosis('');
        setTreatment('');
        setClientCommunications('');
        setPlanFollowUp('');

        // Reset other states
        setPatientInfoSubmitted(false);
        setReportText('');
        setPreviewVisible(false);
        setError('');
        setLoading(false);
        setNaturopathicMedicine('');
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
        localStorage.setItem('birthdate', birthdate);
        localStorage.setItem('ownerName', ownerName);
        localStorage.setItem('address', address);
        localStorage.setItem('telephone', telephone);

        // Exam info
        localStorage.setItem('examDate', examDate);
        localStorage.setItem('staff', staff);
        localStorage.setItem('presentingComplaint', presentingComplaint);
        localStorage.setItem('history', history);
        localStorage.setItem('physicalExamFindings', physicalExamFindings);
        localStorage.setItem('diagnosticPlan', diagnosticPlan);
        localStorage.setItem('labResults', labResults);
        localStorage.setItem('assessment', assessment);
        localStorage.setItem('diagnosis', diagnosis);
        localStorage.setItem('differentialDiagnosis', differentialDiagnosis);
        localStorage.setItem('treatment', treatment);
        localStorage.setItem('clientCommunications', clientCommunications);
        localStorage.setItem('planFollowUp', planFollowUp);
        localStorage.setItem('naturopathicMedicine', naturopathicMedicine);
    }, [species, sex, breed, colorMarkings, weight, weightUnit, birthdate,
        ownerName, address, telephone, examDate, staff, presentingComplaint,
        history, physicalExamFindings, diagnosticPlan, labResults, assessment,
        diagnosis, differentialDiagnosis, treatment, clientCommunications, planFollowUp, naturopathicMedicine]);

    // Add to useEffect for localStorage
    useEffect(() => {
        localStorage.setItem('enabledFields', JSON.stringify(enabledFields));
    }, [enabledFields]);

    const handleToggleField = (fieldName) => {
        setEnabledFields(prev => ({
            ...prev,
            [fieldName]: !prev[fieldName]
        }));
    };

    return (
        <div className="report-container">
            {!patientInfoSubmitted ? (
                <form className="report-form" onSubmit={handlePatientInfoSubmit}>
                    <h2>Patient Info</h2>

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

                    <label className="form-label">Birthdate:</label>
                    <input type="date" className="form-input" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />

                    <label className="form-label">Owner Name:</label>
                    <input type="text" className="form-input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />

                    <label className="form-label">Address:</label>
                    <input type="text" className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} />

                    <label className="form-label">Telephone:</label>
                    <input type="text" className="form-input" value={telephone} onChange={(e) => setTelephone(e.target.value)} />

                    <div className="button-container">
                        <button type="button" className="clear-button" onClick={clearPatientInfo}>
                            Clear Form
                        </button>
                        <button type="submit" className="continue-button">
                            Exam Info
                        </button>
                    </div>
                </form>
            ) : (
                <form className="report-form" onSubmit={handleExamSubmit}>
                    <h2>Exam Info</h2>

                    <div className="form-field-container">
                        <label className="form-label">Exam Date:</label>
                        <div className="input-toggle-wrapper">
                            <input
                                type="date"
                                className={`form-input ${!enabledFields.examDate ? 'disabled' : ''}`}
                                value={examDate}
                                onChange={(e) => setExamDate(e.target.value)}
                                disabled={!enabledFields.examDate}
                            />
                            <ToggleSwitch
                                fieldName="examDate"
                                enabled={enabledFields.examDate}
                                onChange={handleToggleField}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Staff:</label>
                        <div className="input-toggle-wrapper">
                            <input
                                type="text"
                                className={`form-input ${!enabledFields.staff ? 'disabled' : ''}`}
                                value={staff}
                                onChange={(e) => setStaff(e.target.value)}
                                disabled={!enabledFields.staff}
                            />
                            <ToggleSwitch
                                fieldName="staff"
                                enabled={enabledFields.staff}
                                onChange={handleToggleField}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Presenting Complaint:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                className={`form-input ${!enabledFields.presentingComplaint ? 'disabled' : ''}`}
                                value={presentingComplaint}
                                onChange={(e) => setPresentingComplaint(e.target.value)}
                                disabled={!enabledFields.presentingComplaint}
                            />
                            <ToggleSwitch
                                fieldName="presentingComplaint"
                                enabled={enabledFields.presentingComplaint}
                                onChange={handleToggleField}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">History:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                className={`form-input ${!enabledFields.history ? 'disabled' : ''}`}
                                value={history}
                                onChange={(e) => setHistory(e.target.value)}
                                disabled={!enabledFields.history}
                            />
                            <ToggleSwitch
                                fieldName="history"
                                enabled={enabledFields.history}
                                onChange={handleToggleField}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Physical Exam Findings:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                className={`form-input physical-exam-input ${!enabledFields.physicalExamFindings ? 'disabled' : ''}`}
                                value={physicalExamFindings}
                                onChange={(e) => setPhysicalExamFindings(e.target.value)}
                                disabled={!enabledFields.physicalExamFindings}
                            />
                            <ToggleSwitch
                                fieldName="physicalExamFindings"
                                enabled={enabledFields.physicalExamFindings}
                                onChange={handleToggleField}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Diagnostic Plan:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                className={`form-input ${!enabledFields.diagnosticPlan ? 'disabled' : ''}`}
                                value={diagnosticPlan}
                                onChange={(e) => setDiagnosticPlan(e.target.value)}
                                disabled={!enabledFields.diagnosticPlan}
                            />
                            <ToggleSwitch
                                fieldName="diagnosticPlan"
                                enabled={enabledFields.diagnosticPlan}
                                onChange={handleToggleField}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Lab Results:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                className={`form-input ${!enabledFields.labResults ? 'disabled' : ''}`}
                                value={labResults}
                                onChange={(e) => setLabResults(e.target.value)}
                                disabled={!enabledFields.labResults}
                            />
                            <ToggleSwitch
                                fieldName="labResults"
                                enabled={enabledFields.labResults}
                                onChange={handleToggleField}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Assessment:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                className={`form-input ${!enabledFields.assessment ? 'disabled' : ''}`}
                                value={assessment}
                                onChange={(e) => setAssessment(e.target.value)}
                                disabled={!enabledFields.assessment}
                            />
                            <ToggleSwitch
                                fieldName="assessment"
                                enabled={enabledFields.assessment}
                                onChange={handleToggleField}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Diagnosis:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                className={`form-input ${!enabledFields.diagnosis ? 'disabled' : ''}`}
                                value={diagnosis}
                                onChange={(e) => setDiagnosis(e.target.value)}
                                disabled={!enabledFields.diagnosis}
                            />
                            <ToggleSwitch
                                fieldName="diagnosis"
                                enabled={enabledFields.diagnosis}
                                onChange={handleToggleField}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Differential Diagnosis:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                className={`form-input ${!enabledFields.differentialDiagnosis ? 'disabled' : ''}`}
                                value={differentialDiagnosis}
                                onChange={(e) => setDifferentialDiagnosis(e.target.value)}
                                disabled={!enabledFields.differentialDiagnosis}
                            />
                            <ToggleSwitch
                                fieldName="differentialDiagnosis"
                                enabled={enabledFields.differentialDiagnosis}
                                onChange={handleToggleField}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Treatment:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                className={`form-input ${!enabledFields.treatment ? 'disabled' : ''}`}
                                value={treatment}
                                onChange={(e) => setTreatment(e.target.value)}
                                disabled={!enabledFields.treatment}
                            />
                            <ToggleSwitch
                                fieldName="treatment"
                                enabled={enabledFields.treatment}
                                onChange={handleToggleField}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Naturopathic Medicine:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                className={`form-input ${!enabledFields.naturopathicMedicine ? 'disabled' : ''}`}
                                value={naturopathicMedicine}
                                onChange={(e) => setNaturopathicMedicine(e.target.value)}
                                disabled={!enabledFields.naturopathicMedicine}
                            />
                            <ToggleSwitch
                                fieldName="naturopathicMedicine"
                                enabled={enabledFields.naturopathicMedicine}
                                onChange={handleToggleField}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Client Communications/Recommendations:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                className={`form-input ${!enabledFields.clientCommunications ? 'disabled' : ''}`}
                                value={clientCommunications}
                                onChange={(e) => setClientCommunications(e.target.value)}
                                disabled={!enabledFields.clientCommunications}
                            />
                            <ToggleSwitch
                                fieldName="clientCommunications"
                                enabled={enabledFields.clientCommunications}
                                onChange={handleToggleField}
                            />
                        </div>
                    </div>

                    <div className="form-field-container">
                        <label className="form-label">Plan/Follow-up:</label>
                        <div className="input-toggle-wrapper">
                            <textarea
                                className={`form-input ${!enabledFields.planFollowUp ? 'disabled' : ''}`}
                                value={planFollowUp}
                                onChange={(e) => setPlanFollowUp(e.target.value)}
                                disabled={!enabledFields.planFollowUp}
                            />
                            <ToggleSwitch
                                fieldName="planFollowUp"
                                enabled={enabledFields.planFollowUp}
                                onChange={handleToggleField}
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
                            disabled={loading}
                        >
                            {loading ? 'Generating...' : 'Generate Report'}
                        </button>
                        <button type="button" className="clear-button" onClick={resetEntireForm}>
                            Clear All
                        </button>
                    </div>

                    {error && <div className="error-message">{error}</div>}
                </form>
            )}

            <div className="report-preview">
                <div className="report-preview-header">
                    <h3>Report Preview</h3>
                    {previewVisible && (
                        <button className="close-button" onClick={() => setPreviewVisible(false)}>×</button>
                    )}
                </div>

                <div className="report-preview-content">
                    {loading ? (
                        <div className="loading-container">
                            <div className="loading-dots">
                                <div className="loading-dot"></div>
                                <div className="loading-dot"></div>
                                <div className="loading-dot"></div>
                            </div>
                            <p className="loading-text">Generating report...</p>
                        </div>
                    ) : previewVisible ? (
                        <textarea
                            className="report-text-editor"
                            value={reportText}
                            onChange={(e) => setReportText(e.target.value)}
                        />
                    ) : (
                        <div className="report-placeholder">
                            <h2>Report will appear here</h2>
                            <p>Fill out the form and click "Generate Report" to see the preview</p>
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
                            <div className="copy-button-container">
                                <PDFButton
                                    reportText={reportText}
                                    patientName={patientName}
                                />
                            </div>
                        )}
                    </div>

                    {error && <div className="error-message">{error}</div>}
                </div>
            </div>
        </div>
    );
};

export default ReportForm;
