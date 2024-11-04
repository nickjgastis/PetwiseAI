// // server.js
// require('dotenv').config();
// const express = require('express');
// const Stripe = require('stripe');
// const cors = require('cors');

// const app = express();
// const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // Make sure this is in your .env

// app.use(cors());
// app.use(express.json());

// app.post('/create-billing-session', async (req, res) => {
//     const { userId } = req.body; // Get the user ID or other identifier

//     try {
//         const customerPortal = await stripe.billingPortal.sessions.create({
//             customer: userId, // Use the Stripe Customer ID associated with the user
//             return_url: 'http://localhost:3000/dashboard', // Redirect URL after managing billing
//         });

//         res.json({ url: customerPortal.url }); // Send back the URL for redirection
//     } catch (error) {
//         console.error('Error creating billing session:', error);
//         res.status(500).send('Internal Server Error');
//     }
// });

// // Start the server on port 3001
// const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });
