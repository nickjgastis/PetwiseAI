const fs = require('fs');
const path = require('path');
const {
    clinicalWhitelistWords,
    numericUnitWhitelist,
    frequencyWhitelist,
    spokenNumberWhitelist,
    numericPatterns
} = require('./vetWhitelist.js');
const vetBigrams = require('./vetBigrams.js');
const vetOverrides = require('./vetOverrides.js');
const vetDrugRoutes = require('./vetDrugRoutes.js');
const vetSpeciesBias = require('./vetSpeciesBias.js');
const commonEnglishWords = require('./commonEnglishWords.js');

// Fast mode global flag
let fastModeGlobal = false;

// Lexicon storage
let drugsLexicon = new Set();
let diseaseLexicon = new Set();
let allMedicalTerms = new Set();

// Phase 1: Optimized drug lexicon index by first letter
let drugsByLetter = {};

function buildDrugIndex() {
    drugsByLetter = {};
    for (const drug of drugsLexicon) {
        const first = drug[0];
        if (!drugsByLetter[first]) drugsByLetter[first] = [];
        drugsByLetter[first].push(drug);
    }
}

// Load lexicons from files
function loadLexicons() {
    try {
        const drugsPath = path.join(__dirname, '../lexicon', 'drugs.txt');
        const diseasesPath = path.join(__dirname, '../lexicon', 'diseaseTerms.txt');

        if (fs.existsSync(drugsPath)) {
            const drugsContent = fs.readFileSync(drugsPath, 'utf8');
            drugsLexicon = new Set(
                drugsContent
                    .split('\n')
                    .map(line => line.trim().toLowerCase())
                    .filter(line => line.length > 0)
            );
            console.log(`Loaded ${drugsLexicon.size} drug terms`);
        } else {
            console.warn('Drugs lexicon file not found');
        }

        if (fs.existsSync(diseasesPath)) {
            const diseasesContent = fs.readFileSync(diseasesPath, 'utf8');
            diseaseLexicon = new Set(
                diseasesContent
                    .split('\n')
                    .map(line => line.trim().toLowerCase())
                    .filter(line => line.length > 0)
            );
            console.log(`Loaded ${diseaseLexicon.size} disease terms`);
        } else {
            console.warn('Disease terms lexicon file not found');
        }

        // Combine all medical terms for domain checking
        allMedicalTerms = new Set([...drugsLexicon, ...diseaseLexicon]);

        // Phase 1: Build optimized drug index
        buildDrugIndex();
    } catch (err) {
        console.error('Error loading lexicons:', err.message);
    }
}

// Damerau-Levenshtein distance (allows transpositions)
function damerauLevenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,       // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );

            // Transposition (Damerau extension)
            if (i > 1 && j > 1 && str1[i - 1] === str2[j - 2] && str1[i - 2] === str2[j - 1]) {
                matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
            }
        }
    }

    return matrix[len1][len2];
}

// Check if word should be ignored
function shouldIgnoreWord(word) {
    // ONLY ignore protection for exact override keys
    if (vetOverrides[word.toLowerCase()]) {
        return false;
    }

    const lower = word.toLowerCase();

    // Digit protection - ignore words with digits
    if (/\d/.test(word)) return true;

    // mg/kg protection - ignore words with slashes
    if (word.includes("/")) return true;

    // Numeric unit whitelist
    if (numericUnitWhitelist.includes(lower)) return true;

    // Frequency whitelist
    if (frequencyWhitelist.includes(lower)) return true;

    // Spoken number whitelist
    if (spokenNumberWhitelist.includes(lower)) return true;

    // Clinical whitelist words
    if (clinicalWhitelistWords.includes(lower)) return true;

    // Numeric patterns
    if (numericPatterns.decimal.test(word)) return true;
    if (numericPatterns.whole.test(word)) return true;
    if (numericPatterns.numberUnit.test(word)) return true;
    if (numericPatterns.dosing.test(word)) return true;
    if (numericPatterns.volumePerKg.test(word)) return true;

    // Ignore very short words (likely not medical terms)
    if (word.length < 4) {
        return true;
    }

    return false;
}



