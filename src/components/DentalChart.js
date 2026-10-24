import React, { memo, useMemo, useState } from 'react';
import { buildChart } from '../dental/geometry';
import { STATUSES, STATUS_ORDER } from '../dental/teeth';

export const Swatch = ({ s, className = 'w-2.5 h-2.5' }) => {
    const st = STATUSES[s] || STATUSES.normal;
    return (
        <span
            className={`shrink-0 rounded-[3px] ${className}`}
            style={{ background: st.fill === 'none' ? 'transparent' : st.fill, border: `1.5px ${st.dashed ? 'dashed' : 'solid'} ${st.cross || st.stroke}` }}
        />
    );
};

export const ChartLegend = ({ teeth = {}, className = '' }) => {
    const used = new Set(Object.values(teeth).map((t) => t?.status).filter(Boolean));
    return (
        <div className={`flex flex-wrap justify-center gap-1.5 ${className}`}>
            {STATUS_ORDER.filter((s) => s === 'normal' || used.has(s) || !used.size).map((s) => (
                <span key={s} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${STATUSES[s].chip}`}>
                    <Swatch s={s} />
                    {STATUSES[s].label}
                </span>
            ))}
        </div>
    );
};

// With `statusLabels`, a charted tooth reads "Missing 108". The number stays put and the status grows outward, away from the arch.
const labelAnchor = (t, st) => {
    if (st === STATUSES.normal) return { textAnchor: 'middle' };
    const left = t.label[0] < 0;
    return { textAnchor: left ? 'end' : 'start', transform: `translateX(calc(var(--tf) * ${left ? 0.9 : -0.9}))` };
};

// Top-down canine/feline chart. `teeth` maps Triadan id -> { status }; unlisted teeth are normal.
// Label size reads `--tf` so a zooming parent can keep labels from growing with the zoom.
// `maxHeight` caps the width by aspect ratio instead of letterboxing. `fill` stretches the svg over its parent
// for a parent that drives the viewBox itself.
const DentalChart = ({ species = 'canine', teeth = {}, selected = null, onToothClick, showLegend = true, statusLabels = false, className = '', maxHeight, fill = false, svgRef }) => {
    const chart = useMemo(() => buildChart(species), [species]);
    const [hover, setHover] = useState(null);
    if (!chart) return null;

    const { bounds, unit } = chart;
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const font = unit * 3.4;
    const midY = (chart.upperDepth + chart.lowerTop) / 2;
    const fs = (k = 1) => ({ fontSize: k === 1 ? 'var(--tf)' : `calc(var(--tf) * ${k})` });

    return (
        <div className={className}>
            <svg
                ref={svgRef}
                viewBox={`${bounds.minX} ${bounds.minY} ${w} ${h}`}
                className={`block select-none ${fill ? 'w-full h-full' : 'w-full h-auto mx-auto'}`}
                style={{ '--tf': `${font}px`, ...(maxHeight ? { maxWidth: `calc(${maxHeight} * ${(w / h).toFixed(4)})` } : {}) }}
                role="img"
                aria-label={`${species === 'feline' ? 'Feline' : 'Canine'} dental chart`}
            >
                <text x={bounds.minX + unit * 1.5} y={midY} style={fs(1.05)} fontWeight="600" fill="#1a2b4a" fillOpacity="0.35" dominantBaseline="middle" letterSpacing="0.08em">RIGHT</text>
                <text x={bounds.maxX - unit * 1.5} y={midY} style={fs(1.05)} fontWeight="600" fill="#1a2b4a" fillOpacity="0.35" dominantBaseline="middle" textAnchor="end" letterSpacing="0.08em">LEFT</text>
                <line x1={0} x2={0} y1={bounds.minY + unit * 4} y2={bounds.maxY - unit * 4} stroke="#1a2b4a" strokeOpacity="0.06" strokeDasharray={`${unit} ${unit}`} vectorEffect="non-scaling-stroke" />
                <text x={0} y={chart.upperDepth * 0.42} style={fs()} fill="#1a2b4a" fillOpacity="0.3" textAnchor="middle" letterSpacing="0.08em">MAXILLA</text>
                <text x={0} y={chart.lowerTop + (bounds.maxY - chart.lowerTop) * 0.58} style={fs()} fill="#1a2b4a" fillOpacity="0.3" textAnchor="middle" letterSpacing="0.08em">MANDIBLE</text>

                {chart.teeth.map((t) => {
                    const st = STATUSES[teeth[t.id]?.status] || STATUSES.normal;
                    const isSel = selected === t.id;
                    const isHover = hover === t.id;
                    const anchor = labelAnchor(t, statusLabels ? st : STATUSES.normal);
                    return (
                        <g
                            key={t.id}
                            data-tooth={t.id}
                            data-quadrant={t.quadrant}
                            onClick={onToothClick ? (e) => onToothClick(t.id, e) : undefined}
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
                                <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={st.cross} strokeWidth={1.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                            ))}
                            <text
                                x={t.label[0]}
                                y={t.label[1]}
                                textAnchor={anchor.textAnchor}
                                dominantBaseline="middle"
                                style={{ ...fs(), fontFeatureSettings: "'tnum'", transform: anchor.transform }}
                            >
                                {statusLabels && st !== STATUSES.normal && (
                                    <tspan fill="#16191f" fontWeight={600}>{`${st.label} `}</tspan>
                                )}
                                <tspan fill={isSel || isHover ? '#2d5fb8' : '#1a2b4a'} fillOpacity={isSel || isHover ? 1 : 0.5} fontWeight={isSel ? 700 : 500}>
                                    {t.id}
                                </tspan>
                            </text>
                        </g>
                    );
                })}
            </svg>
            {showLegend && <ChartLegend teeth={teeth} className="mt-3" />}
        </div>
    );
};

export default memo(DentalChart);
