import React from 'react';
import axios from 'axios';

const API_URL = process.env.NODE_ENV === 'production'
      ? 'https://api.petwise.vet'
      : 'http://localhost:3001';

const GenerateReport = async (inputs, enabledFields) => {
      // console.log('enabledFields received:', enabledFields);

      const getEnabledContent = (fieldName, content) => {
            // console.log('Checking field:', fieldName, 'enabled:', enabledFields[fieldName], 'content:', content);
            const toggleableFields = [
                  'patientInformation',
                  'doctor',
                  'examDate',
                  'presentingComplaint',
                  'history',
                  'physicalExamFindings',
                  'diagnosticTests',
                  'assessment',
                  'diagnosis',
                  'differentialDiagnosis',
                  'treatment',
                  'monitoring',
                  'naturopathicMedicine',
                  'clientCommunications',
                  'planFollowUp',
                  'patientVisitSummary',
                  'notes'
            ];

            if (toggleableFields.includes(fieldName) && (!enabledFields || !enabledFields[fieldName])) {
                  return null;
            }
            return content;
      };

      const hasUserInput = (content) => {
            return content && content.trim() && content.trim() !== '';
      };

      const safeSplit = (text, delimiter) => {
            return text ? text.trim().split(delimiter) : [];
      };

      const prompt = `
You are a highly experienced veterinarian. CRITICAL INSTRUCTION: If a user provides input for any field, use ONLY that input and expand it professionally. DO NOT generate additional content beyond what the user provided. If a field is empty, then generate appropriate content. If a field has user input, respect it completely and only expand with professional details.

Based on the following input details, create a comprehensive veterinary medical record that adheres to the exact format and structure provided below. IMPORTANT: Follow all formatting rules precisely.

CRITICAL AUDIENCE DISTINCTION:
- ALL sections from Patient Information through Follow-Up are MEDICAL RECORDS for veterinary staff - use medical terminology, past tense, and clinical language
- ONLY Patient Visit Summary and Notes sections are CLIENT-FACING - use simple, caring language for pet owners
- Do NOT use client-friendly language in the medical record sections

FORMATTING RULES:
CRITICAL FORMATTING RULES (MUST FOLLOW EXACTLY):
0. MOST IMPORTANT: Within each section, each line should end with two spaces for line breaks, but there should be NO blank lines between content lines. Lines should appear on separate lines but be consecutive without extra spacing. Only add blank lines between major sections, never within a section's content.
1. ALL section headers must be wrapped in ** including the colon, exactly like this:
**Veterinary Medical Record:** 
   **Patient Information:**
   **Staff:**
   **Presenting Complaint:**
   **History:**
   **Physical Exam Findings:**
   **Diagnostic Tests:**
   **Assessment:**
   **Diagnosis:**
   *PLAN**
   **Treatment:**
   **Monitoring:**
   **Naturopathic Medicine:**
   **Client Communications:**
   **Follow-Up:**
   **Patient Visit Summary:**
   **Notes:**
2. End each line with two spaces for line breaks
3. Add an empty line between sections
4. Bold all diagnosis numbers (e.g., **1. Pancreatitis**)
5. Bold all treatment condition headers (e.g., **Pancreatitis:**)
6. Never use dashes, bullet points, or ### symbols
7. Each line should end with two spaces
8. Use two newlines between major sections
9. For lists (like in Treatment), each item should be on its own line
10. Maintain exact spacing and formatting as shown in the template
11. CRITICAL: Within each section, lines should be consecutive with NO blank lines between them unless specifically breaking up subsections that need separation. Do not add extra line spacing within a section's content.

INCLUDE ONLY THE FOLLOWING SECTIONS:
${getEnabledContent('patientInformation', enabledFields.patientInformation) ? '**Patient Information:**' : ''}
${(getEnabledContent('doctor', enabledFields.doctor) || getEnabledContent('examDate', enabledFields.examDate)) ? '**Staff:**' : ''}
${getEnabledContent('presentingComplaint', enabledFields.presentingComplaint) ? '**Presenting Complaint:**' : ''}
${getEnabledContent('history', enabledFields.history) ? '**History:**' : ''}
${getEnabledContent('physicalExamFindings', enabledFields.physicalExamFindings) ? '**Physical Exam Findings:**' : ''}
${getEnabledContent('diagnosticTests', enabledFields.diagnosticTests) ? '**Diagnostic Tests:**' : ''}
${getEnabledContent('assessment', enabledFields.assessment) ? '**Assessment:**' : ''}
${getEnabledContent('diagnosis', enabledFields.diagnosis) ? '**Diagnosis:**' : ''}
${getEnabledContent('treatment', enabledFields.treatment) ? '**Treatment:**' : ''}
${getEnabledContent('monitoring', enabledFields.monitoring) ? '**Monitoring:**' : ''}
${getEnabledContent('naturopathicMedicine', enabledFields.naturopathicMedicine) ? '**Naturopathic Medicine:**' : ''}
${getEnabledContent('clientCommunications', enabledFields.clientCommunications) ? '**Client Communications:**' : ''}
${getEnabledContent('planFollowUp', enabledFields.planFollowUp) ? '**Follow-Up:**' : ''}
${getEnabledContent('patientVisitSummary', enabledFields.patientVisitSummary) ? '**Patient Visit Summary:**' : ''}
${getEnabledContent('notes', enabledFields.notes) ? '**Notes:**' : ''}

EXAMPLE FORMAT:
**Patient Information:**  
Patient: John Doe  
Species: Canine  
Breed: Golden Retriever  

**Staff:**  
Doctor: Dr. Smith  
Exam Date: January 15, 2024  

CRITICAL SPACING RULE: Notice in the example above that within each section (Patient Information, Staff), each line ends with two spaces and appears on its own line, but there are NO blank lines between the content lines within each section. Lines are consecutive without extra spacing. Only blank lines appear between different sections. This same pattern MUST be followed throughout the entire report.

Where placeholders like "Provide here" are used, do not generate or fill in data. Use input data as provided for medical content. For missing or incomplete sections, use best practices and standard veterinary protocols to fill in gaps with relevant details. If evidence for specific sections such as Differential Diagnoses, Treatment, Assessment, Drug Interactions, or Naturopathic Treatment is not explicitly provided, infer based on the diagnosis and other input details.
 

${getEnabledContent('patientInformation', enabledFields.patientInformation) !== null ? `**Patient Information:**  
Patient: ${inputs.patientName ? inputs.patientName.split(' ').map(word => {
            if (word.toLowerCase() === 'ned') return 'Ned';
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }).join(' ') : "Provide here"}  
Species: ${inputs.species || "Provide here"}  
Breed: ${inputs.breed || "Provide here"}  
Sex: ${inputs.sex || "Provide here"}  
Color/Markings: ${inputs.colorMarkings || "Provide here"}  
Weight: ${inputs.weight || "Provide here"} ${inputs.weightUnit || "lbs"}  
Age: ${inputs.age || "Provide here"}  
` : ''}

${(getEnabledContent('doctor', enabledFields.doctor) || getEnabledContent('examDate', enabledFields.examDate)) ? `**Staff:**  
${getEnabledContent('doctor', enabledFields.doctor) ? `Doctor: Dr. ${inputs.doctor?.replace(/^Dr\.\s*/, '') || "Provide here"}  ` : ''}
${getEnabledContent('examDate', inputs.examDate) ? `Exam Date: ${getEnabledContent('examDate', inputs.examDate) || "Provide here"}` : ''}  ` : ''}
  
${getEnabledContent('presentingComplaint', inputs.presentingComplaint) !== null ? `
**Presenting Complaint:**  
${getEnabledContent('presentingComplaint', inputs.presentingComplaint)
                        ? `Expand the following user input into complete professional presenting complaints with proper medical terminology. If the user input is brief (like "vomiting"), expand it with clinical details and context appropriate for a ${inputs.species}. Each complaint should be on its own line WITHOUT dashes or bullet points. If the user types "None" or "No Findings", say "No presenting complaints found".
  
  User Input: "${getEnabledContent('presentingComplaint', inputs.presentingComplaint)}"
  
  Expand with:
  - Proper medical terminology and spelling
  - Clinical context and duration if implied
  - Professional veterinary language
  - Each complaint on separate lines WITHOUT dashes`
                        : `Generate a concise list of presenting complaints based on the species, breed, and other provided inputs. Each issue should be on its own line WITHOUT dashes or bullet points.`}` : ''}
  
${getEnabledContent('history', inputs.history) !== null ? `
**History:**  
${hasUserInput(getEnabledContent('history', inputs.history))
                        ? `Expand the following user input into a complete professional medical history with proper terminology and chronological context. If the user provides brief notes (like "started 3 days ago"), expand with clinical details appropriate for a ${inputs.weight}${inputs.weightUnit} ${inputs.species}.
  
  User Input: "${getEnabledContent('history', inputs.history)}"
  
  Expand with:
  - Complete medical terminology and proper spelling
  - Chronological context and timeline details
  - Clinical relevance to the patient's condition
  - Professional veterinary language
  - Each historical point on separate lines WITHOUT dashes`
                        : `Generate a history based on presenting complaints and the typical background for this species or breed. Provide concise, single-line entries WITHOUT dashes or bullet points.`}` : ''}
  
${getEnabledContent('physicalExamFindings', inputs.physicalExamFindings) !== null ? `
**Physical Exam Findings:**  
Date: ${inputs.examDate ? inputs.examDate.split('-').map((part, i) => {
                              if (i === 1) return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(2000, part - 1));
                              if (i === 2) return parseInt(part);
                              return part;
                        }).reverse().join(' ') : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}  
