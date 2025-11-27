// ================ IMPORTS AND SETUP ================
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const studentRouter = require('./routes/studentRoutes');
const { correctTranscript } = require('./utils/vetCorrector');
const { runMedicalCleanup } = require('./utils/medicalCleanup');

// Load veterinary lexicon for Whisper boosting
const lexiconPath = path.join(__dirname, 'lexicon', 'vetLexicon.txt');
let vetLexicon = '';
try {
    if (fs.existsSync(lexiconPath)) {
        vetLexicon = fs.readFileSync(lexiconPath, 'utf8').trim();
        const lexiconLineCount = vetLexicon.split('\n').filter(line => line.trim().length > 0).length;
        console.log("Lexicon loaded with", lexiconLineCount, "terms");
    } else {
        console.warn("Lexicon file not found at:", lexiconPath);
    }
} catch (err) {
    console.error("Error loading lexicon:", err.message);
}

// Helper function to build boosted prompt with fail-safes
const buildBoostedPrompt = (basePrompt, contextPrompt = null) => {
    const prompt = contextPrompt || basePrompt;

    // Estimate tokens (rough: ~4 chars per token)
    const MAX_PROMPT_TOKENS = 4500; // Leave room for Whisper's internal limits
    const MAX_LEXICON_TOKENS = 4000; // Max lexicon tokens

    let lexiconToUse = vetLexicon;

    // If lexicon is too large, truncate it
    if (lexiconToUse.length > MAX_LEXICON_TOKENS * 4) {
        console.warn("Lexicon too large, truncating to", MAX_LEXICON_TOKENS, "estimated tokens");
        lexiconToUse = lexiconToUse.substring(0, MAX_LEXICON_TOKENS * 4);
    }

    // Build boosted prompt
    const lexiconSection = lexiconToUse ? `\n\nVETERINARY_TERMINOLOGY_BOOST:\n${lexiconToUse}` : '';
    const boostedPrompt = prompt + lexiconSection;

    // Final check: if still too large, fallback to base prompt only
    if (boostedPrompt.length > MAX_PROMPT_TOKENS * 4) {
        console.warn("Boosted prompt too large, falling back to base prompt only");
        return prompt;
    }

    return boostedPrompt;
};

// Set ffmpeg and ffprobe paths
if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
}
if (ffprobeStatic) {
    ffmpeg.setFfprobePath(ffprobeStatic.path);
}

// ================ APP INITIALIZATION ================
const app = express();
const stripe = Stripe(
    process.env.NODE_ENV === 'production'
        ? process.env.STRIPE_SECRET_KEY_LIVE
        : process.env.STRIPE_SECRET_KEY
);
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Middleware setup
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Multer setup for file uploads (QuickSOAP)
// Use disk storage for temp files to enable audio processing
// Use /tmp for Vercel serverless (only writable directory)
const tempDir = process.env.VERCEL ? '/tmp/temp' : path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, tempDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname || '.webm'));
        }
    }),
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit (OpenAI Whisper max)
    }
});

// Add these headers to all responses
app.use((req, res, next) => {
    const allowedOrigins = [
        'https://petwise.vet',
        'https://app.petwise.vet',
        'https://www.petwise.vet',
        'http://localhost:3000'
    ];
    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Update existing CORS middleware
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            'https://petwise.vet',
            'https://app.petwise.vet',
            'https://www.petwise.vet',
            'http://localhost:3000'
        ];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
}));

// Mount student routes
app.use('/student', studentRouter);

// ================ CONSTANTS ================
const PRICE_IDS = {
    monthly_usd: process.env.NODE_ENV === 'production'
        ? 'price_1QdhwtFpF2XskoMK2RjFj916'  // Live monthly USD
        : 'price_1QcwX5FpF2XskoMKrTsq1kHc',  // Test monthly USD
    yearly_usd: process.env.NODE_ENV === 'production'
        ? 'price_1Qdhz7FpF2XskoMK7O7GjJTn'   // Live yearly USD
        : 'price_1QcwYWFpF2XskoMKH9MJisoy',   // Test yearly USD
    monthly_cad: process.env.NODE_ENV === 'production'
        ? 'price_1QvnroFpF2XskoMKrXzdKYw7'    // Live monthly CAD
        : 'price_1QvoD2FpF2XskoMKsTtPM7mg',   // Test monthly CAD
    yearly_cad: process.env.NODE_ENV === 'production'
        ? 'price_1Qvno7FpF2XskoMKbAXkVZzh'    // Live yearly CAD
        : 'price_1QvoCfFpF2XskoMKfLelrbhT',   // Test yearly CAD
    test: process.env.NODE_ENV === 'production'
        ? 'price_1Qdje9FpF2XskoMKcC5p3bwR'
        : 'price_1QcwYWFpF2XskoMKH9MJisoy'
};
const TRIAL_DAYS = 30;  // Changed from TRIAL_MINUTES
const REPORT_LIMITS = {
    trial: 50,
    monthly: Infinity,
    yearly: Infinity
};

const ACCESS_CODES = {
    'NICKSECRETKEY5247': {
        organization: 'Petwise',
        validUntil: '2029-01-01',
        plan: 'yearly',
        maxUsers: 10  // Optional: limit users per code
    },

};

const REVOKED_CODES = new Set([

    // Add more revoked codes here
]);

// ================ QUICKQUERY ENDPOINT ================
// Handles OpenAI API calls securely from backend
app.post('/api/quickquery', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');

    try {
        const {
            messages,
            model = 'gpt-4o-mini',
            max_tokens = 2500,              // lower -> faster/cheaper; bump if needed
            temperature = 0.7,
            top_p = 0.9,
            frequency_penalty = 0.5,
            presence_penalty = 0.5
        } = req.body || {};

        // Validate messages array
        if (!Array.isArray(messages) || messages.length === 0) {
            console.error('Invalid messages array:', {
                isArray: Array.isArray(messages),
                length: messages?.length,
                messages: JSON.stringify(messages).slice(0, 500)
            });
            return res.status(400).json({ error: 'Messages array is required' });
        }

        // Validate each message has required fields
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (!msg || typeof msg !== 'object') {
                console.error(`Invalid message at index ${i}:`, msg);
                return res.status(400).json({ error: `Invalid message at index ${i}` });
            }
            if (!msg.role || msg.content === undefined || msg.content === null) {
                console.error(`Message at index ${i} missing role or content:`, msg);
                return res.status(400).json({ error: `Message at index ${i} must have role and content` });
            }
            // Ensure content is a string
            if (typeof msg.content !== 'string') {
                console.error(`Message at index ${i} content is not a string:`, typeof msg.content, msg.content);
                // Try to convert to string if it's not
                messages[i].content = String(msg.content);
            }
            // Trim and validate content isn't empty after trimming
            const trimmedContent = messages[i].content.trim();
            if (!trimmedContent) {
                console.error(`Message at index ${i} has empty content after trimming`);
                return res.status(400).json({ error: `Message at index ${i} content cannot be empty` });
            }
            messages[i].content = trimmedContent;
        }

        // Log the last user message for debugging (first 200 chars)
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        if (lastUserMessage) {
            console.log('Processing QuickQuery request:', {
                messageCount: messages.length,
                lastUserMessagePreview: lastUserMessage.content.substring(0, 200),
                model,
                max_tokens
            });
        }

        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY environment variable is not set');
            return res.status(500).json({ error: 'Server configuration error: OpenAI API key not set' });
        }

        // Use axios instead of node-fetch for better reliability
        const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 55000);

        let response;
        try {
            response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model,
                messages,
                max_tokens,
                temperature,
                top_p,
                frequency_penalty,
                presence_penalty,
                stream: false
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: OPENAI_TIMEOUT_MS,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
        } catch (axiosErr) {
            // Handle axios errors
            if (axiosErr.response) {
                // OpenAI API returned an error response
                const status = axiosErr.response.status;
                const errorText = axiosErr.response.data?.error?.message || JSON.stringify(axiosErr.response.data) || axiosErr.message;
                console.error('OpenAI API Error:', status, errorText);
                return res.status(status === 429 ? 429 : 502).json({
                    error: 'OpenAI request failed',
                    status: status,
                    detail: typeof errorText === 'string' ? errorText.slice(0, 2000) : errorText
                });
            }
            // Re-throw network/timeout errors to be handled by outer catch
            throw axiosErr;
        }

        const data = response.data;

        if (!data?.choices?.[0]?.message?.content) {
            console.error('Invalid OpenAI response structure:', JSON.stringify(data).slice(0, 500));
            return res.status(502).json({
                error: 'Invalid response from OpenAI',
                detail: 'Response missing expected data'
            });
        }

        return res.status(200).json(data);
    } catch (err) {
        // Handle axios timeout errors
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            console.error('OpenAI request timeout');
            return res.status(504).json({ error: 'Upstream timeout (OpenAI took too long)' });
        }

        // Handle network errors
        const isNetworkError =
            err?.code === 'ECONNRESET' ||
            err?.code === 'ECONNREFUSED' ||
            err?.code === 'ETIMEDOUT' ||
            err?.code === 'ENOTFOUND' ||
            err?.errno === 'ECONNRESET' ||
            err?.message?.includes('socket hang up') ||
            err?.message?.includes('ECONNRESET') ||
            err?.message?.includes('ECONNREFUSED') ||
            err?.message?.includes('Network Error');

        if (isNetworkError) {
            console.error('Network error connecting to OpenAI:', {
                code: err?.code,
                message: err?.message
            });
            return res.status(503).json({
                error: 'Network error',
                detail: 'Connection to OpenAI failed. Please try again.'
            });
        }

        console.error('QuickQuery endpoint error:', err);
        console.error('Error stack:', err.stack);
        return res.status(500).json({
            error: 'Internal server error',
            detail: err.message
        });
    }
});

