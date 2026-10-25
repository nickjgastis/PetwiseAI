import React, { useState } from 'react';
import TermsContent from '../legal/TermsContent';
import PrivacyContent from '../legal/PrivacyContent';

const TermsOfService = ({ onAccept, onBack }) => {
    const [hasAccepted, setHasAccepted] = useState(false);

    const handleAccept = () => {
        if (hasAccepted) {
            onAccept({ emailOptOut: false });
        }
    };

    return (
        <div 
            className="fixed inset-0 z-50 bg-gradient-to-br from-[#1e3a6e] via-[#2a5298] to-[#3468bd] flex flex-col"
            style={{ overscrollBehavior: 'none' }}
        >
            {/* Progress bar area with back button */}
            <div className="flex-shrink-0 w-full px-4 sm:px-10 pt-4 sm:pt-6 relative z-10">
                <div className="max-w-5xl mx-auto flex items-center gap-3">
                    {onBack ? (
                        <button onClick={onBack} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-all">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    ) : (
                        <div className="w-8 flex-shrink-0" />
                    )}
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-[#3db6fd] rounded-full transition-all duration-700 ease-out"
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="flex-shrink-0 px-4 pt-4 pb-2 sm:px-8 sm:pt-5 sm:pb-3 text-center">
                <h1 className="text-xl sm:text-3xl font-bold text-white mb-1">Terms of Service & Privacy Policy</h1>
                <p className="text-white/60 text-xs sm:text-sm">Please read and accept our terms to continue</p>
            </div>

            {/* Scrollable terms area */}
            <div
                className="flex-1 overflow-y-auto mx-4 sm:mx-8 border border-white/10 rounded-xl bg-white/10 backdrop-blur-sm leading-relaxed p-4 sm:p-6 text-white/85 text-[15px] [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:mb-3 [&_li]:mb-1.5 [&_strong]:text-white [&_a]:underline"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                <h2>Terms of Service</h2>
                <TermsContent />
                <h2 className="mt-10">Privacy Policy</h2>
                <PrivacyContent />
            </div>

            {/* Fixed bottom controls */}
            <div className="flex-shrink-0 px-4 py-3 sm:px-8 sm:py-4 bg-gradient-to-t from-[#1e3a6e] to-[#1e3a6e]/95 border-t border-white/10">
                <label className="flex items-center gap-3 p-2 sm:p-3 rounded-lg transition-colors duration-200 hover:bg-white/5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={hasAccepted}
                        onChange={(e) => setHasAccepted(e.target.checked)}
                        className="w-5 h-5 flex-shrink-0 text-[#3db6fd] bg-white/10 border-2 border-white/30 rounded focus:ring-[#3db6fd] focus:ring-2"
                    />
                    <span className="text-white/80 font-medium text-xs sm:text-sm">I have read and agree to the Terms of Service and Privacy Policy</span>
                </label>

                <button
                    onClick={handleAccept}
                    disabled={!hasAccepted}
                    className="w-full py-3 sm:py-3.5 bg-[#3db6fd] text-white font-semibold rounded-lg hover:bg-[#2da8ef] disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed transition-colors duration-200 mt-2 text-base sm:text-lg"
                >
                    Accept & Continue
                </button>
            </div>
        </div>
    );
};

export default TermsOfService;
