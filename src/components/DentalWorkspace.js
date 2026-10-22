import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PiTooth } from 'react-icons/pi';
import { FiCopy, FiPrinter, FiX } from 'react-icons/fi';
import DentalChartCanvas from './DentalChartCanvas';

const FONT = { fontFamily: 'var(--font-sans)' };
const HEAD_BTN = 'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-semibold border-none cursor-pointer transition-colors';

// One-card dental record: text on the left, zoomable chart on the right (stacked, chart first, below xl).
const DentalWorkspace = ({ report, onReportChange, dental, onDentalChange, onCopy, onPrint, copied }) => {
    const [expanded, setExpanded] = useState(false);
    const textRef = useRef(null);
    const value = dental || { species: 'canine', teeth: {} };

    // Text grows with its content so the page scrolls, not the box, while the chart stays pinned.
    useLayoutEffect(() => {
        const el = textRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [report]);

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

            <div className="grid xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <div className="order-last xl:order-none min-w-0 xl:border-r border-[#eef2f7]">
                    <textarea
                        ref={textRef}
                        value={report}
                        onChange={(e) => onReportChange(e.target.value)}
                        placeholder="Your dental record will appear here..."
                        className="block w-full px-6 py-5 border-none focus:outline-none resize-none overflow-hidden text-gray-800 bg-transparent rounded-b-2xl xl:rounded-br-none"
                        style={{ ...FONT, fontSize: '14px', lineHeight: '1.8', minHeight: '360px', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
                    />
                </div>
                <div className="min-w-0 self-start xl:sticky xl:top-4 border-b xl:border-b-0 border-[#eef2f7]">
                    <DentalChartCanvas
                        dental={value}
                        onChange={onDentalChange}
                        maxHeight="max(420px, min(calc(100vh - 250px), 680px))"
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
                                className="w-full max-w-[1080px] max-h-full overflow-y-auto rounded-[28px] bg-white shadow-[0_40px_90px_-30px_rgba(11,21,38,0.55)]"
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
                                <DentalChartCanvas dental={value} onChange={onDentalChange} maxHeight="max(360px, calc(100vh - 290px))" />
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
