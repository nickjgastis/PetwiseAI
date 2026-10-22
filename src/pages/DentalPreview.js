import React, { useState } from 'react';
import DentalChart from '../components/DentalChart';
import { pdf } from '@react-pdf/renderer';
import DentalWorkspace from '../components/DentalWorkspace';
import DentalPDFDocument from '../components/DentalPDF';
import { STATUS_ORDER, toothLabel } from '../dental/teeth';

// Dev-only sandbox for the dental chart (mounted at /dev/dental in development).
const SAMPLE = {
    canine: { 108: { status: 'fractured' }, 409: { status: 'extracted' }, 204: { status: 'missing' }, 309: { status: 'periodontal' }, 110: { status: 'resorption' }, 104: { status: 'treated' } },
    feline: { 307: { status: 'resorption' }, 407: { status: 'extracted' }, 109: { status: 'missing' }, 208: { status: 'periodontal' }, 104: { status: 'fractured' } }
};

const RECORD = {
    species: 'canine',
    teeth: {
        104: { status: 'watch', note: 'enamel chip' },
        108: { status: 'extracted', note: 'slab fracture with pulp exposure' },
        201: { status: 'missing' },
        202: { status: 'missing' },
        309: { status: 'periodontal', note: 'furcation exposure stage 2' },
        409: { status: 'extracted', note: 'PD 6 mm, mobility 2' }
    }
};

const REPORT = `Dental Procedure Summary
Max, an 8-year-old Labrador, was examined and treated under general anesthesia. Overall oral assessment was consistent with grade 3 periodontal disease.

Tooth Findings
104: enamel chip, watch
108: slab fracture with pulp exposure, extracted
201: missing
202: missing
309: furcation exposure stage 2
409: PD 6 mm, mobility 2, extracted

Treatment
108 was surgically extracted with flap elevation and closure using 4-0 Monocryl. 409 was extracted. Infraorbital and mandibular nerve blocks were performed with bupivacaine.

Home Care and Follow-up
Soft food was recommended for 10 days. Recheck advised in 2 weeks.`;

const DentalPreview = () => {
    const [report, setReport] = useState(REPORT);
    const [name, setName] = useState('Max - Dental - 10/22/2026, 3:19:13 PM');
    const [pdfUrl, setPdfUrl] = useState(null);
    const printPreview = async () => {
        const blob = await pdf(<DentalPDFDocument title="Max - Dental" report={report} dental={record} />).toBlob();
        setPdfUrl(URL.createObjectURL(blob));
    };
    const [state, setState] = useState(SAMPLE);
    const [record, setRecord] = useState(RECORD);
    const [selected, setSelected] = useState(null);

    const cycle = (species) => (id) => {
        setSelected(`${species}:${id}`);
        setState((prev) => {
            const cur = prev[species][id]?.status || 'normal';
            const next = STATUS_ORDER[(STATUS_ORDER.indexOf(cur) + 1) % STATUS_ORDER.length];
            const teeth = { ...prev[species] };
            if (next === 'normal') delete teeth[id];
            else teeth[id] = { status: next };
            return { ...prev, [species]: teeth };
        });
    };

    const [selSpecies, selId] = selected ? selected.split(':') : [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 px-6 py-10" style={{ fontFamily: 'var(--font-sans)' }}>
            <div className="max-w-[1680px] mx-auto">
                <h1 className="m-0 text-[2rem] font-bold tracking-[-0.03em] text-[#13233f] font-display">Dental chart preview</h1>
                <p className="mt-1 text-[14px] text-[#1a2b4a]/55">
                    Click a tooth to cycle its status.
                    {selId && <span className="ml-2 font-medium text-[#2d5fb8]">{selId} · {toothLabel(selSpecies, selId)}</span>}
                </p>
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {['canine', 'feline'].map((sp) => (
                        <div key={sp} className="rounded-[28px] bg-white border border-[#e7ecf3] shadow-[0_30px_70px_-40px_rgba(19,35,63,0.35)] p-6">
                            <p className="m-0 mb-4 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#1a2b4a]/45">{sp}</p>
                            <DentalChart
                                species={sp}
                                teeth={state[sp]}
                                selected={selSpecies === sp ? selId : null}
                                onToothClick={cycle(sp)}
                                className="max-w-[460px] mx-auto"
                            />
                        </div>
                    ))}
                </div>
                <p className="mt-12 mb-4 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#1a2b4a]/45">Record workspace</p>
                <DentalWorkspace name={name} onNameChange={setName} report={report} onReportChange={setReport} dental={record} onDentalChange={setRecord} onCopy={() => {}} onPrint={printPreview} />
                {pdfUrl && <iframe title="Print preview" src={pdfUrl} className="mt-8 w-full h-[1100px] rounded-[20px] border border-[#e7ecf3] bg-white" />}
            </div>
        </div>
    );
};

export default DentalPreview;
