import React, { useState, useEffect } from 'react';
import '../styles/InstallPrompt.css';

// Check conditions synchronously to avoid flash
const getInitialGateState = () => {
  // Detect mobile vs desktop
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                        (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
  
  // If not mobile, never show gate
  if (!isMobileDevice) return false;
  
  // Check if already running as installed PWA
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;
  
  // If installed, don't show gate
  if (isStandalone) return false;
  
  // Mobile + not installed = show gate
  return true;
};

const InstallPrompt = () => {
  // Initialize state synchronously to avoid flash
  const [showGate, setShowGate] = useState(getInitialGateState);
  const [isIOS, setIsIOS] = useState(() => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // If gate shouldn't show, nothing to do
    if (!showGate) return;

    // For Android/Chrome, capture the install prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for successful install
    const handleInstalled = () => {
      setShowGate(false);
      setDeferredPrompt(null);
    };
    
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [showGate]);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowGate(false);
    }
    
    setDeferredPrompt(null);
  };

  // Don't render anything on desktop or if already installed
  if (!showGate) return null;

  return (
    <div className="install-gate">
      <div className="install-gate-content">
        <img src="/apple-touch-icon.png" alt="PetWise" className="install-gate-icon" />
        <h1>Install PetWise</h1>
        <p>For the best experience, please install PetWise to your home screen.</p>
        
        {isIOS ? (
          // iOS Instructions
          <div className="ios-install-instructions">
            <p className="instruction-label">To install:</p>
            <ol className="ios-steps">
              <li>
                Tap the <strong>Share</strong> button 
                <span className="share-icon">⬆</span>
                in Safari's toolbar
              </li>
              <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
              <li>Tap <strong>"Add"</strong> in the top right</li>
              <li>Open PetWise from your home screen</li>
            </ol>
          </div>
        ) : (
          // Android - show install button if prompt available
          <div className="android-install">
            {deferredPrompt ? (
              <button onClick={handleAndroidInstall} className="install-gate-btn">
                Install Now
              </button>
            ) : (
              <div className="android-fallback">
                <p className="instruction-label">To install:</p>
                <ol className="ios-steps">
                  <li>Tap the <strong>menu</strong> (⋮) in Chrome</li>
                  <li>Tap <strong>"Add to Home screen"</strong></li>
                  <li>Tap <strong>"Add"</strong> to confirm</li>
                  <li>Open PetWise from your home screen</li>
                </ol>
              </div>
            )}
          </div>
        )}

        <div className="install-gate-footer">
          <img src="/web-app-manifest-192x192.png" alt="" className="footer-icon" />
          <span>PetWise works best as an installed app</span>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
