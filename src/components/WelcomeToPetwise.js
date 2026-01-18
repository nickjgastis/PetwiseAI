import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { FaCheckCircle, FaMicrophone, FaComments, FaFileAlt } from 'react-icons/fa';

const WelcomeToPetwise = ({ user, onComplete }) => {
    const [isLoading, setIsLoading] = useState(false);

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
        <div className="min-h-screen bg-gradient-to-br from-[#2a5298] via-[#3468bd] to-[#1e3a6e] flex flex-col items-center justify-center p-4 sm:p-8">
            {/* Success Icon */}
            <div className="mb-6 animate-bounce-slow">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full flex items-center justify-center shadow-xl">
                    <FaCheckCircle className="text-green-500 text-4xl sm:text-5xl" />
                </div>
            </div>

            {/* Welcome Message */}
            <div className="text-center mb-8 sm:mb-10">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
                    Welcome to Petwise!
                </h1>
                <p className="text-white/80 text-lg sm:text-xl max-w-lg mx-auto">
                    Your account is ready. Let's transform how you document patient care.
                </p>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl mb-10">
                {features.map((feature, idx) => (
                    <div 
                        key={idx}
                        className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center hover:bg-white/20 transition-all duration-300"
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4">
                            <feature.icon className="text-[#3468bd] text-xl" />
                        </div>
                        <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
                        <p className="text-white/70 text-sm">{feature.description}</p>
                    </div>
                ))}
            </div>

            {/* Get Started Button */}
            <button
                onClick={handleGetStarted}
                disabled={isLoading}
                className="px-12 py-4 bg-white text-[#3468bd] font-bold text-lg rounded-xl hover:bg-gray-100 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
                {isLoading ? 'Loading...' : 'Get Started →'}
            </button>

            {/* Subtle footer */}
            <p className="text-white/50 text-sm mt-8 text-center">
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
