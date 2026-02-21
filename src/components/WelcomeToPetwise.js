import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import OnboardingLayout from './onboarding/OnboardingLayout';

const WelcomeToPetwise = ({ user, onComplete, onBack }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [playerReady, setPlayerReady] = useState(false);
    const playerRef = useRef(null);

    useEffect(() => {
        window.scrollTo(0, 0);

        const initPlayer = () => {
            playerRef.current = new window.YT.Player('vsl-player', {
                videoId: 'YbRBR5DsBS4',
                width: '100%',
                height: '100%',
                playerVars: {
                    autoplay: 1,
                    mute: 1,
                    loop: 1,
                    playlist: 'YbRBR5DsBS4',
                    controls: 0,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3,
                    disablekb: 1,
                    fs: 0,
                    playsinline: 1,
                    origin: window.location.origin,
                },
                events: {
                    onReady: (e) => {
                        e.target.playVideo();
                        setPlayerReady(true);
                    },
                },
            });
        };

        if (window.YT && window.YT.Player) {
            initPlayer();
        } else {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScript = document.getElementsByTagName('script')[0];
            firstScript.parentNode.insertBefore(tag, firstScript);
            window.onYouTubeIframeAPIReady = initPlayer;
        }

        return () => { window.onYouTubeIframeAPIReady = null; };
    }, []);

    const handleUnmute = useCallback(() => {
        if (!playerReady || !playerRef.current?.unMute) return;
        if (isMuted) {
            playerRef.current.unMute();
            playerRef.current.setVolume(80);
        } else {
            playerRef.current.mute();
        }
        setIsMuted(!isMuted);
    }, [isMuted, playerReady]);

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

                {/* VSL Video */}
                <div className="max-w-2xl mx-auto mb-6 sm:mb-8">
                    <div 
                        className="relative w-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl shadow-black/40"
                        style={{ aspectRatio: '16/9' }}
                    >
                        <div id="vsl-player" className="absolute inset-0 w-full h-full" />
                        <div className="absolute inset-0 z-10 bg-transparent" />
                        <button
                            onClick={handleUnmute}
                            className="absolute bottom-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-full text-white text-xs font-medium hover:bg-black/90 transition-all cursor-pointer"
                        >
                            {isMuted ? (
                                <>
                                    <svg className="w-3.5 h-3.5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                                    </svg>
                                    Tap for sound
                                </>
                            ) : (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                                    </svg>
                                    Mute
                                </>
                            )}
                        </button>
                    </div>
                    {isMuted && (
                        <p onClick={handleUnmute} className="text-white text-xs mt-2 cursor-pointer hover:text-white/80 transition-colors">
                            Unmute this video!
                        </p>
                    )}
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
