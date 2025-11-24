import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../supabaseClient';
import '../styles/SavedReports.css';
import { FaTimes, FaEdit, FaCopy } from 'react-icons/fa';
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

// Parse SOAP report in QuickSOAP format (removes markdown, finds sections by name)
const parseSOAPReport = (text) => {
    if (!text) return { sections: [] };

    // Remove markdown formatting
    let cleanText = text
        .replace(/\*\*/g, '') // Remove bold markers
        .replace(/#{1,6}\s*/g, '') // Remove headers
        .replace(/###\s*/g, '')
        .replace(/##\s*/g, '')
        .replace(/#\s*/g, '')
        .trim();

    const sections = [];
    const sectionNames = ['Subjective', 'Objective', 'Assessment', 'Plan'];

    // Try to find sections by name
    sectionNames.forEach(sectionName => {
        // Look for section header (case insensitive) - handle both "S - Subjective" and "Subjective:" formats
        const regex = new RegExp(`(?:^|\\n)\\s*(?:[SOAP]\\s*-\\s*)?${sectionName}:?\\s*\\n?`, 'gi');
        const match = cleanText.match(regex);

        if (match) {
            const startIndex = cleanText.search(regex);
            const sectionStart = startIndex + match[0].length;

            // Find the next section or end of text
            let sectionEnd = cleanText.length;
            for (let i = 0; i < sectionNames.length; i++) {
                if (sectionNames[i].toLowerCase() !== sectionName.toLowerCase()) {
                    const nextRegex = new RegExp(`(?:^|\\n)\\s*(?:[SOAP]\\s*-\\s*)?${sectionNames[i]}:?\\s*\\n?`, 'gi');
                    const nextMatch = cleanText.substring(sectionStart).search(nextRegex);
                    if (nextMatch !== -1) {
                        sectionEnd = sectionStart + nextMatch;
                        break;
                    }
                }
            }

            const content = cleanText.substring(sectionStart, sectionEnd).trim();
            if (content) {
                sections.push({
                    name: sectionName,
                    content: content
                });
            }
        }
    });

    // If no sections found, try simpler parsing
    if (sections.length === 0) {
        const lines = cleanText.split('\n');
        let currentSection = null;
        let currentContent = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            const sectionMatch = sectionNames.find(name => {
                const lowerName = name.toLowerCase();
                return trimmed.toLowerCase().startsWith(lowerName + ':') ||
                    trimmed.toLowerCase() === lowerName ||
                    trimmed.toLowerCase().startsWith(lowerName.charAt(0) + ' –') ||
                    trimmed.toLowerCase().startsWith(lowerName.charAt(0) + ' -');
            });

            if (sectionMatch) {
                if (currentSection) {
                    sections.push({
                        name: currentSection,
                        content: currentContent.join('\n').trim()
                    });
                }
                currentSection = sectionMatch;
                currentContent = [];
            } else if (currentSection && trimmed) {
                currentContent.push(trimmed);
            }
        });

        if (currentSection) {
            sections.push({
                name: currentSection,
                content: currentContent.join('\n').trim()
            });
        }
    }

    // Sort sections in SOAP order
    const sectionOrder = ['Subjective', 'Objective', 'Assessment', 'Plan'];
    sections.sort((a, b) => {
        const indexA = sectionOrder.indexOf(a.name);
        const indexB = sectionOrder.indexOf(b.name);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    return { sections, rawText: cleanText };
};

// Get section colors (same as QuickSOAP)
const getSectionColor = (sectionName) => {
    const name = sectionName.toLowerCase();
    if (name.includes('subjective')) return {
        border: '#3b82f6',
        header: 'bg-gradient-to-r from-blue-500 to-blue-700',
        bg: 'bg-blue-50'
    };
    if (name.includes('objective')) return {
        border: '#10b981',
        header: 'bg-gradient-to-r from-green-500 to-green-700',
        bg: 'bg-green-50'
    };
    if (name.includes('assessment')) return {
        border: '#f59e0b',
        header: 'bg-gradient-to-r from-amber-500 to-amber-700',
        bg: 'bg-amber-50'
    };
    if (name.includes('plan')) return {
        border: '#ef4444',
        header: 'bg-gradient-to-r from-red-500 to-red-700',
        bg: 'bg-red-50'
    };
    return {
        border: '#6b7280',
        header: 'bg-gradient-to-r from-gray-500 to-gray-700',
        bg: 'bg-gray-50'
    };
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
    const [currentView, setCurrentView] = useState('soap'); // Default to SOAP view
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
                    .select('id, report_name, report_text, form_data, record_type')
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
        
        // Set default view based on record type: SOAP for QuickSOAP and Generator records
        if (selectedReport !== report) {
            const recordType = getRecordType(report);
            if (recordType === 'quicksoap' || recordType === 'generator') {
                setCurrentView('soap');
            } else {
                setCurrentView('standard');
            }
        }
        
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

    const handleLoadQuickSOAP = (report) => {
        // Clear QuickSOAP-specific localStorage items
        localStorage.removeItem('quickSOAP_dictations');
        localStorage.removeItem('quickSOAP_input');
        localStorage.removeItem('quickSOAP_report');
        localStorage.removeItem('quickSOAP_lastInput');
        localStorage.removeItem('currentQuickSOAPReportId');
        localStorage.removeItem('quickSOAP_reportName');

        // Load QuickSOAP data from form_data
        if (report.form_data) {
            const formData = report.form_data;
            
            if (formData.dictations) {
                localStorage.setItem('quickSOAP_dictations', JSON.stringify(formData.dictations));
            }
            if (formData.input !== undefined) {
                localStorage.setItem('quickSOAP_input', formData.input);
            }
            if (formData.report) {
                localStorage.setItem('quickSOAP_report', formData.report);
            }
            if (formData.lastInput !== undefined) {
                localStorage.setItem('quickSOAP_lastInput', formData.lastInput);
            }
        } else {
            // Fallback: if no form_data, use report_text as the report
            if (report.report_text) {
                localStorage.setItem('quickSOAP_report', report.report_text);
            }
        }

        // Load report name
        if (report.report_name) {
            localStorage.setItem('quickSOAP_reportName', report.report_name);
        }

        // Store the report ID for updates
        localStorage.setItem('currentQuickSOAPReportId', report.id);
        
        // Set flag to indicate we're loading saved data
        localStorage.setItem('loadQuickSOAPData', 'true');

        // Navigate to QuickSOAP
        navigate('/dashboard/quicksoap');
    };

    // Helper function to detect record type
    const getRecordType = (report) => {
        // First check if record_type column exists (if migration was run)
        if (report.record_type) {
            return report.record_type;
        }

        // Fallback: detect from form_data structure
        if (!report.form_data) {
            // Legacy records without form_data are assumed to be generator records
            return 'generator';
        }

        const formData = report.form_data;
        
        // Check for QuickSOAP record
        if (formData.record_type === 'quicksoap' || 
            (formData.dictations && formData.input !== undefined)) {
            return 'quicksoap';
        }
        
        // Check for Generator record
        if (formData.record_type === 'generator' || 
            formData.patientName || 
            formData.species || 
            formData.presentingComplaint) {
            return 'generator';
        }

        // Default to generator for unknown types
        return 'generator';
    };

    // QuickSOAP View Component - renders SOAP sections like QuickSOAP does
    const QuickSOAPView = ({ reportText, isEditable = false, onContentChange }) => {
        const [parsedReport, setParsedReport] = useState(() => parseSOAPReport(reportText));
        const [copiedSection, setCopiedSection] = useState(null);
        const quickSOAPTextareaRefs = useRef({});

        useEffect(() => {
            setParsedReport(parseSOAPReport(reportText));
        }, [reportText]);

        const copySection = async (sectionName, content) => {
            try {
                await navigator.clipboard.writeText(content);
                setCopiedSection(sectionName);
                setTimeout(() => setCopiedSection(null), 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        };

        const adjustTextareaHeight = (index, textarea) => {
            if (!textarea) {
                textarea = quickSOAPTextareaRefs.current[`section-${index}`];
            }
            if (!textarea) return;
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        };

        if (!parsedReport || parsedReport.sections.length === 0) {
            return (
                <div className="p-8 text-center text-gray-500">
                    <p>No SOAP sections found in this report.</p>
                </div>
            );
        }

        return (
            <div className="max-w-5xl mx-auto">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                    {parsedReport.sections.map((section, index) => {
                        const colors = getSectionColor(section.name);

                        return (
                            <div
                                key={index}
                                className={`border-l-4 ${index < parsedReport.sections.length - 1 ? 'border-b border-gray-200' : ''}`}
                                style={{ borderLeftColor: colors.border }}
                            >
                                {/* Section Header */}
                                <div className={`${colors.header} px-6 py-3 flex items-center justify-between`}>
                                    <h3 className="text-white font-semibold text-lg tracking-wide">
                                        {section.name.charAt(0)} – {section.name}
                                    </h3>
                                    <button
                                        onClick={() => copySection(section.name, section.content)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${copiedSection === section.name
                                            ? 'bg-white text-blue-600'
                                            : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                                            }`}
                                    >
                                        <FaCopy className="text-xs" />
                                        {copiedSection === section.name ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>

                                {/* Section Content */}
                                <div className={`${colors.bg} px-6 py-4`}>
                                    {isEditable ? (
                                        <textarea
                                            ref={(el) => {
                                                if (el) {
                                                    quickSOAPTextareaRefs.current[`section-${index}`] = el;
                                                    setTimeout(() => adjustTextareaHeight(index, el), 0);
                                                }
                                            }}
                                            value={section.content}
                                            onChange={(e) => {
                                                const newSections = [...parsedReport.sections];
                                                newSections[index].content = e.target.value;
                                                setParsedReport(prev => ({ ...prev, sections: newSections }));
                                                
                                                // Update full report string
                                                const newReport = newSections
                                                    .map(s => `${s.name}:\n${s.content}`)
                                                    .join('\n\n');
                                                
                                                if (onContentChange) {
                                                    onContentChange(newReport);
                                                }
                                                
                                                adjustTextareaHeight(index, e.target);
                                            }}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none text-gray-800 leading-relaxed bg-white text-sm"
                                            style={{
                                                fontFamily: 'inherit',
                                                lineHeight: '1.6',
                                                height: 'auto',
                                                overflowY: 'auto',
                                                whiteSpace: 'pre-wrap',
                                                wordWrap: 'break-word'
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md text-gray-800 leading-relaxed text-sm whitespace-pre-wrap">
                                            {section.content}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
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
                                        className={`view-toggle-btn ${currentView === 'soap' ? 'active' : ''}`}
                                        onClick={() => setCurrentView('soap')}
                                    >
                                        SOAP
                                    </button>
                                    <button
                                        className={`view-toggle-btn ${currentView === 'standard' ? 'active' : ''}`}
                                        onClick={() => setCurrentView('standard')}
                                    >
                                        Standard
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
                                {(() => {
                                    const recordType = getRecordType(selectedReport);
                                    return (
                                        <>
                                            {recordType === 'generator' && (
                                                <button
                                                    className="load-button"
                                                    onClick={() => handleLoadReport(selectedReport)}
                                                    title="Load report in generator"
                                                >
                                                    Load in Generator
                                                </button>
                                            )}
                                            {recordType === 'quicksoap' && (
                                                <button
                                                    className="load-button"
                                                    onClick={() => handleLoadQuickSOAP(selectedReport)}
                                                    title="Load report in QuickSOAP"
                                                >
                                                    Load in QuickSOAP
                                                </button>
                                            )}
                                        </>
                                    );
                                })()}
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
                            (() => {
                                const recordType = getRecordType(selectedReport);
                                const reportText = editingReport?.id === selectedReport.id ? editingReport.report_text : selectedReport.report_text;
                                
                                if (recordType === 'quicksoap') {
                                    return (
                                        <div className="editor-wrapper" style={{ padding: '16px', backgroundColor: '#f8fafc' }}>
                                            <QuickSOAPView
                                                reportText={reportText}
                                                isEditable={editingReport?.id === selectedReport.id}
                                                onContentChange={editingReport?.id === selectedReport.id ? (newText) => {
                                                    setEditingReport({
                                                        ...editingReport,
                                                        report_text: newText
                                                    });
                                                } : undefined}
                                            />
                                        </div>
                                    );
                                } else {
                                    return (
                                        <SOAPView
                                            reportText={reportText}
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
                                    );
                                }
                            })()
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