${getEnabledContent('physicalExamFindings', inputs.physicalExamFindings) || 'Generate physical exam findings based on presenting complaints, diagnosis, and typical findings for this species or breed.'}` : ''}
${getEnabledContent('diagnosticTests', inputs.diagnosticTests) !== null ? `
**Diagnostic Tests:**  
${getEnabledContent('diagnosticTests', inputs.diagnosticTests)
                        ? `Expand the following user input into complete diagnostic test information with proper medical terminology and results. If the user provides brief test names (like "CBC"), expand with full details including reference ranges and clinical interpretation.
  
  User Input: "${getEnabledContent('diagnosticTests', inputs.diagnosticTests)}"
  
  Expand with:
  - Full test names with proper medical terminology
  - Reference ranges where applicable
  - Clinical interpretation of results
  - Proper capitalization and abbreviations
  - Each test result on separate lines`
                        : `Generate appropriate diagnostic tests based on the presenting complaint and physical exam findings and or diagnosis`}` : ''}
  
${getEnabledContent('assessment', inputs.assessment) !== null ? `
**Assessment:**  
${getEnabledContent('assessment', inputs.assessment)
                        ? `Expand the following user input into a complete clinical assessment with professional medical terminology. If the user provides brief notes (like "dehydrated"), expand with clinical details and supporting evidence appropriate for a ${inputs.weight}${inputs.weightUnit} ${inputs.species}.
  
  User Input: "${getEnabledContent('assessment', inputs.assessment)}"
  
  Expand with:
  - Complete clinical assessment with supporting evidence
  - Professional medical terminology and proper spelling
  - Clinical relevance and diagnostic reasoning
  - Integration with physical exam and diagnostic findings
  - Each assessment point on separate lines
  - Discussion of lab results if mentioned`
                        : `Generate an assessment based on diagnostic tests, presenting complaints, and physical exam findings. Provide concise, single-line observations. Discuss the lab results.`}` : ''}
  
${getEnabledContent('diagnosis', inputs.diagnosis) !== null ? `
**Diagnosis:**  
${hasUserInput(getEnabledContent('diagnosis', inputs.diagnosis))
                        ? `CRITICAL: You MUST use ONLY the user's diagnosis input. DO NOT generate new diagnoses. Parse and expand each diagnosis provided by the user.

User Diagnoses: "${getEnabledContent('diagnosis', inputs.diagnosis)}"
User Differentials (if provided): "${getEnabledContent('differentialDiagnosis', inputs.differentialDiagnosis)}"

INSTRUCTIONS:
- If user provides multiple diagnoses (separated by commas, semicolons, or new lines), list each one separately
- Do NOT number the diagnoses
- Expand each diagnosis with proper medical terminology
- Add relevant DDx under each diagnosis
- Use EXACTLY the diagnoses provided - do not add or remove any

REQUIRED FORMAT:
**Pancreatitis**
   DDx: Gastroenteritis, Intestinal obstruction, Hepatitis
**Uveitis**  
   DDx: Trauma, Infectious causes, Autoimmune diseases

EXAMPLES:
If user enters "proto dermatitis, ear infection":
**Protodermatitis**  
   DDx: Allergic Dermatitis, Contact Dermatitis, Atopic Dermatitis
**Otitis Externa**
   DDx: Bacterial Otitis, Fungal Otitis, Parasitic Otitis

FORMATTING RULES:
- Do NOT use numbers (1., 2., 3.)
- DO use ** around diagnosis names to make them bold
- List each diagnosis on its own line
- Indent DDx lines with spaces

DO NOT add additional diagnoses beyond what the user provided.`
                        : `Based on the presenting complaints, physical exam findings, and diagnostic test results, provide a list of diagnoses with relevant differential diagnoses. Do NOT use numbers but DO use ** around diagnosis names to make them bold:

**[Primary Diagnosis]**
   DDx: [3-4 relevant differential diagnoses]

**[Secondary Diagnosis]**
   DDx: [3-4 relevant differential diagnoses]

**[Additional Diagnosis if applicable]**
   DDx: [3-4 relevant differential diagnoses]`}` : ''}


${getEnabledContent('treatment', inputs.treatment) !== null ? `
**Treatment:**

