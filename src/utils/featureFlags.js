// ================ FEATURE FLAGS ================

// Trial mode controls how new users start their free trial:
//   'legacy' - 14-day in-house trial, no credit card required
//   'stripe' - 14-day Stripe trial, credit card required, auto-renews to monthly
//
// Keep both code paths intact so we can flip back by changing this value.
// Server has a matching TRIAL_MODE env var (defaults to 'legacy').
export const TRIAL_MODE = 'legacy';
