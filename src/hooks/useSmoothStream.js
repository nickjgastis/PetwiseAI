import { useEffect, useRef, useState } from "react";

/**
 * Smoothly renders SSE chat tokens by buffering + throttling UI updates.
 * - startDelayMs/startChars: wait before first render to avoid thin trickle
 * - flushIntervalMs: how often to push buffered text into React
 * - chunkStrategy: split on sentence-end or word groups
 */
export function useSmoothStream({
    startDelayMs = 350,
    startChars = 280,
    flushIntervalMs = 70,
    splitBySentence = true,
} = {}) {
    const [visible, setVisible] = useState("");      // what the UI shows
    const [done, setDone] = useState(false);
    const [error, setError] = useState(null);

    const bufferRef = useRef("");                    // hidden buffer
    const startedRef = useRef(false);
    const flushTimerRef = useRef(null);
    const controllerRef = useRef(null);

    const stopFlusher = () => {
        if (flushTimerRef.current) {
            clearInterval(flushTimerRef.current);
            flushTimerRef.current = null;
        }
    };

    const startFlusher = () => {
        if (flushTimerRef.current) return;
        flushTimerRef.current = setInterval(() => {
            const buf = bufferRef.current;
            if (!buf) return;

            let take = buf;

            if (splitBySentence) {
                // Try to end on sentence boundary or at least a comma/linebreak
                const m = buf.match(/^[\s\S]{60,}?[\.!\?](?:\s|$)|^[\s\S]{120,}?(?:,|\n|\r|$)/);
                if (m) take = m[0];
            } else {
                // word group size fallback
                const words = buf.split(/\s+/);
                if (words.length > 20) {
                    take = words.slice(0, 20).join(" ") + " ";
                }
            }

            // Flush 'take' into visible, keep remainder in buffer
            setVisible(v => v + take);
            bufferRef.current = buf.slice(take.length);
        }, flushIntervalMs);
    };

    const streamFrom = async (url, body) => {
        console.log('streamFrom called with URL:', url);
        console.log('Request body:', JSON.stringify(body, null, 2));

        setVisible(""); setDone(false); setError(null);
        bufferRef.current = ""; startedRef.current = false;

        const ctrl = new AbortController();
        controllerRef.current = ctrl;

        console.log('Created new AbortController:', ctrl);

        try {
            console.log('Starting fetch request...');
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: ctrl.signal,
            });

            console.log('Fetch response received:', {
                status: res.status,
                statusText: res.statusText,
                ok: res.ok,
                headers: Object.fromEntries(res.headers.entries())
            });

            if (!res.ok) {
                const errorText = await res.text().catch(() => 'No error text');
                console.error('HTTP error response:', errorText);
                throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            let firstChunkAt = 0;

            const maybeStart = () => {
                if (startedRef.current) return;
                const enoughChars = bufferRef.current.length >= startChars;
                const enoughTime = Date.now() - firstChunkAt >= startDelayMs;
                if (enoughChars || enoughTime) {
                    startedRef.current = true;
                    startFlusher();
                }
            };

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                // parse SSE lines
                for (const line of text.split("\n")) {
                    if (!line.startsWith("data:")) continue;
                    const payload = line.slice(5).trim();

                    if (payload === "[DONE]") {
                        stopFlusher();
                        // Flush any remainder
                        if (bufferRef.current) {
                            setVisible(v => v + bufferRef.current);
                            bufferRef.current = "";
                        }
                        setDone(true);
                        return;
                    }
                    try {
                        const obj = JSON.parse(payload);
                        const delta = obj?.choices?.[0]?.delta?.content;
                        if (delta) {
                            if (firstChunkAt === 0) firstChunkAt = Date.now();
                            bufferRef.current += delta;
                            maybeStart();
                        }
                        if (obj?.error) {
                            console.error('Stream error from server:', obj.error);
                            throw new Error(typeof obj.error === 'string' ? obj.error : JSON.stringify(obj.error));
                        }
                    } catch (parseError) {
                        // not JSON (some providers send keep-alives) — ignore safely
                        console.debug('Non-JSON chunk received:', payload);
                    }
                }
            }
        } catch (e) {
            console.log('Stream error details:', {
                name: e.name,
                message: e.message,
                isAbortError: e.name === 'AbortError',
                includesAborted: e.message.includes('aborted'),
                includesSignalAborted: e.message.includes('signal is aborted')
            });

            // Don't set error for user-initiated aborts or component unmounts
            if (e.name !== 'AbortError' &&
                !e.message.includes('aborted') &&
                !e.message.includes('signal is aborted') &&
                !e.message.includes('user aborted')) {
                console.error('Stream processing error:', e);
                setError(e.message || "stream failed");
            } else {
                console.log('Stream was aborted by user or component unmount - this is normal');
            }
            stopFlusher();
        } finally {
            stopFlusher();
            controllerRef.current = null;
        }
    };

    const abort = () => {
        console.log('abort() called - this will cancel the stream');
        console.trace('Stack trace for abort call:');
        controllerRef.current?.abort();
        stopFlusher();
    };

    useEffect(() => {
        return () => {
            console.log('useSmoothStream cleanup - stopping flusher and aborting any active stream');
            stopFlusher();
            if (controllerRef.current) {
                controllerRef.current.abort();
            }
        };
    }, []);

    return { visible, done, error, streamFrom, abort };
} 