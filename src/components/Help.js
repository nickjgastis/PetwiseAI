import React, { useEffect, useState } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import Footer from './Footer';
import '../styles/Help.css';

const Help = () => {
    const { isAuthenticated } = useAuth0();

    useEffect(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
    }, []);

    const [expandedSections, setExpandedSections] = useState({});

    const toggleSection = (sectionId) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }));
    };

    const helpSections = [
        {
            id: 'getting-started',
            title: 'Getting Started',
            content: [
                {
                    question: 'How do I create my first report?',
                    answer: 'To create your first report:\n1. Navigate to "Report Genereator" on the dashboard\n2. Select the species and enter patient details\n3. Fill in the clinical findings\n4. Click "Generate Report"\n5. Review and edit the generated report as needed\n6. Save or download your report'
                },
                {
                    question: 'What information should I include?',
                    answer: 'Focus on clinical findings, symptoms, and observations. Key details to include:\n- Species and breed\n- Age and weight\n- Symptoms and duration\n- Physical examination findings\n- Any test results or diagnostics'
                }
            ]
        },
        {
            id: 'report-generator',
            title: 'Report Generator',
            content: [
                {
                    question: 'How does the AI generate reports?',
                    answer: 'Our AI analyzes your input data and generates comprehensive reports based on veterinary best practices. It structures information into clear sections including history, examination findings, assessment, and treatment plans.'
                },
                {
                    question: 'Can I edit generated reports?',
                    answer: 'Yes! After generation, you can:\n- Edit any section of the report\n- Add or remove information\n- Customize the format\n- Save multiple versions'
                }
            ]
        },
        {
            id: 'quickmed-query',
            title: 'QuickMed Query',
            content: [
                {
                    question: 'What is QuickMed Query?',
                    answer: 'QuickMed Query is your AI medical assistant. Use it to:\n- Get drug dosage information\n- Check treatment protocols\n- Find diagnostic criteria\n- Access current medical guidelines'
                },
                {
                    question: 'How accurate is the information?',
                    answer: 'QuickMed Query uses current veterinary medical databases and literature. However, always verify critical information and use professional judgment for clinical decisions.'
                }
            ]
        },
        {
            id: 'saved-reports',
            title: 'Managing Reports',
            content: [
                {
                    question: 'How do I access saved reports?',
                    answer: 'Access your saved reports by:\n1. Going to the Dashboard\n2. Clicking "Saved Reports"\n3. Viewing your list of reports'
                },
                {
                    question: 'What can I do with my reports?',
                    answer: 'You can:\n- View any saved report\n- Print reports\n- Make copies of reports\n- Download as PDF'
                }
            ]
        }
    ];

    return (
        <>
            <div className="help-container">
                <h1>Help Center</h1>
                <div className="help-sections">
                    {helpSections.map(section => (
                        <section key={section.id} className="help-section">
                            <h2
                                onClick={() => toggleSection(section.id)}
                                className="section-header"
                            >
                                {section.title}
                                <span className={`arrow ${expandedSections[section.id] ? 'expanded' : ''}`}>
                                    ▼
                                </span>
                            </h2>
                            <div className={`section-content ${expandedSections[section.id] ? 'expanded' : ''}`}>
                                {section.content.map((item, index) => (
                                    <div key={index} className="help-item">
                                        <h3>{item.question}</h3>
                                        <p>{item.answer.split('\n').map((line, i) => (
                                            <React.Fragment key={i}>
                                                {line}
                                                <br />
                                            </React.Fragment>
                                        ))}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}

                    <section className="help-section">
                        <h2>Contact Support</h2>
                        <p>Need additional help? Email us at <a href="mailto:support@petwise.vet">support@petwise.vet</a></p>
                    </section>
                </div>
            </div>
            {!isAuthenticated && <Footer />}
        </>
    );
};

export default Help; 