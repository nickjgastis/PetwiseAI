import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';

// Add error handling for root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

// Add a simple test render first to verify React works
console.log('=== REACT INIT START ===');
console.log('Root element:', rootElement);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Auth0 Domain:', process.env.REACT_APP_AUTH0_DOMAIN ? 'Set' : 'Missing');
console.log('Auth0 Client ID:', process.env.REACT_APP_AUTH0_CLIENT_ID ? 'Set' : 'Missing');

// Wrap render in try-catch for initialization errors
try {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
  console.log('=== REACT RENDER CALLED ===');
} catch (error) {
  console.error('=== RENDER ERROR ===', error);
  rootElement.innerHTML = `
    <div style="padding: 20px; text-align: center; color: red;">
      <h1>Initialization Error</h1>
      <p>${error.message}</p>
      <pre>${error.stack}</pre>
    </div>
  `;
}

reportWebVitals();
