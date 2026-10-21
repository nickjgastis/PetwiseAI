import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth0 } from "@auth0/auth0-react";
import LoadingScreen from './LoadingScreen';

const PrivateRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth0();

    if (isLoading) {
        return <LoadingScreen />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default PrivateRoute;
