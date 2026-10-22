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

const SECTION_BREAK = 'mt-7 pt-6 border-t border-[#2d5fb8]/10';

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
    let sectionCount = 0;
    let key = 0;

    const isNotesLabel = (label) => /^(additional\s+)?notes?$/i.test(label);

    const sectionHeading = (label, lead) => {
        out.push(
            <div key={key++} className={sectionCount > 0 ? SECTION_BREAK : ''}>
                <h4 className="text-[16px] md:text-[17px] font-semibold tracking-[-0.01em] text-[#13233f]">{renderInline(label)}</h4>
                {lead ? <p className="mt-1.5">{renderInline(lead)}</p> : null}
            </div>
        );
        sectionCount++;
    };

    const recommendation = (text) => sectionHeading('Recommendation', text);

    tokens.forEach((t) => {
        switch (t.type) {
            case 'title':
                out.push(
                    <h3 key={key++} className="text-[18px] md:text-[20px] font-bold tracking-[-0.015em] text-[#13233f] mb-5">
                        {renderInline(t.text)}
                    </h3>
                );
                break;

            case 'section':
                if (/^recommendation/i.test(t.header)) {
                    recommendation(t.lead || t.header);
                } else if (t.plain) {
                    out.push(
                        <p key={key++} className="my-2">
                            {t.num}. {renderInline(t.header)}
                        </p>
                    );
                } else {
                    sectionHeading(`${t.num}. ${t.header}`, t.lead);
                }
                break;

            case 'subitem': {
                if (/^\*{0,2}recommendation/i.test(t.text)) {
                    recommendation(stripBold(t.text).replace(/^recommendation:?\s*/i, ''));
                    break;
                }
                const sub = t.text.match(/^\*\*(.*?):?\*\*:?\s*$/);
                out.push(
                    sub ? (
                        <h5 key={key++} className="mt-5 mb-1.5 font-semibold text-[#13233f]">
                            {renderInline(sub[1])}
                        </h5>
                    ) : (
                        <div key={key++} className="flex gap-2 my-1">
                            <span className="shrink-0 text-[#1a2b4a]/50">{t.num}.</span>
                            <span className="flex-1 min-w-0">{renderInline(t.text)}</span>
                        </div>
                    )
                );
                break;
            }

            case 'header':
                out.push(
                    <h5 key={key++} className="mt-5 mb-1.5 font-semibold text-[#13233f]">
                        {renderInline(t.text)}
                    </h5>
                );
                break;

            case 'field':
                out.push(
                    isNotesLabel(t.label) ? (
                        <p key={key++} className="mt-2 text-[13px] text-[#1a2b4a]/60">
                            <span className="font-semibold">{t.label}: </span>
                            {renderInline(t.value)}
                        </p>
                    ) : (
                        <p key={key++} className="my-1">
                            <span className="font-semibold text-[#13233f]">{t.label}: </span>
                            {renderInline(t.value)}
                        </p>
                    )
                );
                break;

            case 'bullet':
                out.push(
                    <div key={key++} className="flex gap-2.5 my-1">
                        <span className="mt-[0.7em] h-1 w-1 rounded-full bg-[#1a2b4a]/40 shrink-0" />
                        <span className="flex-1 min-w-0">{renderInline(t.text)}</span>
                    </div>
                );
                break;

            default:
                if (/^\*{0,2}recommendation/i.test(t.text)) {
                    recommendation(stripBold(t.text).replace(/^recommendation:?\s*/i, ''));
                } else if (/^\*{0,2}additional notes/i.test(t.text)) {
                    out.push(
                        <p key={key++} className="mt-2 text-[13px] text-[#1a2b4a]/60">
                            {renderInline(stripBold(t.text))}
                        </p>
                    );
                } else {
                    out.push(
                        <p key={key++} className="my-2">
                            {renderInline(t.text)}
                        </p>
                    );
                }
        }
    });

    return <div className="text-sm md:text-[15px] leading-[1.7] text-[#1a2b4a]">{out}</div>;
};

export default FormattedQueryMessage;
