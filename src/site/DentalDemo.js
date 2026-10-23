import React, { useState } from 'react';
import { PiTooth } from 'react-icons/pi';
import DentalChartCanvas from '../components/DentalChartCanvas';
import { STATUSES, toothLabel } from '../dental/teeth';
import { Reveal, Section } from './ui';

const SAMPLE = {
    species: 'canine',
    teeth: {
        104: { status: 'watch', note: 'enamel chip' },
        108: { status: 'extracted', note: 'slab fracture with pulp exposure' },
        201: { status: 'missing' },
        309: { status: 'periodontal', note: 'furcation exposure stage 2' },
        409: { status: 'extracted', note: 'PD 6 mm, mobility 2' }
    }
};

const PATIENT = {
    canine: { name: 'Max', summary: 'Max, an 8 year old Labrador, was examined under general anesthesia. Findings consistent with grade 3 periodontal disease.' },
    feline: { name: 'Luna', summary: 'Luna, a 10 year old DSH, was examined under general anesthesia. Full mouth radiographs were taken.' }
};

const Label = ({ children }) => <p className="m-0 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#1a2b4a]/45">{children}</p>;

// The real chart with a sample patient. Clicking teeth rewrites the record on the right, like the app does.
const DentalDemo = () => {
    const [dental, setDental] = useState(SAMPLE);
    const species = dental.species === 'feline' ? 'feline' : 'canine';
    const patient = PATIENT[species];
    const findings = Object.keys(dental.teeth).sort();

    return (
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] rounded-[28px] bg-white border border-[#e7ecf3] shadow-[0_40px_90px_-45px_rgba(19,35,63,0.45)] overflow-hidden text-left">
            <div className="lg:order-2">
                <div className="flex items-center gap-2.5 px-5 pt-4">
                    <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-violet-50 text-violet-700 text-[11.5px] font-semibold">
                        <PiTooth className="text-[13px]" />
                        Dental
                    </span>
                    <span className="text-[14px] font-semibold text-[#13233f] truncate">{patient.name}</span>
                    <span className="ml-auto text-[12px] font-medium text-violet-600">Try it: click any tooth</span>
                </div>
                <DentalChartCanvas dental={dental} onChange={setDental} height="clamp(300px, 42vw, 440px)" />
            </div>
            <div className="border-t lg:border-t-0 lg:border-r border-[#eef2f7] bg-[#fbfcfe] px-6 py-6 sm:px-7">
                <Label>Dental record</Label>
                <p className="mt-2 mb-0 text-[14px] leading-relaxed text-[#1a2b4a]/75">{patient.summary}</p>
                <div className="mt-5">
                    <Label>Tooth findings</Label>
                    {findings.length ? (
                        <ul className="m-0 mt-2 p-0 list-none space-y-1.5 text-[14px] leading-snug">
                            {findings.map((id) => {
                                const t = dental.teeth[id];
                                return (
                                    <li key={id} className="flex gap-2.5">
                                        <span className="font-semibold text-[#13233f] w-8 shrink-0" style={{ fontFeatureSettings: "'tnum'" }}>{id}</span>
                                        <span className="text-[#1a2b4a]/75">
                                            {toothLabel(species, id)}, {(STATUSES[t.status]?.label || '').toLowerCase()}
                                            {t.note ? `: ${t.note}` : ''}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="m-0 mt-2 text-[14px] text-[#1a2b4a]/45">All teeth within normal limits.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const POINTS = ['Modified Triadan, dog and cat', 'Tap a tooth to change a finding', 'PDF with the chart on page one'];

export const DentalSection = () => (
    <Section>
        <Reveal className="text-center mx-auto max-w-2xl mb-12 sm:mb-16">
            <p className="text-[13px] font-semibold tracking-[0.14em] uppercase mb-4 text-[#3468bd]">New</p>
            <h2 className="text-[2.25rem] sm:text-[3rem] leading-[1.05] font-semibold tracking-[-0.03em]">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#6d28d9] via-[#8b5cf6] to-[#c084fc]">Dental Records</span>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-[#1a2b4a]/65">
                Dictate the dental the way you would say it to a tech. PetWise charts every tooth and writes the record next to it.
            </p>
        </Reveal>
        <Reveal delay={120}>
            <DentalDemo />
        </Reveal>
        <Reveal delay={180} className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-[14px] text-[#1a2b4a]/60">
            {POINTS.map((p) => (
                <span key={p} className="inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                    {p}
                </span>
            ))}
        </Reveal>
    </Section>
);

export default DentalDemo;
