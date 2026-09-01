import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import FormattedQueryMessage from '../../../components/FormattedQueryMessage';
import { DEMO_API, demoHeaders, demoRequest, saveDemoToken } from './demoClient';

const STARTERS = [
    { category: 'GI', question: 'Maropitant dose for a vomiting 4 kg cat. Include route and frequency.' },
    { category: 'Emergency', question: 'Emergency furosemide protocol for a dog in acute CHF with respiratory distress.' },
    { category: 'Toxicology', question: 'Dark chocolate ingestion in a 12 kg dog. Decontamination and treatment.' }
];

const ThinkingLoader = () => (
    <div className="flex justify-start mb-3">
        <div className="hidden sm:flex shimmer-loader">
            <span className="loader-text">Thinking...</span>
        </div>
        <div className="flex sm:hidden h-10 px-4 rounded-[20px] rounded-bl-md bg-white border border-gray-200/80 shadow-sm items-center gap-1.5">
            {[0, 1, 2].map((dot) => (
                <motion.span
                    key={dot}
                    className="w-1.5 h-1.5 rounded-full bg-[#3468bd]"
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: dot * 0.14 }}
                />
            ))}
        </div>
    </div>
);

const PetQueryDemo = ({ onSignup, onFirstAnswer, fill = false, hideHeader = false }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [remaining, setRemaining] = useState(null);
    const [limit, setLimit] = useState(3);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const listRef = useRef(null);
    const firedFirst = useRef(false);

    useEffect(() => {
        demoRequest({ method: 'get', url: `${DEMO_API}/api/demo/petquery` })
            .then((res) => {
                saveDemoToken(res.data.token);
                setRemaining(res.data.remaining);
                setLimit(res.data.limit);
            })
            .catch(() => setRemaining(3));
    }, []);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, loading]);

    const ask = async (question) => {
        const q = String(question || '').trim();
        if (!q || loading || remaining === 0) return;

        setError('');
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: q }]);
        setLoading(true);

        try {
            const history = messages.slice(-4);
            const { data } = await demoRequest({
                method: 'post',
                url: `${DEMO_API}/api/demo/petquery`,
                data: { question: q, history },
                headers: demoHeaders()
            });
            saveDemoToken(data.token);
            setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
            setRemaining(data.remaining);
            setLimit(data.limit);
            window.fbq?.('trackCustom', 'demo_query');
            window.gtag?.('event', 'demo_query', { page_variant: 'demo' });
            if (!firedFirst.current) {
                firedFirst.current = true;
                onFirstAnswer?.();
            }
        } catch (err) {
            const code = err.response?.data?.error;
            if (code === 'DEMO_LIMIT') {
                setRemaining(0);
            } else {
                setError('Couldn’t run that question. Try again.');
                setMessages((prev) => prev.slice(0, -1));
            }
        } finally {
            setLoading(false);
        }
    };

    const locked = remaining === 0;

    return (
        <div className={fill
            ? 'flex flex-col h-full bg-[#f5f7fb]'
            : 'rounded-[22px] bg-[#f5f7fb] border border-gray-200/80 overflow-hidden shadow-[0_8px_28px_-16px_rgba(15,23,42,0.2)]'
        }>
            {!hideHeader && (
            <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                    <p className="font-bold text-[#3468bd]">PetQuery</p>
                    <p className="text-xs text-gray-500">Veterinary clinical assistant</p>
                </div>
                <p className="text-xs font-semibold text-[#3468bd] bg-[#eef4fc] px-2.5 py-1 rounded-full shrink-0">
                    {remaining == null ? '…' : `${remaining} of ${limit} left`}
                </p>
            </div>
            )}

            {messages.length === 0 && !loading && (
                <div className={`p-3.5 space-y-2.5 ${fill ? 'flex-1 min-h-0 overflow-y-auto' : ''}`}>
                    <p className="text-sm text-gray-500 px-1">Tap a case, or type your own.</p>
                    {STARTERS.map((s) => (
                        <button
                            key={s.question}
                            type="button"
                            disabled={locked}
                            onClick={() => ask(s.question)}
                            className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 active:scale-[0.98] disabled:opacity-50"
                        >
                            <h4 className="text-[#3468bd] font-semibold mb-1.5 text-sm">{s.category}</h4>
                            <p className="text-gray-700 text-sm leading-relaxed">{s.question}</p>
                        </button>
                    ))}
                </div>
            )}

            {(messages.length > 0 || loading) && (
                <div ref={listRef} className={`px-3.5 py-4 overflow-y-auto ${fill ? 'flex-1 min-h-0' : 'max-h-[62vh]'}`}>
                    {messages.map((m, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 8, scale: 0.99 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className={`flex mb-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {m.role === 'user' ? (
                                <div className="max-w-[86%] bg-[#3468bd] text-white rounded-[20px] rounded-br-md px-4 py-2.5 text-sm shadow-sm whitespace-pre-wrap">
                                    {m.content}
                                </div>
                            ) : (
                                <div className="max-w-[94%] bg-white text-gray-800 rounded-[20px] rounded-bl-md px-4 py-3 text-sm border border-gray-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.05)]">
                                    <FormattedQueryMessage content={m.content} />
                                </div>
                            )}
                        </motion.div>
                    ))}
                    {loading && <ThinkingLoader />}
                </div>
            )}

            {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

            {locked ? (
                <div className="p-4 bg-white border-t border-gray-100">
                    <p className="text-base font-extrabold text-[#1a2b4a] mb-1">
                        Wow. You’ve used up your demo.
                    </p>
                    <p className="text-sm text-gray-600 mb-3">
                        Those were real answers. Sign up and keep asking for 10 days. Unlimited. No credit card.
                    </p>
                    <button
                        type="button"
                        onClick={onSignup}
                        className="w-full rounded-full bg-[#5cccf0] text-white font-medium py-3.5"
                    >
                        Start my free 10 days
                    </button>
                </div>
            ) : (
                <form
                    className="bg-white border-t border-gray-200/80 px-3.5 pt-2.5 pb-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        ask(input);
                    }}
                >
                    <div className="relative flex items-end rounded-[23px] border bg-gray-100 border-gray-200 focus-within:bg-white focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            maxLength={500}
                            disabled={loading}
                            placeholder="Ask a clinical question…"
                            className="w-full bg-transparent border-0 outline-none px-4 py-3 text-[16px] placeholder-gray-400"
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="m-1.5 shrink-0 rounded-full bg-[#3468bd] text-white px-3.5 py-2 text-sm font-medium disabled:opacity-40"
                        >
                            Ask
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default PetQueryDemo;
