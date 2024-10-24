// src/pages/Dashboard.js
// src/pages/Dashboard.js

import React from 'react';
import ReportForm from '../components/ReportForm';
import '../styles/Dashboard.css'; // Ensure Dashboard-specific styles

const Dashboard = () => {
    return (
        <div className="dashboard-container">
            <aside className="sidebar">

                <ul className="sidebar-menu">
                    <li className="sidebar-item">Report Generator</li>
                    <li className="sidebar-item">Account Settings</li>
                    <li className="sidebar-item">Sign Out</li>
                    {/* Add other dashboard links */}
                </ul>
            </aside>

            <main className="main-content">
                <h1>Report Generator</h1>
                <ReportForm /> {/* This is where ReportForm will appear */}
            </main>
        </div>
    );
};

export default Dashboard;
