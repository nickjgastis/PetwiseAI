import { toPlainText } from './petwiseText.js';
import { SECTION_KEYS, splitSoap } from './soapSections.js';

// Full SOAP is exactly what the PetWise editor's Copy all produces; single sections go through the same formatter.
export const formatRecord = (record) => {
    const text = record?.reportText || '';
    const { sections } = splitSoap(text);
    const out = { full: toPlainText(text, 'soap') };
    SECTION_KEYS.forEach((key) => {
        out[key] = sections[key] ? toPlainText(sections[key], 'soap') : '';
    });
    return out;
};

export const recordLabel = (record) => (record ? `${record.patientName} \u00b7 ${record.recordTitle}` : '');
