import React from 'react';
import OnboardingLayout from './OnboardingLayout';

const ROLE_COPY = {
    veterinarian: {
        headline: "Built for DVMs like you.",
        body: "You didn't spend years in vet school to spend your evenings writing records. Petwise generates accurate, professional SOAP notes so you can focus on medicine — not paperwork.",
    },
    vet_tech: {
        headline: "Your workflow, supercharged.",
        body: "Techs and nurses are the backbone of every clinic. Petwise helps you document faster and more consistently, so you can keep the day running smoothly without falling behind on records.",
    },
    practice_owner: {
        headline: "Better records. Happier team.",
        body: "Consistent documentation across your entire team — without the bottleneck. Petwise helps your practice produce higher-quality records in less time, reducing burnout and improving compliance.",
    },
    student: {
        headline: "Learn faster. Document smarter.",
        body: "Clinical documentation is one of the hardest skills to master. Petwise helps you learn proper SOAP formatting with AI-guided examples, so you build confidence before you even graduate.",
    },
    other: {
        headline: "The whole clinic benefits.",
        body: "Whether you're at the front desk or in the back, documentation touches everyone. Petwise streamlines the records process so the entire team can work more efficiently.",
    },
};

const GOAL_MESSAGES = {
    soap_notes: "We'll have you writing SOAP notes in seconds instead of minutes.",
    record_clarity: "We'll help you produce clearer, more consistent records every single time.",
    reduce_paperwork: "We'll cut through the paperwork so you can focus on what actually matters.",
    learning: "We'll guide you through clinical documentation with real AI-powered examples.",
    explore_ai: "We'll show you exactly how AI can transform your clinic's daily workflow.",
};

const AffirmationStep = ({ quizAnswers, onNext, onBack }) => {
    const role = quizAnswers?.role || 'veterinarian';
    const goal = quizAnswers?.goal;
    const copy = ROLE_COPY[role] || ROLE_COPY.veterinarian;
    const goalMessage = GOAL_MESSAGES[goal] || "We'll help you work smarter, not harder.";

    return (
        <OnboardingLayout currentStep="affirmation" onBack={onBack}>
            <div className="text-center animate-fade-in">
                {/* Accent line */}
                <div className="w-12 h-1 bg-[#3db6fd] rounded-full mx-auto mb-5 sm:mb-8" />

                <h1 className="text-3xl sm:text-4xl lg:text-6xl font-extrabold text-white leading-tight mb-4 sm:mb-6">
                    You're a perfect fit.
                </h1>

                <h2 className="text-lg sm:text-xl lg:text-3xl font-bold text-[#3db6fd] mb-3 sm:mb-5">
                    {copy.headline}
                </h2>

                <p className="text-white/70 text-sm sm:text-base lg:text-xl leading-relaxed mb-3 sm:mb-5 max-w-lg mx-auto">
                    {copy.body}
                </p>

                <p className="text-white/40 text-xs sm:text-sm lg:text-base leading-relaxed mb-6 sm:mb-10 max-w-md mx-auto">
                    {goalMessage}
                </p>

                <button
                    onClick={onNext}
                    className="w-full max-w-sm mx-auto block py-4 bg-[#3db6fd] text-white font-semibold rounded-lg hover:bg-[#2da8ef] transition-all duration-200 text-base sm:text-lg"
                >
                    See How It Works
                </button>
            </div>
        </OnboardingLayout>
    );
};

export default AffirmationStep;
