import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import '../styles/InstallPrompt.css';

// Check conditions synchronously to avoid flash
const getInitialGateState = () => {
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

const InstallPrompt = () => {
  const { logout } = useAuth0();
  const [showGate] = useState(getInitialGateState);
  // Check for early-captured prompt from index.html
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.deferredInstallPrompt || null);

  const handleLogout = () => {
    localStorage.removeItem('auth0.is.authenticated');
    logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  };

  // Detect platform
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isIOSSafari = isIOS && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);
  const isIOSChrome = isIOS && /CriOS/.test(navigator.userAgent);
  const isIOSOtherBrowser = isIOS && !isIOSSafari && !isIOSChrome;
  const isAndroid = /Android/.test(navigator.userAgent);

  useEffect(() => {
    if (!showGate || isIOS) return;

    // Check again for early-captured prompt (in case it was captured after initial state)
    if (window.deferredInstallPrompt && !deferredPrompt) {
      setDeferredPrompt(window.deferredInstallPrompt);
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      window.deferredInstallPrompt = e; // Store globally too
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const handleInstalled = () => {
      setDeferredPrompt(null);
      window.deferredInstallPrompt = null;
      window.location.reload(); // Reload to exit gate
    };

    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [showGate, isIOS, deferredPrompt]);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      window.location.reload();
    }

    setDeferredPrompt(null);
    window.deferredInstallPrompt = null;
  };

  if (!showGate) return null;

  // iOS but NOT Safari - tell them to open in Safari
  if (isIOSChrome || isIOSOtherBrowser) {
    return (
      <div className="install-gate">
        <div className="install-gate-content">
          <img src="/apple-touch-icon.png" alt="PetWise" className="install-gate-icon" />
          <h1>Open in Safari</h1>
          <p>To install PetWise, you need to open this page in Safari</p>

          <div className="install-steps">
            <div className="install-step">
              <span className="step-number">1</span>
              <span className="step-text">Copy this URL: <strong>app.petwise.vet</strong></span>
            </div>
            <div className="install-step">
              <span className="step-number">2</span>
              <span className="step-text">Open <strong>Safari</strong> and paste the URL</span>
            </div>
            <div className="install-step">
              <span className="step-number">3</span>
              <span className="step-text">Follow the install instructions there</span>
            </div>
          </div>

          <p className="install-gate-footer">Only Safari supports app installation on iOS</p>
          <button onClick={handleLogout} className="install-gate-logout">Log Out</button>
        </div>
      </div>
    );
  }

  // iOS Safari - show Add to Home Screen instructions
  if (isIOSSafari || isIOS) {
    return (
      <div className="install-gate">
        <div className="install-gate-content">
          <img src="/apple-touch-icon.png" alt="PetWise" className="install-gate-icon" />
          <h1>Get the PetWise App</h1>
          <p>Install PetWise on your device for the best experience</p>

          <div className="install-steps">
            <div className="install-step">
              <span className="step-number">1</span>
              <span className="step-text">
                Tap the share button
                <span className="share-icon-inline">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                  </svg>
                </span>
                below
              </span>
            </div>
            <div className="install-step">
              <span className="step-number">2</span>
              <span className="step-text">Tap <strong>"Add to Home Screen"</strong></span>
            </div>
            <div className="install-step">
              <span className="step-number">3</span>
              <span className="step-text">Open PetWise from your home screen</span>
            </div>
          </div>

          <p className="install-gate-footer">Works offline • Fast • Secure</p>
          <button onClick={handleLogout} className="install-gate-logout">Log Out</button>
        </div>
      </div>
    );
  }

  // Android
  if (isAndroid) {
    return (
      <div className="install-gate">
        <div className="install-gate-content">
          <img src="/apple-touch-icon.png" alt="PetWise" className="install-gate-icon" />
          <h1>Get the PetWise App</h1>
          <p>Install PetWise on your device for the best experience</p>

          <div className="install-steps">
            {deferredPrompt ? (
              <button onClick={handleAndroidInstall} className="install-gate-btn">
                Install App
              </button>
            ) : (
              <>
                <div className="install-step">
                  <span className="step-number">1</span>
                  <span className="step-text">
                    Tap the menu
                    <span className="menu-icon-inline">⋮</span>
                    in your browser
                  </span>
                </div>
                <div className="install-step">
                  <span className="step-number">2</span>
                  <span className="step-text">Tap <strong>"Add to Home screen"</strong> or <strong>"Install App"</strong></span>
                </div>
                <div className="install-step">
                  <span className="step-number">3</span>
                  <span className="step-text">Open PetWise from your home screen</span>
                </div>
              </>
            )}
          </div>

          <p className="install-gate-footer">Works offline • Fast • Secure</p>
          <button onClick={handleLogout} className="install-gate-logout">Log Out</button>
        </div>
      </div>
    );
  }

  // Fallback for other mobile browsers
  return (
    <div className="install-gate">
      <div className="install-gate-content">
        <img src="/apple-touch-icon.png" alt="PetWise" className="install-gate-icon" />
        <h1>Get the PetWise App</h1>
        <p>Install PetWise on your device for the best experience</p>

        <div className="install-steps">
          <div className="install-step">
            <span className="step-number">1</span>
            <span className="step-text">Open your browser menu</span>
          </div>
          <div className="install-step">
            <span className="step-number">2</span>
            <span className="step-text">Tap <strong>"Add to Home Screen"</strong> or <strong>"Install"</strong></span>
          </div>
          <div className="install-step">
            <span className="step-number">3</span>
            <span className="step-text">Open PetWise from your home screen</span>
          </div>
        </div>

        <p className="install-gate-footer">Works offline • Fast • Secure</p>
        <button onClick={handleLogout} className="install-gate-logout">Log Out</button>
      </div>
    </div>
  );
};

export default InstallPrompt;
