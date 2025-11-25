// Vercel serverless function wrapper for Express app
const app = require('../server/server');

// Export the Express app directly - Vercel will handle it as a serverless function
module.exports = app;

