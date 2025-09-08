import React from 'react';
import axios from 'axios';

const API_URL = process.env.NODE_ENV === 'production'
      ? 'https://api.petwise.vet'
      : 'http://localhost:3001';

const GenerateReport = async (inputs, enabledFields) => {
      // console.log('enabledFields received:', enabledFields);

      const getEnabledContent = (fieldName, content) => {
            // console.log('Checking field:', fieldName, 'enabled:', enabledFields[fieldName]);
            const toggleableFields = [
                  'patientInformation',
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

      const safeSplit = (text, delimiter) => {
            return text ? text.trim().split(delimiter) : [];
      };

      const prompt = `
You are a highly experienced veterinarian. Based on the following input details, create a comprehensive veterinary prognosis report that adheres to the exact format and structure provided below. IMPORTANT: Follow all formatting rules precisely. Where placeholders like "Provide here" are used, do not generate or fill in data. Use input data as provided for medical content. For missing or incomplete sections, use best practices and standard veterinary protocols to fill in gaps with relevant details. If evidence for specific sections such as Differential Diagnoses, Treatment, Assessment, Drug Interactions, or Naturopathic Treatment is not explicitly provided, infer based on the diagnosis and other input details

FORMATTING RULES:
CRITICAL FORMATTING RULES (MUST FOLLOW EXACTLY):
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

INCLUDE ONLY THE FOLLOWING SECTIONS:
${getEnabledContent('patientInformation', enabledFields.patientInformation) ? '**Patient Information:**' : ''}
${getEnabledContent('staff', true) ? '**Staff:**' : ''}
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

**Staff:**  
Doctor: Dr. Smith  

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

**Staff:**  
Doctor: Dr. ${inputs.doctor?.replace(/^Dr\.\s*/, '') || "Provide here"}  
${getEnabledContent('examDate', inputs.examDate) ? `Exam Date: ${getEnabledContent('examDate', inputs.examDate) || "Provide here"}` : ''}  
  
${getEnabledContent('presentingComplaint', inputs.presentingComplaint) !== null ? `
**Presenting Complaint:**  
${getEnabledContent('presentingComplaint', inputs.presentingComplaint)
                        ? `Correct and format the input below with proper medical terminology and capitalization. Each complaint should be on its own line WITHOUT dashes or bullet points.  If the user types "None" or "No Findings" or anything similare, say "No presenting complaints found"
  Input: "${getEnabledContent('presentingComplaint', inputs.presentingComplaint)}"  
  Formatted Output:
  Correct any misspelled medical terms
  Ensure proper capitalization
  List each complaint on a new line WITHOUT dashes
  Use professional medical terminology`
                        : `Generate a concise list of presenting complaints based on the species, breed, and other provided inputs. Each issue should be on its own line WITHOUT dashes or bullet points.`}` : ''}
  
${getEnabledContent('history', inputs.history) !== null ? `
**History:**  
${getEnabledContent('history', inputs.history)
                        ? `Correct and format the input below with proper medical terminology and chronological order. Do not use dashes or bullet points.
  Input: "${getEnabledContent('history', inputs.history)}"  
  Formatted Output:
  Correct any misspelled medical terms
  Ensure proper capitalization and grammar
  Format each historical item on its own line WITHOUT dashes
  Maintain chronological order if provided
  Use professional medical terminology`
                        : `Generate a history based on presenting complaints and the typical background for this species or breed. Provide concise, single-line entries WITHOUT dashes or bullet points.`}` : ''}
  
${getEnabledContent('physicalExamFindings', inputs.physicalExamFindings) !== null ? `
**Physical Exam Findings:** - ${inputs.examDate.split('-').map((part, i) => {
                              if (i === 1) return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(2000, part - 1));
                              if (i === 2) return parseInt(part);
                              return part;
                        }).reverse().join(' ')}
${getEnabledContent('physicalExamFindings', inputs.physicalExamFindings)
                        ? `${inputs.physicalExamFindings}` : `Generate physical exam findings based on presenting complaints, diagnosis, and typical findings for this species or breed.`}` : ''}
${getEnabledContent('diagnosticTests', inputs.diagnosticTests) !== null ? `
**Diagnostic Tests:**  
${getEnabledContent('diagnosticTests', inputs.diagnosticTests)
                        ? `Correct and format the input below with proper medical terminology and test names.
  Input: "${getEnabledContent('diagnosticTests', inputs.diagnosticTests)}"  
  Formatted Output:
  Correct any misspelled test names or medical terms
  Ensure proper capitalization of test names
  List each test on a new line
  Include reference ranges where provided
  Use standard medical abbreviations where appropriate`
                        : `Generate appropriate diagnostic tests based on the presenting complaint and physical exam findings and or diagnosis`}` : ''}
  
${getEnabledContent('assessment', inputs.assessment) !== null ? `
**Assessment:**  
${getEnabledContent('assessment', inputs.assessment)
                        ? `Correct and format the input below with proper medical terminology and clinical assessment structure.
  Input: "${getEnabledContent('assessment', inputs.assessment)}"  
  Formatted Output:
  Correct any misspelled medical terms
  Ensure proper capitalization and grammar
  List each assessment point on a new line
  Use professional medical terminology
  Maintain clinical relevance and priority
  Discuss the lab results`
                        : `Generate an assessment based on diagnostic tests, presenting complaints, and physical exam findings. Provide concise, single-line observations. Discuss the lab results.`}` : ''}
  
${getEnabledContent('diagnosis', inputs.diagnosis) !== null ? `
**Diagnosis:**  
${getEnabledContent('diagnosis', inputs.diagnosis)
                        ? `Correct and format the input below with proper medical terminology, spelling, and capitalization. Number each diagnosis and list on its own line with differentials underneath. IMPORTANT: Use EXACTLY the diagnoses provided - do not change or add new diagnoses.
Input: "${getEnabledContent('diagnosis', inputs.diagnosis)}"
Input Differentials: "${getEnabledContent('differentialDiagnosis', inputs.differentialDiagnosis)}"  
Formatted Output:
Number each diagnosis (1., 2., etc.)
Under each diagnosis add "DDx:" followed by differentials
Correct any misspelled medical terms
Ensure proper capitalization of medical terms
Maintain medical accuracy
Keep the exact same diagnoses but use proper medical terminology

Example:
Input: "kidney failure stage 2, diabeties, heart murmer" 
Input Differentials: "thyroid disease, cushings, valve disease, kidney stones, pancreatitis, cardiomyopathy"

1. Stage II Chronic Kidney Disease (CKD)
   DDx: Hyperthyroidism, Nephrolithiasis, Acute Kidney Injury

2. Diabetes Mellitus
   DDx: Hyperadrenocorticism (Cushing's Disease), Acute Pancreatitis, Chronic Pancreatitis

3. Heart Murmur
   DDx: Valvular Heart Disease, Dilated Cardiomyopathy, Hypertrophic Cardiomyopathy`
                        : `Based on the presenting complaints, physical exam findings, and diagnostic test results, provide a numbered list of diagnoses with relevant differential diagnoses:

1. [Primary Diagnosis]
   DDx: [3-4 relevant differential diagnoses]

2. [Secondary Diagnosis] 
   DDx: [3-4 relevant differential diagnoses]

3. [Additional Diagnosis if applicable]
   DDx: [3-4 relevant differential diagnoses]`}` : ''}


${getEnabledContent('treatment', inputs.treatment) !== null ? `
**Treatment:**

${getEnabledContent('treatment', inputs.treatment)
                        ? `For each diagnosis, provide treatment options considering patient factors (${inputs.species}, ${inputs.sex}, ${inputs.breed}, ${inputs.weight}${inputs.weightUnit}):Format without dashes or bullet points:

Example:
Keratoconjunctivitis Sicca:
Artificial Tears: Carboxymethylcellulose 1-2 gtts OU QID PRN ongoing
Tear Stimulants: Cyclosporine A 0.2 mL OU BID x30d
Anti-inflammatory: Prednisolone acetate 1 gtt OU TID x7d then BID x7d
Supportive Care: Clean eye area BID, monitor for increased discharge or discomfort

Input: "${getEnabledContent('treatment', inputs.treatment)}"  
Output:`
                        : `For each diagnosis, provide treatment options considering patient factors (${inputs.species}, ${inputs.sex}, ${inputs.breed}, ${inputs.weight}${inputs.weightUnit}):Format without dashes or bullet points:

[Diagnosis Name]:
Drug Name Dose Route Freq Duration
Drug Name Dose Route Freq Duration
Drug Name Dose Route Freq Duration
Supportive Care: list all measures on one line`}` : ''}
  
${getEnabledContent('monitoring', inputs.monitoring) !== null ? `
**Monitoring:**  
${getEnabledContent('monitoring', inputs.monitoring)
                        ? `Use the input below to format monitoring details into a clear list. Ensure proper grammar, spelling, and capitalization. Maintain any provided structure.  
  Input: "${getEnabledContent('monitoring', inputs.monitoring)}"  
  Formatted Output:`
                        : `Generate monitoring instructions based on the treatment plan and diagnosis.`}` : ''}
  
${getEnabledContent('naturopathicMedicine', inputs.naturopathicMedicine) !== null ? `
**Naturopathic Medicine:**  
${getEnabledContent('naturopathicMedicine', inputs.naturopathicMedicine)
                        ? `Use the input below to format naturopathic medicine details into complete sentences. Ensure proper grammar and capitalization while maintaining the provided structure.  
  Input: "${getEnabledContent('naturopathicMedicine', inputs.naturopathicMedicine)}"  
  Formatted Output:`
                        : `Generate 3 ELABORATE naturopathic treatment options based on the diagnosis and treatment plan.`}` : ''}
  
${getEnabledContent('clientCommunications', inputs.clientCommunications) !== null ? `
**Client Communications:**  
${getEnabledContent('clientCommunications', inputs.clientCommunications)
                        ? `Use the input below to format client communications into a clear list of professional sentences. Ensure proper grammar, capitalization, and readability. Each sentence should be on its own line.
  Input: "${getEnabledContent('clientCommunications', inputs.clientCommunications)}"  
  Formatted Output:`
                        : `Generate the client communications explained based on the treatment plan and diagnosis in past tense. Include the prognosis. Don't say "the veterinarian said" or "the veterinarian recommended", Each sentence should be on its own line.`}` : ''}
  
${getEnabledContent('planFollowUp', inputs.planFollowUp) !== null ? `
**Follow-Up:**  
${getEnabledContent('planFollowUp', inputs.planFollowUp)
                        ? `Use the input below to format follow-up details into clear list of sentences. Maintain any provided structure while ensuring proper grammar and spelling. Each sentence should be on its own line.
  Input: "${getEnabledContent('planFollowUp', inputs.planFollowUp)}"  
  Formatted Output:
  Re-check in X days
  reason for appointment `
                        : `Generate a follow-up plan based on the treatment plan and diagnosis. Follow the format output exactly, Re-check in X days, new line, reaaon for appointment. Each sentence should be on its own line.`}` : ''}
  
${getEnabledContent('patientVisitSummary', inputs.patientVisitSummary) !== null ? `
**Patient Visit Summary:**  
${getEnabledContent('patientVisitSummary', inputs.patientVisitSummary)
                        ? `Use the input below to format the client visit summary into a professional and friendly letter to the client. This will be used to send to the client. Ensure proper grammar, capitalization, and spelling while maintaining the structure of the provided information.  
  Input: "${getEnabledContent('patientVisitSummary', inputs.patientVisitSummary)}"  
  Formatted Output:`
                        : `Generate a LETTER that educates the client on their pets condition. Include the prognosis. Every sentence should be on a new line. IMPORTANT: Do not say Dear [Client Name], Sign off 2 spaces below: "Thank you for the opertunity to help, [Doctor name]"`}` : ''}
  
${getEnabledContent('notes', inputs.notes) !== null ? `
**Notes:**  
${getEnabledContent('notes', inputs.notes)
                        ? `You are a veterinary medical assistant. List drugs used in the treatment plan, the drug action and their side effects. Then generate a concise, medically accurate response to this query. Use proper medical terminology, be direct, and focus on clinical relevance. No introductions or unnecessary explanations.
  Input: "${getEnabledContent('notes', inputs.notes)}"  
  Output:
  Use bullet points for clarity
  Include relevant medical terms and values
  Focus on prognosis, complications, and key clinical considerations
  Be direct and clinically focused`
                        : `Generate notes based on the diagnosis, assessment, and treatment plan. List drugs used in the treatment plan, the drug action and their side effects.`}` : ''}
  
FINAL NOTES DO NOT INCLUDE IN REPORT::
Never use - in front of a sentence.
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
