import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PiTooth } from 'react-icons/pi';
import { FiCopy, FiPrinter, FiX } from 'react-icons/fi';
import DentalChartCanvas from './DentalChartCanvas';
import { parseSections, joinSections } from '../dental/sections';

const FONT = { fontFamily: 'var(--font-sans)' };
const HEAD_BTN = 'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-semibold border-none cursor-pointer transition-colors';

const TEXT_STYLE = { ...FONT, fontSize: '14px', lineHeight: '1.75', whiteSpace: 'pre-wrap', wordWrap: 'break-word' };

// Textarea that grows with its content so the page scrolls, not the box.
const GrowingText = ({ value, onChange, placeholder, className = '', minHeight }) => {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [value]);
    return (
        <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`block w-full border-none focus:outline-none resize-none overflow-hidden bg-transparent text-[#24324a] ${className}`}
            style={{ ...TEXT_STYLE, minHeight }}
        />
    );
};

// Record text shown as headed sections. Sections live in local state while editing (so trailing newlines
// survive) and are re-parsed only when the report changes from outside, e.g. a regenerate.
const DentalRecordText = ({ report, onReportChange }) => {
    const [sections, setSections] = useState(() => parseSections(report));
    const emitted = useRef(report);

    useEffect(() => {
        if (report === emitted.current) return;
        emitted.current = report;
        setSections(parseSections(report));
    }, [report]);

    const emit = (text) => {
        emitted.current = text;
        onReportChange(text);
    };

    if (!sections.some((s) => s.heading)) {
        return (
            <GrowingText
                value={report}
                onChange={emit}
                placeholder="Your dental record will appear here..."
                className="px-6 py-5"
                minHeight="360px"
            />
        );
    }

    const editBody = (i, body) => {
        const next = sections.map((s, j) => (j === i ? { ...s, body } : s));
        setSections(next);
        emit(joinSections(next));
    };

    return (
        <div className="px-6 py-5 space-y-5">
            {sections.map((s, i) => (
                <section key={`${i}-${s.heading || 'intro'}`}>
                    {s.heading && (
                        <h4 className="m-0 mb-1 flex items-center gap-2 text-[14.5px] font-semibold text-[#13233f] tracking-[-0.01em]" style={FONT}>
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                            {s.heading}
                        </h4>
                    )}
                    <GrowingText
                        value={s.body}
                        onChange={(body) => editBody(i, body)}
                        placeholder="Add details"
                        className="-mx-2 px-2 py-1 rounded-lg hover:bg-[#f8f9fc] focus:bg-[#f6f8fb] transition-colors"
                    />
                </section>
            ))}
        </div>
    );
};

// One-card dental record: text on the left, zoomable chart on the right (stacked, chart first, below xl).
const DentalWorkspace = ({ report, onReportChange, dental, onDentalChange, onCopy, onPrint, copied }) => {
    const [expanded, setExpanded] = useState(false);
    const value = dental || { species: 'canine', teeth: {} };

    useEffect(() => {
        if (!expanded) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape' && !e.defaultPrevented) setExpanded(false);
        };
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
        };
    }, [expanded]);

    return (
        <div className="bg-white rounded-2xl border border-gray-100" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)', ...FONT }}>
            <div className="px-5 py-2 flex items-center gap-2.5 bg-gradient-to-r from-violet-500 to-violet-600 rounded-t-2xl">
                <span className="w-6 h-6 rounded-md flex items-center justify-center text-white" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <PiTooth className="text-[13px]" />
                </span>
                <h3 className="m-0 text-white font-semibold uppercase" style={{ fontSize: '12px', letterSpacing: '0.08em' }}>
                    Dental Record
                </h3>
                <div className="ml-auto flex items-center gap-1">
                    <button type="button" onClick={onCopy} className={`${HEAD_BTN} ${copied ? 'bg-white text-violet-700' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                        <FiCopy className="text-[12px]" /> {copied ? 'Copied' : 'Copy text'}
                    </button>
                    <button type="button" onClick={onPrint} className={`${HEAD_BTN} bg-white/15 text-white hover:bg-white/25`}>
                        <FiPrinter className="text-[12px]" /> Print
                    </button>
                </div>
            </div>

            <div className="grid xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className="order-last xl:order-none min-w-0 xl:border-r border-[#eef2f7]">
                    <DentalRecordText report={report} onReportChange={onReportChange} />
                </div>
                <div className="min-w-0 self-start xl:sticky xl:top-4 border-b xl:border-b-0 border-[#eef2f7]">
                    <DentalChartCanvas
                        dental={value}
                        onChange={onDentalChange}
                        height="clamp(440px, calc(100vh - 270px), 760px)"
                        onExpand={() => setExpanded(true)}
                    />
                </div>
            </div>

            {createPortal(
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            key="dental-expanded"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-8 bg-[#0b1526]/40 backdrop-blur-[3px]"
                            onClick={(e) => e.target === e.currentTarget && setExpanded(false)}
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                                transition={{ duration: 0.26, ease: [0.2, 0.7, 0.2, 1] }}
                                className="w-full max-w-[1500px] max-h-full overflow-y-auto rounded-[28px] bg-white shadow-[0_40px_90px_-30px_rgba(11,21,38,0.55)]"
                                style={FONT}
                            >
                                <div className="flex items-center gap-2.5 px-5 pt-4">
                                    <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-violet-50 text-violet-600">
                                        <PiTooth className="text-[15px]" />
                                    </span>
                                    <h3 className="m-0 text-[15px] font-semibold text-[#13233f]">Dental chart</h3>
                                    <button type="button" onClick={() => setExpanded(false)} title="Close" className="ml-auto w-8 h-8 rounded-full flex items-center justify-center border-none cursor-pointer bg-[#f3f6fa] text-[#1a2b4a]/60 hover:text-[#13233f]">
                                        <FiX className="text-[15px]" />
                                    </button>
                                </div>
                                <DentalChartCanvas dental={value} onChange={onDentalChange} height="max(380px, calc(100vh - 290px))" />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};

export default DentalWorkspace;
