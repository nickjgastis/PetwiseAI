// src/pages/Dashboard.js
// src/pages/Dashboard.js

import React, { useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import ReportForm from '../components/ReportForm';
import SavedReports from '../components/SavedReports';
import Profile from '../components/Profile';
import '../styles/Dashboard.css';

const Dashboard = () => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    };

    return (
        <div className={`dashboard-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <aside className="sidebar">
                <button className="sidebar-toggle" onClick={toggleSidebar}>
                    {isSidebarCollapsed ? '>' : '<'}
                </button>
                <ul className="sidebar-menu">
                    <li className="sidebar-item">
                        <Link to="report-form">Report Generator</Link>
                    </li>
                    {/* <li className="sidebar-item">
                        <Link to="saved-reports">Saved Reports</Link>
                    </li> */}
                    <li className="sidebar-item">
                        <Link to="profile">Profile</Link>
                    </li>
                </ul>
            </aside>

            <main className="main-content">
                <Routes>
                    <Route path="report-form" element={<ReportForm />} />
                    <Route path="saved-reports" element={<SavedReports />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="/" element={<ReportForm />} />
                </Routes>
            </main>
        </div>
    );
};

export default Dashboard;
