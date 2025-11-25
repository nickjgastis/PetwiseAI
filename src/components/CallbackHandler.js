import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';

const CallbackHandler = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, error } = useAuth0();

  useEffect(() => {
    console.log('CallbackHandler - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'error:', error);
    
    if (error) {
      console.error('Auth0 callback error:', error);
      navigate('/', { replace: true });
      return;
    }

    if (!isLoading) {
      if (isAuthenticated) {
        console.log('Redirecting to dashboard...');
        navigate('/dashboard', { replace: true });
      } else {
        console.log('Not authenticated, redirecting to home...');
        navigate('/', { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, error, navigate]);

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Login Error</h1>
        <p>{error.message}</p>
        <button onClick={() => navigate('/', { replace: true })}>Go Home</button>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      textAlign: 'center',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column'
    }}>
      <h2>Completing login...</h2>
      <p>Please wait while we redirect you.</p>
      {isLoading && <p>Loading...</p>}
    </div>
  );
};

export default CallbackHandler;

