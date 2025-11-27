// Override correction dictionary for high-risk, commonly misheard veterinary drugs
// These apply BEFORE fuzzy matching to prevent dangerous or repeated errors

module.exports = {
    // Ondansetron
    "ondansitron": "ondansetron",
    "ondansatron": "ondansetron",
    "ondasetron": "ondansetron",

    // Maropitant / Cerenia
    "meripitant": "maropitant",
    "cerinia": "cerenia",
    "serenia": "cerenia",
    "syrenia": "cerenia",

    // Rimadyl (very high risk)
    "rymadyll": "rimadyl",
    "limadol": "rimadyl",
    "rumadol": "rimadyl",
    "rymadel": "rimadyl",

    // Gabapentin
    "gabapentine": "gabapentin",
    "gabapendant": "gabapentin",
    "gabapenin": "gabapentin",

    // Amlodipine
    "amlodapine": "amlodipine",
    "amloadipine": "amlodipine",

    // Metronidazole
    "metradazole": "metronidazole",
    "metronitazole": "metronidazole",

    // Methocarbamol
    "methocarbonol": "methocarbamol",
    "metacarbamol": "methocarbamol",

    // Furosemide
    "furosemade": "furosemide",

    // Cephalexin
    "cephalaxin": "cephalexin",
    "cephalexan": "cephalexin",

    // Benadryl (owners say it a lot)
    "benedryl": "diphenhydramine",

    // Apoquel (high-risk Whisper confusion)
    "apoquil": "apoquel",
    "apoquill": "apoquel",
    "apoquail": "apoquel",
    "appoquil": "apoquel",

    // Clavamox
    "clavimox": "clavamox",
    "clavibox": "clavamox",
    "clamimox": "clavamox",

    // Rimadyl additional variants
    "ronadol": "rimadyl",
    "ranadol": "rimadyl",
    "ranadyl": "rimadyl",
    "rymadole": "rimadyl",
    "rimadole": "rimadyl",

    // Hydroxyzine (prevent whisper variants)
    "hydroxazine": "hydroxyzine",
    "hydroxyyzine": "hydroxyzine",

    // Gabapentin additional variants
    "gabapentine": "gabapentin",
    "gabapantine": "gabapentin",

    // Carprofen
    "carpofen": "carprofen",
    "carprofine": "carprofen",

    // "sirs" → "start" contextual override
    "sirs": {
        corrected: "start",
        contextRequired: true
    }
};
