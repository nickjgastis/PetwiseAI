import React, { useEffect, useState } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import Footer from './Footer';
import { Link, useNavigate } from 'react-router-dom';
import { FaTimes, FaArrowRight, FaArrowLeft, FaMicrophone, FaMobile, FaSave, FaFileAlt } from 'react-icons/fa';

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
                
                {/* Tutorial Buttons */}
                <div className="mb-8 flex flex-wrap justify-center gap-4">
                    <button
                        onClick={() => setShowWhatsNew(true)}
                        className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900 rounded-lg font-bold shadow-md hover:from-yellow-500 hover:to-yellow-600 transition-all duration-200 hover:scale-105 flex items-center gap-2"
                    >
                        <span>See What's New!</span>
                    </button>
                    <button
                        onClick={() => openTutorial('QuickSOAP')}
                        className="px-6 py-3 bg-[#3369bd] text-white rounded-lg font-semibold shadow-md hover:bg-[#2c5aa3] transition-all duration-200 hover:scale-105 flex items-center gap-2"
                    >
                        <span>QuickSOAP Tutorial</span>
                    </button>
                    <button
                        onClick={() => openTutorial('PetSOAP')}
                        className="px-6 py-3 bg-[#3369bd] text-white rounded-lg font-semibold shadow-md hover:bg-[#2c5aa3] transition-all duration-200 hover:scale-105 flex items-center gap-2"
                    >
                        <span>PetSOAP Tutorial</span>
                    </button>
                    <button
                        onClick={() => openTutorial('PetQuery')}
                        className="px-6 py-3 bg-[#3369bd] text-white rounded-lg font-semibold shadow-md hover:bg-[#2c5aa3] transition-all duration-200 hover:scale-105 flex items-center gap-2"
                    >
                        <span>PetQuery Tutorial</span>
                    </button>
                </div>

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
                                        <h3 className="font-bold text-gray-800 mb-2 text-2xl">Welcome to the Latest PetWise Updates</h3>
                                        <p className="text-gray-600 text-lg">We're excited to share some amazing new features that will make your workflow even more efficient and powerful.</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border-2 border-primary-200 p-6">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg w-20 h-20">
                                                <FaMicrophone className="text-white text-3xl" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-gray-700 font-semibold mb-2 text-lg">QuickSOAP - Voice-Powered SOAP Reports</p>
                                                <p className="text-gray-600">Create professional SOAP reports instantly using voice dictation</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 p-6">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg w-20 h-20">
                                                <FaMobile className="text-white text-3xl" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-gray-700 font-semibold mb-2 text-lg">Mobile Experience</p>
                                                <p className="text-gray-600">Record dictations on the go and sync seamlessly with your desktop</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200 p-6">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg w-20 h-20">
                                                <FaSave className="text-white text-3xl" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-gray-700 font-semibold mb-2 text-lg">Organized Saved Records</p>
                                                <p className="text-gray-600">Your records are now organized by type for easier access</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {whatsNewStep === 1 && (
                                <div className="space-y-6">
                                    <h3 className="font-bold text-gray-800 mb-4 text-2xl">QuickSOAP - Voice-Powered SOAP Reports</h3>
                                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-4">
                                                <div className="rounded-full bg-primary-600 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <FaMicrophone className="text-white text-sm" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">Voice Dictation</p>
                                                    <p className="text-gray-600 text-sm">Simply speak your clinical notes and PetWise will automatically structure them into professional SOAP format</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4 mt-4">
                                                <div className="rounded-full bg-blue-500 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <span className="text-white font-bold">SOAP</span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">Automatic Structure</p>
                                                    <p className="text-gray-600 text-sm">Your dictation is intelligently organized into Subjective, Objective, Assessment, and Plan sections</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4 mt-4">
                                                <div className="rounded-full bg-green-500 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <span className="text-white font-bold">✓</span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">Edit and Refine</p>
                                                    <p className="text-gray-600 text-sm">Review and edit the generated report before saving or copying to your records</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-primary-50 rounded-lg p-4 border-l-4 border-primary-600">
                                        <p className="text-gray-700 text-sm"><strong>Tip:</strong> QuickSOAP works great for quick notes during rounds or after appointments. Just speak naturally and let PetWise handle the formatting.</p>
                                    </div>
                                </div>
                            )}

                            {whatsNewStep === 2 && (
                                <div className="space-y-6">
                                    <h3 className="font-bold text-gray-800 mb-4 text-2xl">Mobile Experience</h3>
                                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-4">
                                                <div className="rounded-full bg-green-600 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <FaMobile className="text-white text-sm" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">Record Anywhere</p>
                                                    <p className="text-gray-600 text-sm">Use your mobile device to record dictations while you're on the move, in the field, or between appointments</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4 mt-4">
                                                <div className="rounded-full bg-blue-500 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <span className="text-white font-bold text-xs">SYNC</span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">Seamless Sync</p>
                                                    <p className="text-gray-600 text-sm">Your mobile dictations automatically sync to your desktop, ready to generate reports when you return</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4 mt-4">
                                                <div className="rounded-full bg-purple-500 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <span className="text-white font-bold text-xs">FAST</span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">Quick Access</p>
                                                    <p className="text-gray-600 text-sm">Access your profile, manage subscriptions, and view saved records all from your mobile device</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-600">
                                        <p className="text-gray-700 text-sm"><strong>Perfect for:</strong> Farm calls, house visits, emergency situations, or any time you need to capture notes quickly without being at your desk.</p>
                                    </div>
                                </div>
                            )}

                            {whatsNewStep === 3 && (
                                <div className="space-y-6">
                                    <h3 className="font-bold text-gray-800 mb-4 text-2xl">Organized Saved Records</h3>
                                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-4">
                                                <div className="rounded-full bg-purple-600 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <FaMicrophone className="text-white text-sm" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">QuickSOAP Records</p>
                                                    <p className="text-gray-600 text-sm">All your voice-generated SOAP reports are now organized in their own dedicated section</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4 mt-4">
                                                <div className="rounded-full bg-blue-600 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <FaFileAlt className="text-white text-sm" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">PetSOAP Records</p>
                                                    <p className="text-gray-600 text-sm">Traditional form-based reports remain in their own section for easy access</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4 mt-4">
                                                <div className="rounded-full bg-green-500 flex items-center justify-center shadow-md flex-shrink-0 w-12 h-12">
                                                    <FaSave className="text-white text-sm" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 mb-1">Easy Navigation</p>
                                                    <p className="text-gray-600 text-sm">Switch between QuickSOAP and PetSOAP records with a simple tab selection</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-6">
                                        <p className="text-gray-600 text-sm mb-4 font-medium">Example record items:</p>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                                                <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white text-xs font-semibold px-3 py-1 rounded-lg uppercase tracking-wide flex-shrink-0">
                                                    quicksoap
                                                </div>
                                                <span className="font-medium text-base flex-1 min-w-0 truncate text-gray-800">
                                                    Patient Exam - Routine Checkup
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                                                <div className="bg-gradient-to-r from-purple-500 to-purple-700 text-white text-xs font-semibold px-3 py-1 rounded-lg uppercase tracking-wide flex-shrink-0">
                                                    petsoap
                                                </div>
                                                <span className="font-medium text-base flex-1 min-w-0 truncate text-gray-800">
                                                    Detailed Consultation Report
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-600">
                                        <p className="text-gray-700 text-sm"><strong>Benefit:</strong> This organization makes it easier to find the right record type quickly, whether you're looking for a quick voice note or a detailed form-based report.</p>
                                    </div>
                                </div>
                            )}

                            {whatsNewStep === 4 && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h3 className="font-bold text-gray-800 mb-4 text-2xl">Ready to Get Started?</h3>
                                        <p className="text-gray-600 text-lg mb-6">These new features are designed to make your workflow faster and more efficient. Try them out and see how they can transform your practice.</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border-2 border-primary-200 p-6">
                                        <h4 className="font-semibold text-gray-800 mb-3 text-lg">Next Steps</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3">
                                                <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">1</span>
                                                <p className="text-gray-700">Try QuickSOAP by clicking the microphone icon in the sidebar</p>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">2</span>
                                                <p className="text-gray-700">Access your mobile experience by visiting PetWise on your phone</p>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">3</span>
                                                <p className="text-gray-700">Explore your organized saved records in the Saved Records section</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-600">
                                        <p className="text-gray-700 text-sm"><strong>We're here to help:</strong> If you have any questions or feedback about these new features, don't hesitate to reach out to our support team.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tutorial Footer */}
                        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between flex-shrink-0 border-t border-gray-200">
                            <div className="flex items-center gap-2">
                                {[0, 1, 2, 3, 4].map((step) => (
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
                                {whatsNewStep < 4 ? (
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
        </>
    );
};

export default Help; 