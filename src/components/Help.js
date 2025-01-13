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

    const formatText = (text) => {
        return text.split('\n').map((line, i) => {
            const formattedLine = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            return (
                <React.Fragment key={i}>
                    <span dangerouslySetInnerHTML={{ __html: formattedLine }} />
                    <br />
                </React.Fragment>
            );
        });
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
            title: 'Record Generator',
            content: [
                {
                    question: 'How does the AI generate records?',
                    answer: 'Our AI analyzes your input data and generates comprehensive records based on veterinary best practices. It structures information into clear sections including history, examination findings, assessment, and treatment plans.'
                },
                {
                    question: 'Can I edit generated records?',
                    answer: 'Yes! After generation, you can:\n- Edit any section of the record\n- Add or remove information\n- Customize the format\n- Save multiple versions'
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
            title: 'Managing Records',
            content: [
                {
                    question: 'How do I access saved records?',
                    answer: 'Access your saved records by:\n1. Going to the Dashboard\n2. Clicking "Saved Records"\n3. Viewing your list of records'
                },
                {
                    question: 'What can I do with my records?',
                    answer: 'You can:\n- Search through your records\n- View any saved record\n- Print records\n- Make copies of records\n- Download as PDF'
                }
            ]
        },
        {
            id: 'sourced-material',
            title: 'Sourced Literature',
            content: [
                {
                    question: 'What sources does PetWise use?',
                    answer: 'PetWise is trained on a comprehensive collection of veterinary medical knowledge that goes far beyond this example list. Here are some examples of the types of sources used:\n\n**Veterinary Medical Literature:**\n- The Merck Veterinary Manual (Online Edition)\n- Frontiers in Veterinary Science\n- BMC Veterinary Research\n- Veterinary Clinics of North America\n\n**University and Academic Resources:**\n- Cornell University College of Veterinary Medicine\n- Colorado State University Veterinary Teaching Hospital\n- University of Pennsylvania School of Veterinary Medicine\n- MIT OpenCourseWare\n\n**Government and Regulatory Agencies:**\n- CDC Zoonotic Diseases\n- World Organization for Animal Health (WOAH)\n- USDA APHIS\n\n**Open-Access Research and Journals:**\n- PLOS ONE Veterinary Science\n- PubMed Central\n- Scientific Reports\n\n**Animal Welfare Organizations:**\n- ASPCA\n- RSPCA\n- World Animal Protection\n\n**Professional Veterinary Organizations:**\n- American Veterinary Medical Association\n- Royal College of Veterinary Surgeons\n- Canadian Veterinary Medical Association\n\nAnd many more sources including veterinary guidelines, clinical pathology journals, breed-specific resources, and ongoing research publications.'
                },
                {
                    question: 'How current is the information?',
                    answer: 'Our system is regularly updated with new veterinary research and guidelines. However, always verify critical information and use your professional judgment for clinical decisions.'
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
                                        <p>{formatText(item.answer)}</p>
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