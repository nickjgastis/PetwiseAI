import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import './ReportForm.css';
import GenerateReport from './GenerateReport';

const ReportForm = () => {
    const [patientInfoSubmitted, setPatientInfoSubmitted] = useState(false); // Track which form is shown

    const [patientName, setPatientName] = useState('');
    const [species, setSpecies] = useState('');
    const [sex, setSex] = useState('');
    const [breed, setBreed] = useState(''); // Added breed state
    const [colorMarkings, setColorMarkings] = useState('');
    const [weight, setWeight] = useState('');
    const [weightUnit, setWeightUnit] = useState('lbs');
    const [birthdate, setBirthdate] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [address, setAddress] = useState('');
    const [telephone, setTelephone] = useState('');

    const [examDate, setExamDate] = useState('');
    const [staff, setStaff] = useState('');
    const [presentingComplaint, setPresentingComplaint] = useState('');
    const [history, setHistory] = useState('');

    const [diagnosticPlan, setDiagnosticPlan] = useState('');
    const [labResults, setLabResults] = useState('');
    const [assessment, setAssessment] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [differentialDiagnosis, setDifferentialDiagnosis] = useState('');
    const [treatment, setTreatment] = useState('');
    const [clientCommunications, setClientCommunications] = useState('');
    const [planFollowUp, setPlanFollowUp] = useState('');

    const [loading, setLoading] = useState(false);
    const [reportText, setReportText] = useState('');
    const [previewVisible, setPreviewVisible] = useState(false);
    const [error, setError] = useState('');

    const defaultPhysicalExamFindings = `Temperature: Normal, 101.5°F
General Appearance: Bright, Alert, Responsive (BAR)
Body Condition Score: 5/9 (Ideal=5/9)
Mucous Membranes: Pink, moist
Capillary Refill Time: <2 seconds
Eyes, Ears, Nose, Throat (EENT): Within normal limits
Oral Cavity: No significant findings, teeth clean, mild tartar
Heart: No murmur, no arrhythmia auscultated
Lungs: Clear on auscultation, no abnormal sounds
Abdomen Palpation: Within normal limits, no pain or abnormalities detected
Lymph Nodes: Palpable and within normal limits
Integumentary (Skin and Coat): Clean, no lesions, masses, or abnormalities detected
Musculoskeletal: No lameness, full range of motion, no pain on palpation
Neurologic: Alert and responsive, normal reflexes
Urogenital: Within normal limits, no abnormalities noted`;

    const [physicalExamFindings, setPhysicalExamFindings] = useState(defaultPhysicalExamFindings);

    const speciesOptions = [
        'Canine', 'Feline', 'Avian', 'Reptile', 'Bovine', 'Equine', 'Ovine', 'Porcine'
    ];

    const sexOptions = [
        'Female Spayed', 'Female Intact', 'Male Neutered', 'Male Intact'
    ];

    const dogBreeds = [
        'Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'Bulldog', 'Poodle',
        'Beagle', 'Rottweiler', 'Yorkshire Terrier', 'Boxer', 'Dachshund', 'Shih Tzu',
        'Siberian Husky', 'Great Dane', 'Cocker Spaniel', 'Doberman Pinscher', 'Australian Shepherd',
        'Pembroke Welsh Corgi', 'Chihuahua', 'Border Collie', 'Maltese'
    ];

    const handlePatientInfoSubmit = (e) => {
        e.preventDefault();
        setPatientInfoSubmitted(true); // Show the next section
    };

    const handleBackToPatientInfo = () => {
        setPatientInfoSubmitted(false); // Go back to Patient Info form
    };

    const handleExamSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const inputs = {
                patientName, species, sex, breed, colorMarkings, weight, weightUnit, birthdate, ownerName, address, telephone,
                examDate, staff, presentingComplaint, history, physicalExamFindings, diagnosticPlan, labResults,
                assessment, diagnosis, differentialDiagnosis, treatment, clientCommunications, planFollowUp
            };
            console.log(inputs);

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
        doc.text(reportText, 10, 10);
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
                        {dogBreeds.map((breed, index) => (
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

                    <button type="button" className="back-button" onClick={handleBackToPatientInfo}>
                        Back to Patient Info
                    </button>

                    <button type="submit" className="submit-button" disabled={loading}>
                        {loading ? 'Generating...' : 'Generate Report'}
                    </button>

                    {error && <div className="error-message">{error}</div>}
                </form>
            )}

            <div className="report-preview">
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
