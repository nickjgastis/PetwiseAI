import React, { useState, useEffect, useRef } from 'react';
import { FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import OnboardingLayout from './onboarding/OnboardingLayout';

const WelcomeToPetwise = ({ user, onComplete, onBack }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const videoRef = useRef(null);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = false;
            videoRef.current.volume = 0.25;
            videoRef.current.play().catch(() => {
                if (videoRef.current) {
                    videoRef.current.muted = true;
                    setIsMuted(true);
                    videoRef.current.play().catch(() => {});
                }
            });
        }
    }, []);

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
        }
    };

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
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white mb-4 sm:mb-6 leading-tight max-w-4xl mx-auto">
                    Welcome to PetWise!
                </h1>

                {/* VSL Video placeholder */}
                <div className="max-w-xl mx-auto mb-4 sm:mb-6">
                    <p className="text-white/90 text-sm sm:text-base mb-3">
                        Watch this quick walkthrough to get started!
                    </p>
                    <div className="relative mx-auto">
                        <video
                            ref={videoRef}
                            src="/petwisevsl.mp4"
                            playsInline
                            loop
                            className="w-full rounded-2xl shadow-2xl shadow-black/30"
                            style={{ objectFit: 'contain' }}
                        />
                        <button
                            onClick={toggleMute}
                            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-all"
                        >
                            {isMuted ? <FaVolumeMute className="text-sm" /> : <FaVolumeUp className="text-sm" />}
                        </button>
                    </div>
                    <p className="text-white/70 text-xs mt-2">Unmute this video!</p>
                </div>

                <button
                    onClick={handleGetStarted}
                    disabled={isLoading}
                    className="w-full max-w-sm mx-auto block py-3.5 bg-[#3db6fd] text-white font-semibold rounded-lg hover:bg-[#2da8ef] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-lg"
                >
                    {isLoading ? 'Loading...' : 'Continue →'}
                </button>
            </div>
        </OnboardingLayout>
    );
};

export default WelcomeToPetwise;
