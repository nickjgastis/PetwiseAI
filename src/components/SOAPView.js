import React, { useState, useEffect } from 'react';
import { createEditor } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import { withHistory } from 'slate-history';
import { Node } from 'slate';

// SOAP View Parser - extracts content from generated report
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

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

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
            // Only include empty lines if they're within content (not at section boundaries)
            if (!trimmedLine) {
                // Check if this empty line is followed by actual content (not another header)
                let hasContentAfter = false;
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j].trim();
                    if (nextLine && !nextLine.includes('**')) {
                        hasContentAfter = true;
                        break;
                    } else if (nextLine.includes('**')) {
                        break; // Hit a header, so this empty line is structural
                    }
                }

                // Only add empty line if there's content after it
                if (hasContentAfter) {
                    const lastSubsection = sections[currentSection][sections[currentSection].length - 1];
                    lastSubsection.content.push(line);
                }
            } else {
                // Add non-empty content
                const lastSubsection = sections[currentSection][sections[currentSection].length - 1];
                lastSubsection.content.push(line);
            }
        }
    }

    return sections;
};

// Convert SOAP data back to text format
const convertSOAPToText = (soapData) => {
    if (!soapData) return '';

    let text = '';

    // Process each section
    ['subjective', 'objective', 'assessment', 'plan'].forEach(sectionKey => {
        const section = soapData[sectionKey];
        if (section && section.length > 0) {
            section.forEach(subsection => {
                text += subsection.header + '\n';

                // Join content and trim trailing empty lines to prevent double spacing
                const contentText = subsection.content.join('\n');
                const trimmedContent = contentText.replace(/\n+$/, ''); // Remove trailing newlines

                text += trimmedContent + '\n\n';
            });
        }
    });

    return text.trim();
};

// Deserialize text for Slate editor
const deserializeSlateValue = (text) => {
    if (!text) return [{ type: 'paragraph', children: [{ text: '' }] }];

    return text.split('\n').map((line) => {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
            return {
                type: 'paragraph',
                children: [{ text: '' }]
            };
        }

        // Check for ** bold formatting
        if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
            return {
                type: 'heading',
                children: [{
                    text: trimmedLine.slice(2, -2),
                    bold: true
                }]
            };
        }

        // Check for other patterns that should be bold
        if (trimmedLine.endsWith(':') ||
            trimmedLine.match(/^\d+\.\s+[^:]+$/) ||
            trimmedLine.match(/^[A-Za-z\s]+:$/)) {
            return {
                type: 'heading',
                children: [{
                    text: trimmedLine,
                    bold: true
                }]
            };
        }

        return {
            type: 'paragraph',
            children: [{
                text: line
            }]
        };
    });
};

