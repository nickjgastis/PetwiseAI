import React, { useState, useEffect } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../supabaseClient';
import '../styles/SavedReports.css';
import { FaTimes } from 'react-icons/fa';
import { pdf } from '@react-pdf/renderer';
import { Document, Page, Text, StyleSheet } from '@react-pdf/renderer';
import { createEditor } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import { withHistory } from 'slate-history';

const mainHeaders = [
    'Veterinary Medical Record:',
    'Patient Information:',
    'Client Information:',
    'Presenting Complaint:',
    'History:',
    'Physical Exam Findings:',
    'Diagnostic Tests:',
    'Assessment:',
    'Diagnosis:',
    'Differential Diagnoses:',
    'PLAN',
    'Treatment:',
    'Monitoring:',
    'Drug Interactions/Side Effects:',
    'Naturopathic Medicine:',
    'Client Communications:',
    'Follow-Up:',
    'Patient Visit Summary:',
    'Notes:'
];

const PDFDocument = ({ reportText }) => {
    const styles = StyleSheet.create({
        page: {
            padding: 40,
            fontSize: 12,
            fontFamily: 'Helvetica',
            lineHeight: 1.1
        },
        text: {
            marginBottom: 2,
            whiteSpace: 'pre-wrap',
            fontFamily: 'Helvetica'
        },
        strongText: {
            fontFamily: 'Helvetica-Bold',
            marginBottom: 8,
            marginTop: 16,
            fontSize: 12
        },
        indentedText: {
            marginLeft: 20,
            marginBottom: 2,
            fontFamily: 'Helvetica'
        }
    });

    const formatText = (text) => {
        const paragraphs = text.split('\n');
        let isInPatientInfo = false;
        let mainContent = [];
        let summaryAndNotes = [];
        let isInSummaryOrNotes = false;

        paragraphs.forEach((paragraph, index) => {
            let trimmedParagraph = paragraph.trim();
            if (!trimmedParagraph) return;

            if (trimmedParagraph === 'Patient Visit Summary:' || trimmedParagraph === 'Notes:') {
                isInSummaryOrNotes = true;
            }

            if (!isInPatientInfo) {
                trimmedParagraph = trimmedParagraph
                    .replace(/^[•\-]\s*/, '')
                    .replace(/\*\*(\w[^*]*\w)\*\*/g, '$1')
                    .trim();
            }

            if (trimmedParagraph === 'Patient Information:') {
                isInPatientInfo = true;
            } else if (mainHeaders.some(header => trimmedParagraph === header)) {
                isInPatientInfo = false;
            }

            let textElement;
            if (mainHeaders.includes(trimmedParagraph)) {
                textElement = <Text key={index} style={styles.strongText}>{trimmedParagraph}</Text>;
            } else if (isInPatientInfo) {
                textElement = <Text key={index} style={styles.text}>{trimmedParagraph}</Text>;
            } else if (paragraph.startsWith('    ')) {
                textElement = <Text key={index} style={styles.indentedText}>{trimmedParagraph}</Text>;
            } else {
                textElement = <Text key={index} style={styles.text}>{trimmedParagraph}</Text>;
            }

            if (isInSummaryOrNotes) {
                summaryAndNotes.push(textElement);
            } else {
                mainContent.push(textElement);
            }
        });

        return { mainContent, summaryAndNotes };
    };

    const { mainContent, summaryAndNotes } = formatText(reportText);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {mainContent}
            </Page>
            {summaryAndNotes.length > 0 && (
                <Page size="A4" style={styles.page}>
                    {summaryAndNotes}
                </Page>
            )}
        </Document>
    );
};

