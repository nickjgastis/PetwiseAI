const { Resend } = require('resend');

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Petwise <hello@petwise.vet>';
const APP_URL = process.env.APP_URL || 'https://app.petwise.vet';
// Always use production URL for logo so it works in email clients (they can't reach localhost)
const LOGO_URL = 'https://app.petwise.vet/PW.png';

/**
 * Send an email using Resend
 * Times out after 8 seconds to prevent serverless function timeout
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text fallback
 * @returns {Promise<{success: boolean, data?: any, error?: any}>}
 */
async function sendEmail({ to, subject, html, text }) {
    try {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Email send timed out after 8s')), 8000)
        );

        const sendPromise = resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject,
            html,
            text: text || stripHtml(html),
        });

        const { data, error } = await Promise.race([sendPromise, timeoutPromise]);

        if (error) {
            console.error('Resend error:', error);
            return { success: false, error };
        }

        console.log(`Email sent successfully to ${to}: ${subject}`);
        return { success: true, data };
    } catch (err) {
        console.error('Email send failed:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Simple HTML to text conversion for fallback
 */
function stripHtml(html) {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();
}

/**
 * Check if user has opted out of emails
 * Times out after 3 seconds to prevent hanging
 */
async function hasOptedOut(supabase, userId) {
    try {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Opt-out check timed out')), 3000)
        );
        
        const queryPromise = supabase
            .from('users')
            .select('email_opt_out')
            .eq('auth0_user_id', userId)
            .single();

        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

        if (error) {
            console.error('Error checking opt-out status:', error);
            return false; // Default to sending if we can't check
        }

        return data?.email_opt_out === true;
    } catch (err) {
        console.error('Opt-out check failed:', err);
        return false; // Default to sending on timeout/error
    }
}

// ============================================
// EMAIL TEMPLATE GENERATORS
// ============================================

/**
 * Base email wrapper with Petwise branding
 */
function emailWrapper(content, previewText = '') {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Petwise</title>
    <!--[if !mso]><!-->
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    </style>
    <!--<![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>` : ''}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <!-- Header with Logo -->
                    <tr>
                        <td align="center" style="padding: 32px 40px 24px;">
                            <img src="${LOGO_URL}" alt="Petwise" width="120" style="display: block; max-width: 120px; height: auto;">
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 0 40px 32px;">
                            ${content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px;">
                            <p style="margin: 0; font-size: 13px; color: #6b7280; text-align: center; line-height: 1.5;">
                                Questions? Reply to this email or reach out at 
                                <a href="mailto:support@petwise.vet" style="color: #3db6fd; text-decoration: none;">support@petwise.vet</a>
                            </p>
                            <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af; text-align: center;">
                                © ${new Date().getFullYear()} Petwise. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

/**
 * Primary CTA button - Light blue brand color, centered
 */
function ctaButton(text, url) {
    return `
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin: 24px 0;">
            <tr>
                <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                            <td align="center" style="background-color: #3db6fd; border-radius: 8px;">
                                <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                                    ${text}
                                </a>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>`;
}

/**
 * Welcome email - sent on account creation
 */
function generateWelcomeEmail(userName) {
    const content = `
        <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: #111827; text-align: center;">
            Welcome to PetWise! 🐾
        </h1>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            Hi there,
        </p>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            I wanted to personally welcome you to PetWise and thank you for giving the platform a try.
        </p>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            PetWise was built to help veterinarians save time on documentation while maintaining high clinical 
            quality and consistency. During your trial, you'll have full access to explore the core features 
            and see how it fits into your workflow.
        </p>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            If you have any questions as you get started, you can reach us anytime at 
            <a href="mailto:info@petwise.vet" style="color: #3db6fd; text-decoration: none;">info@petwise.vet</a>, 
            and our team will be happy to help.
        </p>
        <div style="text-align: center;">
            ${ctaButton('Get Started', `${APP_URL}/dashboard`)}
        </div>
        <p style="margin: 24px 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
            All the best,<br>
            Nick
        </p>`;

    return emailWrapper(content, 'Welcome to PetWise! Thanks for giving the platform a try.');
}

/**
 * Trial activated email - sent when trial starts
 */
function generateTrialActivatedEmail(userName, trialEndDate) {
    const displayName = userName ? `Dr. ${userName}` : 'there';
    const endDateFormatted = new Date(trialEndDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const content = `
        <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: #111827; text-align: center;">
            Your Trial Has Started! 🎉
        </h1>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            Congratulations on starting your PetWise trial!
        </p>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            You now have full access to the platform to explore how it can support your day-to-day clinical 
            documentation and reporting. Most users find it helpful to begin by running a few real cases 
            through the system to get a feel for the workflow.
        </p>
        <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; font-size: 14px; color: #166534; font-weight: 500;">
                ✓ Unlimited SOAP notes & reports<br>
                ✓ AI-powered dictation<br>
                ✓ Client callbacks & summaries<br>
                ✓ Custom templates
            </p>
        </div>
        <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
            <strong>Trial ends:</strong> ${endDateFormatted}
        </p>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            If you have any questions or would like guidance along the way, you can reach us at 
            <a href="mailto:info@petwise.vet" style="color: #3db6fd; text-decoration: none;">info@petwise.vet</a>.
        </p>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            I hope PetWise proves to be a valuable addition to your practice.
        </p>
        <div style="text-align: center;">
            ${ctaButton('Start Exploring', `${APP_URL}/dashboard`)}
        </div>
        <p style="margin: 24px 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
            All the best,<br>
            Nick
        </p>`;

    return emailWrapper(content, 'Congratulations on starting your PetWise trial! Explore the full platform now.');
}

/**
 * Subscription confirmed email - sent on paid plan purchase
 */
function generateSubscriptionConfirmedEmail(userName, planInterval, nextBillingDate) {
    const displayName = userName ? `Dr. ${userName}` : 'there';
    const planName = planInterval === 'yearly' ? 'Annual' : 'Monthly';
    const billingDateFormatted = nextBillingDate 
        ? new Date(nextBillingDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })
        : 'N/A';

    const content = `
        <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: #111827; text-align: center;">
            Welcome to Petwise Pro! 🚀
        </h1>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            Hi ${displayName},
        </p>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            Thank you for subscribing to Petwise! Your <strong>${planName} Plan</strong> is now active, and you have 
            unlimited access to all features.
        </p>
        <div style="background-color: #eff6ff; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0 0 8px; font-size: 14px; color: #1e40af;">
                <strong>Plan:</strong> ${planName} Subscription
            </p>
            <p style="margin: 0; font-size: 14px; color: #1e40af;">
                <strong>Next billing date:</strong> ${billingDateFormatted}
            </p>
        </div>
        <div style="text-align: center;">
            ${ctaButton('Get Started', `${APP_URL}/dashboard`)}
        </div>
        <p style="margin: 24px 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
            You can manage your subscription anytime from your account settings. We're here if you need anything!
        </p>`;

    return emailWrapper(content, `Your Petwise ${planName} subscription is now active!`);
}

/**
 * Trial midway reminder - sent at day 7 (one week in)
 */
function generateTrialMidwayEmail(userName, daysLeft, trialEndDate) {
    const displayName = userName ? `Dr. ${userName}` : 'there';
    const endDateFormatted = new Date(trialEndDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const content = `
        <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: #111827; text-align: center;">
            One Week In! 🎯
        </h1>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            Hi ${displayName},
        </p>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            I wanted to check in and see how your first week with PetWise has been going.
        </p>
        <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>⏰ ${daysLeft} days remaining</strong> — Trial ends ${endDateFormatted}
            </p>
        </div>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            If it's helpful, we'd be happy to invite you to a complimentary one-on-one demo with 
            <strong>Dr. Stacey Gastis</strong>. The session is about an hour, walks through real clinical 
            use cases, and includes <strong>1 hour of RACE-approved CE</strong>.
        </p>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            Many users find this session helpful for seeing how PetWise fits into real-world workflows 
            and for getting the most out of the platform during the remainder of the trial.
        </p>
        <div style="text-align: center;">
            ${ctaButton('Book a Demo Session', 'https://calendar.app.google/o8NWwhrDwnX78a1H8')}
        </div>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            If you have any questions in the meantime, please reach out to us at 
            <a href="mailto:info@petwise.vet" style="color: #3db6fd; text-decoration: none;">info@petwise.vet</a>.
        </p>
        <p style="margin: 24px 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
            All the best,<br>
            Nick
        </p>`;

    return emailWrapper(content, `One week in — book a free demo with Dr. Gastis (1hr RACE-approved CE included)`);
}

/**
 * Trial ending reminder - sent 2 days before expiry (day 12)
 */
function generateTrialEndingEmail(userName, daysLeft, trialEndDate) {
    const displayName = userName ? `Dr. ${userName}` : 'there';
    const endDateFormatted = new Date(trialEndDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const content = `
        <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: #111827; text-align: center;">
            Your Trial Ends Soon 🚀
        </h1>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            Hi there,
        </p>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            I'm checking in as your PetWise trial is nearing its end.
        </p>
        <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>⏰ ${daysLeft} days remaining</strong> — Trial ends ${endDateFormatted}
            </p>
        </div>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            If you haven't already, we'd be happy to invite you to a complimentary one-on-one demo with 
            <strong>Dr. Stacey Gastis</strong>. The session is about an hour, walks through real clinical 
            use cases, and includes <strong>1 hour of RACE-approved CE</strong>.
        </p>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            There's no obligation at all. It's simply an opportunity to make sure you're getting full value 
            from PetWise and to answer any questions you may have before your trial concludes.
        </p>
        <div style="text-align: center;">
            ${ctaButton('Book a Demo Session', 'https://calendar.app.google/o8NWwhrDwnX78a1H8')}
        </div>
        <p style="margin: 0 0 16px; font-size: 16px; color: #374151; line-height: 1.6;">
            If you have any questions, please contact us at 
            <a href="mailto:info@petwise.vet" style="color: #3db6fd; text-decoration: none;">info@petwise.vet</a>.
        </p>
        <p style="margin: 24px 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
            All the best,<br>
            Nick
        </p>`;

    return emailWrapper(content, `Your PetWise trial ends in ${daysLeft} days — book a free demo before it's over.`);
}

// ============================================
// SEND FUNCTIONS (with opt-out checking)
// ============================================

async function sendWelcomeEmail(supabase, user) {
    return sendEmail({
        to: user.email,
        subject: 'Welcome to Petwise! 🐾',
        html: generateWelcomeEmail(user.dvm_name || user.nickname || user.email),
    });
}

async function sendTrialActivatedEmail(supabase, user, trialEndDate) {
    return sendEmail({
        to: user.email,
        subject: 'Your 14-Day Petwise Trial Has Started! 🎉',
        html: generateTrialActivatedEmail(user.dvm_name || user.nickname || user.email, trialEndDate),
    });
}

async function sendSubscriptionConfirmedEmail(supabase, user, planInterval, nextBillingDate) {
    return sendEmail({
        to: user.email,
        subject: 'Welcome to Petwise Pro! 🚀',
        html: generateSubscriptionConfirmedEmail(user.dvm_name || user.nickname || user.email, planInterval, nextBillingDate),
    });
}

async function sendTrialMidwayEmail(supabase, user, daysLeft, trialEndDate) {
    return sendEmail({
        to: user.email,
        subject: `One Week In! How's Petwise working for you? 🎯`,
        html: generateTrialMidwayEmail(user.dvm_name || user.nickname || user.email, daysLeft, trialEndDate),
    });
}

async function sendTrialEndingEmail(supabase, user, daysLeft, trialEndDate) {
    return sendEmail({
        to: user.email,
        subject: `Almost 2 weeks in! Your trial ends soon 🚀`,
        html: generateTrialEndingEmail(user.dvm_name || user.nickname || user.email, daysLeft, trialEndDate),
    });
}

module.exports = {
    sendEmail,
    hasOptedOut,
    sendWelcomeEmail,
    sendTrialActivatedEmail,
    sendSubscriptionConfirmedEmail,
    sendTrialMidwayEmail,
    sendTrialEndingEmail,
    // Export template generators for testing
    generateWelcomeEmail,
    generateTrialActivatedEmail,
    generateSubscriptionConfirmedEmail,
    generateTrialMidwayEmail,
    generateTrialEndingEmail,
};
