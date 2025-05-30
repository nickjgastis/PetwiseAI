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
import SOAPView from './SOAPView';

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
            lineHeight: 1.2
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

    // Split content into main content and summary sections
    const splitContent = (text) => {
        const lines = text.split('\n');
        const summaryIndex = lines.findIndex(line =>
            line.includes('**Patient Visit Summary:**') ||
            line.includes('**Notes:**')
        );

        if (summaryIndex === -1) return { mainContent: text, summaryContent: '' };

        const mainContent = lines.slice(0, summaryIndex).join('\n');
        const summaryContent = lines.slice(summaryIndex).join('\n');
        return { mainContent, summaryContent };
    };

    const renderContent = (content) => {
        if (!content) return null;
        const lines = content.split('\n');
        return lines.map((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                return <Text key={`break-${index}`} style={styles.lineBreak}>{'\n'}</Text>;
            }
            if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                return (
                    <Text key={index} style={styles.strongText}>
                        {trimmedLine.slice(2, -2)}
                        {'\n'}
                    </Text>
                );
            }
            return (
                <Text key={index} style={styles.text}>
                    {line}
                    {'\n'}
                </Text>
            );
        });
    };

    const { mainContent, summaryContent } = splitContent(reportText);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {renderContent(mainContent)}
            </Page>
            {summaryContent && (
                <Page size="A4" style={styles.page}>
                    {renderContent(summaryContent)}
                </Page>
            )}
        </Document>
    );
};

const PDFButton = ({ reportText, reportName }) => {
    const handlePDFDownload = async () => {
        try {
            const doc = <PDFDocument reportText={reportText} />;
            const blob = await pdf(doc).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${reportName || 'report'}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('PDF error:', error);
        }
    };

    return (
        <button className="copy-button" onClick={handlePDFDownload}>
            Download PDF
        </button>
    );
};

