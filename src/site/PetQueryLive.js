import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import FormattedMessage from '../components/FormattedQueryMessage';
import { DEMO_API, demoHeaders, demoRequest, saveDemoToken } from '../pages/landing/campaign/demoClient';
import { SignupButton } from './ui';

const LIMIT = 2;
const USED_KEY = 'pw_site_pq_used';

const SUGGESTIONS = [
    { category: 'Toxicology', question: '100g of 70% dark chocolate ingested by a 12 kg dog. Toxic dose, decontamination and treatment.' },
    { category: 'Medication Guidance', question: 'Maropitant dose for a vomiting 4 kg cat, including route and frequency.' },
    { category: 'Emergency Medicine', question: 'Emergency furosemide protocol for a dog in acute CHF with respiratory distress.' }
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

const usedLocally = () => Number(localStorage.getItem(USED_KEY) || 0);

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
    </svg>
);

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

// Public PetQuery demo, styled like the in-app QuickQuery. Two questions per browser:
// localStorage blocks repeat visits, the API enforces the same limit per token and caps per IP.
const PetQueryLive = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [remaining, setRemaining] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(null);
    const [sourcesOpen, setSourcesOpen] = useState({});
    const listRef = useRef(null);

    useEffect(() => {
        const local = Math.max(0, LIMIT - usedLocally());
        setRemaining(local);
        demoRequest({ method: 'get', url: `${DEMO_API}/api/demo/petquery?scope=site` })
            .then(({ data }) => {
                saveDemoToken(data.token);
                setRemaining(Math.min(local, data.remaining));
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        const el = listRef.current;
        if (!el || (!messages.length && !loading)) return;
        const last = [...el.querySelectorAll('[data-msg]')].pop();
        const top = !loading && messages[messages.length - 1]?.role === 'assistant' && last ? last.offsetTop - 16 : el.scrollHeight;
        el.scrollTo({ top, behavior: 'smooth' });
    }, [messages, loading]);

    const locked = remaining === 0;

    const ask = async (question) => {
        const q = String(question || '').trim();
        if (!q || loading || locked) return;

        setError('');
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: q }]);
        setLoading(true);

        try {
            const { data } = await demoRequest({
                method: 'post',
                url: `${DEMO_API}/api/demo/petquery`,
                data: { question: q, history: messages.slice(-4), scope: 'site' },
                headers: demoHeaders()
            });
            saveDemoToken(data.token);
            localStorage.setItem(USED_KEY, String(usedLocally() + 1));
            setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
            setRemaining(Math.min(data.remaining, Math.max(0, LIMIT - usedLocally())));
            window.gtag?.('event', 'site_petquery_demo', { page_path: window.location.pathname });
        } catch (err) {
            if (err.response?.data?.error === 'DEMO_LIMIT') {
                localStorage.setItem(USED_KEY, String(LIMIT));
                setRemaining(0);
            } else {
                setError('Couldn’t run that question. Try again.');
            }
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

    return (
        <div className="rounded-[24px] bg-white ring-1 ring-[#13233f]/[0.08] shadow-[0_40px_80px_-40px_rgba(19,35,63,0.45)] overflow-hidden flex flex-col h-[600px] sm:h-[620px] text-left">
            <div className="flex justify-between sm:justify-center items-center p-4 border-b border-gray-200 bg-white relative">
                <h2 className="text-2xl sm:text-3xl font-bold text-primary-600">PetQuery</h2>
                <span className="sm:absolute sm:right-4 text-xs font-semibold text-[#3468bd] bg-[#eef4fc] px-2.5 py-1 rounded-full">
                    {remaining == null ? '…' : `${remaining} of ${LIMIT} free left`}
                </span>
            </div>

            <div ref={listRef} className="relative flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-6 space-y-4">
                {messages.length === 0 && !loading && (
                    <>
                        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6 max-w-5xl mx-auto">
                            <strong className="block mb-1 text-sm font-semibold text-gray-700">Disclaimer:</strong>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                PetQuery provides AI-generated responses for educational purposes only. These responses may contain inaccuracies and are not a substitute for
                                professional veterinary judgment. Verify information before making any medical decisions.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto">
                            {SUGGESTIONS.map((s) => (
                                <button
                                    key={s.question}
                                    type="button"
                                    disabled={locked}
                                    onClick={() => ask(s.question)}
                                    className="flex flex-col items-start text-left bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <h4 className="text-primary-600 font-semibold mb-2 text-base">{s.category}</h4>
                                    <p className="text-gray-700 text-sm leading-relaxed">{s.question}</p>
                                </button>
                            ))}
                        </div>
                    </>
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
                            className={`flex mb-6 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {m.role === 'user' ? (
                                <div className="max-w-[85%] bg-[#3468bd] text-white rounded-2xl rounded-br-md px-5 py-4 whitespace-pre-wrap">{m.content}</div>
                            ) : (
                                <div className="max-w-4xl w-full bg-primary-50 text-gray-800 rounded-2xl rounded-bl-md px-5 py-5 border-l-4 border-primary-400 message-content">
                                    <FormattedMessage content={withoutSources(m.content)} />
                                    <div className="flex items-center gap-1.5 mt-3">
                                        <button
                                            type="button"
                                            onClick={() => copy(withoutSources(m.content), i)}
                                            aria-label="Copy message"
                                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs border rounded transition-all duration-200 ${
                                                copied === i ? 'bg-primary-500 text-white border-primary-500' : 'bg-transparent text-gray-500 border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            <CopyIcon done={copied === i} />
                                        </button>
                                        {sources && (
                                            <button
                                                type="button"
                                                onClick={() => setSourcesOpen((s) => ({ ...s, [i]: !s[i] }))}
                                                aria-label="Show sources"
                                                className={`inline-flex items-center gap-1 px-2 py-1 text-xs border rounded transition-all duration-200 ${
                                                    sourcesOpen[i] ? 'bg-primary-100 text-primary-700 border-primary-300' : 'bg-transparent text-gray-500 border-gray-200 hover:bg-gray-100'
                                                }`}
                                            >
                                                <BookIcon />
                                            </button>
                                        )}
                                    </div>
                                    {sources && sourcesOpen[i] && (
                                        <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600">
                                            <FormattedMessage content={sources} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    );
                })}

                {loading && (
                    <div className="flex justify-start mb-6">
                        <div className="shimmer-loader">
                            <span className="loader-text">Thinking...</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white border-t border-gray-200/80 shadow-[0_-8px_24px_rgba(15,23,42,0.05)] p-3 sm:p-4">
                {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
                {locked ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl bg-[#f5f8fd] px-5 py-4">
                        <p className="text-[15px] text-[#13233f]">
                            <span className="font-semibold">That’s your 2 free questions.</span>{' '}
                            <span className="text-[#1a2b4a]/60">Unlimited PetQuery with a free 10 day trial.</span>
                        </p>
                        <SignupButton placement="petquery_demo_limit" className="!py-2.5 shrink-0">
                            Start free
                        </SignupButton>
                    </div>
                ) : (
                    <form
                        className="flex gap-3 items-start"
                        onSubmit={(e) => {
                            e.preventDefault();
                            ask(input);
                        }}
                    >
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    ask(input);
                                }
                            }}
                            maxLength={500}
                            rows={1}
                            disabled={loading}
                            placeholder="Ask me anything about veterinary medicine..."
                            className="flex-1 min-h-[52px] max-h-[120px] px-4 py-3 text-base border-2 border-gray-300 rounded-2xl bg-white focus:border-primary-400 focus:ring-4 focus:ring-primary-100 focus:outline-none shadow-sm resize-none transition-all duration-200 disabled:opacity-70"
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            aria-label="Send message"
                            className="w-[52px] h-[52px] bg-[#3468bd] text-white rounded-full hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center flex-shrink-0"
                        >
                            <SendIcon />
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default PetQueryLive;
