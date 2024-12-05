import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import '../styles/QuickQuery.css';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const QuickQuery = () => {
    const [messages, setMessages] = useState(() => {
        const saved = localStorage.getItem('quickQueryMessages');
        return saved ? JSON.parse(saved) : [];
    });
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const [copiedIndex, setCopiedIndex] = useState(null);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        localStorage.setItem('quickQueryMessages', JSON.stringify(messages));
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || isLoading) return;

        const userMessage = inputMessage.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const conversationHistory = [
                {
                    role: 'system',
                    content: `You are a veterinary assistant providing clear, concise responses for PROFESSIONAL VETERINARIANS ONLY. IMPORTANT: Give advice on what is asked and be as helpful as you can to the veterinarian. They need specific information, so try not to give ranges. Be specific in your answer even if it may not be totally correct. Always prefer numbered lists when answering questions. If asked for treatments, list all the possible drugs that could be used, Example, 1. Drug name Dose (mg/kg) Route of administration (IV, P.O, SQ), Frequency (SID, BID, TID, QID, EOD) Include number of days for treatment. Include medication names, specific dosages, routes of administration (e.g., oral, subcutaneous). Follow these formatting rules strictly:

1. Use double line breaks between sections
2. For lists:
   - Start each item on a new line
   - Add a line break before and after the list
   - Use proper numbering (1., 2., 3.) or bullet points (•)

3. Format structure:
   - Main explanation first
   - Lists/steps on new lines
   - Recommendations on new lines

4. Content rules:
   - Keep responses to 1-2 paragraphs
   - Use technical terms with explanations in parentheses
   - Focus on actionable advice
   - Keep medical explanations brief
   - End with clear recommendations

Example format:
Main explanation here in 1-2 sentences.

Treatment options:
1. First option
2. Second option
3. Third option

Recommendation: Final advice here.`
                },
                ...messages.slice(-5),
                {
                    role: 'user',
                    content: userMessage
                }
            ];

            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-4o-mini',
                    messages: conversationHistory,
                    max_tokens: 500,
                    temperature: 0.7,
                    top_p: 0.9,
                    frequency_penalty: 0.5,
                    presence_penalty: 0.5
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.error) {
                throw new Error(response.data.error);
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.data.choices[0].message.content
            }]);
        } catch (error) {
            console.error('Error in QuickQuery:', error);
            let errorMessage = "I'm sorry, I encountered an error. Please try again.";

            if (error.response?.data?.error === 'Daily report limit reached') {
                errorMessage = "You've reached your daily query limit. Please upgrade your plan or try again tomorrow.";
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errorMessage
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        setMessages([]);
        localStorage.removeItem('quickQueryMessages');
    };

    const handleCopy = async (text, index) => {
        await navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="qq-container">
            <div className="qq-header">
                <h2>QuickMed Query</h2>
                {messages.length > 0 && (
                    <button onClick={handleClear} className="qq-clear-button">
                        Clear Chat
                    </button>
                )}
            </div>
            <div className="qq-chat-container">
                <div className="qq-messages-container">
                    {messages.length === 0 && (
                        <div className="qq-suggestions">
                            <div
                                className="suggestion-box"
                                onClick={() => setInputMessage("What is the recommended treatment protocol for canine parvovirus?")}
                            >
                                <h4>Treatment Protocols</h4>
                                <p>What is the recommended treatment protocol for canine parvovirus?</p>
                            </div>
                            <div
                                className="suggestion-box"
                                onClick={() => setInputMessage("What are the dosages for emergency seizure management in dogs?")}
                            >
                                <h4>Emergency Medicine</h4>
                                <p>What are the dosages for emergency seizure management in dogs?</p>
                            </div>
                            <div
                                className="suggestion-box"
                                onClick={() => setInputMessage("What antibiotics are most effective for treating resistant UTIs in cats?")}
                            >
                                <h4>Medication Guidance</h4>
                                <p>What antibiotics are most effective for treating resistant UTIs in cats?</p>
                            </div>
                        </div>
                    )}
                    {messages.map((message, index) => (
                        <div key={index} className={`qq-message ${message.role}`}>
                            <div className="qq-message-content">
                                {message.content}
                                {message.role === 'assistant' && (
                                    <button
                                        className={`qq-copy-button ${copiedIndex === index ? 'copied' : ''}`}
                                        onClick={() => handleCopy(message.content, index)}
                                        aria-label="Copy message"
                                    >
                                        {copiedIndex === index ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                <path d="M7.5 3.375c0-1.036.84-1.875 1.875-1.875h.375a3.75 3.75 0 013.75 3.75v1.875C13.5 8.161 14.34 9 15.375 9h1.875A3.75 3.75 0 0121 12.75v3.375C21 17.16 20.16 18 19.125 18h-9.75A1.875 1.875 0 017.5 16.125V3.375z" />
                                                <path d="M15 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0017.25 7.5h-1.875A.375.375 0 0115 7.125V5.25zM4.875 6H6v10.125A3.375 3.375 0 009.375 19.5H16.5v1.125c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V7.875C3 6.839 3.84 6 4.875 6z" />
                                            </svg>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="qq-message assistant">
                            <div className="qq-message-content loading">
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSubmit} className="qq-input-form">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Ask a veterinary question..."
                        className="qq-message-input"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        className="qq-send-button"
                        disabled={isLoading || !inputMessage.trim()}
                        aria-label="Send message"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            width="24"
                            height="24"
                        >
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default QuickQuery; 