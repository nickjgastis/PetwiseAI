import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../supabaseClient';
import { Document, Page, Text, StyleSheet, pdf } from '@react-pdf/renderer';
import { FaQuestionCircle, FaTimes, FaArrowRight, FaArrowLeft, FaSearch, FaCopy, FaFileAlt } from 'react-icons/fa';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const formatMessage = (content) => {
    // First, handle multiline LaTeX expressions before splitting into lines
    let processedContent = content;

    // Handle multiline display math expressions \[ ... \]
    processedContent = processedContent.replace(/\\\[([\s\S]*?)\\\]/g, (match, mathContent) => {
        // Clean up the math content
        let cleanMath = mathContent
            .replace(/\\text\{([^}]+)\}/g, '$1')  // Remove \text{...} commands
            .replace(/\\[,:;]/g, ' ')            // Convert spacing commands to spaces
            .replace(/\\quad/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
            .replace(/\\qquad/g, '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;')
            .trim();
        return `<div class="math-display">${cleanMath}</div>`;
    });

    // Handle inline LaTeX math expressions \( ... \) at content level
    processedContent = processedContent.replace(/\\\(([\s\S]*?)\\\)/g, (match, mathContent) => {
        // Clean up the math content
        let cleanMath = mathContent
            .replace(/\\text\{([^}]+)\}/g, '$1')  // Remove \text{...} commands
            .replace(/\\[,:;]/g, ' ')            // Convert spacing commands to spaces
            .replace(/\\quad/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
            .replace(/\\qquad/g, '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;')
            .trim();
        return `<span class="math-expression">${cleanMath}</span>`;
    });

    // Split into lines and find first non-empty line
    const lines = processedContent.split('\n');
    const firstNonEmptyLineIndex = lines.findIndex(line => line.trim().length > 0);

    // Handle title line separately (it's our main header)
    if (firstNonEmptyLineIndex !== -1) {
        const titleLine = lines[firstNonEmptyLineIndex].trim();
        lines[firstNonEmptyLineIndex] = `<h3>${titleLine}</h3>`;
    }

    // Remove any lines containing only "---"
    const filteredLines = lines.filter(line => line.trim() !== '---');

    // Remove consecutive empty lines (collapse multiple blank lines into one)
    const condensedLines = [];
    let lastLineEmpty = false;

    for (const line of filteredLines) {
        const isLineEmpty = line.trim() === '';

        // Only add empty line if previous line wasn't empty
        if (!(isLineEmpty && lastLineEmpty)) {
            condensedLines.push(line);
        }

        lastLineEmpty = isLineEmpty;
    }

    // Join lines with newlines, but use a string method to avoid extra whitespace
    let htmlContent = '';

    // Process line by line to have more control over the output
    for (let i = 0; i < condensedLines.length; i++) {
        const line = condensedLines[i].trim();

        // Skip empty lines
        if (line === '') continue;

        // Process remaining mathematical expressions and LaTeX formatting
        let processedLine = line;

        // Handle inline math expressions with $ delimiters
        processedLine = processedLine.replace(/\$([^$]+)\$/g, '<span class="math-expression">$1</span>');

        // Handle text formatting issues like {text bold}
        processedLine = processedLine.replace(/\{([^}]+)\}/g, '$1');

        // Only process the bold text if it's not a header line (to avoid conflicts)
        if (
            !(/^(\d+)\.\s+(.*?):$/.test(line)) &&
            !(/^####\s+(.*)$/.test(line)) &&
            !(/^###\s+(.*)$/.test(line)) &&
            !(/^##\s+(.*)$/.test(line)) &&
            !(/^\*\*(.*?):\*\*$/.test(line))
        ) {
            // Process bold text
            processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        }

        // Process different line types
        if (i === firstNonEmptyLineIndex) {
            // Title (already handled)
            htmlContent += `<h3>${processedLine.replace(/^<h3>(.*)<\/h3>$/, '$1')}</h3>`;
        }
        else if (/^(\d+)\.\s+(.*?):$/.test(processedLine)) {
            // Numbered section headers
            htmlContent += processedLine.replace(/^(\d+)\.\s+(.*?):$/, (match, num, text) => {
                // Remove any ** markers from section header text
                const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1');
                return `<div class="section-header"><span class="section-number">${num}.</span><h3>${cleanText}</h3></div>`;
            });
        }
        else if (/^####\s+(.*)$/.test(processedLine)) {
            // #### Headers
            htmlContent += processedLine.replace(/^####\s+(.*)$/, (match, text) => {
                // Remove any ** markers from header text
                const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1');
                return `<h3>${cleanText}</h3>`;
            });
        }
        else if (/^###\s+(.*)$/.test(processedLine)) {
            // ### Headers
            htmlContent += processedLine.replace(/^###\s+(.*)$/, (match, text) => {
                // Remove any ** markers from header text
                const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1');
                return `<h3>${cleanText}</h3>`;
            });
        }
        else if (/^##\s+(.*)$/.test(processedLine)) {
            // ## Headers - convert to div with bold-header class
            htmlContent += processedLine.replace(/^##\s+(.*)$/, (match, text) => {
                // Remove any ** markers from text
                const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1');
                return `<div class="bold-header">${cleanText}</div>`;
            });
        }
        else if (/^\*\*(.*?):\*\*$/.test(processedLine)) {
            // **Header:** format
            htmlContent += processedLine.replace(/^\*\*(.*?):\*\*$/, '<h3>$1</h3>');
        }
        else if (/^\s*-\s+(.*?):\s*$/.test(processedLine)) {
            // Bullet points with nested info (medication headers) - no bullets
            htmlContent += processedLine.replace(/^\s*-\s+(.*?):\s*$/, '<div class="medication-item"><strong>$1:</strong></div>');
        }
        else if (/^\s*-\s+(.*)$/.test(processedLine)) {
            // Regular bullet points - convert to plain text without bullets
            const contentWithoutBullet = processedLine.replace(/^\s*-\s+/, '');
            htmlContent += `<div class="line-item">${contentWithoutBullet}</div>`;
        }
        else if (/^(\d+)\.\s+(.*)$/.test(processedLine)) {
            // Numbered list items
            htmlContent += processedLine.replace(/^(\d+)\.\s+(.*)$/, '<div class="list-item"><span class="number">$1.</span><span>$2</span></div>');
        }
        else {
            // Special handling for additional notes and recommendations
            if (processedLine.includes("Additional Notes:")) {
                htmlContent += `<div class="additional-notes">${processedLine}</div>`;
            }
            else if (processedLine.includes("Recommendation:")) {
                htmlContent += `<div class="recommendation">${processedLine}</div>`;
            }
            // Regular text - preserve as is
            else {
                htmlContent += `<div>${processedLine}</div>`;
            }
        }
    }

    return htmlContent;
};