// ================ QUICKSOAP ENDPOINTS ================
// Helper function to clean up temporary files
const cleanupTempFiles = (filePaths) => {
    filePaths.forEach(filePath => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (err) {
            console.error(`Error deleting temp file ${filePath}:`, err.message);
        }
    });
};

// Helper function to get audio duration in seconds
const getAudioDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                resolve(metadata.format.duration || 0);
            }
        });
    });
};

// Helper function to clean transcript
const cleanTranscript = (text) => {
    if (!text) return '';

    // Remove repeated sentences (simple approach)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const uniqueSentences = [];
    const seen = new Set();

    sentences.forEach(sentence => {
        const normalized = sentence.trim().toLowerCase();
        if (!seen.has(normalized) && normalized.length > 10) {
            seen.add(normalized);
            uniqueSentences.push(sentence.trim());
        }
    });

    // Join and normalize spacing
    let cleaned = uniqueSentences.join('. ').replace(/\s+/g, ' ').trim();

    // Remove filler artifacts from segmentation
    cleaned = cleaned.replace(/\b(um|uh|er|ah)\b/gi, '');
    cleaned = cleaned.replace(/\.{2,}/g, '.');
    cleaned = cleaned.replace(/\s+\./g, '.');
    cleaned = cleaned.replace(/\.\s+\./g, '.');

    // Fix decimal numbers: "5. 2" -> "5.2", "5 .2" -> "5.2", "5 . 2" -> "5.2"
    cleaned = cleaned.replace(/(\d+)\s*\.\s*(\d+)/g, '$1.$2');

    // Fix cases where decimal might be followed by a space and then a single digit
    // Pattern: number, optional space, period, space, single digit -> merge to decimal
    cleaned = cleaned.replace(/(\d+)\s*\.\s+(\d{1})\b/g, '$1.$2');

    return cleaned;
};

