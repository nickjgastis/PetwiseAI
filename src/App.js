// src/App.js

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import AppRoutes from './routes';
import Navbar from './components/Navbar';
import "./styles/global.css";

const AppContent = () => {
  const { user, isAuthenticated, isLoading } = useAuth0();

  React.useEffect(() => {
    if (isAuthenticated && user) {
      console.log("Auth0 User Information:");
      console.log("User.SUB:", user.sub);
      console.log("Email:", user.email);
      console.log("Name:", user.name);
      console.log("Full User Object:", user);
    }
  }, [isAuthenticated, user]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <Navbar />
      <AppRoutes />
    </div>
  );
};

const App = () => {
  const navigate = useNavigate();

  const onRedirectCallback = (appState) => {
    navigate(appState?.returnTo || '/dashboard');
  };

  return (
    <Auth0Provider
      domain={process.env.REACT_APP_AUTH0_DOMAIN}
      clientId={process.env.REACT_APP_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin
      }}
      onRedirectCallback={onRedirectCallback}
    >
      <AppContent />
    </Auth0Provider>
  );
};

export default App;
