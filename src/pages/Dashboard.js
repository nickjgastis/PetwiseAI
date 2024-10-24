// src/pages/Dashboard.js
// src/pages/Dashboard.js

import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import ReportForm from '../components/ReportForm';
import SavedReports from '../components/SavedReports';
import '../styles/Dashboard.css';

const Dashboard = () => {
    return (
        <div className="dashboard-container">
            <aside className="sidebar">
                <ul className="sidebar-menu">
                    <li className="sidebar-item">
                        <Link to="report-form">Report Generator</Link>
                    </li>
                    <li className="sidebar-item">
                        <Link to="saved-reports">Saved Reports</Link>
                    </li>
                    <li className="sidebar-item">Account Settings</li>
                    <li className="sidebar-item">Sign Out</li>
                </ul>
            </aside>

            <main className="main-content">
                <Routes>
                    <Route path="report-form" element={<ReportForm />} />
                    <Route path="saved-reports" element={<SavedReports />} />
                    <Route path="/" element={<ReportForm />} />
                </Routes>
            </main>
        </div>
    );
};

export default Dashboard;
