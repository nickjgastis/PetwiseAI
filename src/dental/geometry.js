import { layoutFor } from './teeth';

// Top-down (occlusal) layout built from tooth sizes, not traced art: each side's teeth are laid
// mesial to distal along a curve, and every tooth gets an outline for its kind, turned to follow
// the arch. Coordinates are mm-ish; the chart scales them through its viewBox.

// One side of each arch, midline at x=0, incisors at y=0, caudal is +y. Rescaled to fit the teeth.
const ARCH_CURVES = {
    canine: {
        upper: [[0, 0], [9, 0], [21, 10], [31, 90]],
        lower: [[0, 0], [6, 0], [15, 10], [22, 96]]
    },
    feline: {
        upper: [[0, 0], [6, 0], [14, 5], [17.5, 30]],
        lower: [[0, 0], [4, 0], [9.5, 5], [11.5, 32]]
    }
};

const JAW_SPACING = { canine: 14, feline: 6 };

// Drawn a little plumper than life so small teeth stay readable and clickable.
const DEPTH_SCALE = 1.3;

// Incisor labels fan out from a point behind the incisor row instead of stacking on top of each other.
const INCISOR_FOCUS = { canine: { upper: 14, lower: 12 }, feline: { upper: 6, lower: 2.5 } };

const clamp0 = (n) => Math.max(0, n);
const ell = (u) => Math.sqrt(clamp0(1 - u * u));
const lens = (u) => Math.pow(clamp0(1 - u * u), 0.75);
const boxy = (u, p = 0.4) => Math.pow(clamp0(1 - Math.pow(Math.abs(u), 4)), p);
const bump = (u, c, w) => Math.exp(-(((u - c) / w) ** 2));

// Buccal (b) and lingual (l) half-depth along the tooth, u = -1 mesial to 1 distal, as a fraction of dep/2.
const PROFILES = {
    incisor: { b: (u) => boxy(u), l: (u) => boxy(u) },
    incisor3: { b: ell, l: (u) => ell(u) * 0.95 },
    canine: { b: (u) => ell(u) * (1 - 0.22 * u), l: (u) => ell(u) * (1 - 0.22 * u) },
    premolar1: { b: ell, l: ell },
    premolar: { b: (u) => lens(u) * (1 - 0.12 * bump(u, 0, 0.3)), l: (u) => lens(u) * (1 - 0.12 * bump(u, 0, 0.3)) },
    carnassialUpper: {
        b: (u) => lens(u) * 0.62,
        l: (u) => lens(u) * 0.4 + 1.05 * bump(u, -0.62, 0.22) * ell(u)
    },
    molarUpper: { b: (u) => boxy(u, 0.35) * 0.5, l: (u) => boxy(u / 0.82, 0.45) * 1.15 },
    molarUpperSmall: { b: (u) => boxy(u, 0.35) * 0.55, l: (u) => boxy(u / 0.8, 0.45) * 1.05 },
    carnassialLower: {
        b: (u) => Math.pow(clamp0(1 - u * u), 0.6) * (1 - 0.2 * bump(u, 0.32, 0.12)),
        l: (u) => Math.pow(clamp0(1 - u * u), 0.6) * (1 - 0.2 * bump(u, 0.32, 0.12))
    },
    molarLower: { b: ell, l: ell },
    molarTiny: { b: ell, l: ell },
    molarCatUpper: { b: ell, l: ell }
};

const bezier = ([p0, p1, p2, p3], t) => {
    const m = 1 - t;
    const a = m * m * m;
    const b = 3 * m * m * t;
    const c = 3 * m * t * t;
    const d = t * t * t;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
};

// Arc-length table so teeth can be placed at a distance along the curve.
function sampleCurve(ctrl, steps = 600) {
    const pts = [];
    let len = 0;
    let prev = null;
    for (let i = 0; i <= steps; i++) {
        const p = bezier(ctrl, i / steps);
        if (prev) len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
        pts.push({ p, s: len });
        prev = p;
    }
    return { pts, length: len };
}

function pointAt(curve, s) {
    const { pts } = curve;
    const target = Math.min(Math.max(s, 0), curve.length);
    let i = 1;
    while (i < pts.length - 1 && pts[i].s < target) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const f = b.s === a.s ? 0 : (target - a.s) / (b.s - a.s);
    const p = [a.p[0] + (b.p[0] - a.p[0]) * f, a.p[1] + (b.p[1] - a.p[1]) * f];
    const dx = b.p[0] - a.p[0];
    const dy = b.p[1] - a.p[1];
    const d = Math.hypot(dx, dy) || 1;
    const t = [dx / d, dy / d];
    // Outward (buccal/labial) normal for the x>0 side of an arch opening toward +y.
    return { p, t, n: [t[1], -t[0]] };
}

// Closed Catmull-Rom through the outline points, as cubic Beziers.
function smoothPath(points) {
    const n = points.length;
    const f = (v) => v.toFixed(2);
    let d = `M${f(points[0][0])},${f(points[0][1])}`;
    for (let i = 0; i < n; i++) {
        const p0 = points[(i - 1 + n) % n];
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        const p3 = points[(i + 2) % n];
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
    }
    return `${d}Z`;
}

