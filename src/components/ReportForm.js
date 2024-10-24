import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import '../styles/ReportForm.css';
import GenerateReport from './GenerateReport';

const ReportForm = () => {
    const [patientInfoSubmitted, setPatientInfoSubmitted] = useState(false);

    // Patient Info State
    const [patientName, setPatientName] = useState('');
    const [species, setSpecies] = useState('');
    const [sex, setSex] = useState('');
    const [breed, setBreed] = useState('');
    const [colorMarkings, setColorMarkings] = useState('');
    const [weight, setWeight] = useState('');
    const [weightUnit, setWeightUnit] = useState('lbs');
    const [birthdate, setBirthdate] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [address, setAddress] = useState('');
    const [telephone, setTelephone] = useState('');

    // Exam Info State
    const [examDate, setExamDate] = useState('');
    const [staff, setStaff] = useState('');
    const [presentingComplaint, setPresentingComplaint] = useState('');
    const [history, setHistory] = useState('');
    const [physicalExamFindings, setPhysicalExamFindings] = useState(`General Appearance: Bright, Alert, Responsive
T: °F, Normal
P:
R:
Body Condition Score: 5/9 (Ideal=5/9)
Mucous Membranes: Pink, moist
Capillary Refill Time: <2 seconds
Eyes, Ears, Nose, Throat (EENT): Within normal limits
Oral Cavity: Gd. 1 tartar
Heart: No murmur, no arrhythmia auscultated
Lungs: Clear on auscultation, no abnormal sounds
Abdomen Palpation: Within normal limits, no pain or abnormalities detected
Lymph Nodes: Palpable and within normal limits
Integumentary (Skin and Coat): Normal, no lesions, masses, or abnormalities detected
Musculoskeletal: No lameness, no pain on palpation
Neurologic: Alert and responsive, normal reflexes
Urogenital: Within normal limits, no abnormalities noted`);
    const [diagnosticPlan, setDiagnosticPlan] = useState('');
    const [labResults, setLabResults] = useState('');
    const [assessment, setAssessment] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [differentialDiagnosis, setDifferentialDiagnosis] = useState('');
    const [treatment, setTreatment] = useState('');
    const [clientCommunications, setClientCommunications] = useState('');
    const [planFollowUp, setPlanFollowUp] = useState('');

    // Loading and error states
    const [loading, setLoading] = useState(false);
    const [reportText, setReportText] = useState('');
    const [previewVisible, setPreviewVisible] = useState(false);
    const [error, setError] = useState('');

    // Species and breed options
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
        setLoading(true);

        try {
            const inputs = {
                patientName, species, sex, breed, colorMarkings, weight, weightUnit, birthdate, ownerName, address, telephone,
                examDate, staff, presentingComplaint, history, physicalExamFindings, diagnosticPlan, labResults,
                assessment, diagnosis, differentialDiagnosis, treatment, clientCommunications, planFollowUp
            };

            const generatedReport = await GenerateReport(inputs);
            setReportText(generatedReport);
            setPreviewVisible(true);
        } catch (error) {
            setError(error.message || 'An error occurred while generating the report.');
        } finally {
            setLoading(false);
        }
    };

    const generatePDF = () => {
        const doc = new jsPDF();

        // Text content for the report
        const lines = doc.splitTextToSize(reportText, 180); // Wrap text to fit within 180 units width

        // Set initial cursor position
        let yPosition = 10; // Top margin
        const pageHeight = doc.internal.pageSize.height; // Get the page height

        // Loop through lines and add them to the PDF
        lines.forEach((line, index) => {
            if (yPosition + 10 > pageHeight) { // Check if space is left on the page
                doc.addPage(); // Add a new page if the current page is full
                yPosition = 10; // Reset yPosition for the new page
            }
            doc.text(line, 10, yPosition); // Add the text line by line
            yPosition += 10; // Move yPosition down by 10 units (adjust if needed)
        });

        // Save the PDF
        doc.save('Veterinary_Report.pdf');
    };
    return (
        <div className="report-container">
            {!patientInfoSubmitted ? (
                <form className="report-form" onSubmit={handlePatientInfoSubmit}>
                    <h2>Patient Info</h2>

                    <label className="form-label">Patient Name:</label>
                    <input type="text" className="form-input" value={patientName} onChange={(e) => setPatientName(e.target.value)} />

                    <label className="form-label">Species:</label>
                    <select className="form-input" value={species} onChange={(e) => setSpecies(e.target.value)}>
                        <option value="">Select Species</option>
                        {speciesOptions.map((species, index) => (
                            <option key={index} value={species}>{species}</option>
                        ))}
                    </select>

                    <label className="form-label">Sex:</label>
                    <select className="form-input" value={sex} onChange={(e) => setSex(e.target.value)}>
                        <option value="">Select Sex</option>
                        {sexOptions.map((sex, index) => (
                            <option key={index} value={sex}>{sex}</option>
                        ))}
                    </select>

                    <label className="form-label">Breed:</label>
                    <select className="form-input" value={breed} onChange={(e) => setBreed(e.target.value)}>
                        <option value="">Select Breed</option>
                        {breedOptions.map((breed, index) => (
                            <option key={index} value={breed}>{breed}</option>
                        ))}
                    </select>

                    <label className="form-label">Color/Markings:</label>
                    <input type="text" className="form-input" value={colorMarkings} onChange={(e) => setColorMarkings(e.target.value)} />

                    <label className="form-label">Weight:</label>
                    <div className="weight-input">
                        <input type="number" className="form-input" value={weight} onChange={(e) => setWeight(e.target.value)} />
                        <select className="form-select" value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)}>
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

                    <button type="submit" className="submit-button">
                        Continue to Exam Info
                    </button>
                </form>
            ) : (
                <form className="report-form" onSubmit={handleExamSubmit}>
                    <h2>Exam Info</h2>

                    <label className="form-label">Exam Date:</label>
                    <input type="date" className="form-input" value={examDate} onChange={(e) => setExamDate(e.target.value)} />

                    <label className="form-label">Staff:</label>
                    <input type="text" className="form-input" value={staff} onChange={(e) => setStaff(e.target.value)} />

                    <label className="form-label">Presenting Complaint:</label>
                    <textarea className="form-input" value={presentingComplaint} onChange={(e) => setPresentingComplaint(e.target.value)} />

                    <label className="form-label">History:</label>
                    <textarea className="form-input" value={history} onChange={(e) => setHistory(e.target.value)} />

                    <label className="form-label">Physical Exam Findings:</label>
                    <textarea
                        className="form-input physical-exam-input"
                        value={physicalExamFindings}
                        onChange={(e) => setPhysicalExamFindings(e.target.value)}
                        style={{ whiteSpace: 'pre-wrap' }}
                    />

                    <label className="form-label">Diagnostic Plan:</label>
                    <textarea className="form-input" value={diagnosticPlan} onChange={(e) => setDiagnosticPlan(e.target.value)} />

                    <label className="form-label">Lab Results:</label>
                    <textarea className="form-input" value={labResults} onChange={(e) => setLabResults(e.target.value)} />

                    <label className="form-label">Assessment:</label>
                    <textarea className="form-input" value={assessment} onChange={(e) => setAssessment(e.target.value)} />

                    <label className="form-label">Diagnosis:</label>
                    <textarea className="form-input" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />

                    <label className="form-label">Differential Diagnosis:</label>
                    <textarea className="form-input" value={differentialDiagnosis} onChange={(e) => setDifferentialDiagnosis(e.target.value)} />

                    <label className="form-label">Treatment:</label>
                    <textarea className="form-input" value={treatment} onChange={(e) => setTreatment(e.target.value)} />

                    <label className="form-label">Client Communications/Recommendations:</label>
                    <textarea className="form-input" value={clientCommunications} onChange={(e) => setClientCommunications(e.target.value)} />

                    <label className="form-label">Plan/Follow-up:</label>
                    <textarea className="form-input" value={planFollowUp} onChange={(e) => setPlanFollowUp(e.target.value)} />

                    <button type="button" className="back-button-patient" onClick={handleBackToPatientInfo}>
                        Back to Patient Info
                    </button>

                    <button type="submit" className="submit-button" disabled={loading}>
                        {loading ? 'Generating...' : 'Generate Report'}
                    </button>

                    {error && <div className="error-message">{error}</div>}
                </form>
            )}

            <div className="report-preview">
                <h2>Report will appear here.</h2>
                {loading ? (
                    <div className="three-body">
                        <div className="three-body__dot"></div>
                        <div className="three-body__dot"></div>
                        <div className="three-body__dot"></div>
                    </div>
                ) : (
                    previewVisible && (
                        <>
                            <h3>Report Preview</h3>
                            <textarea
                                className="report-text-editor"
                                value={reportText}
                                onChange={(e) => setReportText(e.target.value)}
                            />
                            <div className="button-container">
                                <button className="submit-button" onClick={generatePDF}>Download PDF</button>
                                <button className="remove-button" onClick={() => setPreviewVisible(false)}>Close Preview</button>
                            </div>
                        </>
                    )
                )}
            </div>
        </div>
    );
};

export default ReportForm;
