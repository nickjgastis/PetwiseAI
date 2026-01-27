import { useState, useEffect, useCallback } from 'react';

const CHECK_INTERVAL = 60000; // Check every 60 seconds for new deployments

export const useVersionCheck = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);

  const checkForUpdate = useCallback(async () => {
    try {
      // Cache-bust the request
      const res = await fetch(`/version.json?t=${Date.now()}`);
      if (!res.ok) return;
      
      const { version } = await res.json();
      
      if (!currentVersion) {
        // First load - store the version
        setCurrentVersion(version);
        return;
      }
      
      if (version !== currentVersion) {
        console.log('[Version] Update available:', currentVersion, '->', version);
        setUpdateAvailable(true);
      }
    } catch (err) {
      // Silent fail - don't spam console
    }
  }, [currentVersion]);

  useEffect(() => {
    // Initial check after a short delay (let app settle)
    const initialTimeout = setTimeout(checkForUpdate, 5000);
    
    // Periodic checks
    const interval = setInterval(checkForUpdate, CHECK_INTERVAL);
    
    // Also check when tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkForUpdate]);

  const refresh = () => {
    window.location.reload();
  };

  const dismiss = () => {
    setUpdateAvailable(false);
    // Store dismissed version to not nag again until next deploy
    if (currentVersion) {
      sessionStorage.setItem('dismissedVersion', currentVersion);
    }
  };

  return { updateAvailable, refresh, dismiss };
};
