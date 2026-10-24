import React from 'react';
import { Document, Page, Text, View, Svg, Path, Line, G, StyleSheet } from '@react-pdf/renderer';
import { buildChart } from '../dental/geometry';
import { STATUSES, STATUS_ORDER, toothLabel } from '../dental/teeth';
import { parseSections } from '../dental/sections';

const INK = '#000000';
const MUTED = '#6b7689';
// A4 width minus the page's side padding.
const MAX_CHART_W = 595 - 80;

const styles = StyleSheet.create({
    page: { paddingVertical: 34, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 10, color: INK },
    eyebrow: { fontSize: 8, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
    title: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
    sub: { fontSize: 9, color: MUTED, marginBottom: 14 },
    chartWrap: { alignItems: 'center', marginBottom: 10 },
    legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14 },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 6, marginBottom: 3 },
    legendText: { fontSize: 8, color: MUTED, marginLeft: 4 },
    swatch: { width: 8, height: 8, borderRadius: 2, borderWidth: 1 },
    sectionLabel: { fontSize: 8, letterSpacing: 1.2, color: MUTED, fontFamily: 'Helvetica-Bold', marginBottom: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e7ecf3' },
    findings: { flexDirection: 'row', flexWrap: 'wrap' },
    finding: { width: '50%', flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3, paddingRight: 10 },
    findingId: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, width: 24, marginLeft: 6 },
    findingBody: { flex: 1, fontSize: 9 },
    findingStatus: { fontFamily: 'Helvetica-Bold' },
    findingNote: { color: MUTED },
    empty: { fontSize: 9, color: MUTED },
    heading: { fontSize: 11.5, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 4 },
    body: { fontSize: 10.5, lineHeight: 1.5 },
    footer: { position: 'absolute', bottom: 18, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: '#9aa3b2' }
});

const Swatch = ({ s }) => {
    const st = STATUSES[s] || STATUSES.normal;
    return <View style={[styles.swatch, { backgroundColor: st.fill === 'none' ? '#ffffff' : st.fill, borderColor: st.cross || st.stroke, borderStyle: st.dashed ? 'dashed' : 'solid' }]} />;
};

// "Missing 108" on the left of the arch, "208 Missing" on the right. The number stays where a plain label
// would be and the status grows away from the arch. Two texts, since react-pdf can't flow one Tspan after another.
const StatusLabel = ({ t, text, font, style }) => {
    const [x, y] = [t.label[0], t.label[1] + font * 0.35];
    const half = font * 0.834;
    const gap = font * 0.278;
    if (x < 0) {
        return (
            <>
                <Text x={x - half - gap} y={y} textAnchor="end" fill={INK} style={{ ...style, fontFamily: 'Helvetica-Bold' }}>{text}</Text>
                <Text x={x} y={y} textAnchor="middle" fill={INK} style={style}>{t.id}</Text>
            </>
        );
    }
    return (
        <>
            <Text x={x} y={y} textAnchor="middle" fill={INK} style={style}>{t.id}</Text>
            <Text x={x + half + gap} y={y} fill={INK} style={{ ...style, fontFamily: 'Helvetica-Bold' }}>{text}</Text>
        </>
    );
};

