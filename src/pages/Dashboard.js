// src/pages/Dashboard.js
// src/pages/Dashboard.js

import React, { useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useAuth0 } from "@auth0/auth0-react";
import ReportForm from '../components/ReportForm';
import SavedReports from '../components/SavedReports';
import Profile from '../components/Profile';
import '../styles/Dashboard.css';

const Dashboard = () => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const { logout } = useAuth0();
    const navigate = useNavigate();

    const toggleSidebar = () => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    };

    const handleLogout = () => {
        logout({
            logoutParams: {
                returnTo: `${window.location.origin}/`
            }
        });
    };

    return (
        <div className={`dashboard-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <aside className="sidebar">

                <div className="sidebar-logo">
                    <Link to="/dashboard">PetWise</Link>
                </div>
                <button className="sidebar-toggle" onClick={toggleSidebar}>
                    {isSidebarCollapsed ? '>' : '<'}
                </button>
                <ul className="sidebar-menu">

                    <li className="sidebar-item">
                        <Link to="/dashboard/report-form">Report Generator</Link>
                    </li>
                    <li className="sidebar-item">
                        <Link to="/dashboard/saved-reports">Saved Reports</Link>
                    </li>
                    <li className="sidebar-item">
                        <Link to="/dashboard/profile">Profile</Link>
                    </li>
                    <li className="sidebar-item">
                        <button onClick={handleLogout} className="sidebar-link logout-button">Logout</button>
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