${hasUserInput(getEnabledContent('treatment', inputs.treatment))
                        ? `CRITICAL: You MUST use ONLY the user's treatment input. DO NOT generate additional treatments or medications not mentioned by the user.

MANDATORY: Use EXACTLY these medications: "${getEnabledContent('treatment', inputs.treatment)}"

Take the user's medication(s) and expand ONLY those with complete dosing information for a ${inputs.weight}${inputs.weightUnit} ${inputs.species}, ${inputs.age}, ${inputs.sex}.

REQUIRED FORMAT (no dashes or bullet points):
[Condition Name]:
[User's Drug Name] [Dose] [Route] [Frequency] x [Duration]
[Monitoring instructions if needed]

EXAMPLE:
If user enters "cephalexin" you MUST output:
Bacterial Infection:
Cephalexin 250mg PO BID x 10-14 days
Monitor for GI upset, give with food if needed

DO NOT add other medications. DO NOT generate additional treatments. ONLY expand what the user provided.`
                        : `For each diagnosis, provide treatment options considering patient factors (${inputs.species}, ${inputs.sex}, ${inputs.breed}, ${inputs.weight}${inputs.weightUnit}):Format without dashes or bullet points:

[Diagnosis Name]:
Drug Name Dose Route Freq Duration
Drug Name Dose Route Freq Duration
Drug Name Dose Route Freq Duration
Supportive Care: list all measures on one line`}` : ''}
  
${getEnabledContent('monitoring', inputs.monitoring) !== null ? `
**Monitoring:**  
${getEnabledContent('monitoring', inputs.monitoring)
                        ? `Expand the following user monitoring input into complete monitoring instructions with specific parameters and timelines. If the user provides brief notes (like "check kidney values"), expand with specific monitoring protocols.

User Monitoring Input: "${getEnabledContent('monitoring', inputs.monitoring)}"

Expand with:
- Specific monitoring parameters and values to watch
- Timeline for monitoring (daily, weekly, etc.)
- Clinical signs to observe
- When to contact veterinarian
- Professional monitoring terminology`
                        : `Generate monitoring instructions based on the treatment plan and diagnosis.`}` : ''}
  
${getEnabledContent('naturopathicMedicine', inputs.naturopathicMedicine) !== null ? `
**Naturopathic Medicine:**  
${getEnabledContent('naturopathicMedicine', inputs.naturopathicMedicine)
                        ? `Expand the following user naturopathic input into complete naturopathic treatment recommendations with proper dosing and administration. If the user provides brief suggestions (like "probiotics"), expand with specific products, dosing, and administration appropriate for a ${inputs.weight}${inputs.weightUnit} ${inputs.species}.

User Naturopathic Input: "${getEnabledContent('naturopathicMedicine', inputs.naturopathicMedicine)}"

Expand with:
- Specific naturopathic products and brands where appropriate
- Proper dosing for the patient's weight and species
- Administration instructions and timing
- Expected benefits and mechanisms of action
- Duration of treatment
- Any contraindications or monitoring needed`
                        : `Generate 3 ELABORATE naturopathic treatment options based on the diagnosis and treatment plan.`}` : ''}
  
${getEnabledContent('clientCommunications', inputs.clientCommunications) !== null ? `
**Client Communications:**  
Generate medical record documentation of what was communicated to the client based on the treatment plan and diagnosis. Write in past tense using clinical terminology for the medical record. Include the prognosis discussed. Don't say "the veterinarian said" or "the veterinarian recommended". Each sentence should be on its own line with NO blank lines between sentences - keep all sentences consecutive.

