import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FaCheckCircle, FaMicrophone, FaComments, FaFileAlt } from 'react-icons/fa';

const WelcomeToPetwise = ({ user, onComplete }) => {
    const [isLoading, setIsLoading] = useState(false);

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const handleGetStarted = async () => {
        setIsLoading(true);
        try {
            // Mark onboarding as complete
            const { error } = await supabase
                .from('users')
                .update({ has_completed_onboarding: true })
                .eq('auth0_user_id', user.sub);

            if (error) throw error;

            // Notify parent component
            if (onComplete) {
                onComplete();
            }
        } catch (error) {
            console.error('Error completing onboarding:', error);
            setIsLoading(false);
        }
    };

    const features = [
        {
            icon: FaMicrophone,
            title: 'QuickSOAP',
            description: 'Dictate patient visits and get AI-generated SOAP notes in seconds'
        },
        {
            icon: FaComments,
            title: 'PetQuery',
            description: 'Ask veterinary questions and get detailed, professional answers'
        },
        {
            icon: FaFileAlt,
            title: 'PetSOAP',
            description: 'Create comprehensive medical reports with customizable templates'
        }
    ];

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-[#2a5298] via-[#3468bd] to-[#1e3a6e] flex flex-col items-center justify-center p-4 sm:p-8" style={{ overscrollBehavior: 'none' }}>
            {/* Success Icon */}
            <div className="mb-3 sm:mb-6 animate-bounce-slow">
                <div className="w-14 h-14 sm:w-24 sm:h-24 bg-white rounded-full flex items-center justify-center shadow-xl">
                    <FaCheckCircle className="text-green-500 text-2xl sm:text-5xl" />
                </div>
            </div>

            {/* Welcome Message */}
            <div className="text-center mb-4 sm:mb-10">
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-2 sm:mb-4">
                    Welcome to Petwise!
                </h1>
                <p className="text-white/80 text-sm sm:text-xl max-w-lg mx-auto">
                    Your account is ready. Let's transform how you document patient care.
                </p>
            </div>

            {/* Feature Cards — compact horizontal on mobile, grid on desktop */}
            <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-3 sm:gap-6 w-full max-w-4xl mb-5 sm:mb-10">
                {features.map((feature, idx) => (
                    <div 
                        key={idx}
                        className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-6 flex items-center gap-3 sm:flex-col sm:text-center hover:bg-white/20 transition-all duration-300"
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 sm:mx-auto sm:mb-4">
                            <feature.icon className="text-[#3468bd] text-base sm:text-xl" />
                        </div>
                        <div className="sm:text-center">
                            <h3 className="text-white font-semibold text-sm sm:text-lg sm:mb-2">{feature.title}</h3>
                            <p className="text-white/70 text-xs sm:text-sm leading-tight">{feature.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Get Started Button */}
            <button
                onClick={handleGetStarted}
                disabled={isLoading}
                className="px-10 py-3 sm:px-12 sm:py-4 bg-white text-[#3468bd] font-bold text-base sm:text-lg rounded-xl hover:bg-gray-100 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
                {isLoading ? 'Loading...' : 'Get Started →'}
            </button>

            {/* Subtle footer */}
            <p className="text-white/50 text-xs sm:text-sm mt-4 sm:mt-8 text-center">
                You can access all features from your dashboard
            </p>

            {/* Custom animation */}
            <style>{`
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default WelcomeToPetwise;
