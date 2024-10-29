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

      // console.log(user)

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
            // console.log("User created successfully:", newUser);

            // Fetch the newly created user
            const { data: createdUser, error: fetchCreatedUserError } = await supabase
              .from('users')
              .select('id, auth0_user_id, nickname')
              .eq('auth0_user_id', user.sub)
              .single();

            if (fetchCreatedUserError) {
              console.error("Error fetching created user:", fetchCreatedUserError);
            } else {
              // console.log("Created User:", createdUser);
            }
            return; // Exit after creating and fetching the user
          }
        }

        // Log the existing user
        // console.log("User already exists:", existingUser);
      } catch (error) {
        console.error("Unexpected error:", error);
      }
    };

    checkOrCreateUser();
  }, [isAuthenticated, isLoading, user]);

  if (isLoading) return <div>Loading...</div>;

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
        redirect_uri: window.location.origin,
        scope: "openid profile email"
      }}
      onRedirectCallback={(appState) => navigate(appState?.returnTo || '/dashboard')}
    >
      <AppContent />
    </Auth0Provider>
  );
};

export default App;
