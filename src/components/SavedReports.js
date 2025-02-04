import React, { useState, useEffect } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../supabaseClient';
import '../styles/SavedReports.css';
import { FaTimes, FaEdit } from 'react-icons/fa';
import { pdf } from '@react-pdf/renderer';
import { Document, Page, Text, StyleSheet } from '@react-pdf/renderer';
import { createEditor } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import { withHistory } from 'slate-history';
import { Node } from 'slate';
import { useNavigate } from 'react-router-dom';

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

    const paragraphs = text.split('\n');
    return paragraphs.map(paragraph => {
        let trimmedParagraph = paragraph.trim();

        // Remove leading bullet points or dashes
        trimmedParagraph = trimmedParagraph.replace(/^[•\-]\s*/, '');

        // Check for headers
        const isHeader = trimmedParagraph.startsWith('Physical Exam Findings: -') ||
            trimmedParagraph.endsWith(':') ||
            mainHeaders.some(header => trimmedParagraph.startsWith(header));

        if (isHeader) {
            return {
                type: 'heading',
                children: [{ text: trimmedParagraph, bold: true }]
            };
        }

        // Check for indented lines
        if (paragraph.startsWith('    ')) {
            return {
                type: 'indented',
                children: [{ text: trimmedParagraph }]
            };
        }

        // Default paragraph
        return {
            type: 'paragraph',
            children: [{ text: trimmedParagraph }]
        };
    });
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

const serializeSlateValue = (nodes) => {
    return nodes
        .map(n => Node.string(n))
        .join('\n');
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
    const [searchTerm, setSearchTerm] = useState('');
    const [editingReport, setEditingReport] = useState(null);
    const [isLoadingReports, setIsLoadingReports] = useState(true);
    const [copyButtonText, setCopyButtonText] = useState('Copy to Clipboard');
    const [copiedMessageVisible, setCopiedMessageVisible] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchReports = async () => {
            if (!isAuthenticated || !user) return;

            try {
                setIsLoadingReports(true);
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
                    .select('id, report_name, report_text, form_data')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (reportsError) throw reportsError;

                setReports(reportsData);
            } catch (error) {
                setError("Failed to fetch reports. Please try again later.");
                console.error("Unexpected error fetching reports:", error);
            } finally {
                setIsLoadingReports(false);
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
        if (!window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
            return;
        }

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

    const filteredReports = reports.filter(report =>
        report.report_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.report_text.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSaveEdit = async (report) => {
        try {
            const { error } = await supabase
                .from('saved_reports')
                .update({ report_text: report.report_text })
                .eq('id', report.id);

            if (error) throw error;

            // Update local state
            setReports(reports.map(r =>
                r.id === report.id ? report : r
            ));
            setEditingReport(null);

        } catch (error) {
            setError("Failed to save changes");
            console.error("Error updating report:", error);
        }
    };

    const handleCancelEdit = () => {
        setEditingReport(null);
    };

    const handleCloseReport = () => {
        setEditingReport(null);
        setSelectedReport(null);
    };

    const copyToClipboard = () => {
        // Get current content from editor
        const nodes = deserializeSlateValue(selectedReport.report_text);

        // Create HTML content with explicit styling
        const htmlContent = nodes.map(node => {
            if (node.type === 'heading' || (node.children[0] && node.children[0].bold)) {
                return `<b style="background: none; background-color: transparent;">${Node.string(node)}</b>`;
            }
            return `<span style="background: none; background-color: transparent;">${Node.string(node)}</span>`;
        }).join('<br>');

        // Wrap in a div with explicit styling
        const wrappedHtml = `
            <div style="color: black; background: none; background-color: transparent;">
                ${htmlContent}
            </div>
        `;

        // Use the Clipboard API
        const clipboardData = new ClipboardItem({
            'text/html': new Blob([wrappedHtml], { type: 'text/html' }),
            'text/plain': new Blob([selectedReport.report_text], { type: 'text/plain' })
        });

        navigator.clipboard.write([clipboardData]).then(() => {
            setCopyButtonText('Copied!');
            setCopiedMessageVisible(true);
            setTimeout(() => {
                setCopyButtonText('Copy to Clipboard');
                setCopiedMessageVisible(false);
            }, 2000);
        });
    };

    const handleLoadReport = (report) => {
        // Store form data in localStorage as a single object
        if (report.form_data) {
            localStorage.setItem('form_data', JSON.stringify(report.form_data));
        }

        // Store the report text and ID
        localStorage.setItem('currentReportText', report.report_text);
        localStorage.setItem('currentReportId', report.id);
        localStorage.setItem('previewVisible', 'true');

        // Navigate to the report form
        navigate('/report');
    };

    if (isLoading) return <div>Loading...</div>; // Handle loading state

    if (!isAuthenticated) {
        return <div>Please log in to view your saved reports.</div>;
    }

    return (
        <div className="saved-reports">
            <h2>Saved Records</h2>
            {error && <div className="error-message">{error}</div>}

            <div className="search-container">
                <input
                    type="text"
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
            </div>

            <div className={`report-list ${selectedReport ? 'hidden' : ''}`}>
                {isLoadingReports ? (
                    <div className="reports-loading">
                        <div className="reports-loader"></div>
                    </div>
                ) : filteredReports.length > 0 ? (
                    filteredReports.map((report, index) => (
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
                                <span onClick={() => handleReportClick(report)}>
                                    {report.report_name}
                                </span>
                            )}
                            <div className="button-group">
                                <button
                                    className="edit-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditClick(index);
                                    }}
                                >
                                    <FaEdit />
                                </button>
                                <button
                                    className="delete-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteReport(report.id);
                                    }}
                                >
                                    <FaTimes />
                                </button>
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
                            <button
                                className="load-button"
                                onClick={() => handleLoadReport(selectedReport)}
                            >
                                Load in Generator
                            </button>
                            {editingReport?.id === selectedReport.id ? (
                                <>
                                    <button
                                        className="save-button"
                                        onClick={() => handleSaveEdit(editingReport)}
                                    >
                                        Save
                                    </button>
                                    <button
                                        className="cancel-button"
                                        onClick={handleCancelEdit}
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="edit-button"
                                    onClick={() => setEditingReport({ ...selectedReport })}
                                >
                                    Edit
                                </button>
                            )}
                            <div className="copy-button-container">
                                <button className="copy-button" onClick={copyToClipboard}>
                                    {copyButtonText}
                                </button>
                                {copiedMessageVisible && <span className="copied-message">Copied</span>}
                            </div>
                            <PDFButton
                                reportText={selectedReport.report_text}
                                reportName={selectedReport.report_name}
                            />
                            <PrintButton reportText={selectedReport.report_text} />
                            <button
                                className="close-button"
                                onClick={handleCloseReport}
                            >
                                <FaTimes />
                            </button>
                        </div>
                    </div>
                    <div className="report-content">
                        <div className="editor-wrapper">
                            {editingReport?.id === selectedReport.id ? (
                                <Slate
                                    editor={editor}
                                    value={deserializeSlateValue(editingReport.report_text)}
                                    onChange={value => {
                                        const newText = serializeSlateValue(value);
                                        setEditingReport({
                                            ...editingReport,
                                            report_text: newText
                                        });
                                    }}
                                >
                                    <Editable
                                        renderElement={renderElement}
                                        renderLeaf={renderLeaf}
                                        style={{
                                            minHeight: '100%',
                                            padding: '20px',
                                            whiteSpace: 'pre-wrap'
                                        }}
                                    />
                                </Slate>
                            ) : (
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
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SavedReports;
