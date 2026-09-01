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
                return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
            }
            if (/^\\\([\s\S]*\\\)$/.test(part)) {
                return <span key={i} className="font-serif italic text-primary-700">{part.slice(2, -2).trim()}</span>;
            }
            if (/^\$[^$]+\$$/.test(part)) {
                return <span key={i} className="font-serif italic text-primary-700">{part.slice(1, -1)}</span>;
            }
            return part;
        });
};

const stripBold = (t) => String(t ?? '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\{([^}]+)\}/g, '$1');

const FIELD_LINE = /^(?:-\s+)?\*\*([^*]{1,40}?):\*\*\s*(.*)$/;

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

    const flushFields = () => {
        if (fieldBuf.length === 0) return;
        const rows = fieldBuf;
        fieldBuf = [];
        out.push(
            <div key={key++} className={`${insideSection ? 'ml-[26px]' : ''} my-3 space-y-1`}>
                {rows.map((f, i) =>
                    isNotesLabel(f.label) ? (
                        <div key={i} className="text-[13px] leading-relaxed text-gray-500">
                            <span className="font-semibold text-gray-600">{f.label}: </span>
                            {renderInline(f.value)}
                        </div>
                    ) : (
                        <div key={i} className="leading-relaxed">
                            <span className="font-semibold text-gray-900">{f.label}: </span>
                            {renderInline(f.value)}
                        </div>
                    )
                )}
            </div>
        );
    };

    const indent = () => (insideSection ? 'ml-[26px]' : '');

    tokens.forEach((t) => {
        if (t.type !== 'field') flushFields();

        switch (t.type) {
            case 'title':
                out.push(
                    <h3 key={key++} className="text-[15px] md:text-base font-bold text-gray-900 pb-2.5 mb-3 border-b border-gray-200/80">
                        {renderInline(t.text)}
                    </h3>
                );
                break;

            case 'section': {
                insideSection = true;
                const isRec = /^recommendation/i.test(t.header);
                if (isRec) {
                    insideSection = false;
                    out.push(
                        <div key={key++} className="mt-4 rounded-lg bg-primary-50 border-l-[3px] border-primary-500 px-3.5 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-primary-700 mb-1">Recommendation</div>
                            <div>{renderInline(t.lead || t.header)}</div>
                        </div>
                    );
                    break;
                }
                out.push(
                    <div key={key++} className="flex items-baseline gap-2 mt-5 mb-1.5 first:mt-0">
                        <span className="w-[18px] shrink-0 text-right font-bold text-primary-600">{t.num}.</span>
                        {t.plain ? (
                            <span>{renderInline(t.header)}</span>
                        ) : (
                            <span className="font-semibold text-gray-900">
                                {renderInline(t.header)}
                                {t.lead ? <span className="font-normal text-gray-800"> — {renderInline(t.lead)}</span> : null}
                            </span>
                        )}
                    </div>
                );
                break;
            }

            case 'subitem': {
                const isRec = /^\*{0,2}recommendation/i.test(t.text);
                if (isRec) {
                    out.push(
                        <div key={key++} className="mt-4 rounded-lg bg-primary-50 border-l-[3px] border-primary-500 px-3.5 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-primary-700 mb-1">Recommendation</div>
                            <div>{renderInline(stripBold(t.text).replace(/^recommendation:?\s*/i, ''))}</div>
                        </div>
                    );
                    break;
                }
                const sub = t.text.match(/^\*\*(.*?):?\*\*:?\s*$/);
                if (sub) {
                    out.push(
                        <div key={key++} className={`${indent()} mt-3 mb-1 font-semibold text-gray-800`}>
                            {t.num}. {renderInline(sub[1])}
                        </div>
                    );
                } else {
                    out.push(
                        <div key={key++} className={`${indent()} flex gap-2 items-baseline my-1`}>
                            <span className="w-[18px] shrink-0 text-right font-semibold text-gray-400">{t.num}.</span>
                            <span className="flex-1 min-w-0">{renderInline(t.text)}</span>
                        </div>
                    );
                }
                break;
            }

            case 'header':
                insideSection = false;
                out.push(
                    <div key={key++} className="mt-4 mb-1.5 font-semibold text-gray-900">
                        {renderInline(t.text)}
                    </div>
                );
                break;

            case 'field':
                fieldBuf.push(t);
                break;

            case 'bullet':
                out.push(
                    <div key={key++} className={`${indent()} flex gap-2.5 my-1`}>
                        <span className="mt-[9px] h-1 w-1 rounded-full bg-gray-300 shrink-0" />
                        <span className="flex-1 min-w-0">{renderInline(t.text)}</span>
                    </div>
                );
                break;

            default:
                if (/^\*{0,2}recommendation/i.test(t.text)) {
                    out.push(
                        <div key={key++} className="mt-4 rounded-lg bg-primary-50 border-l-[3px] border-primary-500 px-3.5 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-primary-700 mb-1">Recommendation</div>
                            <div>{renderInline(stripBold(t.text).replace(/^recommendation:?\s*/i, ''))}</div>
                        </div>
                    );
                } else if (/^\*{0,2}additional notes/i.test(t.text)) {
                    out.push(
                        <div key={key++} className={`${indent()} mt-3 mb-1 text-[13px] text-gray-500`}>
                            {renderInline(stripBold(t.text))}
                        </div>
                    );
                } else {
                    out.push(
                        <div key={key++} className={`${indent()} my-1.5`}>
                            {renderInline(t.text)}
                        </div>
                    );
                }
        }
    });
    flushFields();

    return <div className="text-sm md:text-[15px] leading-relaxed text-gray-800">{out}</div>;
};

export default FormattedQueryMessage;
