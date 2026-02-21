import React from 'react';
import OnboardingLayout from './OnboardingLayout';

const BookingStep = ({ onNext, onBack }) => {
    return (
        <OnboardingLayout currentStep="booking" onBack={onBack}>
            <div className="text-center animate-fade-in">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-4xl">🎓</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 leading-tight">
                    Get a Complimentary<br />1-on-1 Demo
                </h1>

                <p className="text-white/80 text-base sm:text-lg max-w-md mx-auto mb-3 leading-relaxed">
                    Book a session with <strong className="text-white">Dr. Stacey Gastis</strong> to walk 
                    through real clinical use cases and get the most out of PetWise right away.
                </p>

                <p className="text-white/60 text-sm max-w-md mx-auto mb-8">
                    The session is about an hour and includes <strong className="text-white/80">1 hour of RACE-approved CE</strong> — completely free.
                </p>

                {/* Calendly embed will go here */}
                <a
                    href="https://calendly.com/d/cvkg-xhd-k56/complimentary-walk-through-pw"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full max-w-sm mx-auto block py-3.5 bg-[#3db6fd] text-white font-semibold rounded-lg hover:bg-[#2da8ef] transition-all duration-200 text-base sm:text-lg"
                >
                    Book a Demo
                </a>

                <button
                    onClick={onNext}
                    className="w-full max-w-sm mx-auto block mt-3 py-3 text-white/50 hover:text-white/80 font-medium transition-colors duration-200 text-sm"
                >
                    Skip for now →
                </button>
            </div>
        </OnboardingLayout>
    );
};

export default BookingStep;
