// Bigram/trigram correction mappings for common misheard phrases
module.exports = {
    "heart seizure": "heart failure",
    "glargine behavior": "gagging behavior",
    "coffee fits": "coughing fits",

    // Whisper mishears "otitis" as "colitis" - colitis never takes externa/media/interna modifiers
    "colitis externa": "otitis externa",
    "colitis media": "otitis media",
    "colitis interna": "otitis interna"
};

