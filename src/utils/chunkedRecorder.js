/**
 * ChunkedRecorder - Client-side audio recording with recorder-per-chunk architecture
 * Creates a new MediaRecorder for each chunk to ensure every chunk is a valid WebM file
 * This avoids the "Invalid file format" error that occurs with requestData() fragments
 */

class ChunkedRecorder {
    constructor(options = {}) {
        this.chunkDurationMs = options.chunkDuration || 30000; // 30 seconds default
        this.apiUrl = options.apiUrl || (process.env.NODE_ENV === 'production'
            ? 'https://api.petwise.vet'
            : 'http://localhost:3001');

        this.mediaRecorder = null;
        this.stream = null;
        this.chunkTranscripts = [];
        this.chunkBlobs = [];  // Store all audio chunks for final blob assembly
        this.chunkIndex = 0;
        this.isRecording = false;
        this.isStopping = false;
        this.chunkTimer = null;  // Timer for chunk rotation
        this.currentChunkData = []; // Data for current chunk
        this.isPaused = false;  // Pause state

        // Upload tracking
        this.uploadsInFlight = 0;        // number of Whisper calls in progress
        this.recordingStopped = false;   // did final MediaRecorder stop event fire
        this.finalizeResolve = null;
        this.finalizeReject = null;

        // Callbacks
        this.onChunkReady = options.onChunkReady || null;
        this.onChunkTranscript = options.onChunkTranscript || null;
        this.onFinalTranscript = options.onFinalTranscript || null;
        this.onError = options.onError || null;
        this.onProgress = options.onProgress || null;
    }

