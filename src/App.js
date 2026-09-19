// src/App.js

import React, { useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import AppRoutes from './routes';
import Navbar from './components/Navbar';
import UpdateBanner from './components/UpdateBanner';
import { supabase, bindSupabaseAccessToken } from './supabaseClient';
import { trackCompleteRegistration } from './utils/pixelEvents';
import "./styles/global.css";

const AppContent = () => {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const location = useLocation();

  // Every supabase.from() call now goes to /api/db with this access token.
  // Auth0 stays the identity provider; the API uses the service role.
  useEffect(() => {
    bindSupabaseAccessToken(async () => {
      if (!isAuthenticated) return null;
      return getAccessTokenSilently();
    });
  }, [isAuthenticated, getAccessTokenSilently]);

  // Hide navbar on login/callback routes and admin
  const hideNavbar = ['/login', '/signup', '/callback', '/refresh', '/admin', '/introduction'].includes(location.pathname) ||
    location.pathname.startsWith('/vets') ||
    (!isAuthenticated && location.pathname === '/');

  // SPA PageViews. First load is already tracked in index.html.
  const pixelPath = useRef(location.pathname);
  useEffect(() => {
    if (pixelPath.current === location.pathname) return;
    pixelPath.current = location.pathname;
    window.fbq?.('track', 'PageView');
  }, [location.pathname]);

  // Add this alongside your Meta Pixel tracking
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;

    const handleRouteChange = () => {
      if (window.gtag) {
        window.gtag('event', 'page_view', {
          page_location: window.location.href,
          page_path: window.location.pathname,
          page_title: document.title
        });
      }
    };

    // Track route changes
    window.addEventListener('popstate', handleRouteChange);

    // Also track on first load
    handleRouteChange();

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

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
              nickname: user.nickname || user.name,
              email: user.email,
              email_opt_out: false
            }]);

          // Handle potential insert error
          if (insertError) {
            console.error("Error creating user:", insertError);
          } else {
            console.log("User created successfully:", newUser);
            trackCompleteRegistration(user.sub);
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
      {!hideNavbar && <Navbar />}
      <AppRoutes />
      <UpdateBanner />
    </div>
  );
};

const App = () => {
  const navigate = useNavigate();
  const onRedirectCallback = useCallback((appState) => {
    navigate(appState?.returnTo || '/dashboard', { replace: true });
  }, [navigate]);

  return (
    <Auth0Provider
      domain={process.env.REACT_APP_AUTH0_DOMAIN}
      clientId={process.env.REACT_APP_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: process.env.NODE_ENV === 'production'
          ? 'https://app.petwise.vet/callback'
          : window.location.origin + '/callback',
        scope: "openid profile email"
      }}
      onRedirectCallback={onRedirectCallback}
      cacheLocation="localstorage"
      useRefreshTokens={true}
      useRefreshTokensFallback={true}
    >
      <AppContent />
    </Auth0Provider>
  );
};

export default App;
