import React from 'react';
import { FaArrowLeft } from 'react-icons/fa';

const STEP_ORDER = ['congrats', 'quiz1', 'quiz2', 'affirmation', 'benefits', 'testimonial', 'trial', 'welcome', 'terms'];

const OnboardingLayout = ({ currentStep, children, showProgress = true, wide = false, onBack }) => {
    const stepIndex = STEP_ORDER.indexOf(currentStep);
    const progress = stepIndex >= 0 ? ((stepIndex + 1) / STEP_ORDER.length) * 100 : 0;

    return (
        <div 
            className="fixed inset-0 z-50 bg-gradient-to-br from-[#1e3a6e] via-[#2a5298] to-[#3468bd] flex flex-col overflow-y-auto"
            style={{ overscrollBehavior: 'none' }}
        >
            {/* Floating orbs background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute w-20 h-20 sm:w-28 sm:h-28 rounded-full blur-2xl"
                    style={{ background: '#3b82f6', opacity: 0.45, animation: 'onbFloat1 20s ease-in-out infinite' }}
                />
                <div className="absolute w-16 h-16 sm:w-24 sm:h-24 rounded-full blur-2xl"
                    style={{ background: '#10b981', opacity: 0.4, animation: 'onbFloat2 25s ease-in-out infinite' }}
                />
                <div className="absolute w-24 h-24 sm:w-32 sm:h-32 rounded-full blur-2xl"
                    style={{ background: '#f59e0b', opacity: 0.35, animation: 'onbFloat3 22s ease-in-out infinite' }}
                />
                <div className="absolute w-14 h-14 sm:w-20 sm:h-20 rounded-full blur-2xl"
                    style={{ background: '#ef4444', opacity: 0.35, animation: 'onbFloat4 28s ease-in-out infinite' }}
                />
            </div>

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
                                className="h-full bg-[#3db6fd] rounded-full transition-all duration-700 ease-out"
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

            {/* Keyframes */}
            <style>{`
                @keyframes onbFloat1 {
                    0%, 100% { top: 5%; left: 10%; transform: scale(1); }
                    25% { top: 50%; left: 60%; transform: scale(1.2); }
                    50% { top: 75%; left: 20%; transform: scale(0.9); }
                    75% { top: 20%; left: 55%; transform: scale(1.1); }
                }
                @keyframes onbFloat2 {
                    0%, 100% { top: 60%; left: 55%; transform: scale(1); }
                    25% { top: 10%; left: 5%; transform: scale(0.95); }
                    50% { top: 30%; left: 70%; transform: scale(1.15); }
                    75% { top: 70%; left: 30%; transform: scale(1); }
                }
                @keyframes onbFloat3 {
                    0%, 100% { top: 30%; left: 75%; transform: scale(1); }
                    25% { top: 65%; left: 35%; transform: scale(1.1); }
                    50% { top: 10%; left: 45%; transform: scale(0.85); }
                    75% { top: 50%; left: 5%; transform: scale(1.05); }
                }
                @keyframes onbFloat4 {
                    0%, 100% { top: 80%; left: 10%; transform: scale(1); }
                    25% { top: 15%; left: 45%; transform: scale(1.15); }
                    50% { top: 55%; left: 80%; transform: scale(0.9); }
                    75% { top: 5%; left: 25%; transform: scale(1.1); }
                }
            `}</style>
        </div>
    );
};

export { STEP_ORDER };
export default OnboardingLayout;