// Transcription endpoint using OpenAI Whisper with segmentation support
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    const tempFiles = [];
    const tempDirs = [];

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }

        const originalFilePath = req.file.path;
        tempFiles.push(originalFilePath);

        // Validate file exists and isn't empty
        const stats = fs.statSync(originalFilePath);
        if (stats.size === 0) {
            throw new Error('Audio file is empty');
        }

        // Create unique temp directory for this transcription
        const sessionId = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sessionTempDir = path.join(tempDir, `session-${sessionId}`);
        fs.mkdirSync(sessionTempDir, { recursive: true });
        tempDirs.push(sessionTempDir);

        // Phase 1: Convert audio to Whisper-safe format (mono, 16kHz, MP3)
        const convertedFilePath = path.join(sessionTempDir, 'converted.mp3');
        tempFiles.push(convertedFilePath);

        await new Promise((resolve, reject) => {
            ffmpeg(originalFilePath)
                .audioChannels(1) // Mono
                .audioFrequency(16000) // 16kHz
                .audioCodec('libmp3lame') // MP3 format
                .audioBitrate(64) // Lower bitrate for smaller files
                .format('mp3')
                .on('end', () => {
                    console.log('Audio conversion completed');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Audio conversion error:', err);
                    reject(err);
                })
                .save(convertedFilePath);
        });

        // Phase 2: Determine if segmentation is needed
        const convertedStats = fs.statSync(convertedFilePath);
        const fileSizeMB = convertedStats.size / (1024 * 1024);
        const duration = await getAudioDuration(convertedFilePath);
        const durationMinutes = duration / 60;

        const SEGMENTATION_THRESHOLD_MB = 20;
        const SEGMENTATION_THRESHOLD_MINUTES = 3;
        const needsSegmentation = fileSizeMB > SEGMENTATION_THRESHOLD_MB || durationMinutes > SEGMENTATION_THRESHOLD_MINUTES;

        let combinedTranscript = '';
        const basePrompt = `This is a veterinary medical dictation. Extract ONLY clinically relevant content.

CRITICAL: MAXIMUM ACCURACY FOR VETERINARY MEDICAL TERMINOLOGY REQUIRED.

You must transcribe veterinary medical language with EXTREME PRECISION. Pay special attention to:
- Long, complex scientific terms (e.g., pancreatitis, pyometra, hemangiosarcoma, lymphosarcoma, cholangiohepatitis, polycythemia, thrombocytopenia)
- Medication names (e.g., enrofloxacin, metronidazole, prednisolone, cephalexin, amoxicillin-clavulanate, furosemide, atenolol, gabapentin, tramadol, buprenorphine, maropitant, ondansetron)
- Diagnostic terms (e.g., echocardiogram, electrocardiogram, radiographs, ultrasonography, cytology, histopathology, biochemistry, hematology)
- Anatomical terms (e.g., gastrointestinal, cardiovascular, respiratory, musculoskeletal, integumentary, neurological, urogenital)
- Disease names (e.g., diabetes mellitus, hyperadrenocorticism, hypothyroidism, chronic kidney disease, inflammatory bowel disease, atopic dermatitis)
- Veterinary acronyms (e.g., CBC, CPL, TLI, BUN, CREA, ALT, AST, ALP, GGT, PT, PTT, ACTH, TSH, T4, FNA, BCS, MCS, IV, IM, SQ, PO, SID, BID, TID, QID, PRN)
- Breed names and species-specific terminology
- Dosage units (mg/kg, mL/kg, units/kg, mcg/kg)
- Clinical measurements and values

When encountering unclear audio for medical terms:
- Prioritize veterinary medical terminology over common words
- Use context clues from surrounding medical language
- Preserve exact spelling of medications, diagnoses, and scientific terms
- Do NOT simplify or abbreviate unless the speaker clearly uses an abbreviation
- Maintain capitalization for proper nouns (medication brand names, breed names)

IGNORE and REMOVE:
- Greetings and small talk
- Owner chit-chat or emotional comments
- Anything unrelated to veterinary medicine
- Jokes, personal stories, casual conversation
- Comments from kids or other people in the room
- Background dialogue, noise, or interruptions
- Anything that does not describe signalment, symptoms, physical exam, diagnostics, or medical decisions

KEEP and CLEAN:
- Signalment
- Presenting complaint
- History
- Owner-reported clinical signs
- All exam findings
- All diagnostics
- Diagnoses and differentials
- Treatment decisions
- Plans or follow-ups

Rewrite the output as clean clinical dictation with no extra words, maintaining maximum accuracy for all veterinary medical terminology.`;

        if (needsSegmentation) {
            // Phase 3: Segment audio into 3-minute chunks
            console.log(`Segmenting audio: ${fileSizeMB.toFixed(2)}MB, ${durationMinutes.toFixed(2)} minutes`);

            const chunkDuration = 180; // 3 minutes in seconds
            const numChunks = Math.ceil(duration / chunkDuration);
            const chunkFiles = [];

            // Create chunks
            for (let i = 0; i < numChunks; i++) {
                const startTime = i * chunkDuration;
                const chunkFilePath = path.join(sessionTempDir, `chunk_${String(i + 1).padStart(3, '0')}.mp3`);
                chunkFiles.push(chunkFilePath);
                tempFiles.push(chunkFilePath);

                await new Promise((resolve, reject) => {
                    ffmpeg(convertedFilePath)
                        .seekInput(startTime)
                        .duration(chunkDuration)
                        .audioChannels(1)
                        .audioFrequency(16000)
                        .audioCodec('libmp3lame')
                        .audioBitrate(64)
                        .format('mp3')
                        .on('end', () => resolve())
                        .on('error', (err) => {
                            console.error(`Error creating chunk ${i + 1}:`, err);
                            reject(err);
                        })
                        .save(chunkFilePath);
                });
            }

            // Phase 4: Transcribe chunks with parallel processing for speed
            console.log(`Transcribing ${chunkFiles.length} chunks (parallel processing enabled)...`);

            // Helper function to transcribe a single chunk with retries
            const transcribeChunk = async (chunkFilePath, chunkIndex, contextPrompt = null) => {
                let retries = 2;
                while (retries >= 0) {
                    try {
                        const chunkFormData = new FormData();
                        const chunkBuffer = fs.readFileSync(chunkFilePath);

                        chunkFormData.append('file', chunkBuffer, {
                            filename: `chunk_${chunkIndex + 1}.mp3`,
                            contentType: 'audio/mpeg',
                            knownLength: chunkBuffer.length
                        });
                        chunkFormData.append('model', 'whisper-1');
                        chunkFormData.append('response_format', 'text');
                        const boostedPrompt = buildBoostedPrompt(basePrompt, contextPrompt);
                        chunkFormData.append('prompt', boostedPrompt);

                        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', chunkFormData, {
                            headers: {
                                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                                ...chunkFormData.getHeaders()
                            },
                            maxContentLength: Infinity,
                            maxBodyLength: Infinity,
                            responseType: 'text'
                        });

                        return response.data.trim();
                    } catch (err) {
                        console.error(`Error transcribing chunk ${chunkIndex + 1} (retries left: ${retries}):`, err.message);
                        if (retries === 0) {
                            console.error(`Failed to transcribe chunk ${chunkIndex + 1} after all retries`);
                            return `[Transcription error for segment ${chunkIndex + 1}]`;
                        }
                        retries--;
                        if (retries >= 0) {
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
                        }
                    }
                }
                return '';
            };

            // Transcribe first chunk sequentially (needed for context)
            const firstChunkBoostedPrompt = buildBoostedPrompt(basePrompt);
            const firstChunkTranscript = await transcribeChunk(chunkFiles[0], 0, firstChunkBoostedPrompt);
            combinedTranscript = firstChunkTranscript;

            // Transcribe remaining chunks in parallel (with first chunk context for continuity)
            if (chunkFiles.length > 1) {
                const firstChunkContext = firstChunkTranscript.trim().split(/\s+/).slice(-200).join(' ');
                const contextPrompt = basePrompt + '\n\nPrevious context: ' + firstChunkContext;
                const boostedContextPrompt = buildBoostedPrompt(basePrompt, contextPrompt);

                const remainingChunks = chunkFiles.slice(1).map((chunkFilePath, index) =>
                    transcribeChunk(chunkFilePath, index + 1, boostedContextPrompt)
                );

                const remainingTranscripts = await Promise.all(remainingChunks);

                // Combine transcripts in order
                remainingTranscripts.forEach(transcript => {
                    if (transcript) {
                        combinedTranscript += ' ' + transcript;
                    }
                });
            }
        } else {
            // Single file transcription (no segmentation needed)
            console.log('Transcribing single file (no segmentation needed)');

            const fileBuffer = fs.readFileSync(convertedFilePath);
            const formData = new FormData();

            formData.append('file', fileBuffer, {
                filename: 'converted.mp3',
                contentType: 'audio/mpeg',
                knownLength: fileBuffer.length
            });
            formData.append('model', 'whisper-1');
            formData.append('response_format', 'text');
            const boostedPrompt = buildBoostedPrompt(basePrompt);
            console.log("Whisper prompt length:", boostedPrompt.length);
            formData.append('prompt', boostedPrompt);

            const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    ...formData.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                responseType: 'text'
            });

            combinedTranscript = response.data.trim();
        }

        // Phase 5: Clean the final transcript
        const cleanTranscription = cleanTranscript(combinedTranscript);

        // Phase 5.5: GPT-4o-mini medical cleanup (before VetCorrector)
        // Wrap in try-catch to ensure we never fail the entire request if cleanup fails
        let cleanedTranscript = cleanTranscription;
        try {
            cleanedTranscript = await runMedicalCleanup(cleanTranscription);
        } catch (cleanupErr) {
            console.error('Medical cleanup failed, using cleaned transcript:', cleanupErr.message);
            cleanedTranscript = cleanTranscription; // Fallback to cleaned transcript
        }

        // Phase 6: Apply veterinary terminology correction
        const corrected = correctTranscript(cleanedTranscript);

        // Generate summary
        let summary = '';
        try {
            const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'user',
                            content: `Summarize this veterinary dictation in 1-2 short sentences focusing on the main complaint or finding. Include exact drug names, diagnoses, and medical terms as stated:\n\n"${corrected}"`
                        }
                    ],
                    max_tokens: 150,
                    temperature: 0.3
                })
            });

            if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                summary = summaryData.choices?.[0]?.message?.content?.trim() || '';
            }
        } catch (err) {
            console.error('Summary generation error:', err);
            summary = corrected.length > 100
                ? corrected.substring(0, 100) + '...'
                : corrected;
        }

        // Phase 7: Cleanup temp files
        cleanupTempFiles(tempFiles);
        tempDirs.forEach(dir => {
            try {
                if (fs.existsSync(dir)) {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            } catch (err) {
                console.error(`Error deleting temp directory ${dir}:`, err.message);
            }
        });

        res.json({
            text: corrected,
            summary: summary || corrected.substring(0, 100) + (corrected.length > 100 ? '...' : '')
        });
    } catch (err) {
        // Cleanup on error
        cleanupTempFiles(tempFiles);
        tempDirs.forEach(dir => {
            try {
                if (fs.existsSync(dir)) {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            } catch (cleanupErr) {
                console.error(`Error during cleanup:`, cleanupErr.message);
            }
        });

        console.error('Transcription endpoint error:', err);
        console.error('Error details:', err.message, err.stack);

        // Handle axios errors
        if (err.response) {
            const errorText = err.response.data?.error?.message || JSON.stringify(err.response.data) || err.message;
            console.error('OpenAI Whisper API Error:', err.response.status, errorText);
            return res.status(err.response.status === 429 ? 429 : 502).json({
                error: 'Transcription failed',
                detail: typeof errorText === 'string' ? errorText.slice(0, 500) : errorText
            });
        }

        res.status(500).json({ error: 'Internal server error during transcription', detail: err.message });
    }
});

