// ================ IMPORTS ================
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth0 } from '@auth0/auth0-react';

// ================ SUBSCRIPTION HOOK ================
export function useSubscription() {
    // ================ STATE ================
    const [timeLeft, setTimeLeft] = useState('');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState(null);
    const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
    const { user } = useAuth0();

    // ================ SUBSCRIPTION CHECK & REALTIME UPDATES ================
    useEffect(() => {
        // Check subscription status
        const checkSubscription = async () => {
            if (!user?.sub) return;

            // Query subscription data
            const { data, error } = await supabase
                .from('users')
                .select('subscription_status, subscription_end_date, cancel_at_period_end')
                .eq('auth0_user_id', user.sub)
                .single();

            if (error) {
                console.error('Subscription check error:', error);
                return;
            }

            if (data) {
                // Calculate subscription status and time remaining
                const end = new Date(data.subscription_end_date);
                const now = new Date();

                // Check if subscription is active and not expired
                const isActive = data.subscription_status === 'active' && end > now;
                setIsSubscribed(isActive);

                // Calculate days remaining
                if (isActive) {
                    const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    setTimeLeft(`${days} days`);
                } else {
                    setTimeLeft('');
                }

                // Update state
                setSubscriptionStatus(data.subscription_status);
                setCancelAtPeriodEnd(data.cancel_at_period_end);
            }
        };

        // Initial check
        checkSubscription();

        // Set up realtime subscription updates
        const subscription = supabase
            .channel('subscription-updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'users',
                filter: `auth0_user_id=eq.${user?.sub}`
            }, checkSubscription)
            .subscribe();

        // Cleanup subscription
        return () => {
            subscription.unsubscribe();
        };
    }, [user]);

    // ================ RETURN VALUES ================
    return {
        timeLeft,
        isSubscribed,
        subscriptionStatus,
        cancelAtPeriodEnd,
        isActive: isSubscribed && subscriptionStatus === 'active'
    };
}