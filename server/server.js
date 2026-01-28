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
const emailRouter = require('./routes/emailRoutes');
const cronRouter = require('./routes/cronRoutes');
const { sendTrialActivatedEmail, sendSubscriptionConfirmedEmail } = require('./utils/emailService');
// REMOVED: quicksoapTranscribe - using client-side chunking with /api/whisper-proxy instead
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

// Memory storage for whisper-proxy (direct buffer access)
const uploadMemory = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit (OpenAI Whisper max)
    }
});

// Disk storage for other endpoints (deprecated transcription endpoint)
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
app.use('/email', emailRouter);
app.use('/cron', cronRouter);

// Make supabase available to routes via app.locals
app.locals.supabase = supabase;

// REMOVED: /api/quicksoap route - using client-side chunking with /api/whisper-proxy instead

// ================ CONSTANTS ================
const PRICE_IDS = {
    monthly_usd: process.env.NODE_ENV === 'production'
        ? 'price_1SqkmIFpF2XskoMKmFkWtTn1'  // Live monthly USD - $79/mo
        : 'price_1QcwX5FpF2XskoMKrTsq1kHc',  // Test monthly USD (old test price - update if needed)
    yearly_usd: process.env.NODE_ENV === 'production'
        ? 'price_1SqkpJFpF2XskoMKoJN7r7ia'   // Live yearly USD - $828/yr
        : 'price_1QcwYWFpF2XskoMKH9MJisoy',   // Test yearly USD (old test price - update if needed)
    monthly_cad: process.env.NODE_ENV === 'production'
        ? 'price_1SqkriFpF2XskoMK9fpoWAHy'    // Live monthly CAD - $109/mo
        : 'price_1QvoD2FpF2XskoMKsTtPM7mg',   // Test monthly CAD (old test price - update if needed)
    yearly_cad: process.env.NODE_ENV === 'production'
        ? 'price_1SqkvbFpF2XskoMK4qShTokL'    // Live yearly CAD - $1152/yr
        : 'price_1QvoCfFpF2XskoMKfLelrbhT',   // Test yearly CAD (old test price - update if needed)
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
    'PW2M2025': {
        organization: 'Petwise',
        validUntil: '2026-02-01',
        plan: 'yearly',
        maxUsers: 10 // Optional: limit users per code
    }
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

// ================ DEPRECATED ENDPOINT ================
// DEPRECATED — Old Whisper pipeline (no longer used with client-side chunking)
// This endpoint is kept for reference but is not called by the new QuickSOAP flow.
// New flow: Client chunks audio → /api/whisper-proxy → Client merges → /api/generate-soap
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

        // Segmentation thresholds
        // Segment if audio is longer than 20 minutes (file size threshold unlikely to trigger with compressed MP3)
        const SEGMENTATION_THRESHOLD_MB = 20;
        const SEGMENTATION_THRESHOLD_MINUTES = 20;
        const needsSegmentation = fileSizeMB > SEGMENTATION_THRESHOLD_MB || durationMinutes > SEGMENTATION_THRESHOLD_MINUTES;

        console.log(`[Transcribe] Audio: ${fileSizeMB.toFixed(2)}MB, ${durationMinutes.toFixed(2)} minutes - Segmentation ${needsSegmentation ? 'NEEDED' : 'NOT NEEDED'}`);

        let combinedTranscript = '';
        const basePrompt = `This is a veterinary medical dictation. Extract ONLY clinically relevant content.

CRITICAL: MAXIMUM ACCURACY FOR VETERINARY MEDICAL TERMINOLOGY REQUIRED.

You must transcribe veterinary medical language with EXTREME PRECISION. Pay special attention to:
- Long, complex scientific terms (e.g., pancreatitis, pyometra, hemangiosarcoma, lymphosarcoma, cholangiohepatitis, polycythemia, thrombocytopenia)
- Medication names (e.g., enrofloxacin, metronidazole, prednisolone, cephalexin, amoxicillin-clavulanate, furosemide, atenolol, gabapentin, tramadol, buprenorphine, maropitant, ondansetron)
- Diagnostic terms (e.g., echocardiogram, electrocardiogram, radiographs, ultrasonography, cytology, histopathology, biochemistry, hematology)
- Anatomical terms (e.g., gastrointestinal, cardiovascular, respiratory, musculoskeletal, integumentary, neurological, urogenital)
- Disease names (e.g., diabetes mellitus, hyperadrenocorticism, hypothyroidism, chronic kidney disease, inflammatory bowel disease, atopic dermatitis, otitis externa, otitis media, otitis interna)
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
            console.log(`[Transcribe] Chunk 1/${chunkFiles.length}: ${firstChunkTranscript.length} chars`);
            console.log(`[Transcribe] Chunk 1 preview: ${firstChunkTranscript.substring(0, 100)}...`);
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

                // Combine transcripts in order with logging
                remainingTranscripts.forEach((transcript, idx) => {
                    const chunkNum = idx + 2;
                    console.log(`[Transcribe] Chunk ${chunkNum}/${chunkFiles.length}: ${transcript.length} chars`);
                    console.log(`[Transcribe] Chunk ${chunkNum} preview: ${transcript.substring(0, 100)}...`);
                    if (transcript && transcript.trim().length > 0) {
                        combinedTranscript += ' ' + transcript.trim();
                    } else {
                        console.warn(`[Transcribe] Chunk ${chunkNum} was empty or whitespace only`);
                    }
                });
            }

            console.log(`[Transcribe] Combined transcript length: ${combinedTranscript.length} chars`);
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
        console.log(`[Transcribe] Clean transcript length: ${cleanTranscription.length} chars`);
        console.log(`[Transcribe] Clean transcript preview: ${cleanTranscription.substring(0, 200)}...`);
        console.log(`[Transcribe] Clean transcript end: ...${cleanTranscription.substring(Math.max(0, cleanTranscription.length - 200))}`);
        try {
            const cleanupStart = Date.now();
            cleanedTranscript = await runMedicalCleanup(cleanTranscription);
            const cleanupTime = Date.now() - cleanupStart;
            console.log(`[Transcribe] GPT cleanup completed in ${cleanupTime}ms`);
            console.log(`[Transcribe] GPT cleaned length: ${cleanedTranscript.length} chars (was ${cleanTranscription.length})`);
            console.log(`[Transcribe] GPT cleaned preview: ${cleanedTranscript.substring(0, 200)}...`);
            console.log(`[Transcribe] GPT cleaned end: ...${cleanedTranscript.substring(Math.max(0, cleanedTranscript.length - 200))}`);
            if (cleanedTranscript.length < cleanTranscription.length * 0.8) {
                console.warn(`[Transcribe] WARNING: GPT cleanup reduced transcript by ${cleanTranscription.length - cleanedTranscript.length} chars - possible truncation!`);
            }
        } catch (cleanupErr) {
            console.error('[Transcribe] Medical cleanup failed, using cleaned transcript:', cleanupErr.message);
            cleanedTranscript = cleanTranscription; // Fallback to cleaned transcript
        }

        // Phase 6: Apply veterinary terminology correction
        // DISABLED: VetCorrector was causing false positives (e.g. "leukemia" -> "uremia")
        // GPT-4o-mini cleanup handles medical terminology well enough on its own
        // const correctorStart = Date.now();
        // const corrected = correctTranscript(cleanedTranscript);
        // const correctorTime = Date.now() - correctorStart;
        // console.log(`[Transcribe] VetCorrector completed in ${correctorTime}ms`);
        const corrected = cleanedTranscript; // Skip VetCorrector, use GPT-cleaned transcript directly

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

// ================ NEW CLIENT-SIDE CHUNKING ENDPOINTS ================

// Transcription model configuration
// Options: 'whisper-1', 'gpt-4o-mini-transcribe', 'gpt-4o-mini-transcribe-2025-12-15', 'gpt-4o-mini-transcribe-2025-03-20'
const TRANSCRIPTION_MODEL = process.env.TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';
const IS_GPT4O_TRANSCRIBE = TRANSCRIPTION_MODEL.startsWith('gpt-4o');

console.log(`[Transcription] Using model: ${TRANSCRIPTION_MODEL} (isGPT4o: ${IS_GPT4O_TRANSCRIBE})`);

// Transcription proxy endpoint for client-side chunked transcription
// Accepts audio chunks from frontend and forwards to OpenAI Transcription API
app.post('/api/whisper-proxy', uploadMemory.single('audio'), async (req, res) => {
    const startTime = Date.now();

    try {
        console.log('[Transcribe] ========== NEW CHUNK REQUEST ==========');
        console.log(`[Transcribe] Model: ${TRANSCRIPTION_MODEL}`);
        console.log(`[Transcribe] Timestamp: ${new Date().toISOString()}`);

        if (!req.file) {
            console.error('[Transcribe] No audio file provided');
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const buffer = req.file.buffer; // multer memory storage gives us buffer directly

        // Validate buffer isn't empty
        if (!buffer || buffer.length === 0) {
            console.error('[Transcribe] Buffer is empty');
            return res.status(400).json({
                error: 'Invalid audio received',
                detail: 'Chunk likely empty or corrupted'
            });
        }

        const fileSizeMB = buffer.length / (1024 * 1024);
        const fileSizeKB = buffer.length / 1024;
        const mimeType = req.file.mimetype || 'audio/webm';
        console.log(`[Transcribe] Input: ${fileSizeMB.toFixed(2)}MB (${fileSizeKB.toFixed(2)}KB), type: ${mimeType}`);

        // Validate file size (should be at least 1KB - valid WebM chunks are always larger)
        const MIN_CHUNK_SIZE = 1024; // 1KB minimum
        if (buffer.length < MIN_CHUNK_SIZE) {
            console.warn(`[Transcribe] Chunk too small (${buffer.length} bytes), likely empty or corrupted`);
            return res.status(400).json({
                error: 'Invalid audio received',
                detail: 'Chunk likely empty or corrupted (too small)'
            });
        }

        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }

        // Get optional context from previous chunk for continuity
        const previousContext = req.body.previousContext || '';
        const isContinuation = previousContext.length > 0;
        console.log(`[Transcribe] Continuation: ${isContinuation ? 'YES' : 'NO'} (${previousContext.length} chars)`);

        // Determine file extension based on mimetype (default to WebM)
        let fileExtension = 'webm';
        if (mimeType.includes('wav')) {
            fileExtension = 'wav';
        } else if (mimeType.includes('mp3')) {
            fileExtension = 'mp3';
        }

        // Create FormData and append buffer directly
        const form = new FormData();
        form.append('file', buffer, `chunk.${fileExtension}`);
        form.append('model', TRANSCRIPTION_MODEL);
        form.append('response_format', 'text');
        form.append('language', 'en');  // Force English to prevent hallucinations

        // GPT-4o transcribe models don't support prompt/temperature the same way as whisper-1
        // Only add these for whisper-1
        if (!IS_GPT4O_TRANSCRIBE) {
            // Whisper prompt should be example text, NOT instructions
            // This helps Whisper recognize veterinary terminology and maintain style
            const basePrompt = `Veterinary medical dictation. Patient is a 5 year old male neutered Labrador Retriever presenting for vomiting and diarrhea. Physical exam: temperature 102.5, heart rate 120, respiratory rate 24. Abdomen is tense on palpation. Recommend CBC, chemistry panel, abdominal radiographs. Differential diagnoses include pancreatitis, gastroenteritis, foreign body obstruction. Started on maropitant 1 mg/kg SQ, metronidazole 15 mg/kg PO BID, and IV fluids with lactated Ringer's solution. Also treating for otitis externa with otic drops, suspect otitis media involvement.`;

            // Add continuation context if provided (helps with sentence continuity)
            let prompt = basePrompt;
            if (isContinuation && previousContext.trim()) {
                // Prepend previous context so Whisper continues naturally
                prompt = `${previousContext.trim()} ${basePrompt}`;
            }

            // Build boosted prompt with lexicon
            const boostedPrompt = buildBoostedPrompt(prompt);
            form.append('prompt', boostedPrompt);
            form.append('temperature', '0'); // Deterministic output
            console.log(`[Transcribe] Using Whisper-1 with prompt (${boostedPrompt.length} chars) and temperature=0`);
        } else {
            console.log(`[Transcribe] Using GPT-4o transcribe (no prompt/temperature params)`);
        }

        // Forward to OpenAI Transcription API with timeout
        const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 120000); // 2 minutes for chunks

        console.log(`[Transcribe] Sending to OpenAI (timeout: ${OPENAI_TIMEOUT_MS}ms)...`);
        const apiStartTime = Date.now();

        const transcribeRes = await axios.post(
            'https://api.openai.com/v1/audio/transcriptions',
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
                },
                timeout: OPENAI_TIMEOUT_MS
            }
        );

        const apiTime = Date.now() - apiStartTime;
        // With response_format: 'text', transcribeRes.data is the raw transcript string
        // (not a JSON object with a .text property)
        const transcript = typeof transcribeRes.data === 'string'
            ? transcribeRes.data
            : (transcribeRes.data?.text || '');

        const totalTime = Date.now() - startTime;

        // DEV LOGGING: Detailed output for testing/comparison
        console.log(`[Transcribe] ========== RESPONSE ==========`);
        console.log(`[Transcribe] Model: ${TRANSCRIPTION_MODEL}`);
        console.log(`[Transcribe] API latency: ${apiTime}ms`);
        console.log(`[Transcribe] Total time: ${totalTime}ms`);
        console.log(`[Transcribe] Input size: ${fileSizeKB.toFixed(2)}KB`);
        console.log(`[Transcribe] Output length: ${transcript.length} chars`);
        console.log(`[Transcribe] Chars/sec: ${(transcript.length / (apiTime / 1000)).toFixed(1)}`);
        console.log(`[Transcribe] Preview (first 200 chars):`);
        console.log(`[Transcribe] >>> ${transcript.substring(0, 200)}`);
        if (transcript.length > 200) {
            console.log(`[Transcribe] Preview (last 100 chars):`);
            console.log(`[Transcribe] >>> ...${transcript.substring(transcript.length - 100)}`);
        }
        console.log(`[Transcribe] ================================`);

        res.json({ text: transcript, model: TRANSCRIPTION_MODEL, latencyMs: apiTime });
    } catch (err) {
        console.error('[Transcribe] ========== ERROR ==========');
        console.error(`[Transcribe] Model: ${TRANSCRIPTION_MODEL}`);
        console.error('[Transcribe] Error:', err.message);

        // Handle axios errors
        if (err.response) {
            const errorText = err.response.data?.error?.message || JSON.stringify(err.response.data) || err.message;
            const errorStatus = err.response.status;
            console.error(`[Transcribe] OpenAI API Error ${errorStatus}:`, errorText);

            // Check if it's a format error
            if (errorStatus === 400 && typeof errorText === 'string' && errorText.includes('Invalid file format')) {
                return res.status(400).json({
                    error: 'Invalid audio received',
                    detail: 'Chunk likely empty or corrupted (format error from API)'
                });
            }

            return res.status(errorStatus === 429 ? 429 : 502).json({
                error: 'Transcription failed',
                detail: typeof errorText === 'string' ? errorText.slice(0, 500) : errorText
            });
        }

        // Handle timeout errors
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            console.error('[Transcribe] API timeout');
            return res.status(504).json({ error: 'Transcription timeout (chunk took too long)' });
        }

        res.status(500).json({ error: 'Transcription proxy error', detail: err.message });
    }
});