// Simplified transcription endpoint for PetQuery (just transcribes, no cleaning)
app.post('/api/transcribe-simple', upload.single('audio'), async (req, res) => {
    const tempFile = req.file?.path;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const fileName = req.file.originalname || 'audio.webm';
        const mimeType = req.file.mimetype || 'audio/webm';

        // Read file from disk since multer uses diskStorage
        const fileBuffer = fs.readFileSync(req.file.path);

        const formData = new FormData();
        formData.append('file', fileBuffer, {
            filename: fileName,
            contentType: mimeType,
            knownLength: fileBuffer.length
        });
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'text');

        const petQueryPrompt = `This is a veterinary medical query dictation. Transcribe with MAXIMUM ACCURACY for veterinary medical terminology.

CRITICAL: MAXIMUM ACCURACY FOR VETERINARY MEDICAL TERMINOLOGY REQUIRED.

You must transcribe veterinary medical language with EXTREME PRECISION. Pay special attention to:
- Long, complex scientific terms (e.g., pancreatitis, pyometra, hemangiosarcoma, lymphosarcoma, cholangiohepatitis, polycythemia, thrombocytopenia)
- Medication names (e.g., enrofloxacin, metronidazole, prednisolone, cephalexin, amoxicillin-clavulanate, furosemide, atenolol, gabapentin, tramadol, buprenorphine, maropitant, ondansetron)
- Diagnostic terms (e.g., echocardiogram, electrocardiogram, radiographs, ultrasonography, cytology, histopathology, biochemistry, hematology)
- Anatomical terms (e.g., gastrointestinal, cardiovascular, respiratory, musculoskeletal, integumentary, neurological, urogenital)
- Disease names (e.g., diabetes mellitus, hyperadrenocorticism, hypothyroidism, chronic kidney disease, inflammatory bowel disease, atopic dermatitis)
- Veterinary acronyms (e.g., CBC, CPL, TLI, BUN, CREA, ALT, AST, ALP, GGT, PT, PTT, ACTH, TSH, T4, FNA, BCS, MCS, IV, IM, SQ, PO, SID, BID, TID, QID, PRN)
- Breed names and species-specific terminology
- Dosage units (mg/kg, mL/kg, units/kg, mcg/kg)
- Clinical measurements and values

When encountering unclear audio for medical terms:
- Prioritize veterinary medical terminology over common words
- Use context clues from surrounding medical language
- Preserve exact spelling of medications, diagnoses, and scientific terms
- Do NOT simplify or abbreviate unless the speaker clearly uses an abbreviation
- Maintain capitalization for proper nouns (medication brand names, breed names)

Transcribe the complete veterinary medical question or query with maximum accuracy for all terminology.`;

        const boostedPetQueryPrompt = buildBoostedPrompt(petQueryPrompt);
        console.log("Whisper prompt length:", boostedPetQueryPrompt.length);
        formData.append('prompt', boostedPetQueryPrompt);

        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }

        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                ...formData.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            responseType: 'text'
        });

        const transcription = response.data.trim();

        // GPT-4o-mini medical cleanup (before VetCorrector)
        // Wrap in try-catch to ensure we never fail the entire request if cleanup fails
        let cleanedTranscript = transcription;
        try {
            cleanedTranscript = await runMedicalCleanup(transcription);
        } catch (cleanupErr) {
            console.error('Medical cleanup failed, using original transcript:', cleanupErr.message);
            cleanedTranscript = transcription; // Fallback to original transcript
        }

        // Apply veterinary terminology correction
        const corrected = correctTranscript(cleanedTranscript);

        res.json({ text: corrected });
    } catch (err) {
        console.error('Simple transcription endpoint error:', err);
        console.error('Error stack:', err.stack);

        if (err.response) {
            const errorText = err.response.data?.error?.message || JSON.stringify(err.response.data) || err.message;
            console.error('OpenAI Whisper API Error:', err.response.status, errorText);
            return res.status(err.response.status === 429 ? 429 : 502).json({
                error: 'Transcription failed',
                detail: typeof errorText === 'string' ? errorText.slice(0, 500) : errorText
            });
        }

        res.status(500).json({ error: 'Internal server error during transcription', detail: err.message });
    } finally {
        // Clean up temp file
        if (tempFile && fs.existsSync(tempFile)) {
            try {
                fs.unlinkSync(tempFile);
            } catch (cleanupErr) {
                console.error('Error cleaning up temp file:', cleanupErr.message);
            }
        }
    }
});

// Test endpoint for medical cleanup
app.post('/api/testCleanup', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Text is required' });
        }

        const cleaned = await runMedicalCleanup(text);

        res.json({
            original: text,
            cleaned: cleaned
        });
    } catch (err) {
        console.error('Test cleanup error:', err);
        res.status(500).json({ error: 'Cleanup failed', detail: err.message });
    }
});

// SOAP generation endpoint using gpt-4o-mini
app.post('/api/generate-soap', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');

    try {
        const { input } = req.body;

        if (!input || !input.trim()) {
            return res.status(400).json({ error: 'Input text is required' });
        }

        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY environment variable is not set');
            return res.status(500).json({ error: 'Server configuration error: OpenAI API key not set' });
        }

        const prompt = `USER INPUT:
"${input.trim()}"

You are an AI veterinary medical scribe.  
Your job is to carefully interpret the dictation and generate a complete, detailed SOAP record.

OUTPUT REQUIREMENTS:
- Use plain text only. No bold, no markdown, no symbols.
- Every bullet point must be a short, complete clinical sentence.
- Each SOAP subsection should contain multiple bullets when appropriate, not just one.
- Extract ALL medically relevant information from the dictation, even if subtle.
- Do not leave out any meaningful details (exam findings, observations, comments, measurements, impressions).
- Include normal findings wherever the vet explicitly or implicitly confirmed them.
- Never invent abnormalities or diagnostics not supported by the dictation.
- If the veterinarian does not provide a diagnosis, infer the most likely primary diagnosis.
- Always provide exactly three appropriate differential diagnoses unless the veterinarian states their own.
- Always place past or future treatment under the Treatment section.
- Use species-appropriate terminology and realistic veterinary phrasing.
- If Physical Exam findings or Vital Signs are not mentioned, include them as normal. Do not say "Not Provided".
- PET NAME USAGE: 
  * CRITICAL: In the Subjective section (Presenting Complaint, History, Owner Observations), you MUST use the pet's name if it is mentioned anywhere in the dictation. Scan the entire dictation for pet names. If a name is found (e.g., "Joe", "Jasper", "Buddy", "Milo"), use it throughout the Subjective section (e.g., "Joe is a feline domestic shorthair with bladder cancer" NOT "The patient is a feline..."). Only use "the patient" or "the [species]" if NO pet name is mentioned in the dictation at all.
  * STRICTLY FORBIDDEN: In the Objective, Assessment, and Plan sections, you MUST NEVER use the pet's name. Always use "patient", "the patient", "animal", or species-specific terms (e.g., "cat", "dog", "feline", "canine") instead. Examples: "The patient appears lethargic" NOT "Milo appears lethargic", "Monitor the patient's hydration" NOT "Monitor Milo's hydration". If you see the pet name in these sections, replace it with "patient" or the species.

EXPANSION RULES:
- If the dictation describes several systems as normal, list them individually (e.g., normal heart sounds, clear lungs, soft abdomen).
- If the dictation mentions multiple exam observations, create multiple physical exam bullets.
- If the owner provides several comments, convert each into its own bullet.
- If vital signs are mentioned, include every one and restate them clearly.
- Do not compress multiple findings into one bullet.
- Err on the side of including more detail rather than less.
- CONDITIONAL SECTIONS: Only include a "Masses:" subsection under Physical Exam if the dictation mentions any masses, lumps, nodules, or similar findings. If no masses are mentioned, omit this section entirely.

TREATMENT SECTION FORMATTING:
- List medications and treatments in a concise, direct format.
- Do NOT use phrases like "The patient was prescribed" or "The patient was given".
- Format as: [Drug name] [dosage] [route] [frequency] [duration/indication].
- Examples:
  * "Neopolydex eye drops OU TID for 10 days"
  * "Pimobendan 0.5 mg/kg PO SID to prevent cardiomegaly"
  * "Cerenia 1 mg/kg SQ once daily for nausea"
- Keep each treatment bullet short, clean, and clinically formatted.
- Include route (PO, SQ, IM, IV, OU, OD, OS, transdermal, etc.) when specified.
- Include indication or purpose when relevant (e.g., "for nausea", "to prevent cardiomegaly").

SOAP RECORD:

Subjective:
Presenting Complaint:
- [USE THE PET'S NAME HERE IF MENTIONED IN DICTATION, otherwise use "the patient" or "the [species]"]
History:
- [USE THE PET'S NAME HERE IF MENTIONED IN DICTATION]
Owner Observations:
- [USE THE PET'S NAME HERE IF MENTIONED IN DICTATION]

Objective:
Physical Exam:
- General:
- Body Condition Score: x/9 (x is the body condition score out of 9)
- Hydration:
- Mucous membranes:
- CRT:
- Cardiovascular:
- Respiratory:
- Gastrointestinal:
- Musculoskeletal:
- Neurologic:
- Integumentary:
- Lymph nodes:
- Eyes/Ears/Nose/Throat:
- Masses: (ONLY include this line and subsection if masses are mentioned in the dictation)
Vital Signs:
- Temperature:
- Heart Rate:
- Respiratory Rate:
- Weight:
Diagnostics:
-

Assessment:
Problem List:
-
Primary Diagnosis:
-
Differential Diagnoses:
-

Plan:
Treatment:
-
Monitoring:
-
Client Communication:
-
Follow-up:
-

---

PET NAME EXTRACTION:
After the SOAP record above, extract the pet's name from the dictation if mentioned. Look for names mentioned in signalment, owner observations, or throughout the dictation. Scan all dictations provided.
If a pet name is found, add this line at the very end:
PET_NAME: [name]
If no pet name is found or mentioned, add this line at the very end:
PET_NAME: no name provided
Always include the PET_NAME line - either with the actual name or "no name provided".
Example: PET_NAME: Buddy
Example: PET_NAME: no name provided
`;

        // Use axios instead of node-fetch for better reliability
        const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 55000);

        let response;
        try {
            response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 4000,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: OPENAI_TIMEOUT_MS,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
        } catch (axiosErr) {
            // Handle axios errors
            if (axiosErr.response) {
                const status = axiosErr.response.status;
                const errorText = axiosErr.response.data?.error?.message || JSON.stringify(axiosErr.response.data) || axiosErr.message;
                console.error('OpenAI API Error:', status, errorText);
                return res.status(status === 429 ? 429 : 502).json({
                    error: 'SOAP generation failed',
                    status: status,
                    detail: typeof errorText === 'string' ? errorText.slice(0, 2000) : errorText
                });
            }
            // Re-throw network/timeout errors to be handled by outer catch
            throw axiosErr;
        }

        const data = response.data;
        const fullResponse = data.choices?.[0]?.message?.content;
        const finishReason = data.choices?.[0]?.finish_reason;

        // Log if response was truncated
        if (finishReason === 'length') {
            console.warn('SOAP generation response was truncated due to max_tokens limit');
        }

        if (!fullResponse) {
            return res.status(500).json({ error: 'No report generated' });
        }

        // Extract pet name if present
        let report = fullResponse;
        let petName = null;

        const petNameMatch = fullResponse.match(/PET_NAME:\s*(.+?)(?:\n|$)/i);
        if (petNameMatch && petNameMatch[1]) {
            const extractedName = petNameMatch[1].trim();
            // Only set petName if it's not "no name provided"
            if (extractedName.toLowerCase() !== 'no name provided') {
                petName = extractedName;
            }
            // Remove the PET_NAME line from the report
            report = fullResponse.replace(/PET_NAME:\s*.+?(?:\n|$)/i, '').trim();
        }

        return res.status(200).json({ report, petName });
    } catch (err) {
        // Handle axios timeout errors
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            console.error('OpenAI request timeout');
            return res.status(504).json({ error: 'Upstream timeout (OpenAI took too long)' });
        }

        // Handle network errors
        const isNetworkError =
            err?.code === 'ECONNRESET' ||
            err?.code === 'ECONNREFUSED' ||
            err?.code === 'ETIMEDOUT' ||
            err?.code === 'ENOTFOUND' ||
            err?.errno === 'ECONNRESET' ||
            err?.message?.includes('socket hang up') ||
            err?.message?.includes('ECONNRESET') ||
            err?.message?.includes('ECONNREFUSED') ||
            err?.message?.includes('Network Error');

        if (isNetworkError) {
            console.error('Network error connecting to OpenAI:', {
                code: err?.code,
                message: err?.message
            });
            return res.status(503).json({
                error: 'Network error',
                detail: 'Connection to OpenAI failed. Please try again.'
            });
        }

        console.error('SOAP generation endpoint error:', err);
        console.error('Error stack:', err.stack);
        return res.status(500).json({
            error: 'Internal server error',
            detail: err.message
        });
    }
});

