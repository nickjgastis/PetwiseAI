// src/App.js

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import AppRoutes from './routes';
import Navbar from './components/Navbar';
import { supabase } from './supabaseClient';
import "./styles/global.css";

const AppContent = () => {
  const { user, isAuthenticated, isLoading } = useAuth0();

  useEffect(() => {
    const checkOrCreateUser = async () => {
      if (isLoading || !isAuthenticated || !user) return;

      try {
        // Check if user exists
        const { data: existingUser, error: fetchError } = await supabase
          .from('users')
          .select('id, auth0_user_id')
          .eq('auth0_user_id', user.sub)
          .single();

        // Handle potential fetch error
        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error("Error checking user:", fetchError);
          return;
        }

        // If user doesn't exist, create them
        if (!existingUser) {
          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{
              auth0_user_id: user.sub,
              nickname: user.nickname // Send the nickname from Auth0
            }]);

          // Handle potential insert error
          if (insertError) {
            console.error("Error creating user:", insertError);
          } else {
            // User created successfully, no redirection
            console.log("User created successfully:", newUser);
          }
        } else {

        }
      } catch (error) {
        console.error("Unexpected error:", error);
      }
    };

    checkOrCreateUser();
  }, [isAuthenticated, isLoading, user]);

  // if (isLoading) return <div></div>;

  return (
    <div>
      <Navbar />
      <AppRoutes />
    </div>
  );
};

const App = () => {
  const navigate = useNavigate();

  return (
    <Auth0Provider
      domain={process.env.REACT_APP_AUTH0_DOMAIN}
      clientId={process.env.REACT_APP_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: process.env.NODE_ENV === 'production'
          ? 'https://www.petwise.vet'
          : window.location.origin,
        scope: "openid profile email"
      }}
      onRedirectCallback={(appState) => {
        const targetUrl = appState?.returnTo || '/dashboard';
        navigate(targetUrl);
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      <AppContent />
    </Auth0Provider>
  );
};

export default App;