// Calculate match quality score (higher is better)
function calculateMatchScore(word, term, distance) {
    let score = 0;

    // Prefer matches that start with the same letter
    if (word[0] === term[0]) {
        score += 10;
    }

    // Prefer matches with similar length
    const lengthDiff = Math.abs(word.length - term.length);
    score += (10 - lengthDiff);

    // Prefer matches with more character matches in same positions
    const minLen = Math.min(word.length, term.length);
    let positionMatches = 0;
    for (let i = 0; i < minLen; i++) {
        if (word[i] === term[i]) {
            positionMatches++;
        }
    }
    score += positionMatches * 2;

    // Lower distance is better (subtract distance from score)
    score -= distance * 5;

    return score;
}

// Find best match in lexicon
function findBestMatch(word, lexicon, maxDistance = 3, species = "canine") {
    const lower = word.toLowerCase();
    let bestMatch = null;
    let bestDistance = Infinity;
    let bestScore = -Infinity;

    // Phase 1: Use optimized drug index if lexicon is drugsLexicon
    let candidates = [];
    if (lexicon === drugsLexicon && lower.length > 0) {
        const first = lower[0];
        candidates = [
            ...(drugsByLetter[first] || []),
            ...(drugsByLetter[String.fromCharCode(first.charCodeAt(0) - 1)] || []),
            ...(drugsByLetter[String.fromCharCode(first.charCodeAt(0) + 1)] || [])
        ];
        // Fallback to full lexicon if no candidates found
        if (candidates.length === 0) {
            candidates = Array.from(lexicon);
        }
    } else {
        candidates = Array.from(lexicon);
    }

    for (const term of candidates) {
        const distance = damerauLevenshteinDistance(lower, term);
        if (distance <= maxDistance) {
            let score = calculateMatchScore(lower, term, distance);

            // Phase 6: Species-aware correction bias
            if (lexicon === drugsLexicon && vetSpeciesBias[species]?.includes(term)) {
                score += 15;
            }

            // Prefer lower distance, or if same distance, prefer higher score
            if (distance < bestDistance || (distance === bestDistance && score > bestScore)) {
                bestDistance = distance;
                bestMatch = term;
                bestScore = score;
            }
        }
    }

    // Return null match if no valid match found (distance > maxDistance)
    if (bestDistance > maxDistance) {
        return { match: null, distance: Infinity };
    }

    return { match: bestMatch, distance: bestDistance };
}

// Helper function to check if a word is very close to any drug name
function isCloseToAnyDrug(word) {
    const lower = word.toLowerCase();
    let bestDist = Infinity;
    let bestDrug = null;

    for (const drug of drugsLexicon) {
        const dist = damerauLevenshteinDistance(lower, drug);
        if (dist < bestDist) {
            bestDist = dist;
            bestDrug = drug;
        }
    }

    // Only consider VERY close matches
    if (bestDist <= 2) {
        return bestDrug;
    }

    return null;
}

// Phase 3: Check if word is guaranteed to be medical
function isMedicalWordGuaranteed(word) {
    const lower = word.toLowerCase();

    // must be >= 5 chars
    if (lower.length < 5) return false;

    // must match medical pattern OR appear in dictionary OR be close to a drug/disease
    const medicalPattern = /(itis|osis|emia|uria|oma|pathy|card|hep|derm|cyt|phage|neph|gastr|enter)/i;
    if (medicalPattern.test(lower)) return true;

    if (drugsLexicon.has(lower)) return true;
    if (diseaseLexicon.has(lower)) return true;

    return false;
}

// Safety gate for forced correction fallback
function isSafeForceCorrectCandidate(word) {
    const lower = word.toLowerCase();

    if (lower.length < 7) return false;               // must be long
    if (commonEnglishWords.has(lower)) return false;  // must NOT be English
    if (/\d/.test(lower)) return false;               // no numbers
    if (lower.includes("/")) return false;            // no mg/kg
    return true;
}

