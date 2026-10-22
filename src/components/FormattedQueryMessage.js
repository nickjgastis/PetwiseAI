import React from 'react';

const renderInline = (text, soft = false) => {
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
                return (
                    <strong key={i} className={soft ? 'font-medium text-[#13233f]' : 'font-semibold text-[#13233f]'}>
                        {part.slice(2, -2)}
                    </strong>
                );
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
const NOTE_CLASS = 'mt-3 pl-3.5 border-l-2 border-[#2d5fb8]/25 text-[14px] leading-[1.65] text-[#1a2b4a]/85';

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
        if (!line.startsWith('-') && (m = line.match(FIELD_LINE))) {
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

    let recBuf = null;
    const recommendation = (text) => {
        if (!recBuf) recBuf = [];
        if (text && !/^recommendations?:?$/i.test(text.trim())) recBuf.push(text);
    };
    const flushRec = () => {
        if (!recBuf) return;
        const items = recBuf;
        recBuf = null;
        if (items.length === 0) return;
        out.push(
            <div key={key++} className="mt-7 rounded-[18px] bg-white border border-[#2d5fb8]/15 px-5 py-4 shadow-[0_12px_30px_-22px_rgba(45,95,184,0.45)]">
                <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#2d5fb8] mb-2">
                    {items.length > 1 ? 'Recommendations' : 'Recommendation'}
                </div>
                {items.length === 1 ? (
                    <p className="text-[#13233f]">{renderInline(items[0])}</p>
                ) : (
                    items.map((item, i) => (
                        <div key={i} className="flex gap-2.5 my-1 text-[#13233f]">
                            <span className="mt-[0.7em] h-1.5 w-1.5 rounded-full bg-[#2d5fb8] shrink-0" />
                            <span className="flex-1 min-w-0">{renderInline(item)}</span>
                        </div>
                    ))
                )}
            </div>
        );
        sectionCount++;
    };
    const isRecText = (s) => /^\*{0,2}recommendations?\b/i.test(s);
    const recStrip = (s) => stripBold(s).replace(/^recommendations?:?\s*/i, '');

    const NAME_LABEL = /^(drug(\s+name)?|medication|med|name|product)$/i;
    const noteRow = (f, i) => (
        <p key={i} className={NOTE_CLASS}>
            <span className="font-semibold text-[#13233f]">{renderInline(f.label)}: </span>
            {renderInline(f.value)}
        </p>
    );
    const DOSING_LABEL = /^(dose|dosage|dosing|route|frequency|duration|interval|max(imum)?\s+dose|concentration|formulation)$/i;
    const plainRows = (rows, inline = false) => {
        const fields = rows.filter((r) => !isNotesLabel(r.label));
        const notes = rows.filter((r) => isNotesLabel(r.label));
        const stacked = !inline && !fields.some((r) => DOSING_LABEL.test(r.label)) && fields.some((r) => stripBold(r.value).length > 70);
        return (
            <>
                {stacked ? (
                    <div className="space-y-4">
                        {fields.map((f, i) => (
                            <div key={i}>
                                <div className="font-semibold text-[#13233f]">{renderInline(f.label)}</div>
                                <div className="mt-0.5">{renderInline(f.value, true)}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-1">
                        {fields.map((f, i) => (
                            <p key={i}>
                                <span className="font-semibold text-[#13233f]">{renderInline(f.label)}: </span>
                                {renderInline(f.value)}
                            </p>
                        ))}
                    </div>
                )}
                {notes.map(noteRow)}
            </>
        );
    };

    let fieldBuf = [];
    const flushFields = () => {
        if (fieldBuf.length === 0) return;
        const rows = fieldBuf;
        fieldBuf = [];

        const groups = [];
        let seen = new Set();
        rows.forEach((r) => {
            const k = r.label.toLowerCase();
            const startsGroup = groups.length === 0 || seen.has(k) || (NAME_LABEL.test(r.label) && seen.size > 0);
            if (startsGroup) {
                groups.push([]);
                seen = new Set();
            }
            seen.add(k);
            groups[groups.length - 1].push(r);
        });

        const named = groups.some((g) => NAME_LABEL.test(g[0].label));
        if (groups.length === 1 && !named) {
            out.push(
                <div key={key++} className="my-3">
                    {plainRows(rows)}
                </div>
            );
            return;
        }

        out.push(
            <div key={key++} className="my-3">
                {groups.map((g, i) => {
                    const hasName = NAME_LABEL.test(g[0].label);
                    return (
                        <div key={i} className={i > 0 ? 'mt-5 pt-5 border-t border-[#2d5fb8]/10' : ''}>
                            {hasName && (
                                <div className="mb-1.5 text-[15px] md:text-[16px] font-semibold text-[#13233f]">{renderInline(stripBold(g[0].value))}</div>
                            )}
                            {plainRows(hasName ? g.slice(1) : g, hasName)}
                        </div>
                    );
                })}
            </div>
        );
    };

    tokens.forEach((t) => {
        const continuesRun = t.type === 'field' && t.value.trim() && (!isNotesLabel(t.label) || fieldBuf.length > 0);
        if (!continuesRun) flushFields();
        if (recBuf) {
            if (t.type === 'bullet' || (t.type === 'text' && !/^\*{0,2}additional notes/i.test(t.text))) {
                recommendation(isRecText(t.text) ? recStrip(t.text) : t.text);
                return;
            }
            if (t.type === 'subitem') {
                recommendation(isRecText(t.text) ? recStrip(t.text) : t.text);
                return;
            }
            if (t.type === 'field' && !isNotesLabel(t.label)) {
                recommendation(`**${t.label}:** ${t.value}`);
                return;
            }
            if (!(t.type === 'section' && /^recommendation/i.test(t.header))) flushRec();
        }

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
                if (isRecText(t.text)) {
                    recommendation(recStrip(t.text));
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
                if (isRecText(t.text)) {
                    recommendation(recStrip(t.text));
                    break;
                }
                out.push(
                    <h5 key={key++} className="mt-5 mb-1.5 font-semibold text-[#13233f]">
                        {renderInline(t.text)}
                    </h5>
                );
                break;

            case 'field':
                if (isNotesLabel(t.label) && fieldBuf.length > 0) {
                    fieldBuf.push(t);
                } else if (isNotesLabel(t.label)) {
                    out.push(
                        <p key={key++} className={NOTE_CLASS}>
                            <span className="font-semibold text-[#13233f]">{t.label}: </span>
                            {renderInline(t.value)}
                        </p>
                    );
                } else if (!t.value.trim()) {
                    out.push(
                        <h5 key={key++} className="mt-5 mb-1.5 font-semibold text-[#13233f]">
                            {renderInline(t.label)}
                        </h5>
                    );
                } else {
                    fieldBuf.push(t);
                }
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
                if (isRecText(t.text)) {
                    recommendation(recStrip(t.text));
                } else if (/^\*{0,2}additional notes/i.test(t.text)) {
                    const body = stripBold(t.text).replace(/^additional notes:?\s*/i, '');
                    out.push(
                        <p key={key++} className={NOTE_CLASS}>
                            <span className="font-semibold text-[#13233f]">Additional notes{body ? ': ' : ''}</span>
                            {renderInline(body)}
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
    flushFields();
    flushRec();

    return <div className="text-sm md:text-[15px] leading-[1.7] text-[#1a2b4a]">{out}</div>;
};

export default FormattedQueryMessage;
