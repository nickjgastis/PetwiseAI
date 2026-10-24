import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiArrowRight, FiArrowUp, FiRotateCcw } from 'react-icons/fi';
import FormattedMessage from '../components/FormattedQueryMessage';
import { GRADIENT_TEXT } from '../components/caseStyles';
import { DEMO_API } from '../pages/landing/campaign/demoClient';
import { SignupButton } from './ui';

const EASE = [0.2, 0.7, 0.2, 1];

const SUGGESTIONS = [
    { id: 'toxicology', category: 'Toxicology', question: '100g of 70% dark chocolate ingested by a 12 kg dog. Toxic dose, decontamination and treatment.' },
    { id: 'maropitant', category: 'Medication Guidance', question: 'Maropitant dose for a vomiting 4 kg cat, including route and frequency.' },
    { id: 'pupd', category: 'Internal Medicine', question: 'Top differentials and first diagnostics for PU/PD in a 13 year old cat.' }
];

const SOURCE_PATTERNS = [
    /\*\*Sources:\*\*([\s\S]*?)(?=\n\n\*\*|$)/i,
    /\*\*Sources\*\*([\s\S]*?)(?=\n\n\*\*|$)/i,
    /Sources:([\s\S]*?)(?=\n\n\*\*|$)/i,
    /\*\*References:\*\*([\s\S]*?)(?=\n\n\*\*|$)/i
];

const extractSources = (content) => {
    for (const p of SOURCE_PATTERNS) {
        const m = content.match(p);
        if (m) return m[1].trim();
    }
    return null;
};

const withoutSources = (content) => SOURCE_PATTERNS.reduce((c, p) => c.replace(p, '').trim(), content);

const CopyIcon = ({ done }) =>
    done ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
        </svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M7.5 3.375c0-1.036.84-1.875 1.875-1.875h.375a3.75 3.75 0 013.75 3.75v1.875C13.5 8.161 14.34 9 15.375 9h1.875A3.75 3.75 0 0121 12.75v3.375C21 17.16 20.16 18 19.125 18h-9.75A1.875 1.875 0 017.5 16.125V3.375z" />
            <path d="M15 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0017.25 7.5h-1.875A.375.375 0 0115 7.125V5.25zM4.875 6H6v10.125A3.375 3.375 0 009.375 19.5H16.5v1.125c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V7.875C3 6.839 3.84 6 4.875 6z" />
        </svg>
    );

const BookIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
    </svg>
);

const actionButton = (on) =>
    `inline-flex items-center justify-center w-8 h-8 rounded-full cursor-pointer border transition-colors duration-200 ${
        on ? 'bg-[#2d5fb8] text-white border-[#2d5fb8]' : 'bg-transparent text-[#1a2b4a]/50 border-[#2d5fb8]/15 hover:text-[#2d5fb8] hover:bg-white'
    }`;

