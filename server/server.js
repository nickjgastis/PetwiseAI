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

// ================ ADMIN AUTH MIDDLEWARE ================
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || process.env.REACT_APP_ADMIN_USER_ID;
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;

if (!ADMIN_USER_ID) console.warn('WARNING: ADMIN_USER_ID is not set — admin endpoints will reject all requests');
if (!AUTH0_DOMAIN) console.warn('WARNING: AUTH0_DOMAIN is not set — admin auth will fail');
console.log(`Admin middleware initialized. Admin ID configured: ${ADMIN_USER_ID ? 'yes' : 'NO'}`);

const adminTokenCache = new Map();

const requireAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }

        const token = authHeader.split(' ')[1];

        if (adminTokenCache.has(token)) {
            const cached = adminTokenCache.get(token);
            if (Date.now() < cached.expiresAt) {
                req.adminUser = cached.userInfo;
                return next();
            }
            adminTokenCache.delete(token);
        }

        const userInfoRes = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!userInfoRes.ok) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const userInfo = await userInfoRes.json();

        if (userInfo.sub !== ADMIN_USER_ID) {
            console.warn(`Admin access denied. Token sub: "${userInfo.sub}", expected: "${ADMIN_USER_ID}"`);
            return res.status(403).json({ error: 'Forbidden: not an admin user' });
        }

        adminTokenCache.set(token, { userInfo, expiresAt: Date.now() + 5 * 60 * 1000 });
        req.adminUser = userInfo;
        next();
    } catch (err) {
        console.error('Admin auth error:', err);
        return res.status(401).json({ error: 'Authentication failed' });
    }
};

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
const TRIAL_DAYS = 30;  // Legacy in-house trial (no longer offered to new users)
const STRIPE_TRIAL_DAYS = 14;  // New Stripe trial with card required
const REPORT_LIMITS = {
    trial: 50,           // Legacy in-house trial limit
    stripe_trial: Infinity,  // New Stripe trial - unlimited
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
            model = 'gpt-5.4-mini',
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
                    model: 'gpt-5.4-nano',
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

// SOAP generation endpoint using gpt-5.4-mini
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
                model: "gpt-5.4-mini"
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
- The doctor's name should only appear ONCE, in the opening summary. Do not repeat the doctor's name throughout the report — use "the clinician" or omit the reference after the first mention.

OUTPUT FORMAT (adapt sections dynamically based on content provided):

Client Communication Report
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
                model: "gpt-5.4-mini"
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
            instructions: `Extract all important information from this veterinary input so it can be formatted into a SOAP later.

CRITICAL: You MUST process ANY input provided, even if it's just a few words or a short note. NEVER refuse to process input or ask for more information. Work with whatever is given.

Your job:
- Read the transcript sentence by sentence.
- Carefully capture EVERY detail (whether it's a full transcript, short notes, or just keywords).
- CRITICAL: Include ALL owner-reported and vet-reported information - do not omit ANY details, no matter how minor.
- Every symptom, timeline, medication, diet change, behavioral observation, and background detail MUST be extracted.
- Organize information under the headings below.
- Do NOT interpret, diagnose, summarize, or add recommendations.
- Do NOT upgrade or strengthen what was said (no extra certainty).
- If the input is brief (e.g., "pancreatitis patient"), still extract it and categorize it appropriately.
- If a sentence contains multiple distinct data points, split them into the appropriate headings.

CRITICAL - MEDICAL TERMINOLOGY CONVERSION (APPLIES TO ENTIRE OUTPUT):
- EVERY term in EVERY section must use professional veterinary medical terminology. Zero layman terms anywhere in the output.
- Even if the owner uses casual language, always translate to proper medical/scientific terminology.
- Examples: "throwing up" = "emesis", "pooping" = "defecating", "peeing" = "urinating", "belly" = "abdomen", "eating less" = "hyporexia", "not eating" = "anorexia", "drinking a lot" = "polydipsia", "peeing a lot" = "polyuria", "tired/sleepy" = "lethargy", "lump" = "mass", "swelling" = "edema", "red" = "erythematous", "itchy" = "pruritic", "runny nose" = "nasal discharge", "eye gunk" = "ocular discharge", "scratching" = "pruritus", "hives" = "urticaria", "scar" = "cicatrix", "broken out" = "eruption/urticaria", "ripples in fur" = "cutaneous wheals".
- This is non-negotiable. No layman language should ever appear in the final extraction.

Use exactly these headings:
- PATIENT_IDENTIFICATION
- SUBJECTIVE_PRESENTING_COMPLAINT
- SUBJECTIVE_HISTORY
- SUBJECTIVE_SKIN_COAT
- SUBJECTIVE_DIET_APPETITE
- SUBJECTIVE_VDCS
- SUBJECTIVE_CURRENT_MEDICATION
- SUBJECTIVE_RISK_FACTORS
- SUBJECTIVE_ADDITIONAL_INFO
- VET_COMMENTS_AND_EXAM
- TREATMENTS_AND_PLAN_MEDICATIONS
- DIAGNOSTIC_TESTS_AND_RESULTS
- DIAGNOSTIC_IMPRESSIONS_AND_DIAGNOSES
- RECOMMENDATIONS_AND_PLAN
- OTHER_NOTES

ONLY include a heading if there is at least one relevant piece of information for it. Do NOT output empty headings. PATIENT_IDENTIFICATION is the only exception and must always be included.

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

CRITICAL - VET FIREWALL FOR ALL SUBJECTIVE HEADINGS:
If the VET said it, explained it, suspected it, educated the client about it, or recommended it during THIS visit, it is NOT subjective. It goes to VET_COMMENTS_AND_EXAM, DIAGNOSTIC_IMPRESSIONS_AND_DIAGNOSES, TREATMENTS_AND_PLAN_MEDICATIONS, or RECOMMENDATIONS_AND_PLAN. Subjective headings contain ONLY owner-reported information and pre-visit context.

CRITICAL - PRESENT vs PAST TENSE IN SUBJECTIVE:
All SUBJECTIVE headings (except CURRENT_MEDICATION) describe what the owner reported BEFORE or LEADING UP TO the visit. Use past tense. If something "is present" on the animal right now during the exam, that is a Physical Exam finding under VET_COMMENTS_AND_EXAM, not subjective. The only exception is SUBJECTIVE_CURRENT_MEDICATION which describes what the pet is currently taking.

SUBJECTIVE HEADING CLASSIFICATION RULES:
For each sentence in the transcript that contains owner-reported or subjectively relevant information, classify it into the best matching SUBJECTIVE heading using these rules:

SUBJECTIVE_PRESENTING_COMPLAINT:
- The primary reason for the visit. The owner's main concern, reason for the appointment, major symptom, or what the pet was brought in for.
- Include short timeline details ONLY if they directly support the main complaint (e.g., "vomiting for 2 days").
- This should be concise - typically one or two lines capturing the chief complaint.

SUBJECTIVE_HISTORY:
- Background and progression of the issue BEFORE this visit: onset, duration, progression, previous episodes, prior treatments, prior vet visits, relevant past medical history, prior surgeries.
- This is STRICTLY historical and pre-visit information only. Nothing from today's visit belongs here.
- Do NOT include anything the vet said, recommended, suspected, explained, or prescribed during THIS visit.
- Do NOT include current treatment plans, new instructions, today's exam findings, or vet educational comments.
- Do NOT place current medications here unless they are clearly historical and no longer being given.
- Do NOT repeat the presenting complaint here.
- No future-tense or forward-looking statements belong here. Statements like "these take 5-7 days to resolve" or "this may happen again" are vet guidance and go to RECOMMENDATIONS_AND_PLAN or client communication context.
- Focus on TIMELINE and PROGRESSION only. If a clinical finding (e.g., pruritus, urticaria, excoriations, scars) is already captured in another SUBJECTIVE heading like SKIN_COAT, VDCS, or CURRENT_MEDICATION, do NOT restate it here. History should add only new temporal or contextual information not covered elsewhere.

SUBJECTIVE_SKIN_COAT:
- What the OWNER reported about skin and coat issues AT HOME, before the visit: pruritus, lesions the owner noticed, licking, chewing, hair loss, odor, coat changes the owner described.
- Use past tense — this is what the owner observed, not what is currently visible on exam. Anything currently present on the animal during the exam (e.g., "wheals are present", "excoriations are present") belongs in VET_COMMENTS_AND_EXAM under Physical Exam, not here.
- Historical surgical scars and resolved conditions go in SUBJECTIVE_HISTORY.
- Only include if the owner actually reported skin/coat concerns.

SUBJECTIVE_DIET_APPETITE:
- Appetite, eating behavior, food type, treats, diet changes, water intake if mentioned subjectively, food refusal, polyphagia, weight concerns mentioned by owner, feeding habits.
- Only include if diet or appetite information is actually mentioned.

SUBJECTIVE_VDCS:
- Vomiting, diarrhea, coughing, and/or sneezing. If ANY of these four are mentioned, include this heading.
- Structure content with explicit labels where possible: "Vomiting: [details]", "Diarrhea: [details]", etc.
- Only include the specific sub-items that are actually mentioned.

SUBJECTIVE_CURRENT_MEDICATION:
- Medications, supplements, preventatives, OTC products, topical treatments the pet was ALREADY receiving BEFORE this visit.
- Owner-administered emergency treatment at home before arriving (e.g., "owner gave Benadryl at home") counts here — but ONLY what the owner actually gave, at the dose they gave.
- Do NOT include the vet's dosing recommendations, dosing corrections, or adjusted instructions. If the vet says "you can do 50mg three times a day", that is a TREATMENT recommendation, not a current medication.
- If a medication was used in the past but is no longer being given, place it in SUBJECTIVE_HISTORY instead.

SUBJECTIVE_RISK_FACTORS:
- Lifestyle, routine, and environmental risk factors: indoor/outdoor status, exposure to other animals, dog park, boarding, daycare, recent travel, dietary indiscretion, scavenging, toxin exposure concerns, grooming exposure, recent household changes, activity or routine changes.
- Only include if risk factor information is actually mentioned.

SUBJECTIVE_ADDITIONAL_INFO:
- Catch-all for CLINICALLY RELEVANT owner-reported information that does not fit the above categories.
- Owner observations, behavioral changes, energy level, sleep changes, anxiety, stress, mobility concerns, urination/defecation details not captured elsewhere.
- Must be clinically relevant to the case. Exclude: pet personality/temperament during the visit, cohabiting pet behavior, casual conversation, vet educational explanations (e.g., "this is a delayed hypersensitivity reaction"), vet warnings about side effects, and breed commentary.
- Only include if there is leftover owner-reported information that truly does not belong in any other SUBJECTIVE heading.

HEADING PRIORITY (when a sentence could fit more than one heading):
1. SUBJECTIVE_PRESENTING_COMPLAINT
2. SUBJECTIVE_CURRENT_MEDICATION
3. SUBJECTIVE_VDCS
4. SUBJECTIVE_DIET_APPETITE
5. SUBJECTIVE_SKIN_COAT
6. SUBJECTIVE_HISTORY
7. SUBJECTIVE_RISK_FACTORS
8. SUBJECTIVE_ADDITIONAL_INFO

NON-SUBJECTIVE HEADINGS:

VET_COMMENTS_AND_EXAM:
- Physical exam findings, vet observations during the visit, anything the vet found or noted on examination.
- This is NOT owner-reported info. Vet exam findings go here, owner reports go in SUBJECTIVE headings.
- IMPORTANT: Observable clinical findings stated in the dictation — such as cleft palate, nasal discharge, heart murmur, masses palpated, lameness observed, dental disease, ocular discharge, etc. — are PHYSICAL EXAM findings even if the vet does not explicitly say "on exam". If a clinical finding is something that would be seen, heard, felt, or smelled during examination, it goes HERE.
- Each finding should map to a body system (e.g., cleft palate = Oral, nasal discharge = Nose, heart murmur = Cardiovascular). The formatter will use these to replace Physical Exam defaults.

TREATMENTS_AND_PLAN_MEDICATIONS:
- Medications, treatments, procedures the vet is prescribing or administering DURING THIS VISIT.
- This is different from SUBJECTIVE_CURRENT_MEDICATION which is what the pet was already taking before the visit.

DIAGNOSTIC_TESTS_AND_RESULTS:
- Any diagnostics performed or ordered and their results.

DIAGNOSTIC_IMPRESSIONS_AND_DIAGNOSES:
- Only include if the veterinarian clearly expresses an impression, suspicion, or diagnosis.
- Use phrases such as "Vet suspects: ...", "Vet is concerned about: ...", "Vet impression: ..."
- Do NOT create new impressions that were not explicitly stated.

RECOMMENDATIONS_AND_PLAN:
- Only include recommendations or plans that were clearly spoken.
- Do NOT add your own suggestions unless those words or very close equivalents were spoken in the transcript.

Within each heading:
- Use bullet points starting with "- ".
- Each bullet should reflect a single fact or statement from the transcript.
- ALWAYS convert layman terms to medical terminology in every bullet point.
- Convert conversational language into concise veterinary charting language.
- Do NOT use phrases like "Owner reports", "Owner states", "Per owner" - just state the clinical facts directly.

STRICT RULES ABOUT ACCURACY AND CERTAINTY:
- Do NOT invent anything that was not clearly stated.
  - No new diagnoses.
  - No new recommendations.
  - No "consistent with", "indicating", "suggesting", or similar interpretive language that was not spoken.
- If someone mentions a disease name (for example, "lymphoma"):
  - Only put it under DIAGNOSTIC_IMPRESSIONS_AND_DIAGNOSES as a vet impression if the VET clearly states it as their impression or diagnosis.
  - If it is not absolutely clear that the veterinarian is the speaker, place it in the appropriate SUBJECTIVE heading tagged as owner language.
- Do NOT convert owner words into vet suspicions.
- Preserve uncertainty exactly as spoken: "maybe", "probably", "I think" must be preserved.
- Whenever species, breed, coat color, or age seems ambiguous or distorted, mark as "unclear" or "not specified."

MASSES AND FINDINGS:
- For each mass mentioned, capture: Location (anatomical terminology), Size if given, Feel if described (use medical terms), Who described it.
- Do NOT label a mass as a tumor, cancer, or lymphoma unless those exact words were used.
- Use medical terminology: "mass" not "lump", "subcutaneous" not "under the skin".

CRITICAL - ZERO DUPLICATION ACROSS SUBJECTIVE HEADINGS:
- Every fact appears exactly ONCE across all SUBJECTIVE headings. No exceptions.
- If a detail is placed in a specific heading (e.g., pruritus in SKIN_COAT), it must NOT also appear in HISTORY or any other heading.
- HISTORY should only contain timeline/progression facts that are not already captured in another heading. If skin findings are in SKIN_COAT, do not re-describe them in HISTORY. If meds are in CURRENT_MEDICATION, do not mention them in HISTORY.
- Before finalizing output, scan every SUBJECTIVE heading and delete any fact that already appears in a higher-priority heading.

GENERAL BEHAVIOR:
- This is NOT a conversation. Do not add any commentary, explanation, or reasoning.
- Do NOT summarize; list the specific statements.
- ABSOLUTELY DO NOT leave out ANY information from the transcript - capture EVERYTHING.
- Favor recall over compression: it is better to include too much than to omit anything.
- If something important is mentioned but unclear, capture it as said and mark it as unclear.
- Preserve clinically meaningful detail: duration, severity, frequency, progression, response to treatment.
- If information is vague, keep it vague rather than inventing specifics.
- REMINDER: Every single extraction must use professional veterinary medical terminology.`,
            model: "gpt-5.4-mini"
        });



        // Agent 2: Format into SOAP
        const soapFormatter = new Agent({
            name: "SOAP Formatter",
            instructions: `Take the extracted SOAP information and format it into a properly structured SOAP note.

CRITICAL - PET NAME EXTRACTION (DO THIS FIRST):
Look for "Pet Name:" in the PATIENT_IDENTIFICATION section
At the VERY END of your output, you MUST include: PET_NAME: [the pet's name]
If a name was provided (anything other than "not mentioned"), use that exact name
If no name was found, output: PET_NAME: no name provided
This line MUST appear as the last line of your response, after all SOAP content

CRITICAL RULES:
Be THOROUGH - every single piece of information from the extraction MUST be included
NOTHING should be left out - if it was extracted, it goes in the SOAP
DO NOT use dashes or bullet points - each line should start from the left margin
ONE point per line - never combine multiple findings into a single line
Each line should be a complete, descriptive sentence
All section headers must be bolded using **Header** markdown syntax
Use the defaults shown below ONLY if that system/vital was not mentioned
DO NOT include Weight in Physical Exam unless weight was specifically mentioned in the transcript

ABSOLUTELY NO REPETITION - THIS IS CRITICAL:
NEVER repeat the same information in multiple sections
Each piece of information appears ONCE and ONLY ONCE in the entire SOAP
Each Subjective subheading covers a distinct category - do not duplicate facts across subheadings
Subjective vs Physical Exam: Subjective headings contain what the OWNER reported/observed at home. Physical Exam contains what the VET found during examination. Owner observations go in Subjective, vet findings go in Physical Exam - never both.
If you mention a finding in one section, DO NOT mention it again anywhere else in the SOAP

PHYSICAL EXAM DEFAULTS - REPLACEMENT RULE:
The defaults shown (e.g., "Eyes: Clear, no discharge") are ONLY used when that body system was NOT mentioned at all
If the vet mentioned ANY finding for a body system, COMPLETELY REPLACE the default with the actual finding
NEVER keep the default AND add the actual finding - it's one or the other
Example: If vet says "eyes are red", write "Eyes: Erythema observed" - NOT "Eyes: Clear, no discharge. Erythema observed."

Here is the output format:

**Subjective**

DYNAMIC SUBJECTIVE SECTION - CRITICAL INSTRUCTIONS:
The extraction contains SUBJECTIVE_ prefixed headings. For each one that has content, include it in the Subjective section using the display names below. If a SUBJECTIVE_ heading was NOT included in the extraction or has no content, do NOT include that subheading in your output. Only output subheadings that have actual data.

Map extraction headings to display names:
- SUBJECTIVE_PRESENTING_COMPLAINT = **Presenting Complaint:**
- SUBJECTIVE_HISTORY = **History:**
- SUBJECTIVE_SKIN_COAT = **Skin & Coat:**
- SUBJECTIVE_DIET_APPETITE = **Diet/Appetite:**
- SUBJECTIVE_VDCS = **V/D/C/S:**
- SUBJECTIVE_CURRENT_MEDICATION = **Current Medication:**
- SUBJECTIVE_RISK_FACTORS = **Risk Factors:**
- SUBJECTIVE_ADDITIONAL_INFO = **Additional Information:**

Rules for each Subjective subheading:

**Presenting Complaint:** (if SUBJECTIVE_PRESENTING_COMPLAINT exists)
ONE LINE ONLY containing all presenting complaints in a single sentence using professional medical terminology.
This is ONLY the chief complaint/reason for visit.
If the presenting complaint is brief (like "vomiting"), expand it with proper medical terminology but keep it to one line.

**History:** (if SUBJECTIVE_HISTORY exists)
EACH ITEM ON ITS OWN LINE - point form, not paragraph style.
Include ALL history details from the extraction.
STRICTLY pre-visit and historical information only - nothing from today's visit, no new vet instructions, no today's diagnoses or treatment plans.
USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY.
NEVER use phrases like "Owner reports", "Owner states", "Per owner" - just state the medical facts directly.
DO NOT repeat the presenting complaint here.

**Skin & Coat:** (if SUBJECTIVE_SKIN_COAT exists)
Past-tense owner-reported skin/coat observations only. What the owner noticed at home before the visit.
Use dermatologic terminology (pruritus, alopecia, erythema, etc.).
Anything currently visible on the animal during the exam goes in Physical Exam, not here.

**Diet/Appetite:** (if SUBJECTIVE_DIET_APPETITE exists)
Past-tense owner-reported diet and appetite information. What the owner observed about eating/drinking behavior before the visit.
Include food type, appetite changes, water intake details as extracted.

**V/D/C/S:** (if SUBJECTIVE_VDCS exists)
Past-tense owner-reported episodes only. What the owner witnessed at home.
Structure with explicit labels: "Vomiting: [details]", "Diarrhea: [details]", "Coughing: [details]", "Sneezing: [details]"
Only include the specific sub-items that were extracted. Do not add labels for items not mentioned.

**Current Medication:** (if SUBJECTIVE_CURRENT_MEDICATION exists)
Medications the pet was already on BEFORE the visit, or that the owner administered at home before arriving.
Each medication/supplement on its own line. Include dose, route, and frequency if provided.
Do NOT include anything the vet prescribed, recommended, or adjusted during this visit — those go in Treatment.

**Risk Factors:** (if SUBJECTIVE_RISK_FACTORS exists)
Past-tense environmental, lifestyle, and exposure history reported by the owner.
Each risk factor on its own line.

**Additional Information:** (if SUBJECTIVE_ADDITIONAL_INFO exists)
Past-tense owner-reported observations only. No vet commentary, no future-tense statements.
Each additional observation on its own line.

ALL Subjective subheadings are extensions of the patient history — strictly past-tense, owner-reported, pre-visit information. No present-tense exam findings, no vet recommendations, no vet explanations, no treatments prescribed today, no future-tense statements. USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY. Verify no fact is duplicated across subheadings before outputting.

**Objective**

**Vital Signs:**
Temperature: WNL
Pulse: WNL
Respiratory Rate: WNL
USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY - avoid common/layman language

**Physical Exam**
CRITICAL: YOU MUST INCLUDE EVERY BODY SYSTEM LISTED BELOW IN THE OUTPUT. Never skip a system.
USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY - NEVER use layman/common terms.
NOTE: This section is ONLY for what the VET observed/found during examination - NOT owner reports.
DO NOT repeat anything already mentioned in any Subjective subheading.
For each body system: if the vet mentioned a specific finding for that system, REPLACE the default with the actual finding. If the vet did NOT mention that system, KEEP the default value exactly as shown.
EVERY system below must appear in the final output - either with the vet's finding or with the default.
[ONLY include Weight if it was mentioned in the transcript - otherwise skip this line]
General: Bright, alert, responsive
Body Condition Score: 5/9
Hydration: Euhydrated
Mucous Membranes: Pink, moist
CRT: <2 seconds
Cardiovascular: Heart sounds normal, no murmurs detected, regular rhythm
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
Masses: No masses observed

**Diagnostics Performed:**
[Each test and its results on its own line, or "None performed"]
USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY - avoid common/layman language

**Assessment**

**Assessment:**
EACH ASSESSMENT ITEM MUST BE ON ITS OWN LINE - point form, NOT paragraph style.
ONE clinical finding or observation per line.
USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY (this is critical).
Include clinical relevance and diagnostic reasoning.
Integrate physical exam and diagnostic findings.
Discuss lab results if mentioned.
Do NOT restate the Plan or reference future actions here.
Do NOT write long paragraphs - keep each point as a single concise line.

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
Use TREATMENTS_AND_PLAN_MEDICATIONS from the extraction for this section.

IF NO TREATMENTS WERE MENTIONED IN THE TRANSCRIPT:
Write "Suggested Treatments:" organized by diagnosis. One drug/treatment per line, no explanations, just list them.
Format:

**Suggested Treatments:**

[Diagnosis Name]:
Drug Name Dose Route Freq Duration
Drug Name Dose Route Freq Duration

[Another Diagnosis Name]:
Drug Name Dose Route Freq Duration
Drug Name Dose Route Freq Duration

Example:

Acute Gastroenteritis:
Maropitant (Cerenia) 1 mg/kg SQ q24h x 3 days
Lactated Ringer's Solution 10-20 mL/kg SQ PRN
Metronidazole 10-15 mg/kg PO BID x 7 days

USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY

**Monitoring:**
List what to monitor, one item per line. Do NOT start every line with "Monitor for" — state the item directly.
Example format:
Frequency and character of emesis
Appetite and water intake
Progression or resolution of cutaneous lesions
USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY - avoid common/layman language

**Client Communication:**
REFERENCE THE TREATMENT SECTION ABOVE - pull the exact medications/doses/routes from there.

FORMAT: Use "Discussed with client:" once, then list each item underneath. Do NOT repeat "Discussed" on every line.
Each item should include the WHAT, the DOSE/AMOUNT (if applicable), and the WHY.

Example format:

Discussed with client:
Maropitant (Cerenia) 1 mg/kg SQ administered for antiemetic effect, duration of action 24 hours
Metronidazole 15 mg/kg PO BID x 7 days for GI bacterial overgrowth, give with food to reduce GI upset
Administration of 150 mL LRS SQ for rehydration support, expect subcutaneous swelling to absorb over 6-8 hours
Elevated ALT (245 U/L) indicating hepatocellular injury, recommended recheck in 2 weeks
Guarded prognosis given BUN 85 mg/dL and creatinine 4.2 mg/dL indicating Stage 3 CKD
Owner declined recommended abdominal ultrasound due to financial constraints

At the end, always include:
The client was informed of the benefits, potential adverse reactions and side effects of above medications.

NEVER write vague statements like "Discussed treatment plan" or "Explained medications" — always specify the treatment, dose, and rationale.

**Recommended Diagnostics:**
[Each recommended test on its own line, or "None recommended"]
USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY - avoid common/layman language

**Follow-up:**
[Follow-up instructions]
USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY - avoid common/layman language

REMEMBER: Your response MUST end with the pet name line below (this is required for file naming):
PET_NAME: [the pet's name from PATIENT_IDENTIFICATION, or "no name provided" if not mentioned]`,
            model: "gpt-5.4-mini"
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

// ================ STRIPE TRIAL CHECKOUT ENDPOINT ================
// Creates a Stripe checkout session with 14-day free trial
app.post('/create-trial-checkout-session', async (req, res) => {
    try {
        const { user, currency = 'usd' } = req.body;

        // Validate currency
        if (!['usd', 'cad'].includes(currency)) {
            return res.status(400).json({ error: 'Invalid currency. Must be "usd" or "cad"' });
        }

        // Get the monthly price for the selected currency (trial converts to monthly)
        const priceId = PRICE_IDS[`monthly_${currency}`];

        if (!priceId) {
            throw new Error('Invalid currency configuration');
        }

        // Check if user has already used Stripe trial
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('has_activated_stripe_trial, email')
            .eq('auth0_user_id', user.sub)
            .single();

        if (userError) {
            console.error('Error fetching user:', userError);
            throw new Error('Failed to verify user eligibility');
        }

        if (userData?.has_activated_stripe_trial) {
            return res.status(400).json({
                error: 'You have already used your free trial',
                code: 'TRIAL_ALREADY_USED'
            });
        }

        // Find or create Stripe customer
        let customer;
        const existingCustomers = await stripe.customers.list({
            email: user.email,
            limit: 1
        });

        if (existingCustomers.data.length > 0) {
            customer = await stripe.customers.update(existingCustomers.data[0].id, {
                email: user.email,
                name: user.name || 'Valued Customer',
                metadata: { auth0_user_id: user.sub }
            });
        } else {
            customer = await stripe.customers.create({
                email: user.email,
                name: user.name || 'Valued Customer',
                metadata: { auth0_user_id: user.sub }
            });
        }

        // Create checkout session with 14-day trial
        const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            payment_method_types: ['card'],
            mode: 'subscription',
            allow_promotion_codes: true,  // Allow promo codes for first month after trial
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
            subscription_data: {
                trial_period_days: STRIPE_TRIAL_DAYS,  // 14-day free trial
                metadata: {
                    trial_type: 'stripe_trial',
                    currency: currency
                }
            },
            success_url: process.env.NODE_ENV === 'production'
                ? 'https://app.petwise.vet/dashboard?trial_started=true'
                : 'http://localhost:3000/dashboard?trial_started=true',
            cancel_url: process.env.NODE_ENV === 'production'
                ? 'https://app.petwise.vet/dashboard'
                : 'http://localhost:3000/dashboard',
            client_reference_id: user.sub
        });

        console.log('Created trial checkout session:', {
            sessionId: session.id,
            customerId: customer.id,
            priceId: priceId,
            trialDays: STRIPE_TRIAL_DAYS,
            currency: currency
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Trial checkout error:', error);
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

        // Handle initial subscription creation (both regular and trial)
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            console.log('Checkout Session:', session);

            try {
                const subscription = await stripe.subscriptions.retrieve(session.subscription);
                console.log('Subscription:', subscription);

                const priceId = subscription.items.data[0].price.id;
                console.log('Price ID:', priceId);

                // Check if this is a trial subscription
                const isStripeTrial = subscription.status === 'trialing' && subscription.trial_end;
                console.log('Is Stripe Trial:', isStripeTrial, 'Trial End:', subscription.trial_end);

                // Determine subscription interval
                let subscriptionInterval;

                if (isStripeTrial) {
                    // This is a Stripe trial - set interval to stripe_trial
                    subscriptionInterval = 'stripe_trial';
                } else if (priceId === PRICE_IDS.yearly_usd || priceId === PRICE_IDS.yearly_cad) {
                    subscriptionInterval = 'yearly';
                } else {
                    subscriptionInterval = 'monthly';
                }

                // For trials, use trial_end as the subscription_end_date
                // For regular subscriptions, use current_period_end
                const endDate = isStripeTrial
                    ? new Date(subscription.trial_end * 1000).toISOString()
                    : new Date(subscription.current_period_end * 1000).toISOString();

                const updateData = {
                    subscription_status: 'active',
                    subscription_interval: subscriptionInterval,
                    stripe_customer_id: session.customer,
                    subscription_end_date: endDate,
                    reports_used_today: 0,
                    last_report_date: new Date().toISOString().split('T')[0],
                    cancel_at_period_end: false,
                    // Clear student fields on activation (but preserve graduation year)
                    plan_label: null,
                    student_school_email: null,
                    student_last_student_redeem_at: null
                };

                // Set appropriate trial flags
                if (isStripeTrial) {
                    updateData.has_activated_stripe_trial = true;
                } else {
                    updateData.has_used_trial = true;  // Legacy flag for non-trial paid subscriptions
                }

                console.log('Updating user with data:', {
                    auth0_user_id: session.client_reference_id,
                    isStripeTrial,
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

                // Send appropriate email based on subscription type
                if (data && data[0] && data[0].email) {
                    try {
                        if (isStripeTrial) {
                            // Send trial activation email for Stripe trials
                            console.log('Sending Stripe trial activation email to:', data[0].email);
                            await sendTrialActivatedEmail(
                                supabase,
                                {
                                    auth0_user_id: session.client_reference_id,
                                    email: data[0].email,
                                    nickname: data[0].nickname,
                                    dvm_name: data[0].dvm_name
                                },
                                endDate
                            );
                            console.log('Stripe trial activation email sent successfully');
                        } else {
                            // Send subscription confirmation email for paid subscriptions
                            console.log('Sending subscription confirmation email to:', data[0].email);
                            await sendSubscriptionConfirmedEmail(
                                supabase,
                                {
                                    auth0_user_id: session.client_reference_id,
                                    email: data[0].email,
                                    nickname: data[0].nickname,
                                    dvm_name: data[0].dvm_name
                                },
                                subscriptionInterval,
                                endDate
                            );
                            console.log('Subscription confirmation email sent successfully');
                        }
                    } catch (err) {
                        console.error('Failed to send email:', err);
                    }
                } else {
                    console.log('No email found for user:', data);
                }
            } catch (error) {
                console.error('Subscription processing error:', error);
                return res.status(500).json({ error: error.message });
            }
        }

        // Handle successful recurring payments (renewals only, not trial starts)
        if (event.type === 'invoice.payment_succeeded') {
            const invoice = event.data.object;
            console.log('Payment succeeded for invoice:', invoice.id);

            // Only process subscription invoices (not one-time payments)
            if (invoice.subscription) {
                try {
                    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
                    const customer = await stripe.customers.retrieve(invoice.customer);

                    // Skip if subscription is in trial - checkout.session.completed handles trial starts
                    if (subscription.status === 'trialing') {
                        console.log('Skipping invoice.payment_succeeded for trialing subscription:', subscription.id);
                        return res.status(200).json({ received: true });
                    }

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

        // Handle subscription updates (cancellations, reactivations, trial conversions, etc.)
        if (event.type === 'customer.subscription.updated') {
            const subscription = event.data.object;
            const previousAttributes = event.data.previous_attributes || {};
            console.log('Subscription updated:', subscription.id, 'Status:', subscription.status, 'Previous:', previousAttributes);

            try {
                // Find user by stripe customer ID
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('auth0_user_id, subscription_interval, email, nickname, dvm_name')
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

                // Check if this is a trial-to-paid conversion
                // This happens when status changes from 'trialing' to 'active'
                const wasTrialing = previousAttributes.status === 'trialing';
                const isNowActive = subscription.status === 'active';
                const isTrialConversion = wasTrialing && isNowActive;

                if (isTrialConversion) {
                    console.log('Trial conversion detected for user:', userData.auth0_user_id);
                    // Determine the new interval from the price
                    const priceId = subscription.items.data[0].price.id;
                    let newInterval = 'monthly'; // default for trial conversion

                    if (priceId === PRICE_IDS.yearly_usd || priceId === PRICE_IDS.yearly_cad) {
                        newInterval = 'yearly';
                    }

                    updateData.subscription_interval = newInterval;
                    updateData.subscription_status = 'active';

                    // Send welcome to paid subscription email
                    if (userData.email) {
                        try {
                            await sendSubscriptionConfirmedEmail(
                                supabase,
                                {
                                    auth0_user_id: userData.auth0_user_id,
                                    email: userData.email,
                                    nickname: userData.nickname,
                                    dvm_name: userData.dvm_name
                                },
                                newInterval,
                                new Date(subscription.current_period_end * 1000).toISOString()
                            );
                            console.log('Trial conversion email sent to:', userData.email);
                        } catch (emailErr) {
                            console.error('Failed to send trial conversion email:', emailErr);
                        }
                    }
                } else {
                    // Regular status update (not trial conversion)
                    if (subscription.status === 'active') {
                        updateData.subscription_status = 'active';
                    } else if (subscription.status === 'past_due') {
                        updateData.subscription_status = 'past_due';
                    } else if (subscription.status === 'canceled') {
                        updateData.subscription_status = 'inactive';
                        updateData.subscription_interval = null;  // Clear interval on cancellation
                    } else if (subscription.status === 'trialing') {
                        // Still in trial, keep as stripe_trial
                        updateData.subscription_status = 'active';
                    }
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

// ================ LEGACY TRIAL ENDPOINT (DISABLED) ================
// In-house trials are no longer offered. New users should use Stripe trial via /create-trial-checkout-session
// This endpoint is kept to return a proper error message to any old clients still calling it
app.post('/activate-trial', async (req, res) => {
    console.log('Legacy trial activation attempted - endpoint disabled');
    return res.status(410).json({
        error: 'In-house trials are no longer available. Please start a 14-day free trial with card.',
        code: 'LEGACY_TRIAL_DISABLED',
        redirect: '/subscribe'
    });
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

// ================ ADMIN ENDPOINTS (Auth0 protected) ================
app.get('/admin/users', requireAdmin, async (req, res) => {
    try {
        const [usersRes, onboardingRes] = await Promise.all([
            supabase.from('users').select('*').order('created_at', { ascending: false }),
            supabase.from('onboarding').select('auth0_user_id, status, current_step'),
        ]);

        if (usersRes.error) throw usersRes.error;

        const obMap = {};
        (onboardingRes.data || []).forEach(o => { obMap[o.auth0_user_id] = o; });

        const users = (usersRes.data || []).map(u => ({
            id: u.id,
            email: u.email,
            nickname: u.nickname,
            dvm_name: u.dvm_name,
            created_at: u.created_at,
            subscription_status: u.subscription_status,
            subscription_interval: u.subscription_interval,
            subscription_end_date: u.subscription_end_date,
            cancel_at_period_end: u.cancel_at_period_end,
            has_completed_onboarding: u.has_completed_onboarding,
            weekly_reports_count: u.weekly_reports_count,
            quicksoap_count: u.quicksoap_count,
            quick_query_messages_count: u.quick_query_messages_count,
            plan_label: u.plan_label,
            onboarding_status: obMap[u.auth0_user_id]?.status || null,
            onboarding_step: obMap[u.auth0_user_id]?.current_step || null,
        }));

        res.json({ users });
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/admin-metrics', requireAdmin, async (req, res) => {
    try {

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

