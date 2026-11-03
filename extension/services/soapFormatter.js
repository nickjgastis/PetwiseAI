import { toPlainText } from './petwiseText.js';
import { FULL, normalizeType, typeLabel } from './recordTypes.js';
import { SECTION_KEYS, splitSoap } from './soapSections.js';

// Full is exactly what the PetWise editor's Copy all produces for that record type. Only SOAP has sections, and
// they go through the same formatter.
export const formatRecord = (record) => {
    const text = record?.reportText || '';
    const type = normalizeType(record?.recordType);
    const out = { [FULL]: toPlainText(text, type) };
    if (type !== 'soap') return out;
    const { sections } = splitSoap(text);
    SECTION_KEYS.forEach((key) => {
        out[key] = sections[key] ? toPlainText(sections[key], type) : '';
    });
    return out;
};

export const recordLabel = (record) => (record ? `${record.patientName} \u00b7 ${record.recordTitle}` : '');

export const recordTypeLabel = (record) => (record ? `${record.patientName} \u00b7 ${typeLabel(record.recordType)}` : '');