const formatMessageForPDF = (content) => {
    const styles = StyleSheet.create({
        page: {
            padding: 40,
            fontSize: 12,
            fontFamily: 'Helvetica',
            lineHeight: 1.4
        },
        text: {
            marginBottom: 4,
            fontFamily: 'Helvetica'
        },
        header: {
            fontFamily: 'Helvetica-Bold',
            fontSize: 13,
            marginTop: 16,
            marginBottom: 8
        },
        bold: {
            fontFamily: 'Helvetica-Bold'
        },
        listItem: {
            marginLeft: 20,
            marginBottom: 4
        }
    });

    const formatParagraphs = (text) => {
        const lines = text.split('\n');
        return lines.map((line, index) => {
            // Check if it's a header (ends with ':' or matches number pattern)
            if (line.endsWith(':') && !line.match(/^\d+\./)) {
                return (
                    <Text key={index} style={styles.header}>
                        {line.replace(/\*\*/g, '')}
                    </Text>
                );
            }

            // Handle numbered sections with bold parts
            if (line.match(/^\d+\.\s+\*\*/)) {
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                return (
                    <Text key={index} style={styles.text}>
                        {parts.map((part, partIndex) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return (
                                    <Text key={partIndex} style={styles.bold}>
                                        {part.replace(/\*\*/g, '')}
                                    </Text>
                                );
                            }
                            return part;
                        })}
                    </Text>
                );
            }

            // Handle bold text within lines
            if (line.includes('**')) {
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                return (
                    <Text key={index} style={styles.text}>
                        {parts.map((part, partIndex) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return (
                                    <Text key={partIndex} style={styles.bold}>
                                        {part.replace(/\*\*/g, '')}
                                    </Text>
                                );
                            }
                            return part;
                        })}
                    </Text>
                );
            }

            // Regular text
            return <Text key={index} style={styles.text}>{line}</Text>;
        });
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {formatParagraphs(content)}
            </Page>
        </Document>
    );
};

const SUGGESTIONS = [
    {
        category: "Treatment Protocols",
        question: "What is the step-by-step treatment protocol for severe canine parvovirus, including fluid rates and antibiotic choices?"
    },
    {
        category: "Emergency Medicine",
        question: "What are the exact dosages and timing for diazepam, midazolam, and phenobarbital in status epilepticus?"
    },
    {
        category: "Medication Guidance",
        question: "For resistant feline UTIs, what culture-based antibiotic protocols do you recommend after amoxicillin failure?"
    },
    {
        category: "Dermatology",
        question: "What's the current ICADA protocol for severe canine atopic dermatitis, including Apoquel and Cytopoint timing?"
    },
    {
        category: "Surgery",
        question: "What pre-op lab work and medication adjustments are needed for dental procedures in cats over 12 years?"
    },
    {
        category: "Oncology",
        question: "What's the CHOP protocol dosing schedule for intermediate to high-grade feline lymphoma?"
    },
    {
        category: "Cardiology",
        question: "What's the emergency furosemide protocol for acute CHF with respiratory distress, including CRI rates?"
    },
    {
        category: "Neurology",
        question: "What's the diagnostic protocol for differentiating central vs peripheral vestibular disease in geriatric dogs?"
    },
    {
        category: "Endocrinology",
        question: "What's the insulin CRI protocol and fluid rates for treating DKA in cats with BG >400?"
    },
    {
        category: "Emergency Medicine",
        question: "What's the complete protocol for severe acute pancreatitis in dogs, including fluid rates and pain management?"
    },
    {
        category: "Ophthalmology",
        question: "What's the treatment protocol for deep stromal corneal ulcers in cats, including surgical options?"
    },
    {
        category: "Toxicology",
        question: "What's the decontamination and treatment protocol for dogs that ingested >3oz dark chocolate?"
    },
    {
        category: "Reproduction",
        question: "What's the medical and surgical protocol for managing dystocia in French Bulldogs?"
    },
    {
        category: "Gastroenterology",
        question: "What's the current stepwise approach for treating refractory IBD in cats after diet trials fail?"
    },
    {
        category: "Orthopedics",
        question: "What's the detailed 8-week post-op rehab protocol following TPLO surgery in large breed dogs?"
    },
    {
        category: "Behavior",
        question: "What are the current dosing protocols for fluoxetine and trazodone for severe separation anxiety?"
    },
    {
        category: "Critical Care",
        question: "What's the protocol for treating Eastern Diamondback rattlesnake bites, including antivenom dosing?"
    },
    {
        category: "Respiratory",
        question: "What's the emergency and maintenance protocol for severe feline asthma, including inhaler options?"
    },
    {
        category: "Nutrition",
        question: "What's the detailed refeeding protocol for hepatic lipidosis in cats, including tube feeding schedules?"
    },
    {
        category: "Dentistry",
        question: "What antibiotics and doses are recommended for stage 4 periodontal disease with osteomyelitis?"
    }
];

