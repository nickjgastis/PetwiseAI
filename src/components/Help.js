import React, { useEffect, useState } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import Footer from './Footer';
import { Link, useNavigate } from 'react-router-dom';
import { FaTimes, FaArrowRight, FaArrowLeft, FaMicrophone, FaMobile, FaSave, FaFileAlt, FaClipboardList, FaPhoneAlt } from 'react-icons/fa';

const Help = () => {
    const { isAuthenticated } = useAuth0();
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
    }, []);

    const [expandedSections, setExpandedSections] = useState({});
    const [showWhatsNew, setShowWhatsNew] = useState(false);
    const [whatsNewStep, setWhatsNewStep] = useState(0);
    const [showQRModal, setShowQRModal] = useState(false);

    const openTutorial = (tutorialType) => {
        // Set localStorage flag to trigger tutorial
        localStorage.setItem(`open${tutorialType}Tutorial`, 'true');
        
        // Navigate to the appropriate page
        if (tutorialType === 'QuickSOAP') {
            navigate('/dashboard/quicksoap');
        } else if (tutorialType === 'PetSOAP') {
            navigate('/dashboard/report-form');
        } else if (tutorialType === 'PetQuery') {
            navigate('/dashboard/quick-query');
        }
    };

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
                <div key={index} className="p-6 border-t border-gray-100">
                    <h3 className="text-primary-700 mb-4 text-xl font-bold">{item.question}</h3>
                    <div className="flex flex-col gap-3 mt-4">
                        {item.trainingSections.map((training) => (
                            <div
                                key={training.id}
                                className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
                            >
                                <h4
                                    onClick={() => toggleSection(training.id)}
                                    className="cursor-pointer p-4 m-0 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center text-base font-semibold text-gray-800 hover:from-gray-100 hover:to-gray-50 transition-all duration-200"
                                >
                                    {training.title}
                                    <span className={`text-primary-600 text-sm transition-transform duration-300 ${expandedSections[training.id] ? 'rotate-180' : ''}`}>
                                        ▼
                                    </span>
                                </h4>
                                <div className={`overflow-hidden transition-all duration-300 ${expandedSections[training.id] ? 'max-h-[1000px] opacity-100 p-4' : 'max-h-0 opacity-0 p-0'}`}>
                                    <p className="text-gray-700 mb-4 leading-relaxed">{training.description}</p>
                                    <img src={training.image} alt={training.title} className="w-full h-auto mt-4 rounded-lg shadow-md" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return (
            <div key={index} className="p-6 border-t border-gray-100">
                <h3 className="text-primary-700 mb-3 text-xl font-bold">{item.question}</h3>
                <p className="text-gray-700 leading-relaxed m-0">{formatText(item.answer)}</p>
            </div>
        );
    };

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-5xl mx-auto px-5 py-12">
                    {/* Header */}
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent mb-3">Help Center</h1>
                        <p className="text-gray-600 text-lg">Everything you need to get the most out of Petwise</p>
                    </div>
                    
                    {/* Tutorial Buttons */}
                    <div className="mb-10 flex flex-wrap justify-center gap-3">
                        <button
                            onClick={() => setShowWhatsNew(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900 rounded-xl font-semibold shadow-lg hover:from-yellow-500 hover:to-yellow-600 transition-all duration-200 hover:scale-105 hover:shadow-xl flex items-center gap-2"
                        >
                            <span>See What's New!</span>
                        </button>
                        <button
                            onClick={() => openTutorial('QuickSOAP')}
                            className="px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold shadow-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 hover:scale-105 hover:shadow-xl flex items-center gap-2"
                        >
                            <FaMicrophone className="text-sm" />
                            <span>QuickSOAP Tutorial</span>
                        </button>
                        <button
                            onClick={() => openTutorial('PetQuery')}
                            className="px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold shadow-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 hover:scale-105 hover:shadow-xl flex items-center gap-2"
                        >
                            <span>PetQuery Tutorial</span>
                        </button>
                        <button
                            onClick={() => openTutorial('PetSOAP')}
                            className="px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold shadow-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 hover:scale-105 hover:shadow-xl flex items-center gap-2"
                        >
                            <FaFileAlt className="text-sm" />
                            <span>PetSOAP Tutorial</span>
                        </button>
                        <button
                            onClick={() => setShowQRModal(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold shadow-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 hover:scale-105 hover:shadow-xl flex items-center gap-2"
                        >
                            <FaMobile className="text-sm" />
                            <span>Mobile App</span>
                        </button>
                    </div>

                    <div className="flex flex-col gap-4">
                        {helpSections.map(section => (
                            <section key={section.id} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                                <h2
                                    onClick={() => toggleSection(section.id)}
                                    className="cursor-pointer p-6 m-0 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex justify-between items-center text-xl font-bold text-gray-800 hover:from-gray-100 hover:to-gray-50 transition-all duration-200"
                                >
                                    {section.title}
                                    <span className={`text-primary-600 transition-transform duration-300 ${expandedSections[section.id] ? 'rotate-180' : ''}`}>
                                        ▼
                                    </span>
                                </h2>
                                <div className={`overflow-hidden transition-all duration-500 ${expandedSections[section.id] ? (section.id === 'sourced-material' ? 'max-h-[3000px]' : 'max-h-[2000px]') + ' opacity-100' : 'max-h-0 opacity-0'}`}>
                                    {section.content.map((item, index) => formatContent(item, index))}
                                </div>
                            </section>
                        ))}

                        <section className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl shadow-xl p-8 text-center">
                            <h2 className="text-2xl font-bold text-white mb-3">Contact Support</h2>
                            <p className="text-white/90 mb-2">Need additional help? Email us at <a href="mailto:support@petwise.vet" className="text-white font-semibold hover:underline no-underline">support@petwise.vet</a></p>
                            <p className="text-white/80 text-sm">View our <Link to="/privacy" className="text-white hover:underline no-underline font-medium">Privacy Policy</Link> and <Link to="/terms" className="text-white hover:underline no-underline font-medium">Terms of Service</Link></p>
                        </section>
                    </div>
                </div>
            </div>
            {!isAuthenticated && <Footer />}

            {/* What's New Tutorial Modal */}
            {showWhatsNew && (
                <div
                    className="fixed bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fadeIn"
                    onClick={() => setShowWhatsNew(false)}
                    style={{
                        left: '0',
                        right: '0',
                        top: '0',
                        bottom: '0',
                        animation: 'fadeIn 0.3s ease-out'
                    }}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            animation: 'slideUpScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
                    >
                        {/* Tutorial Header */}
                        <div className="bg-gradient-to-r from-primary-600 to-primary-700 flex items-center justify-between flex-shrink-0 px-6 py-4">
                            <h2 className="font-bold text-white text-2xl">What's New in PetWise</h2>
                            <button
                                onClick={() => setShowWhatsNew(false)}
                                className="text-white hover:text-gray-200 transition-colors flex-shrink-0"
                            >
                                <FaTimes className="text-xl" />
                            </button>
                        </div>

                        {/* Tutorial Content */}
                        <div className="flex-1 overflow-y-auto p-8">
                            {whatsNewStep === 0 && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h3 className="font-bold text-gray-800 mb-2 text-2xl">New Record Types in QuickSOAP</h3>
                                        <p className="text-gray-600 text-lg">QuickSOAP now supports three different record types to match your workflow needs.</p>
                                    </div>
                                    {/* Record Type Selector Visual */}
                                    <div className="flex justify-center">
                                        <div className="bg-gray-100 rounded-xl p-1 inline-flex gap-1">
                                            <div className="px-3 py-2 text-sm font-medium rounded-lg bg-white text-primary-600 shadow-sm flex items-center gap-1.5">
                                                <FaClipboardList className="text-xs" />
                                                SOAP
                                            </div>
                                            <div className="px-3 py-2 text-sm font-medium rounded-lg text-gray-600 flex items-center gap-1.5">
                                                <FaFileAlt className="text-xs" />
                                                Summary
                                            </div>
                                            <div className="px-3 py-2 text-sm font-medium rounded-lg text-gray-600 flex items-center gap-1.5">
                                                <FaPhoneAlt className="text-xs" />
                                                Callback
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-blue-50 to-primary-50 rounded-xl border-2 border-blue-200 p-6">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg w-16 h-16">
                                                <FaClipboardList className="text-white text-2xl" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-gray-700 font-semibold mb-2 text-lg">SOAP Record</p>
                                                <p className="text-gray-600">Classic SOAP format with Subjective, Objective, Assessment, and Plan sections</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border-2 border-emerald-200 p-5">
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <div className="rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg w-14 h-14">
                                                    <FaFileAlt className="text-white text-xl" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-gray-700 font-semibold mb-1">Summary</p>
                                                    <p className="text-gray-600 text-sm">Clinical summaries with professional medical terminology</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border-2 border-amber-200 p-5">
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <div className="rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg w-14 h-14">
                                                    <FaPhoneAlt className="text-white text-xl" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-gray-700 font-semibold mb-1">Callback</p>
                                                    <p className="text-gray-600 text-sm">Document phone conversations with clients</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {whatsNewStep === 1 && (
                                <div className="space-y-6">
                                    <h3 className="font-bold text-gray-800 mb-4 text-2xl">SOAP Records</h3>
                                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-4">
                                                <div className="rounded-full bg-blue-500 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <FaClipboardList className="text-white text-sm" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">Structured SOAP Format</p>
                                                    <p className="text-gray-600 text-sm">Your dictation is automatically organized into Subjective, Objective, Assessment, and Plan sections</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4 mt-4">
                                                <div className="rounded-full bg-primary-600 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <FaMicrophone className="text-white text-sm" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">Voice Dictation</p>
                                                    <p className="text-gray-600 text-sm">Simply speak naturally - PetWise will structure your notes into professional SOAP format</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Visual of SOAP sections */}
                                    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                                        <div className="flex border-b border-gray-200">
                                            <div className="flex-1 border-r border-gray-200">
                                                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2">
                                                    <span className="text-white font-semibold text-sm">S – Subjective</span>
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <div className="bg-gradient-to-r from-green-500 to-green-600 px-4 py-2">
                                                    <span className="text-white font-semibold text-sm">O – Objective</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex">
                                            <div className="flex-1 border-r border-gray-200">
                                                <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2">
                                                    <span className="text-white font-semibold text-sm">A – Assessment</span>
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <div className="bg-gradient-to-r from-red-500 to-red-600 px-4 py-2">
                                                    <span className="text-white font-semibold text-sm">P – Plan</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-600">
                                        <p className="text-gray-700 text-sm"><strong>Best for:</strong> Complete patient encounters, examinations, and detailed medical documentation.</p>
                                    </div>
                                </div>
                            )}

                            {whatsNewStep === 2 && (
                                <div className="space-y-6">
                                    <h3 className="font-bold text-gray-800 mb-4 text-2xl">Clinical Summaries</h3>
                                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-4">
                                                <div className="rounded-full bg-emerald-600 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <FaFileAlt className="text-white text-sm" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">Professional Medical Language</p>
                                                    <p className="text-gray-600 text-sm">Summaries use formal veterinary terminology and proper medical phrasing</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4 mt-4">
                                                <div className="rounded-full bg-green-500 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <span className="text-white font-bold text-xs">Rx</span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">Treatment Documentation</p>
                                                    <p className="text-gray-600 text-sm">Medications, vaccines, and treatments are automatically formatted and listed</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Visual of Summary output */}
                                    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                                        <div className="bg-emerald-600 px-4 py-3">
                                            <h4 className="text-white font-semibold flex items-center gap-2">
                                                <FaFileAlt className="text-sm" /> Clinical Summary
                                            </h4>
                                        </div>
                                        <div className="p-4 bg-gray-50">
                                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                <p className="text-gray-700 text-sm italic">Your clinical summary will appear as a single editable text area...</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-emerald-50 rounded-lg p-4 border-l-4 border-emerald-600">
                                        <p className="text-gray-700 text-sm"><strong>Best for:</strong> Patient histories, case summaries, referral notes, and general medical documentation.</p>
                                    </div>
                                </div>
                            )}

                            {whatsNewStep === 3 && (
                                <div className="space-y-6">
                                    <h3 className="font-bold text-gray-800 mb-4 text-2xl">Callback Notes</h3>
                                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-4">
                                                <div className="rounded-full bg-amber-600 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <FaPhoneAlt className="text-white text-sm" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">Client Communication</p>
                                                    <p className="text-gray-600 text-sm">Document phone conversations with pet owners, including questions asked and advice given</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4 mt-4">
                                                <div className="rounded-full bg-yellow-500 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <span className="text-white font-bold text-xs">📞</span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">Structured Call Notes</p>
                                                    <p className="text-gray-600 text-sm">Automatically formats call type, discussion summary, concerns, and next steps</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Visual of Callback output */}
                                    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                                        <div className="bg-amber-600 px-4 py-3">
                                            <h4 className="text-white font-semibold flex items-center gap-2">
                                                <FaPhoneAlt className="text-sm" /> Callback Notes
                                            </h4>
                                        </div>
                                        <div className="p-4 bg-gray-50">
                                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                <p className="text-gray-700 text-sm italic">Your callback notes will appear as a single editable text area...</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-amber-50 rounded-lg p-4 border-l-4 border-amber-600">
                                        <p className="text-gray-700 text-sm"><strong>Best for:</strong> Follow-up calls, medication questions, appointment scheduling, and client concerns.</p>
                                    </div>
                                </div>
                            )}

                            {whatsNewStep === 4 && (
                                <div className="space-y-6">
                                    <h3 className="font-bold text-gray-800 mb-4 text-2xl">Organized Saved Records</h3>
                                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                                        <p className="text-gray-600 mb-4">All record types are now filterable in Saved Records for easy access:</p>
                                        {/* Filter visual */}
                                        <div className="flex justify-center mb-4">
                                            <div className="bg-gray-100 rounded-xl p-1 inline-flex gap-1">
                                                <div className="px-2 py-1.5 text-xs font-medium rounded-lg bg-white text-primary-600 shadow-sm">All</div>
                                                <div className="px-2 py-1.5 text-xs font-medium rounded-lg text-gray-600">QuickSOAP</div>
                                                <div className="px-2 py-1.5 text-xs font-medium rounded-lg text-gray-600">PetSOAP</div>
                                                <div className="px-2 py-1.5 text-xs font-medium rounded-lg text-gray-600">Summary</div>
                                                <div className="px-2 py-1.5 text-xs font-medium rounded-lg text-gray-600">Callback</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4">
                                        <p className="text-gray-600 text-sm mb-4 font-medium">Example record items:</p>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white text-xs font-semibold px-2 py-1 rounded-lg uppercase tracking-wide flex-shrink-0">
                                                    quicksoap
                                                </div>
                                                <span className="font-medium text-sm flex-1 min-w-0 truncate text-gray-800">
                                                    Max - SOAP Record
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-semibold px-2 py-1 rounded-lg uppercase tracking-wide flex-shrink-0">
                                                    summary
                                                </div>
                                                <span className="font-medium text-sm flex-1 min-w-0 truncate text-gray-800">
                                                    Bella - Clinical Summary
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold px-2 py-1 rounded-lg uppercase tracking-wide flex-shrink-0">
                                                    callback
                                                </div>
                                                <span className="font-medium text-sm flex-1 min-w-0 truncate text-gray-800">
                                                    Rocky - Callback Notes
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-600">
                                        <p className="text-gray-700 text-sm"><strong>Tip:</strong> Click on any Summary or Callback record to open it in QuickSOAP for editing.</p>
                                    </div>
                                </div>
                            )}

                            {whatsNewStep === 5 && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h3 className="font-bold text-gray-800 mb-4 text-2xl">Ready to Get Started?</h3>
                                        <p className="text-gray-600 text-lg mb-6">Choose the right record type for your needs and let PetWise handle the formatting.</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border-2 border-primary-200 p-6">
                                        <h4 className="font-semibold text-gray-800 mb-3 text-lg">How to Use</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3">
                                                <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">1</span>
                                                <p className="text-gray-700">Go to QuickSOAP from the sidebar</p>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">2</span>
                                                <p className="text-gray-700">Select your record type: SOAP, Summary, or Callback</p>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">3</span>
                                                <p className="text-gray-700">Record your dictation and click Generate</p>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">4</span>
                                                <p className="text-gray-700">Edit and save - your record will be in Saved Records</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-600">
                                        <p className="text-gray-700 text-sm"><strong>Works on mobile too!</strong> Select your record type on mobile and send to desktop for generation.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tutorial Footer */}
                        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between flex-shrink-0 border-t border-gray-200">
                            <div className="flex items-center gap-2">
                                {[0, 1, 2, 3, 4, 5].map((step) => (
                                    <div
                                        key={step}
                                        className={`w-2 h-2 rounded-full transition-all ${whatsNewStep === step ? 'bg-primary-600 w-8' : 'bg-gray-300'}`}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-3">
                                {whatsNewStep > 0 && (
                                    <button
                                        onClick={() => setWhatsNewStep(whatsNewStep - 1)}
                                        className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all flex items-center gap-2"
                                    >
                                        <FaArrowLeft className="text-sm" />
                                        Previous
                                    </button>
                                )}
                                {whatsNewStep < 5 ? (
                                    <button
                                        onClick={() => setWhatsNewStep(whatsNewStep + 1)}
                                        className="px-4 py-2 rounded-lg bg-[#3369bd] text-white hover:bg-[#2c5aa3] transition-all flex items-center gap-2"
                                    >
                                        Next
                                        <FaArrowRight className="text-sm" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setShowWhatsNew(false)}
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

            {/* QR Code Modal */}
            {showQRModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
                    onClick={() => setShowQRModal(false)}
                >
                    <div
                        className="bg-gradient-to-b from-primary-600 to-primary-700 rounded-2xl shadow-2xl p-8 max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white">Mobile App</h2>
                            <button
                                onClick={() => setShowQRModal(false)}
                                className="text-white hover:text-gray-200 transition-colors"
                            >
                                <FaTimes className="text-xl" />
                            </button>
                        </div>
                        <div className="text-center">
                            <p className="text-white mb-6">Scan this QR code or go to <span className="font-semibold text-accent-300">petwise.vet</span> on your phone and click log in</p>
                            <div className="flex justify-center mb-4">
                                <img src="/PW QR CODE.png" alt="QuickSOAP Mobile App QR Code" className="w-64 h-64 border-4 border-white rounded-lg shadow-lg" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Help; 