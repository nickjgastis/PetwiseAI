import React, { useState, useEffect } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../supabaseClient';

const Welcome = ({ onComplete }) => {
    const [dvmName1, setDvmName1] = useState('');
    const [dvmName2, setDvmName2] = useState('');
    const [error, setError] = useState('');
    const [isStudentMode, setIsStudentMode] = useState(false);
    const { user } = useAuth0();

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (dvmName1 !== dvmName2) {
            setError('Names do not match. Please check spelling.');
            return;
        }

        try {
            const name = dvmName1.trim();

            const { data, error } = await supabase
                .from('users')
                .update({ dvm_name: name })
                .eq('auth0_user_id', user.sub)
                .select()
                .single();

            if (error) throw error;
            onComplete(data);
        } catch (err) {
            setError('Failed to save DVM name. Please try again.');
        }
    };

    const prefix = isStudentMode ? 'Student' : 'Dr.';
    const inputWrap = 'flex rounded-2xl overflow-hidden border border-[#e7ecf3] bg-white focus-within:border-[#3468bd] focus-within:ring-4 focus-within:ring-[#3468bd]/10 transition-all';
    const prefixClass = 'flex items-center px-4 bg-[#f6f8fb] text-[#13233f] font-medium text-[15px] border-r border-[#e7ecf3]';
    const inputClass = 'flex-1 min-w-0 px-4 py-3 bg-transparent text-[#13233f] placeholder-[#1a2b4a]/35 focus:outline-none text-[15px]';

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-[#3a72cc] via-[#2d5fb8] to-[#1e4a94] flex justify-center overflow-y-auto p-3 sm:p-4 z-50" style={{ overscrollBehavior: 'none' }}>
            <div
                className="fixed inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(60% 45% at 50% 0%, rgba(92,204,240,0.35) 0%, rgba(45,95,184,0) 70%)' }}
            />
            <div className="relative my-auto w-full max-w-md bg-white rounded-[28px] shadow-[0_40px_80px_-40px_rgba(19,35,63,0.6)] p-6 sm:p-8 animate-fade-in">
                <div className="flex justify-center mb-5">
                    <img src="/PW.png" alt="PetWise" className="w-14 sm:w-16 h-auto" />
                </div>

                <div className="text-center mb-6">
                    <h1 className="text-[1.75rem] sm:text-[2rem] font-semibold tracking-[-0.03em] text-[#13233f] mb-2">Welcome to PetWise</h1>
                    <p className="text-[#1a2b4a]/65 text-[15px] leading-relaxed">Enter your name as you'd like it to appear on reports.</p>
                </div>

                <div className="flex justify-center mb-5">
                    <div className="inline-flex rounded-full p-1 bg-[#f1f4f8]" role="group" aria-label="Account type">
                        {[['Doctor', false], ['Student', true]].map(([label, value]) => (
                            <button
                                key={label}
                                type="button"
                                onClick={() => setIsStudentMode(value)}
                                aria-pressed={isStudentMode === value}
                                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                                    isStudentMode === value ? 'bg-white text-[#13233f] shadow-sm' : 'text-[#13233f]/50 hover:text-[#13233f]'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[13px] font-medium text-[#13233f] mb-1.5">Your name</label>
                        <div className={inputWrap}>
                            <div className={prefixClass}>{prefix}</div>
                            <input
                                type="text"
                                placeholder="Enter your name"
                                value={dvmName1}
                                onChange={(e) => setDvmName1(e.target.value)}
                                className={inputClass}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[13px] font-medium text-[#13233f] mb-1.5">Confirm your name</label>
                        <div className={inputWrap}>
                            <div className={prefixClass}>{prefix}</div>
                            <input
                                type="text"
                                placeholder="Confirm your name"
                                value={dvmName2}
                                onChange={(e) => setDvmName2(e.target.value)}
                                className={inputClass}
                                required
                            />
                        </div>
                    </div>

                    <p className="text-[12px] text-[#1a2b4a]/55 bg-[#f6f8fb] border border-[#e7ecf3] rounded-2xl px-3.5 py-2.5">
                        This shows as <span className="font-medium text-[#13233f]">{prefix} [Your Name]</span> on all reports and can't be changed later.
                    </p>

                    {error && (
                        <p className="text-[#d64545] text-[13px] bg-[#fff6f6] border border-[#f6d5d5] rounded-2xl px-3.5 py-2.5">{error}</p>
                    )}

                    <button
                        type="submit"
                        className="w-full py-3.5 bg-[#3468bd] text-white font-medium rounded-full hover:bg-[#2a5298] shadow-[0_10px_30px_-12px_rgba(52,104,189,0.6)] transition-all duration-200 text-[15px]"
                    >
                        Continue
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Welcome; 