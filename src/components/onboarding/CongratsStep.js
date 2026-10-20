import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { supabase } from '../../supabaseClient';
import { trackOnboardingComplete } from '../../utils/pixelEvents';
import OnboardingLayout from './OnboardingLayout';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const CongratsStep = ({ onNext }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [dvmName1, setDvmName1] = useState('');
    const [isStudentMode, setIsStudentMode] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuth0();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!dvmName1.trim()) {
            setError('Please enter your name.');
            return;
        }
        if (!acceptedTerms) {
            setError('Please accept the Terms of Service to continue.');
            return;
        }

        setIsSubmitting(true);
        try {
            const updates = {
                dvm_name: dvmName1.trim(),
                phone_number: phoneNumber.trim(),
                has_accepted_terms: true,
                email_opt_out: false,
            };
            const { error: updateError } = await supabase
                .from('users')
                .update(updates)
                .eq('auth0_user_id', user.sub);
            if (updateError) throw updateError;

            trackOnboardingComplete(user.sub);

            // Internal team email — phone isn't available at Auth0 signup, only here.
            // Fire-and-forget so a notify failure never blocks onboarding.
            fetch(`${API_URL}/email/admin-signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auth0_user_id: user.sub,
                    email: user.email,
                    nickname: dvmName1.trim(),
                    phone_number: phoneNumber.trim(),
                }),
            }).catch(err => console.error('Admin signup notification error:', err));

            onNext(updates);
        } catch (err) {
            console.error('Error saving profile:', err);
            setError('Failed to save. Please try again.');
            setIsSubmitting(false);
        }
    };

    const prefix = isStudentMode ? 'Student' : 'Dr.';

    return (
        <OnboardingLayout currentStep="congrats" showProgress={false}>
            <div className="animate-fade-in">
                <div className="text-center mb-7 sm:mb-9">
                    <p className="text-[12px] sm:text-[13px] font-semibold uppercase tracking-[0.14em] text-[#a8e6fa] mb-4">Welcome to PetWise</p>
                    <h1 className="text-[2.5rem] sm:text-[3.5rem] lg:text-[4.25rem] font-semibold tracking-[-0.04em] text-white leading-[1.02] mb-4">
                        Congratulations!
                    </h1>
                    <p className="text-white/75 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
                        You've taken your first step to saving countless hours writing SOAPs.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="max-w-md mx-auto bg-white rounded-[28px] p-6 sm:p-8 shadow-[0_40px_80px_-40px_rgba(19,35,63,0.6)] text-left space-y-4"
                >
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-[17px] font-semibold tracking-tight text-[#13233f]">Set up your profile</h2>
                        <div className="inline-flex rounded-full p-1 bg-[#f1f4f8]" role="group" aria-label="Account type">
                            {[['Doctor', false], ['Student', true]].map(([label, value]) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => setIsStudentMode(value)}
                                    aria-pressed={isStudentMode === value}
                                    className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all ${
                                        isStudentMode === value ? 'bg-white text-[#13233f] shadow-sm' : 'text-[#13233f]/50 hover:text-[#13233f]'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <input
                        type="tel"
                        placeholder="Phone number"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-[#e7ecf3] bg-white text-[#13233f] placeholder-[#1a2b4a]/35 focus:outline-none focus:border-[#3468bd] focus:ring-4 focus:ring-[#3468bd]/10 transition-all text-[15px]"
                        required
                        autoFocus
                    />

                    <div className="flex rounded-2xl overflow-hidden border border-[#e7ecf3] bg-white focus-within:border-[#3468bd] focus-within:ring-4 focus-within:ring-[#3468bd]/10 transition-all">
                        <div className="flex items-center px-4 bg-[#f6f8fb] text-[#13233f] font-medium text-[15px] border-r border-[#e7ecf3]">
                            {prefix}
                        </div>
                        <input
                            type="text"
                            placeholder="Your name"
                            value={dvmName1}
                            onChange={(e) => setDvmName1(e.target.value)}
                            className="flex-1 min-w-0 px-4 py-3 bg-transparent text-[#13233f] placeholder-[#1a2b4a]/35 focus:outline-none text-[15px]"
                            required
                        />
                    </div>

                    <p className="text-[12px] text-[#1a2b4a]/55">
                        This appears as <span className="font-medium text-[#13233f]">{prefix} {dvmName1 || 'Your Name'}</span> on reports and can't be changed.
                    </p>

                    <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#f6f8fb] border border-[#e7ecf3] cursor-pointer hover:border-[#d6e3f7] transition-colors">
                        <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[#3468bd] cursor-pointer"
                        />
                        <span className="text-[#1a2b4a]/75 text-[13px] leading-snug">
                            I agree to the{' '}
                            <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-[#3468bd] hover:text-[#13233f] underline underline-offset-2">
                                Terms of Service
                            </Link>{' '}
                            and{' '}
                            <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#3468bd] hover:text-[#13233f] underline underline-offset-2">
                                Privacy Policy
                            </Link>
                            .
                        </span>
                    </label>

                    {error && (
                        <p className="text-[#d64545] text-[13px] text-center bg-[#fff6f6] border border-[#f6d5d5] rounded-2xl py-2 px-3">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting || !phoneNumber.trim() || !dvmName1.trim() || !acceptedTerms}
                        className="w-full py-3.5 bg-[#3468bd] text-white font-medium rounded-full hover:bg-[#2a5298] shadow-[0_10px_30px_-12px_rgba(52,104,189,0.6)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed text-[15px]"
                    >
                        {isSubmitting ? 'Saving...' : 'Continue'}
                    </button>
                </form>
            </div>
        </OnboardingLayout>
    );
};

export default CongratsStep;
