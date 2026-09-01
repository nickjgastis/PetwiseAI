import React, { useEffect, useRef, useState } from 'react';
import { FaClipboardList, FaMicrophone, FaPause, FaPlay, FaStop } from 'react-icons/fa';
import ChunkedRecorder from '../../../utils/chunkedRecorder';
import { DEMO_API, demoRequest, saveDemoToken } from './demoClient';

const SAMPLE = `This is Bella, a 7 year old female spayed Labrador retriever, 32 kilograms. She's here for vomiting. Owner says she vomited 4 times overnight, last episode this morning, still eating small amounts. On exam temperature 101.8, heart rate 110, respiratory rate 28, BCS 6 out of 9. Abdomen is soft with mild cranial abdominal discomfort. Assessment is acute gastroenteritis. Plan Cerenia 1 milligram per kilogram SQ, 250 mls LRS SQ, bland diet, recheck if not improving in 24 hours.`;

const SECTION_COLORS = {
    Subjective: { border: '#3b82f6', header: 'bg-gradient-to-r from-blue-500 to-blue-600', bg: 'bg-blue-50' },
    Objective: { border: '#10b981', header: 'bg-gradient-to-r from-emerald-500 to-emerald-600', bg: 'bg-emerald-50' },
    Assessment: { border: '#f59e0b', header: 'bg-gradient-to-r from-amber-500 to-amber-600', bg: 'bg-amber-50' },
    Plan: { border: '#ef4444', header: 'bg-gradient-to-r from-red-500 to-red-600', bg: 'bg-red-50' }
};

