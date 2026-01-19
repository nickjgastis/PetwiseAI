import React, { useState, useEffect } from 'react';
import '../styles/InstallPrompt.css';

const InstallPrompt = () => {
  const [showGate, setShowGate] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Detect mobile vs desktop
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                          (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
    
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true;
    
    // Debug logging - remove after testing
    console.log('[PWA Gate] Mobile:', isMobileDevice, 'Standalone:', isStandalone, 'UserAgent:', navigator.userAgent.substring(0, 50));
    
    // If not mobile, never show anything
    if (!isMobileDevice) {
      console.log('[PWA Gate] Not mobile, hiding gate');
      setShowGate(false);
      return;
    }

    // Check if already running as installed PWA
    // If installed, don't show gate
    if (isStandalone) {
      console.log('[PWA Gate] Already standalone, hiding gate');
      setShowGate(false);
      return;
    }

    // Mobile + not installed = show gate
    console.log('[PWA Gate] Showing gate');
    setShowGate(true);

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // For Android/Chrome, capture the install prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setShowGate(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

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
