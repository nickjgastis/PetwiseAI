// server.js
const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.post('/api/generate-report', async (req, res) => {
    const { prompt } = req.body;

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1500,
            temperature: 0.7,
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
        });

        res.json({ report: response.data.choices[0].message.content });
    } catch (error) {
        console.error("Error generating report:", error);
        res.status(500).json({ error: 'Error generating report.' });
    }
});
console.log(process.env.REACT_APP_OPENAI_API_KEY); // This should log your API key


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
