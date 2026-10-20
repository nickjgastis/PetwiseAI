import React from 'react';
import { FaArrowLeft } from 'react-icons/fa';

// Active flow only — onboarding is now a single congrats screen (name + phone + terms)
const STEP_ORDER = ['congrats'];

const OnboardingLayout = ({ currentStep, children, showProgress = true, wide = false, onBack }) => {
    const stepIndex = STEP_ORDER.indexOf(currentStep);
    const progress = stepIndex >= 0 ? ((stepIndex + 1) / STEP_ORDER.length) * 100 : 0;

    return (
        <div
            className="fixed inset-0 z-50 bg-gradient-to-br from-[#3a72cc] via-[#2d5fb8] to-[#1e4a94] flex flex-col overflow-y-auto"
            style={{ overscrollBehavior: 'none' }}
        >
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(60% 45% at 50% 0%, rgba(92,204,240,0.35) 0%, rgba(45,95,184,0) 70%)' }}
            />

            {/* Progress bar with back button */}
            {showProgress && stepIndex >= 0 && (
                <div className="flex-shrink-0 w-full px-4 sm:px-10 pt-4 sm:pt-6 relative z-10">
                    <div className="max-w-5xl mx-auto flex items-center gap-3">
                        {onBack ? (
                            <button onClick={onBack} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-all">
                                <FaArrowLeft className="text-sm" />
                            </button>
                        ) : (
                            <div className="w-8 flex-shrink-0" />
                        )}
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-[#7fd6f3] rounded-full transition-all duration-700 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Content area */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-10 py-4 sm:py-8 relative z-10" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className={`w-full ${wide ? 'max-w-5xl' : 'max-w-xl'}`}>
                    {children}
                </div>
            </div>

        </div>
    );
};

export { STEP_ORDER };
export default OnboardingLayout;