    /**
     * Start recording with recorder-per-chunk approach
     * @param {MediaStream} existingStream - Optional existing stream to use (for visualization)
     */
    async start(existingStream = null) {
        try {
            // Use existing stream if provided, otherwise get new one
            if (existingStream) {
                this.stream = existingStream;
            } else {
                // Get user media stream
                this.stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        sampleRate: 16000,
                        echoCancellation: true,
                        noiseSuppression: true
                    }
                });
            }

            this.chunkTranscripts = [];
            this.chunkBlobs = [];
            this.chunkIndex = 0;
            this.isRecording = true;
            this.isStopping = false;
            this.isPaused = false;
            this.uploadsInFlight = 0;
            this.recordingStopped = false;

            // Start first chunk
            this.startNextChunk();

            console.log(`[ChunkedRecorder] Started recording with ${this.chunkDurationMs}ms chunks`);

            return true;
        } catch (err) {
            console.error('[ChunkedRecorder] Error starting recording:', err);
            if (this.onError) {
                this.onError(err);
            }
            throw err;
        }
    }

    /**
     * Start a new MediaRecorder for the next chunk
     * This ensures each chunk is a complete, valid WebM file
     */
    startNextChunk() {
        if (!this.stream || this.isStopping || this.isPaused) return;

        // Preflight codec support
        const codec = 'audio/webm;codecs=opus';
        const options = MediaRecorder.isTypeSupported(codec)
            ? { mimeType: codec, audioBitsPerSecond: 128000 }
            : { audioBitsPerSecond: 128000 };

        this.currentChunkData = [];

        try {
            this.mediaRecorder = new MediaRecorder(this.stream, options);
        } catch (err) {
            console.error('[ChunkedRecorder] Failed to create MediaRecorder:', err);
            if (this.onError) this.onError(err);
            return;
        }

        const chunkIndex = this.chunkIndex;

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.currentChunkData.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            // Create blob from collected data
            const blob = new Blob(this.currentChunkData, { type: 'audio/webm;codecs=opus' });

            // Skip tiny chunks (< 5KB) - these are usually empty final chunks
            const MIN_CHUNK_SIZE = 5 * 1024;
            if (blob.size < MIN_CHUNK_SIZE) {
                console.log(`[ChunkedRecorder] Skipping tiny chunk ${chunkIndex + 1}: ${(blob.size / 1024).toFixed(2)}KB (< 5KB)`);

                if (this.isStopping) {
                    this.recordingStopped = true;
                    this.tryFinalize();
                }
                return;
            }

            // Store blob for backup
            this.chunkBlobs.push(blob);

            // Optional callback for UI
            if (this.onChunkReady) {
                this.onChunkReady(blob, chunkIndex);
            }

            // Upload to Whisper
            this.processChunkFromStream(blob, chunkIndex);

            // If we're stopping, mark as stopped and try to finalize
            if (this.isStopping) {
                this.recordingStopped = true;
                this.tryFinalize();
            } else if (this.isPaused) {
                // Paused - don't start next chunk, wait for resume
                console.log('[ChunkedRecorder] Paused after chunk', chunkIndex + 1);
            } else {
                // Start next chunk
                this.chunkIndex += 1;
                this.startNextChunk();
            }
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('[ChunkedRecorder] MediaRecorder error:', event.error);
            if (this.onError) {
                this.onError(event.error);
            }
        };

        // Start recording this chunk
        this.mediaRecorder.start();
        console.log(`[ChunkedRecorder] Started chunk ${chunkIndex + 1}`);

        // Set timer to rotate to next chunk
        this.chunkTimer = setTimeout(() => {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording' && !this.isStopping) {
                // Stop current recorder to trigger onstop, which will start next chunk
                this.mediaRecorder.stop();
            }
        }, this.chunkDurationMs);
    }

    /**
     * Upload blob to Whisper API and get transcript
     * @param {Blob} blob - WebM blob to upload
     * @param {Object} options - Options object
     * @param {number} options.chunkIndex - Index of chunk (for logging)
     * @param {boolean} options.isTail - Whether this is a tail chunk
     * @param {string} options.previousContext - Previous context for continuity
     * @returns {Promise<string>} Transcript text
     */
    async uploadToWhisper(blob, { chunkIndex, isTail = false, previousContext = null } = {}) {
        const formData = new FormData();
        // Determine file extension based on blob type
        const extension = blob.type === 'audio/wav' ? 'wav' : 'webm';
        formData.append('audio', blob, `chunk_${chunkIndex || 'tail'}.${extension}`);
        // Always send previousContext if available (for tail chunks or continuation chunks)
        if (previousContext && (chunkIndex > 0 || isTail)) {
            formData.append('previousContext', previousContext);
        }

        const uploadStartTime = Date.now();
        const blobSizeKB = blob.size / 1024;
        const logPrefix = isTail ? '[ChunkedRecorder] Tail chunk' : `[ChunkedRecorder] Chunk ${chunkIndex + 1}`;
        const audioFormat = blob.type === 'audio/wav' ? 'WAV' : 'WebM';
        console.log(`${logPrefix} uploading to Whisper proxy: ${blobSizeKB.toFixed(2)}KB ${audioFormat}`);

        const response = await fetch(`${this.apiUrl}/api/whisper-proxy`, {
            method: 'POST',
            body: formData
        });

        const uploadTime = Date.now() - uploadStartTime;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error(`${logPrefix} upload failed after ${uploadTime}ms:`, errorData);
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const transcript = data.text || '';
        console.log(`${logPrefix} transcribed in ${uploadTime}ms: ${transcript.length} chars (${blobSizeKB.toFixed(2)}KB ${audioFormat})`);

        return transcript;
    }

    /**
     * Process chunk from stream: upload to Whisper and store transcript
     * @param {Blob} blob - WebM blob slice from MediaRecorder
     * @param {number} chunkIndex - Index of this chunk
     */
    async processChunkFromStream(blob, chunkIndex) {
        if (this.onProgress) {
            this.onProgress({
                chunkIndex: chunkIndex + 1,
                status: 'uploading',
                message: `Uploading chunk ${chunkIndex + 1} to Whisper...`
            });
        }

        this.uploadsInFlight += 1;

        try {
            const previousContext = this.getLastWords(20);

            const transcript = await this.uploadToWhisper(blob, {
                chunkIndex,
                isTail: false,
                previousContext
            });

            const cleanTranscript = (transcript || '').trim();

            // Make sure array is large enough
            if (!this.chunkTranscripts[chunkIndex]) {
                this.chunkTranscripts[chunkIndex] = '';
            }

            if (cleanTranscript.length > 0) {
                this.chunkTranscripts[chunkIndex] = cleanTranscript;

                if (this.onChunkTranscript) {
                    this.onChunkTranscript(cleanTranscript, chunkIndex);
                }

                if (this.onProgress) {
                    this.onProgress({
                        chunkIndex: chunkIndex + 1,
                        status: 'completed',
                        message: `Chunk ${chunkIndex + 1} transcribed`,
                        transcript: cleanTranscript
                    });
                }
            } else {
                console.warn(`[ChunkedRecorder] Chunk ${chunkIndex + 1} returned empty transcript`);
                this.chunkTranscripts[chunkIndex] = '';
            }
        } catch (err) {
            console.error(`[ChunkedRecorder] Error processing chunk ${chunkIndex + 1}:`, err);
            this.chunkTranscripts[chunkIndex] = '';

            if (this.onError) {
                this.onError(err, chunkIndex);
            }

            if (this.onProgress) {
                this.onProgress({
                    chunkIndex: chunkIndex + 1,
                    status: 'error',
                    message: `Chunk ${chunkIndex + 1} failed: ${err.message}`
                });
            }
        } finally {
            this.uploadsInFlight -= 1;
            this.tryFinalize();
        }
    }

    /**
     * Stop recording - stops current chunk and waits for uploads to complete
     */
    async stop() {
        if (!this.isRecording || !this.stream) {
            return null;
        }

        this.isRecording = false;
        this.isStopping = true;

        console.log('[ChunkedRecorder] stop() called');

        // Clear chunk rotation timer
        if (this.chunkTimer) {
            clearTimeout(this.chunkTimer);
            this.chunkTimer = null;
        }

        return new Promise((resolve, reject) => {
            this.finalizeResolve = resolve;
            this.finalizeReject = reject;

            try {
                if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                    // Stop current recorder - this will trigger onstop which handles finalization
                    this.mediaRecorder.stop();
                } else {
                    // If already inactive, just finalize
                    this.recordingStopped = true;
                    this.tryFinalize();
                }
            } catch (err) {
                console.error('[ChunkedRecorder] Error stopping recorder:', err);
                reject(err);
            }
        });
    }

    /**
     * Pause recording - stops current chunk, keeps stream alive
     */
    pause() {
        if (!this.isRecording || this.isPaused || this.isStopping) {
            return;
        }

        this.isPaused = true;
        console.log('[ChunkedRecorder] pause() called');

        // Clear chunk rotation timer
        if (this.chunkTimer) {
            clearTimeout(this.chunkTimer);
            this.chunkTimer = null;
        }

        // Stop current recorder - onstop will save the partial chunk but won't start new one
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
    }

    /**
     * Resume recording - starts a new chunk with existing stream
     */
    resume() {
        if (!this.isRecording || !this.isPaused || this.isStopping || !this.stream) {
            return;
        }

        this.isPaused = false;
        console.log('[ChunkedRecorder] resume() called');

        // Increment chunk index and start new chunk
        this.chunkIndex += 1;
        this.startNextChunk();
    }

    /**
     * Check if currently paused
     */
    getIsPaused() {
        return this.isPaused;
    }

    /**
     * Try to finalize - only succeeds if recording stopped AND all uploads complete
     */
    tryFinalize() {
        // Can only finalize if:
        // 1) Recording has been stopped, AND
        // 2) All Whisper uploads have completed
        if (!this.recordingStopped) return;
        if (this.uploadsInFlight > 0) {
            console.log(`[ChunkedRecorder] Waiting for ${this.uploadsInFlight} uploads to complete...`);
            return;
        }

        this.finalize();
    }

    /**
     * Finalize: merge all transcripts and resolve the stop promise
     */
    finalize() {
        console.log('[ChunkedRecorder] Finalizing:', this.chunkTranscripts.length, 'chunks transcribed');

        // Merge all chunk transcripts in order
        const finalTranscript = this.chunkTranscripts
            .filter(t => t && t.trim().length > 0)
            .join(' ')
            .trim();

        console.log('[ChunkedRecorder] Final merged transcript:', finalTranscript.length, 'chars');

        if (this.onFinalTranscript) {
            this.onFinalTranscript(finalTranscript, this.chunkTranscripts);
        }

        if (this.onProgress) {
            this.onProgress({
                status: 'complete',
                message: 'Recording complete',
                totalChunks: this.chunkTranscripts.length
            });
        }

        // Clean up tracks and stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        const resolve = this.finalizeResolve;
        const reject = this.finalizeReject;
        this.finalizeResolve = null;
        this.finalizeReject = null;

        // Resolve with the merged transcript
        if (resolve) {
            resolve(finalTranscript);
        }
    }

    /**
     * Get last N words from all transcripts for continuity
     */
    getLastWords(count = 20) {
        const allText = (this.chunkTranscripts || [])
            .filter(Boolean)
            .join(' ');

        const words = allText.trim().split(/\s+/);
        if (words.length === 0) return '';

        const lastWords = words.slice(-count);
        return lastWords.join(' ');
    }

    /**
     * Get current transcript (merged so far)
     */
    getCurrentTranscript() {
        return this.chunkTranscripts
            .filter(t => t && t.trim().length > 0)
            .join(' ')
            .trim();
    }

    /**
     * Get chunk count
     */
    getChunkCount() {
        return this.chunkTranscripts.length;
    }

    /**
     * Check if currently recording
     */
    getIsRecording() {
        return this.isRecording;
    }

    /**
     * Get final merged blob from all chunks
     * Returns null if no chunks recorded
     */
    getFinalBlob() {
        if (!this.chunkBlobs || this.chunkBlobs.length === 0) {
            return null;
        }
        // Merge all chunks into single blob
        return new Blob(this.chunkBlobs, { type: 'audio/webm;codecs=opus' });
    }
}

export default ChunkedRecorder;
