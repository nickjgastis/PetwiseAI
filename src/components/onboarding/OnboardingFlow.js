import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { supabase } from '../../supabaseClient';
import CongratsStep from './CongratsStep';
import DesktopBridgeStep from './DesktopBridgeStep';

// Active flow: congrats (name + phone + terms, all on one screen) → complete.
// New users land straight in the app on the free tier — no plan/trial step.
// Removed (kept in repo in case we want to re-add): quiz1, quiz2, affirmation,
// booking, terms, benefits, testimonial, trial, welcome.
const STEPS = ['congrats', 'complete'];

// Steps that were removed — if a user has an in-flight onboarding row on one of
// these, bounce them forward (if we already have their name) or back to congrats.
const REMOVED_STEPS = ['quiz1', 'quiz2', 'affirmation', 'booking', 'terms', 'benefits', 'testimonial', 'trial', 'welcome'];

const OnboardingFlow = ({ onboardingData, onComplete, userData, refreshSubscription }) => {
    const { user } = useAuth0();
    const [currentStep, setCurrentStep] = useState(onboardingData?.current_step || 'congrats');

    // Detect mobile for the desktop-bridge step (user agent only; forceMobile is a dev escape hatch)
    const forceMobile = process.env.NODE_ENV === 'development' && localStorage.getItem('forceMobile') === 'true';
    const isMobile = forceMobile || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Safety jump: if a user's saved current_step was removed from the flow,
    // finish onboarding if they already gave us their name, else restart congrats.
    useEffect(() => {
        if (REMOVED_STEPS.includes(currentStep)) {
            if (userData?.dvm_name) {
                markUserOnboarded();
                goToStep('complete');
            } else {
                goToStep('congrats');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveStep = async (step, extraData = {}) => {
        try {
            const updates = {
                current_step: step,
                updated_at: new Date().toISOString(),
                ...extraData
            };

            if (step === 'complete') {
                updates.status = 'completed';
                updates.completed_at = new Date().toISOString();
            }

            await supabase
                .from('onboarding')
                .update(updates)
                .eq('auth0_user_id', user.sub);
        } catch (err) {
            console.error('Error saving onboarding step:', err);
        }
    };

    const goToStep = (step, extraData = {}) => {
        setCurrentStep(step);
        saveStep(step, extraData);
        window.scrollTo(0, 0);
    };

    const markUserOnboarded = async () => {
        try {
            await supabase
                .from('users')
                .update({ has_completed_onboarding: true })
                .eq('auth0_user_id', user.sub);
        } catch (err) {
            console.error('Error marking onboarding complete:', err);
        }
    };

    // Congrats collects everything (name, phone, terms) — completing it means
    // onboarding is done and the user lands in the app on the free tier.
    const handleCongratsComplete = async () => {
        await markUserOnboarded();
        goToStep('complete');

        // Mobile users see the desktop-bridge step before landing in the app
        if (isMobile) {
            return;
        }

        if (onComplete) onComplete();
    };

    // Step 'complete': mobile users get a one-time screen explaining the
    // phone/desktop split; desktop users go straight into the app.
    if (currentStep === 'complete') {
        if (isMobile) {
            return <DesktopBridgeStep onNext={() => onComplete && onComplete()} />;
        }
        // Desktop — should have called onComplete, but just in case
        if (onComplete) onComplete();
        return null;
    }

    return <CongratsStep onNext={handleCongratsComplete} />;
};

export default OnboardingFlow;