// Phase 3: Typo suspicion heuristics
function isHighlyCorrupted(word) {
    return (
        /(.)\1{2,}/.test(word) ||             // repeating letters (e.g., "riimadyl")
        /[aeiou]{3,}/i.test(word) ||         // too many vowels (e.g., "aeiou")
        /[bcdfghjklmnpqrstvwxyz]{4,}/i.test(word) // too many consonants (e.g., "bcdfg")
    );
}

// Correct a single word
function correctWord(word, prevTokenIsNumber = false, nextTokenIsUnit = false, species = "canine", transcript = "", wordIndex = -1, prevToken = null, nextToken = null, contextString = "") {
    // Remove punctuation for matching, but preserve it
    const punctuationMatch = word.match(/^([^a-zA-Z]*)(.*?)([^a-zA-Z]*)$/);
    if (!punctuationMatch) return word;

    const [, leadingPunct, coreWord, trailingPunct] = punctuationMatch;

    // If no alphabetic characters, return as-is
    if (!coreWord || coreWord.length === 0) {
        return word;
    }

    // Hard protection for common speech verbs Whisper confuses
    const base = coreWord.toLowerCase();
    if (["start", "starts", "starting", "started"].includes(base)) {
        return word;
    }

    // HARD PROTECT: common English vocabulary should NEVER be corrected
    const lower = coreWord.toLowerCase();
    if (commonEnglishWords.has(lower)) {
        return word;
    }

    // Check if should ignore
    // Override ignore rules if this "common" word is actually very close to a drug name
    if (shouldIgnoreWord(coreWord)) {
        const forcedDrug = isCloseToAnyDrug(coreWord);
        if (forcedDrug) {
            // Force correction to the drug
            const isCap = coreWord[0] === coreWord[0].toUpperCase();
            const corrected = forcedDrug;
            const finalCore = isCap
                ? corrected.charAt(0).toUpperCase() + corrected.slice(1)
                : corrected;
            console.log(`VetCorrector (forced drug correction): "${coreWord}" -> "${finalCore}"`);
            return leadingPunct + finalCore + trailingPunct;
        }
        // Otherwise truly ignore
        return word;
    }

    const lowerCore = coreWord.toLowerCase();

    // Phase 4: Check override dictionary first (supports contextual replacements)
    if (vetOverrides[lowerCore]) {
        const override = vetOverrides[lowerCore];

        // Handle both string mappings and object mappings
        let corrected;
        let requiresContext = false;

        if (typeof override === 'string') {
            // Simple string mapping
            corrected = override;
        } else if (typeof override === 'object' && override.corrected) {
            // Object mapping with optional context requirement
            corrected = override.corrected;
            requiresContext = override.contextRequired === true;
        } else {
            // Invalid override format, skip
            corrected = null;
        }

        if (corrected) {
            // If the override requires context, verify it
            if (requiresContext) {
                // Use wider context string if available, otherwise fall back to immediate tokens
                const surrounding = contextString || `${prevToken || ""} ${nextToken || ""}`.toLowerCase();

                const medicalStartContext =
                    surrounding.includes("we will") ||
                    surrounding.includes("will start") ||
                    surrounding.includes("start the") ||
                    surrounding.includes("the patient on");

                if (!medicalStartContext) {
                    // Do not override here - context doesn't match
                    // Fall through to normal correction logic
                } else {
                    // Context matches, apply override
                    const isCapitalized = coreWord[0] === coreWord[0].toUpperCase();
                    const finalCore = isCapitalized
                        ? corrected.charAt(0).toUpperCase() + corrected.slice(1)
                        : corrected;
                    console.log(`VetCorrector (override): "${coreWord}" -> "${finalCore}"`);
                    // Phase 7: Log correction
                    logCorrection(coreWord, finalCore);
                    return leadingPunct + finalCore + trailingPunct;
                }
            } else {
                // No context required, apply override directly
                const isCapitalized = coreWord[0] === coreWord[0].toUpperCase();
                const finalCore = isCapitalized
                    ? corrected.charAt(0).toUpperCase() + corrected.slice(1)
                    : corrected;
                console.log(`VetCorrector (override): "${coreWord}" -> "${finalCore}"`);
                // Phase 7: Log correction
                logCorrection(coreWord, finalCore);
                return leadingPunct + finalCore + trailingPunct;
            }
        }
    }

    // Check if exact match exists (case-insensitive) - if already correct, just normalize capitalization
    if (drugsLexicon.has(lowerCore) || diseaseLexicon.has(lowerCore)) {
        // Return with original capitalization preserved (first letter capitalized if original was)
        const isCapitalized = coreWord[0] === coreWord[0].toUpperCase();
        const corrected = lowerCore;
        const finalCore = isCapitalized
            ? corrected.charAt(0).toUpperCase() + corrected.slice(1)
            : corrected;
        return leadingPunct + finalCore + trailingPunct;
    }

    // HARD BLOCK: never turn common English into medical
    if (commonEnglishWords.has(lowerCore)) {
        return leadingPunct + coreWord + trailingPunct;
    }

    // SAFETY GATE: Check if this is a safe candidate for forced correction BEFORE blocking
    // This allows words like "rimydal" to be corrected even if they don't match medical patterns
    if (isSafeForceCorrectCandidate(coreWord)) {
        const drugMatch = findBestMatch(coreWord, drugsLexicon, 2, species);
        if (drugMatch.match && drugMatch.distance <= 2) {
            const isCapitalized = coreWord[0] === coreWord[0].toUpperCase();
            const finalCore = isCapitalized
                ? drugMatch.match.charAt(0).toUpperCase() + drugMatch.match.slice(1)
                : drugMatch.match;
            console.log(`VetCorrector (forced correction): "${coreWord}" -> "${finalCore}"`);
            logCorrection(coreWord, finalCore);
            return leadingPunct + finalCore + trailingPunct;
        }
    }

    // HARD BLOCK: skip any word not likely medical
    if (!isMedicalWordGuaranteed(coreWord)) {
        return word;
    }

    // Phase 3: Check if word is highly corrupted - allow more aggressive correction
    let maxDistance = 3;
    if (isHighlyCorrupted(coreWord)) {
        maxDistance = 4; // allow more flexibility for corrupted words
    }

    // STRICT RULES: Only correct words that are clearly medical terms
    // 1. Must be 5+ characters (to avoid matching common short words)
    // 2. OR must be 4+ characters AND contain medical prefixes/suffixes
    const medicalPattern = /(anti|pre|post|sub|super|hyper|hypo|poly|mono|di|tri|quad|multi|uni|bi|hem|hep|card|pulm|gastr|enter|hepat|neph|ren|derm|cut|ost|arth|neur|psych|path|logy|itis|osis|emia|uria|oma|itis|cyte|phage|philia|phobia|plasty|scopy|tomy|ectomy|stomy)/i;
    const hasMedicalPattern = medicalPattern.test(coreWord);
    const isLongWord = coreWord.length >= 8;
    const isMediumWordWithPattern = coreWord.length >= 4 && hasMedicalPattern;
    const isLikelyMedical = hasMedicalPattern || isLongWord || isMediumWordWithPattern;

    // Only proceed if word meets medical term criteria
    if (coreWord.length < 5 && !isMediumWordWithPattern && !isLongWord) {
        return word; // Don't correct short words without medical patterns
    }

    // Try drugs first (highest priority)
    // Allow distance 3 for drugs, but only for words 5+ chars (to avoid matching common short words)
    const drugMatch = findBestMatch(coreWord, drugsLexicon, maxDistance, species);
    if (drugMatch.match) {
        const distance = drugMatch.distance;
        const corrected = drugMatch.match;

        // Adjacency safety: if word looks like it's part of a dosage pattern, only correct if it's actually a known drug
        // Check if word contains numbers or is a unit - if so, be more conservative
        const looksLikeDosage = /\d/.test(coreWord) || numericUnitWhitelist.includes(lowerCore);
        if (looksLikeDosage && !drugsLexicon.has(corrected)) {
            // Don't correct dosage-like words unless the match is definitely a drug
            return word;
        }

        // Phase 5: Dose route validation (optional)
        if (corrected && vetDrugRoutes[corrected] && transcript && wordIndex >= 0) {
            const lowerTranscript = transcript.toLowerCase();
            const start = Math.max(0, wordIndex - 20);
            const end = Math.min(transcript.length, wordIndex + 20);
            const near = lowerTranscript.slice(start, end);
            const allowedRoutes = vetDrugRoutes[corrected];

            // Check for route mentions
            if (near.includes("oral") && !allowedRoutes.includes("po")) {
                return word; // reject correction - route mismatch
            }
            if (near.includes("subcutaneous") && !allowedRoutes.includes("sq")) {
                return word; // reject correction - route mismatch
            }
        }

        // Distance ≤ 1: correct aggressively (very confident)
        if (distance <= 1) {
            const isCapitalized = coreWord[0] === coreWord[0].toUpperCase();
            const finalCore = isCapitalized
                ? corrected.charAt(0).toUpperCase() + corrected.slice(1)
                : corrected;
            console.log(`VetCorrector: "${coreWord}" -> "${finalCore}" (distance: ${distance})`);
            // Phase 7: Log correction
            logCorrection(coreWord, finalCore);
            return leadingPunct + finalCore + trailingPunct;
        }

        // Distance = 2: only correct if word is 5+ chars or medical-sounding
        if (distance === 2 && (coreWord.length >= 5 || isLikelyMedical)) {
            const isCapitalized = coreWord[0] === coreWord[0].toUpperCase();
            const finalCore = isCapitalized
                ? corrected.charAt(0).toUpperCase() + corrected.slice(1)
                : corrected;
            console.log(`VetCorrector: "${coreWord}" -> "${finalCore}" (distance: ${distance})`);
            // Phase 7: Log correction
            logCorrection(coreWord, finalCore);
            return leadingPunct + finalCore + trailingPunct;
        }

        // Distance = 3: only correct if word is 5+ chars (to avoid matching common words)
        if (distance === 3 && coreWord.length >= 5) {
            const isCapitalized = coreWord[0] === coreWord[0].toUpperCase();
            const finalCore = isCapitalized
                ? corrected.charAt(0).toUpperCase() + corrected.slice(1)
                : corrected;
            console.log(`VetCorrector: "${coreWord}" -> "${finalCore}" (distance: ${distance})`);
            // Phase 7: Log correction
            logCorrection(coreWord, finalCore);
            return leadingPunct + finalCore + trailingPunct;
        }

        // Distance = 4: only for highly corrupted words
        if (distance === 4 && isHighlyCorrupted(coreWord) && coreWord.length >= 5) {
            const isCapitalized = coreWord[0] === coreWord[0].toUpperCase();
            const finalCore = isCapitalized
                ? corrected.charAt(0).toUpperCase() + corrected.slice(1)
                : corrected;
            console.log(`VetCorrector: "${coreWord}" -> "${finalCore}" (distance: ${distance}, corrupted)`);
            // Phase 7: Log correction
            logCorrection(coreWord, finalCore);
            return leadingPunct + finalCore + trailingPunct;
        }
    }

    // Try diseases (only for words 5+ chars or medical-sounding)
    if (coreWord.length >= 5 || isLikelyMedical) {
        const diseaseMatch = findBestMatch(coreWord, diseaseLexicon, maxDistance, species);
        if (diseaseMatch.match) {
            const distance = diseaseMatch.distance;

            // Distance ≤ 1: correct aggressively
            if (distance <= 1) {
                const isCapitalized = coreWord[0] === coreWord[0].toUpperCase();
                const corrected = diseaseMatch.match;
                const finalCore = isCapitalized
                    ? corrected.charAt(0).toUpperCase() + corrected.slice(1)
                    : corrected;
                console.log(`VetCorrector: "${coreWord}" -> "${finalCore}" (distance: ${distance})`);
                // Phase 7: Log correction
                logCorrection(coreWord, finalCore);
                return leadingPunct + finalCore + trailingPunct;
            }

            // Distance = 2: only correct if word is 5+ chars or medical-sounding
            if (distance === 2 && (coreWord.length >= 5 || isLikelyMedical)) {
                const isCapitalized = coreWord[0] === coreWord[0].toUpperCase();
                const corrected = diseaseMatch.match;
                const finalCore = isCapitalized
                    ? corrected.charAt(0).toUpperCase() + corrected.slice(1)
                    : corrected;
                console.log(`VetCorrector: "${coreWord}" -> "${finalCore}" (distance: ${distance})`);
                // Phase 7: Log correction
                logCorrection(coreWord, finalCore);
                return leadingPunct + finalCore + trailingPunct;
            }

            // Distance = 3: only correct if word is 5+ chars (to avoid matching common words)
            if (distance === 3 && coreWord.length >= 5) {
                const isCapitalized = coreWord[0] === coreWord[0].toUpperCase();
                const corrected = diseaseMatch.match;
                const finalCore = isCapitalized
                    ? corrected.charAt(0).toUpperCase() + corrected.slice(1)
                    : corrected;
                console.log(`VetCorrector: "${coreWord}" -> "${finalCore}" (distance: ${distance})`);
                // Phase 7: Log correction
                logCorrection(coreWord, finalCore);
                return leadingPunct + finalCore + trailingPunct;
            }
        }
    }

    // No correction found
    return word;
}