// ================ CHECKOUT ENDPOINT ================
// Handles creation of Stripe checkout sessions
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { user, planType, currency = 'usd' } = req.body;
        const priceId = PRICE_IDS[`${planType}_${currency}`];

        if (!priceId) {
            throw new Error('Invalid plan type or currency');
        }

        // Find or create customer with invoice settings
        let customer;
        const existingCustomers = await stripe.customers.list({
            email: user.email,
            limit: 1
        });

        if (existingCustomers.data.length > 0) {
            // Force update existing customer's email and set invoice settings
            customer = await stripe.customers.update(existingCustomers.data[0].id, {
                email: user.email,
                name: user.name || 'Valued Customer',
                invoice_settings: {
                    default_payment_method: null // Ensure invoice uses the email from Customer object
                }
            });
        } else {
            customer = await stripe.customers.create({
                email: user.email,
                name: user.name || 'Valued Customer',
                metadata: { auth0_user_id: user.sub },
                invoice_settings: {
                    default_payment_method: null
                }
            });
        }

        // Create checkout session with updated customer
        const session = await stripe.checkout.sessions.create({
            customer: customer.id,  // Using existing customer object
            payment_method_types: ['card'],
            mode: 'subscription',
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            automatic_tax: { enabled: true },
            tax_id_collection: { enabled: true },
            customer_update: {
                address: 'auto',
                name: 'auto'
            },
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            success_url: process.env.NODE_ENV === 'production'
                ? 'https://app.petwise.vet/dashboard'
                : 'http://localhost:3000/dashboard',
            cancel_url: process.env.NODE_ENV === 'production'
                ? 'https://app.petwise.vet/dashboard'
                : 'http://localhost:3000/dashboard',
            client_reference_id: user.sub
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================ WEBHOOK HANDLER ================
// Processes Stripe webhook events
app.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.NODE_ENV === 'production'
        ? process.env.STRIPE_WEBHOOK_SECRET_LIVE
        : process.env.STRIPE_WEBHOOK_SECRET;

    console.log('Webhook received:', {
        hasSignature: !!sig,
        hasBody: !!req.body,
        env: process.env.NODE_ENV,
        webhookSecret: webhookSecret ? 'present' : 'missing'
    });

    try {
        const event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            webhookSecret
        );

        console.log('Event Type:', event.type);

        // Handle initial subscription creation
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            console.log('Checkout Session:', session);

            try {
                const subscription = await stripe.subscriptions.retrieve(session.subscription);
                console.log('Subscription:', subscription);

                const priceId = subscription.items.data[0].price.id;
                console.log('Price ID:', priceId);

                // Determine subscription interval from price
                let subscriptionInterval = 'monthly'; // default

                if (priceId === PRICE_IDS.yearly_usd || priceId === PRICE_IDS.yearly_cad) {
                    subscriptionInterval = 'yearly';
                } else if (priceId === PRICE_IDS.monthly_usd || priceId === PRICE_IDS.monthly_cad) {
                    subscriptionInterval = 'monthly';
                }

                const updateData = {
                    subscription_status: 'active',
                    subscription_interval: subscriptionInterval,
                    stripe_customer_id: session.customer,
                    subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
                    reports_used_today: 0,
                    last_report_date: new Date().toISOString().split('T')[0],
                    has_used_trial: true,
                    cancel_at_period_end: false,
                    // Clear student fields on paid activation (but preserve graduation year)
                    plan_label: null,
                    student_school_email: null,
                    student_last_student_redeem_at: null
                    // student_grad_year: null, // REMOVED - graduation year is permanent
                };

                console.log('Updating user with data:', {
                    auth0_user_id: session.client_reference_id,
                    ...updateData
                });

                const { data, error } = await supabase
                    .from('users')
                    .update(updateData)
                    .eq('auth0_user_id', session.client_reference_id)
                    .select();

                if (error) {
                    console.error('Supabase update error:', error);
                    throw error;
                }

                console.log('Update successful:', data);
            } catch (error) {
                console.error('Subscription processing error:', error);
                return res.status(500).json({ error: error.message });
            }
        }

        // Handle successful recurring payments
        if (event.type === 'invoice.payment_succeeded') {
            const invoice = event.data.object;
            console.log('Payment succeeded for invoice:', invoice.id);

            // Only process subscription invoices (not one-time payments)
            if (invoice.subscription) {
                try {
                    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
                    const customer = await stripe.customers.retrieve(invoice.customer);

                    console.log('Updating subscription for customer:', customer.id);

                    // Find user by stripe customer ID
                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('auth0_user_id')
                        .eq('stripe_customer_id', customer.id)
                        .single();

                    if (userError || !userData) {
                        console.error('User not found for customer:', customer.id);
                        return res.status(200).json({ received: true });
                    }

                    // Determine subscription interval from price
                    const priceId = subscription.items.data[0].price.id;

                    let subscriptionInterval = 'monthly'; // default

                    if (priceId === PRICE_IDS.yearly_usd || priceId === PRICE_IDS.yearly_cad) {
                        subscriptionInterval = 'yearly';
                    } else if (priceId === PRICE_IDS.monthly_usd || priceId === PRICE_IDS.monthly_cad) {
                        subscriptionInterval = 'monthly';
                    }

                    // Update subscription with new period end
                    const { error: updateError } = await supabase
                        .from('users')
                        .update({
                            subscription_status: 'active',
                            subscription_interval: subscriptionInterval,
                            subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
                            cancel_at_period_end: subscription.cancel_at_period_end || false,
                            // Clear student fields on paid activation (but preserve graduation year)
                            plan_label: null,
                            student_school_email: null,
                            student_last_student_redeem_at: null
                            // student_grad_year: null, // REMOVED - graduation year is permanent
                        })
                        .eq('auth0_user_id', userData.auth0_user_id);

                    if (updateError) {
                        console.error('Failed to update user subscription:', updateError);
                        throw updateError;
                    }

                    console.log('Successfully renewed subscription for user:', userData.auth0_user_id);
                } catch (error) {
                    console.error('Error processing payment success:', error);
                    return res.status(500).json({ error: error.message });
                }
            }
        }

        // Handle failed recurring payments
        if (event.type === 'invoice.payment_failed') {
            const invoice = event.data.object;
            console.log('Payment failed for invoice:', invoice.id);

            if (invoice.subscription) {
                try {
                    const customer = await stripe.customers.retrieve(invoice.customer);
                    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);

                    // Find user by stripe customer ID
                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('auth0_user_id, subscription_end_date')
                        .eq('stripe_customer_id', customer.id)
                        .single();

                    if (userError || !userData) {
                        console.error('User not found for customer:', customer.id);
                        return res.status(200).json({ received: true });
                    }

                    // Calculate grace period: exactly 7 days from first payment failure
                    const gracePeriodEnd = new Date();
                    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

                    // Set status to past_due when payment fails
                    // This gives user exactly 7 days grace period
                    const { error: updateError } = await supabase
                        .from('users')
                        .update({
                            subscription_status: 'past_due',
                            grace_period_end: gracePeriodEnd.toISOString()
                        })
                        .eq('auth0_user_id', userData.auth0_user_id);

                    if (updateError) {
                        console.error('Failed to update user to past_due:', updateError);
                        throw updateError;
                    }

                    console.log('Marked subscription as past_due for user:', userData.auth0_user_id, 'with 7-day grace period until:', gracePeriodEnd.toISOString());
                } catch (error) {
                    console.error('Error processing payment failure:', error);
                    return res.status(500).json({ error: error.message });
                }
            }
        }

        // Handle subscription updates (cancellations, reactivations, etc.)
        if (event.type === 'customer.subscription.updated') {
            const subscription = event.data.object;
            console.log('Subscription updated:', subscription.id);

            try {
                // Find user by stripe customer ID
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('auth0_user_id')
                    .eq('stripe_customer_id', subscription.customer)
                    .single();

                if (userError || !userData) {
                    console.error('User not found for customer:', subscription.customer);
                    return res.status(200).json({ received: true });
                }

                let updateData = {
                    subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
                    cancel_at_period_end: subscription.cancel_at_period_end || false
                };

                // Update status based on subscription status
                if (subscription.status === 'active') {
                    updateData.subscription_status = 'active';
                } else if (subscription.status === 'past_due') {
                    updateData.subscription_status = 'past_due';
                } else if (subscription.status === 'canceled') {
                    updateData.subscription_status = 'inactive';
                }

                const { error: updateError } = await supabase
                    .from('users')
                    .update(updateData)
                    .eq('auth0_user_id', userData.auth0_user_id);

                if (updateError) {
                    console.error('Failed to update subscription status:', updateError);
                    throw updateError;
                }

                console.log('Successfully updated subscription status for user:', userData.auth0_user_id);
            } catch (error) {
                console.error('Error processing subscription update:', error);
                return res.status(500).json({ error: error.message });
            }
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Webhook Error:', err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

// ================ SUBSCRIPTION CANCELLATION ENDPOINT ================
// Handles subscription cancellation requests
app.post('/cancel-subscription', async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // Get user's stripe customer id
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('stripe_customer_id')
            .eq('auth0_user_id', user_id)
            .single();

        if (userError || !userData?.stripe_customer_id) {
            return res.status(404).json({ error: 'No subscription found' });
        }

        // Get active subscription
        const subscriptions = await stripe.subscriptions.list({
            customer: userData.stripe_customer_id,
            limit: 1,
        });

        if (subscriptions.data.length === 0) {
            return res.status(404).json({ error: 'No active subscription found' });
        }

        // Cancel subscription at period end
        const subscription = await stripe.subscriptions.update(
            subscriptions.data[0].id,
            { cancel_at_period_end: true }
        );

        // Update database
        const { error: updateError } = await supabase
            .from('users')
            .update({
                subscription_status: 'active',
                cancel_at_period_end: true,
                subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString()
            })
            .eq('auth0_user_id', user_id);

        if (updateError) {
            throw updateError;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(400).json({ error: error.message });
    }
});

