// Import dependencies
import React, { useState } from 'react';

// Component definition and initial state setup
const CancelSubscription = ({ user, isTrial }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Use REACT_APP_API_URL environment variable directly
    const API_URL = process.env.NODE_ENV === 'production'
        ? 'https://api.petwise.vet'
        : 'http://localhost:3001';

    // Handler for subscription cancellation
    // Includes confirmation dialog and API call
    const handleCancel = async () => {
        if (!window.confirm('Are you sure you want to cancel?')) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const endpoint = isTrial ? '/cancel-trial' : '/cancel-subscription';
            console.log('API URL:', API_URL); // Debug log
            console.log('Full URL:', `${API_URL}${endpoint}`); // Debug log

            if (!user?.sub) {
                throw new Error('User ID not found');
            }

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user.sub
                }),
                credentials: 'include' // Add this if using cookies
            });

            console.log('Response:', response); // Debug log
            const data = await response.json();
            console.log('Data:', data); // Debug log

            if (!response.ok) {
                throw new Error(data.error || `Failed to cancel: ${response.status}`);
            }

            alert(isTrial ?
                'Trial successfully canceled.' :
                'Subscription successfully canceled. You will have access until the end of your billing period.'
            );
            window.location.reload();
        } catch (err) {
            console.error('Full error:', err); // Debug log
            setError(err.message);
            alert(`Error canceling: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Component render
    // Includes button with loading state and error display
    return (
        <>
            <button
                onClick={handleCancel}
                disabled={isLoading}
                className="cancel-subscription"
            >
                {isLoading ? 'Canceling...' : `Cancel ${isTrial ? 'Trial' : 'Subscription'}`}
            </button>
            {error && <div className="error-message">{error}</div>}
        </>
    );
};

export default CancelSubscription; 