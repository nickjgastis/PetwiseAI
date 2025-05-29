import React, { useState } from 'react';

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

// SOAP View Component
const SOAPView = ({ reportText, onCopySection }) => {
    const soapData = parseReportForSOAP(reportText);
    const [copiedSections, setCopiedSections] = useState({});

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
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            )}
                        </span>
                        <span className="copy-text">
                            {isCopied ? 'Copied!' : 'Copy'}
                        </span>
                    </button>
                </div>
                <div className="soap-section-content">
                    {data.map((subsection, index) => (
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
                    ))}
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