// Phase 7: Logging function
function logCorrection(original, corrected) {
    try {
        const logPath = path.join(__dirname, 'vetCorrector.log');
        const logEntry = `${new Date().toISOString()} | ${original} -> ${corrected}\n`;
        fs.appendFileSync(logPath, logEntry);
    } catch (err) {
        // Silently fail if logging fails
    }
}

// Phase 2: Bigram/trigram correction
function correctBigrams(words) {
    let output = [...words];

    for (let i = 0; i < output.length - 1; i++) {
        // Skip whitespace tokens
        if (/^\s+$/.test(output[i])) {
            continue;
        }

        // Find next non-whitespace token
        let j = i + 1;
        while (j < output.length && /^\s+$/.test(output[j])) {
            j++;
        }

        if (j >= output.length) {
            break; // No more words
        }

        const word1 = output[i].trim();
        const word2 = output[j].trim();

        // Skip if either word is empty
        if (!word1 || !word2) {
            continue;
        }

        const bigram = word1 + " " + word2;
        const lower = bigram.toLowerCase();

        if (vetBigrams[lower]) {
            const replacement = vetBigrams[lower].split(" ");
            // Preserve original formatting (capitalization, punctuation)
            const isCap1 = word1[0] === word1[0].toUpperCase();
            const isCap2 = word2[0] === word2[0].toUpperCase();
            const newWord1 = isCap1 ? replacement[0].charAt(0).toUpperCase() + replacement[0].slice(1) : replacement[0];
            const newWord2 = isCap2 ? replacement[1].charAt(0).toUpperCase() + replacement[1].slice(1) : replacement[1];

            // Extract punctuation from original words
            const punctMatch1 = output[i].match(/^([^a-zA-Z]*)(.*?)([^a-zA-Z]*)$/);
            const punctMatch2 = output[j].match(/^([^a-zA-Z]*)(.*?)([^a-zA-Z]*)$/);

            if (punctMatch1 && punctMatch2) {
                output[i] = punctMatch1[1] + newWord1 + punctMatch1[3];
                output[j] = punctMatch2[1] + newWord2 + punctMatch2[3];
            } else {
                output[i] = newWord1;
                output[j] = newWord2;
            }

            console.log(`VetCorrector (bigram): "${bigram}" -> "${vetBigrams[lower]}"`);
            i = j; // Skip ahead to avoid double-processing
        }
    }

    return output;
}