const PrintButton = ({ reportText }) => {
    const handlePrint = async () => {
        try {
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
        } catch (error) {
            console.error('Print error:', error);
        }
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

        // Handle headers with ** markers
        if (trimmedParagraph.startsWith('**') && trimmedParagraph.endsWith('**')) {
            const cleanHeader = trimmedParagraph.replace(/\*\*/g, '');
            return {
                type: 'heading',
                children: [{ text: cleanHeader, bold: true }]
            };
        }

        // Handle numbered diagnoses
        if (/^\*\*\d+\..+\*\*$/.test(trimmedParagraph)) {
            const cleanText = trimmedParagraph.replace(/\*\*/g, '');
            return {
                type: 'paragraph',
                children: [{ text: cleanText, bold: true }]
            };
        }

        // Handle DDx lines
        if (trimmedParagraph.startsWith('DDx:')) {
            return {
                type: 'paragraph',
                children: [{ text: trimmedParagraph }]
            };
        }

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

const isHeader = text => {
    return text.startsWith('**') && text.endsWith(':**');
};

const renderElement = props => {
    const { element, children, attributes } = props;

    if (element.type === 'heading') {
        return (
            <div
                {...attributes}
                style={{
                    fontWeight: 'bold',
                    lineHeight: '1.2',
                    fontSize: '14px'
                }}
            >
                {children}
            </div>
        );
    }

    return (
        <div
            {...attributes}
            style={{
                lineHeight: '1.2',
                fontSize: '14px'
            }}
        >
            {children}
        </div>
    );
};

const renderLeaf = props => {
    const { attributes, children, leaf } = props;
    return (
        <span
            {...attributes}
            style={{
                fontWeight: leaf.bold ? 'bold' : 'normal'
            }}
        >
            {children}
        </span>
    );
};

const processSlateForPDF = (nodes) => {
    let formattedText = '';
    let previousWasEmpty = false;

    nodes.forEach((node) => {
        const text = Node.string(node);
        const trimmedText = text.trim();

        if (!trimmedText) {
            if (!previousWasEmpty) {
                formattedText += '\n';
            }
            previousWasEmpty = true;
            return;
        }
        previousWasEmpty = false;

        const isBold = node.type === 'heading' ||
            node.children[0]?.bold ||
            trimmedText.startsWith('**') && trimmedText.endsWith('**');

        if (isBold) {
            const cleanText = trimmedText.replace(/^\*\*|\*\*$/g, '');
            formattedText += `**${cleanText}**\n`;
        } else {
            formattedText += `${text}\n`;
        }
    });

    return formattedText;
};

const parseReportForSOAP = (reportText) => {
    if (!reportText) return null;

    const lines = reportText.split('\n');
    const sections = {
        subjective: [],
        objective: [],
        assessment: [],
        plan: []
    };

    let currentSection = null;
    let currentSubsection = null;

    for (let line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Check for main headers and map to SOAP sections
        if (trimmedLine.includes('**Patient Information:**') ||
            trimmedLine.includes('**Staff:**') ||
            trimmedLine.includes('**Presenting Complaint:**') ||
            trimmedLine.includes('**History:**')) {
            currentSection = 'subjective';
            currentSubsection = trimmedLine;
            sections.subjective.push({ header: trimmedLine, content: [] });
        } else if (trimmedLine.includes('**Physical Exam Findings:**') ||
            trimmedLine.includes('**Diagnostic Tests:**')) {
            currentSection = 'objective';
            currentSubsection = trimmedLine;
            sections.objective.push({ header: trimmedLine, content: [] });
        } else if (trimmedLine.includes('**Assessment:**') ||
            trimmedLine.includes('**Diagnosis:**') ||
            trimmedLine.includes('**Differential Diagnosis:**')) {
            currentSection = 'assessment';
            currentSubsection = trimmedLine;
            sections.assessment.push({ header: trimmedLine, content: [] });
        } else if (trimmedLine.includes('**Treatment:**') ||
            trimmedLine.includes('**Monitoring:**') ||
            trimmedLine.includes('**Naturopathic Medicine:**') ||
            trimmedLine.includes('**Client Communications:**') ||
            trimmedLine.includes('**Follow-Up:**') ||
            trimmedLine.includes('**Plan:**') ||
            trimmedLine.includes('**Patient Visit Summary:**') ||
            trimmedLine.includes('**Notes:**')) {
            currentSection = 'plan';
            currentSubsection = trimmedLine;
            sections.plan.push({ header: trimmedLine, content: [] });
        } else if (currentSection && sections[currentSection].length > 0) {
            // Add content to current subsection
            const lastSubsection = sections[currentSection][sections[currentSection].length - 1];
            lastSubsection.content.push(line);
        }
    }

    return sections;
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
    const [currentView, setCurrentView] = useState('standard');
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

            // Update local state - both reports list and selected report
            setReports(reports.map(r =>
                r.id === report.id ? { ...r, report_text: report.report_text } : r
            ));

            // Update selected report to reflect the changes
            setSelectedReport(prev => ({
                ...prev,
                report_text: report.report_text
            }));

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
        // Use the current text (editing if in edit mode, otherwise selected)
        const currentText = editingReport?.id === selectedReport.id ?
            editingReport.report_text : selectedReport.report_text;

        // Parse into SOAP sections
        const soapData = parseReportForSOAP(currentText);

        let organizedContent = '';
        if (soapData && (soapData.subjective.length > 0 || soapData.objective.length > 0 || soapData.assessment.length > 0 || soapData.plan.length > 0)) {
            // Organize by SOAP sections
            if (soapData.subjective.length > 0) {
                organizedContent += 'SUBJECTIVE\n\n';
                organizedContent += soapData.subjective.map(sub => {
                    const header = sub.header.replace(/\*\*/g, '');
                    const content = sub.content.join('\n');
                    return `${header}\n${content}`;
                }).join('\n\n') + '\n\n';
            }

            if (soapData.objective.length > 0) {
                organizedContent += 'OBJECTIVE\n\n';
                organizedContent += soapData.objective.map(sub => {
                    const header = sub.header.replace(/\*\*/g, '');
                    const content = sub.content.join('\n');
                    return `${header}\n${content}`;
                }).join('\n\n') + '\n\n';
            }

            if (soapData.assessment.length > 0) {
                organizedContent += 'ASSESSMENT\n\n';
                organizedContent += soapData.assessment.map(sub => {
                    const header = sub.header.replace(/\*\*/g, '');
                    const content = sub.content.join('\n');
                    return `${header}\n${content}`;
                }).join('\n\n') + '\n\n';
            }

            if (soapData.plan.length > 0) {
                organizedContent += 'PLAN\n\n';
                organizedContent += soapData.plan.map(sub => {
                    const header = sub.header.replace(/\*\*/g, '');
                    const content = sub.content.join('\n');
                    return `${header}\n${content}`;
                }).join('\n\n');
            }
        } else {
            // Fallback to original content if SOAP parsing fails
            organizedContent = currentText;
        }

        const htmlContent = organizedContent.split('\n').map(line => {
            const trimmedLine = line.trim();
            if (trimmedLine === 'SUBJECTIVE' || trimmedLine === 'OBJECTIVE' || trimmedLine === 'ASSESSMENT' || trimmedLine === 'PLAN') {
                return `<b style="background: none; background-color: transparent; font-size: 1.2em;">${line}</b>`;
            }
            if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                return `<b style="background: none; background-color: transparent;">${trimmedLine.slice(2, -2)}</b>`;
            }
            return `<span style="background: none; background-color: transparent;">${line}</span>`;
        }).join('<br>');

        const wrappedHtml = `
            <div style="color: black; background: none; background-color: transparent;">
                ${htmlContent}
            </div>
        `;

        const clipboardData = new ClipboardItem({
            'text/html': new Blob([wrappedHtml], { type: 'text/html' }),
            'text/plain': new Blob([organizedContent], { type: 'text/plain' })
        });

        navigator.clipboard.write([clipboardData])
            .then(() => {
                setCopyButtonText('Copied!');
                setTimeout(() => {
                    setCopyButtonText('Copy to Clipboard');
                }, 2000);
            });
    };

    const handleLoadReport = (report) => {
        // Clear any existing form data first
        localStorage.clear();

        // Store individual form fields in localStorage
        if (report.form_data) {
            const formData = report.form_data;
            Object.entries(formData).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    if (typeof value === 'object') {
                        localStorage.setItem(key, JSON.stringify(value));
                    } else {
                        localStorage.setItem(key, value);
                    }
                }
            });
        }

        // Store the report text and ID
        localStorage.setItem('currentReportText', report.report_text);
        localStorage.setItem('currentReportId', report.id);
        localStorage.setItem('previewVisible', 'true');
        localStorage.setItem('patientInfoSubmitted', 'true');

        // Navigate to the report form
        navigate('/report');
    };

    // Handle SOAP section copy functionality
    const handleCopySection = async (sectionContent, sectionTitle) => {
        try {
            // Include the section title at the top
            const contentWithTitle = `${sectionTitle.toUpperCase()}\n\n${sectionContent}`;

            // Create both HTML and plain text versions
            const htmlContent = contentWithTitle.split('\n').map(line => {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                    return `<b style="background: none; background-color: transparent;">${trimmedLine.slice(2, -2)}</b>`;
                }
                return `<span style="background: none; background-color: transparent;">${line}</span>`;
            }).join('<br>');

            const wrappedHtml = `
                <div style="color: black; background: none; background-color: transparent;">
                    ${htmlContent}
                </div>
            `;

            const plainText = contentWithTitle.replace(/\*\*/g, '');

            const clipboardData = new ClipboardItem({
                'text/html': new Blob([wrappedHtml], { type: 'text/html' }),
                'text/plain': new Blob([plainText], { type: 'text/plain' })
            });

            await navigator.clipboard.write([clipboardData]);

            // Show success message
            setCopyButtonText(`${sectionTitle} Copied!`);
            setTimeout(() => {
                setCopyButtonText('Copy to Clipboard');
            }, 2000);
        } catch (err) {
            console.error('Copy failed:', err);
            setCopyButtonText('Copy Failed');
            setTimeout(() => setCopyButtonText('Copy to Clipboard'), 2000);
        }
    };

    if (isLoading) return <div>Loading...</div>; // Handle loading state

    if (!isAuthenticated) {
        return <div>Please log in to view your saved reports.</div>;
    }

    return (
        <div className="saved-reports">
            <h2>Saved Records</h2>
            {error && <div className="error-message">{error}</div>}

            {!selectedReport && (
                <div className="search-container">
                    <div className="search-input-wrapper">
                        <input
                            type="text"
                            placeholder="Search records..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>
            )}

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
                                    className="edit-name-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditClick(index);
                                    }}
                                    title="Edit name"
                                >
                                    <FaEdit />
                                </button>
                                <button
                                    className="delete-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteReport(report.id);
                                    }}
                                    title="Delete report"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="no-reports">
                        <p>No saved reports available.</p>
                    </div>
                )}
            </div>

            {selectedReport && (
                <div className="report-card">
                    <div className="report-card-header">
                        <div className="header-top">
                            <h3>{selectedReport.report_name}</h3>
                            <div className="view-controls">
                                <div className="view-toggle-buttons">
                                    <button
                                        className={`view-toggle-btn ${currentView === 'standard' ? 'active' : ''}`}
                                        onClick={() => setCurrentView('standard')}
                                    >
                                        Standard
                                    </button>
                                    <button
                                        className={`view-toggle-btn ${currentView === 'soap' ? 'active' : ''}`}
                                        onClick={() => setCurrentView('soap')}
                                    >
                                        SOAP
                                    </button>
                                </div>
                                <button
                                    className="close-button"
                                    onClick={handleCloseReport}
                                    title="Close report"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </div>
                        <div className="action-buttons">
                            <div className="primary-actions">
                                <button
                                    className="load-button"
                                    onClick={() => handleLoadReport(selectedReport)}
                                    title="Load report in generator"
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
                            </div>
                            <div className="secondary-actions">
                                <div className="copy-button-container">
                                    <button className="copy-button" onClick={copyToClipboard}>
                                        {copyButtonText}
                                    </button>
                                </div>
                                <PDFButton
                                    reportText={editingReport?.id === selectedReport.id ? editingReport.report_text : selectedReport.report_text}
                                    reportName={selectedReport.report_name}
                                />
                                <PrintButton
                                    reportText={editingReport?.id === selectedReport.id ? editingReport.report_text : selectedReport.report_text}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="report-content">
                        {currentView === 'soap' ? (
                            <SOAPView
                                reportText={editingReport?.id === selectedReport.id ? editingReport.report_text : selectedReport.report_text}
                                onCopySection={handleCopySection}
                                isEditable={editingReport?.id === selectedReport.id}
                                onContentChange={editingReport?.id === selectedReport.id ? (newText) => {
                                    setEditingReport({
                                        ...editingReport,
                                        report_text: newText
                                    });
                                } : undefined}
                                forceTextView={true}
                            />
                        ) : (
                            <div className="editor-wrapper">
                                {editingReport?.id === selectedReport.id ? (
                                    <Slate
                                        editor={editor}
                                        value={deserializeSlateValue(editingReport.report_text)}
                                        onChange={value => {
                                            const newText = processSlateForPDF(value);
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
                                                padding: '16px',
                                                whiteSpace: 'pre-wrap',
                                                lineHeight: '1.2',
                                                fontSize: '14px'
                                            }}
                                            onCopy={(event) => {
                                                event.preventDefault();
                                                const selection = window.getSelection();

                                                const selectedNodes = deserializeSlateValue(editingReport.report_text).filter(node => {
                                                    const nodeText = Node.string(node);
                                                    return selection.toString().includes(nodeText);
                                                });

                                                const formattedText = processSlateForPDF(selectedNodes);
                                                const plainText = formattedText.replace(/\*\*/g, '');

                                                const htmlContent = formattedText.split('\n').map(line => {
                                                    if (line.startsWith('**') && line.endsWith('**')) {
                                                        return `<b style="background: none; background-color: transparent;">${line.slice(2, -2)}</b>`;
                                                    }
                                                    return `<span style="background: none; background-color: transparent;">${line}</span>`;
                                                }).join('<br>');

                                                const wrappedHtml = `
                                                    <div style="color: black; background: none; background-color: transparent;">
                                                        ${htmlContent}
                                                    </div>
                                                `;

                                                event.clipboardData.setData('text/html', wrappedHtml);
                                                event.clipboardData.setData('text/plain', plainText);
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
                                                padding: '16px',
                                                whiteSpace: 'pre-wrap',
                                                lineHeight: '1.2',
                                                fontSize: '14px'
                                            }}
                                            onCopy={(event) => {
                                                event.preventDefault();
                                                const selection = window.getSelection();

                                                const selectedNodes = deserializeSlateValue(selectedReport.report_text).filter(node => {
                                                    const nodeText = Node.string(node);
                                                    return selection.toString().includes(nodeText);
                                                });

                                                const formattedText = processSlateForPDF(selectedNodes);
                                                const plainText = formattedText.replace(/\*\*/g, '');

                                                const htmlContent = formattedText.split('\n').map(line => {
                                                    if (line.startsWith('**') && line.endsWith('**')) {
                                                        return `<b style="background: none; background-color: transparent;">${line.slice(2, -2)}</b>`;
                                                    }
                                                    return `<span style="background: none; background-color: transparent;">${line}</span>`;
                                                }).join('<br>');

                                                const wrappedHtml = `
                                                    <div style="color: black; background: none; background-color: transparent;">
                                                        ${htmlContent}
                                                    </div>
                                                `;

                                                event.clipboardData.setData('text/html', wrappedHtml);
                                                event.clipboardData.setData('text/plain', plainText);
                                            }}
                                        />
                                    </Slate>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SavedReports;