import React from 'react';
import { FaDesktop, FaMicrophone } from 'react-icons/fa';
import OnboardingLayout from './OnboardingLayout';

// Shown once, mobile-only, right after CongratsStep. Explains the phone/desktop
// split before the user lands in the app: desktop is the full product, the
// phone is a portable microphone for QuickSOAP.
const DesktopBridgeStep = ({ onNext }) => {
    return (
        <OnboardingLayout currentStep="bridge" showProgress={false}>
            <div className="animate-fade-in text-center">
                <div className="mb-6 sm:mb-8">
                    <p className="text-[#3db6fd] text-sm sm:text-base font-medium tracking-widest uppercase mb-4">One thing to know</p>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-3">
                        Petwise lives on your desktop
                    </h1>
                    <p className="text-white/70 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
                        Your phone and your computer work together.
                    </p>
                </div>

                <div className="space-y-3 max-w-sm mx-auto text-left mb-6">
                    <div className="flex items-start gap-3.5 p-4 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm">
                        <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-[#3db6fd]/25 flex items-center justify-center">
                            <FaDesktop className="text-[#3db6fd] text-lg" />
                        </div>
                        <div>
                            <p className="text-white font-semibold text-sm mb-0.5">Your computer — the full app</p>
                            <p className="text-white/65 text-[13px] leading-snug">
                                Records, templates, and completed SOAP reports. Go to{' '}
                                <span className="text-[#3db6fd] font-semibold">petwise.vet</span> on your computer
                                and log in with the same email and password you just signed up with.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3.5 p-4 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm">
                        <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-emerald-400/25 flex items-center justify-center">
                            <FaMicrophone className="text-emerald-300 text-lg" />
                        </div>
                        <div>
                            <p className="text-white font-semibold text-sm mb-0.5">Your phone — a portable microphone</p>
                            <p className="text-white/65 text-[13px] leading-snug">
                                Record visits with QuickSOAP and they appear in your records on desktop automatically.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="max-w-sm mx-auto">
                    <button
                        onClick={onNext}
                        className="w-full py-3.5 bg-[#3db6fd] text-white font-semibold rounded-lg hover:bg-[#2da8ef] transition-all duration-200 text-sm sm:text-base"
                    >
                        Got it — continue
                    </button>
                </div>
            </div>
        </OnboardingLayout>
    );
};

export default DesktopBridgeStep;