const ChartSvg = ({ species, teeth, height }) => {
    const chart = buildChart(species);
    const { unit } = chart;
    const font = unit * 3.1;
    // Extra room either side for "Retained deciduous 108" style labels.
    const side = font * 7;
    const bounds = { ...chart.bounds, minX: chart.bounds.minX - side, maxX: chart.bounds.maxX + side };
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const scale = Math.min(height / h, MAX_CHART_W / w);
    const stroke = 0.9 / scale;
    const midY = (chart.upperDepth + chart.lowerTop) / 2;
    const label = { fontSize: font, fontFamily: 'Helvetica' };
    return (
        <Svg width={w * scale} height={h * scale} viewBox={`${bounds.minX} ${bounds.minY} ${w} ${h}`}>
            <Line x1={0} x2={0} y1={bounds.minY + unit * 4} y2={bounds.maxY - unit * 4} stroke="#e3e8ef" strokeWidth={stroke} strokeDasharray={`${unit.toFixed(3)}, ${unit.toFixed(3)}`} />
            <Text x={chart.bounds.minX + unit} y={midY + font * 0.35} fill="#9aa3b2" style={{ ...label, fontSize: font * 0.95 }}>RIGHT</Text>
            <Text x={chart.bounds.maxX - unit} y={midY + font * 0.35} fill="#9aa3b2" textAnchor="end" style={{ ...label, fontSize: font * 0.95 }}>LEFT</Text>
            {chart.teeth.map((t) => {
                const st = STATUSES[teeth[t.id]?.status] || STATUSES.normal;
                return (
                    <G key={t.id}>
                        <Path
                            d={t.path}
                            fill={st.fill === 'none' ? '#ffffff' : st.fill}
                            stroke={st.stroke}
                            strokeWidth={teeth[t.id] ? stroke * 1.5 : stroke}
                            {...(st.dashed ? { strokeDasharray: `${(stroke * 3).toFixed(3)}, ${(stroke * 2.5).toFixed(3)}` } : {})}
                        />
                        {st.cross && t.cross.map(([a, b], i) => (
                            <Line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={st.cross} strokeWidth={stroke * 1.6} strokeLinecap="round" />
                        ))}
                        {st === STATUSES.normal ? (
                            <Text x={t.label[0]} y={t.label[1] + font * 0.35} textAnchor="middle" fill={teeth[t.id] ? INK : '#8a94a6'} style={label}>
                                {t.id}
                            </Text>
                        ) : (
                            <StatusLabel t={t} text={st.label} font={font} style={label} />
                        )}
                    </G>
                );
            })}
        </Svg>
    );
};

// Page 1: full chart with every charted tooth listed underneath. Page 2+: the record text.
export const DentalPages = ({ title, report, dental }) => {
    const species = dental?.species === 'feline' ? 'feline' : 'canine';
    const teeth = dental?.teeth || {};
    const ids = Object.keys(teeth).sort();
    const used = STATUS_ORDER.filter((s) => s !== 'normal' && ids.some((id) => teeth[id].status === s));
    const chartHeight = ids.length > 24 ? 400 : ids.length > 12 ? 450 : 500;
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const sections = parseSections(report);

    const Footer = () => (
        <View style={styles.footer} fixed>
            <Text>{title}</Text>
            <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
    );

    return (
        <>
            <Page size="A4" style={styles.page}>
                <Text style={styles.eyebrow}>DENTAL CHART</Text>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.sub}>
                    {species === 'feline' ? 'Feline' : 'Canine'} · Modified Triadan · {ids.length} {ids.length === 1 ? 'tooth' : 'teeth'} charted · {date}
                </Text>

                <View style={styles.chartWrap}>
                    <ChartSvg species={species} teeth={teeth} height={chartHeight} />
                </View>

                <View style={styles.legend}>
                    {['normal', ...used].map((s) => (
                        <View key={s} style={styles.legendItem}>
                            <Swatch s={s} />
                            <Text style={styles.legendText}>{STATUSES[s].label}</Text>
                        </View>
                    ))}
                </View>

                <Text style={styles.sectionLabel}>TOOTH FINDINGS</Text>
                {ids.length ? (
                    <View style={styles.findings}>
                        {ids.map((id) => (
                            <View key={id} style={styles.finding} wrap={false}>
                                <Swatch s={teeth[id].status} />
                                <Text style={styles.findingId}>{id}</Text>
                                <Text style={styles.findingBody}>
                                    <Text style={styles.findingStatus}>{STATUSES[teeth[id].status]?.label}</Text>
                                    <Text style={styles.findingNote}>{` · ${toothLabel(species, id)}`}</Text>
                                    {teeth[id].note ? <Text>{`\n${teeth[id].note}`}</Text> : null}
                                </Text>
                            </View>
                        ))}
                    </View>
                ) : (
                    <Text style={styles.empty}>No teeth charted.</Text>
                )}
                <Footer />
            </Page>

            <Page size="A4" style={styles.page}>
                <Text style={styles.eyebrow}>DENTAL RECORD</Text>
                <Text style={[styles.title, { marginBottom: 6 }]}>{title}</Text>
                {sections.map((s, i) => (
                    <View key={i} wrap>
                        {s.heading && <Text style={styles.heading} minPresenceAhead={30}>{s.heading}</Text>}
                        {s.body ? <Text style={styles.body}>{s.body}</Text> : null}
                    </View>
                ))}
                <Footer />
            </Page>
        </>
    );
};

const DentalPDFDocument = ({ title, report, dental }) => (
    <Document title={title}>
        <DentalPages title={title} report={report} dental={dental} />
    </Document>
);

export default DentalPDFDocument;
