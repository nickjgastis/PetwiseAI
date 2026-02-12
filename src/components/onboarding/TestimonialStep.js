import React from 'react';
import OnboardingLayout from './OnboardingLayout';
import { FaStar } from 'react-icons/fa';

const TestimonialStep = ({ onNext, onBack }) => {
    return (
        <OnboardingLayout currentStep="testimonial" onBack={onBack}>
            <div className="text-center animate-fade-in">
                {/* Stars */}
                <div className="flex justify-center gap-1.5 mb-4 sm:mb-6">
                    {[...Array(5)].map((_, i) => (
                        <FaStar key={i} className="text-amber-400 text-base sm:text-lg" />
                    ))}
                </div>

                {/* Quote */}
                <blockquote className="text-white/90 text-sm sm:text-lg lg:text-2xl leading-relaxed mb-4 sm:mb-6 max-w-lg mx-auto font-light">
                    I am absolutely <strong className="font-bold text-white">obsessed</strong> with PetWise! It is super user friendly, and provides me with <strong className="font-bold text-white">fast and accurate information</strong>. I have been reluctant to use AI for records because I like things written a certain way, and it can be hard to trust information generated from outside sources.
                </blockquote>
                <blockquote className="text-white/90 text-sm sm:text-lg lg:text-2xl leading-relaxed mb-6 sm:mb-8 max-w-lg mx-auto font-light">
                    <strong className="font-bold text-white">I am impressed</strong>, and I am comfortable distributing the information I get from PetWise to my clients.
                </blockquote>

                {/* Attribution */}
                <div className="mb-6 sm:mb-10">
                    <div className="w-8 h-0.5 bg-[#3db6fd] mx-auto mb-4" />
                    <p className="font-semibold text-white text-lg sm:text-xl">
                        Dr. Amanda Wright
                    </p>
                    <p className="text-white/40 text-sm sm:text-base">DVM</p>
                </div>

                <button
                    onClick={onNext}
                    className="w-full max-w-sm mx-auto block py-4 bg-[#3db6fd] text-white font-semibold rounded-lg hover:bg-[#2da8ef] transition-all duration-200 text-base sm:text-lg"
                >
                    Continue
                </button>
            </div>
        </OnboardingLayout>
    );
};

export default TestimonialStep;