${hasUserInput(getEnabledContent('clientCommunications', inputs.clientCommunications))
                        ? `
Additionally, expand and integrate the following user input into professional medical record documentation:
User Input: "${getEnabledContent('clientCommunications', inputs.clientCommunications)}"

Convert this input into complete professional medical record sentences in past tense documenting what was discussed with the client. For example, if user enters "e collar", expand it to "Discussed the importance of using an e-collar to prevent self-trauma during healing" and add it seamlessly to the communications above. CRITICAL: Keep all sentences consecutive with NO blank lines between them.`
                        : ''}` : ''}
  
${getEnabledContent('planFollowUp', inputs.planFollowUp) !== null ? `
**Follow-Up:**  
${getEnabledContent('planFollowUp', inputs.planFollowUp)
                        ? `Expand the following user follow-up input into a complete follow-up plan with specific timelines and purposes. If the user provides brief notes (like "recheck in 2 weeks"), expand with specific reasons and what will be evaluated.

User Follow-Up Input: "${getEnabledContent('planFollowUp', inputs.planFollowUp)}"

Expand with:
- Specific timeline for follow-up appointments
- Clear reasons for each follow-up visit
- What will be evaluated or monitored
- Any specific tests or procedures planned
- Client instructions for scheduling
- Each follow-up point on separate lines`
                        : `Generate a follow-up plan based on the treatment plan and diagnosis. Follow the format output exactly, Re-check in X days, new line, reaaon for appointment. Each sentence should be on its own line.`}` : ''}
  
${getEnabledContent('patientVisitSummary', inputs.patientVisitSummary) !== null ? `
**Patient Visit Summary:**  
${hasUserInput(getEnabledContent('patientVisitSummary', inputs.patientVisitSummary))
                        ? `CRITICAL: This section is CLIENT-FACING. Expand the following user summary input into a complete client-friendly letter about ${inputs.patientName || '[Pet Name]'}'s visit. Use simple, non-medical language that pet owners can easily understand.

User Summary Input: "${getEnabledContent('patientVisitSummary', inputs.patientVisitSummary)}"

Write in a warm, caring tone and include:
- ${inputs.patientName ? `Use ${inputs.patientName}'s name throughout the letter` : 'Refer to "your pet" instead of using a specific name'}
- Simple explanation of the condition in everyday language (avoid medical jargon)
- What the treatment involves and why it's needed
- Clearly formatted "Medicines used:" section with each drug on its own line showing: Drug name - Purpose/action - Side effects to watch for
- What to expect for recovery and prognosis in encouraging terms
- Any important care instructions for the owner
- Reassurance and support
- Do NOT start with "Dear Client" or similar greeting
- Use proper line spacing with two spaces at end of lines
- End with a professional sign-off including Dr. ${inputs.doctor?.replace(/^Dr\.\s*/, '') || '[Doctor name]'}'s name`
                        : `CRITICAL: This section is CLIENT-FACING. Generate a warm, client-friendly letter about ${inputs.patientName ? `${inputs.patientName}'s` : 'your pet\'s'} visit today. Write in simple, caring language that explains:

