import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { supabase } from '../../supabaseClient';
import { STEP_ORDER } from './OnboardingLayout';
import CongratsStep from './CongratsStep';
import QuizStep from './QuizStep';
import AffirmationStep from './AffirmationStep';
import BenefitsStep from './BenefitsStep';
import TestimonialStep from './TestimonialStep';
import TrialStep from './TrialStep';
import WelcomeToPetwise from '../WelcomeToPetwise';
import TermsOfService from '../TermsOfService';
import InstallPrompt from '../InstallPrompt';

// Steps in order: congrats → quiz1 → quiz2 → affirmation → benefits → testimonial → trial → welcome → terms → complete
const STEPS = ['congrats', 'quiz1', 'quiz2', 'affirmation', 'benefits', 'testimonial', 'trial', 'welcome', 'terms', 'complete'];

const OnboardingFlow = ({ onboardingData, onComplete, userData, refreshSubscription }) => {
    const { user } = useAuth0();
    const [currentStep, setCurrentStep] = useState(onboardingData?.current_step || 'congrats');
    const [quizAnswers, setQuizAnswers] = useState(onboardingData?.quiz_answers || {});

    // Detect mobile for install gate
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    // If trial step but user already has active subscription, skip to welcome
    useEffect(() => {
        if (currentStep === 'trial' && userData?.subscription_status === 'active') {
            goToStep('welcome');
        }
    }, [currentStep, userData?.subscription_status]);

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

    const nextStep = (extraData = {}) => {
        const idx = STEPS.indexOf(currentStep);
        if (idx < STEPS.length - 1) {
            const next = STEPS[idx + 1];
            goToStep(next, extraData);
        }
    };

    const prevStep = () => {
        const idx = STEPS.indexOf(currentStep);
        if (idx > 0) {
            goToStep(STEPS[idx - 1]);
        }
    };

    const handleQuizNext = (updatedAnswers) => {
        setQuizAnswers(updatedAnswers);
        nextStep({ quiz_answers: updatedAnswers });
    };

    const handleTrialActivated = () => {
        // Trial was activated via Stripe — when they come back from Stripe redirect,
        // Dashboard will re-fetch subscription and the flow will continue.
        // For student redeem or instant activation, advance to welcome.
        if (refreshSubscription) refreshSubscription();
        goToStep('welcome');
    };

    const handleWelcomeComplete = () => {
        goToStep('terms');
    };

    const handleTermsAccepted = async ({ emailOptOut }) => {
        // Mark terms accepted and onboarding complete in users table
        try {
            await supabase
                .from('users')
                .update({ 
                    has_accepted_terms: true, 
                    email_opt_out: emailOptOut,
                    has_completed_onboarding: true 
                })
                .eq('auth0_user_id', user.sub);
        } catch (err) {
            console.error('Error accepting terms:', err);
        }
        
        // Mark onboarding table as completed (this ensures they never see it again)
        goToStep('complete');

        // Check if mobile + not standalone → show install gate
        if (isMobile && !isStandalone && process.env.NODE_ENV !== 'development') {
            // Don't call onComplete yet — show install gate
            return;
        }

        // Desktop or already installed — done
        if (onComplete) onComplete();
    };

    // If step is 'complete' and on mobile browser, show install gate
    if (currentStep === 'complete') {
        if (isMobile && !isStandalone && process.env.NODE_ENV !== 'development') {
            return <InstallPrompt />;
        }
        // Desktop — should have called onComplete, but just in case
        if (onComplete) onComplete();
        return null;
    }

    // Can go back if not on the first step
    const canGoBack = STEPS.indexOf(currentStep) > 0;

    if (currentStep === 'congrats') {
        return <CongratsStep onNext={() => nextStep()} />;
    }

    if (currentStep === 'quiz1' || currentStep === 'quiz2') {
        return (
            <QuizStep 
                key={currentStep}
                step={currentStep}
                quizAnswers={quizAnswers}
                onNext={handleQuizNext}
                onBack={prevStep}
            />
        );
    }

    if (currentStep === 'affirmation') {
        return <AffirmationStep quizAnswers={quizAnswers} onNext={() => nextStep()} onBack={prevStep} />;
    }

    if (currentStep === 'benefits') {
        return <BenefitsStep onNext={() => nextStep()} onBack={prevStep} />;
    }

    if (currentStep === 'testimonial') {
        return <TestimonialStep onNext={() => nextStep()} onBack={prevStep} />;
    }

    if (currentStep === 'trial') {
        return <TrialStep user={{ ...user, sub: user.sub }} onTrialActivated={handleTrialActivated} onBack={prevStep} />;
    }

    if (currentStep === 'welcome') {
        return <WelcomeToPetwise user={user} onComplete={handleWelcomeComplete} onBack={prevStep} />;
    }

    if (currentStep === 'terms') {
        return <TermsOfService onAccept={handleTermsAccepted} onBack={prevStep} />;
    }

    return null;
};

export default OnboardingFlow;
