const generateSoapFromInput = async (input) => {
    if (!input || !String(input).trim()) {
        throw new Error('Input text is required');
    }

    const { Agent, Runner } = await import('@openai/agents');
    const runner = new Runner();

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
- Focus on TIMELINE and PROGRESSION only. Do NOT place facts here that belong in a more specific heading:
  - Medications/supplements → CURRENT_MEDICATION (not History)
  - Skin/coat/flea findings → SKIN_COAT (not History)
  - Diet/appetite info → DIET_APPETITE (not History)
  - V/D/C/S episodes → VDCS (not History)
  - Environmental exposures → RISK_FACTORS (not History)
  History should ONLY contain timeline/progression context that has no better home.

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
- Catch-all for CLINICALLY RELEVANT owner-reported information that does not fit ANY of the above categories.
- Before placing anything here, verify it is NOT a rephrased version of something already in another heading. If hearing decline is in HISTORY, do not restate it here as "reduced auditory responsiveness." If cognitive decline is in HISTORY, do not restate it here as "reduced responsiveness to environmental stimuli."
- Owner observations, behavioral changes, energy level, sleep changes, anxiety, stress, mobility concerns, urination/defecation details — ONLY if not already captured elsewhere.
- Exclude: pet personality/temperament during the visit, cohabiting pet behavior, casual conversation, vet educational explanations, vet warnings about side effects, breed commentary.
- This heading should be EMPTY most of the time. Only include truly unique leftover information.

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
- Every fact appears exactly ONCE across ALL SUBJECTIVE headings. No exceptions, no rephrasing.
- This means: if a medication is listed in CURRENT_MEDICATION, do NOT also mention it in HISTORY. If a skin finding is in SKIN_COAT, do NOT also describe it in HISTORY. If a flea treatment is in CURRENT_MEDICATION, do NOT also put it in SKIN_COAT. If vaccinations are in CURRENT_MEDICATION, do NOT mention them in HISTORY.
- Rephrasing the same fact differently still counts as duplication. "Glucosamine had been administered" and "Glucosamine had previously been administered for osteoarthritic management" are the SAME fact — pick ONE heading and put it there only.
- HISTORY is the LAST place to put something. Only use HISTORY for timeline/progression context that does not fit in any other specific heading.
- PLACEMENT RULE: When a fact could go in a specific heading (SKIN_COAT, CURRENT_MEDICATION, DIET_APPETITE, VDCS, RISK_FACTORS) OR in HISTORY, always choose the specific heading. HISTORY gets only what is left over.

GENERAL BEHAVIOR:
- This is NOT a conversation. Do not add any commentary, explanation, or reasoning.
- Do NOT summarize; list the specific statements.
- ABSOLUTELY DO NOT leave out ANY information from the transcript - capture EVERYTHING.
- Favor recall over compression: it is better to include too much than to omit anything.
- If something important is mentioned but unclear, capture it as said and mark it as unclear.
- Preserve clinically meaningful detail: duration, severity, frequency, progression, response to treatment.
- Capture nuanced details: specific doses mentioned, exact timelines ("two days ago", "within 20 minutes"), conditional instructions ("if she breaks out again"), titration guidance, owner-expressed concerns or hesitations, declined recommendations, cost discussions, and any qualifiers the doctor used ("up to", "as needed", "if not improving").
- If information is vague, keep it vague rather than inventing specifics.
- REMINDER: Every single extraction must use professional veterinary medical terminology.

FINAL CHECK (DO THIS BEFORE OUTPUTTING):
Go through every SUBJECTIVE heading you have written. For each bullet point, ask: does this same topic appear in ANY other SUBJECTIVE heading? If yes, DELETE it from the lower-priority heading. Specific rules:
- If a medication appears in CURRENT_MEDICATION, delete it from HISTORY.
- If a skin/coat finding appears in SKIN_COAT, delete it from HISTORY.
- If a detail about hearing, vision, cognition, or any symptom appears in HISTORY, delete any restatement or elaboration of it from ADDITIONAL_INFO.
- ADDITIONAL_INFO should contain ZERO items that are reworded versions of facts in other headings. When in doubt, delete it from ADDITIONAL_INFO.
- Two bullet points about the same underlying topic (e.g., "hearing had declined" and "reduced auditory responsiveness noted by family member") are the SAME fact — merge into one and keep in the highest-priority heading only.`,
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

ALL Subjective subheadings are extensions of the patient history — strictly past-tense, owner-reported, pre-visit information. No present-tense exam findings, no vet recommendations, no vet explanations, no treatments prescribed today, no future-tense statements. USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY.
BEFORE OUTPUTTING: Scan all Subjective subheadings. If the same fact appears in two or more subheadings (even if worded differently), keep it ONLY in the most specific subheading and delete it from the others. A fact about medication stays only in Current Medication. A fact about skin stays only in Skin & Coat. History should contain only timeline/context not covered elsewhere.

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

**Client Communication:**
Always include this line:
The client was informed of the benefits, potential adverse reactions and side effects of above medications.

Then, ONLY if the doctor dictated specific nuanced considerations, warnings, or notable discussion points, include those below. Examples of nuanced considerations worth including:
- Specific side effects the vet warned about (e.g., sedation at higher doses of diphenhydramine)
- Prognosis discussions with specific details
- Owner declined a recommended treatment or diagnostic
- Special administration instructions the vet emphasized
- Cost discussions
- Specific follow-up timing or conditions discussed

Do NOT re-list or re-state any medication already listed in the Treatment section. The blanket statement covers all medications in Treatment. Client Communication should only contain information that is NOT already in Treatment — nuanced discussion points, warnings, owner decisions, prognosis, etc.
If the doctor did not dictate any specific nuanced discussion points beyond the medications, just include the blanket medication statement and nothing else.

**Recommended Diagnostics:**
[Each recommended test on its own line, or "None recommended"]
USE PROFESSIONAL VETERINARY MEDICAL TERMINOLOGY ONLY - avoid common/layman language

**Follow-up:**
If the doctor dictated specific follow-up plans, recheck timing, or future steps, write those.
If nothing was dictated about follow-up, provide a brief suggested follow-up based on the case — keep it to 1 concise line appropriate for the diagnosis and treatment plan.

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
            throw new Error('No report generated');
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

    return { report, petName };
};

module.exports = { generateSoapFromInput };