const parseSOAP = (text) => {
    if (!text) return [];
    const clean = text.replace(/\*\*/g, '').replace(/#{1,6}\s*/g, '').trim();
    const names = ['Subjective', 'Objective', 'Assessment', 'Plan'];
    const sections = [];

    names.forEach((name) => {
        const regex = new RegExp(`(?:^|\\n)\\s*(?:[SOAP]\\s*-\\s*)?${name}:?\\s*\\n?`, 'i');
        const match = clean.match(regex);
        if (!match) return;
        const start = clean.search(regex) + match[0].length;
        let end = clean.length;
        names.forEach((other) => {
            if (other === name) return;
            const next = clean.substring(start).search(new RegExp(`(?:^|\\n)\\s*(?:[SOAP]\\s*-\\s*)?${other}:?\\s*\\n?`, 'i'));
            if (next !== -1 && start + next < end) end = start + next;
        });
        const content = clean.substring(start, end).trim();
        if (content) sections.push({ name, content });
    });

    return sections;
};

const QuickSOAPDemo = ({ onSignup, onGenerated, hideHeader = false }) => {
    const [transcript, setTranscript] = useState('');
    const [sections, setSections] = useState([]);
    const [remaining, setRemaining] = useState(null);
    const [limit, setLimit] = useState(1);
    const [recording, setRecording] = useState(false);
    const [paused, setPaused] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [audioLevels, setAudioLevels] = useState([]);
    const [error, setError] = useState('');
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const frameRef = useRef(null);
    const fired = useRef(false);

    useEffect(() => {
        demoRequest({ method: 'get', url: `${DEMO_API}/api/demo/status` })
            .then((res) => {
                saveDemoToken(res.data.token);
                setRemaining(res.data.soapRemaining);
                setLimit(res.data.soapLimit);
            })
            .catch(() => setRemaining(1));
    }, []);

    useEffect(() => () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        audioContextRef.current?.close?.().catch(() => {});
        streamRef.current?.getTracks().forEach((t) => t.stop());
        recorderRef.current?.stop?.().catch(() => {});
    }, []);

    const locked = remaining === 0 && sections.length === 0;

    const visualize = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const bars = 20;
        const step = Math.floor(data.length / bars);
        const levels = [];
        for (let i = 0; i < bars; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) sum += data[i * step + j];
            levels.push(Math.max(10, Math.min(100, (sum / step / 255) * 100)));
        }
        setAudioLevels(levels);
        frameRef.current = requestAnimationFrame(visualize);
    };

    const stopViz = async () => {
        if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            try { await audioContextRef.current.close(); } catch { /* already closed */ }
        }
        audioContextRef.current = null;
        analyserRef.current = null;
        setAudioLevels([]);
    };

    const startRecording = async () => {
        if (recording || transcribing || generating || remaining === 0) return;
        setError('');
        try {
            const recorder = new ChunkedRecorder({
                chunkDuration: 30000,
                apiUrl: DEMO_API,
                onError: (err) => console.error('[demo soap]', err)
            });
            recorderRef.current = recorder;

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            audioContext.createMediaStreamSource(stream).connect(analyser);
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            setAudioLevels(new Array(20).fill(0));
            visualize();

            await recorder.start(stream);
            setRecording(true);
            setPaused(false);
        } catch {
            setError('Mic access failed. Use the sample case instead.');
        }
    };

    const pauseRecording = () => {
        if (!recorderRef.current || !recording || paused) return;
        recorderRef.current.pause();
        setPaused(true);
        if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        }
        setAudioLevels([]);
    };

    const resumeRecording = async () => {
        if (!recorderRef.current || !paused) return;
        const ok = await recorderRef.current.resume();
        if (!ok) {
            setError('Couldn’t resume. Stop and start a new recording.');
            return;
        }
        if (audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        visualize();
        setPaused(false);
    };

    const stopRecording = async () => {
        if (!recorderRef.current || !recording) return;
        setRecording(false);
        setPaused(false);
        setTranscribing(true);
        setError('');
        await stopViz();
        try {
            const raw = await recorderRef.current.stop();
            streamRef.current = null;
            if (!raw?.trim()) {
                setError('No speech detected. Try again or use the sample.');
                return;
            }
            const { data } = await demoRequest({
                method: 'post',
                url: `${DEMO_API}/api/cleanup-transcript`,
                data: { transcript: raw }
            });
            const text = String(data.correctedTranscript || raw).trim();
            setTranscript(text);
        } catch {
            setError('Couldn’t process that recording. Use the sample case instead.');
        } finally {
            setTranscribing(false);
        }
    };

    const generate = async () => {
        const input = transcript.trim();
        if (!input || generating || remaining === 0) return;
        setError('');
        setGenerating(true);
        try {
            const { data } = await demoRequest({
                method: 'post',
                url: `${DEMO_API}/api/demo/quicksoap`,
                data: { input }
            });
            saveDemoToken(data.token);
            setRemaining(data.soapRemaining);
            setLimit(data.soapLimit);
            const parsed = parseSOAP(data.report);
            setSections(parsed.length ? parsed : [{ name: 'Subjective', content: data.report }]);
            window.fbq?.('trackCustom', 'demo_soap');
            window.gtag?.('event', 'demo_soap', { page_variant: 'demo' });
            if (!fired.current) {
                fired.current = true;
                onGenerated?.();
            }
        } catch (err) {
            if (err.response?.data?.error === 'DEMO_LIMIT') {
                setRemaining(0);
            } else {
                setError('Couldn’t generate that SOAP. Try again.');
            }
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 via-white to-gray-50 relative">
            {!hideHeader && (
            <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center">
                        <FaClipboardList className="text-xs" />
                    </span>
                    <div>
                        <p className="font-bold text-[#3468bd] leading-tight">QuickSOAP</p>
                        <p className="text-xs text-gray-500">Same dictation. Same SOAP.</p>
                    </div>
                </div>
                <p className="text-xs font-semibold text-[#3468bd] bg-[#eef4fc] px-2.5 py-1 rounded-full shrink-0">
                    {remaining == null ? '…' : `${remaining} of ${limit} left`}
                </p>
            </div>
            )}

            <div className={`flex-1 overflow-y-auto px-4 pb-4 ${sections.length === 0 ? 'flex flex-col' : ''}`}>
                {sections.length === 0 && (
                    <div className={`flex flex-col items-center ${transcript ? 'pt-2' : 'flex-1 justify-center'}`}>
                        {recording && !paused && audioLevels.length > 0 && (
                            <div className="mb-4 flex items-end justify-center gap-1 h-20 px-2">
                                {audioLevels.map((level, i) => (
                                    <div
                                        key={i}
                                        className="bg-primary-600 rounded-t"
                                        style={{ width: 5, height: `${level}%`, minHeight: 12, maxHeight: 80 }}
                                    />
                                ))}
                            </div>
                        )}

                        {!recording && !transcribing && (
                            <button
                                type="button"
                                onClick={startRecording}
                                disabled={locked || generating}
                                className="w-28 h-28 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-xl flex items-center justify-center disabled:bg-gray-300 disabled:shadow-none mb-5"
                            >
                                <FaMicrophone className="text-4xl" />
                            </button>
                        )}

                        {recording && (
                            <div className="flex flex-col items-center gap-4 mb-5">
                                <div className="flex items-center gap-4">
                                    {!paused ? (
                                        <button
                                            type="button"
                                            onClick={pauseRecording}
                                            className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-xl flex items-center justify-center"
                                        >
                                            <FaPause className="text-2xl" />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={resumeRecording}
                                            className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white shadow-xl flex items-center justify-center"
                                        >
                                            <FaPlay className="text-2xl" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={stopRecording}
                                        className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white shadow-xl flex items-center justify-center animate-pulse"
                                    >
                                        <FaStop className="text-3xl" />
                                    </button>
                                </div>
                                <p className="text-sm font-medium text-gray-600">{paused ? 'Paused' : 'Listening...'}</p>
                            </div>
                        )}

                        {transcribing && (
                            <div className="flex items-center gap-3 text-gray-600 mb-5">
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-600 border-t-transparent" />
                                <span className="text-sm font-medium">Transcribing...</span>
                            </div>
                        )}

                        {!recording && !transcribing && (
                            <>
                                <p className="text-base text-gray-500 text-center mb-3">
                                    Tap the mic, or load the sample case.
                                </p>
                                <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() => { setTranscript(SAMPLE); setError(''); }}
                                    className="text-sm font-semibold text-[#3468bd] disabled:opacity-40"
                                >
                                    Use sample dictation
                                </button>
                            </>
                        )}
                    </div>
                )}

                {transcript && sections.length === 0 && !recording && (
                    <div className="mt-5">
                        <p className="text-xs font-semibold text-blue-700 bg-blue-50 inline-block px-2 py-1 rounded mb-2">
                            Dictation
                        </p>
                        <textarea
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            rows={7}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary-400 focus:ring-4 focus:ring-primary-100 focus:outline-none resize-none text-gray-900 text-sm"
                        />
                        <button
                            type="button"
                            onClick={generate}
                            disabled={generating || !transcript.trim() || remaining === 0}
                            className="mt-3 w-full px-4 py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg font-bold shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                            {generating ? 'Generating...' : 'Generate SOAP'}
                        </button>
                    </div>
                )}

                {sections.length > 0 && (
                    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 mt-1" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)' }}>
                        {sections.map((section, i) => {
                            const colors = SECTION_COLORS[section.name] || SECTION_COLORS.Subjective;
                            return (
                                <div key={section.name} className={i < sections.length - 1 ? 'border-b border-gray-100' : ''}>
                                    <div className={`${colors.header} px-5 py-3 flex items-center gap-2.5`} style={{ borderLeft: `3px solid ${colors.border}` }}>
                                        <span className="w-6 h-6 rounded-md flex items-center justify-center text-white font-bold text-xs bg-white/20">
                                            {section.name.charAt(0)}
                                        </span>
                                        <h3 className="text-white font-semibold tracking-wider uppercase text-xs" style={{ letterSpacing: '0.08em' }}>
                                            {section.name}
                                        </h3>
                                    </div>
                                    <div className={`${colors.bg} px-5 py-3`}>
                                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{section.content}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

                {locked && (
                    <div className="mt-4">
                        <p className="text-base font-extrabold text-[#1a2b4a] mb-1">
                            Wow. You’ve used up your demo.
                        </p>
                        <p className="text-sm text-gray-600 mb-3">
                            Sign up and write unlimited SOAP notes for 10 days. No credit card.
                        </p>
                        <button
                            type="button"
                            onClick={onSignup}
                            className="w-full rounded-full bg-[#5cccf0] text-white font-medium py-3.5"
                        >
                            Start my free 10 days
                        </button>
                    </div>
                )}
            </div>

            {generating && (
                <div className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white">
                        <div className="absolute w-28 h-28 rounded-full opacity-70 blur-2xl bg-blue-500" style={{ top: '18%', left: '16%', animation: 'pwFloat1 8s ease-in-out infinite' }} />
                        <div className="absolute w-24 h-24 rounded-full opacity-70 blur-2xl bg-emerald-500" style={{ top: '62%', left: '58%', animation: 'pwFloat2 10s ease-in-out infinite' }} />
                        <div className="absolute w-32 h-32 rounded-full opacity-60 blur-2xl bg-amber-500" style={{ top: '36%', left: '64%', animation: 'pwFloat3 9s ease-in-out infinite' }} />
                        <div className="absolute w-20 h-20 rounded-full opacity-60 blur-2xl bg-red-500" style={{ top: '72%', left: '18%', animation: 'pwFloat4 11s ease-in-out infinite' }} />
                    </div>
                    <div className="relative z-10 text-center px-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 shadow-lg mb-4">
                            <FaClipboardList className="text-blue-600" />
                            <span className="font-semibold text-primary-700">SOAP Record</span>
                        </div>
                        <h2 className="text-xl font-bold text-primary-700">Generating your SOAP report...</h2>
                    </div>
                    <style>{`
                        @keyframes pwFloat1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,40px) scale(1.15); } }
                        @keyframes pwFloat2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-24px,-36px) scale(0.95); } }
                        @keyframes pwFloat3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-20px,28px) scale(1.1); } }
                        @keyframes pwFloat4 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(26px,-22px) scale(1.05); } }
                    `}</style>
                </div>
            )}
        </div>
    );
};

export default QuickSOAPDemo;
