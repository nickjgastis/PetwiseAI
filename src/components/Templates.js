import React, { useState, useEffect, useCallback } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../supabaseClient';
import '../styles/Templates.css';
import { FaTimes, FaEdit, FaPlus, FaClipboardList } from 'react-icons/fa';
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
        <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-all duration-200" onClick={handleDownload}>
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
        <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-all duration-200" onClick={handlePrint}>
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
                            fontWeight: 'bold',
                            fontSize: '1.1em',
                            color: '#202124'
                        }}
                    >
                        {props.children}
                    </h3>
                );
            default:
                return (
                    <div
                        {...props.attributes}
                        style={{
                            marginBottom: '4px',
                            minHeight: '1.6em',
                            lineHeight: '1.6'
                        }}
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
        <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 via-white to-gray-50 px-6 py-5 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">My Templates</h2>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
                >
                    <FaPlus className="text-xs" />
                    Create New Template
                </button>
            </div>

            {/* Main content grid */}
            <div className="flex-1 min-h-0 grid grid-cols-[320px_1fr] gap-5 overflow-hidden">
                {/* Template list */}
                <div className="overflow-y-auto pr-2 space-y-2">
                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Search templates..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm bg-white focus:border-primary-400 focus:ring-4 focus:ring-primary-100 focus:outline-none transition-all duration-200 sticky top-0 z-10"
                    />
                    {isLoadingTemplates ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"></div>
                        </div>
                    ) : filteredTemplates.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-12">
                            {templates.length === 0 ? 'No templates yet. Click "Create New Template" to get started.' : 'No matching templates.'}
                        </p>
                    ) : (
                        filteredTemplates.map(template => (
                            <button
                                key={template.id}
                                onClick={() => setSelectedTemplate(template)}
                                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-150 border ${
                                    selectedTemplate?.id === template.id
                                        ? 'bg-primary-50 border-primary-300 ring-2 ring-primary-100'
                                        : 'bg-white border-gray-100 hover:bg-primary-50 hover:border-primary-200'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                        selectedTemplate?.id === template.id ? 'bg-primary-200' : 'bg-primary-100'
                                    }`}>
                                        <FaClipboardList className="text-primary-500 text-sm" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{template.template_name}</p>
                                        <p className="text-xs text-gray-400 truncate mt-0.5">
                                            {template.template_text?.replace(/[*#\n]/g, ' ').trim().slice(0, 60)}...
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100">
                                        <button
                                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditTemplate(template);
                                            }}
                                            title="Edit"
                                        >
                                            <FaEdit className="text-xs" />
                                        </button>
                                        <button
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(template.id);
                                            }}
                                            title="Delete"
                                        >
                                            <FaTimes className="text-xs" />
                                        </button>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Template content pane */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    {selectedTemplate ? (
                        <div className="flex flex-col h-full">
                            {/* Template name */}
                            <div className="px-6 pt-5 pb-3 border-b border-gray-100">
                                {editingTemplate?.id === selectedTemplate.id ? (
                                    <input
                                        type="text"
                                        value={editingTemplate.template_name || ''}
                                        onChange={(e) => setEditingTemplate({
                                            ...editingTemplate,
                                            template_name: e.target.value
                                        })}
                                        placeholder="Enter template name"
                                        className="w-full text-xl font-bold text-gray-900 border-2 border-gray-200 rounded-xl px-4 py-2 focus:border-primary-400 focus:ring-4 focus:ring-primary-100 focus:outline-none transition-all"
                                    />
                                ) : (
                                    <h3 className="text-xl font-bold text-gray-900">{selectedTemplate.template_name}</h3>
                                )}
                            </div>

                            {/* Action buttons */}
                            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2">
                                {editingTemplate?.id === selectedTemplate.id ? (
                                    <>
                                        <button
                                            onClick={handleSave}
                                            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={handleCancel}
                                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-all duration-200"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleEditTemplate(selectedTemplate)}
                                            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={copyToClipboard}
                                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-all duration-200"
                                        >
                                            {copyButtonText}
                                        </button>
                                        <PDFButton templateText={selectedTemplate.template_text} templateName={selectedTemplate.template_name} />
                                        <PrintButton templateText={selectedTemplate.template_text} />
                                    </>
                                )}
                            </div>

                            {/* Template text content */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="template-text" style={{ border: 'none', borderRadius: 0, margin: 0 }}>
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
                                            style={viewStyles}
                                            dangerouslySetInnerHTML={{
                                                __html: formatMessage(selectedTemplate.template_text)
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <FaClipboardList className="text-4xl text-gray-200 mb-3" />
                            <p className="text-sm">Select a template or create a new one</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Error toast */}
            {error && (
                <div className="fixed bottom-5 right-5 bg-red-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
                    <span className="text-sm">{error}</span>
                    <button onClick={() => setError(null)} className="text-white hover:text-red-200 transition-colors font-bold">×</button>
                </div>
            )}
        </div>
    );
};

export default Templates;