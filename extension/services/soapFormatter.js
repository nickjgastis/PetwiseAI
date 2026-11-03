import { toPlainText } from './petwiseText.js';
import { FULL, normalizeType, splitRecord, typeLabel, typeSectionKeys } from './recordTypes.js';

// Full is exactly what the PetWise editor's Copy all produces for that record type; single sections go through the
// same formatter.
export const formatRecord = (record) => {
    const text = record?.reportText || '';
    const type = normalizeType(record?.recordType);
    const sections = splitRecord(text, type);
    const out = { [FULL]: toPlainText(text, type) };
    typeSectionKeys(type).forEach((key) => {
        out[key] = sections[key] ? toPlainText(sections[key], type) : '';
    });
    return out;
};

export const recordLabel = (record) => (record ? `${record.patientName} \u00b7 ${record.recordTitle}` : '');

export const recordTypeLabel = (record) => (record ? `${record.patientName} \u00b7 ${typeLabel(record.recordType)}` : '');
