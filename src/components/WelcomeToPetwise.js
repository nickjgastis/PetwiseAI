import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import OnboardingLayout from './onboarding/OnboardingLayout';

const WelcomeToPetwise = ({ user, onComplete, onBack }) => {
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const handleGetStarted = async () => {
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({ has_completed_onboarding: true })
                .eq('auth0_user_id', user.sub);

            if (error) throw error;

            if (onComplete) {
                onComplete();
            }
        } catch (error) {
            console.error('Error completing onboarding:', error);
            setIsLoading(false);
        }
    };

    return (
        <OnboardingLayout currentStep="welcome" onBack={onBack} wide={true}>
            <div className="text-center animate-fade-in">
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white mb-5 sm:mb-8 leading-tight max-w-4xl mx-auto">
                    Welcome to Petwise!
                </h1>
                <p className="text-white/80 text-xl sm:text-2xl lg:text-3xl max-w-2xl mx-auto mb-10 leading-relaxed">
                    Let's start saving you time.
                </p>

                <button
                    onClick={handleGetStarted}
                    disabled={isLoading}
                    className="w-full max-w-sm mx-auto block py-3.5 bg-[#3db6fd] text-white font-semibold rounded-lg hover:bg-[#2da8ef] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-lg"
                >
                    {isLoading ? 'Loading...' : 'Get Started →'}
                </button>
            </div>
        </OnboardingLayout>
    );
};

export default WelcomeToPetwise;
