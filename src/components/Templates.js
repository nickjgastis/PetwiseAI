import React, { useState, useEffect, useCallback } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../supabaseClient';
import '../styles/Templates.css';
import { FaTimes, FaEdit, FaPlus } from 'react-icons/fa';
import { pdf } from '@react-pdf/renderer';
import { Document, Page, Text, StyleSheet } from '@react-pdf/renderer';
import { createEditor, Node, Transforms, Editor } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import { withHistory } from 'slate-history';

const PDFDocument = ({ templateText }) => {
    const styles = StyleSheet.create({
        page: {
            padding: 40,
            fontSize: 12,
            fontFamily: 'Helvetica',
            lineHeight: 1.5
        },
        text: {
            marginBottom: 4,
            whiteSpace: 'pre-wrap',
            fontFamily: 'Helvetica'
        },
        headerText: {
            marginBottom: 8,
            marginTop: 16,
            fontFamily: 'Helvetica'
        },
        sectionBreak: {
            marginTop: 25
        }
    });

    const formatText = (text) => {
        const lines = text.split('\n');
        let components = [];
        let prevWasEmpty = false;

        lines.forEach((line, index) => {
            let trimmedLine = line.trim();

            // Handle empty lines for section breaks
            if (!trimmedLine) {
                prevWasEmpty = true;
                return;
            }

            // Check for headers (starts with ###)
            if (trimmedLine.startsWith('###')) {
                components.push(
                    <Text key={index} style={styles.headerText}>
                        {trimmedLine.replace(/###\s*/, '')}
                    </Text>
                );
            } else {
                // Add extra margin if there was a double line break
                const style = prevWasEmpty ? { ...styles.text, ...styles.sectionBreak } : styles.text;
                components.push(
                    <Text key={index} style={style}>
                        {trimmedLine.replace(/\*\*/g, '')}
                    </Text>
                );
            }
            prevWasEmpty = false;
        });

        return components;
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {formatText(templateText)}
            </Page>
        </Document>
    );
};

const PDFButton = ({ templateText, templateName }) => {
    const handleDownload = async () => {
        const doc = <PDFDocument templateText={templateText} />;
        const blob = await pdf(doc).toBlob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${templateName || 'Template'}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <button className="template-view-button" onClick={handleDownload}>
            Download PDF
        </button>
    );
};

const PrintButton = ({ templateText }) => {
    const handlePrint = async () => {
        const doc = <PDFDocument templateText={templateText} />;
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
        <button className="template-view-button" onClick={handlePrint}>
            Print Template
        </button>
    );
};

const formatMessage = (content) => {
    if (!content) return '';

    const lines = content.split('\n');
    const firstNonEmptyLineIndex = lines.findIndex(line => line.trim().length > 0);

    if (firstNonEmptyLineIndex !== -1) {
        const titleLine = lines[firstNonEmptyLineIndex].trim();
        lines[firstNonEmptyLineIndex] = titleLine;
    }

    return lines.join('\n')
        .replace(/###\s*(.*?)(?:\n|$)/g, '<h3><strong>$1</strong></h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .split('\n')
        .map(line => line.trim() === ''
            ? '<div style="height: 1em"></div>'  // Empty line spacing
            : `<div style="margin-bottom: 4px; min-height: 1.6em; line-height: 1.6">${line}</div>`
        )
        .join('');
};

const cleanMarkdown = (text) => {
    return text
        .replace(/###\s*/g, '')
        .replace(/\*\*/g, '');
};

const Templates = () => {
    const { user, isAuthenticated } = useAuth0();
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [editingTemplate, setEditingTemplate] = useState(() => {
        const saved = localStorage.getItem('editingTemplate');
        return saved ? JSON.parse(saved) : null;
    });
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
    const [copyButtonText, setCopyButtonText] = useState('Copy to Clipboard');
    const initialValue = [
        {
            type: 'paragraph',
            children: [{ text: '' }],
        },
    ];
    const [editor] = useState(() => {
        const e = withHistory(withReact(createEditor()));

        // Simplify the normalization
        const { normalizeNode } = e;
        e.normalizeNode = ([node, path]) => {
            if (path.length === 0) {
                if (!node.children?.length) {
                    Transforms.insertNodes(
                        e,
                        { type: 'paragraph', children: [{ text: '' }] },
                        { at: [0] }
                    );
                }
            }
            normalizeNode([node, path]);
        };
        return e;
    });

    useEffect(() => {
        if (isAuthenticated && user) {
            fetchTemplates();
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        if (editingTemplate) {
            localStorage.setItem('editingTemplate', JSON.stringify(editingTemplate));
        } else {
            localStorage.removeItem('editingTemplate');
        }
    }, [editingTemplate]);

    const fetchTemplates = async () => {
        try {
            setIsLoadingTemplates(true);

            // First get the user ID
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('auth0_user_id', user.sub)
                .single();

            if (userError) throw userError;

            // Then fetch templates
            const { data, error } = await supabase
                .from('templates')
                .select('*')
                .eq('user_id', userData.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTemplates(data || []);
        } catch (error) {
            console.error('Error fetching templates:', error);
            setError("Failed to fetch templates");
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    const handleCreateNew = () => {
        const newTemplate = {
            id: 'new',
            template_name: 'New Template',
            template_text: ''
        };
        setSelectedTemplate(newTemplate);
        setEditingTemplate(newTemplate);
    };

    const handleSave = async () => {
        try {
            if (!user?.sub) {
                throw new Error('User not authenticated');
            }

            if (!editingTemplate?.template_name || !editingTemplate?.template_text) {
                throw new Error('Template name and content are required');
            }

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('auth0_user_id', user.sub)
                .single();

            if (userError || !userData?.id) {
                throw new Error('User not found');
            }

            // Save the template
            const saveResult = editingTemplate.id === 'new' || !editingTemplate.id
                ? await handleNewTemplateSave(userData.id)
                : await handleExistingTemplateSave(userData.id);

            if (!saveResult) {
                throw new Error('Failed to save template');
            }

            // Reset states
            editor.children = [{ type: 'paragraph', children: [{ text: '' }] }];
            Transforms.deselect(editor);
            setEditingTemplate(null);

            // Update templates list
            setTemplates(prev =>
                editingTemplate.id === 'new' || !editingTemplate.id
                    ? [saveResult, ...prev]
                    : prev.map(t => t.id === editingTemplate.id ? saveResult : t)
            );
            setSelectedTemplate(saveResult);

        } catch (error) {
            console.error('Error saving template:', error);
            setError(error.message || "Failed to save template");
        }
    };

    const handleNewTemplateSave = async (userId) => {
        if (!userId) throw new Error('User ID is required');

        const { data, error } = await supabase
            .from('templates')
            .insert([{
                user_id: userId,
                template_name: editingTemplate.template_name,
                template_text: editingTemplate.template_text
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    };

    const handleExistingTemplateSave = async (userId) => {
        if (!userId) throw new Error('User ID is required');
        if (!editingTemplate?.id) throw new Error('Template ID is required');

        const { data, error } = await supabase
            .from('templates')
            .update({
                template_name: editingTemplate.template_name,
                template_text: editingTemplate.template_text
            })
            .eq('id', editingTemplate.id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    };

    const handleDelete = async (id) => {
        // Add confirmation dialog
        if (!window.confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('templates')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setTemplates(templates.filter(t => t.id !== id));
            setSelectedTemplate(null);
            setEditingTemplate(null);
        } catch (error) {
            setError("Failed to delete template");
            console.error(error);
        }
    };

    const copyToClipboard = async () => {
        try {
            // Get both plain text and HTML versions with correct spacing
            const plainText = selectedTemplate.template_text.split('\n')
                .map(line => line.trim())
                .join('\n');

            const formattedHtml = selectedTemplate.template_text
                .split('\n')
                .map(line => line.trim() === ''
                    ? '<div style="height: 1em"></div>'
                    : `<div style="margin-bottom: 4px; min-height: 1.6em; line-height: 1.5">${line
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/###\s*(.*?)(?:\n|$)/g, '<h3><strong>$1</strong></h3>')
                    }</div>`
                )
                .join('');

            const wrappedHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: black; white-space: pre-wrap; padding: 0; margin: 0;">${formattedHtml}</div>`;

            const clipboardItem = new ClipboardItem({
                'text/html': new Blob([wrappedHtml], { type: 'text/html' }),
                'text/plain': new Blob([plainText], { type: 'text/plain' })
            });

            await navigator.clipboard.write([clipboardItem]);
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy to Clipboard'), 2000);
        } catch (err) {
            try {
                const plainText = selectedTemplate.template_text.split('\n')
                    .map(line => line.trim())
                    .join('\n');
                await navigator.clipboard.writeText(plainText);
                setCopyButtonText('Copied!');
                setTimeout(() => setCopyButtonText('Copy to Clipboard'), 2000);
            } catch (error) {
                console.error('Failed to copy:', error);
            }
        }
    };

    const handleCancel = () => {
        if (window.confirm('Are you sure you want to discard your changes?')) {
            setEditingTemplate(null);
        }
    };

    const filteredTemplates = templates.filter(template =>
        template.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.template_text.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const deserializeToSlate = text => {
        if (!text) return [{ type: 'paragraph', children: [{ text: '' }] }];

        return text.split('\n').map(line => {
            // Handle bold text
            if (line.includes('**')) {
                const children = [];
                let currentText = '';
                let isBold = false;
                let i = 0;

                while (i < line.length) {
                    if (line.slice(i, i + 2) === '**') {
                        if (currentText) {
                            children.push({ text: currentText, bold: isBold });
                            currentText = '';
                        }
                        isBold = !isBold;
                        i += 2;
                    } else {
                        currentText += line[i];
                        i++;
                    }
                }

                if (currentText) {
                    children.push({ text: currentText, bold: isBold });
                }

                return { type: 'paragraph', children };
            }

            return {
                type: 'paragraph',
                children: [{ text: line }]
            };
        });
    };

    const serializeToString = nodes => {
        return nodes.map(node => {
            if (node.type === 'header') {
                return `### ${Node.string(node)}`;
            }

            // Handle paragraphs with bold text
            if (node.type === 'paragraph') {
                let text = '';
                node.children.forEach(child => {
                    if (child.bold) {
                        text += `**${child.text}**`;
                    } else {
                        text += child.text;
                    }
                });
                return text;
            }

            return Node.string(node);
        }).join('\n');
    };

    const editorStyles = {
        minHeight: '100%',
        padding: '20px',
        whiteSpace: 'pre-wrap',
        color: '#202124',
        lineHeight: '1.6',
        fontFamily: "'Google Sans', Roboto, sans-serif",
        fontSize: '14px',
        backgroundColor: 'white',
        border: 'none',
        outline: 'none'
    };

    const viewStyles = {
        ...editorStyles,
        cursor: 'default',
        '& strong': {
            fontWeight: 'bold'
        },
        padding: '20px',
        whiteSpace: 'pre-wrap',
        lineHeight: '1.6',
        minHeight: '100%'
    };

    const renderElement = props => {
        switch (props.element.type) {
            case 'header':
                return (
                    <h3
                        {...props.attributes}
                        style={{
                            marginBottom: '8px',
                            marginTop: '16px',
                            fontWeight: 'bold'
                        }}
                    >
                        {props.children}
                    </h3>
                );
            default:
                return (
                    <div
                        {...props.attributes}
                        style={{ marginBottom: '4px' }}
                    >
                        {props.children}
                    </div>
                );
        }
    };

    const renderLeaf = useCallback(props => {
        if (props.leaf.bold) {
            return <strong {...props.attributes}>{props.children}</strong>;
        }
        return <span {...props.attributes}>{props.children}</span>;
    }, []);

    const handlePaste = (event) => {
        event.preventDefault();
        const text = event.clipboardData.getData('text/plain');

        // Convert pasted text while preserving formatting
        const lines = text.split('\n');
        const nodes = lines.map(line => {
            if (line.startsWith('### ')) {
                return {
                    type: 'header',
                    children: [{ text: line.replace('### ', '') }]
                };
            }

            // Handle bold text
            if (line.includes('**')) {
                const children = [];
                let currentText = '';
                let isBold = false;
                let i = 0;

                while (i < line.length) {
                    if (line.slice(i, i + 2) === '**') {
                        if (currentText) {
                            children.push({ text: currentText, bold: isBold });
                            currentText = '';
                        }
                        isBold = !isBold;
                        i += 2;
                    } else {
                        currentText += line[i];
                        i++;
                    }
                }

                if (currentText) {
                    children.push({ text: currentText, bold: isBold });
                }

                return {
                    type: 'paragraph',
                    children
                };
            }

            return {
                type: 'paragraph',
                children: [{ text: line }]
            };
        });

        Transforms.insertNodes(editor, nodes);
    };

    const handleEditTemplate = (template) => {
        try {
            const initialNodes = deserializeToSlate(template.template_text);
            editor.children = initialNodes;
            setEditingTemplate({ ...template });
        } catch (error) {
            console.error('Error setting up editor:', error);
            setError("Failed to edit template");
        }
    };

    return (
        <div className="templates">
            <div className="templates-header">
                <h2>My Templates</h2>
                <button className="create-button" onClick={handleCreateNew}>
                    <FaPlus /> Create New Template
                </button>
            </div>

            <div className="search-container">
                <input
                    type="text"
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
            </div>

            <div className="templates-container">
                <div className="templates-list">
                    {filteredTemplates.map(template => (
                        <div
                            key={template.id}
                            className={`template-item ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                            onClick={() => setSelectedTemplate(template)}
                        >
                            <div className="template-name">{template.template_name}</div>
                            <div className="template-actions">
                                <button
                                    className="edit-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditTemplate(template);
                                    }}
                                >
                                    <FaEdit />
                                </button>
                                <button
                                    className="delete-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(template.id);
                                    }}
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="template-content">
                    {selectedTemplate ? (
                        <div className="template-view">
                            {editingTemplate?.id === selectedTemplate.id ? (
                                <input
                                    type="text"
                                    value={editingTemplate.template_name || ''}
                                    onChange={(e) => setEditingTemplate({
                                        ...editingTemplate,
                                        template_name: e.target.value
                                    })}
                                    className="template-name-input"
                                    style={{
                                        fontSize: '1.17em',
                                        fontWeight: 'bold',
                                        marginBottom: '10px',
                                        padding: '5px',
                                        width: '100%',
                                        placeholder: 'Enter template name'
                                    }}
                                />
                            ) : (
                                <h3>{selectedTemplate.template_name}</h3>
                            )}
                            <div className="template-actions">
                                {editingTemplate?.id === selectedTemplate.id ? (
                                    <>
                                        <button onClick={handleSave}>Save</button>
                                        <button onClick={handleCancel}>Cancel</button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            className="edit-button"
                                            onClick={() => handleEditTemplate(selectedTemplate)}
                                        >
                                            Edit
                                        </button>
                                        <button className="template-view-button" onClick={copyToClipboard}>
                                            {copyButtonText}
                                        </button>
                                        <PDFButton templateText={selectedTemplate.template_text} templateName={selectedTemplate.template_name} />
                                        <PrintButton templateText={selectedTemplate.template_text} />
                                    </>
                                )}
                            </div>
                            <div className="template-text">
                                {editingTemplate?.id === selectedTemplate.id ? (
                                    <Slate
                                        editor={editor}
                                        initialValue={deserializeToSlate(editingTemplate.template_text)}
                                        onChange={value => {
                                            const text = serializeToString(value);
                                            setEditingTemplate(prev => ({
                                                ...prev,
                                                template_text: text
                                            }));
                                        }}
                                    >
                                        <Editable
                                            style={editorStyles}
                                            renderElement={renderElement}
                                            renderLeaf={renderLeaf}
                                            onPaste={handlePaste}
                                        />
                                    </Slate>
                                ) : (
                                    <div
                                        className="template-content"
                                        style={viewStyles}
                                        dangerouslySetInnerHTML={{
                                            __html: formatMessage(selectedTemplate.template_text)
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="no-selection">
                            Select a template or create a new one
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}
        </div>
    );
};

export default Templates;