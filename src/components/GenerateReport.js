import React from 'react';
import axios from 'axios';

const GenerateReport = async (inputs, enabledFields) => {
    const getEnabledContent = (fieldName, content) => {
        if (!enabledFields || !enabledFields[fieldName]) {
            return '';
        }
        return content;
    };

    const prompt = `You are a highly experienced veterinarian. Based on the following input details, write a comprehensive veterinary prognosis report that adheres to the specified template. IMPORTANT: Maintain exact bullet point format (•) as shown in the template. Do not convert bullets to dashes or other formats. If a section is empty, keep the bullet points and provide data based on best practices from similar cases IMPORTANT: For patient information fields marked as "Provide here", leave them exactly as "Provide here" - do not generate or make up any patient information. Only fill in medical content in the sections below the patient information.

Veterinary Report
    
Patient: ${inputs.patientName || "Provide here"}  
Species: ${inputs.species || "Provide here"}  
Sex: ${inputs.sex || "Provide here"}  
Breed: ${inputs.breed || "Provide here"}  
Color/Markings: ${inputs.colorMarkings || "Provide here"}  
Weight: ${inputs.weight || "Provide here"} ${inputs.weightUnit || "lbs"}  
Age: ${inputs.age || "Provide here"}  
Owner: ${inputs.ownerName || "Provide here"}  
Address: ${inputs.address || "Provide here"}  
Telephone: ${inputs.telephone || "Provide here"}  
${getEnabledContent('examDate', `Exam Date: ${inputs.examDate || "Provide here"}`)}  
${getEnabledContent('doctor', `Doctor: ${inputs.doctor || "Provide here"}`)}
    
${getEnabledContent('presentingComplaint', `Presenting Complaint:\n${inputs.presentingComplaint ?
        `• ${inputs.presentingComplaint.split('\n').join('\n• ')}` :
        `• Initial symptoms and when first noticed
• Duration and progression of symptoms 
• Owner's observations and concerns
• Changes in behavior or routine
• Any attempted home remedies
• Factors that worsen or improve symptoms`}`)}

${getEnabledContent('history', `History:\n${inputs.history ?
            `• ${inputs.history.split('\n').join('\n• ')}` :
            `• Not provided - Previous medical conditions and treatments
• Not provided - Recent changes in health, behavior, or lifestyle
• Not provided - Vaccination and preventative care history 
• Not provided - Diet and exercise routine
• Not provided - Environmental factors or recent changes
• Not provided - Family history if relevant`}`)}
    
${getEnabledContent('physicalExamFindings', `Physical Exam Findings: ${new Date().toLocaleString()}\n${inputs.physicalExamFindings || "IMPORTANT: Keep the exact same structure and data that the input gives you at all times!!!. Do not give a paragraph. Compensate for capitalization errors, example: NORAML = normal. Here is an example: "}`)}
${getEnabledContent('diagnosticTests', `Diagnostic Tests:\n${inputs.diagnosticTests || `• Complete Blood Count (CBC)
• Chemistry Panel
• Urinalysis
• [Additional tests if provided]: [Results]`}`)}
    
${getEnabledContent('assessment', `Assessment:
${inputs.assessment || `Provide assessment in bullet points:
• Current clinical status and overall condition
• Key physical exam findings and their significance
• Relevant test results and their interpretation
• Disease progression or improvement if applicable
• Impact on patient's quality of life`}`)}

${getEnabledContent('diagnosis', `Diagnosis:
${inputs.diagnosis || `List primary diagnoses in bullet points:
• Main diagnosis with supporting evidence
• Stage or severity of condition
• Expected progression
• Prognosis and factors affecting outcome
• Confidence level in diagnosis`}`)}

${getEnabledContent('differentialDiagnosis', `Differential Diagnosis:
${inputs.differentialDiagnosis || `List differential diagnoses in order of likelihood, get your information from the 5 minute veterinary consult:
1. [condition] - supporting evidence
2. [condition] - supporting evidence
3. [same format] - supporting evidence
• Ruled out: [conditions] - reasons for exclusion`}`)}

${getEnabledContent('treatment', `Plan
Treatment:
${inputs.treatment || `List the most commmon treatment in bullet points:
[Drug Name] (dose mg/kg, route, frequency - SID/BID/TID/QID/EOD, Duration: [specify])
  - Special instructions: [if any]
[same format]`}`)}

${getEnabledContent('monitoring', `Monitoring:
Pull from the diagnosis section and provide bullet points on what to monitor based on the condition.`)}

Drug Interactions/Side Effects:
• Drug Interactions:
  - Potential interactions between prescribed medications
  - Specific combinations to avoid
• Side Effects:
  - Common side effects for each medication
  - Warning signs to watch for
• Contraindications:
  - Specific conditions that affect medication use
  - Required monitoring parameters
• Special Considerations:
  - Drug-specific monitoring requirements
  - Timing considerations between medications

${getEnabledContent('naturopathicMedicine', `Naturopathic Medicine:
${inputs.naturopathicMedicine || `List natural treatments in bullet points:
• Treatment 1:
  - Dosing and administration
  - Expected benefits
  - Potential interactions
  - Contraindications
• Treatment 2: [same format]
• Treatment 3: [same format]`}`)}

${getEnabledContent('clientCommunications', `Client Communications:
${inputs.clientCommunications || `Key points discussed:
• Diagnosis explanation and implications
• Treatment plan overview
• Expected outcomes and timeline
• Side effects to watch for
• Warning signs requiring immediate attention`}`)}

${getEnabledContent('planFollowUp', `Follow-Up:
${inputs.planFollowUp || `Follow-up plan in bullet points:
• Next appointment: [specific number of days from today]
• Reason for appointment`}`)}

${getEnabledContent('clientEducation', `Client Education:
${inputs.clientEducation || `Please write a report to the client that includes:
• Brief overview of their pet's diagnosed condition
• Summary of:
  - The prescribed treatments and medications
  - Home care instructions and lifestyle changes
  - Warning signs to watch for
  - Diet and exercise recommendations
  - Any environmental changes needed
• Available resources and support
• Follow-up appointment details
• Doctors name

The tone should be warm and supportive while maintaining medical accuracy. Include specific details from their visit and personalize based on any particular concerns they expressed.`}`)}

${getEnabledContent('doctor', inputs.doctor || "Provide here")}
    

Veterinarian: Dr. ${inputs.doctor || "[Name]"}
Signature: ________________________
Date: ${new Date().toLocaleDateString()}

End of Medical Record.

    If any information is missing or incomplete, fill in with best practices from similar cases. Always ensure the report is detailed and medically accurate, providing the owner with a clear understanding of the pet's condition, prognosis, and next steps for care. Recommend appropriate treatments where relevant. If the input is short,you should expand with two to three sentences. Don't ever leave a comment at the end of the report.`;

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
                max_tokens: 2000
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
