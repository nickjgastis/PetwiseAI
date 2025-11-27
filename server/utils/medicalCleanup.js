// Medical dictation cleanup using GPT-4o-mini
// Runs AFTER Whisper transcription and BEFORE VetCorrector

const axios = require('axios');

const SYSTEM_PROMPT = `You are a veterinary medical dictation cleanup engine.
Your job is to correct spelling, medical terminology, drug names, diagnoses, and grammar based on the context of the text.
Do not add or remove any medical meaning.
Do not hallucinate new drugs.
Do not change dosages.
Do not shorten the content.

You MUST:
- Correct all drug names
- Correct misspelled diagnoses
- Correct misspelled clinical terms
- Convert phonetic approximations to correct medical language
- Normalize mg/kg, mg, ml, once/twice/three times daily
- Leave the structure, order, and meaning unchanged
- Output a single paragraph of fully corrected text only

If a word could be a drug OR a normal English word, choose the normal English word unless the sentence explicitly indicates a medication.`;

async function runMedicalCleanup(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return text;
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
        console.warn('OPENAI_API_KEY not set, skipping GPT cleanup');
        return text;
    }

    // Skip cleanup for very long transcripts to avoid timeout
    if (text.length > 2000) {
        console.log('Transcript too long for GPT cleanup, skipping');
        return text;
    }

    try {
        // Build user prompt
        const userPrompt = `Clean up the following veterinary medical dictation.
Correct drug names, diagnoses, clinical terms, dosing formats, and grammar.
Do not add information. Do not remove details. Do not hallucinate.

TEXT:
"${text}"`;

        // Use same timeout pattern as other OpenAI calls in server
        const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 55000);

        // Call GPT-4o-mini matching the pattern used in server.js
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 300,
                temperature: 0.1,
                stream: false
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: OPENAI_TIMEOUT_MS,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            }
        );

        const cleanedText = response.data.choices?.[0]?.message?.content?.trim();

        if (cleanedText && cleanedText.length > 0) {
            console.log('GPT-4o-mini cleanup applied');
            return cleanedText;
        } else {
            console.warn('GPT cleanup returned empty, using original text');
            return text;
        }
    } catch (err) {
        // Hard fallback: return raw text unchanged
        // Log error details but don't throw
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            console.warn('GPT cleanup timeout, using original text');
        } else if (err.response) {
            console.error('GPT cleanup API error:', err.response.status, err.response.data?.error?.message || err.message);
        } else {
            console.error('GPT cleanup error:', err.message || err.code || 'Unknown error');
        }
        return text; // Always return original text on error
    }
}

module.exports = {
    runMedicalCleanup
};