// Cleanup-only endpoint (no SOAP generation)
// Accepts transcript text, runs cleanup + VetCorrector only
app.post('/api/cleanup-transcript', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');
    const startTime = Date.now();

    try {
        const { transcript } = req.body;

        console.log('[CleanupTranscript] Received transcript for cleanup');
        console.log(`[CleanupTranscript] Transcript length: ${transcript?.length || 0} chars`);

        if (!transcript || !transcript.trim()) {
            console.error('[CleanupTranscript] No transcript provided');
            return res.status(400).json({ error: 'Transcript text is required' });
        }

        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY environment variable is not set');
            return res.status(500).json({ error: 'Server configuration error: OpenAI API key not set' });
        }

        // Phase 1: GPT medical cleanup
        console.log(`[CleanupTranscript] Phase 1: Starting GPT medical cleanup (input: ${transcript.length} chars)`);
        let cleanedTranscript = transcript;
        const cleanupStartTime = Date.now();
        try {
            cleanedTranscript = await runMedicalCleanup(transcript);
            const cleanupTime = Date.now() - cleanupStartTime;
            console.log(`[CleanupTranscript] Phase 1 complete: GPT cleanup in ${cleanupTime}ms (${transcript.length} -> ${cleanedTranscript.length} chars)`);
        } catch (cleanupErr) {
            const cleanupTime = Date.now() - cleanupStartTime;
            console.error(`[CleanupTranscript] Phase 1 failed after ${cleanupTime}ms, using original transcript:`, cleanupErr.message);
            cleanedTranscript = transcript; // Fallback to original
        }

        // Phase 2: VetCorrector
        // DISABLED: VetCorrector was causing false positives (e.g. "leukemia" -> "uremia")
        // GPT-4o-mini cleanup handles medical terminology well enough on its own
        // const correctorStart = Date.now();
        // const correctedTranscript = correctTranscript(cleanedTranscript);
        // const correctorTime = Date.now() - correctorStart;
        // console.log(`[CleanupTranscript] Phase 2 complete: VetCorrector in ${correctorTime}ms (${cleanedTranscript.length} -> ${correctedTranscript.length} chars)`);
        const correctedTranscript = cleanedTranscript; // Skip VetCorrector, use GPT-cleaned transcript directly
        console.log(`[CleanupTranscript] Phase 2: VetCorrector SKIPPED (disabled)`);

        // Phase 3: Generate summary (1-2 sentences)
        console.log(`[CleanupTranscript] Phase 3: Generating summary`);
        let summary = '';
        const summaryStartTime = Date.now();
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
                            content: `Summarize this veterinary dictation in 1-2 short sentences focusing on the main complaint or finding. Include exact drug names, diagnoses, and medical terms as stated:\n\n"${correctedTranscript}"`
                        }
                    ],
                    max_tokens: 150,
                    temperature: 0.3
                })
            });

            if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                summary = summaryData.choices?.[0]?.message?.content?.trim() || '';
                const summaryTime = Date.now() - summaryStartTime;
                console.log(`[CleanupTranscript] Phase 3 complete: Summary generated in ${summaryTime}ms (${summary.length} chars)`);
            }
        } catch (err) {
            console.error('[CleanupTranscript] Summary generation error:', err);
            // Fallback to first 100 chars if summary generation fails
            summary = correctedTranscript.length > 100
                ? correctedTranscript.substring(0, 100) + '...'
                : correctedTranscript;
        }

        const totalTime = Date.now() - startTime;
        console.log(`[CleanupTranscript] Cleanup complete in ${totalTime}ms total`);

        // Return cleaned and corrected transcript with summary (no SOAP)
        res.status(200).json({
            correctedTranscript,
            summary: summary || correctedTranscript.substring(0, 100) + (correctedTranscript.length > 100 ? '...' : '')
        });
    } catch (err) {
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            console.error('[CleanupTranscript] OpenAI request timeout');
            return res.status(504).json({ error: 'Upstream timeout (OpenAI took too long)' });
        }

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
            console.error('[CleanupTranscript] Network error connecting to OpenAI:', {
                code: err?.code,
                message: err?.message
            });
            return res.status(503).json({
                error: 'Network error',
                detail: 'Connection to OpenAI failed. Please try again.'
            });
        }

        console.error('[CleanupTranscript] Cleanup endpoint error:', err);
        console.error('Error stack:', err.stack);
        return res.status(500).json({
            error: 'Internal server error',
            detail: err.message
        });
    }
});


