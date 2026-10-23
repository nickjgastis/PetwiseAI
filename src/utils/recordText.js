// Turns generated record text (with the model's **markdown**) into clean blocks, shared by the PDFs and Copy.

const SOAP_SECTIONS = new Set(['subjective', 'objective', 'assessment', 'plan']);

const clean = (line) => line.replace(/\*\*/g, '').replace(/^#{1,6}\s*/, '').trim();

// A short line that labels what follows: "Plan:", "**Diagnostics**", or a plain "Next steps" that opens a block.
// Plain lines inside a block ("Vaccinations current") and "Label: value" lines stay body text.
const isHeadingLine = (lines, i) => {
    const t = lines[i].trim();
    if (!t || !lines.slice(i + 1).some((l) => l.trim())) return false;
    if (/^\*\*[^*]+\*\*:?$/.test(t) || /^#{1,6}\s/.test(t)) return true;
    const c = clean(t);
    if (c.length > 40 || /^[-•*\d]/.test(c)) return false;
    if (/:$/.test(c)) return !c.slice(0, -1).includes(':');
    const opensBlock = i === 0 || !lines[i - 1].trim();
    return opensBlock && !c.includes(':') && /^[A-Z]/.test(c) && !/[.,;!?)]$/.test(c) && c.split(/\s+/).length <= 5 && !!lines[i + 1]?.trim();
};

// [{ kind: 'section' | 'heading' | 'text' | 'gap', text, color }]
export const toBlocks = (text, type) => {
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    const blocks = [];
    let para = [];
    const flush = () => {
        if (para.length) blocks.push({ kind: 'text', text: para.join('\n') });
        para = [];
    };
    lines.forEach((line, i) => {
        if (!line.trim()) {
            flush();
            if (blocks.length && blocks[blocks.length - 1].kind === 'text') blocks.push({ kind: 'gap' });
            return;
        }
        if (isHeadingLine(lines, i)) {
            flush();
            const label = clean(line).replace(/:$/, '');
            blocks.push({ kind: type === 'soap' && SOAP_SECTIONS.has(label.toLowerCase()) ? 'section' : 'heading', text: label });
            return;
        }
        para.push(line);
    });
    flush();
    // SOAP output repeats a section name as its first sub-heading ("Assessment" then "Assessment:"),
    // and sub-headings with nothing under them are dropped.
    const isHead = (b) => b && (b.kind === 'section' || b.kind === 'heading');
    const out = [];
    blocks.forEach((b, i) => {
        const prev = out.filter((x) => x.kind !== 'gap').pop();
        if (isHead(b) && isHead(prev) && prev.text.toLowerCase() === b.text.toLowerCase()) return;
        if (b.kind === 'heading') {
            const next = blocks.slice(i + 1).find((x) => x.kind !== 'gap');
            if (!next || isHead(next)) return;
        }
        out.push(b);
    });
    return out;
};

// Clipboard version: no markdown, no repeated or empty sub-headings.
export const toPlainText = (text, type) => {
    const out = [];
    const blank = () => out.length && out[out.length - 1] !== '' && out.push('');
    toBlocks(text, type).forEach((b) => {
        if (b.kind === 'section') {
            blank();
            out.push(b.text);
        } else if (b.kind === 'heading') {
            blank();
            out.push(`${b.text}:`);
        } else if (b.kind === 'gap') {
            blank();
        } else {
            out.push(b.text.replace(/\*\*/g, '').replace(/^#{1,6}\s*/gm, ''));
        }
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