// ================ TRIAL ENDPOINT ================
app.post('/activate-trial', async (req, res) => {
    try {
        const { user_id, emailOptOut = false } = req.body;
        console.log('Trial activation request:', { user_id, emailOptOut });

        if (!user_id) {
            throw new Error('user_id is required');
        }

        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);

        const updateData = {
            subscription_status: 'active',
            subscription_interval: 'trial',
            subscription_end_date: trialEndDate.toISOString(),
            has_used_trial: true,
            reports_used_today: 0,
            last_report_date: new Date().toISOString().split('T')[0],
            email_opt_out: emailOptOut,
            // Clear student fields when activating trial (but preserve graduation year)
            plan_label: null,
            student_school_email: null,
            student_last_student_redeem_at: null
            // student_grad_year: null, // REMOVED - graduation year is permanent
        };

        console.log('Updating user with data:', updateData);

        const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('auth0_user_id', user_id)
            .select();

        if (error) {
            console.error('Supabase update error:', error);
            throw error;
        }

        console.log('Trial activation successful:', data);
        res.json(data);
    } catch (error) {
        console.error('Trial activation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add this new endpoint for canceling trials
app.post('/cancel-trial', async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // Update user's trial status
        const { error: updateError } = await supabase
            .from('users')
            .update({
                subscription_status: 'inactive',
                subscription_end_date: new Date().toISOString() // End trial immediately
            })
            .eq('auth0_user_id', user_id);

        if (updateError) throw updateError;

        res.json({ success: true });
    } catch (error) {
        console.error('Cancel trial error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Add this function before the server startup section
// NOTE: Commented out since you have a Supabase function handling expiration checks
// async function checkTrialExpirations() {
//     const now = new Date().toISOString();

//     // Handle expired active subscriptions
//     const { data: expiredActive, error: activeError } = await supabase
//         .from('users')
//         .update({ subscription_status: 'inactive' })
//         .lt('subscription_end_date', now)
//         .eq('subscription_status', 'active')
//         .select();

//     if (activeError) {
//         console.error('Error checking active subscription expirations:', activeError);
//     } else if (expiredActive && expiredActive.length > 0) {
//         console.log(`Deactivated ${expiredActive.length} expired active subscriptions`);
//     }

//     // Handle expired past_due subscriptions
//     const { data: expiredPastDue, error: pastDueError } = await supabase
//         .from('users')
//         .update({ subscription_status: 'inactive' })
//         .lt('subscription_end_date', now)
//         .eq('subscription_status', 'past_due')
//         .select();

//     if (pastDueError) {
//         console.error('Error checking past_due subscription expirations:', pastDueError);
//     } else if (expiredPastDue && expiredPastDue.length > 0) {
//         console.log(`Deactivated ${expiredPastDue.length} expired past_due subscriptions`);
//     }
// }

// Add this new middleware function
async function checkReportLimit(req, res, next) {
    try {
        const { user } = req.body;
        if (!user?.sub) {
            return res.status(400).json({ error: 'User ID required' });
        }

        const { data: userData, error } = await supabase
            .from('users')
            .select('subscription_interval, subscription_status, reports_used_today, last_report_date')
            .eq('auth0_user_id', user.sub)
            .single();

        if (error) throw error;

        // Check if user has access (active or past_due within grace period)
        if (userData.subscription_status === 'inactive') {
            return res.status(403).json({
                error: 'Subscription inactive',
                status: userData.subscription_status
            });
        }

        // Only check limits for trial users
        if (userData.subscription_interval === 'trial') {
            if (userData.reports_used_today >= REPORT_LIMITS.trial) {
                return res.status(403).json({
                    error: 'Trial report limit reached',
                    limit: REPORT_LIMITS.trial,
                    used: userData.reports_used_today
                });
            }
        }

        req.reportData = {
            currentCount: userData.reports_used_today,
            limit: userData.subscription_interval === 'trial' ? REPORT_LIMITS.trial : Infinity
        };
        next();
    } catch (error) {
        console.error('Check report limit error:', error);
        res.status(500).json({ error: error.message });
    }
}

// Add to your existing report generation endpoint
app.post('/generate-report', checkReportLimit, async (req, res) => {
    try {
        // Your existing report generation logic here

        // After successful generation, increment the counter
        await supabase
            .from('users')
            .update({
                reports_used_today: req.reportData.currentCount + 1
            })
            .eq('auth0_user_id', req.body.user.sub);

        res.json({ /* your response */ });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint to check user's subscription status
app.get('/check-subscription/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('auth0_user_id', userId)
            .single();

        if (error) throw error;

        // Add this check for access code revocation
        if (user.access_code) {
            if (REVOKED_CODES.has(user.access_code) ||
                !ACCESS_CODES[user.access_code] ||
                new Date(ACCESS_CODES[user.access_code]?.validUntil) < new Date()) {

                // Deactivate the subscription
                await supabase
                    .from('users')
                    .update({
                        subscription_status: 'inactive',
                        subscription_end_date: new Date().toISOString()
                    })
                    .eq('auth0_user_id', userId);

                user.subscription_status = 'inactive';
            }
        }

        res.json(user);
    } catch (error) {
        console.error('Check subscription error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add near your other routes
app.get('/', (req, res) => {
    res.json({
        message: 'PetWise API is running',
        status: 'healthy',
        version: '1.0.0',
        endpoints: [
            '/check-subscription/:userId',
            '/create-checkout-session',
            '/cancel-subscription',
            '/cancel-trial',
            '/activate-trial',
            '/webhook',
            '/generate-report'
        ]
    });
});

// Add this new debug endpoint to test the reset
app.get('/test-reset/:userId', async (req, res) => {
    try {
        const now = new Date();
        const timeKey = now.toISOString().split('T')[0];

        // First check expiration
        const { data: expirationCheck } = await supabase
            .from('users')
            .select('subscription_end_date')
            .eq('auth0_user_id', req.params.userId)
            .single();

        if (expirationCheck?.subscription_end_date < now.toISOString()) {
            await supabase
                .from('users')
                .update({ subscription_status: 'inactive' })
                .eq('auth0_user_id', req.params.userId);
        }

        // Then reset reports
        const { data: updateData, error } = await supabase
            .from('users')
            .update({
                reports_used_today: 0,
                last_report_date: timeKey
            })
            .eq('auth0_user_id', req.params.userId)
            .select();

        if (error) throw error;

        console.log('Reset result:', updateData);
        res.json(updateData);
    } catch (error) {
        console.error('Test reset error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add this test endpoint
app.post('/test-expiration/:userId', async (req, res) => {
    try {
        // Set subscription to expire in 1 minute
        const expirationDate = new Date(Date.now() + 1 * 60 * 1000);

        const { data, error } = await supabase
            .from('users')
            .update({
                subscription_status: 'active',
                subscription_end_date: expirationDate.toISOString()
            })
            .eq('auth0_user_id', req.params.userId)
            .select();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this test endpoint after your other test endpoints
app.post('/test-cancellation-flow/:userId', async (req, res) => {
    try {
        const now = new Date();
        const futureDate = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes in future

        // First set up a subscription that's cancelled but not yet expired
        const { data: setupData, error: setupError } = await supabase
            .from('users')
            .update({
                subscription_status: 'active',
                cancel_at_period_end: true,
                subscription_end_date: futureDate.toISOString()
            })
            .eq('auth0_user_id', req.params.userId)
            .select();

        if (setupError) throw setupError;

        console.log('Initial setup:', setupData);

        // Wait 3 seconds then check if checkTrialExpirations catches it
        setTimeout(async () => {
            await checkTrialExpirations();

            // Get final state
            const { data: finalData } = await supabase
                .from('users')
                .select('subscription_status, subscription_end_date, cancel_at_period_end')
                .eq('auth0_user_id', req.params.userId)
                .single();

            console.log('Final state:', finalData);
        }, 3000);

        res.json({
            message: 'Test started. Check server logs.',
            initialState: setupData[0]
        });
    } catch (error) {
        console.error('Test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add this new endpoint for account deletion
app.post('/delete-account', async (req, res) => {
    try {
        const { user_id } = req.body;
        console.log('Attempting to delete user:', user_id);

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // First check if user exists in Supabase
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('auth0_user_id', user_id)
            .single();

        console.log('Found user data:', userData);

        if (userError) {
            console.error('Error finding user:', userError);
            throw userError;
        }

        // Delete templates first
        const { error: templateError } = await supabase
            .from('templates')
            .delete()
            .eq('user_id', userData.id);

        if (templateError) {
            console.error('Template deletion error:', templateError);
            throw templateError;
        }

        // Delete user data from Supabase with explicit response checking
        const { data: deleteData, error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('auth0_user_id', user_id)
            .select(); // Add .select() to get back the deleted row

        console.log('Delete response:', { deleteData, deleteError }); // Add this log

        if (deleteError) {
            console.error('Supabase delete error:', deleteError);
            throw deleteError;
        }

        if (!deleteData || deleteData.length === 0) {
            throw new Error('User deletion failed - no rows deleted');
        }

        // Only try to delete Stripe data if it exists
        if (userData?.stripe_customer_id) {
            try {
                console.log('Starting Stripe deletion for customer:', userData.stripe_customer_id);

                const subscriptions = await stripe.subscriptions.list({
                    customer: userData.stripe_customer_id,
                    limit: 1,
                });
                console.log('Found subscriptions:', subscriptions.data);

                if (subscriptions.data.length > 0) {
                    console.log('Cancelling subscription:', subscriptions.data[0].id);
                    await stripe.subscriptions.cancel(subscriptions.data[0].id);
                    console.log('Subscription cancelled successfully');
                }

                console.log('Deleting Stripe customer');
                await stripe.customers.del(userData.stripe_customer_id);
                console.log('Stripe customer deleted successfully');
            } catch (stripeError) {
                console.error('Stripe deletion error:', stripeError);
                throw stripeError; // Throw error to see full details
            }
        }

        res.json({
            success: true,
            deletedUser: deleteData[0]
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Add new endpoint to handle access code activation
app.post('/activate-access-code', async (req, res) => {
    try {
        const { user_id, accessCode } = req.body;
        console.log('Access code activation request:', { user_id, accessCode });

        // Check if user already has this code
        const { data: existingUser, error: userError } = await supabase
            .from('users')
            .select('access_code, subscription_status')
            .eq('auth0_user_id', user_id)
            .single();

        if (userError) throw userError;

        if (existingUser.access_code === accessCode) {
            return res.status(400).json({
                error: 'You have already activated this access code'
            });
        }

        // Check if code exists and isn't revoked
        if (REVOKED_CODES.has(accessCode)) {
            return res.status(400).json({ error: 'This access code has been revoked' });
        }

        const codeDetails = ACCESS_CODES[accessCode];
        if (!codeDetails) {
            return res.status(400).json({ error: 'Invalid access code' });
        }

        // Check if code is expired
        if (new Date(codeDetails.validUntil) < new Date()) {
            return res.status(400).json({ error: 'Access code has expired' });
        }

        // Optional: Check if organization has reached user limit
        if (codeDetails.maxUsers) {
            const { count, error: countError } = await supabase
                .from('users')
                .select('*', { count: 'exact' })
                .eq('access_code', accessCode);

            if (countError) throw countError;

            if (count >= codeDetails.maxUsers) {
                return res.status(400).json({
                    error: 'Organization has reached maximum user limit'
                });
            }
        }

        // Update user subscription in Supabase
        const { data, error } = await supabase
            .from('users')
            .update({
                subscription_status: 'active',
                subscription_interval: codeDetails.plan,
                subscription_end_date: codeDetails.validUntil,
                organization: codeDetails.organization,
                access_code: accessCode,
                reports_used_today: 0,
                last_report_date: new Date().toISOString().split('T')[0],
                stripe_customer_id: null,  // Clear any existing Stripe connection
                cancel_at_period_end: false
            })
            .eq('auth0_user_id', user_id)
            .select();

        if (error) throw error;

        console.log('Access code activation successful:', data);
        res.json({
            success: true,
            organization: codeDetails.organization,
            validUntil: codeDetails.validUntil,
            plan: codeDetails.plan
        });

    } catch (error) {
        console.error('Access code activation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add endpoint to revoke access code
app.post('/revoke-access-code', async (req, res) => {
    try {
        const { code } = req.body;

        // Add to revoked set
        REVOKED_CODES.add(code);

        // Update all users with this code
        const { error } = await supabase
            .from('users')
            .update({
                subscription_status: 'inactive',
                subscription_end_date: new Date().toISOString()
            })
            .eq('access_code', code);

        if (error) throw error;

        res.json({ success: true, message: `Access code ${code} has been revoked` });
    } catch (error) {
        console.error('Revoke access code error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add to your periodic checks
async function checkAccessCodeValidity() {
    try {
        const now = new Date().toISOString();

        // Get all users with access codes
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .not('access_code', 'is', null)
            .eq('subscription_status', 'active');

        if (error) throw error;

        for (const user of users) {
            const codeDetails = ACCESS_CODES[user.access_code];

            // Deactivate if code is revoked, invalid, or expired
            if (REVOKED_CODES.has(user.access_code) ||
                !codeDetails ||
                new Date(codeDetails.validUntil) < new Date()) {

                await supabase
                    .from('users')
                    .update({
                        subscription_status: 'inactive',
                        subscription_end_date: now
                    })
                    .eq('auth0_user_id', user.auth0_user_id);

                console.log(`Deactivated access for user ${user.auth0_user_id} with code ${user.access_code}`);
            }
        }
    } catch (error) {
        console.error('Error checking access code validity:', error);
    }
}

// Add to your server startup
setInterval(checkAccessCodeValidity, 24 * 60 * 60 * 1000); // Check daily

// ================ SERVER STARTUP ================
// Export for Vercel serverless functions
module.exports = app;

// Only start listening if not in Vercel environment
if (process.env.VERCEL !== '1') {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log('Available endpoints:');
        app._router.stack.forEach(r => {
            if (r.route && r.route.path) {
                console.log(`${Object.keys(r.route.methods)} ${r.route.path}`);
            }
        });
    });
}

// Add a manual reset endpoint for testing
app.post('/manual-reset', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .update({
                reports_used_today: 0,
                last_report_date: new Date().toISOString().split('T')[0]
            })
            .not('subscription_status', 'eq', 'inactive');

        if (error) throw error;
        res.json({ message: 'Manual reset successful', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this new admin metrics endpoint
app.get('/admin-metrics', async (req, res) => {
    try {
        // Verify admin access - should match process.env.REACT_APP_ADMIN_USER_ID
        const { user_id } = req.query;

        if (!user_id || user_id !== process.env.REACT_APP_ADMIN_USER_ID) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }

        // Get users
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('*');

        if (userError) throw userError;

        // Get reports
        const { data: reports, error: reportError } = await supabase
            .from('reports')
            .select('*');

        if (reportError) throw reportError;

        // Calculate metrics
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        // User metrics
        const totalUsers = users.length;
        const activeUsers = users.filter(u => u.subscription_status === 'active').length;
        const trialUsers = users.filter(u => u.subscription_interval === 'trial').length;

        // Time-based metrics
        const newUsersThisMonth = users.filter(
            u => new Date(u.created_at) >= firstDayOfMonth
        ).length;

        const newUsersLastMonth = users.filter(
            u => new Date(u.created_at) >= firstDayOfLastMonth &&
                new Date(u.created_at) < firstDayOfMonth
        ).length;

        // Subscription metrics
        const subscriptionsByType = {
            monthly: users.filter(u =>
                u.subscription_status === 'active' &&
                u.subscription_interval === 'monthly'
            ).length,
            yearly: users.filter(u =>
                u.subscription_status === 'active' &&
                u.subscription_interval === 'yearly'
            ).length,
            trial: trialUsers,
            inactive: users.filter(u => u.subscription_status === 'inactive').length,
            canceling: users.filter(u => u.cancel_at_period_end === true).length
        };

        // Report metrics
        const totalReports = reports.length;
        const reportsThisMonth = reports.filter(
            r => new Date(r.created_at) >= firstDayOfMonth
        ).length;

        // Quick query metrics (sum from user counts)
        const totalQuickQueries = users.reduce(
            (sum, user) => sum + (user.quick_query_count || 0),
            0
        );

        // Metrics by month
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            return {
                month: date.toLocaleString('default', { month: 'short' }),
                year: date.getFullYear()
            };
        });

        const monthlyMetrics = last6Months.map(({ month, year }) => {
            const startOfMonth = new Date(year, new Date().getMonth() - last6Months.findIndex(m => m.month === month), 1);
            const endOfMonth = new Date(year, new Date().getMonth() - last6Months.findIndex(m => m.month === month) + 1, 0);

            return {
                month,
                year,
                newUsers: users.filter(u =>
                    new Date(u.created_at) >= startOfMonth &&
                    new Date(u.created_at) <= endOfMonth
                ).length,
                newReports: reports.filter(r =>
                    new Date(r.created_at) >= startOfMonth &&
                    new Date(r.created_at) <= endOfMonth
                ).length
            };
        });

        res.json({
            totalUsers,
            activeUsers,
            trialUsers,
            newUsersThisMonth,
            newUsersLastMonth,
            growthRate: newUsersLastMonth > 0
                ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100
                : 0,
            subscriptionsByType,
            totalReports,
            reportsThisMonth,
            totalQuickQueries,
            monthlyMetrics,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Admin metrics error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ================ CUSTOMER PORTAL ENDPOINT ================
// Creates a Stripe customer portal session for billing management
app.post('/create-customer-portal', async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // Get user's stripe customer id
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('stripe_customer_id')
            .eq('auth0_user_id', user_id)
            .single();

        if (userError || !userData?.stripe_customer_id) {
            return res.status(404).json({ error: 'No billing account found' });
        }

        // Create customer portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: userData.stripe_customer_id,
            return_url: process.env.NODE_ENV === 'production'
                ? 'https://app.petwise.vet/profile'
                : 'http://localhost:3000/profile',
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Customer portal error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add this test endpoint after your other test endpoints
app.post('/test-payment-failure/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('Testing payment failure for user:', userId);

        // Find user data
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('stripe_customer_id')
            .eq('auth0_user_id', userId)
            .single();

        if (userError || !userData?.stripe_customer_id) {
            return res.status(404).json({ error: 'No subscription found for user' });
        }

        // Simulate grace period end (7 days from now - Stripe's typical retry period)
        const gracePeriodEnd = new Date();
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

        // Update user to past_due status
        const { data: updateData, error: updateError } = await supabase
            .from('users')
            .update({
                subscription_status: 'past_due',
                grace_period_end: gracePeriodEnd.toISOString()
            })
            .eq('auth0_user_id', userId)
            .select();

        if (updateError) throw updateError;

        console.log('Payment failure test completed:', updateData[0]);
        res.json({
            success: true,
            message: 'User set to past_due status',
            gracePeriodEnd: gracePeriodEnd.toISOString(),
            userData: updateData[0]
        });
    } catch (error) {
        console.error('Test payment failure error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add test endpoint to reset user back to active
app.post('/test-payment-success/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('Testing payment success for user:', userId);

        // Find user data
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('stripe_customer_id, subscription_interval')
            .eq('auth0_user_id', userId)
            .single();

        if (userError || !userData?.stripe_customer_id) {
            return res.status(404).json({ error: 'No subscription found for user' });
        }

        // Reset to active status and clear grace period
        const { data: updateData, error: updateError } = await supabase
            .from('users')
            .update({
                subscription_status: 'active',
                grace_period_end: null,
                cancel_at_period_end: false
            })
            .eq('auth0_user_id', userId)
            .select();

        if (updateError) throw updateError;

        console.log('Payment success test completed:', updateData[0]);
        res.json({
            success: true,
            message: 'User restored to active status',
            userData: updateData[0]
        });
    } catch (error) {
        console.error('Test payment success error:', error);
        res.status(500).json({ error: error.message });
    }
});

