import { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { supabase } from '../supabaseClient';

const SubscriptionGate = ({ children }) => {
    const { user } = useAuth0();
    const [hasSubscription, setHasSubscription] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function checkSubscription() {
            if (!user) return;

            const { data, error } = await supabase
                .from('users')
                .select('subscription_status')
                .eq('auth0_user_id', user.sub)
                .single();

            if (!error && data) {
                setHasSubscription(data.subscription_status === 'active');
            }
            setLoading(false);
        }

        checkSubscription();
    }, [user]);

    if (loading) return <div>Loading...</div>;

    return hasSubscription ? children : (
        <div>
            <h3>Subscribe to access this feature</h3>
            {/* Add your subscription CTA here */}
        </div>
    );
};

export default SubscriptionGate; 