const QuickQuery = () => {
    const { user } = useAuth0();
    const [userData, setUserData] = useState(null);
    const [messages, setMessages] = useState(() => {
        const saved = localStorage.getItem('quickQueryMessages');
        return saved ? JSON.parse(saved) : [];
    });
    const [inputMessage, setInputMessage] = useState(() => {
        return localStorage.getItem('quickQueryInput') || '';
    });
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [fadeOutLoader, setFadeOutLoader] = useState(false);
    const [randomSuggestions, setRandomSuggestions] = useState(
        SUGGESTIONS.sort(() => Math.random() - 0.5).slice(0, 3)
    );
    const [isTyping, setIsTyping] = useState(false);
    const [showSources, setShowSources] = useState({});
    const [isLongAnswerMode, setIsLongAnswerMode] = useState(false);
    const [animateNewMessage, setAnimateNewMessage] = useState(null);
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);

    // Check for tutorial flag from Help center
    useEffect(() => {
        const openTutorialFlag = localStorage.getItem('openPetQueryTutorial');
        if (openTutorialFlag === 'true') {
            setShowTutorial(true);
            setTutorialStep(0);
            localStorage.removeItem('openPetQueryTutorial');
        }
    }, []);

    useEffect(() => {
        const lastUser = localStorage.getItem('lastUserId');
        const currentUser = user?.sub;

        if (lastUser && currentUser && lastUser !== currentUser) {
            localStorage.removeItem('quickQueryMessages');
            setMessages([]);
        }

        if (currentUser) {
            localStorage.setItem('lastUserId', currentUser);
        }
    }, [user]);

    useEffect(() => {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'assistant') {
                // For assistant messages, scroll first, then animate
                scrollToBottom();
                setTimeout(() => {
                    setAnimateNewMessage(messages.length - 1);
                }, 300); // Delay animation until scroll completes
            } else {
                // For user messages, just scroll
                scrollToBottom();
            }
        }
    }, [messages]);

    useEffect(() => {
        localStorage.setItem('quickQueryMessages', JSON.stringify(messages));
    }, [messages]);

    useEffect(() => {
        localStorage.setItem('quickQueryInput', inputMessage);
    }, [inputMessage]);

    useEffect(() => {
        // Auto-focus textarea when component mounts or when loading finishes
        if (textareaRef.current && !isLoading) {
            textareaRef.current.focus();
        }
    }, [isLoading]);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!user?.sub) return;

            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('dvm_name')
                    .eq('auth0_user_id', user.sub)
                    .single();

                if (!error && data) {
                    setUserData(data);
                }
            } catch (err) {
                console.error('Error fetching user data:', err);
            }
        };

        fetchUserData();
    }, [user]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const formatTimestamp = () => {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    // Helper function to manage loading state transitions
    const finishLoading = () => {
        // Immediately hide the loader
        setIsLoading(false);
        setIsTyping(false);
        setFadeOutLoader(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || isLoading) return;

        // Get timestamp
        const timestamp = formatTimestamp();

        const newMessage = {
            role: 'user',
            content: inputMessage.trim(),
            timestamp
        };
        setMessages(prev => [...prev, newMessage]);
        setInputMessage('');
        setIsLoading(true);
        setIsTyping(true);
        setFadeOutLoader(false);

        // Collapse textarea
        const textarea = document.querySelector('.qq-message-input');
        if (textarea) {
            textarea.style.height = '56px';
        }

        try {
            // Increment message count directly
            if (user?.sub) {
                try {
                    const { data, error } = await supabase
                        .from('users')
                        .select('quick_query_messages_count')
                        .eq('auth0_user_id', user.sub)
                        .single();

                    if (!error && data) {
                        const currentCount = data.quick_query_messages_count || 0;
                        await supabase
                            .from('users')
                            .update({ quick_query_messages_count: currentCount + 1 })
                            .eq('auth0_user_id', user.sub);
                    }
                } catch (err) {
                    console.error('Error updating message count:', err);
                }
            }

            const systemPrompt = isLongAnswerMode
                ? `You are PetQuery, a **Veterinary Assistant AI** providing comprehensive, in-depth responses for **licensed veterinarians only**. IMPORTANT: Always assume you are speaking with a licensed veterinarian. Give detailed, thorough answers that cover all relevant aspects of the question. Provide extensive clinical information, background context, differential diagnoses, treatment options, prognosis, and detailed explanations. Include comprehensive sources and references. ${userData?.dvm_name ? `You are speaking with Dr. ${userData.dvm_name}. Address them as such.` : ''}`
                : ` You are PetQuery, a **Veterinary Assistant AI** providing concise, professional responses for **licensed veterinarians only**. IMPORTANT: Always assume you are speaking with a licensed veterinarian. Your responses should be **short, precise, and rich in clinical information** while adhering to the following formatting:

### FORMATTING GUIDELINES:
1. **Headers:** Use **bold headers** for clear sectioning.
2. **Spacing:** Ensure proper spacing with **double line breaks** between sections and headers.
3. **Lists:** Use numbers for ordered lists, not bullet points.
4. **Critical Terms:** Highlight key terms or actions in **bold** for clarity.

### RESPONSE GUIDELINES:
- Responses should focus on actionable, evidence-based information, staying concise and on-topic.
- For common cases, prioritize practical treatments.
- For less common or specific cases, provide insightful, clinically relevant advice with brief reasoning.
- **Avoid lengthy explanations** unless explicitly requested.

### WHEN PROVIDING TREATMENTS:
Treatments should follow this structure:
1. **Medication Category**
   **Drug Name:** Include generic name and examples of brand names (if applicable).
   **Dose:** X mg/kg
   **Route:** (IV, PO, SQ, IM)
   **Frequency:** (e.g., SID, BID, TID, QID)
   **Duration:** X days
 **Additional Notes:** Include contraindications, warnings, or monitoring guidelines if relevant.

**Example:**
1. **Fluid Therapy**
    **Drug Name:** Isotonic crystalloid solution (e.g., LRS or 0.9% NaCl)
        **Dose:** 10-20 mL/kg IV bolus, then maintenance based on ongoing losses
        **Frequency:** As needed to maintain hydration
        **Duration:** Adjust based on hydration status
        **Additional Notes:** Monitor for fluid overload, particularly in cardiac or renal patients.

### WHEN PROVIDING DIAGNOSTIC PLANS:
Diagnostics should be presented as actionable steps, prioritized based on the case. Use this structure:

1. **Primary Objective:** State the purpose of the diagnostic (e.g., rule out X condition, confirm Y finding).

2. **Recommended Diagnostics:**
   - Test/Procedure 1: Brief explanation of its purpose or clinical relevance.
   - Test/Procedure 2: Continue with the next diagnostic steps, as needed.

**Example:**
1. **Diagnostics for Anemia in Canines**
   **Primary Objective:** Determine the cause and severity of anemia.
   **Recommended Diagnostics:**
     CBC with reticulocyte count: Assess severity and regenerative response.
     Coombs' test: Evaluate for immune-mediated hemolysis.
     Abdominal ultrasound: Rule out splenic masses or bleeding.

### WHEN HANDLING UNCOMMON CASES:
For less common cases, provide:
1. A brief overview of the condition.
2. Recommended treatment or diagnostic steps.
3. Any relevant clinical notes or key considerations.

**Example:**
**Case: Canine Tetany**
1. **Overview:** Tetany often results from hypocalcemia secondary to eclampsia, parathyroid dysfunction, or chronic renal failure.
2. **Treatment:**
   **Drug Name:** Calcium gluconate
   **Dose:** 0.5-1.5 mL/kg IV slowly over 10-30 minutes
   **Route:** IV
   **Frequency:** Single dose, repeat based on ionized calcium levels
   **Additional Notes:** Monitor ECG for bradycardia or arrhythmias during infusion.

### SOURCES REQUIREMENT:
Always include a comprehensive **Sources** section at the end of your response with detailed, properly formatted citations including:
- Full author names and publication years
- Complete journal names with volume/issue numbers when available
- Publisher information for textbooks
- Specific page ranges or DOI numbers when applicable
- Professional organization guideline titles and availability
- Manufacturer prescribing information with proper attribution
- Include 4-6 high-quality, relevant sources minimum
- Format as numbered list with proper academic citation style
- Include brief explanatory text about the sources' relevance when helpful

Example format:
**Sources:**
1. Ettinger, S. J., & Feldman, E. C. (2017). *Textbook of Veterinary Internal Medicine*. Elsevier.
2. Greene, S.A., et al. (2008). "Management of snake envenomation in dogs," *Journal of Veterinary Emergency and Critical Care*, 18(5), 526-532.
3. American College of Veterinary Emergency and Critical Care (ACVECC) guidelines on emergency toxicology management.

### FINAL TOUCHES:
- Always end responses with a clear **Recommendation** section summarizing the next steps.
- Always allow any language translations.
- Always allow client handouts or client communications.
- ${userData?.dvm_name ? `You are speaking with Dr. ${userData.dvm_name}. Address them as such.` : ''}
- Provide **specific and concise information** for maximum clarity and usability.

### Example Output:
**Case: Acute Canine Pancreatitis**

1. **Primary Objective:** Stabilize the patient and reduce pancreatic inflammation.
2. **Treatment:**
   **Fluid Therapy:**
     **Drug Name:** Isotonic crystalloid (e.g., LRS or 0.9% NaCl)
     **Dose:** 10-20 mL/kg IV bolus, then maintenance
     **Frequency:** Continuous infusion
     **Duration:** Until hydration status is restored
   **Pain Management:**
     **Drug Name:** Buprenorphine
     **Dose:** 0.01-0.02 mg/kg
     **Route:** IM or IV
     **Frequency:** QID
     **Duration:** 3-5 days
3. **Recommendation:** Administer fluids immediately and control pain. Monitor electrolytes and hydration. Reassess within 24 hours with follow-up diagnostics (e.g., CPL).

**Sources:**
1. Veterinary Textbooks:
   - "Textbook of Veterinary Internal Medicine" by Ettinger and Feldman
2. Peer-Reviewed Journals:
   - "Management of acute pancreatitis in dogs," Journal of Veterinary Emergency and Critical Care
3. Professional Organizations:
   - ACVECC consensus guidelines on acute pancreatitis management

By adhering to these guidelines, ensure responses are **short, actionable, and formatted for quick reference** while providing high-quality assistance tailored to professional veterinarians.
`;

            const conversationHistory = [
                {
                    role: 'system',
                    content: systemPrompt
                },
                ...messages.slice(-5),
                newMessage
            ];

            const response = await axios.post(
                `${API_URL}/api/quickquery`,
                {
                    model: 'gpt-4o-mini',
                    messages: conversationHistory,
                    max_tokens: 1000,
                    temperature: 0.7,
                    top_p: 0.9,
                    frequency_penalty: 0.5,
                    presence_penalty: 0.5
                }
            );

            if (response.data.error) {
                throw new Error(response.data.error);
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.data.choices[0].message.content,
                timestamp: formatTimestamp()
            }]);
        } catch (error) {
            console.error('Error in QuickQuery:', error);
            let errorMessage = "I'm sorry, I encountered an error. Please try again.";

            if (error.response?.status === 429) {
                // Check if it's a quota error from OpenAI
                const detail = error.response?.data?.detail || '';
                if (detail.includes('insufficient_quota') || detail.includes('quota')) {
                    errorMessage = "OpenAI API quota exceeded. Please check your OpenAI account billing or wait for your quota to reset.";
                } else {
                    errorMessage = "Too many requests. Please try again in a moment.";
                }
            } else if (error.response?.data?.error === 'Daily report limit reached') {
                errorMessage = "You've reached your daily query limit. Please upgrade your plan or try again tomorrow.";
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errorMessage,
                timestamp: formatTimestamp()
            }]);
        } finally {
            finishLoading();
        }
    };

    const handleClear = () => {
        setMessages([]);
        localStorage.removeItem('quickQueryMessages');
    };

    const handleCopy = async (text, index) => {
        // Format the text by removing markdown
        const formattedText = text
            .replace(/###\s*(.*?)(?:\n|$)/g, '$1')  // Remove ### markers
            .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove ** markers
            .split('\n')
            .map(line => line.trim())
            .join('\n');

        try {
            // Create HTML content with proper formatting
            const formattedHtml = formatMessage(text);

            const clipboardItem = new ClipboardItem({
                'text/html': new Blob([`<div style="font-family: Arial, sans-serif; line-height: 1.5; color: black; white-space: pre-wrap; padding: 0; margin: 0;">${formattedHtml}</div>`], { type: 'text/html' }),
                'text/plain': new Blob([formattedText], { type: 'text/plain' })
            });

            await navigator.clipboard.write([clipboardItem]);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (err) {
            try {
                await navigator.clipboard.writeText(formattedText);
            } catch {
                await navigator.clipboard.writeText(text);
            }
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        }
    };

    const handlePrint = async (content) => {
        try {
            const doc = formatMessageForPDF(content);
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

    const handleSuggestionClick = async (question) => {
        if (isTyping) return;

        // Get timestamp
        const timestamp = formatTimestamp();

        const newMessage = {
            role: 'user',
            content: question,
            timestamp
        };
        setMessages(prev => [...prev, newMessage]);
        setIsTyping(true);
        setIsLoading(true);
        setFadeOutLoader(false);

        // Auto-scroll to the bottom
        scrollToBottom();

        try {
            const systemPrompt = isLongAnswerMode
                ? `You are a **Veterinary Assistant AI** providing comprehensive, in-depth responses for **licensed veterinarians only**. IMPORTANT: Always assume you are speaking with a licensed veterinarian. Give detailed, thorough answers that cover all relevant aspects of the question. Provide extensive clinical information, background context, differential diagnoses, treatment options, prognosis, and detailed explanations. Include comprehensive sources and references. ${userData?.dvm_name ? `You are speaking with Dr. ${userData.dvm_name}. Address them as such.` : ''}`
                : ` You are a **Veterinary Assistant AI** providing concise, professional responses for **licensed veterinarians only**. IMPORTANT: Always assume you are speaking with a licensed veterinarian. Your responses should be **short, precise, and rich in clinical information** while adhering to the following formatting:

### FORMATTING GUIDELINES:
1. **Headers:** Use **bold headers** for clear sectioning.
2. **Spacing:** Ensure proper spacing with **double line breaks** between sections and headers.
3. **Lists:** Use numbers for ordered lists, not bullet points. 
4. **Critical Terms:** Highlight key terms or actions in **bold** for clarity.

### RESPONSE GUIDELINES:
- Responses should focus on actionable, evidence-based information, staying concise and on-topic.
- For common cases, prioritize practical treatments.
- For less common or specific cases, provide insightful, clinically relevant advice with brief reasoning.
- **Avoid lengthy explanations** unless explicitly requested.
- When giving dosages use Plumbs as the primary source first.

### WHEN PROVIDING TREATMENTS:
Treatments should follow this structure:
1. **Medication Category**
   **Drug Name:** Include generic name and examples of brand names (if applicable).
   **Dose:** X mg/kg
   **Route:** (IV, PO, SQ, IM)
   **Frequency:** (e.g., SID, BID, TID, QID)
   **Duration:** X days
 **Additional Notes:** Include contraindications, warnings, or monitoring guidelines if relevant.

**Example:**
1. **Fluid Therapy**
    **Drug Name:** Isotonic crystalloid solution (e.g., LRS or 0.9% NaCl)
        **Dose:** 10-20 mL/kg IV bolus, then maintenance based on ongoing losses
        **Frequency:** As needed to maintain hydration
        **Duration:** Adjust based on hydration status
        **Additional Notes:** Monitor for fluid overload, particularly in cardiac or renal patients.

### WHEN PROVIDING DIAGNOSTIC PLANS:
Diagnostics should be presented as actionable steps, prioritized based on the case. Use this structure:

1. **Primary Objective:** State the purpose of the diagnostic (e.g., rule out X condition, confirm Y finding).

2. **Recommended Diagnostics:**
   - Test/Procedure 1: Brief explanation of its purpose or clinical relevance.
   - Test/Procedure 2: Continue with the next diagnostic steps, as needed.

**Example:**
1. **Diagnostics for Anemia in Canines**
   **Primary Objective:** Determine the cause and severity of anemia.
   **Recommended Diagnostics:**
     CBC with reticulocyte count: Assess severity and regenerative response.
     Coombs' test: Evaluate for immune-mediated hemolysis.
     Abdominal ultrasound: Rule out splenic masses or bleeding.

### WHEN HANDLING UNCOMMON CASES:
For less common cases, provide:
1. A brief overview of the condition.
2. Recommended treatment or diagnostic steps.
3. Any relevant clinical notes or key considerations.

**Example:**
**Case: Canine Tetany**
1. **Overview:** Tetany often results from hypocalcemia secondary to eclampsia, parathyroid dysfunction, or chronic renal failure.
2. **Treatment:**
   **Drug Name:** Calcium gluconate
   **Dose:** 0.5-1.5 mL/kg IV slowly over 10-30 minutes
   **Route:** IV
   **Frequency:** Single dose, repeat based on ionized calcium levels
   **Additional Notes:** Monitor ECG for bradycardia or arrhythmias during infusion.

### SOURCES REQUIREMENT:
Always include a comprehensive **Sources** section at the end of your response with detailed, properly formatted citations including:
- Full author names and publication years
- Complete journal names with volume/issue numbers when available
- Publisher information for textbooks
- Specific page ranges or DOI numbers when applicable
- Professional organization guideline titles and availability
- Manufacturer prescribing information with proper attribution
- Include 4-6 high-quality, relevant sources minimum
- Format as numbered list with proper academic citation style
- Include brief explanatory text about the sources' relevance when helpful

Example format:
**Sources:**
1. Ettinger, S. J., & Feldman, E. C. (2017). *Textbook of Veterinary Internal Medicine*. Elsevier.
2. Greene, S.A., et al. (2008). "Management of snake envenomation in dogs," *Journal of Veterinary Emergency and Critical Care*, 18(5), 526-532.
3. American College of Veterinary Emergency and Critical Care (ACVECC) guidelines on emergency toxicology management.

### FINAL TOUCHES:
- Always end responses with a clear **Recommendation** section summarizing the next steps.
- Always allow any language translations.
- Always allow client handouts or client communications.
- ${userData?.dvm_name ? `You are speaking with Dr. ${userData.dvm_name}. Address them as such.` : ''}
- Provide **specific and concise information** for maximum clarity and usability.

### Example Output:
**Case: Acute Canine Pancreatitis**

1. **Primary Objective:** Stabilize the patient and reduce pancreatic inflammation.
2. **Treatment:**
   **Fluid Therapy:**
     **Drug Name:** Isotonic crystalloid (e.g., LRS or 0.9% NaCl)
     **Dose:** 10-20 mL/kg IV bolus, then maintenance
     **Frequency:** Continuous infusion
     **Duration:** Until hydration status is restored
   **Pain Management:**
     **Drug Name:** Buprenorphine
     **Dose:** 0.01-0.02 mg/kg
     **Route:** IM or IV
     **Frequency:** QID
     **Duration:** 3-5 days
3. **Recommendation:** Administer fluids immediately and control pain. Monitor electrolytes and hydration. Reassess within 24 hours with follow-up diagnostics (e.g., CPL).

**Sources:**
1. Veterinary Textbooks:
   - "Textbook of Veterinary Internal Medicine" by Ettinger and Feldman
2. Peer-Reviewed Journals:
   - "Management of acute pancreatitis in dogs," Journal of Veterinary Emergency and Critical Care
3. Professional Organizations:
   - ACVECC consensus guidelines on acute pancreatitis management

By adhering to these guidelines, ensure responses are **short, actionable, and formatted for quick reference** while providing high-quality assistance tailored to professional veterinarians.
`;

            const conversationHistory = [
                {
                    role: 'system',
                    content: systemPrompt
                },
                ...messages.slice(-5),
                {
                    role: 'user',
                    content: question
                }
            ];

            const response = await axios.post(
                `${API_URL}/api/quickquery`,
                {
                    model: 'gpt-4o-mini',
                    messages: conversationHistory,
                    max_tokens: 500,
                    temperature: 0.7,
                    top_p: 0.9,
                    frequency_penalty: 0.5,
                    presence_penalty: 0.5
                }
            );

            if (response.data.error) {
                throw new Error(response.data.error);
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.data.choices[0].message.content,
                timestamp: formatTimestamp()
            }]);
        } catch (error) {
            console.error('Error in QuickQuery:', error);
            let errorMessage = "I'm sorry, I encountered an error. Please try again.";

            if (error.response?.status === 429) {
                // Check if it's a quota error from OpenAI
                const detail = error.response?.data?.detail || '';
                if (detail.includes('insufficient_quota') || detail.includes('quota')) {
                    errorMessage = "OpenAI API quota exceeded. Please check your OpenAI account billing or wait for your quota to reset.";
                } else {
                    errorMessage = "Too many requests. Please try again in a moment.";
                }
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errorMessage,
                timestamp: formatTimestamp()
            }]);
        } finally {
            finishLoading();
        }
    };

    // Helper function to detect if user is explicitly asking for sources
    const isSourcesQuery = (userMessage) => {
        if (!userMessage) return false;
        const lowerMessage = userMessage.toLowerCase();
        const sourceKeywords = [
            'sources', 'source', 'references', 'citations', 'cite',
            'where did you get', 'what are your sources', 'give me the sources',
            'show me sources', 'provide sources', 'list sources',
            'reference', 'bibliography', 'documentation'
        ];
        return sourceKeywords.some(keyword => lowerMessage.includes(keyword));
    };

    // Helper function to extract sources from message content
    const extractSources = (content, userMessage = '') => {
        // If user explicitly asked for sources, don't extract them - show as main content
        if (isSourcesQuery(userMessage)) {
            return null;
        }

        // Try multiple patterns to match sources section
        const patterns = [
            /\*\*Sources:\*\*([\s\S]*?)(?=\n\n\*\*|$)/i,
            /\*\*Sources\*\*([\s\S]*?)(?=\n\n\*\*|$)/i,
            /Sources:([\s\S]*?)(?=\n\n\*\*|$)/i,
            /\*\*References:\*\*([\s\S]*?)(?=\n\n\*\*|$)/i,
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return null;
    };

    // Helper function to get content without sources
    const getContentWithoutSources = (content, userMessage = '') => {
        // If user explicitly asked for sources, don't remove them
        if (isSourcesQuery(userMessage)) {
            return content;
        }

        const patterns = [
            /\*\*Sources:\*\*([\s\S]*?)(?=\n\n\*\*|$)/i,
            /\*\*Sources\*\*([\s\S]*?)(?=\n\n\*\*|$)/i,
            /Sources:([\s\S]*?)(?=\n\n\*\*|$)/i,
            /\*\*References:\*\*([\s\S]*?)(?=\n\n\*\*|$)/i,
        ];

        let cleanContent = content;
        for (const pattern of patterns) {
            cleanContent = cleanContent.replace(pattern, '').trim();
        }

        return cleanContent;
    };

    // Helper function to toggle sources display
    const toggleSources = (index) => {
        setShowSources(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
                @keyframes slideUpScale {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}} />
            <div className="min-h-screen bg-white flex flex-col">
                <div className="flex justify-center items-center p-4 border-b border-gray-200 bg-white relative">
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold text-primary-500">PetQuery</h2>
                    </div>
                </div>
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-4 py-6 pb-32 space-y-6">
                    {messages.length === 0 && (
                        <>
                            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6 max-w-5xl mx-auto">
                                <strong className="block mb-2 text-sm font-semibold text-gray-700">Disclaimer:</strong>
                                <p className="text-sm text-gray-600 leading-relaxed">PetQuery provides AI-generated responses for educational purposes only.
                                    These responses may contain inaccuracies and are not a substitute for professional veterinary advice.
                                    Always consult a licensed veterinarian to verify information before making any medical decisions.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
                                {randomSuggestions.map((suggestion, index) => (
                                    <div
                                        key={index}
                                        className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all duration-200 hover:-translate-y-1"
                                        onClick={() => handleSuggestionClick(suggestion.question)}
                                    >
                                        <h4 className="text-primary-600 font-semibold mb-2 text-base">{suggestion.category}</h4>
                                        <p className="text-gray-700 text-sm leading-relaxed">{suggestion.question}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                    {messages.map((msg, index) => {
                        // Find the user message that prompted this assistant response
                        const getUserMessage = (assistantIndex) => {
                            // Look backwards from the assistant message to find the most recent user message
                            for (let i = assistantIndex - 1; i >= 0; i--) {
                                if (messages[i].role === 'user') {
                                    return messages[i].content;
                                }
                            }
                            return '';
                        };

                        const userMessage = msg.role === 'assistant' ? getUserMessage(index) : '';

                        return (
                            <div key={index} className={`flex mb-6 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} max-w-none ${msg.role === 'assistant'
                                ? animateNewMessage === index
                                    ? 'animate-fade-in-up'
                                    : index === messages.length - 1
                                        ? 'opacity-0'
                                        : ''
                                : ''
                                }`}>
                                <div className={`max-w-4xl w-full ${msg.role === 'user'
                                    ? 'bg-primary-500 text-white rounded-2xl rounded-br-md px-5 py-4 ml-auto'
                                    : 'bg-primary-50 text-gray-800 rounded-2xl rounded-bl-md px-5 py-5 border-l-4 border-primary-400 message-content'
                                    }`}>
                                    {msg.role === 'assistant' ? (
                                        <div dangerouslySetInnerHTML={{ __html: formatMessage(getContentWithoutSources(msg.content, userMessage)) }} />
                                    ) : (
                                        <div className="whitespace-pre-wrap">{msg.content}</div>
                                    )}
                                    {msg.role === 'assistant' && (
                                        <div className="flex items-center gap-2 mt-3">
                                            <button
                                                className={`inline-flex items-center gap-1 px-2 py-1 text-xs border rounded transition-all duration-200 ${copiedIndex === index
                                                    ? 'bg-primary-500 text-white border-primary-500'
                                                    : 'bg-transparent text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-primary-600 hover:-translate-y-0.5'
                                                    }`}
                                                onClick={() => handleCopy(getContentWithoutSources(msg.content, userMessage), index)}
                                                aria-label="Copy message"
                                            >
                                                {copiedIndex === index ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                        <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                        <path d="M7.5 3.375c0-1.036.84-1.875 1.875-1.875h.375a3.75 3.75 0 013.75 3.75v1.875C13.5 8.161 14.34 9 15.375 9h1.875A3.75 3.75 0 0121 12.75v3.375C21 17.16 20.16 18 19.125 18h-9.75A1.875 1.875 0 017.5 16.125V3.375z" />
                                                        <path d="M15 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0017.25 7.5h-1.875A.375.375 0 0115 7.125V5.25zM4.875 6H6v10.125A3.375 3.375 0 009.375 19.5H16.5v1.125c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V7.875C3 6.839 3.84 6 4.875 6z" />
                                                    </svg>
                                                )}
                                            </button>
                                            <button
                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-transparent text-gray-600 border border-gray-300 rounded hover:bg-gray-50 hover:text-primary-600 transition-all duration-200 hover:-translate-y-0.5"
                                                onClick={() => handlePrint(getContentWithoutSources(msg.content, userMessage))}
                                                aria-label="Print message"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                    <path fillRule="evenodd" d="M7.875 1.5C6.839 1.5 6 2.34 6 3.375v2.99c-.426.053-.851.11-1.274.174-1.454.218-2.476 1.483-2.476 2.917v6.294a3 3 0 003 3h.27l-.155 1.705A1.875 1.875 0 007.232 22.5h9.536a1.875 1.875 0 001.867-2.045l-.155-1.705h.27a3 3 0 003-3V9.456c0-1.434-1.022-2.7-2.476-2.917A48.716 48.716 0 0018 6.366V3.375c0-1.036-.84-1.875-1.875-1.875h-8.25zM16.5 6.205v-2.83A.375.375 0 0016.125 3h-8.25a.375.375 0 00-.375.375v2.83a49.353 49.353 0 019 0zm-.217 8.265c.178.018.317.16.333.337l.526 5.784a.375.375 0 01-.374.409H7.232a.375.375 0 01-.374-.409l.526-5.784a.373.373 0 01.333-.337 41.741 41.741 0 018.566 0zm.967-3.97a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H18a.75.75 0 01-.75-.75V10.5zM15 9.75a.75.75 0 00-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 00.75-.75V10.5a.75.75 0 00-.75-.75H15z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                            {extractSources(msg.content, userMessage) && (
                                                <button
                                                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs border rounded transition-all duration-200 ${showSources[index]
                                                        ? 'bg-primary-100 text-primary-700 border-primary-300'
                                                        : 'bg-transparent text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-primary-600 hover:-translate-y-0.5'
                                                        }`}
                                                    onClick={() => toggleSources(index)}
                                                    aria-label="Show sources"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                        <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
                                                    </svg>
                                                </button>
                                            )}
                                            <span className="text-xs text-gray-500 ml-auto">{formatTimestamp()}</span>
                                        </div>
                                    )}
                                    {msg.role === 'assistant' && showSources[index] && extractSources(msg.content, userMessage) && (
                                        <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600 animate-fade-in-up">
                                            <div dangerouslySetInnerHTML={{ __html: formatMessage(extractSources(msg.content, userMessage)) }} />
                                        </div>
                                    )}
                                    {msg.role === 'user' && (
                                        <div className="text-xs text-white/70 mt-2 text-right">{formatTimestamp()}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {isLoading && (
                        <div className={`flex justify-start mb-6 max-w-none ${fadeOutLoader ? 'animate-fade-out' : 'animate-fade-in'}`}>
                            <div className="shimmer-loader">
                                <span className="loader-text">Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="fixed bottom-0 bg-white border-t border-gray-200 shadow-lg transition-all duration-300" style={{ left: '224px', width: 'calc(100% - 224px)' }}>
                    <div className="max-w-4xl mx-auto p-4" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
                        <div className="flex justify-center items-center gap-3 mb-3">
                            <div className="inline-flex bg-gray-100 rounded-lg p-1">
                                <button
                                    onClick={() => setIsLongAnswerMode(false)}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${!isLongAnswerMode
                                        ? 'bg-primary-400 text-white shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    Standard
                                </button>
                                <button
                                    onClick={() => setIsLongAnswerMode(true)}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${isLongAnswerMode
                                        ? 'bg-primary-400 text-white shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    Long
                                </button>
                            </div>
                            {messages.length === 0 && (
                                <div className="relative group">
                                    <button
                                        onClick={() => {
                                            setShowTutorial(true);
                                            setTutorialStep(0);
                                        }}
                                        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-all cursor-pointer"
                                        title="PetQuery tutorial"
                                    >
                                        <FaQuestionCircle className="text-gray-600 text-sm" />
                                    </button>
                                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                                        PetQuery tutorial
                                    </span>
                                </div>
                            )}
                        </div>
                        <form onSubmit={handleSubmit} className="flex gap-3 items-center">
                            <div className="relative flex-1">
                                <textarea
                                    ref={textareaRef}
                                    value={inputMessage}
                                    onChange={(e) => {
                                        setInputMessage(e.target.value);
                                        if (!e.target.value.trim()) {
                                            e.target.style.height = '52px';
                                        } else {
                                            e.target.style.height = '52px';
                                            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                                        }
                                    }}
                                    onClick={(e) => {
                                        if (inputMessage.trim()) {
                                            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            if (inputMessage.trim() && !isLoading) {
                                                e.target.style.height = '52px';
                                                handleSubmit(e);
                                            }
                                        }
                                    }}
                                    placeholder="Ask me anything about veterinary medicine..."
                                    className="w-full min-h-[52px] max-h-[120px] px-4 py-3 pr-12 text-base border-2 border-gray-300 rounded-2xl bg-white resize-none transition-all duration-200 focus:border-primary-400 focus:ring-4 focus:ring-primary-100 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                                    disabled={isLoading}
                                    rows="1"
                                />
                                {inputMessage && (
                                    <button
                                        type="button"
                                        className="absolute top-3 right-3 p-1 text-gray-400 hover:text-primary-500 transition-colors duration-200 rounded-full hover:bg-gray-100"
                                        onClick={() => {
                                            const textarea = document.querySelector('textarea');
                                            textarea.style.height = '52px';
                                        }}
                                        aria-label="Collapse input"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m18 15-6-6-6 6" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <button
                                type="submit"
                                className="w-12 h-12 bg-primary-500 text-white rounded-full hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 hover:shadow-md flex items-center justify-center flex-shrink-0 group"
                                disabled={isLoading || !inputMessage.trim()}
                                aria-label="Send message"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    width="18"
                                    height="18"
                                    className="transform group-hover:translate-x-0.5 transition-transform duration-200"
                                >
                                    <path d="m3 3 3 9-3 9 19-9Z" />
                                    <path d="m6 12 13 0" />
                                </svg>
                            </button>
                            {messages.length > 0 && (
                                <button
                                    onClick={handleClear}
                                    type="button"
                                    className="px-4 py-2 h-12 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 hover:text-gray-800 transition-colors duration-200 font-medium flex-shrink-0 flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18" />
                                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                    </svg>
                                    Clear
                                </button>
                            )}
                        </form>
                    </div>
                </div>
            </div>
            </div>

            {/* Tutorial Modal */}
            {showTutorial && (
                <div 
                    className="fixed bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" 
                    onClick={() => setShowTutorial(false)}
                    style={{
                        left: '224px',
                        right: '0',
                        top: '0',
                        bottom: '0',
                        animation: 'fadeIn 0.3s ease-out'
                    }}
                >
                    <div 
                        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col transform transition-all"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            animation: 'slideUpScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
                    >
                        {/* Tutorial Header */}
                        <div className="bg-gradient-to-r from-primary-500 to-primary-700 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-white">PetQuery Tutorial</h2>
                            <button
                                onClick={() => setShowTutorial(false)}
                                className="text-white hover:text-gray-200 transition-colors"
                            >
                                <FaTimes className="text-xl" />
                            </button>
                        </div>

                        {/* Tutorial Content */}
                        <div className="flex-1 overflow-y-auto p-8">
                            {tutorialStep === 0 && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h3 className="text-2xl font-bold text-gray-800 mb-3">Welcome to PetQuery</h3>
                                        <p className="text-gray-600 text-lg">PetQuery is your AI veterinary assistant that provides evidence-based answers to clinical questions.</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-300">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
                                                <FaSearch className="text-white text-3xl" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-gray-700 font-semibold mb-2">Step 1: Ask Your Question</p>
                                                <p className="text-gray-600 text-sm">Type your veterinary question or click a suggested question to get started</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {tutorialStep === 1 && (
                                <div className="space-y-6">
                                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Using Suggested Questions</h3>
                                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="bg-white border border-gray-200 rounded-lg p-4 cursor-not-allowed opacity-75">
                                                    <h4 className="text-primary-600 font-semibold mb-2 text-base">Treatment Protocols</h4>
                                                    <p className="text-gray-700 text-sm">What is the step-by-step treatment protocol...</p>
                                                </div>
                                                <div className="bg-white border border-gray-200 rounded-lg p-4 cursor-not-allowed opacity-75">
                                                    <h4 className="text-primary-600 font-semibold mb-2 text-base">Emergency Medicine</h4>
                                                    <p className="text-gray-700 text-sm">What are the exact dosages and timing...</p>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600">Click any suggested question card to use it, or type your own question</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {tutorialStep === 2 && (
                                <div className="space-y-6">
                                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Asking Your Question</h3>
                                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                        <div className="space-y-4">
                                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                                <div className="flex gap-3 items-center">
                                                    <div className="relative flex-1">
                                                        <textarea
                                                            disabled
                                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl resize-none focus:outline-none text-sm"
                                                            rows={2}
                                                            value="Type your veterinary question here..."
                                                        />
                                                    </div>
                                                    <button
                                                        disabled
                                                        className="w-12 h-12 bg-primary-500 text-white rounded-full cursor-not-allowed opacity-75 flex items-center justify-center"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                                            <path d="m3 3 3 9-3 9 19-9Z" />
                                                            <path d="m6 12 13 0" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 justify-center">
                                                <button disabled className="px-4 py-2 text-sm font-medium rounded-md bg-primary-400 text-white cursor-not-allowed opacity-75">
                                                    Standard
                                                </button>
                                                <button disabled className="px-4 py-2 text-sm font-medium rounded-md text-gray-600 cursor-not-allowed opacity-75">
                                                    Long
                                                </button>
                                            </div>
                                            <p className="text-sm text-gray-600 text-center">Choose Standard for concise answers or Long for detailed responses</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {tutorialStep === 3 && (
                                <div className="space-y-6">
                                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Understanding Responses</h3>
                                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                        <div className="space-y-4">
                                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                                                        <FaSearch className="text-white text-sm" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="bg-primary-50 rounded-lg p-4 mb-3">
                                                            <p className="text-gray-700 text-sm">Your question appears here...</p>
                                                        </div>
                                                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                            <p className="text-gray-700 text-sm font-semibold mb-2">Response Title</p>
                                                            <p className="text-gray-600 text-sm mb-3">PetQuery provides detailed, evidence-based answers with citations...</p>
                                                            <button disabled className="text-xs text-primary-600 cursor-not-allowed opacity-75 flex items-center gap-1">
                                                                <FaFileAlt className="text-xs" />
                                                                View Sources
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600">Responses include citations, treatment protocols, and evidence-based recommendations</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {tutorialStep === 4 && (
                                <div className="space-y-6">
                                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Using Sources & Copying</h3>
                                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                        <div className="space-y-4">
                                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-sm font-semibold text-gray-800">Response Actions</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button disabled className="px-3 py-1.5 rounded text-sm bg-primary-500 text-white cursor-not-allowed opacity-75 flex items-center gap-1.5">
                                                        <FaCopy className="text-xs" />
                                                        Copy
                                                    </button>
                                                    <button disabled className="px-3 py-1.5 rounded text-sm bg-gray-200 text-gray-700 cursor-not-allowed opacity-75">
                                                        View Sources
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-sm font-semibold text-gray-800">Key Features:</p>
                                                <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                                                    <li>Click "View Sources" to see citations and references</li>
                                                    <li>Use "Copy" to copy responses to clipboard</li>
                                                    <li>Continue the conversation with follow-up questions</li>
                                                    <li>Clear conversation anytime to start fresh</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {tutorialStep === 5 && (
                                <div className="space-y-6">
                                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Best Practices</h3>
                                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                        <div className="space-y-4">
                                            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                                                <strong className="block mb-2 text-sm font-semibold text-gray-700">Important Disclaimer:</strong>
                                                <p className="text-sm text-gray-600 leading-relaxed">PetQuery provides AI-generated responses for educational purposes only. Always verify information and consult a licensed veterinarian for clinical decisions.</p>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">1</div>
                                                    <p className="text-sm text-gray-700">Be specific in your questions for better answers</p>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">2</div>
                                                    <p className="text-sm text-gray-700">Review sources to verify information</p>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">3</div>
                                                    <p className="text-sm text-gray-700">Use follow-up questions to dive deeper</p>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">4</div>
                                                    <p className="text-sm text-gray-700">Always use professional judgment in clinical decisions</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tutorial Footer */}
                        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
                            <div className="flex items-center gap-2">
                                {[0, 1, 2, 3, 4, 5].map((step) => (
                                    <div
                                        key={step}
                                        className={`w-2 h-2 rounded-full transition-all ${tutorialStep === step ? 'bg-[#3369bd] w-8' : 'bg-gray-300'}`}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-3">
                                {tutorialStep > 0 && (
                                    <button
                                        onClick={() => setTutorialStep(tutorialStep - 1)}
                                        className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all flex items-center gap-2"
                                    >
                                        <FaArrowLeft className="text-sm" />
                                        Previous
                                    </button>
                                )}
                                {tutorialStep < 5 ? (
                                    <button
                                        onClick={() => setTutorialStep(tutorialStep + 1)}
                                        className="px-4 py-2 rounded-lg bg-[#3369bd] text-white hover:bg-[#2c5aa3] transition-all flex items-center gap-2"
                                    >
                                        Next
                                        <FaArrowRight className="text-sm" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setShowTutorial(false)}
                                        className="px-4 py-2 rounded-lg bg-[#3369bd] text-white hover:bg-[#2c5aa3] transition-all"
                                    >
                                        Get Started
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default QuickQuery; 