import React from 'react';

const renderInline = (text) => {
    const s = String(text ?? '')
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\quad/g, '    ')
        .replace(/\\qquad/g, '        ')
        .replace(/\\[,:;]/g, ' ')
        .replace(/\{([^}]+)\}/g, '$1');

    return s
        .split(/(\*\*[^*]+\*\*|\\\([\s\S]*?\\\)|\$[^$]+\$)/g)
        .map((part, i) => {
            if (!part) return null;
            if (/^\*\*[^*]+\*\*$/.test(part)) {
                return <strong key={i} className="font-semibold text-[#13233f]">{part.slice(2, -2)}</strong>;
            }
            if (/^\\\([\s\S]*\\\)$/.test(part)) {
                return <span key={i} className="font-serif italic text-[#2d5fb8]">{part.slice(2, -2).trim()}</span>;
            }
            if (/^\$[^$]+\$$/.test(part)) {
                return <span key={i} className="font-serif italic text-[#2d5fb8]">{part.slice(1, -1)}</span>;
            }
            return part;
        });
};

const stripBold = (t) => String(t ?? '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\{([^}]+)\}/g, '$1');

const FIELD_LINE = /^(?:-\s+)?\*\*([^*]{1,40}?):\*\*\s*(.*)$/;

const Callout = ({ text }) => (
    <div className="mt-6 rounded-[18px] bg-white border border-[#2d5fb8]/15 px-5 py-4 shadow-[0_10px_30px_-24px_rgba(19,35,63,0.4)]">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#2d5fb8] mb-1.5">Recommendation</div>
        <div className="text-[#13233f]">{renderInline(text)}</div>
    </div>
);

const FormattedQueryMessage = ({ content }) => {
    const rawLines = String(content ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l !== '' && l !== '---');

    const tokens = [];
    let expectedTop = 1;

    rawLines.forEach((line, idx) => {
        if (idx === 0) {
            tokens.push({ type: 'title', text: stripBold(line) });
            return;
        }

        let m;
        if ((m = line.match(/^#{2,4}\s+(.*)$/))) {
            tokens.push({ type: 'header', text: stripBold(m[1]) });
            return;
        }
        if ((m = line.match(/^(\d+)\.\s+(.*)$/))) {
            const num = parseInt(m[1], 10);
            const rest = m[2];
            const h = rest.match(/^\*\*(.*?):?\*\*:?\s*(.*)$/);
            const headText = h ? h[1] : null;
            const leadText = h ? h[2] : null;

            if (num === expectedTop) {
                expectedTop = num + 1;
                tokens.push({
                    type: 'section',
                    num,
                    header: headText ?? stripBold(rest).replace(/:$/, ''),
                    lead: headText ? leadText : '',
                    plain: !headText && !/:$/.test(rest)
                });
            } else {
                tokens.push({ type: 'subitem', num, text: rest });
            }
            return;
        }
        if ((m = line.match(FIELD_LINE))) {
            if (/^recommendation/i.test(m[1])) {
                tokens.push({ type: 'text', text: `Recommendation: ${m[2]}` });
            } else {
                tokens.push({ type: 'field', label: m[1], value: m[2] });
            }
            return;
        }
        if ((m = line.match(/^\*\*(.*?):?\*\*:?\s*$/))) {
            tokens.push({ type: 'header', text: m[1] });
            return;
        }
        if ((m = line.match(/^-\s+(.*)$/))) {
            tokens.push({ type: 'bullet', text: m[1] });
            return;
        }
        tokens.push({ type: 'text', text: line });
    });

    const out = [];
    let insideSection = false;
    let fieldBuf = [];
    let key = 0;

    const isNotesLabel = (label) => /^(additional\s+)?notes?$/i.test(label);
    const indent = () => (insideSection ? 'sm:ml-[38px]' : '');

    const flushFields = () => {
        if (fieldBuf.length === 0) return;
        const rows = fieldBuf;
        fieldBuf = [];
        out.push(
            <div
                key={key++}
                className={`${indent()} my-3 rounded-[18px] bg-white/80 border border-[#2d5fb8]/10 px-5 py-3.5 grid grid-cols-1 sm:grid-cols-[minmax(96px,max-content)_1fr] gap-x-6 gap-y-1.5`}
            >
                {rows.map((f, i) =>
                    isNotesLabel(f.label) ? (
                        <div key={i} className="sm:col-span-2 mt-1 pt-2 border-t border-[#2d5fb8]/10 text-[13px] leading-relaxed text-[#1a2b4a]/60">
                            <span className="font-semibold text-[#1a2b4a]/70">{f.label}: </span>
                            {renderInline(f.value)}
                        </div>
                    ) : (
                        <React.Fragment key={i}>
                            <div className="text-[13px] font-semibold text-[#1a2b4a]/55 sm:pt-px">{f.label}</div>
                            <div className="text-[#13233f] mb-1 sm:mb-0">{renderInline(f.value)}</div>
                        </React.Fragment>
                    )
                )}
            </div>
        );
    };

    tokens.forEach((t) => {
        if (t.type !== 'field') flushFields();

        switch (t.type) {
            case 'title':
                out.push(
                    <h3 key={key++} className="text-[17px] md:text-[19px] font-bold tracking-[-0.01em] text-[#13233f] pb-3.5 mb-5 border-b border-[#2d5fb8]/10">
                        {renderInline(t.text)}
                    </h3>
                );
                break;

            case 'section': {
                insideSection = true;
                if (/^recommendation/i.test(t.header)) {
                    insideSection = false;
                    out.push(<Callout key={key++} text={t.lead || t.header} />);
                    break;
                }
                out.push(
                    <div key={key++} className="flex items-start gap-3.5 mt-7 mb-2 first:mt-0">
                        <span className="mt-[1px] w-6 h-6 shrink-0 rounded-full bg-[#2d5fb8]/10 text-[#2d5fb8] text-[12px] font-bold flex items-center justify-center">
                            {t.num}
                        </span>
                        {t.plain ? (
                            <span className="flex-1 min-w-0">{renderInline(t.header)}</span>
                        ) : (
                            <span className="flex-1 min-w-0 text-[15px] md:text-[16px] font-semibold text-[#13233f]">
                                {renderInline(t.header)}
                                {t.lead ? <span className="block mt-1 text-[14px] md:text-[15px] font-normal text-[#1a2b4a]">{renderInline(t.lead)}</span> : null}
                            </span>
                        )}
                    </div>
                );
                break;
            }

            case 'subitem': {
                if (/^\*{0,2}recommendation/i.test(t.text)) {
                    out.push(<Callout key={key++} text={stripBold(t.text).replace(/^recommendation:?\s*/i, '')} />);
                    break;
                }
                const sub = t.text.match(/^\*\*(.*?):?\*\*:?\s*$/);
                if (sub) {
                    out.push(
                        <div key={key++} className={`${indent()} mt-4 mb-1.5 font-semibold text-[#13233f]`}>
                            {t.num}. {renderInline(sub[1])}
                        </div>
                    );
                } else {
                    out.push(
                        <div key={key++} className={`${indent()} flex gap-2.5 items-baseline my-1.5`}>
                            <span className="w-[18px] shrink-0 text-right font-semibold text-[#2d5fb8]/60">{t.num}.</span>
                            <span className="flex-1 min-w-0">{renderInline(t.text)}</span>
                        </div>
                    );
                }
                break;
            }

            case 'header':
                insideSection = false;
                out.push(
                    <div key={key++} className="mt-6 mb-2 text-[15px] md:text-[16px] font-semibold text-[#13233f]">
                        {renderInline(t.text)}
                    </div>
                );
                break;

            case 'field':
                fieldBuf.push(t);
                break;

            case 'bullet':
                out.push(
                    <div key={key++} className={`${indent()} flex gap-3 my-1.5`}>
                        <span className="mt-[0.7em] h-1.5 w-1.5 rounded-full bg-[#2d5fb8]/45 shrink-0" />
                        <span className="flex-1 min-w-0">{renderInline(t.text)}</span>
                    </div>
                );
                break;

            default:
                if (/^\*{0,2}recommendation/i.test(t.text)) {
                    out.push(<Callout key={key++} text={stripBold(t.text).replace(/^recommendation:?\s*/i, '')} />);
                } else if (/^\*{0,2}additional notes/i.test(t.text)) {
                    out.push(
                        <div key={key++} className={`${indent()} mt-3 mb-1 text-[13px] text-[#1a2b4a]/60`}>
                            {renderInline(stripBold(t.text))}
                        </div>
                    );
                } else {
                    out.push(
                        <div key={key++} className={`${indent()} my-2`}>
                            {renderInline(t.text)}
                        </div>
                    );
                }
        }
    });
    flushFields();

    return <div className="text-sm md:text-[15px] leading-[1.7] text-[#1a2b4a]">{out}</div>;
};

export default FormattedQueryMessage;
