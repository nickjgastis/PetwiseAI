const express = require('express');
const axios = require('axios');
const demo = require('../demoLimits');
const { generateSoapFromInput } = require('../soapGenerate');

const router = express.Router();

const DEMO_PROMPT = `You are PetQuery, a Veterinary Assistant AI for licensed veterinarians only. Always assume you are speaking with a licensed veterinarian. Keep answers short, precise, and clinically useful.

FORMATTING:
1. FIRST line is a short plain-text title (no numbering, no markdown headers).
2. Use **bold headers** and numbered top-level sections (1., 2., 3. ...). Never restart numbering.
3. Drug details as one "**Label:** value" line each (**Drug Name:**, **Dose:**, **Route:**, **Frequency:**, **Duration:**, **Additional Notes:**).
4. End with a **Sources:** numbered list (3-5 real veterinary sources) then a **Recommendation** section.

Stay on-topic. No disclaimers about not being a veterinarian.`;

const attach = (res, state) => {
    demo.setCookie(res, state.token);
    res.setHeader('X-Demo-Token', state.token);
};

const payload = (state) => ({
    remaining: demo.remainingQuery(state),
    limit: demo.QUERY_LIMIT,
    soapRemaining: demo.remainingSoap(state),
    soapLimit: demo.SOAP_LIMIT,
    token: state.token
});

router.get('/status', (req, res) => {
    const state = demo.getState(req);
    attach(res, state);
    return res.json(payload(state));
});

router.get('/petquery', (req, res) => {
    const state = demo.getState(req);
    attach(res, state);
    return res.json(payload(state));
});

router.post('/quicksoap', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    const state = demo.getState(req);
    attach(res, state);

    if (demo.remainingSoap(state) <= 0) {
        return res.status(403).json({
            error: 'DEMO_LIMIT',
            ...payload(state)
        });
    }

    const input = String(req.body?.input || '').trim();
    if (!input) return res.status(400).json({ error: 'Dictation is required' });
    if (input.length > 20000) return res.status(400).json({ error: 'Dictation is too long' });

    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const { report, petName } = await generateSoapFromInput(input);
        if (!report) return res.status(502).json({ error: 'Invalid response from OpenAI' });

        const next = demo.consumeSoap(state);
        attach(res, next);

        return res.json({
            report,
            petName,
            ...payload(next)
        });
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data?.error?.message || err.message;
        console.error('[demo/quicksoap]', status || err.code, detail);
        if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
            return res.status(504).json({ error: 'Request timed out' });
        }
        return res.status(status === 429 ? 429 : 502).json({ error: 'SOAP failed' });
    }
});

router.post('/petquery', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    const state = demo.getState(req);
    attach(res, state);

    if (demo.remaining(state) <= 0) {
        return res.status(403).json({
            error: 'DEMO_LIMIT',
            remaining: 0,
            limit: demo.QUERY_LIMIT,
            token: state.token
        });
    }

    const question = String(req.body?.question || '').trim();
    if (!question) return res.status(400).json({ error: 'Question is required' });
    if (question.length > 500) return res.status(400).json({ error: 'Question is too long' });

    const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
    const history = rawHistory
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-4)
        .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }));

    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const messages = [
        { role: 'system', content: DEMO_PROMPT },
        ...history,
        { role: 'user', content: question }
    ];

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-5.4-mini',
                messages,
                max_completion_tokens: 1200,
                stream: false
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: Number(process.env.OPENAI_TIMEOUT_MS || 55000)
            }
        );

        const content = response.data?.choices?.[0]?.message?.content;
        if (!content) return res.status(502).json({ error: 'Invalid response from OpenAI' });

        const next = demo.consume(state);
        attach(res, next);

        return res.json({
            answer: content,
            remaining: demo.remaining(next),
            limit: demo.QUERY_LIMIT,
            token: next.token
        });
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data?.error?.message || err.message;
        console.error('[demo/petquery]', status || err.code, detail);
        if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
            return res.status(504).json({ error: 'Request timed out' });
        }
        return res.status(status === 429 ? 429 : 502).json({ error: 'Query failed' });
    }
});

module.exports = router;
