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
                    <p className="text-[12px] sm:text-[13px] font-semibold uppercase tracking-[0.14em] text-[#a8e6fa] mb-4">One thing to know</p>
                    <h1 className="text-[2rem] sm:text-[2.75rem] font-semibold tracking-[-0.03em] text-white leading-[1.05] mb-3">
                        PetWise lives on your desktop
                    </h1>
                    <p className="text-white/75 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
                        Your phone and your computer work together.
                    </p>
                </div>

                <div className="space-y-3 max-w-sm mx-auto text-left mb-6">
                    <div className="flex items-start gap-3.5 p-4 rounded-[20px] bg-white/10 border border-white/15 backdrop-blur-sm">
                        <div className="w-10 h-10 flex-shrink-0 rounded-full bg-white/15 flex items-center justify-center">
                            <FaDesktop className="text-[#a8e6fa] text-lg" />
                        </div>
                        <div>
                            <p className="text-white font-semibold text-sm mb-0.5">Your computer: the full app</p>
                            <p className="text-white/75 text-[13px] leading-snug">
                                Records, templates, and completed SOAP reports. Go to{' '}
                                <span className="text-white font-semibold">petwise.vet</span> on your computer
                                and log in with the same email and password you just signed up with.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3.5 p-4 rounded-[20px] bg-white/10 border border-white/15 backdrop-blur-sm">
                        <div className="w-10 h-10 flex-shrink-0 rounded-full bg-white/15 flex items-center justify-center">
                            <FaMicrophone className="text-[#a8e6fa] text-lg" />
                        </div>
                        <div>
                            <p className="text-white font-semibold text-sm mb-0.5">Your phone: a portable microphone</p>
                            <p className="text-white/75 text-[13px] leading-snug">
                                Record visits with QuickSOAP and they appear in your records on desktop automatically.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="max-w-sm mx-auto">
                    <button
                        onClick={onNext}
                        className="w-full py-3.5 bg-white text-[#2d5fb8] font-medium rounded-full hover:bg-[#e9f6fd] transition-all duration-200 text-sm sm:text-base"
                    >
                        Got it, continue
                    </button>
                </div>
            </div>
        </OnboardingLayout>
    );
};

export default DesktopBridgeStep;
