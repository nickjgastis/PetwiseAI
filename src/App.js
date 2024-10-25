// src/App.js

import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppRoutes from './routes';
import Navbar from './components/Navbar';
import "./styles/global.css"
import { Auth0Provider } from "@auth0/auth0-react";

const App = () => {
  const navigate = useNavigate();

  const onRedirectCallback = (appState) => {
    navigate(appState?.returnTo || '/dashboard');
  };

  return (
    <Auth0Provider
      domain="dev-78rjcaj4bc47gu84.ca.auth0.com"
      clientId="BKkSaSuXGAbtUJTTvKysSawNgAaYwKKQ"
      authorizationParams={{
        redirect_uri: window.location.origin
      }}
      onRedirectCallback={onRedirectCallback}
    >
      <div>
        <Navbar />
        <AppRoutes />
      </div>
    </Auth0Provider>
  );
};

export default App;



