import React from 'react';
import { Document, Page, Text, StyleSheet } from '@react-pdf/renderer';
import { DentalPages } from './DentalPDF';

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 12,
        fontFamily: 'Helvetica',
        lineHeight: 1.2
    },
    title: {
        fontSize: 16,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 20
    },
    text: {
        marginBottom: 0,
        whiteSpace: 'pre-wrap',
        fontFamily: 'Helvetica'
    },
    strongText: {
        fontFamily: 'Helvetica-Bold',
        marginBottom: 0,
        fontSize: 12
    },
    lineBreak: {
        height: 8
    }
});

const HEADER = /^(Subjective|Objective|Assessment|Plan|Problem List|Primary Diagnosis|Differential Diagnoses|Prognosis|Treatment|Monitoring|Client Communication|Follow-up|Follow-Up|Presenting Complaint|History|Owner Observations|Physical Exam|Vital Signs|Diagnostics):$/i;

const renderContent = (content) => {
    if (!content) return null;
    return content.split('\n').map((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
            return <Text key={`break-${index}`} style={styles.lineBreak}>{'\n'}</Text>;
        }
        const isBold = (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) || HEADER.test(trimmedLine);
        if (isBold) {
            return (
                <Text key={index} style={styles.strongText}>
                    {trimmedLine.replace(/^\*\*|\*\*$/g, '')}
                    {'\n'}
                </Text>
            );
        }
        return (
            <Text key={index} style={styles.text}>
                {line.replace(/\*\*/g, '').replace(/#{1,6}\s*/g, '')}
                {'\n'}
            </Text>
        );
    });
};

export const TextRecordPage = ({ reportText, title }) => (
    <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        {renderContent(reportText)}
    </Page>
);

export const QuickSOAPPDFDocument = ({ reportText, title }) => (
    <Document>
        <TextRecordPage reportText={reportText} title={title} />
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
                <TextRecordPage key={r.id} title={r.title} reportText={r.text} />
            )
        )}
    </Document>
);