// Process Slate nodes for output
const processSlateForPDF = (nodes) => {
    let formattedText = '';

    nodes.forEach((node) => {
        const text = Node.string(node);
        const trimmedText = text.trim();

        // Handle empty lines - preserve them
        if (!trimmedText) {
            formattedText += '\n';
            return;
        }

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

// Render elements for Slate
const renderElement = props => {
    switch (props.element.type) {
        case 'heading':
            return <div {...props.attributes} style={{
                fontWeight: 'bold',
                marginBottom: '4px',
                marginTop: '4px',
                lineHeight: '1.2'
            }}>{props.children}</div>;
        default:
            return <div {...props.attributes} style={{
                marginBottom: '4px',
                minHeight: '1em',
                lineHeight: '1.2'
            }}>{props.children}</div>;
    }
};

// Render leaves for Slate
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

// SOAP View Component
const SOAPView = ({ reportText, onCopySection, isEditable = false, onContentChange, forceTextView = false }) => {
    const [soapData, setSoapData] = useState(() => parseReportForSOAP(reportText));
    const [copiedSections, setCopiedSections] = useState({});
    const [editors] = useState(() => ({
        subjective: withHistory(withReact(createEditor())),
        objective: withHistory(withReact(createEditor())),
        assessment: withHistory(withReact(createEditor())),
        plan: withHistory(withReact(createEditor()))
    }));

    // State to track if we're in editing mode and which sections are being edited
    const [editingContent, setEditingContent] = useState({});

    // Update SOAP data when reportText changes (only when not editing)
    useEffect(() => {
        setSoapData(parseReportForSOAP(reportText));
    }, [reportText]);

    // Initialize editing content when entering editable mode
    useEffect(() => {
        if (isEditable && soapData && Object.keys(editingContent).length === 0) {
            const initialEditingContent = {};
            ['subjective', 'objective', 'assessment', 'plan'].forEach(sectionKey => {
                const section = soapData[sectionKey];
                if (section && section.length > 0) {
                    const sectionContent = section.map(subsection => {
                        const header = subsection.header.replace(/\*\*/g, '');
                        const content = subsection.content.join('\n');
                        return `${header}\n${content}`;
                    }).join('\n\n');
                    initialEditingContent[sectionKey] = deserializeSlateValue(sectionContent);
                }
            });
            setEditingContent(initialEditingContent);
        }
    }, [isEditable, soapData, editingContent]);

    // Handle content changes in editable mode
    const handleSectionChange = (sectionKey, newValue) => {
        if (!isEditable || !onContentChange) return;

        // Store the current editor content
        setEditingContent(prev => ({
            ...prev,
            [sectionKey]: newValue
        }));

        // Convert all sections (both edited and original) back to full text
        const updatedSoapData = { ...soapData };

        // Update this specific section with the new content
        const newText = processSlateForPDF(newValue);
        const lines = newText.split('\n');
        updatedSoapData[sectionKey] = [];
        let currentSubsection = null;

        for (let line of lines) {
            const trimmedLine = line.trim();

            // Check if it's a header
            if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                currentSubsection = { header: trimmedLine, content: [] };
                updatedSoapData[sectionKey].push(currentSubsection);
            } else if (currentSubsection) {
                // Include all lines, even empty ones, to preserve formatting
                currentSubsection.content.push(line);
            } else if (!trimmedLine) {
                // If we encounter an empty line before any header, we still need to handle it
                // This can happen if user adds empty lines at the beginning
                continue;
            }
        }

        // Convert back to full text and notify parent
        const fullText = convertSOAPToText(updatedSoapData);
        onContentChange(fullText);
    };

    if (!soapData) {
        return (
            <div className="soap-placeholder">
                <h3>SOAP View</h3>
                <p>Generate a report to see the SOAP format</p>
            </div>
        );
    }

    const handleCopySection = async (sectionContent, sectionTitle, sectionKey) => {
        // Call the parent copy function
        await onCopySection(sectionContent, sectionTitle);

        // Set copied state for this section
        setCopiedSections(prev => ({ ...prev, [sectionKey]: true }));

        // Reset after 2 seconds
        setTimeout(() => {
            setCopiedSections(prev => ({ ...prev, [sectionKey]: false }));
        }, 2000);
    };

    const renderSOAPSection = (title, data, colorClass, sectionKey) => {
        if (!data || data.length === 0) return null;

        const sectionContent = data.map(subsection => {
            const header = subsection.header.replace(/\*\*/g, '');
            const content = subsection.content.join('\n');
            return `${header}\n${content}`;
        }).join('\n\n');

        const isCopied = copiedSections[sectionKey];

        // Use editing content if available, otherwise deserialize from current content
        const slateValue = editingContent[sectionKey] || deserializeSlateValue(sectionContent);

        return (
            <div key={sectionKey} className={`soap-section ${colorClass}`}>
                <div className="soap-section-header">
                    <h3>{title}</h3>
                    <button
                        className={`soap-copy-button ${isCopied ? 'copied' : ''}`}
                        onClick={() => handleCopySection(sectionContent, title, sectionKey)}
                        title={`Copy ${title} section`}
                    >
                        <span className="copy-icon">
                            {isCopied ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20,6 9,17 4,12"></polyline>
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            )}
                        </span>
                        <span className="copy-text">
                            {isCopied ? 'Copied!' : 'Copy'}
                        </span>
                    </button>
                </div>
                <div className="soap-section-content">
                    {isEditable || forceTextView ? (
                        <div className="soap-editable-section">
                            <Slate
                                editor={editors[sectionKey]}
                                initialValue={slateValue}
                                value={slateValue}
                                onChange={value => handleSectionChange(sectionKey, value)}
                            >
                                <Editable
                                    renderElement={renderElement}
                                    renderLeaf={renderLeaf}
                                    spellCheck={false}
                                    readOnly={!isEditable}
                                    style={{
                                        minHeight: '100px',
                                        padding: '16px 20px',
                                        whiteSpace: 'pre-wrap',
                                        lineHeight: '1.2',
                                        fontSize: '0.9rem',
                                        outline: 'none',
                                        backgroundColor: 'transparent',
                                        cursor: isEditable ? 'text' : 'default'
                                    }}
                                    onCopy={(event) => {
                                        event.preventDefault();
                                        const selection = window.getSelection();
                                        const selectedText = selection.toString();

                                        const htmlContent = selectedText.split('\n').map(line => {
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

                                        event.clipboardData.setData('text/html', wrappedHtml);
                                        event.clipboardData.setData('text/plain', selectedText);
                                    }}
                                />
                            </Slate>
                        </div>
                    ) : (
                        // Read-only display (original implementation)
                        data.map((subsection, index) => (
                            <div key={index} className="soap-subsection">
                                <h4>{subsection.header.replace(/\*\*/g, '')}</h4>
                                <div className="soap-subsection-content">
                                    {subsection.content.map((line, lineIndex) => {
                                        const trimmedLine = line.trim();
                                        if (!trimmedLine) return <br key={lineIndex} />;

                                        // Check if line should be bold
                                        if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                                            return (
                                                <div key={lineIndex} className="soap-bold-line">
                                                    {trimmedLine.slice(2, -2)}
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={lineIndex} className="soap-content-line">
                                                {line}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="soap-view">
            {renderSOAPSection('Subjective', soapData.subjective, 'soap-subjective', 'subjective')}
            {renderSOAPSection('Objective', soapData.objective, 'soap-objective', 'objective')}
            {renderSOAPSection('Assessment', soapData.assessment, 'soap-assessment', 'assessment')}
            {renderSOAPSection('Plan', soapData.plan, 'soap-plan', 'plan')}
        </div>
    );
};

export default SOAPView; 