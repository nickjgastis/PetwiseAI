// src/routes.js

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth0 } from "@auth0/auth0-react";
import HomePage from './pages/HomePage';  // Make sure this import matches your file name
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import AboutPage from './pages/AboutPage';

const AppRoutes = () => {
    const { isLoading, isAuthenticated } = useAuth0();

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <Routes>
            <Route
                path="/"
                element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <HomePage />}
            />
            <Route path="/about" element={<AboutPage />} />
            <Route
                path="/dashboard/*"
                element={
                    <PrivateRoute>
                        <Dashboard />
                    </PrivateRoute>
                }
            />
            <Route
                path="*"
                element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />}
            />
        </Routes>
    );
};

export default AppRoutes;
