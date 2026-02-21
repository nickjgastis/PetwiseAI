import React, { useState, useEffect } from 'react';
import OnboardingLayout from './OnboardingLayout';

const DICTATION_TEXT = "So today we have a 7 year old male neutered golden retriever presenting for intermittent vomiting over the past three days. Owner reports decreased appetite and some lethargy. No recent dietary changes, no access to toxins. On physical exam temp is 101.8, heart rate 120, respiratory rate 24. Body condition score 5 out of 9. Mild cranial abdominal pain on palpation. Mucous membranes pink and moist, CRT less than 2 seconds. I'm thinking acute gastroenteritis, likely dietary indiscretion versus early GI foreign body. Differentials include pancreatitis and hepatopathy. Plan is CBC chem panel, abdominal rads, maropitant 1 mg per kg sub-q SID for 3 days, bland diet, recheck 48 hours.";

const SOAP_SECTIONS = [
    { 
        name: 'Subjective', letter: 'S',
        header: 'bg-gradient-to-r from-blue-500 to-blue-700', 
        border: '#3b82f6', bg: 'bg-blue-50',
        text: '7 y/o MN Golden Retriever presenting for intermittent vomiting x 3 days. Owner reports decreased appetite and progressive lethargy. No recent dietary changes or table scraps. No known access to toxins, garbage, or foreign material. Up to date on vaccines and heartworm prevention. No prior GI history. Last meal was small amount of kibble yesterday AM, vomited bile this morning.'
    },
    { 
        name: 'Objective', letter: 'O',
        header: 'bg-gradient-to-r from-green-500 to-green-700', 
        border: '#10b981', bg: 'bg-green-50',
        text: 'T: 101.8°F, HR: 120 bpm, RR: 24 brpm. Wt: 32.4 kg, BCS 5/9. BAR, ambulatory. Mild cranial abdominal pain on palpation, no palpable masses or organomegaly. Mucous membranes pink and moist, CRT < 2 sec. Lymph nodes WNL. Cardiac auscultation: no murmur detected. Lungs clear bilaterally. Skin turgor adequate, ~5% dehydration estimated.'
    },
    { 
        name: 'Assessment', letter: 'A',
        header: 'bg-gradient-to-r from-amber-500 to-amber-700', 
        border: '#f59e0b', bg: 'bg-amber-50',
        text: '1. Acute gastroenteritis — likely dietary indiscretion vs early GI foreign body\n2. Rule out pancreatitis — cranial abdominal pain, anorexia, vomiting consistent\n3. Rule out hepatopathy — will evaluate with chem panel\n4. Mild dehydration secondary to vomiting and decreased oral intake'
    },
    { 
        name: 'Plan', letter: 'P',
        header: 'bg-gradient-to-r from-red-500 to-red-700', 
        border: '#ef4444', bg: 'bg-red-50',
        text: '• CBC/Chem panel, cPL SNAP\n• Abdominal radiographs (2-view)\n• Maropitant (Cerenia) 1 mg/kg SQ SID x 3 days\n• LRS 500 mL SQ for rehydration\n• Bland diet (boiled chicken + rice) small frequent meals\n• Recheck in 48 hours, sooner if worsening\n• Call owner with lab results, discuss ultrasound if rads inconclusive'
    },
];

const PQ_QUESTION = 'What are the top differentials for a dog with acute onset of PU/PD?';
const PQ_ANSWER = 'The most common differentials for acute polyuria/polydipsia in dogs include:\n\n• Diabetes mellitus — Check fasting glucose and fructosamine\n• Cushing\'s disease — LDDS or ACTH stim test\n• Renal insufficiency — BUN, creatinine, SDMA, urinalysis\n• Pyometra — In intact females, check CBC + ultrasound\n• Hypercalcemia — Ionized calcium panel\n\nA minimum database of CBC, chemistry, and urinalysis with specific gravity is recommended as a starting point.';

