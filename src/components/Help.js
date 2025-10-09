import React, { useEffect, useState } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import Footer from './Footer';
import { Link } from 'react-router-dom';

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
            title: 'PetNote',
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
            title: 'PetQuery',
            content: [
                {
                    question: 'What is PetQuery?',
                    answer: 'PetQuery is your AI medical assistant. Use it to:\n- Get drug dosage information\n- Check treatment protocols\n- Find diagnostic criteria\n- Access current medical guidelines'
                },
                {
                    question: 'How accurate is the information?',
                    answer: 'PetQuery uses current veterinary medical databases and literature. However, always verify critical information and use professional judgment for clinical decisions.'
                },
                {
                    question: 'Training Modules',
                    isTrainingSection: true,
                    trainingSections: [
                        {
                            id: 'training-1',
                            title: 'Example 1: Seizure Treatment Plan',
                            description: 'Learn how to generate a detailed 24-hour treatment plan for a dog with seizures, including medication schedules and monitoring parameters.',
                            image: 'QQ Training 1.png'
                        },
                        {
                            id: 'training-2',
                            title: 'Example 2: Anxiety Management Protocol',
                            description: 'See how to create comprehensive treatment plans and client handouts for dogs with generalized anxiety, including fluoxetine dosing and behavior modification strategies.',
                            image: 'QQ Training 2.png'
                        },
                        {
                            id: 'training-3',
                            title: 'Example 3: Fluid Therapy Calculation',
                            description: 'Master fluid therapy calculations for dehydrated patients, including how to determine replacement rates and monitoring schedules to achieve target PCV values.',
                            image: 'QQ Training 3.png'
                        }
                    ]
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
            id: 'templates',
            title: 'Templates',
            content: [
                {
                    question: 'What can I save as templates?',
                    answer: 'Templates help streamline your workflow. You can save:\n- Common drug protocols and dosages\n- Frequently used PetQuery responses\n- Treatment plans for common conditions\n- Client communication templates\n- Any other content you frequently reference or reuse'
                },
                {
                    question: 'How do I use templates?',
                    answer: 'Access your templates by:\n1. Click "My Templates" in the sidebar\n2. Click "Create New Template" in the top right to make a new one\n3. Select an existing template to view or edit it\n\nTo save a new template:\n1. Create your content\n2. Click "Save as Template"\n3. Name your template for easy reference'
                }
            ]
        },
        {
            id: 'sourced-material',
            title: 'Sourced Literature',
            content: [
                {
                    question: 'What sources does PetWise use?',
                    answer: 'PetWise sources a comprehensive collection of veterinary medical literature. This is a partial list and not exhaustive:\n\n**Veterinary Medical Literature:**\n- The Merck Veterinary Manual (Online Edition)\n- Plumb\'s Veterinary Drug Handbook\n- Blackwell\'s Five-Minute Veterinary Consult\n- Small Animal Clinical Diagnosis by Laboratory Methods\n- Large Animal Internal Medicine by Bradford P. Smith\n- Small Animal Surgery by Theresa Fossum\n- Journal of Veterinary Internal Medicine\n- Journal of Small Animal Practice\n- Journal of the American Animal Hospital Association\n- Equine Veterinary Journal\n- Veterinary Parasitology\n- Veterinary Pathology\n- Journal of Veterinary Pharmacology and Therapeutics\n- Journal of Feline Medicine and Surgery\n- Journal of Dairy Science\n- Veterinary Microbiology\n- Veterinary Immunology and Immunopathology\n- Journal of Exotic Pet Medicine\n- Veterinary Ophthalmology\n- Frontiers in Veterinary Science\n- BMC Veterinary Research\n- Veterinary Clinics of North America\n\n**University and Academic Resources:**\n- Cornell University College of Veterinary Medicine\n- University of California, Davis School of Veterinary Medicine\n- Royal Veterinary College, University of London\n- University of Pennsylvania School of Veterinary Medicine\n- University of Edinburgh Royal (Dick) School of Veterinary Studies\n- Colorado State University College of Veterinary Medicine and Biomedical Sciences\n- University of Wisconsin-Madison School of Veterinary Medicine\n- Utrecht University Faculty of Veterinary Medicine\n- University of Melbourne Faculty of Veterinary and Agricultural Sciences\n- University of Sydney Faculty of Veterinary Science\n\n**Government and Regulatory Agencies:**\n- CDC Zoonotic Diseases\n- World Organization for Animal Health (WOAH)\n- USDA APHIS\n\n**Open-Access Research and Journals:**\n- PLOS ONE Veterinary Science\n- PubMed Central\n- Scientific Reports\n\n**Animal Welfare Organizations:**\n- ASPCA\n- RSPCA\n- World Animal Protection\n\n**Professional Veterinary Organizations:**\n- American Veterinary Medical Association\n- Royal College of Veterinary Surgeons\n- Canadian Veterinary Medical Association\n\nAnd many more sources including veterinary guidelines, clinical pathology journals, breed-specific resources, and ongoing research publications.'
                },
                {
                    question: 'How current is the information?',
                    answer: 'Our system is regularly updated with new veterinary research and guidelines. However, always verify critical information and use your professional judgment for clinical decisions.'
                }
            ]
        }
    ]

    const formatContent = (item, index) => {
        if (item.isTrainingSection) {
            return (
                <div key={index} className="p-5 border-t border-gray-200">
                    <h3 className="text-primary-600 mb-3 text-lg font-semibold">{item.question}</h3>
                    <div className="flex flex-col gap-4 mt-4">
                        {item.trainingSections.map((training) => (
                            <div
                                key={training.id}
                                className="border border-gray-200 rounded-md overflow-hidden"
                            >
                                <h4
                                    onClick={() => toggleSection(training.id)}
                                    className="cursor-pointer p-4 m-0 bg-gray-50 flex justify-between items-center text-base font-medium text-gray-800 hover:bg-gray-100 transition-colors duration-200"
                                >
                                    {training.title}
                                    <span className={`text-xs transition-transform duration-300 ${expandedSections[training.id] ? 'rotate-180' : ''}`}>
                                        ▼
                                    </span>
                                </h4>
                                <div className={`overflow-hidden transition-all duration-300 ${expandedSections[training.id] ? 'max-h-screen opacity-100 p-4' : 'max-h-0 opacity-0 p-0'}`}>
                                    <p className="text-gray-600 mb-4 leading-relaxed">{training.description}</p>
                                    <img src={training.image} alt={training.title} className="w-full h-auto mt-4 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return (
            <div key={index} className="p-5 border-t border-gray-200">
                <h3 className="text-primary-600 mb-3 text-lg font-semibold">{item.question}</h3>
                <p className="text-gray-600 leading-relaxed m-0">{formatText(item.answer)}</p>
            </div>
        );
    };

    return (
        <>
            <div className="max-w-4xl mx-auto px-5 py-10 min-h-screen">
                <h1 className="text-3xl font-bold text-gray-800 mb-10 text-center">Help Center</h1>
                <div className="flex flex-col gap-5">
                    {helpSections.map(section => (
                        <section key={section.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                            <h2
                                onClick={() => toggleSection(section.id)}
                                className="cursor-pointer p-5 m-0 bg-gray-50 border-b border-gray-200 flex justify-between items-center text-lg font-semibold text-gray-800 hover:bg-gray-100 transition-colors duration-200"
                            >
                                {section.title}
                                <span className={`text-xs transition-transform duration-300 ${expandedSections[section.id] ? 'rotate-180' : ''}`}>
                                    ▼
                                </span>
                            </h2>
                            <div className={`overflow-hidden transition-all duration-300 ${expandedSections[section.id] ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
                                {section.content.map((item, index) => formatContent(item, index))}
                            </div>
                        </section>
                    ))}

                    <section className="bg-white rounded-lg shadow-md p-5 text-center">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Contact Support</h2>
                        <p className="text-gray-600 mb-2">Need additional help? Email us at <a href="mailto:support@petwise.vet" className="text-primary-600 hover:underline no-underline">support@petwise.vet</a></p>
                        <p className="text-gray-600">View our <Link to="/privacy" className="text-primary-600 hover:underline no-underline">Privacy Policy</Link> and <Link to="/terms" className="text-primary-600 hover:underline no-underline">Terms of Service</Link></p>
                    </section>
                </div>
            </div>
            {!isAuthenticated && <Footer />}
        </>
    );
};

export default Help; 