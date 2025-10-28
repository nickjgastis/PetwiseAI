import React, { useState } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../supabaseClient';

const Welcome = ({ onComplete }) => {
    const [dvmName1, setDvmName1] = useState('');
    const [dvmName2, setDvmName2] = useState('');
    const [error, setError] = useState('');
    const [isStudentMode, setIsStudentMode] = useState(false);
    const { user } = useAuth0();

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

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-[#3468bd] via-[#2c5aa0] to-[#1e3d72] flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg bg-white rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 animate-fade-in">
                {/* Logo */}
                <div className="flex justify-center mb-4 sm:mb-6">
                    <img src="/PW.png" alt="PetWise Logo" className="w-16 sm:w-20 lg:w-24 h-auto" />
                </div>

                {/* Header */}
                <div className="text-center mb-4 sm:mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-[#3468bd] mb-2 sm:mb-3">Welcome to PetWise!</h1>
                    <p className="text-gray-600 text-base sm:text-lg">Please enter your name as you'd like it to appear on reports.</p>
                </div>

                {/* Notice */}
                <div className="bg-blue-50 border-l-4 border-[#3468bd] p-3 sm:p-4 rounded-r-lg mb-4 sm:mb-6">
                    <p className="text-xs sm:text-sm text-gray-600 italic">
                        This will be permanently displayed as <span className="font-semibold">"{isStudentMode ? 'Student' : 'Dr.'} [Your Name]"</span> on all reports and cannot be changed later.
                    </p>
                </div>

                {/* Student Toggle */}
                <div className="flex justify-center mb-4 sm:mb-6">
                    <button
                        type="button"
                        className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm font-semibold uppercase tracking-wide transition-all duration-300 transform hover:scale-105 ${isStudentMode
                            ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30'
                            : 'bg-gradient-to-r from-[#5fb7ed] to-[#3468bd] text-white shadow-lg shadow-blue-500/30'
                            }`}
                        onClick={() => setIsStudentMode(!isStudentMode)}
                    >
                        {isStudentMode ? 'Switch to Doctor Mode' : 'Switch to Student Mode'}
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                    {/* First Name Input */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Your Name:</label>
                        <div className="flex rounded-xl border-2 border-gray-200 bg-white shadow-sm focus-within:border-[#3468bd] focus-within:ring-4 focus-within:ring-blue-100 transition-all duration-200">
                            <div className="flex items-center px-3 sm:px-4 py-2 sm:py-3 bg-[#3468bd] text-white font-semibold rounded-l-xl text-sm">
                                {isStudentMode ? 'Student' : 'Dr.'}
                            </div>
                            <input
                                type="text"
                                placeholder="Enter your name"
                                value={dvmName1}
                                onChange={(e) => setDvmName1(e.target.value)}
                                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border-0 rounded-r-xl focus:outline-none text-gray-900 placeholder-gray-400 text-sm sm:text-base"
                                required
                            />
                        </div>
                    </div>

                    {/* Confirm Name Input */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Your Name:</label>
                        <div className="flex rounded-xl border-2 border-gray-200 bg-white shadow-sm focus-within:border-[#3468bd] focus-within:ring-4 focus-within:ring-blue-100 transition-all duration-200">
                            <div className="flex items-center px-3 sm:px-4 py-2 sm:py-3 bg-[#3468bd] text-white font-semibold rounded-l-xl text-sm">
                                {isStudentMode ? 'Student' : 'Dr.'}
                            </div>
                            <input
                                type="text"
                                placeholder="Confirm your name"
                                value={dvmName2}
                                onChange={(e) => setDvmName2(e.target.value)}
                                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border-0 rounded-r-xl focus:outline-none text-gray-900 placeholder-gray-400 text-sm sm:text-base"
                                required
                            />
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-400 p-3 sm:p-4 rounded-r-lg">
                            <p className="text-xs sm:text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-[#3468bd] to-[#2c5aa0] text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 text-sm sm:text-base"
                    >
                        Continue
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Welcome; 