- What condition ${inputs.patientName ? `${inputs.patientName}` : 'your pet'} has (in everyday terms, not medical jargon)
- What treatment we're providing and why it will help
- Clearly formatted "Medicines used:" section with each drug on its own line showing: Drug name - Purpose/action - Side effects to watch for
- What to expect for ${inputs.patientName ? `${inputs.patientName}'s` : 'your pet\'s'} recovery and prognosis
- Any care instructions for home
- Encouraging and supportive tone throughout
- ${inputs.patientName ? `Use ${inputs.patientName}'s name frequently` : 'Refer to "your pet" throughout'}
- Do NOT start with "Dear Client" or similar greeting
- Use proper line spacing with two spaces at end of lines
- End with a professional sign-off including Dr. ${inputs.doctor?.replace(/^Dr\.\s*/, '') || '[Doctor name]'}'s name`}` : ''}
  
${getEnabledContent('notes', inputs.notes) !== null ? `
${hasUserInput(getEnabledContent('notes', inputs.notes))
                        ? `**Notes:**  
CRITICAL: This section is CLIENT-FACING. Based on the following instruction/topic, create appropriate client-facing content:

Instruction/Topic: "${getEnabledContent('notes', inputs.notes)}"

Instructions for content creation:
- If the instruction mentions a specific item/product (like "paw socks", "E-collar", "special diet"), explain what it is, why it's needed for ${inputs.patientName || 'their pet'}, and how to use it properly
- If the instruction asks for a "client handout" or "information sheet" on a topic, create a comprehensive educational handout directed to the client
- If the instruction mentions a condition or treatment, provide client-friendly explanation and care instructions
- Use simple, non-medical language that pet owners can easily understand
- Write in a warm, professional tone directly addressing the pet owner
- Include practical tips and specific guidance relevant to ${inputs.patientName || 'their pet'}
- Format as educational content without dashes or bullet points
- Focus on being helpful and informative
- If there are multiple topics, separate each with a single blank line for better readability`
                        : ''}` : ''}
  
FINAL NOTES DO NOT INCLUDE IN REPORT::
Never use - in front of a sentence.
CRITICAL SPACING RULE: Each content line should end with two spaces and appear on its own line, but ABSOLUTELY NO blank lines between content lines within sections. Lines should be consecutive without extra spacing. Only use blank lines to separate major sections from each other. This is the most important formatting rule - violating this creates unprofessional reports.
                        `;



      try {
            const response = await axios.post(
                  `${API_URL}/api/quickquery`,
                  {
                        model: 'gpt-4o-mini',
                        messages: [
                              {
                                    role: 'system',
                                    content: prompt
                              }
                        ],
                        temperature: 0.7,
                        max_tokens: 2500
                  }
            );

            return response.data.choices[0].message.content;
      } catch (error) {
            console.error('Error generating report:', error);
            throw new Error('Failed to generate report. Please try again.');
      }
};

export default GenerateReport;
