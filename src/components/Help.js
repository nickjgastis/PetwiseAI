import React from 'react';
import '../styles/Help.css';

const Help = () => {
    return (
        <div className="help-container">
            <h1>Help Center</h1>
            <div className="help-sections">
                <section className="help-section">
                    <h2>Getting Started</h2>
                    <ul>
                        <li>Report Generator: Create detailed medical reports quickly</li>
                        <li>QuickMed Query: Get instant answers to medical questions</li>
                        <li>Saved Reports: Access your report history</li>
                    </ul>
                </section>

                <section className="help-section">
                    <h2>Contact Support</h2>
                    <p>Need additional help? Email us at <a href="mailto:support@petwise.vet">support@petwise.vet</a></p>
                </section>
            </div>
        </div>
    );
};

export default Help; 