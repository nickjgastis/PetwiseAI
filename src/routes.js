// src/routes.js

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth0 } from "@auth0/auth0-react";
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import AdminDashboard from './components/AdminDashboard';
import AutoLogin from './components/AutoLogin';
import PWALogin from './components/PWALogin';
import Callback from './pages/Callback';
import Refresh from './pages/Refresh';
import { SITE_PAGES, SITE_REDIRECTS, findSitePage } from './site/routes';
import { LAZY_PAGES } from './site/lazyPages';
import LoadingScreen from './components/LoadingScreen';

// Public marketing / campaign landing pages — code-split so they don't bloat
// the authenticated app bundle.
const VetsLanding = lazy(() => import('./pages/landing/VetsLanding'));
const VetsNextLanding = lazy(() => import('./pages/landing/VetsNextLanding'));
const VetsDemoWalkthrough = lazy(() => import('./pages/landing/VetsDemoWalkthrough'));
const VetsSoapDemo = lazy(() => import('./pages/landing/VetsDemoWalkthrough').then((m) => ({ default: m.VetsSoapDemo })));
const VetsPetQueryDemo = lazy(() => import('./pages/landing/VetsDemoWalkthrough').then((m) => ({ default: m.VetsPetQueryDemo })));
const IntroductionLanding = lazy(() => import('./pages/landing/IntroductionLanding'));

// Check if running as installed PWA
const isStandalone = () => {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
};

// app.petwise.vet and the installed PWA keep "/" as the login / dashboard entry.
const isAppHost = () => window.location.hostname.startsWith('app.');

const AppRoutes = () => {
    const { isLoading, isAuthenticated } = useAuth0();
    const location = useLocation();
    
    // Check if running as PWA
    const isPWA = isStandalone();
    const rootIsApp = isPWA || isAppHost();

    const sitePage = findSitePage(location.pathname);
    const isSiteRoute = Boolean(sitePage) && !(sitePage.path === '/' && rootIsApp);

    if (isLoading && !isSiteRoute) {
        return (
            <LoadingScreen />
        );
    }

    return (
        <Routes>
            {SITE_PAGES.filter((p) => !(p.path === '/' && rootIsApp)).map(({ path, page }) => {
                const Page = LAZY_PAGES[page];
                return (
                    <Route
                        key={path}
                        path={path}
                        element={
                            <Suspense fallback={null}>
                                <Page />
                            </Suspense>
                        }
                    />
                );
            })}
            {Object.entries(SITE_REDIRECTS).map(([from, to]) => (
                <Route key={from} path={from} element={<Navigate to={to} replace />} />
            ))}
            {rootIsApp && (
                <Route
                    path="/"
                    element={
                        isAuthenticated ? (
                            <Navigate to="/dashboard" replace />
                        ) : (
                            isPWA ? <PWALogin /> : <AutoLogin />
                        )
                    }
                />
            )}
            <Route path="/login" element={isPWA ? <PWALogin /> : <AutoLogin />} />
            <Route path="/signup" element={isPWA ? <PWALogin /> : <AutoLogin mode="signup" />} />
            <Route path="/callback" element={<Callback />} />
            <Route path="/refresh" element={<Refresh />} />
            <Route path="/vets" element={<Suspense fallback={<div className="min-h-screen bg-[#f7f4ee]" />}><VetsLanding /></Suspense>} />
            <Route path="/vets/next" element={<Suspense fallback={<div className="min-h-screen bg-[#f7f4ee]" />}><VetsNextLanding /></Suspense>} />
            <Route path="/vets/demo" element={<Suspense fallback={<div className="min-h-screen bg-[#f5f7fb]" />}><VetsDemoWalkthrough /></Suspense>} />
            <Route path="/vets/demo/soap" element={<Suspense fallback={<div className="min-h-screen bg-[#f5f7fb]" />}><VetsSoapDemo /></Suspense>} />
            <Route path="/vets/demo/petquery" element={<Suspense fallback={<div className="min-h-screen bg-[#f5f7fb]" />}><VetsPetQueryDemo /></Suspense>} />
            <Route path="/vets/petquery" element={<Navigate to="/vets/demo/petquery" replace />} />
            <Route path="/vets/quicksoap" element={<Navigate to="/vets/demo/soap" replace />} />
            <Route path="/introduction" element={<Suspense fallback={<div className="min-h-screen bg-[#f7f8fb]" />}><IntroductionLanding /></Suspense>} />
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
                element={<Navigate to="/dashboard/profile" replace />}
            />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route
                path="*"
                element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />}
            />
        </Routes>
    );
};

export default AppRoutes;