// ================ END NEW CLIENT-SIDE CHUNKING ENDPOINTS ================

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
- Disease names (e.g., diabetes mellitus, hyperadrenocorticism, hypothyroidism, chronic kidney disease, inflammatory bowel disease, atopic dermatitis, otitis externa, otitis media, otitis interna)
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
            cleaned: cleaned,
            originalLength: text.length,
            cleanedLength: cleaned.length
        });
    } catch (err) {
        console.error('Test cleanup error:', err);
        res.status(500).json({ error: 'Cleanup failed', detail: err.message });
    }
});

// Test endpoint for long transcript simulation
app.post('/api/testLongTranscript', async (req, res) => {
    try {
        const { durationMinutes = 2 } = req.body;

        // Simulate a long transcript (roughly 100 words per minute)
        const wordsPerMinute = 100;
        const wordCount = durationMinutes * wordsPerMinute;

        // Generate a realistic veterinary dictation with drug names and medical terms
        const samplePhrases = [
            "We have a patient here presenting with acute vomiting and diarrhea.",
            "The owner reports that the dog has been lethargic for the past 24 hours.",
            "On physical examination, we noted mild dehydration and decreased skin turgor.",
            "We're going to start the patient on rimadyl at 2 milligrams per kilogram twice daily.",
            "Also prescribing gabapentin for pain management at 10 milligrams per kilogram.",
            "The patient will need to be monitored closely for any adverse reactions.",
            "We recommend rechecking in 7 to 10 days to assess response to treatment.",
            "Blood work shows elevated liver enzymes and mild azotemia.",
            "We're starting with cerenia for nausea at 1 milligram per kilogram subcutaneously.",
            "The patient is also on metronidazole for gastrointestinal issues."
        ];

        let testTranscript = "";
        for (let i = 0; i < wordCount / 20; i++) {
            testTranscript += samplePhrases[i % samplePhrases.length] + " ";
        }

        testTranscript = testTranscript.trim();

        console.log(`Testing long transcript: ${testTranscript.length} chars, ~${wordCount} words`);

        // Test the full pipeline
        const startTime = Date.now();
        const cleaned = await runMedicalCleanup(testTranscript);
        const corrected = correctTranscript(cleaned);
        const endTime = Date.now();

        res.json({
            durationMinutes,
            originalLength: testTranscript.length,
            cleanedLength: cleaned.length,
            correctedLength: corrected.length,
            processingTimeMs: endTime - startTime,
            sample: {
                original: testTranscript.substring(0, 200) + "...",
                cleaned: cleaned.substring(0, 200) + "...",
                corrected: corrected.substring(0, 200) + "..."
            }
        });
    } catch (err) {
        console.error('Test long transcript error:', err);
        res.status(500).json({ error: 'Test failed', detail: err.message });
    }
});

