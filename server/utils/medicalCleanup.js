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

    // For very long transcripts, skip GPT cleanup to avoid timeout/cost
    // Max cleanup limit: 8000 characters (increased for long dictations with hallucinations)
    // 2-minute dictation ≈ 200-300 words ≈ 1000-1500 chars
    // 5-minute dictation ≈ 500-750 words ≈ 2500-3750 chars
    // 10-minute dictation ≈ 1000-1500 words ≈ 5000-7500 chars
    // 8000 chars allows cleanup of ~15-20 minute dictations
    if (text.length > 8000) {
        console.log(`Transcript too long for GPT cleanup (${text.length} chars), skipping (max: 8000)`);
        return text;
    }

    try {
        // Build user prompt with stronger instructions
        const userPrompt = `You are cleaning up a veterinary medical dictation transcript.

Tasks:
1. Fix obvious misspellings of medical terms, drug names, and common words.
2. Add punctuation and sentence breaks.
3. Do not remove any medically relevant content.
4. Do not shorten the transcript on purpose.
5. REMOVE obvious Whisper hallucinations including:
   - Repeated words/phrases like "etc etc etc etc", "you you you", "the the the"
   - Random foreign language text (Chinese, Arabic, Korean, etc.)
   - YouTube-style phrases like "Subscribe", "Thank you for watching", "Like and subscribe"
   - Symbol spam or emoji runs
   - Music notation or "[Music]" markers
   - Any clearly non-medical gibberish that doesn't fit the clinical context

Important:
- Preserve ALL English clinical content - never remove real medical speech.
- Keep the meaning and sequence of events.
- Do not summarize.
- Do not add new details.
- When in doubt, keep the content rather than remove it.

TEXT:
"${text}"`;

        // Use same timeout pattern as other OpenAI calls in server
        const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 55000);

        // Calculate max_tokens based on input length (roughly 1 token = 4 chars)
        // GPT-4o-mini can handle up to 16k output tokens
        // With hallucination removal, output should be SMALLER than input
        // But we need enough room for the full cleaned transcript
        const estimatedInputTokens = Math.ceil(text.length / 4);
        // Use 1.5x input tokens - enough for full output but not wasteful
        // For 8000 chars max input: ~2000 tokens input → 3000 tokens output max (well below 16k limit)
        const maxTokens = Math.min(Math.ceil(estimatedInputTokens * 1.5), 8000);

        // Call GPT-4o-mini matching the pattern used in server.js
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: maxTokens,
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
        const finishReason = response.data.choices?.[0]?.finish_reason;

        // Check if response was truncated - NEVER return truncated output
        if (finishReason === 'length') {
            console.warn(`GPT cleanup was truncated (finish_reason: length). Input: ${text.length} chars, Output: ${cleanedText?.length || 0} chars`);
            console.warn('Returning original text to avoid data loss');
            return text; // Return original if truncated
        }

        if (cleanedText && cleanedText.length > 0) {
            // CRITICAL: If output is significantly shorter than input, it's likely truncated
            // Return original text instead of truncated output to prevent data loss
            const lengthRatio = cleanedText.length / text.length;
            if (lengthRatio < 0.6) { // If output is less than 60% of input, likely truncated
                console.warn(`[QuickSOAPTranscribe] GPT cleanup output is significantly shorter (${(lengthRatio * 100).toFixed(1)}% of original), returning original text`);
                return text; // Return original to prevent data loss
            }

            console.log(`GPT-4o-mini cleanup applied: ${text.length} -> ${cleanedText.length} chars`);
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

