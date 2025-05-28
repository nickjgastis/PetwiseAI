# SOAP View Feature for PetWise Veterinary Records

## Overview

The SOAP view feature provides a structured format for veterinary records following the standard SOAP (Subjective, Objective, Assessment, Plan) methodology used in veterinary medicine. This feature allows veterinarians to view and copy individual sections of their generated reports in a format that's compatible with most veterinary software systems.

## Features

### 1. **View Toggle**
- Switch between "Standard" and "SOAP" views in the report preview
- Toggle buttons located in the report preview header
- Maintains all report content while reorganizing it into SOAP format

### 2. **Color-Coded Sections**
Each SOAP section has its own distinct color scheme:
- **Subjective** (Blue): Patient history and presenting complaints
- **Objective** (Green): Physical exam findings and diagnostic test results  
- **Assessment** (Amber): Clinical assessment and diagnosis
- **Plan** (Red): Treatment plans, monitoring, and follow-up care

### 3. **Individual Section Copying**
- Each SOAP section has its own copy button (📋)
- Click to copy just that section's content to clipboard
- Useful for pasting into specific fields in veterinary software
- Copy confirmation messages appear briefly

### 4. **Content Mapping**

The system automatically maps report sections to SOAP categories:

#### Subjective
- Presenting Complaint
- History

#### Objective  
- Physical Exam Findings
- Diagnostic Tests

#### Assessment
- Assessment
- Diagnosis
- Differential Diagnosis

#### Plan
- Treatment
- Monitoring
- Naturopathic Medicine
- Client Communications
- Follow-Up

## Usage

1. **Generate a Report**: Fill out the patient and exam information, then click "Generate Record"

2. **Switch to SOAP View**: In the report preview header, click the "SOAP" button

3. **Copy Individual Sections**: Click the clipboard icon (📋) next to any section header to copy that section's content

4. **Paste into Veterinary Software**: Use the copied content in the appropriate fields of your practice management software

## Technical Implementation

### Components
- `SOAPView.js`: Main SOAP view component
- `parseReportForSOAP()`: Function that parses generated reports into SOAP sections
- CSS styling in `ReportForm.css` for color-coding and layout

### Responsive Design
- Mobile-friendly layout with stacked sections
- Touch-friendly copy buttons
- Responsive color schemes

## Benefits

1. **Compatibility**: Works with veterinary software that has separate SOAP fields
2. **Efficiency**: Copy only the sections you need rather than the entire report
3. **Organization**: Clear visual separation of different types of clinical information
4. **Standardization**: Follows established veterinary documentation standards

## Browser Compatibility

- Modern browsers with clipboard API support
- Fallback copy functionality for older browsers
- Works on desktop and mobile devices

---

*This feature enhances the existing PetWise report generation system by providing veterinarians with flexible formatting options that integrate seamlessly with their existing workflows.* 