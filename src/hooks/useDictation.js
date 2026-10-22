import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import ChunkedRecorder from '../utils/chunkedRecorder';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const BARS = 28;

// Same pipeline as the New case recorder: chunked Whisper uploads while recording,
// then a cleanup pass on the merged transcript.
export const useDictation = () => {
    const [status, setStatus] = useState('idle'); // idle | recording | paused | transcribing
    const [levels, setLevels] = useState(() => new Array(BARS).fill(0));
    const [seconds, setSeconds] = useState(0);
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const ctxRef = useRef(null);
    const analyserRef = useRef(null);
    const rafRef = useRef(null);
    const timerRef = useRef(null);

    const stopViz = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setLevels(new Array(BARS).fill(0));
    }, []);

    const startViz = useCallback(() => {
        const analyser = analyserRef.current;
        if (!analyser) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        let last = 0;
        const tick = (t) => {
            rafRef.current = requestAnimationFrame(tick);
            if (t - last < 50) return;
            last = t;
            analyser.getByteFrequencyData(data);
            const step = Math.floor(data.length / BARS) || 1;
            setLevels(Array.from({ length: BARS }, (_, i) => {
                let sum = 0;
                for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
                return Math.min(1, sum / step / 160);
            }));
        };
        rafRef.current = requestAnimationFrame(tick);
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }, []);

    const teardown = useCallback(() => {
        stopViz();
        if (ctxRef.current && ctxRef.current.state !== 'closed') ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
        analyserRef.current = null;
    }, [stopViz]);

    const start = useCallback(async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.75;
        ctx.createMediaStreamSource(stream).connect(analyser);
        ctxRef.current = ctx;
        analyserRef.current = analyser;

        const recorder = new ChunkedRecorder({ chunkDuration: 30000, apiUrl: API_URL });
        recorderRef.current = recorder;
        await recorder.start(stream);
        setSeconds(0);
        setStatus('recording');
        startViz();
    }, [startViz]);

    const pause = useCallback(() => {
        recorderRef.current?.pause();
        stopViz();
        setStatus('paused');
    }, [stopViz]);

    const resume = useCallback(async () => {
        const ok = await recorderRef.current?.resume();
        if (ok === false) throw new Error('Microphone access lost. Stop and try again.');
        setStatus('recording');
        startViz();
    }, [startViz]);

    const stop = useCallback(async () => {
        const recorder = recorderRef.current;
        if (!recorder) return '';
        teardown();
        setStatus('transcribing');
        try {
            const raw = ((await recorder.stop()) || '').trim();
            if (!raw) throw new Error('No speech detected. Try recording again.');
            try {
                const res = await axios.post(`${API_URL}/api/cleanup-transcript`, { transcript: raw });
                return (res.data?.correctedTranscript || raw).trim();
            } catch {
                return raw;
            }
        } finally {
            recorderRef.current = null;
            streamRef.current = null;
            setStatus('idle');
        }
    }, [teardown]);

    useEffect(() => () => {
        teardown();
        if (recorderRef.current?.getIsRecording()) recorderRef.current.stop().catch(() => {});
        streamRef.current?.getTracks().forEach((t) => t.stop());
    }, [teardown]);

    return { status, levels, seconds, start, pause, resume, stop };
};
