// src/routes.js

import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth0 } from "@auth0/auth0-react";
import HomePage from './pages/HomePage';  // Make sure this import matches your file name
import Dashboard from './pages/Dashboard';
import Blog from './pages/Blog';
import PrivateRoute from './components/PrivateRoute';
import AboutPage from './pages/AboutPage';
import ProductPage from './pages/ProductPage';
import Profile from './components/Profile';
import PrivacyPolicy from './components/PrivacyPolicy';
import Terms from './components/Terms';
import Help from './components/Help';
import AdminDashboard from './components/AdminDashboard';
import AutoLogin from './components/AutoLogin';

const AppRoutes = () => {
    const { isLoading, isAuthenticated, user } = useAuth0();
    const location = useLocation();

    // Check if the current user is an admin (you)
    const isAdmin = user?.sub === process.env.REACT_APP_ADMIN_USER_ID;

    // Add debugging console logs
    useEffect(() => {
        if (location.pathname === '/admin') {
            console.log('Admin route accessed');
            console.log('User sub:', user?.sub);
            console.log('Admin ID from env:', process.env.REACT_APP_ADMIN_USER_ID);
            console.log('Is admin?', isAdmin);
            console.log('User authenticated?', isAuthenticated);
        }
    }, [location, user, isAdmin, isAuthenticated]);

    useEffect(() => {
        // console.log('Route changed to:', location.pathname);
        // // Check if something is preventing scroll
        // console.log('Current scroll position:', window.pageYOffset);
        // console.log('Body overflow:', document.body.style.overflow);
        // console.log('HTML overflow:', document.documentElement.style.overflow);
    }, [location]);

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <Routes>
            <Route
                path="/"
                element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
            />
            <Route path="/login" element={<AutoLogin />} />
            <Route path="/callback" element={<div>Processing login...</div>} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/product" element={<ProductPage />} />
            <Route
                path="/dashboard/*"
                element={
                    <PrivateRoute>
                        <Dashboard />
                    </PrivateRoute>
                }
            />
            <Route
                path="/profile"
                element={
                    <PrivateRoute>
                        <Profile />
                    </PrivateRoute>
                }
            />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/help" element={<Help />} />
            <Route
                path="/admin"
                element={
                    isAdmin ? (
                        <AdminDashboard />
                    ) : (
                        <Navigate to="/dashboard" replace />
                    )
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
