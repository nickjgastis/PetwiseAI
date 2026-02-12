import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { supabase } from '../../supabaseClient';
import OnboardingLayout from './OnboardingLayout';

const CongratsStep = ({ onNext }) => {
    const [dvmName1, setDvmName1] = useState('');
    const [dvmName2, setDvmName2] = useState('');
    const [isStudentMode, setIsStudentMode] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuth0();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (dvmName1.trim() !== dvmName2.trim()) {
            setError('Names do not match. Please check spelling.');
            return;
        }
        if (!dvmName1.trim()) {
            setError('Please enter your name.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { error: updateError } = await supabase
                .from('users')
                .update({ dvm_name: dvmName1.trim() })
                .eq('auth0_user_id', user.sub);
            if (updateError) throw updateError;
            onNext();
        } catch (err) {
            console.error('Error saving DVM name:', err);
            setError('Failed to save. Please try again.');
            setIsSubmitting(false);
        }
    };

    return (
        <OnboardingLayout currentStep="congrats">
            <div className="animate-fade-in text-center">
                {/* Big congrats */}
                <div className="mb-5 sm:mb-10">
                    <p className="text-[#3db6fd] text-sm sm:text-base font-medium tracking-widest uppercase mb-4">Welcome to Petwise</p>
                    <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white leading-none mb-4">
                        Congratulations!
                    </h1>
                    <p className="text-white/70 text-lg sm:text-xl lg:text-2xl max-w-md mx-auto leading-relaxed">
                        You've taken your first step to saving countless hours writing SOAPs.
                    </p>
                </div>

                {/* Name form — clean, no card */}
                <form onSubmit={handleSubmit} className="text-left space-y-4 max-w-sm mx-auto">
                    <p className="text-white/50 text-xs text-center uppercase tracking-wider font-medium mb-1">Set up your profile</p>

                    {/* Toggle */}
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={() => setIsStudentMode(!isStudentMode)}
                            className="px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 bg-white/10 text-white/80 hover:bg-white/20 border border-white/20"
                        >
                            {isStudentMode ? 'Student Mode' : 'Doctor Mode'} — tap to switch
                        </button>
                    </div>

                    {/* Name input */}
                    <div>
                        <div className="flex rounded-lg overflow-hidden border border-white/20 bg-white/10 backdrop-blur-sm focus-within:border-[#3db6fd] focus-within:bg-white/15 transition-all">
                            <div className="flex items-center px-3.5 py-3 bg-white/10 text-white font-semibold text-sm border-r border-white/10">
                                {isStudentMode ? 'Student' : 'Dr.'}
                            </div>
                            <input
                                type="text"
                                placeholder="Your name"
                                value={dvmName1}
                                onChange={(e) => setDvmName1(e.target.value)}
                                className="flex-1 px-3.5 py-3 bg-transparent text-white placeholder-white/40 focus:outline-none text-sm sm:text-base"
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Confirm */}
                    <div>
                        <div className="flex rounded-lg overflow-hidden border border-white/20 bg-white/10 backdrop-blur-sm focus-within:border-[#3db6fd] focus-within:bg-white/15 transition-all">
                            <div className="flex items-center px-3.5 py-3 bg-white/10 text-white font-semibold text-sm border-r border-white/10">
                                {isStudentMode ? 'Student' : 'Dr.'}
                            </div>
                            <input
                                type="text"
                                placeholder="Confirm your name"
                                value={dvmName2}
                                onChange={(e) => setDvmName2(e.target.value)}
                                className="flex-1 px-3.5 py-3 bg-transparent text-white placeholder-white/40 focus:outline-none text-sm sm:text-base"
                                required
                            />
                        </div>
                    </div>

                    <p className="text-white/30 text-[11px] text-center">
                        This appears as <span className="text-white/50">{isStudentMode ? 'Student' : 'Dr.'} {dvmName1 || 'Your Name'}</span> on reports and can't be changed.
                    </p>

                    {error && (
                        <p className="text-red-300 text-sm text-center bg-red-500/10 rounded-lg py-2 px-3">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting || !dvmName1.trim() || !dvmName2.trim()}
                        className="w-full py-3.5 bg-[#3db6fd] text-white font-semibold rounded-lg hover:bg-[#2da8ef] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                        {isSubmitting ? 'Saving...' : 'Continue'}
                    </button>
                </form>
            </div>
        </OnboardingLayout>
    );
};

export default CongratsStep;
