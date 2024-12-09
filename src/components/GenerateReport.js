import React from 'react';
import axios from 'axios';

const GenerateReport = async (inputs, enabledFields) => {
      const getEnabledContent = (fieldName, content) => {
            const toggleableFields = [
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
  You are a highly experienced veterinarian. Based on the following input details, create a comprehensive veterinary prognosis report that adheres to the exact format and structure provided below. IMPORTANT: Follow all formatting rules precisely. Where placeholders like "Provide here" are used, do not generate or fill in data. Use input data as provided for medical content. For missing or incomplete sections, use best practices and standard veterinary protocols to fill in gaps with relevant details. If evidence for specific sections such as Differential Diagnoses, Treatment, Assessment, Drug Interactions, or Naturopathic Treatment is not explicitly provided, infer based on the diagnosis and other input details Do not use ** on headers.
  
  Veterinary Medical Record:
  
  Patient Information:  
  Patient: ${inputs.patientName || "Provide here"}  
  Species: ${inputs.species || "Provide here"}  
  Breed: ${inputs.breed || "Provide here"}  
  Sex: ${inputs.sex || "Provide here"}  
  Color/Markings: ${inputs.colorMarkings || "Provide here"}  
  Weight: ${inputs.weight || "Provide here"} ${inputs.weightUnit || "lbs"}  
  Age: ${inputs.age || "Provide here"}  

  Client Information:
  Owner: ${inputs.ownerName || "Provide here"}  
  Address: ${inputs.address || "Provide here"}  
  Telephone: ${inputs.telephone || "Provide here"}  
  Doctor: Dr. ${inputs.doctor ? inputs.doctor.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : "Provide here"}  
  ${getEnabledContent('examDate', inputs.examDate) !== null ? `Exam Date: ${getEnabledContent('examDate', inputs.examDate) || "Provide here"}` : ''}  
  
  ${getEnabledContent('presentingComplaint', inputs.presentingComplaint) !== null ? `
  Presenting Complaint:  
  ${getEnabledContent('presentingComplaint', inputs.presentingComplaint)
                        ? `Correct and format the input below with proper medical terminology and capitalization. Each complaint should be on its own line.
  Input: "${getEnabledContent('presentingComplaint', inputs.presentingComplaint)}"  
  Formatted Output:
  - Correct any misspelled medical terms
  - Ensure proper capitalization
  - List each complaint on a new line
  - Use professional medical terminology`
                        : `Generate a concise list of presenting complaints based on the species, breed, and other provided inputs. Each issue should be on its own line.`}` : ''}
  
  ${getEnabledContent('history', inputs.history) !== null ? `
  History:  
  ${getEnabledContent('history', inputs.history)
                        ? `Correct and format the input below with proper medical terminology and chronological order.
  Input: "${getEnabledContent('history', inputs.history)}"  
  Formatted Output:
  - Correct any misspelled medical terms
  - Ensure proper capitalization and grammar
  - Format each historical item on its own line
  - Maintain chronological order if provided
  - Use professional medical terminology`
                        : `Generate a history based on presenting complaints and the typical background for this species or breed. Provide concise, single-line entries.`}` : ''}
  
  ${getEnabledContent('physicalExamFindings', inputs.physicalExamFindings) !== null ? `
  Physical Exam Findings: - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
  ${getEnabledContent('physicalExamFindings', inputs.physicalExamFindings)
                        ? `${getEnabledContent('physicalExamFindings', inputs.physicalExamFindings)}`
                        : `Generate physical exam findings based on presenting complaints, diagnosis, and typical findings for this species or breed.`}` : ''}
  ${getEnabledContent('diagnosticTests', inputs.diagnosticTests) !== null ? `
  Diagnostic Tests:  
  ${getEnabledContent('diagnosticTests', inputs.diagnosticTests)
                        ? `Correct and format the input below with proper medical terminology and test names.
  Input: "${getEnabledContent('diagnosticTests', inputs.diagnosticTests)}"  
  Formatted Output:
  - Correct any misspelled test names or medical terms
  - Ensure proper capitalization of test names
  - List each test on a new line
  - Include reference ranges where provided
  - Use standard medical abbreviations where appropriate`
                        : `Generate appropriate diagnostic tests based on the presenting complaint and physical exam findings and or diagnosis`}` : ''}
  
  ${getEnabledContent('assessment', inputs.assessment) !== null ? `
  Assessment:  
  ${getEnabledContent('assessment', inputs.assessment)
                        ? `Correct and format the input below with proper medical terminology and clinical assessment structure.
  Input: "${getEnabledContent('assessment', inputs.assessment)}"  
  Formatted Output:
  - Correct any misspelled medical terms
  - Ensure proper capitalization and grammar
  - List each assessment point on a new line
  - Use professional medical terminology
  - Maintain clinical relevance and priority
  - Discuss the lab results`
                        : `Generate an assessment based on diagnostic tests, presenting complaints, and physical exam findings. Provide concise, single-line observations. Discuss the lab results.`}` : ''}
  
  ${getEnabledContent('diagnosis', inputs.diagnosis) !== null ? `
  Diagnosis:  
  ${getEnabledContent('diagnosis', inputs.diagnosis)
                        ? `Correct and format the input below with proper medical terminology, spelling, and capitalization. Each diagnosis should be on its own line. Format as a professional medical diagnosis.
  Input: "${getEnabledContent('diagnosis', inputs.diagnosis)}"  
  Formatted Output:
  - Correct any misspelled medical terms
  - Ensure proper capitalization of medical terms
  - Maintain medical accuracy
  - Keep the same meaning but use proper medical terminology`
                        : `Generate a diagnosis based on the assessment and diagnostic tests.`}` : ''}
  
  ${getEnabledContent('differentialDiagnosis', inputs.differentialDiagnosis) !== null ? `
  Differential Diagnoses:  
  ${getEnabledContent('differentialDiagnosis', inputs.differentialDiagnosis)
                        ? `Correct and format the input below with proper medical terminology and diagnostic categories.
  Input: "${getEnabledContent('differentialDiagnosis', inputs.differentialDiagnosis)}"  
  Formatted Output:
  - Correct any misspelled medical terms
  - Ensure proper capitalization of medical terms
  - List each differential on a new line
  - Order by likelihood if indicated
  - Use professional medical terminology`
                        : `Generate differential diagnoses based on the diagnosis and assessment.`}` : ''}
  
  PLAN
  ${getEnabledContent('treatment', inputs.treatment) !== null ? `
  Treatment:
  ${getEnabledContent('treatment', inputs.treatment)
                        ? `List the most common treatment in bullet points:
[Drug Name] (dose mg/kg, route, frequency - SID/BID/TID/QID/EOD, Duration: [specify])

[same format]

Input: "${getEnabledContent('treatment', inputs.treatment)}"  
Output:`
                        : `List the most common treatment in bullet points:
[Drug Name] (dose mg/kg, route, frequency - SID/BID/TID/QID/EOD, Duration: [specify])

[same format]`}` : ''}
  
  ${getEnabledContent('monitoring', inputs.monitoring) !== null ? `
  Monitoring:  
  ${getEnabledContent('monitoring', inputs.monitoring)
                        ? `Use the input below to format monitoring details into a clear list. Ensure proper grammar, spelling, and capitalization. Maintain any provided structure.  
  Input: "${getEnabledContent('monitoring', inputs.monitoring)}"  
  Formatted Output:`
                        : `Generate monitoring instructions based on the treatment plan and diagnosis.`}` : ''}
  
  ${getEnabledContent('naturopathicMedicine', inputs.naturopathicMedicine) !== null ? `
  Naturopathic Medicine:  
  ${getEnabledContent('naturopathicMedicine', inputs.naturopathicMedicine)
                        ? `Use the input below to format naturopathic medicine details into complete sentences. Ensure proper grammar and capitalization while maintaining the provided structure.  
  Input: "${getEnabledContent('naturopathicMedicine', inputs.naturopathicMedicine)}"  
  Formatted Output:`
                        : `Generate 3 ELABORATE naturopathic treatment options based on the diagnosis and treatment plan.`}` : ''}
  
  ${getEnabledContent('clientCommunications', inputs.clientCommunications) !== null ? `
  Client Communications:  
  ${getEnabledContent('clientCommunications', inputs.clientCommunications)
                        ? `Use the input below to format client communications into a clear list of professional sentences. Ensure proper grammar, capitalization, and readability. Each sentence should be on its own line.
  Input: "${getEnabledContent('clientCommunications', inputs.clientCommunications)}"  
  Formatted Output:`
                        : `Generate the client communications explained based on the treatment plan and diagnosis in past tense. Don't say "the veterinarian said" or "the veterinarian recommended", Each sentence should be on its own line.`}` : ''}
  
  ${getEnabledContent('planFollowUp', inputs.planFollowUp) !== null ? `
  Follow-Up:  
  ${getEnabledContent('planFollowUp', inputs.planFollowUp)
                        ? `Use the input below to format follow-up details into clear list of sentences. Maintain any provided structure while ensuring proper grammar and spelling. Each sentence should be on its own line.
  Input: "${getEnabledContent('planFollowUp', inputs.planFollowUp)}"  
  Formatted Output:
  - Re-check in X days
  - reason for appointment `
                        : `Generate a follow-up plan based on the treatment plan and diagnosis. Follow the format output exactly, Re-check in X days, new line, reaaon for appointment. Each sentence should be on its own line.`}` : ''}
  
  ${getEnabledContent('patientVisitSummary', inputs.patientVisitSummary) !== null ? `
  Patient Visit Summary:  
  ${getEnabledContent('patientVisitSummary', inputs.patientVisitSummary)
                        ? `Use the input below to format the client visit summary into a professional and friendly letter to the client. This will be used to send to the client. Ensure proper grammar, capitalization, and spelling while maintaining the structure of the provided information.  
  Input: "${getEnabledContent('patientVisitSummary', inputs.patientVisitSummary)}"  
  Formatted Output:`
                        : `Generate a LETTER that educates the client on their pets condition. Every sentence should be on a new line. After stating a diagosis or medical term, write the common term in parenthesis. IMPORTANT: Do not say Dear [Client Name], Sign of with "/nThank you for the opertunity to help,/n [Doctor name]"`}` : ''}
  
  ${getEnabledContent('notes', inputs.notes) !== null ? `
  Notes:  
  ${getEnabledContent('notes', inputs.notes)
                        ? `You are a veterinary medical assistant. List drugs used in the treatment plan, the drug action and their side effects. Then generate a concise, medically accurate response to this query. Use proper medical terminology, be direct, and focus on clinical relevance. No introductions or unnecessary explanations.IMPORTANT: After stating a medical term, ALWAYS write the common term in parenthesis.
  Input: "${getEnabledContent('notes', inputs.notes)}"  
  Output:
  - After stating a medical term, ALWAYS write the common term in parenthesis.
  - Use bullet points for clarity
  - Include relevant medical terms and values
  - Focus on prognosis, complications, and key clinical considerations
  - Be direct and clinically focused`
                        : `Generate notes based on the diagnosis, assessment, and treatment plan. List drugs used in the treatment plan, the drug action and their side effects. After stating a diagosis or medical term, write the common term in parenthesis.`}` : ''}
  `;






      try {
            const response = await axios.post(
                  'https://api.openai.com/v1/chat/completions',
                  {
                        model: 'gpt-4o-mini', // Updated model name
                        messages: [
                              {
                                    role: 'system',
                                    content: prompt
                              }
                        ],
                        temperature: 0.7,
                        max_tokens: 2500
                  },
                  {
                        headers: {
                              'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
                              'Content-Type': 'application/json'
                        }
                  }
            );

            return response.data.choices[0].message.content;
      } catch (error) {
            console.error('Error generating report:', error);
            throw new Error('Failed to generate report. Please try again.');
      }
};

export default GenerateReport;