// Public PetQuery demo, styled like the in-app PetQuery. Preset questions only; the API rejects
// anything else and caches each answer, so there's no usage limit.
const PetQueryLive = () => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(null);
    const [sourcesOpen, setSourcesOpen] = useState({});
    const listRef = useRef(null);

    useEffect(() => {
        const el = listRef.current;
        if (!el || (!messages.length && !loading)) return;
        const last = [...el.querySelectorAll('[data-msg]')].pop();
        const top = !loading && messages[messages.length - 1]?.role === 'assistant' && last ? last.offsetTop - 16 : el.scrollHeight;
        el.scrollTo({ top, behavior: 'smooth' });
    }, [messages, loading]);

    const asked = messages.filter((m) => m.role === 'user').map((m) => m.id);
    const unasked = SUGGESTIONS.filter((s) => !asked.includes(s.id));

    const ask = async (s) => {
        if (!s || loading) return;

        setError('');
        setMessages((prev) => [...prev, { role: 'user', id: s.id, content: s.question }]);
        setLoading(true);
        const thinking = new Promise((r) => setTimeout(r, 2500 + Math.random() * 1500));

        try {
            const res = await fetch(`${DEMO_API}/api/demo/site-petquery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId: s.id })
            });
            const data = await res.json();
            await thinking;
            if (!res.ok || !data.answer) throw new Error(data.error || 'Query failed');
            setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
            window.gtag?.('event', 'site_petquery_demo', { page_path: window.location.pathname, question: s.id });
        } catch {
            setError('Couldn’t run that question. Try again.');
            setMessages((prev) => prev.slice(0, -1));
        } finally {
            setLoading(false);
        }
    };

    const copy = async (text, i) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(i);
            setTimeout(() => setCopied(null), 1500);
        } catch {
            /* clipboard unavailable */
        }
    };

    const reset = () => {
        setMessages([]);
        setSourcesOpen({});
        setError('');
    };

    return (
        <div className="rounded-[24px] sm:rounded-[32px] bg-gradient-to-b from-[#f6f8fb] to-white ring-1 ring-[#13233f]/[0.08] shadow-[0_40px_90px_-45px_rgba(19,35,63,0.5)] overflow-hidden flex flex-col h-[min(84svh,780px)] min-h-[560px] text-left">
            {messages.length > 0 && (
                <div className="flex-shrink-0 border-b border-[#eef2f7] bg-white/80 backdrop-blur-md">
                    <div className="h-[56px] px-4 sm:px-6 flex items-center justify-between">
                        <span className={`pb-0.5 text-[20px] font-bold tracking-[-0.02em] ${GRADIENT_TEXT}`}>PetQuery</span>
                        <button
                            type="button"
                            onClick={reset}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold text-[#13233f] bg-white border border-[#e7ecf3] hover:bg-[#f6f8fb] cursor-pointer transition-colors disabled:opacity-50"
                        >
                            <FiRotateCcw className="text-[13px]" /> Start over
                        </button>
                    </div>
                </div>
            )}

            <div ref={listRef} className="relative flex-1 min-h-0 overflow-y-auto px-3 sm:px-8 py-5 sm:py-8">
                {messages.length === 0 && !loading && (
                    <div className="min-h-full flex flex-col justify-center max-w-6xl mx-auto">
                        <div className="text-center mb-6 sm:mb-10">
                            <h3 className={`m-0 pb-1 text-[2rem] sm:text-[2.75rem] leading-[1.15] font-bold tracking-[-0.03em] ${GRADIENT_TEXT}`}>PetQuery</h3>
                            <p className="mt-1.5 mb-0 text-[14px] sm:text-[15px] text-[#1a2b4a]/55">Ask about differentials, dosages, treatment protocols or diagnostics.</p>
                        </div>
                        <p className="mb-3 ml-1 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#1a2b4a]/45">Try asking</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                            {SUGGESTIONS.map((s, i) => (
                                <motion.button
                                    key={s.id}
                                    type="button"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    whileHover={{ y: -4 }}
                                    whileTap={{ scale: 0.985 }}
                                    transition={{ duration: 0.35, ease: EASE, delay: 0.05 + i * 0.05 }}
                                    onClick={() => ask(s)}
                                    className="group w-full h-full text-left rounded-[24px] border border-[#e7ecf3] bg-white p-5 cursor-pointer transition-[box-shadow,border-color] duration-300 hover:border-[#d6e3f7] hover:shadow-[0_24px_48px_-24px_rgba(19,35,63,0.25)] flex flex-col"
                                >
                                    <span className="text-[11.5px] font-semibold tracking-[0.06em] uppercase text-[#2d5fb8]">{s.category}</span>
                                    <span className="mt-2 text-[14.5px] leading-relaxed text-[#13233f]/85 flex-1">{s.question}</span>
                                    <span className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#2d5fb8] sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                        Ask this <FiArrowRight className="text-[12px]" />
                                    </span>
                                </motion.button>
                            ))}
                        </div>
                        <p className="mt-6 sm:mt-8 mb-0 text-center text-[11.5px] sm:text-[12px] leading-relaxed text-[#1a2b4a]/40 max-w-2xl mx-auto">
                            PetQuery gives AI-generated answers for educational use. They can contain mistakes and are not a substitute for professional judgment, so verify before making treatment decisions.
                        </p>
                    </div>
                )}

                {messages.map((m, i) => {
                    const sources = m.role === 'assistant' ? extractSources(m.content) : null;
                    return (
                        <motion.div
                            key={i}
                            data-msg
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className={`flex mb-5 sm:mb-6 w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {m.role === 'user' ? (
                                <div className="max-w-[86%] sm:max-w-[70%] bg-[#2d5fb8] text-white rounded-[20px] sm:rounded-[22px] rounded-br-md px-4 py-3 sm:px-5 sm:py-3.5 text-[14.5px] sm:text-[15px] shadow-[0_10px_30px_-16px_rgba(45,95,184,0.7)] whitespace-pre-wrap">
                                    {m.content}
                                </div>
                            ) : (
                                <div className="w-full bg-[#e8f0fc] text-[#13233f] rounded-[22px] sm:rounded-[28px] rounded-bl-md px-4 py-4 sm:px-10 sm:py-8 border border-[#2d5fb8]/[0.14] text-[14.5px] sm:text-[15px]">
                                    <FormattedMessage content={withoutSources(m.content)} />
                                    <div className="flex items-center gap-1.5 mt-4 sm:mt-6">
                                        <button type="button" onClick={() => copy(withoutSources(m.content), i)} aria-label="Copy answer" className={actionButton(copied === i)}>
                                            <CopyIcon done={copied === i} />
                                        </button>
                                        {sources && (
                                            <button
                                                type="button"
                                                onClick={() => setSourcesOpen((s) => ({ ...s, [i]: !s[i] }))}
                                                aria-label="Show sources"
                                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full cursor-pointer border transition-colors duration-200 ${
                                                    sourcesOpen[i] ? 'bg-[#e9f1fc] text-[#2d5fb8] border-[#2d5fb8]/30' : 'bg-transparent text-[#1a2b4a]/50 border-[#2d5fb8]/15 hover:text-[#2d5fb8] hover:bg-white'
                                                }`}
                                            >
                                                <BookIcon />
                                            </button>
                                        )}
                                        {sources && !sourcesOpen[i] && <span className="ml-1 text-[12px] text-[#1a2b4a]/45">See sources</span>}
                                    </div>
                                    {sources && sourcesOpen[i] && (
                                        <div className="mt-5 pt-5 border-t border-[#2d5fb8]/10 text-sm text-[#1a2b4a]/70">
                                            <FormattedMessage content={sources} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    );
                })}

                {loading && (
                    <div className="flex justify-start mb-6 w-full">
                        <div className="shimmer-loader">
                            <span className="loader-text">Thinking...</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-shrink-0 bg-white/85 backdrop-blur-md border-t border-[#eef2f7]">
                <div className="mx-auto max-w-4xl px-3 sm:px-4 pt-3 pb-4 sm:pb-5">
                    {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
                    {!loading && unasked.length === 0 ? (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-[22px] bg-[#eef4fc] px-4 py-4 sm:px-5 text-center sm:text-left">
                            <p className="m-0 text-[15px] text-[#13233f]">
                                <span className="font-semibold">Want to ask your own?</span>{' '}
                                <span className="text-[#1a2b4a]/60">Unlimited PetQuery with a free 10 day trial.</span>
                            </p>
                            <SignupButton placement="petquery_demo_done" className="!py-2.5 shrink-0">
                                Start free
                            </SignupButton>
                        </div>
                    ) : (
                        <>
                            {messages.length > 0 && (
                                <div className="flex justify-center gap-2 mb-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                                    {unasked.map((s) => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            title={s.question}
                                            disabled={loading}
                                            onClick={() => ask(s)}
                                            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold text-[#2d5fb8] bg-white border border-[#e7ecf3] hover:border-[#2d5fb8]/30 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {s.category} <FiArrowRight className="text-[12px]" />
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="relative">
                                <div className="flex items-center w-full min-h-[52px] pl-5 pr-14 text-[15px] text-[#1a2b4a]/40 border border-[#e7ecf3] rounded-[26px] bg-white shadow-[0_10px_30px_-20px_rgba(19,35,63,0.35)] select-none">
                                    {messages.length ? 'Pick another question above' : 'Pick a question above to try it'}
                                </div>
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#e7ecf3] text-[#1a2b4a]/35 flex items-center justify-center" aria-hidden>
                                    <FiArrowUp className="text-[16px]" strokeWidth={2.5} />
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PetQueryLive;