const PDFButton = ({ reportText, reportName }) => {
    const [isPreparing, setIsPreparing] = useState(false);

    const generatePDF = async () => {
        setIsPreparing(true);
        const doc = <PDFDocument reportText={reportText} />;
        const blob = await pdf(doc).toBlob();
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${reportName || 'Report'}-${new Date().toLocaleDateString()}.pdf`;
        link.click();

        URL.revokeObjectURL(url);
        setIsPreparing(false);
    };

    return (
        <button
            className="copy-button"
            onClick={generatePDF}
            disabled={isPreparing}
        >
            {isPreparing ? 'Preparing PDF...' : 'Download PDF'}
        </button>
    );
};

const PrintButton = ({ reportText }) => {
    const handlePrint = async () => {
        const doc = <PDFDocument reportText={reportText} />;
        const blob = await pdf(doc).toBlob();
        const url = URL.createObjectURL(blob);

        const printWindow = window.open(url, '_blank');
        printWindow.onload = () => {
            printWindow.print();
            printWindow.onafterprint = () => {
                printWindow.close();
                URL.revokeObjectURL(url);
            };
        };
    };

    return (
        <button className="copy-button" onClick={handlePrint}>
            Print Report
        </button>
    );
};

const deserializeSlateValue = (text) => {
    if (!text) return [{ type: 'paragraph', children: [{ text: '' }] }];
    return createSlateValue(text);
};

const createSlateValue = (text) => {
    // Split text into paragraphs
    const paragraphs = text.split('\n');

    return paragraphs.map(paragraph => {
        // Check for headers
        if (mainHeaders.some(header =>
            paragraph.trim() === header ||
            paragraph.startsWith(header)
        )) {
            return {
                type: 'heading',
                children: [{
                    text: paragraph,
                    bold: true
                }]
            };
        }

        // Check for indented lines
        if ((paragraph.includes('•') ||
            (paragraph.includes('-') &&
                !paragraph.includes('Date:') &&
                !paragraph.includes('Signature:'))) &&
            !paragraph.trim().match(/^\d+[\.\)]/)) {
            return {
                type: 'indented',
                children: [{ text: paragraph }]
            };
        }

        // Default paragraph
        return {
            type: 'paragraph',
            children: [{ text: paragraph }]
        };
    });
};

const renderElement = props => {
    switch (props.element.type) {
        case 'heading':
            return <div {...props.attributes} style={{ fontWeight: 'bold' }}>{props.children}</div>;
        case 'indented':
            return <div {...props.attributes} style={{ paddingLeft: '20px' }}>{props.children}</div>;
        default:
            return <div {...props.attributes}>{props.children}</div>;
    }
};

const renderLeaf = props => {
    return (
        <span
            {...props.attributes}
            style={{ fontWeight: props.leaf.bold ? 'bold' : 'normal' }}
        >
            {props.children}
        </span>
    );
};

const SavedReports = () => {
    const { user, isAuthenticated, isLoading } = useAuth0();
    const [reports, setReports] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);
    const [newReportName, setNewReportName] = useState('');
    const [error, setError] = useState(null);
    const [editor] = useState(() => withHistory(withReact(createEditor())));

    useEffect(() => {
        const fetchReports = async () => {
            if (!isAuthenticated || !user) return;

            try {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth0_user_id', user.sub)
                    .single();

                if (userError) throw userError;

                const userId = userData?.id;

                if (!userId) {
                    console.error("User ID is undefined. Aborting fetch.");
                    return;
                }

                const { data: reportsData, error: reportsError } = await supabase
                    .from('saved_reports')
                    .select('id, report_name, report_text')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (reportsError) {
                    console.error("Error fetching reports:", reportsError);
                    return;
                }

                setReports(reportsData);
            } catch (error) {
                setError("Failed to fetch reports. Please try again later.");
                console.error("Unexpected error fetching reports:", error);
            }
        };

        fetchReports();
    }, [isAuthenticated, user]);

    const handleReportClick = (report) => {
        setSelectedReport(selectedReport === report ? null : report);
        setTimeout(() => {
            const content = document.querySelector('.report-content');
            if (content) {
                content.classList.toggle('expanded', selectedReport !== report);
            }
        }, 50);
    };

    const handleDeleteReport = async (id) => {
        try {
            const { error } = await supabase
                .from('saved_reports')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Update local reports state
            setReports(reports.filter(report => report.id !== id));
            setSelectedReport(null);
        } catch (error) {
            setError("Failed to delete report. Please try again.");
            console.error("Error deleting report:", error);
        }
    };

    const handleEditClick = (index) => {
        setEditingIndex(index);
        setNewReportName(reports[index].report_name);
    };

    const handleNameChange = (e) => {
        setNewReportName(e.target.value);
    };

    const handleNameBlur = async (id) => {
        try {
            const { error } = await supabase
                .from('saved_reports')
                .update({ report_name: newReportName })
                .eq('id', id);

            if (error) throw error;

            // Update local state with new report name
            setReports(reports.map(report =>
                report.id === id ? { ...report, report_name: newReportName } : report
            ));
            setEditingIndex(null);
        } catch (error) {
            setError("Failed to update report name. Please try again.");
            console.error("Error updating report name:", error);
        }
    };

    if (isLoading) return <div>Loading...</div>; // Handle loading state

    if (!isAuthenticated) {
        return <div>Please log in to view your saved reports.</div>;
    }

    return (
        <div className="saved-reports">
            <h2>Saved Reports</h2>
            {error && <div className="error-message">{error}</div>}

            <div className={`report-list ${selectedReport ? 'hidden' : ''}`}>
                {reports.length > 0 ? (
                    reports.map((report, index) => (
                        <div key={report.id} className="report-item">
                            {editingIndex === index ? (
                                <input
                                    type="text"
                                    value={newReportName}
                                    onChange={handleNameChange}
                                    onBlur={() => handleNameBlur(report.id)}
                                    autoFocus
                                />
                            ) : (
                                <span onClick={() => handleReportClick(report)}>{report.report_name}</span>
                            )}
                            <div className="button-group">
                                <PDFButton
                                    reportText={report.report_text}
                                    reportName={report.report_name}
                                />
                                <PrintButton reportText={report.report_text} />
                                <button className="copy-button" onClick={() => handleEditClick(index)}>Edit Name</button>
                                <button className="delete-button" onClick={() => handleDeleteReport(report.id)}>Delete</button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p>No saved reports available.</p>
                )}
            </div>

            {selectedReport && (
                <div className="report-card">
                    <div className="report-card-header">
                        <h3>{selectedReport.report_name}</h3>
                        <div className="button-group">
                            <PDFButton
                                reportText={selectedReport.report_text}
                                reportName={selectedReport.report_name}
                            />
                            <PrintButton reportText={selectedReport.report_text} />
                            <button
                                className="close-button"
                                onClick={() => setSelectedReport(null)}
                            >
                                <FaTimes />
                            </button>
                        </div>
                    </div>
                    <div className="report-content">
                        <div className="editor-wrapper">
                            <Slate
                                editor={editor}
                                initialValue={deserializeSlateValue(selectedReport.report_text)}
                                value={deserializeSlateValue(selectedReport.report_text)}
                                onChange={() => { }}
                            >
                                <Editable
                                    readOnly
                                    renderElement={renderElement}
                                    renderLeaf={renderLeaf}
                                    style={{
                                        minHeight: '100%',
                                        padding: '20px',
                                        whiteSpace: 'pre-wrap'
                                    }}
                                />
                            </Slate>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SavedReports;
