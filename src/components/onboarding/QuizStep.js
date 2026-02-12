import React, { useState } from 'react';
import OnboardingLayout from './OnboardingLayout';

const QUIZ_DATA = {
    quiz1: {
        question: 'What best describes you?',
        key: 'role',
        options: [
            { id: 'veterinarian', label: 'Veterinarian' },
            { id: 'vet_tech', label: 'Veterinary technician / nurse' },
            { id: 'practice_owner', label: 'Practice owner or manager' },
            { id: 'student', label: 'Veterinary student' },
            { id: 'other', label: 'Other clinic staff' },
        ]
    },
    quiz2: {
        question: "What do you want Petwise to help with most?",
        key: 'goal',
        options: [
            { id: 'soap_notes', label: 'Writing SOAP notes faster' },
            { id: 'record_clarity', label: 'Improving clarity and consistency of records' },
            { id: 'reduce_paperwork', label: 'Reducing end-of-day paperwork' },
            { id: 'learning', label: 'Training or learning clinical documentation' },
            { id: 'explore_ai', label: 'Exploring AI tools for my clinic' },
        ]
    }
};

const QuizStep = ({ step, quizAnswers, onNext, onBack }) => {
    const quiz = QUIZ_DATA[step];
    const [selected, setSelected] = useState(quizAnswers?.[quiz.key] || null);
    const [isAnimating, setIsAnimating] = useState(false);

    const handleSelect = (optionId) => {
        setSelected(optionId);
        setIsAnimating(true);
        setTimeout(() => {
            onNext({ ...quizAnswers, [quiz.key]: optionId });
        }, 350);
    };

    return (
        <OnboardingLayout currentStep={step} onBack={onBack}>
            <div className="animate-fade-in">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-8 sm:mb-10 leading-tight">
                    {quiz.question}
                </h1>

                <div className="space-y-2.5">
                    {quiz.options.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => handleSelect(option.id)}
                            disabled={isAnimating}
                            className={`w-full flex items-center justify-between p-4 sm:p-5 rounded-xl text-left transition-all duration-200 ${
                                selected === option.id
                                    ? 'bg-[#3db6fd] text-white shadow-lg shadow-[#3db6fd]/20 scale-[1.02]'
                                    : 'bg-white/10 text-white/90 hover:bg-white/15 border border-white/10'
                            } ${isAnimating && selected !== option.id ? 'opacity-30 scale-[0.98]' : ''}`}
                        >
                            <span className="text-base sm:text-lg font-medium">{option.label}</span>
                            {selected === option.id && (
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </OnboardingLayout>
    );
};

export { QUIZ_DATA };
export default QuizStep;