// ─── QuickSOAP Demo: dictation scrolls out → SOAP sections appear ───
const QuickSOAPDemo = () => {
    const [phase, setPhase] = useState('dictating'); // dictating | generating | soap | pause
    const [dictationPos, setDictationPos] = useState(0);
    const [soapVisible, setSoapVisible] = useState(0);

    useEffect(() => {
        if (phase === 'dictating') {
            if (dictationPos < DICTATION_TEXT.length) {
                const t = setTimeout(() => setDictationPos(p => p + 2), 20);
                return () => clearTimeout(t);
            } else {
                const t = setTimeout(() => setPhase('generating'), 1000);
                return () => clearTimeout(t);
            }
        } else if (phase === 'generating') {
            const t = setTimeout(() => { setSoapVisible(0); setPhase('soap'); }, 1500);
            return () => clearTimeout(t);
        } else if (phase === 'soap') {
            if (soapVisible < SOAP_SECTIONS.length) {
                const t = setTimeout(() => setSoapVisible(v => v + 1), 400);
                return () => clearTimeout(t);
            } else {
                const t = setTimeout(() => setPhase('pause'), 3000);
                return () => clearTimeout(t);
            }
        } else if (phase === 'pause') {
            const t = setTimeout(() => {
                setDictationPos(0);
                setSoapVisible(0);
                setPhase('dictating');
            }, 1500);
            return () => clearTimeout(t);
        }
    }, [phase, dictationPos, soapVisible]);

    return (
        <div className="w-full max-w-lg mx-auto rounded-xl overflow-hidden shadow-xl border border-gray-200 bg-white flex flex-col" style={{ height: 'min(calc(100vh - 280px), 480px)' }}>
            {/* Fixed header */}
            <div className="bg-white px-4 py-2.5 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
                <div className={`w-3 h-3 rounded-full ${(phase === 'dictating' || phase === 'generating') ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                <span className="text-sm font-medium text-gray-700">
                    {phase === 'dictating' ? 'Listening...' : phase === 'generating' ? 'Processing...' : 'QuickSOAP'}
                </span>
            </div>
            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
                {(phase === 'dictating' || phase === 'generating') ? (
                    <div className="p-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-blue-700">Dictation</span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">
                                {DICTATION_TEXT.slice(0, dictationPos)}
                                {phase === 'dictating' && <span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse align-middle" />}
                            </p>
                        </div>
                        {phase === 'generating' && (
                            <div className="mt-3 flex items-center justify-center gap-2 py-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: '450ms' }} />
                            </div>
                        )}
                    </div>
                ) : (
                    SOAP_SECTIONS.map((section, i) => (
                        <div
                            key={i}
                            className={`border-l-4 ${i < SOAP_SECTIONS.length - 1 ? 'border-b border-gray-200' : ''} transition-all duration-500 ${i < soapVisible ? 'opacity-100' : 'opacity-0'}`}
                            style={{ borderLeftColor: section.border }}
                        >
                            <div className={`${section.header} px-4 py-2 flex items-center`}>
                                <h3 className="text-white font-semibold text-sm tracking-wide">
                                    {section.letter} – {section.name}
                                </h3>
                            </div>
                        <div className={`${section.bg} px-4 py-3`}>
                            <p className="text-gray-700 text-xs sm:text-sm leading-relaxed whitespace-pre-line">{section.text}</p>
                        </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// ─── PetQuery Demo: styled like actual app chat ───
const PetQueryDemo = () => {
    const [messages, setMessages] = useState([]);
    const [typedResponse, setTypedResponse] = useState('');
    const [phase, setPhase] = useState('showUser'); // showUser | thinking | typeResponse | pause

    useEffect(() => {
        if (phase === 'showUser') {
            const t = setTimeout(() => {
                setMessages([{ role: 'user', text: PQ_QUESTION }]);
                setPhase('thinking');
            }, 800);
            return () => clearTimeout(t);
        } else if (phase === 'thinking') {
            const t = setTimeout(() => {
                setTypedResponse('');
                setPhase('typeResponse');
            }, 1500);
            return () => clearTimeout(t);
        } else if (phase === 'typeResponse') {
            if (typedResponse.length < PQ_ANSWER.length) {
                const t = setTimeout(() => {
                    setTypedResponse(PQ_ANSWER.slice(0, typedResponse.length + 2));
                }, 15);
                return () => clearTimeout(t);
            } else {
                setPhase('pause');
            }
        } else if (phase === 'pause') {
            const t = setTimeout(() => {
                setMessages([]);
                setTypedResponse('');
                setPhase('showUser');
            }, 4000);
            return () => clearTimeout(t);
        }
    }, [phase, typedResponse]);

    return (
        <div className="w-full max-w-lg mx-auto rounded-xl overflow-hidden shadow-xl border border-gray-200 bg-white flex flex-col" style={{ height: 'min(calc(100vh - 280px), 480px)' }}>
            {/* Fixed header */}
            <div className="bg-white px-4 py-2.5 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-gray-700">PetQuery</span>
            </div>
            {/* Scrollable chat area */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-3 sm:p-4 space-y-3">
                {messages.length === 0 && phase === 'showUser' && (
                    <div className="flex items-center justify-center h-full gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className="flex justify-end">
                        <div className="max-w-[85%] bg-primary-500 text-white rounded-2xl rounded-br-sm px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-sm">
                            {msg.text}
                        </div>
                    </div>
                ))}
                {phase === 'thinking' && (
                    <div className="flex justify-start">
                        <div className="bg-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-500 animate-pulse">
                            Thinking...
                        </div>
                    </div>
                )}
                {(phase === 'typeResponse' || phase === 'pause') && typedResponse && (
                    <div className="flex justify-start">
                        <div className="max-w-[90%] bg-primary-50 text-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 border-l-4 border-primary-400 text-xs sm:text-sm leading-relaxed shadow-sm">
                            <span className="whitespace-pre-wrap">{typedResponse}</span>
                            {phase === 'typeResponse' && <span className="inline-block w-0.5 h-4 bg-primary-500 ml-0.5 animate-pulse align-middle" />}
                        </div>
                    </div>
                )}
            </div>
            {/* Fixed input bar */}
            <div className="bg-white border-t border-gray-200 px-3 py-2 flex items-center gap-2 flex-shrink-0">
                <div className="flex-1 bg-gray-100 border border-gray-300 rounded-2xl px-4 py-2.5 text-sm text-gray-400">
                    Ask me anything about veterinary medicine...
                </div>
                <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0 opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="16" height="16">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                </div>
            </div>
        </div>
    );
};

// ─── Main BenefitsStep ───
const BenefitsStep = ({ onNext, onBack }) => {
    const [featurePhase, setFeaturePhase] = useState(0);

    // Phase 0: QuickSOAP demo
    if (featurePhase === 0) {
        return (
            <OnboardingLayout currentStep="benefits" onBack={onBack}>
                <div className="flex flex-col items-center justify-center h-full animate-fade-in">
                    <div className="flex-1 min-h-0 flex items-center justify-center w-full overflow-hidden">
                        <QuickSOAPDemo />
                    </div>
                    <div className="text-center mt-3 sm:mt-4 flex-shrink-0">
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">
                            Voice-to-SOAP in Seconds
                        </h2>
                        <p className="text-white/60 text-xs sm:text-sm mb-4">
                            Dictate patient visits and get AI-generated SOAP notes instantly.
                        </p>
                        <button
                            onClick={() => setFeaturePhase(1)}
                            className="w-full max-w-sm mx-auto block py-3.5 bg-[#3db6fd] text-white font-semibold rounded-lg hover:bg-[#2da8ef] transition-all duration-200 text-base sm:text-lg"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </OnboardingLayout>
        );
    }

    // Phase 1: PetQuery demo
    return (
        <OnboardingLayout currentStep="benefits" onBack={() => setFeaturePhase(0)}>
            <div className="flex flex-col items-center justify-center h-full animate-fade-in">
                <div className="flex-1 min-h-0 flex items-center justify-center w-full overflow-hidden">
                    <PetQueryDemo />
                </div>
                <div className="text-center mt-3 sm:mt-4 flex-shrink-0">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">
                        Instant AI Vet Answers
                    </h2>
                    <p className="text-white/60 text-xs sm:text-sm mb-4">
                        Ask veterinary questions and get detailed, professional answers.
                    </p>
                    <button
                        onClick={onNext}
                        className="w-full max-w-sm mx-auto block py-3.5 bg-[#3db6fd] text-white font-semibold rounded-lg hover:bg-[#2da8ef] transition-all duration-200 text-base sm:text-lg"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </OnboardingLayout>
    );
};

export default BenefitsStep;
