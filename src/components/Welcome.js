import React, { useState } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../supabaseClient';
import '../styles/Welcome.css';

const Welcome = ({ onComplete }) => {
    const [dvmName1, setDvmName1] = useState('');
    const [dvmName2, setDvmName2] = useState('');
    const [error, setError] = useState('');
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
        <div className="welcome-container">
            <div className="welcome-content">
                <img src="/PW.png" alt="PetWise Logo" className="welcome-logo" />
                <h1>Welcome to PetWise!</h1>
                <p className="welcome-description">Please enter your name as you'd like it to appear on reports.</p>
                <p className="permanent-notice">This will be permanently displayed as "Dr. [Your Name]" on all reports and cannot be changed later.</p>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Your Name:</label>
                        <div className="input-prefix">
                            <span>Dr.</span>
                            <input
                                type="text"
                                placeholder="Enter your name"
                                value={dvmName1}
                                onChange={(e) => setDvmName1(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Confirm Your Name:</label>
                        <div className="input-prefix">
                            <span>Dr.</span>
                            <input
                                type="text"
                                placeholder="Confirm your name"
                                value={dvmName2}
                                onChange={(e) => setDvmName2(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    {error && <div className="error-message">{error}</div>}
                    <button type="submit">Continue</button>
                </form>
            </div>
        </div>
    );
};

export default Welcome; 