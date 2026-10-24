import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useSpring } from 'framer-motion';
import { FiMinus, FiPlus, FiMaximize2, FiX } from 'react-icons/fi';
import { PiCat, PiDog } from 'react-icons/pi';
import DentalChart, { ChartLegend, Swatch } from './DentalChart';
import { SPECIES_LABEL } from './DentalSpeciesPicker';
import { buildChart } from '../dental/geometry';
import { STATUSES, STATUS_ORDER, toothLabel } from '../dental/teeth';

const FONT = { fontFamily: 'var(--font-sans)' };
const SPRING = { stiffness: 210, damping: 30, mass: 0.9 };
const MAX_ZOOM = 5;
const POP_W = 252;
const GAP = 10;
// Labels grow with zoom^0.6 instead of zoom, so a 4x zoom gives about 2.3x numbers, not 4x.
const LABEL_GROWTH = 0.6;
// Share of the area the full chart fills at zoom 1.
const FIT = 0.92;

const REGIONS = [
    { id: 'full', label: 'Full mouth' },
    { id: 'upper', label: 'Upper', q: [1, 2] },
    { id: 'lower', label: 'Lower', q: [3, 4] },
    { id: 'q1', label: '100', title: 'Right maxilla', q: [1] },
    { id: 'q2', label: '200', title: 'Left maxilla', q: [2] },
    { id: 'q3', label: '300', title: 'Left mandible', q: [3] },
    { id: 'q4', label: '400', title: 'Right mandible', q: [4] },
    { id: 'incisors', label: 'Incisors', incisors: true }
];

const ICON_BTN = 'w-8 h-8 flex items-center justify-center border-none cursor-pointer bg-transparent text-[#1a2b4a]/65 hover:text-[#13233f] hover:bg-[#f6f8fb] disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent transition-colors';
const FLOAT_BTN = 'w-8 h-8 flex items-center justify-center border border-[#e7ecf3] cursor-pointer bg-white text-[#1a2b4a]/65 hover:text-[#13233f] shadow-[0_6px_16px_-10px_rgba(19,35,63,0.35)] transition-colors';

