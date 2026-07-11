import React, { useState, useEffect } from 'react';
import '../styles/InstallPrompt.css';

// User-invoked install instructions overlay (opened from the mobile Profile's
// "Get the App" row). Formerly a hard gate — now always dismissible via onClose.
const InstallPrompt = ({ onClose }) => {
  // Check for early-captured prompt from index.html
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.deferredInstallPrompt || null);

  // Detect platform
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isIOSSafari = isIOS && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);
  const isIOSChrome = isIOS && /CriOS/.test(navigator.userAgent);
  const isIOSOtherBrowser = isIOS && !isIOSSafari && !isIOSChrome;
  const isAndroid = /Android/.test(navigator.userAgent);

  useEffect(() => {
    if (isIOS) return;

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
      if (onClose) onClose();
    };

    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [isIOS, deferredPrompt, onClose]);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    window.deferredInstallPrompt = null;

    if (outcome === 'accepted' && onClose) {
      onClose();
    }
  };

  const closeButtons = (
    <>
      <button onClick={onClose} className="install-gate-close" aria-label="Close">✕</button>
      <button onClick={onClose} className="install-gate-later">Maybe later</button>
    </>
  );

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
          {closeButtons}
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

          <p className="install-gate-footer">Must be opened in <strong>Safari</strong> — if you're in the Instagram or Facebook browser, open Safari and go to <strong>app.petwise.vet</strong></p>
          {closeButtons}
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

          <p className="install-gate-footer">Must be opened in a web browser like <strong>Chrome</strong> — if you're in the Instagram or Facebook browser, open Chrome and go to <strong>app.petwise.vet</strong></p>
          {closeButtons}
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

        <p className="install-gate-footer">Must be opened in a web browser like <strong>Safari</strong> or <strong>Chrome</strong> — not the Instagram or Facebook browser</p>
        {closeButtons}
      </div>
    </div>
  );
};

export default InstallPrompt;
