import React, { useMemo, useState } from 'react';
import { buildChart } from '../dental/geometry';
import { STATUSES, STATUS_ORDER } from '../dental/teeth';

// Top-down canine/feline chart. `teeth` maps Triadan id -> { status }; unlisted teeth are normal.
const DentalChart = ({ species = 'canine', teeth = {}, selected = null, onToothClick, showLegend = true, className = '' }) => {
    const chart = useMemo(() => buildChart(species), [species]);
    const [hover, setHover] = useState(null);
    if (!chart) return null;

    const { bounds, unit } = chart;
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const font = unit * 3.4;
    const midY = (chart.upperDepth + chart.lowerTop) / 2;
    const used = new Set(Object.values(teeth).map((t) => t?.status).filter(Boolean));

    return (
        <div className={className}>
            <svg viewBox={`${bounds.minX} ${bounds.minY} ${w} ${h}`} className="block w-full h-auto select-none" role="img" aria-label={`${species === 'feline' ? 'Feline' : 'Canine'} dental chart`}>
                <text x={bounds.minX + unit * 1.5} y={midY} fontSize={font * 1.05} fontWeight="600" fill="#1a2b4a" fillOpacity="0.35" dominantBaseline="middle" letterSpacing="0.08em">RIGHT</text>
                <text x={bounds.maxX - unit * 1.5} y={midY} fontSize={font * 1.05} fontWeight="600" fill="#1a2b4a" fillOpacity="0.35" dominantBaseline="middle" textAnchor="end" letterSpacing="0.08em">LEFT</text>
                <line x1={0} x2={0} y1={bounds.minY + unit * 4} y2={bounds.maxY - unit * 4} stroke="#1a2b4a" strokeOpacity="0.06" strokeDasharray={`${unit} ${unit}`} vectorEffect="non-scaling-stroke" />
                <text x={0} y={chart.upperDepth * 0.42} fontSize={font} fill="#1a2b4a" fillOpacity="0.3" textAnchor="middle" letterSpacing="0.08em">MAXILLA</text>
                <text x={0} y={chart.lowerTop + (bounds.maxY - chart.lowerTop) * 0.58} fontSize={font} fill="#1a2b4a" fillOpacity="0.3" textAnchor="middle" letterSpacing="0.08em">MANDIBLE</text>

                {chart.teeth.map((t) => {
                    const st = STATUSES[teeth[t.id]?.status] || STATUSES.normal;
                    const isSel = selected === t.id;
                    const isHover = hover === t.id;
                    return (
                        <g
                            key={t.id}
                            onClick={onToothClick ? () => onToothClick(t.id) : undefined}
                            onMouseEnter={() => setHover(t.id)}
                            onMouseLeave={() => setHover((h0) => (h0 === t.id ? null : h0))}
                            style={{ cursor: onToothClick ? 'pointer' : 'default' }}
                        >
                            <title>{`${t.id} · ${t.label}`}</title>
                            <path
                                d={t.path}
                                fill={st.fill === 'none' ? 'transparent' : st.fill}
                                stroke={isSel ? '#2d5fb8' : st.stroke}
                                strokeWidth={isSel ? 2.4 : isHover ? 1.8 : 1.2}
                                strokeDasharray={st.dashed ? '3 2.5' : undefined}
                                vectorEffect="non-scaling-stroke"
                                style={{ transition: 'fill 160ms ease, stroke 160ms ease' }}
                            />
                            {st.cross && t.cross.map(([a, b], i) => (
                                <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={st.stroke} strokeWidth={1.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                            ))}
                            <text
                                x={t.label[0]}
                                y={t.label[1]}
                                fontSize={font}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill={isSel || isHover ? '#2d5fb8' : '#1a2b4a'}
                                fillOpacity={isSel || isHover ? 1 : 0.5}
                                fontWeight={isSel ? 700 : 500}
                                style={{ fontFeatureSettings: "'tnum'" }}
                            >
                                {t.id}
                            </text>
                        </g>
                    );
                })}
            </svg>
            {showLegend && (
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {STATUS_ORDER.filter((s) => s === 'normal' || used.has(s) || !used.size).map((s) => (
                        <span key={s} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${STATUSES[s].chip}`}>
                            <span
                                className="w-2.5 h-2.5 rounded-[3px]"
                                style={{ background: STATUSES[s].fill === 'none' ? 'transparent' : STATUSES[s].fill, border: `1.5px ${STATUSES[s].dashed ? 'dashed' : 'solid'} ${STATUSES[s].stroke}` }}
                            />
                            {STATUSES[s].label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DentalChart;
