// src/App.js

import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import AppRoutes from './routes';
import Navbar from './components/Navbar';
import InstallPrompt from './components/InstallPrompt';
import { supabase } from './supabaseClient';
import "./styles/global.css";

const AppContent = () => {
  const { user, isAuthenticated, isLoading } = useAuth0();
  const location = useLocation();

  // Hide navbar on login/callback routes
  const hideNavbar = ['/login', '/signup', '/callback'].includes(location.pathname) ||
    (!isAuthenticated && location.pathname === '/');

  // Add Meta Pixel tracking
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;

    // Use void to satisfy no-unused-expressions
    void function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ?
          n.callMethod.apply(n, arguments) : n.queue.push(arguments)
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s)
    }(window, document, 'script',
      'https://connect.facebook.net/en_US/fbevents.js');

    // Add window to satisfy no-undef
    window.fbq('init', '691293719968426');
    window.fbq('track', 'PageView');
  }, []);

  // Track page changes when routes change
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;

    const handleRouteChange = () => {
      if (window.fbq) {
        window.fbq('track', 'PageView');
      }
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

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
      {!hideNavbar && <Navbar />}
      <AppRoutes />
    </div>
  );
};

// Check if we should show install gate
const shouldShowInstallGate = () => {
  // DEV ONLY: Skip gate in development
  if (process.env.NODE_ENV === 'development') return false;
  
  // DEV ONLY: Allow forcing mobile view via localStorage
  const forceMobile = process.env.NODE_ENV === 'development' && localStorage.getItem('forceMobile') === 'true';
  
  // Only check user agent - don't use width to avoid triggering on split-screen desktops
  const isMobileDevice = forceMobile || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (!isMobileDevice) return false;
  
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;
  if (isStandalone) return false;
  
  return true;
};

const App = () => {
  const navigate = useNavigate();

  // Block everything when gate should show - don't even load Auth0
  if (shouldShowInstallGate()) {
    return <InstallPrompt />;
  }

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