function outline(tooth, frame, map, species, jaw) {
    const prof = PROFILES[tooth.kind] || PROFILES.premolar1;
    const N = 22;
    const local = [];
    for (let i = 0; i <= N; i++) {
        const u = -1 + (2 * i) / N;
        local.push([u, (prof.b(u) * tooth.dep * DEPTH_SCALE) / 2]);
    }
    for (let i = N - 1; i >= 1; i--) {
        const u = -1 + (2 * i) / N;
        local.push([u, (-prof.l(u) * tooth.dep * DEPTH_SCALE) / 2]);
    }
    const toWorld = ([u, v]) => {
        const x = frame.p[0] + u * (tooth.len / 2) * frame.t[0] + v * frame.n[0];
        const y = frame.p[1] + u * (tooth.len / 2) * frame.t[1] + v * frame.n[1];
        return map([x, y]);
    };
    const pts = local.filter((pt, i, arr) => i === 0 || pt[0] !== arr[i - 1][0] || pt[1] !== arr[i - 1][1]).map(toWorld);
    const reach = Math.max(...local.map(([, v]) => v));
    const r = Math.min(tooth.len, tooth.dep) * 0.45;
    const crossAt = (a, b) => toWorld([a / (tooth.len / 2), b]);
    const gapOut = species === 'canine' ? 5.8 : 2.9;
    let label = toWorld([0, reach + gapOut]);
    if (tooth.kind.startsWith('incisor')) {
        const dx = frame.p[0];
        const dy = frame.p[1] - INCISOR_FOCUS[species][jaw];
        const d = Math.hypot(dx, dy) || 1;
        const out = reach + gapOut * (species === 'feline' && jaw === 'lower' ? 2.4 : 1.6);
        label = map([frame.p[0] + (dx / d) * out, frame.p[1] + (dy / d) * out]);
    }
    return {
        path: smoothPath(pts),
        center: map(frame.p),
        label,
        cross: [
            [crossAt(-r, -r), crossAt(r, r)],
            [crossAt(-r, r), crossAt(r, -r)]
        ]
    };
}

function placeJaw(teeth, ctrl) {
    const needed = teeth.reduce((sum, t) => sum + t.gap + t.len, 0);
    const base = sampleCurve(ctrl);
    const k = needed / base.length;
    const curve = sampleCurve(ctrl.map(([x, y]) => [x * k, y * k]));
    let s = 0;
    return teeth.map((t) => {
        s += t.gap + t.len / 2;
        const frame = pointAt(curve, s);
        s += t.len / 2;
        return { tooth: t, frame };
    });
}

// Returns { teeth: [{ id, path, center, label, cross, ... }], bounds, unit }.
export function buildChart(species) {
    const layout = layoutFor(species);
    if (!layout) return null;
    const curves = ARCH_CURVES[species];
    const upper = placeJaw(layout.upper, curves.upper);
    const lower = placeJaw(layout.lower, curves.lower);

    const reachY = (placed) => Math.max(...placed.map(({ tooth, frame }) => frame.p[1] + Math.max(tooth.len, tooth.dep)));
    const upperDepth = reachY(upper);
    const lowerDepth = reachY(lower);
    const lowerTop = upperDepth + JAW_SPACING[species];

    const out = [];
    const quads = [
        { q: 1, jaw: 'upper', placed: upper, sx: -1 },
        { q: 2, jaw: 'upper', placed: upper, sx: 1 },
        { q: 3, jaw: 'lower', placed: lower, sx: 1 },
        { q: 4, jaw: 'lower', placed: lower, sx: -1 }
    ];
    quads.forEach(({ q, jaw, placed, sx }) => {
        // Patient's right is drawn on the viewer's left; the lower arch is flipped so its incisors sit at the bottom.
        const map = jaw === 'upper'
            ? ([x, y]) => [x * sx, y]
            : ([x, y]) => [x * sx, lowerTop + lowerDepth - y];
        placed.forEach(({ tooth, frame }) => {
            out.push({
                ...tooth,
                id: `${q}${String(tooth.pos).padStart(2, '0')}`,
                quadrant: q,
                jaw,
                ...outline(tooth, frame, map, species, jaw)
            });
        });
    });

    const xs = out.flatMap((t) => [t.label[0], t.center[0]]);
    const ys = out.flatMap((t) => [t.label[1], t.center[1]]);
    const pad = species === 'canine' ? 6 : 2.5;
    const bounds = {
        minX: Math.min(...xs) - pad,
        maxX: Math.max(...xs) + pad,
        minY: Math.min(...ys) - pad,
        maxY: Math.max(...ys) + pad
    };
    return {
        teeth: out,
        bounds,
        upperDepth,
        lowerTop,
        // Label size tracks the chart's width so canine and feline read the same on screen.
        unit: (bounds.maxX - bounds.minX) / 100
    };
}
