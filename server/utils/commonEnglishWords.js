module.exports = new Set([
    // Core pronouns
    "i", "you", "he", "she", "they", "we", "him", "her", "them", "us", "me", "my", "your", "our", "their",
    "mine", "yours", "ours", "theirs", "myself", "yourself", "ourselves", "himself", "herself", "themselves",

    // Basic verbs
    "is", "are", "was", "were", "be", "been", "being", "am", "do", "does", "did", "doing",
    "have", "has", "had", "having", "go", "goes", "went", "gone", "going",
    "see", "saw", "seen", "seeing", "look", "looks", "looked", "looking",
    "come", "comes", "came", "coming", "make", "makes", "made", "making",
    "get", "gets", "got", "getting", "take", "takes", "took", "taken", "taking",
    "give", "gives", "gave", "given", "giving", "tell", "tells", "told", "telling",
    "say", "says", "said", "saying", "use", "uses", "used", "using",
    "want", "wants", "wanted", "wanting", "need", "needs", "needed", "needing",
    "walk", "walks", "walked", "walking", "run", "runs", "ran", "running",
    "eat", "eats", "ate", "eating", "drink", "drinks", "drank", "drinking",
    "sit", "sits", "sat", "sitting", "stand", "stands", "standing",
    "start", "starts", "started", "starting", "stop", "stops", "stopped", "stopping",

    // Time words
    "today", "yesterday", "tomorrow", "now", "then", "later", "early", "late", "soon",
    "morning", "afternoon", "evening", "night", "midnight", "noon",

    // Basic adjectives
    "good", "bad", "great", "small", "big", "large", "tiny", "little", "tall", "short",
    "hot", "cold", "warm", "cool", "bright", "dark", "easy", "hard", "simple", "difficult",
    "happy", "sad", "angry", "tired", "hungry", "funny", "strange", "weird", "normal",
    "right", "left", "wrong", "correct", "fast", "slow", "quick", "early", "late",
    "fine", "okay", "ok", "perfect", "better", "best", "nice", "clean", "dirty",

    // Common nouns
    "dog", "cat", "pet", "owner", "person", "man", "woman", "boy", "girl", "child", "kid",
    "house", "home", "room", "car", "truck", "street", "road", "park", "place", "store",
    "food", "water", "treat", "bowl", "bed", "crate", "leash", "collar", "toy", "blanket",
    "hand", "arm", "leg", "head", "face", "ear", "eye", "nose", "mouth", "tail", "paw",
    "floor", "ceiling", "wall", "door", "window", "chair", "table", "desk",

    // Location & direction
    "here", "there", "inside", "outside", "up", "down", "forward", "back", "behind", "beside", "next", "near", "far",

    // Weather & environment
    "rain", "sun", "snow", "wind", "cloud", "storm", "weather", "hot", "cold", "warm", "cool",

    // Sensory words
    "light", "sound", "noise", "quiet", "loud", "soft", "feel", "touch", "taste", "smell", "hear",
    "bright", "dark", "clear", "blurry",

    // Speech fillers
    "uh", "um", "like", "yeah", "yep", "yes", "no", "maybe", "sure", "really", "actually", "basically", "literally",

    // High-frequency everyday words
    "everything", "nothing", "something", "anything", "everyone", "someone", "anyone", "nobody",
    "every", "each", "some", "any",
    "thing", "things", "stuff", "place", "area", "part", "piece", "lot", "lots",
    "times", "time", "day", "week", "month", "year",

    // Prepositions
    "in", "on", "at", "from", "to", "with", "without", "about", "for", "over", "under", "between", "among", "around",
    "before", "after", "during", "through", "across", "into", "out", "off", "near", "far",

    // Articles & conjunctions
    "the", "a", "an", "and", "or", "but", "if", "so", "because", "while", "though", "although",

    // Quantity & numbers (protect from med confusion)
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "many", "few", "more", "most", "less", "least", "couple", "pair", "several", "plenty",

    // Feelings & condition
    "hurt", "pain", "comfortable", "uncomfortable", "okay", "fine", "good", "bad", "better",
    "sick", "well", "healthy", "strong", "weak",

    // Owner/reporter phrases
    "reported", "noticed", "saw", "felt", "heard", "thought", "believed", "mentioned", "observed",

    // Common phrases Whisper confuses
    "right", "light", "night", "might", "tight", "fight", "bite", "white", "write",
    "done", "done", "fine", "mine", "line", "time", "kind", "side", "wide", "slide",
    "cold", "hold", "told", "sold", "fold", "bold", "gold",
    "plate", "late", "gate", "state", "eight", "wait",
    "weight", "great", "straight", "rate", "date", "mate",
    "coat", "goat", "float", "note", "boat", "quote",
    "call", "fall", "ball", "wall", "small", "tall", "hall",
    "feel", "heel", "real", "deal", "meal", "seal", "wheel",
    "bed", "red", "led", "said", "head", "bread", "dead", "spread",

    // High-risk ambiguous words we must protect
    "mass", "mess", "miss", "pass", "gas", "class", "glass", "grass",
    "mine", "line", "sign", "fine", "nine",
    "fur", "for", "four", "fore",
    "cell", "sell", "tell", "fell", "well", "shell",
    "date", "data", "later", "letter",
    "cola", "cold", "colon",
    "mite", "might", "mix", "milk", "silk",
    "air", "hare", "hair",
    "fair", "fare", "bear", "bare",
    "sent", "scent", "cent",
    "meat", "meet", "seat", "sheet",

    // Extra verbs that Whisper often confuses for medical words
    "move", "moves", "moving", "moved",
    "play", "plays", "played", "playing",
    "turn", "turns", "turned", "turning",
    "rest", "rests", "rested", "resting",
    "check", "checks", "checked", "checking",
    "watch", "watches", "watched", "watching",
    "cover", "covers", "covered", "covering",
    "keep", "keeps", "kept", "keeping",
    "open", "opens", "opened", "opening",
    "close", "closes", "closed", "closing",
    "hold", "holds", "held", "holding",
    "bring", "brings", "brought", "bringing",

    // Common client phrases
    "i think", "i saw", "i feel", "i noticed", "i believe", "i guess", "i thought",

    // Conversation glue
    "okay", "alright", "sure", "yeah", "nope", "mmhmm", "uhhuh", "wow", "oh", "hey", "hello", "hi", "bye"
]);