// Zoomable, pannable chart with a per-tooth popover. `dental` is { species, teeth: { [id]: { status, note } } }.
// `onToothCommit(id, before, after)` fires once when a tooth's popover closes with changes.
const DentalChartCanvas = ({ dental, onChange, height, onExpand, onToothCommit }) => {
    const species = dental?.species === 'feline' ? 'feline' : 'canine';
    const teeth = useMemo(() => dental?.teeth || {}, [dental]);
    const teethRef = useRef(teeth);
    const commitRef = useRef(onToothCommit);
    teethRef.current = teeth;
    commitRef.current = onToothCommit;
    const chart = useMemo(() => buildChart(species), [species]);
    const full = useMemo(() => {
        const b = chart.bounds;
        const font = chart.unit * 3.4;
        // Room above and below for up to three rows of feline incisor callouts, fixed so the view doesn't jump.
        const pad = species === 'feline' ? font * 5.4 : 0;
        return { x: b.minX, y: b.minY - pad, w: b.maxX - b.minX, h: b.maxY - b.minY + pad * 2, font };
    }, [chart, species]);

    const [selected, setSelected] = useState(null);
    const [region, setRegion] = useState('full');
    const [zoom, setZoom] = useState(1);
    const [panning, setPanning] = useState(false);
    const svgRef = useRef(null);
    const areaRef = useRef(null);
    const popRef = useRef(null);
    const selectedRef = useRef(null);
    const target = useRef({ z: 1, cx: full.x + full.w / 2, cy: full.y + full.h / 2 });
    const drag = useRef(null);
    const suppressClick = useRef(false);
    const sizeRef = useRef({ w: 1, h: 1 });
    selectedRef.current = selected;

    // The svg fills the whole area; the camera works in chart units on top of a "fit" scale (px per unit).
    const viewSize = useCallback((zz) => {
        const { w, h } = sizeRef.current;
        const scale = Math.min(w / full.w, h / full.h) * FIT * zz;
        return { vw: w / scale, vh: h / scale, scale };
    }, [full]);

    const z = useSpring(1, SPRING);
    const cx = useSpring(full.x + full.w / 2, SPRING);
    const cy = useSpring(full.y + full.h / 2, SPRING);

    // Beside the tooth when there's room, otherwise above or below. Written straight to the DOM so it
    // can follow the tooth every animation frame without re-rendering the chart.
    const placePop = useCallback(() => {
        const pop = popRef.current;
        const area = areaRef.current;
        const id = selectedRef.current;
        const tooth = id && area?.querySelector(`[data-tooth="${id}"]`);
        if (!pop || !tooth) return;
        const a = area.getBoundingClientRect();
        const r = tooth.getBoundingClientRect();
        const h = pop.offsetHeight;
        const tx = r.left + r.width / 2 - a.left;
        const ty = r.top + r.height / 2 - a.top;
        const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
        const roomRight = a.width - (r.right - a.left) - GAP;
        const roomLeft = r.left - a.left - GAP;
        let left;
        let top;
        if (Math.max(roomRight, roomLeft) >= POP_W + 8) {
            left = roomRight >= POP_W + 8 && (tx < a.width / 2 || roomLeft < POP_W + 8) ? r.right - a.left + GAP : r.left - a.left - GAP - POP_W;
            top = ty - h / 2;
        } else {
            left = tx - POP_W / 2;
            top = ty < a.height / 2 ? r.bottom - a.top + GAP : r.top - a.top - GAP - h;
        }
        const inView = tx > 0 && tx < a.width && ty > 0 && ty < a.height;
        pop.style.left = `${clamp(left, 8, a.width - POP_W - 8)}px`;
        pop.style.top = `${clamp(top, 8, Math.max(8, a.height - h - 8))}px`;
        pop.style.visibility = inView ? 'visible' : 'hidden';
    }, []);

    const apply = useCallback(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const zz = z.get();
        const { vw, vh } = viewSize(zz);
        svg.setAttribute('viewBox', `${cx.get() - vw / 2} ${cy.get() - vh / 2} ${vw} ${vh}`);
        svg.style.setProperty('--tf', `${full.font * Math.pow(zz, LABEL_GROWTH - 1)}px`);
        placePop();
    }, [z, cx, cy, full, viewSize, placePop]);

    useLayoutEffect(() => {
        const el = areaRef.current;
        if (!el) return undefined;
        const measure = () => {
            const r = el.getBoundingClientRect();
            sizeRef.current = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
            apply();
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [apply]);

    useEffect(() => {
        const subs = [z, cx, cy].map((v) => v.on('change', apply));
        apply();
        return () => subs.forEach((off) => off());
    }, [z, cx, cy, apply]);

    const go = useCallback((next, instant = false) => {
        const zz = Math.min(MAX_ZOOM, Math.max(1, next.z));
        const { vw, vh } = viewSize(zz);
        // The chart's edge can come in a little past the area's edge, never further.
        const slack = zz > 1.01 ? 0.12 : 0;
        const rx = Math.max(0, (full.w - vw) / 2) + vw * slack;
        const ry = Math.max(0, (full.h - vh) / 2) + vh * slack;
        const mx = full.x + full.w / 2;
        const my = full.y + full.h / 2;
        const v = {
            z: zz,
            cx: Math.min(mx + rx, Math.max(mx - rx, next.cx)),
            cy: Math.min(my + ry, Math.max(my - ry, next.cy))
        };
        target.current = v;
        [[z, v.z], [cx, v.cx], [cy, v.cy]].forEach(([mv, val]) => (instant ? mv.jump(val) : mv.set(val)));
        if (instant) apply();
        setZoom(v.z);
    }, [full, z, cx, cy, apply, viewSize]);

    // Keeps the chart point under the cursor fixed while zooming.
    const zoomAt = useCallback((clientX, clientY, factor) => {
        const rect = areaRef.current.getBoundingClientRect();
        const t = target.current;
        const { vw, vh } = viewSize(t.z);
        const fx = (clientX - rect.left) / rect.width;
        const fy = (clientY - rect.top) / rect.height;
        const px = t.cx - vw / 2 + fx * vw;
        const py = t.cy - vh / 2 + fy * vh;
        const nz = Math.min(MAX_ZOOM, Math.max(1, t.z * factor));
        const n = viewSize(nz);
        go({ z: nz, cx: px - fx * n.vw + n.vw / 2, cy: py - fy * n.vh + n.vh / 2 });
        setRegion(nz <= 1.01 ? 'full' : null);
    }, [go, viewSize]);

    const zoomBy = (factor) => {
        const t = target.current;
        go({ ...t, z: t.z * factor });
        setRegion(t.z * factor <= 1.01 ? 'full' : null);
    };

    const focus = (r) => {
        setRegion(r.id);
        if (r.id === 'full' || !svgRef.current) return go({ z: 1, cx: full.x + full.w / 2, cy: full.y + full.h / 2 });
        const els = [...svgRef.current.querySelectorAll('[data-tooth]')].filter((g) =>
            r.incisors ? Number(g.dataset.tooth.slice(1)) <= 3 : r.q.includes(Number(g.dataset.quadrant))
        );
        if (!els.length) return;
        const boxes = els.map((g) => g.getBBox());
        const x0 = Math.min(...boxes.map((b) => b.x));
        const y0 = Math.min(...boxes.map((b) => b.y));
        const x1 = Math.max(...boxes.map((b) => b.x + b.width));
        const y1 = Math.max(...boxes.map((b) => b.y + b.height));
        const pad = Math.max(x1 - x0, y1 - y0) * 0.08;
        const { w, h } = sizeRef.current;
        const fit = Math.min(w / full.w, h / full.h) * FIT;
        const zz = Math.min(w / (x1 - x0 + pad * 2), h / (y1 - y0 + pad * 2)) / fit;
        go({ z: zz, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
    };

    // Reset the camera when the species (and so the chart) changes.
    useEffect(() => {
        setSelected(null);
        setRegion('full');
        go({ z: 1, cx: full.x + full.w / 2, cy: full.y + full.h / 2 }, true);
    }, [full, go]);

    // Pinch on a trackpad arrives as ctrl+wheel; cmd/ctrl+wheel on a mouse zooms too. Plain scroll stays page scroll.
    useEffect(() => {
        const el = areaRef.current;
        if (!el) return undefined;
        const onWheel = (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            const d = Math.max(-50, Math.min(50, e.deltaY));
            zoomAt(e.clientX, e.clientY, Math.exp(-d * 0.01));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [zoomAt]);

    // Drag pans once zoomed. A press only counts as a drag past 4px, so tooth clicks still land.
    const onPointerDown = (e) => {
        if (e.button !== 0 || target.current.z <= 1.01 || popRef.current?.contains(e.target)) return;
        drag.current = { x: e.clientX, y: e.clientY, start: { ...target.current }, moved: false };
    };
    const onPointerMove = (e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.moved) {
            if (Math.hypot(dx, dy) < 4) return;
            d.moved = true;
            areaRef.current.setPointerCapture?.(e.pointerId);
            setPanning(true);
            setRegion(null);
        }
        const k = 1 / viewSize(d.start.z).scale;
        go({ z: d.start.z, cx: d.start.cx - dx * k, cy: d.start.cy - dy * k }, true);
    };
    const onPointerUp = () => {
        const d = drag.current;
        drag.current = null;
        if (d?.moved) {
            suppressClick.current = true;
            setPanning(false);
            setTimeout(() => {
                suppressClick.current = false;
            }, 0);
        }
    };
    const onDoubleClick = (e) => {
        if (e.target.closest('[data-tooth]') || popRef.current?.contains(e.target)) return;
        zoomAt(e.clientX, e.clientY, 1.8);
    };

    const onToothClick = useCallback((id) => {
        if (suppressClick.current) return;
        setSelected((cur) => (cur === id ? null : id));
    }, []);

    useLayoutEffect(() => {
        placePop();
    }, [selected, placePop]);

    useEffect(() => {
        if (!selected) return undefined;
        const onClick = (e) => {
            if (suppressClick.current || popRef.current?.contains(e.target) || e.target.closest?.('[data-tooth]') || e.target.closest?.('[data-tooth-chip]') || e.target.closest?.('[data-chart-toolbar]')) return;
            setSelected(null);
        };
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            setSelected(null);
        };
        window.addEventListener('click', onClick);
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', placePop);
        return () => {
            window.removeEventListener('click', onClick);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', placePop);
        };
    }, [selected, placePop]);

    const setTooth = (id, patch) => {
        const merged = { status: 'normal', ...(teeth[id] || {}), ...patch };
        const { [id]: _, ...rest } = teeth;
        onChange({ ...dental, species, teeth: merged.status === 'normal' && !merged.note ? rest : { ...teeth, [id]: merged } });
    };

    useEffect(() => {
        if (!selected) return undefined;
        const before = teethRef.current[selected] || {};
        return () => {
            const after = teethRef.current[selected] || {};
            if (before.status !== after.status || (before.note || '') !== (after.note || '')) commitRef.current?.(selected, before, after);
        };
    }, [selected]);

    const current = selected ? teeth[selected] || { status: 'normal' } : null;
    const charted = Object.keys(teeth).sort();

    return (
        <div style={FONT}>
            <div data-chart-toolbar className="flex items-center gap-2 px-4 sm:px-5 pt-4">
                <div className="flex-1 min-w-0 overflow-x-auto [scrollbar-width:none]">
                    <div className="inline-flex gap-0.5 p-0.5 rounded-full bg-[#f3f6fa]">
                        {REGIONS.map((r) => (
                            <button
                                key={r.id}
                                type="button"
                                title={r.title}
                                onClick={() => focus(r)}
                                className={`h-7 px-2.5 rounded-full text-[12px] font-semibold whitespace-nowrap border-none cursor-pointer transition-colors ${region === r.id ? 'bg-white text-[#13233f] shadow-[0_1px_3px_rgba(19,35,63,0.12)]' : 'bg-transparent text-[#1a2b4a]/55 hover:text-[#13233f]'}`}
                                style={{ fontFeatureSettings: "'tnum'" }}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-violet-50 text-violet-700 text-[12px] font-semibold">
                    {React.createElement(species === 'feline' ? PiCat : PiDog, { className: 'text-[14px]' })}
                    {SPECIES_LABEL[species]}
                </span>
            </div>

            <div
                ref={areaRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={onDoubleClick}
                className="relative mx-4 sm:mx-5 mt-3 rounded-[20px] bg-[#fbfcfe] border border-[#eef2f7] overflow-hidden"
                style={{ height, cursor: panning ? 'grabbing' : zoom > 1.01 ? 'grab' : 'default', touchAction: zoom > 1.01 ? 'none' : 'auto' }}
            >
                <DentalChart species={species} teeth={teeth} selected={selected} onToothClick={onToothClick} showLegend={false} statusLabels fill svgRef={svgRef} className="absolute inset-0" />

                <div data-chart-toolbar className="absolute top-3 right-3 z-10 flex flex-col gap-1.5" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                    {onExpand && (
                        <button type="button" onClick={onExpand} title="Expand chart" className={`${FLOAT_BTN} rounded-full`}>
                            <FiMaximize2 className="text-[13px]" />
                        </button>
                    )}
                    <div className="flex flex-col rounded-full bg-white border border-[#e7ecf3] shadow-[0_6px_16px_-10px_rgba(19,35,63,0.35)] overflow-hidden">
                        <button type="button" className={ICON_BTN} onClick={() => zoomBy(1.5)} disabled={zoom >= MAX_ZOOM - 0.01} title="Zoom in">
                            <FiPlus className="text-[14px]" />
                        </button>
                        <span className="mx-2 h-px bg-[#eef2f7]" />
                        <button type="button" className={ICON_BTN} onClick={() => zoomBy(1 / 1.5)} disabled={zoom <= 1.01} title="Zoom out">
                            <FiMinus className="text-[14px]" />
                        </button>
                    </div>
                </div>

                <p className="absolute left-3 bottom-2 m-0 text-[11px] text-[#1a2b4a]/35 pointer-events-none hidden md:block">
                    {zoom > 1.01 ? 'Drag to move · double-click to zoom' : 'Pinch or ⌘ scroll to zoom'}
                </p>

                <AnimatePresence>
                    {selected && (
                        <motion.div
                            key="tooth-pop"
                            ref={popRef}
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: panning ? 0 : 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ duration: 0.16, ease: 'easeOut' }}
                            className="absolute z-20 rounded-[18px] bg-white border border-[#e7ecf3] p-3 shadow-[0_24px_48px_-20px_rgba(19,35,63,0.35)] cursor-default"
                            style={{ width: POP_W, pointerEvents: panning ? 'none' : 'auto' }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start gap-2.5 px-1 pb-2.5">
                                <span className="text-[18px] font-semibold text-[#13233f] leading-none pt-0.5" style={{ fontFeatureSettings: "'tnum'" }}>{selected}</span>
                                <span className="text-[12px] text-[#1a2b4a]/55 leading-snug">{toothLabel(species, selected)}</span>
                                <button type="button" onClick={() => setSelected(null)} className="ml-auto -mr-1 -mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[#1a2b4a]/40 hover:text-[#13233f] hover:bg-[#f3f6fa] border-none bg-transparent cursor-pointer" title="Close">
                                    <FiX className="text-[14px]" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                                {STATUS_ORDER.map((s) => {
                                    const on = (current?.status || 'normal') === s;
                                    return (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setTooth(selected, { status: s })}
                                            className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-[12.5px] font-medium text-left cursor-pointer border transition-colors ${on ? 'bg-[#eef4fc] border-[#2d5fb8]/35 text-[#13233f]' : 'bg-transparent border-transparent text-[#1a2b4a]/75 hover:bg-[#f6f8fb]'}`}
                                        >
                                            <Swatch s={s} className="w-3 h-3" />
                                            {STATUSES[s].label}
                                        </button>
                                    );
                                })}
                            </div>
                            <input
                                value={current?.note || ''}
                                onChange={(e) => setTooth(selected, { note: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && setSelected(null)}
                                placeholder="Note, e.g. PD4, mobility 2"
                                className="mt-2 w-full px-3 py-2 rounded-xl bg-[#f6f8fb] border border-transparent text-[13px] text-[#13233f] focus:outline-none focus:bg-white focus:border-[#2d5fb8]/30"
                                style={FONT}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <ChartLegend teeth={teeth} className="mt-3 px-4" />

            <div className="px-4 sm:px-5 pt-3 pb-5">
                {charted.length ? (
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {charted.map((id) => (
                            <button
                                key={id}
                                type="button"
                                data-tooth-chip
                                onClick={() => setSelected(id)}
                                title={teeth[id].note || STATUSES[teeth[id].status]?.label}
                                className={`inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full text-[12px] font-semibold border cursor-pointer transition-colors ${selected === id ? 'bg-[#eef4fc] border-[#2d5fb8]/35 text-[#13233f]' : 'bg-white border-[#e7ecf3] text-[#13233f]/80 hover:border-[#d3dceb]'}`}
                                style={{ fontFeatureSettings: "'tnum'" }}
                            >
                                <Swatch s={teeth[id].status} />
                                {id}
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="m-0 text-center text-[13px] text-[#1a2b4a]/45">No teeth charted yet. Click a tooth to add a finding.</p>
                )}
            </div>
        </div>
    );
};

export default DentalChartCanvas;
