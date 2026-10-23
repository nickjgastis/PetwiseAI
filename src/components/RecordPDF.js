import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { DentalPages } from './DentalPDF';

const INK = '#000000';
const MUTED = '#6b7689';

// Same look as the dental PDF; the eyebrow takes the record type's color.
const TYPES = {
    soap: { eyebrow: 'SOAP RECORD', color: '#2563eb' },
    summary: { eyebrow: 'SUMMARY', color: '#059669' },
    callback: { eyebrow: 'CALLBACK', color: '#d97706' }
};

const SOAP_SECTIONS = new Set(['subjective', 'objective', 'assessment', 'plan']);

const styles = StyleSheet.create({
    page: { paddingTop: 34, paddingBottom: 46, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 10, color: INK },
    eyebrow: { fontSize: 8, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
    title: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
    sub: { fontSize: 9, color: MUTED, marginBottom: 8 },
    section: { fontSize: 11.5, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e7ecf3' },
    heading: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 2 },
    body: { fontSize: 10.5, lineHeight: 1.5 },
    gap: { height: 6 },
    footer: { position: 'absolute', bottom: 18, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: '#9aa3b2' }
});

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
const toBlocks = (text, type) => {
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

// "**Weight:** 12.4 kg" keeps its label bold.
const renderInline = (text) =>
    text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
        /^\*\*[^*]+\*\*$/.test(part)
            ? <Text key={i} style={{ fontFamily: 'Helvetica-Bold' }}>{part.slice(2, -2)}</Text>
            : part.replace(/\*\*/g, '')
    );

const printedOn = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export const TextRecordPage = ({ reportText, title, type = 'soap' }) => {
    const info = TYPES[type] || TYPES.soap;
    const blocks = toBlocks(reportText, type);
    return (
        <Page size="A4" style={styles.page}>
            <Text style={[styles.eyebrow, { color: info.color }]}>{info.eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub}>{printedOn()}</Text>
            {blocks.map((b, i) => {
                if (b.kind === 'gap') return <View key={i} style={styles.gap} />;
                if (b.kind === 'section') {
                    return <Text key={i} style={[styles.section, i === 0 && { borderTopWidth: 0, marginTop: 6 }]} minPresenceAhead={30}>{b.text}</Text>;
                }
                if (b.kind === 'heading') return <Text key={i} style={styles.heading} minPresenceAhead={24}>{b.text}</Text>;
                return <Text key={i} style={styles.body}>{renderInline(b.text)}</Text>;
            })}
            <View style={styles.footer} fixed>
                <Text>{title}</Text>
                <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
            </View>
        </Page>
    );
};

export const QuickSOAPPDFDocument = ({ reportText, title, type }) => (
    <Document title={title}>
        <TextRecordPage reportText={reportText} title={title} type={type} />
    </Document>
);

// Several records of one case in a single file, each starting on a new page.
// records: [{ id, title, type, text, dental }]
export const CaseRecordsPDF = ({ title, records }) => (
    <Document title={title}>
        {records.map((r) =>
            r.type === 'dental' ? (
                <DentalPages key={r.id} title={r.title} report={r.text} dental={r.dental} />
            ) : (
                <TextRecordPage key={r.id} title={r.title} reportText={r.text} type={r.type} />
            )
        )}
    </Document>
);