// Correct entire transcript
function correctTranscript(transcript, species = "canine") {
    if (!transcript || typeof transcript !== 'string') {
        return transcript;
    }

    // Benchmark logging
    console.time("VetCorrector");

    // Log original transcript before corrections
    console.log('VetCorrector input transcript:', transcript);

    // Phase 1: Fast Mode detection
    let fastMode = false;
    const wordCount = transcript.split(/\s+/).length;
    if (wordCount > 600 || transcript.length > 4000) {
        fastMode = true;
        console.log("VetCorrector running in FAST MODE");
    }
    fastModeGlobal = fastMode;

    // Split into words while preserving whitespace
    let words = transcript.match(/\S+|\s+/g) || [];

    // Phase 2: Apply bigram/trigram corrections first (BEFORE fast mode)
    words = correctBigrams(words);

    const corrections = [];
    let changed = false;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];

        // Skip whitespace
        if (/^\s+$/.test(word)) {
            corrections.push(word);
            continue;
        }

        // Adjacency safety: check if previous token is a number and next token is a unit
        // Skip whitespace when finding previous/next tokens
        let prevToken = null;
        for (let j = i - 1; j >= 0; j--) {
            const token = words[j].trim();
            if (token && !/^\s+$/.test(words[j])) {
                prevToken = token;
                break;
            }
        }

        let nextToken = null;
        for (let j = i + 1; j < words.length; j++) {
            const token = words[j].trim();
            if (token && !/^\s+$/.test(words[j])) {
                nextToken = token;
                break;
            }
        }

        const prevTokenIsNumber = prevToken && /^\d+(\.\d+)?$/.test(prevToken);
        const nextTokenIsUnit = nextToken && numericUnitWhitelist.includes(nextToken.toLowerCase());

        // Also check if we're in a "number unit word" pattern (e.g., "5 mg something")
        // Look back to find if there's a number-unit pattern before this word
        let foundNumber = null;
        let foundUnit = null;
        for (let j = i - 1; j >= 0; j--) {
            const token = words[j].trim();
            if (token && !/^\s+$/.test(words[j])) {
                if (!foundUnit && numericUnitWhitelist.includes(token.toLowerCase())) {
                    foundUnit = token;
                } else if (foundUnit && !foundNumber && /^\d+(\.\d+)?$/.test(token)) {
                    foundNumber = token;
                    break;
                }
            }
        }
        const isInNumberUnitPattern = (prevTokenIsNumber && nextTokenIsUnit) || (foundNumber && foundUnit);

        // Build wider context for contextual overrides (check 5 tokens before and after)
        let contextTokens = [];
        for (let j = Math.max(0, i - 5); j < Math.min(words.length, i + 6); j++) {
            const token = words[j].trim();
            if (token && !/^\s+$/.test(words[j])) {
                contextTokens.push(token.toLowerCase());
            }
        }
        const contextString = contextTokens.join(' ');

        // Get the corrected word (pass species, transcript context, and actual tokens for context checking)
        let corrected = correctWord(word, prevTokenIsNumber, nextTokenIsUnit, species, transcript, i, prevToken, nextToken, contextString);

        // Adjacency safety rule: if prevTokenIsNumber && nextTokenIsUnit, only correct if the suggested match is a known drug
        if (isInNumberUnitPattern && corrected !== word) {
            // Extract the core word from the corrected version to check if it's a drug
            const correctedMatch = corrected.match(/^([^a-zA-Z]*)(.*?)([^a-zA-Z]*)$/);
            if (correctedMatch) {
                const correctedCore = correctedMatch[2].toLowerCase();
                if (!drugsLexicon.has(correctedCore)) {
                    // Not a known drug, don't correct
                    corrected = word;
                }
            }
        }

        if (corrected !== word) {
            changed = true;
        }
        corrections.push(corrected);
    }

    const result = corrections.join('');

    if (changed) {
        console.log('VetCorrector applied corrections');
    }

    // Log final corrected transcript
    console.log('VetCorrector final transcript:', result);

    return result;
}

// Initialize lexicons on module load
loadLexicons();

module.exports = {
    correctTranscript,
    correctWord,
    loadLexicons
};

