// Clinical whitelist words - legitimate veterinary/anatomical terms that should never be corrected
const clinicalWhitelistWords = [
    "cranial", "caudal", "dorsal", "ventral", "lateral", "medial", "proximal", "distal",
    "palpation", "palpate", "palpated", "auscultation", "auscultate", "murmur", "thoracic",
    "lumbar", "stifle", "humerus", "femur", "tarsus", "carpus", "abdomen", "abdominal",
    "gag", "gagging", "gagged", "gaggy", "seizure", "seizures", "failure", "gurgling",
    "wheezing", "crackles", "stridor", "collapse", "collapsing", "tremor", "tremors",
    "ataxia", "ataxic", "paresis", "paralysis", "paralyzed", "weakness", "hyporexia",
    "anorexia", "inappetent", "inappetence", "cyanosis", "dyspnea", "tachypnea",
    "bradycardia", "tachycardia", "arrhythmia", "syncope", "hiding", "guarding", "panting",
    "shaking", "limping", "favoring", "reluctant", "stumbling", "circling", "pressing",
    "head", "headpressing", "proprioception", "reflex", "reflexes", "mentation",
    "mentationally", "posture", "postural", "gait", "gaiting", "painful", "nonpainful",
    "responsive", "unresponsive", "ambulatory", "nonambulatory", "hydration", "perfused",
    "perfusion", "radiograph", "radiographs", "ultrasound", "echocardiogram", "endoscopy",
    "biopsy", "cytology", "histology", "MRI", "CT", "temperature", "weight", "respiratory",
    "heart", "rate", "pulse", "CRT", "mucous", "membranes", "onset", "onsets", "chronic", "acute",
    "start", "starting", "started", "starts",
    "drawer", "drawers", "drawer test", "cranial drawer", "caudal drawer",
    "percussion", "percuss", "percussed", "percussing",
    "menace", "menace response", "pupillary", "pupil", "pupils",
    "patellar", "patella", "schirmer", "schirmer test", "tonometry", "tonometer",
    "radiography", "histopathology", "echocardiography", "electrocardiogram", "ecg", "ekg",
    "laparoscopy", "laparoscope", "arthroscopy", "arthroscope", "bronchoscopy", "bronchoscope"
];

// Numeric unit whitelist - units and measurements that should never be corrected
const numericUnitWhitelist = [
    "mg", "kg", "ml", "l", "mcg", "g", "%", "°", "bpm", "lbs", "oz", "mm", "cm",
    "mg/kg", "ml/kg", "mg per kg", "ml per kg", "kg/day", "mg/day", "kg/hr",
    "hr", "hrs", "sec", "secs", "min", "mins", "mmHg", "iu", "units", "lb", "ft", "in"
];

// Frequency whitelist - dosing frequencies that should never be corrected
const frequencyWhitelist = [
    "SID", "BID", "TID", "QID", "q12h", "q24h", "q8h", "q6h", "q4h",
    "every", "once", "twice", "three", "four", "daily", "weekly", "monthly",
    "as-needed", "PRN", "times"
];

// Spoken number whitelist - numbers spoken as words that should never be corrected
const spokenNumberWhitelist = [
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "quarter", "half", "third", "three by four", "two by three",
    "one point two"
];

// Numeric patterns for matching numbers and dosages
const numericPatterns = {
    decimal: /^\d+\.\d+$/,
    whole: /^\d+$/,
    numberUnit: /^\d+(\.\d+)?\s?(mg|kg|ml|mcg|g|lbs|oz)$/,
    dosing: /^\d+(\.\d+)?\s?(mg|mcg|g)\/kg$/,
    volumePerKg: /^\d+(\.\d+)?\s?(ml|l)\/kg$/
};

module.exports = {
    clinicalWhitelistWords,
    numericUnitWhitelist,
    frequencyWhitelist,
    spokenNumberWhitelist,
    numericPatterns
};

