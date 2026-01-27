import React from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';

const UpdateBanner = () => {
  const { updateAvailable, refresh, dismiss } = useVersionCheck();

  if (!updateAvailable) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#3369bd',
      color: '#fff',
      padding: '12px 20px',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      zIndex: 10000,
      fontFamily: 'inherit',
      fontSize: '14px',
      maxWidth: '90vw',
      animation: 'slideUp 0.3s ease-out'
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(100px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>
      
      <span>New update available!</span>
      
      <button
        onClick={refresh}
        style={{
          backgroundColor: '#5cccf0',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: '600',
          fontSize: '13px',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => e.target.style.backgroundColor = '#4ab8dc'}
        onMouseOut={(e) => e.target.style.backgroundColor = '#5cccf0'}
      >
        Refresh
      </button>
      
      <button
        onClick={dismiss}
        style={{
          backgroundColor: 'transparent',
          color: 'rgba(255,255,255,0.7)',
          border: 'none',
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: '18px',
          lineHeight: '1'
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
};

export default UpdateBanner;