// SOAP generation endpoint using gpt-4o-mini
app.post('/api/generate-soap', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');

    try {
        const { input, user, recordType = 'soap' } = req.body;

        console.log('[SOAP] Received request, input length:', input?.length || 0, 'recordType:', recordType);

        if (!input || !input.trim()) {
            console.log('[SOAP] Rejected - empty input');
            return res.status(400).json({ error: 'Input text is required. Please add dictation or additional notes.' });
        }

        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY environment variable is not set');
            return res.status(500).json({ error: 'Server configuration error: OpenAI API key not set' });
        }

        // Dynamic import for ESM module
        const { Agent, Runner } = await import('@openai/agents');
        const runner = new Runner();

        // Handle Summary and Callback record types with simpler single-agent approach
        if (recordType === 'summary' || recordType === 'callback') {
            const summaryAgent = new Agent({
                name: "Clinical Summary Generator",
                instructions: `You are a senior veterinary clinician creating a professional clinical summary report. Write as if documenting for medical records that will be reviewed by other veterinary professionals.

CRITICAL RULES:
1. You MUST process ANY input provided, even if brief. NEVER refuse or ask for more information.
2. ONLY include information that was explicitly stated. You may rephrase professionally but NEVER invent details.
3. If information wasn't mentioned, simply don't include that section.
4. Do NOT use markdown formatting like ** or ## - use plain text only.

STYLE GUIDELINES:
- Write in formal clinical language appropriate for veterinary medical records
- Use proper medical terminology (e.g., "acute onset emesis" rather than "vomiting")
- Use standard veterinary abbreviations where appropriate (SID, BID, TID, PO, SQ, IV, IM, etc.)
- Structure the report with clear sections and numbered points where appropriate
- Be thorough but concise - include all clinically relevant details mentioned

OUTPUT FORMAT (adapt sections dynamically based on content provided):

Clinical Summary Report
Date: [Current date]
Patient: [Pet name if mentioned]

[Opening paragraph summarizing the case/encounter]

[Use numbered sections for key findings, organized logically. Examples:]

1. [Topic/Finding]:
[Details with clinical terminology]

2. [Topic/Finding]:
[Details with clinical terminology]

[Continue with as many numbered sections as needed based on content]

[If treatments/medications mentioned:]
Treatment Protocol:
- [Medication/treatment with all details provided - dose, route, frequency if mentioned]

[If recommendations or follow-up mentioned:]
Recommendations:
[Clinical recommendations and follow-up instructions]

[If appropriate, end with:]
This report serves as documentation of [brief description of what this documents].

End of Report.

At the very end, on a new line, add exactly:
PET_NAME: [write the actual pet name here, or write the word "none" if no pet name was mentioned - nothing else]`,
                model: "gpt-4o-mini"
            });

            const callbackAgent = new Agent({
                name: "Callback Notes Generator",
                instructions: `You are a veterinary professional documenting a client communication for medical records. Create a formal, structured report suitable for the patient's medical file.

CRITICAL RULES:
1. You MUST process ANY input provided, even if brief. NEVER refuse or ask for more information.
2. ONLY include information that was explicitly stated. You may rephrase professionally but NEVER invent details.
3. If information wasn't mentioned, simply don't include that section.
4. Do NOT use markdown formatting like ** or ## - use plain text only.

STYLE GUIDELINES:
- Write formally as if this will be reviewed by other veterinary professionals
- Use proper medical terminology where appropriate
- Structure with clear sections and numbered points for key information
- Be thorough in documenting what was discussed and any recommendations given

OUTPUT FORMAT (adapt sections dynamically based on content provided):

Client Communication Report
Date: [Current date]
Patient: [Pet name if mentioned]

Summary of Call
[Opening paragraph describing who contacted whom and the general purpose]

[Use numbered sections for key discussion points. Examples:]

1. [Topic Discussed]:
[Details of what was communicated, using clinical language where appropriate]

2. [Topic Discussed]:
[Details including any test results, findings, or clinical information shared]

[Continue with as many numbered sections as needed]

[If instructions were given:]
Instructions Provided:
[Numbered or bulleted list of specific instructions given to the client]

[If follow-up or next steps mentioned:]
Next Steps:
[What was agreed upon - appointments, actions, timeline]

[If clinical recommendations were made:]
Recommendation:
[Professional recommendations based on the discussion]

This report serves as documentation of communication and recommended actions regarding [patient name if known]'s care.

End of Report.

At the very end, on a new line, add exactly:
PET_NAME: [write the actual pet name here, or write the word "none" if no pet name was mentioned - nothing else]`,
                model: "gpt-4o-mini"
            });

            const agent = recordType === 'summary' ? summaryAgent : callbackAgent;
            console.log(`[${recordType.toUpperCase()}] Running ${recordType} generator...`);

            const result = await runner.run(agent, input.trim());

            if (!result.finalOutput) {
                throw new Error(`${recordType} generation failed - no output`);
            }

            console.log(`[${recordType.toUpperCase()}] Generation complete`);

            let report = result.finalOutput;
            let petName = null;

            // Extract pet name if present
            const petNameMatch = report.match(/PET_NAME:\s*(.+?)(?:\n|$)/i);
            if (petNameMatch && petNameMatch[1]) {
                let extractedName = petNameMatch[1].trim();
                extractedName = extractedName.replace(/\*\*/g, '').replace(/\*/g, '').trim();
                // Only set petName if it's an actual name (not placeholder text)
                const lowerName = extractedName.toLowerCase();
                if (lowerName !== 'no name provided' && lowerName !== 'none' && !lowerName.includes('[') && !lowerName.includes(']')) {
                    petName = extractedName;
                }
                report = report.replace(/PET_NAME:\s*.+?(?:\n|$)/i, '').trim();
            }

            // Increment usage counter
            if (user?.sub) {
                try {
                    const { data: userData, error: fetchError } = await supabase
                        .from('users')
                        .select('quicksoap_count')
                        .eq('auth0_user_id', user.sub)
                        .single();

                    if (!fetchError && userData) {
                        const newCount = (userData.quicksoap_count || 0) + 1;
                        await supabase
                            .from('users')
                            .update({ quicksoap_count: newCount })
                            .eq('auth0_user_id', user.sub);
                    }
                } catch (updateError) {
                    console.error(`[${recordType.toUpperCase()}] Failed to increment count:`, updateError);
                }
            }

            return res.status(200).json({ report, petName, recordType });
        }

        // SOAP record type - use two-agent extraction + formatting approach
        // Agent 1: Extract information from transcript
        const transcriptionExtractor = new Agent({
            name: "Transcription Extractor",
            instructions: `Extract all of the important information from this veterinary input so it can be formatted into a SOAP later.

        CRITICAL: You MUST process ANY input provided, even if it's just a few words or a short note. NEVER refuse to process input or ask for more information. Work with whatever is given.
        
        Your job:
        - Carefully capture every clinically relevant detail from the input (whether it's a full transcript, short notes, or just keywords).
        - Organize information under the headings below.
        - Do NOT interpret, diagnose, summarize, or add recommendations.
        - Do NOT upgrade or strengthen what was said (no extra certainty).
        - If the input is brief (e.g., "pancreatitis patient"), still extract it and categorize it appropriately.
        
        Use exactly these headings:
        - PATIENT_IDENTIFICATION
        - OWNER_COMMENTS
        - VET_COMMENTS_AND_EXAM
        - MEDICATIONS_AND_TREATMENTS
        - DIAGNOSTIC_TESTS_AND_RESULTS
        - DIAGNOSTIC_IMPRESSIONS_AND_DIAGNOSES
        - RECOMMENDATIONS_AND_PLAN
        - OTHER_NOTES
        
        PATIENT_IDENTIFICATION RULES (CRITICAL - DO THIS FIRST):
        - This section MUST always be included, even if some info is missing
        - Extract and list: Pet Name, Species, Breed, Age, Sex/Neuter status, Weight
        - The pet's name is often said early in the recording (e.g., "This is Bella", "Fluffy is here for...", "Max came in because...")
        - Listen for possessive forms too (e.g., "Bella's owner reports..." means the pet is named Bella)
        - If a name is mentioned ANYWHERE in the transcript, capture it here
        - Format as:
          - Pet Name: [name or "not mentioned"]
          - Species: [species or "not mentioned"]
          - Breed: [breed or "not mentioned"]
          - Age: [age or "not mentioned"]
          - Sex: [sex/neuter status or "not mentioned"]
          - Weight: [weight or "not mentioned"]
        
        Within each heading:
        - Use bullet points starting with "- ".
        - Each bullet should reflect a single fact or statement from the transcript.
        - Clearly tag who said it when relevant:
          - Start owner statements with "Owner reports:".
          - Start veterinarian statements with "Vet notes:", "Vet says:", or "Vet asks:" as appropriate.
        
        STRICT RULES ABOUT ACCURACY AND CERTAINTY:
        - Do NOT invent anything that was not clearly stated.
          - No new diagnoses.
          - No new recommendations.
          - No “consistent with”, “indicating”, “suggesting”, or similar interpretive language that was not spoken.
        - If someone mentions a disease name (for example, "lymphoma"):
          - Only put it under DIAGNOSTIC_IMPRESSIONS_AND_DIAGNOSES as a vet impression if the VET clearly states it as their impression or diagnosis.
          - If it is not absolutely clear that the veterinarian is the speaker, treat it as an owner comment and place it under OWNER_COMMENTS or OTHER_NOTES, tagged as owner language (for example, "Owner uses the word 'lymphoma' to describe the mass on the left side.").
        - Do NOT convert owner words into vet suspicions. For example:
          - If the owner says "I think it is lymphoma", you should NOT write "Vet suspects lymphoma".
        - Preserve uncertainty exactly as spoken:
          - If someone says "maybe", "probably", "I think", or "not sure", include those words in the bullet.
          - Do NOT rewrite a "maybe" into a firm statement.
          - Only state that the OWNER used a disease term (for example, "lymphoma") if it is clearly spoken by the owner.
  - If you are not certain who said the word, do NOT say "Owner uses the word ...".
  - In that case, you may write a neutral note such as "The term 'lymphoma' is used to describe the mass." without assigning it to the owner.
  - Whenever species, breed, coat color, or age seems ambiguous or distorted (for example, "Moth Kerr"), mark as “unclear” or “not specified.” Never treat unclear hallucinated words as factual breed descriptors.

        
        MASSES AND FINDINGS:
        - For each mass mentioned, capture:
          - Location.
          - Size if given.
          - How it feels if described (for example, "feels like a fatty lump").
          - Who described it (owner or vet).
        - Do NOT label a mass as a tumor, cancer, or lymphoma unless those exact words were used, and respect who said them.
        
        DIAGNOSTIC_IMPRESSIONS_AND_DIAGNOSES:
        - Only include items here if:
          - The veterinarian clearly expresses an impression, suspicion, or diagnosis.
        - You may use phrases such as:
          - "Vet suspects: ..."
          - "Vet is concerned about: ..."
          - "Vet impression: ..."
        - Do NOT create new impressions that were not explicitly stated.
        
        RECOMMENDATIONS_AND_PLAN:
        - Only include recommendations or plans that were clearly spoken (for example, "We will give a supplement for his joints", "We will monitor the lumps").
        - Do NOT add your own suggestions (for example, "Consider dental examination") unless those words or very close equivalents were spoken in the transcript.
        
        GENERAL BEHAVIOR:
        - This is NOT a conversation. Do not add any commentary, explanation, or reasoning.
        - Do NOT summarize; list the specific statements.
        - Do NOT leave out anything medically relevant.
        - If something important is mentioned but unclear, capture it as it was said and mark it as unclear (for example, "Owner reports: 'he used to do seven' (unclear context)").`,
            model: "gpt-4o-mini"
        });



        // Agent 2: Format into SOAP
        const soapFormatter = new Agent({
            name: "SOAP Formatter",
            instructions: `Take the SOAP information given to you and slot it into a properly formatted SOAP.

CRITICAL - PET NAME EXTRACTION (DO THIS FIRST):
- Look for "Pet Name:" in the PATIENT_IDENTIFICATION section
- At the VERY END of your output, you MUST include: PET_NAME: [the pet's name]
- If a name was provided (anything other than "not mentioned"), use that exact name
- If no name was found, output: PET_NAME: no name provided
- This line MUST appear as the last line of your response, after all SOAP content

CRITICAL RULES:
- Be THOROUGH - every single piece of information from the transcript MUST be included
- NOTHING should be left out - if it was mentioned, it goes in the SOAP
- DO NOT use dashes or bullet points - each line should be indented with spaces below headers
- ONE point per line - never combine multiple findings into a single line
- Each line should be a complete, descriptive sentence
- All section headers must be bolded using **Header** markdown syntax
- Use the defaults shown below ONLY if that system/vital was not mentioned
- DO NOT include Weight in Physical Exam unless weight was specifically mentioned in the transcript

ABSOLUTELY NO REPETITION - THIS IS CRITICAL:
- NEVER repeat the same information in multiple sections
- Each piece of information appears ONCE and ONLY ONCE in the entire SOAP
- Presenting Complaint vs History: Presenting Complaint is ONLY the reason for visit (chief complaint). History is everything else the owner reported (symptoms, timeline, past conditions). If something is in Presenting Complaint, it CANNOT appear in History.
- History vs Physical Exam: History contains what the OWNER reported/observed at home. Physical Exam contains what the VET found during examination. Owner observations go in History, vet findings go in Physical Exam - never both.
- If you mention a finding in one section, DO NOT mention it again anywhere else in the SOAP

PHYSICAL EXAM DEFAULTS - REPLACEMENT RULE:
- The defaults shown (e.g., "Eyes: Clear, no discharge") are ONLY used when that body system was NOT mentioned at all
- If the vet mentioned ANY finding for a body system, COMPLETELY REPLACE the default with the actual finding
- NEVER keep the default AND add the actual finding - it's one or the other
- Example: If vet says "eyes are red", write "Eyes: Erythema observed" - NOT "Eyes: Clear, no discharge. Erythema observed."

Here is the output format:

**Subjective**

**Presenting Complaint:**
  [Pet name, species, breed, age, and THE SINGLE PRIMARY REASON for visit - this is ONLY the chief complaint]
  DO NOT include symptoms, history, or details here - just the main reason they came in
  USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY

**History:**
  [Each history item on its own line - one fact per line]
  [Write as direct clinical statements using professional medical terminology]
  [NEVER use phrases like "Owner reports", "Owner states", "Stated by owner", "Per owner", "Client reports"]
  [Just state the medical facts directly:]
  Example format:
    Vomiting for 3 days
    Decreased appetite since onset
    No diarrhea noted
    Previously treated for similar episode 6 months ago
    Currently on Hill's i/d diet
    No current medications
  DO NOT repeat the presenting complaint here

**Objective**

**Vital Signs:**
  Temperature: WNL
  Pulse: WNL
  Respiratory Rate: WNL
  USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY - avoid common/layman language

**Physical Exam**
  NOTE: This section is ONLY for what the VET observed/found during examination - NOT owner reports.  USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY - avoid common/layman language
  DO NOT repeat anything already mentioned in History - if owner reported it, it stays in History only
  IMPORTANT: If vet mentioned a finding for any system below, REPLACE the default entirely - never keep both
  [ONLY include Weight if it was mentioned in the transcript - otherwise skip this line]
  General: Bright, alert, responsive
  Body Condition Score: 5/9
  Hydration: Euhydrated
  Mucous Membranes: Pink, moist
  CRT: <2 seconds
  Cardiovascular: Heart sounds normal, no murmurs detected, regular sinus rhythm
  Respiratory: Normal bronchovesicular sounds
  Abdomen: Soft, non-painful abdomen on palpation
  Musculoskeletal: Ambulatory, no lameness observed
  Neurologic: Appropriate mentation, normal gait
  Integumentary: No lesions, normal coat condition, no ectoparasites observed
  Lymph Nodes: No lymphadenopathy
  Eyes: Clear, no discharge
  Ears: Clean, no debris or odor
  Oral: Oral exam normal: Gingiva healthy, Gd. 1 tartar
  Nose: No abnormal findings
  Throat: No abnormal findings
  Urogenital: Normal
  
Masses:
  [Only include masses the VET examined - with location, size, consistency from vet's exam]
  USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY

**Diagnostics Performed:**
  [Each test and its results on its own line, or "None performed"]
  USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY - avoid common/layman language

**Assessment**

**Assessment:**
  [Each statement on its own line - concise professional medical sentences]
  [Use formal veterinary medical terminology exclusively - no layman terms]
  [Summarize key clinical findings and their significance]
  [State clinical impressions as declarative medical statements]
  [Include differentials only if directly supported by findings]
  [Do NOT restate the Plan or reference future actions here]
  Example format:
    Patient presents with acute onset emesis and hyporexia of 72 hours duration.
    Physical examination reveals mild dehydration and epigastric discomfort on palpation.
    Clinical presentation consistent with acute gastroenteritis.


**Diagnosis:**
  [Each diagnosis on its own line with DDx directly underneath]
  [Format: Diagnosis name, then DDx: comma-separated differentials for that specific diagnosis]
  [Use formal veterinary medical terminology only]
  Example format:
    Acute Gastroenteritis
    DDx: Dietary indiscretion, Infectious enteritis (viral/bacterial), Parasitic infections (e.g., giardiasis)

    Dehydration due to Vomiting and Diarrhea
    DDx: Acute kidney injury secondary to dehydration, Electrolyte imbalances

**Plan:**

**Treatment:**
  [Each medication on its own line with dose, route, frequency]
  [Each vaccine on its own line]
  [Each procedure on its own line]
  
  IF NO TREATMENTS WERE MENTIONED IN THE TRANSCRIPT:
  Write "Suggested Treatments:" and list the 3 most common/appropriate treatment drugs for the diagnosis with standard doses:
  Example for acute gastroenteritis:
**Treatment:**

**Suggested Treatments:**
  Maropitant (Cerenia) 1 mg/kg SQ q24h
  Lactated Ringer's Solution 10-20 mL/kg SQ
  Metronidazole 10-15 mg/kg PO BID
  
  USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY - avoid common/layman language

**Monitoring:**
  [Each monitoring instruction on its own line]
  USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY - avoid common/layman language

**Client Communication:**
  REFERENCE THE TREATMENT SECTION ABOVE - pull the exact medications/doses/routes from there and incorporate into client communication.
  
  FORMAT EACH LINE AS: "Discussed [specific treatment/finding] - [clinical rationale/what was explained]"
  
  MANDATORY - For EACH treatment given, document what was explained to client:
  - Injections given: "Discussed Maropitant (Cerenia) 1 mg/kg SQ administered for antiemetic effect, duration of action 24 hours"
  - IV/SQ fluids: "Discussed administration of 150 mL LRS SQ for rehydration support, expect subcutaneous swelling to absorb over 6-8 hours"
  - Oral medications sent home: "Discussed Metronidazole 15 mg/kg PO BID x 7 days for GI bacterial overgrowth, give with food to reduce GI upset"
  - Pain management: "Discussed Meloxicam 0.1 mg/kg PO SID administered for analgesia and anti-inflammatory effect"
  - Antibiotics: "Discussed Convenia 8 mg/kg SQ injection providing 14 days antibiotic coverage for skin infection"
  
  ALSO INCLUDE when discussed:
  - Specific diagnostic findings explained: "Reviewed radiographs with owner showing intestinal gas pattern consistent with ileus"
  - Lab result discussions: "Discussed elevated ALT (245 U/L) indicating hepatocellular injury, recommended recheck in 2 weeks"
  - Prognosis with specifics: "Discussed guarded prognosis given BUN 85 mg/dL and creatinine 4.2 mg/dL indicating Stage 3 CKD"
  - Declined treatments: "Owner declined recommended abdominal ultrasound due to financial constraints"
  - Cost estimates discussed: "Discussed estimate for dental prophylaxis with extractions ($800-1200)"
  
  NEVER write vague statements like:
  - "Discussed treatment plan" ❌
  - "Explained medications" ❌  
  - "Reviewed findings with owner" ❌
  - "Discussed prognosis" ❌
  
  ALWAYS specify the WHAT, the DOSE/AMOUNT, and the WHY.

**Recommended Diagnostics:**
  [Each recommended test on its own line, or "None recommended"]
  USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY - avoid common/layman language

**Follow-up:**
  [Follow-up instructions]
  USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY - avoid common/layman language

REMEMBER: Your response MUST end with the pet name line below (this is required for file naming):
PET_NAME: [the pet's name from PATIENT_IDENTIFICATION, or "no name provided" if not mentioned]`,
            model: "gpt-4o-mini"
        });

        // Run Agent 1: Extract information
        console.log('[SOAP Agent] Running transcription extractor...');
        const extractorResult = await runner.run(transcriptionExtractor, input.trim());

        if (!extractorResult.finalOutput) {
            throw new Error("Transcription extraction failed - no output");
        }
        console.log('[SOAP Agent] Extractor output:', extractorResult.finalOutput);

        // Check if agent refused to process (common phrases in refusals)
        const refusalPhrases = [
            'please provide',
            'i need',
            "i'm sorry",
            "i'm unable",
            'could you please',
            'unfortunately',
            'i cannot'
        ];
        const outputLower = extractorResult.finalOutput.toLowerCase();
        const isRefusal = refusalPhrases.some(phrase => outputLower.includes(phrase));

        if (isRefusal) {
            console.log('[SOAP Agent] WARNING: Agent appears to have refused processing. Attempting to force extraction...');
            // Try again with a more forceful prompt
            const forcedInput = `You MUST extract information from this input, even if brief: "${input.trim()}"\n\nExtract ANYTHING mentioned and categorize it. Do not refuse.`;
            const retryResult = await runner.run(transcriptionExtractor, forcedInput);
            if (retryResult.finalOutput) {
                console.log('[SOAP Agent] Retry successful');
                extractorResult.finalOutput = retryResult.finalOutput;
            }
        }

        console.log('[SOAP Agent] Extraction complete, running formatter...');

        // Run Agent 2: Format SOAP - pass the extracted info directly
        const formatterInput = extractorResult.finalOutput + "\n\nNow format this into the SOAP template.";
        const formatterResult = await runner.run(soapFormatter, formatterInput);

        if (!formatterResult.finalOutput) {
            throw new Error("SOAP formatting failed - no output");
        }
        console.log('[SOAP Agent] SOAP generation complete');

        const fullResponse = formatterResult.finalOutput;

        if (!fullResponse) {
            console.error('No response from SOAP agents');
            return res.status(500).json({ error: 'No report generated' });
        }

        // Extract pet name if present
        let report = fullResponse;
        let petName = null;

        const petNameMatch = fullResponse.match(/PET_NAME:\s*(.+?)(?:\n|$)/i);
        if (petNameMatch && petNameMatch[1]) {
            let extractedName = petNameMatch[1].trim();
            // Remove markdown formatting (**, *, etc.)
            extractedName = extractedName.replace(/\*\*/g, '').replace(/\*/g, '').trim();
            // Only set petName if it's not "no name provided"
            if (extractedName.toLowerCase() !== 'no name provided') {
                petName = extractedName;
            }
            // Remove the PET_NAME line from the report
            report = fullResponse.replace(/PET_NAME:\s*.+?(?:\n|$)/i, '').trim();
        }

        // Increment QuickSOAP usage counter for the user
        console.log('[SOAP] User object received:', user);
        if (user?.sub) {
            console.log('[SOAP] Attempting to increment quicksoap_count for user:', user.sub);
            try {
                // First, get the current count
                const { data: userData, error: fetchError } = await supabase
                    .from('users')
                    .select('quicksoap_count')
                    .eq('auth0_user_id', user.sub)
                    .single();

                console.log('[SOAP] Fetch result:', { userData, fetchError });

                if (!fetchError && userData) {
                    // Increment the count
                    const newCount = (userData.quicksoap_count || 0) + 1;
                    console.log('[SOAP] Incrementing count from', userData.quicksoap_count, 'to', newCount);

                    const { error: updateError } = await supabase
                        .from('users')
                        .update({
                            quicksoap_count: newCount
                        })
                        .eq('auth0_user_id', user.sub);

                    if (updateError) {
                        console.error('[SOAP] Update error:', updateError);
                    } else {
                        console.log('[SOAP] Successfully updated quicksoap_count to', newCount);
                    }
                } else {
                    console.log('[SOAP] Could not fetch user or error occurred:', fetchError);
                }
            } catch (updateError) {
                console.error('[SOAP] Failed to increment quicksoap_count:', updateError);
                // Don't fail the request if counter update fails
            }
        } else {
            console.log('[SOAP] No user.sub provided, skipping counter increment');
        }

        return res.status(200).json({ report, petName, recordType });
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
                    .select('*, email, nickname, dvm_name');

                if (error) {
                    console.error('Supabase update error:', error);
                    throw error;
                }

                console.log('Update successful:', data);

                // Send subscription confirmation email (wait for it to prevent serverless termination)
                if (data && data[0] && data[0].email) {
                    console.log('Sending subscription confirmation email to:', data[0].email);
                    try {
                        await sendSubscriptionConfirmedEmail(
                            supabase,
                            {
                                auth0_user_id: session.client_reference_id,
                                email: data[0].email,
                                nickname: data[0].nickname,
                                dvm_name: data[0].dvm_name
                            },
                            subscriptionInterval,
                            new Date(subscription.current_period_end * 1000).toISOString()
                        );
                        console.log('Subscription confirmation email sent successfully');
                    } catch (err) {
                        console.error('Failed to send subscription confirmation email:', err);
                    }
                } else {
                    console.log('No email found for subscription confirmation:', data);
                }
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
        const { user_id } = req.body;
        console.log('Trial activation request:', { user_id });

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
            email_opt_out: false,
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
            .select('*, email, nickname, dvm_name');

        if (error) {
            console.error('Supabase update error:', error);
            throw error;
        }

        console.log('Trial activation successful:', data);

        // Send trial activation email (wait for it before responding to prevent serverless termination)
        if (data && data[0] && data[0].email) {
            console.log('Sending trial activation email to:', data[0].email);
            try {
                await sendTrialActivatedEmail(supabase, {
                    auth0_user_id: user_id,
                    email: data[0].email,
                    nickname: data[0].nickname,
                    dvm_name: data[0].dvm_name
                }, trialEndDate.toISOString());
                console.log('Trial activation email sent successfully');
            } catch (err) {
                console.error('Failed to send trial activation email:', err);
            }
        } else {
            console.log('No email found for trial activation email:', data);
        }

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

// Cancel student plan endpoint
app.post('/cancel-student', async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // Verify user has a student plan
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('plan_label')
            .eq('auth0_user_id', user_id)
            .single();

        if (userError || !userData) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (userData.plan_label !== 'student') {
            return res.status(400).json({ error: 'User is not on a student plan' });
        }

        // Deactivate student plan
        const { error: updateError } = await supabase
            .from('users')
            .update({
                subscription_status: 'inactive',
                subscription_end_date: new Date().toISOString(),
                plan_label: null
                // Note: We preserve student_grad_year and student_school_email for records
            })
            .eq('auth0_user_id', user_id);

        if (updateError) throw updateError;

        console.log(`Student plan deactivated for user ${user_id}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Cancel student error:', error);
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

// ================ PASSWORD CHANGE ENDPOINT ================
app.post('/request-password-change', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Call Auth0's change password endpoint
        const auth0Domain = process.env.REACT_APP_AUTH0_DOMAIN;
        const clientId = process.env.REACT_APP_AUTH0_CLIENT_ID;

        if (!auth0Domain || !clientId) {
            console.error('Auth0 configuration missing');
            return res.status(500).json({ error: 'Auth0 configuration error' });
        }

        const response = await fetch(`https://${auth0Domain}/dbconnections/change_password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: clientId,
                email: email,
                connection: 'Username-Password-Authentication'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Auth0 password change error:', errorText);
            throw new Error('Failed to send password reset email');
        }

        console.log('Password reset email sent to:', email);
        res.json({ success: true, message: 'Password reset email sent' });

    } catch (error) {
        console.error('Password change request error:', error);
        res.status(500).json({ error: error.message });
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

        // QuickSOAP metrics (sum from user counts)
        const totalQuickSOAPs = users.reduce(
            (sum, user) => sum + (user.quicksoap_count || 0),
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
            totalQuickSOAPs,
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
                ? 'https://app.petwise.vet/dashboard/profile'
                : 'http://localhost:3000/dashboard/profile',
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

