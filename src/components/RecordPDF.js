import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { DentalPages } from './DentalPDF';
import { toBlocks } from '../utils/recordText';

const INK = '#000000';
const MUTED = '#6b7689';

// Same look as the dental PDF.
const TYPES = {
    soap: { eyebrow: 'SOAP RECORD' },
    summary: { eyebrow: 'SUMMARY' },
    callback: { eyebrow: 'CALLBACK' }
};

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
            <Text style={styles.eyebrow}>{info.eyebrow}</Text>
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
