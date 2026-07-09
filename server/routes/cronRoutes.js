const express = require('express');
const router = express.Router();

// All previous cron jobs were trial reminder emails (legacy + Stripe trials).
// Trials were replaced by the free tier, so there are currently no scheduled
// jobs. The router is kept mounted at /cron for future jobs — reuse this auth
// guard for any new ones (Vercel sends: Authorization: Bearer <CRON_SECRET>).
function verifyCronAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    // In development, allow requests without auth
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
}

module.exports = router;
module.exports.verifyCronAuth = verifyCronAuth;
