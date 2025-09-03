const express = require('express');
const axios = require('axios');

const router = express.Router();

router.post("/chat/stream", async (req, res) => {
    const { messages, model = "gpt-4o-mini", ...opts } = req.body || {};

    // Setup SSE headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    const controller = new AbortController();

    const callOnce = async () => {
        const r = await global.fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                stream: true,
                messages,
                temperature: 0.7,
                top_p: 0.9,
                frequency_penalty: 0.3,
                presence_penalty: 0.3,
                ...opts,
            }),
            signal: controller.signal,
        });
        if (!r.ok) {
            const text = await r.text().catch(() => "");
            throw new Error(`Upstream error ${r.status}: ${text || r.statusText}`);
        }
        return r;
    };

    const pipe = async () => {
        const r = await callOnce();
        const reader = r.body.getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                // forward raw chunks to client (SSE lines)
                res.write(value);
            }
            res.write(`data: [DONE]\n\n`);
        } finally {
            res.end();
        }
    };

    // Simple retry: 2 retries with backoff
    (async () => {
        let attempt = 0, max = 3, delay = 500;
        while (attempt < max) {
            try {
                await pipe();
                return;
            } catch (err) {
                attempt++;
                if (attempt >= max) {
                    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                    res.write(`data: [DONE]\n\n`);
                    res.end();
                    return;
                }
                await new Promise(r => setTimeout(r, delay));
                delay *= 2;
            }
        }
    })();

    req.on("close", () => controller.abort());
});

module.exports = router; 