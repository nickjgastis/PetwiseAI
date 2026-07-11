import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FaChartPie, FaChartLine, FaUsers, FaCopy, FaCheck, FaSyncAlt,
    FaSearch, FaTimes, FaSignOutAlt, FaLock,
} from 'react-icons/fa';
import axios from 'axios';
import '../styles/AdminDashboard.css';

const ADMIN_USER_ID = process.env.REACT_APP_ADMIN_USER_ID;
const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.petwise.vet'
    : 'http://localhost:3001';

const BROWSER_TZ = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver'; }
    catch { return 'America/Denver'; }
})();

const BRAND = '#3468bd';

// Range presets → { start, end } + the granularity we default the chart to.
const RANGES = [
    { key: 'today', label: 'Today', gran: 'day' },
    { key: '7d', label: '7 days', gran: 'day' },
    { key: '30d', label: '30 days', gran: 'day' },
    { key: '90d', label: '90 days', gran: 'week' },
    { key: '1y', label: '1 year', gran: 'month' },
    { key: 'all', label: 'All time', gran: 'month' },
];

function rangeToDates(key) {
    const end = new Date();
    let start;
    if (key === 'today') { start = new Date(); start.setHours(0, 0, 0, 0); }
    else if (key === '7d') { start = new Date(end.getTime() - 7 * 864e5); }
    else if (key === '30d') { start = new Date(end.getTime() - 30 * 864e5); }
    else if (key === '90d') { start = new Date(end.getTime() - 90 * 864e5); }
    else if (key === '1y') { start = new Date(end.getTime() - 365 * 864e5); }
    else { start = new Date('2020-01-01T00:00:00Z'); } // all
    return { start, end };
}

const SERIES = [
    { key: 'signups', label: 'Signups', color: BRAND },
    { key: 'quicksoap', label: 'QuickSOAP', color: '#10b981' },
    { key: 'petsoap', label: 'PetSOAP', color: '#f59e0b' },
    { key: 'petquery', label: 'PetQuery', color: '#8b5cf6' },
];

// ─── Effective tier (mirrors server/usage.js) ────────────────────────────────
function tierOf(u) {
    const now = Date.now();
    const end = u.subscription_end_date ? new Date(u.subscription_end_date).getTime() : 0;
    if (u.plan_label === 'student' && end > now) return 'student';
    const active = u.subscription_status === 'active' || u.subscription_status === 'past_due';
    if (active && (u.subscription_interval === 'monthly' || u.subscription_interval === 'yearly')) return 'paid';
    return 'free';
}

function statusLabel(u) {
    if (u.cancel_at_period_end) return 'Canceling';
    const t = tierOf(u);
    if (t === 'student') return 'Student';
    if (t === 'paid') return u.subscription_interval === 'yearly' ? 'Yearly' : 'Monthly';
    return 'Free';
}

const STATUS_STYLES = {
    Canceling: 'bg-amber-100 text-amber-700',
    Student: 'bg-purple-100 text-purple-700',
    Yearly: 'bg-purple-100 text-purple-700',
    Monthly: 'bg-emerald-100 text-emerald-700',
    Free: 'bg-gray-100 text-gray-500',
};

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'free', label: 'Free' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
    { key: 'paid', label: 'All Paid' },
    { key: 'student', label: 'Student' },
    { key: 'canceling', label: 'Canceling' },
    { key: 'not_onboarded', label: 'Not Onboarded' },
];

const isOnboarded = (u) => u.has_completed_onboarding === true || u.onboarding_status === 'completed';

// ═════════════════════════════════════════════════════════════════════════════
// Reusable bits (match Profile/Usage/Billing styling)
// ═════════════════════════════════════════════════════════════════════════════
const StatCard = ({ label, value, sub, accent }) => (
    <div className={`rounded-2xl border bg-white p-5 ${accent ? 'border-[#3468bd]/30 ring-1 ring-[#3468bd]/10' : 'border-gray-200'}`}>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-3xl font-extrabold text-gray-900 mt-1.5 tabular-nums leading-none">{value}</p>
        {sub && <p className="text-[12px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
);

const SectionHeader = ({ title, subtitle, right }) => (
    <div className="flex items-end justify-between gap-3 mb-4">
        <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h2>
            {subtitle && <p className="text-[13px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {right}
    </div>
);

const Spinner = ({ label }) => (
    <div className="min-h-[100dvh] bg-[#f7f8fb] flex items-center justify-center">
        <div className="text-center">
            <div className="w-10 h-10 border-[3px] border-[#3468bd] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">{label}</p>
        </div>
    </div>
);

// ─── SVG multi-series trend chart (zero deps) ────────────────────────────────
const TrendChart = ({ data, granularity, visible }) => {
    const [hover, setHover] = useState(null);
    const W = 1000, H = 320, padL = 44, padR = 16, padT = 16, padB = 34;
    const innerW = W - padL - padR, innerH = H - padT - padB;

    const active = SERIES.filter(s => visible[s.key]);
    const maxVal = useMemo(() => {
        let m = 0;
        data.forEach(d => active.forEach(s => { if (d[s.key] > m) m = d[s.key]; }));
        return Math.max(m, 1);
    }, [data, active]);

    if (!data.length) {
        return <div className="text-center text-gray-400 text-sm py-16">No data in this range yet.</div>;
    }

    const n = data.length;
    const x = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = (v) => padT + innerH - (v / maxVal) * innerH;

    const fmtBucket = (b) => {
        const d = new Date(b);
        if (granularity === 'month') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: BROWSER_TZ });
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: BROWSER_TZ });
    };

    // y gridlines (4 steps)
    const ticks = 4;
    const gridVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((maxVal / ticks) * i));

    // sparse x labels (~8 max)
    const labelStep = Math.max(1, Math.ceil(n / 8));

    return (
        <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }} preserveAspectRatio="none"
                onMouseLeave={() => setHover(null)}>
                {gridVals.map((v, i) => (
                    <g key={i}>
                        <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#eef0f4" strokeWidth={1} />
                        <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#9ca3af">{v}</text>
                    </g>
                ))}
                {data.map((d, i) => (
                    (i % labelStep === 0 || i === n - 1) && (
                        <text key={i} x={x(i)} y={H - 12} textAnchor="middle" fontSize={11} fill="#9ca3af">{fmtBucket(d.bucket)}</text>
                    )
                ))}
                {active.map(s => {
                    const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d[s.key])}`).join(' ');
                    return <path key={s.key} d={path} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
                })}
                {hover !== null && (
                    <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 3" />
                )}
                {hover !== null && active.map(s => (
                    <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key])} r={4} fill="#fff" stroke={s.color} strokeWidth={2.5} />
                ))}
                {/* hover hit areas */}
                {data.map((d, i) => (
                    <rect key={i} x={x(i) - (innerW / n) / 2} y={padT} width={Math.max(innerW / n, 2)} height={innerH}
                        fill="transparent" onMouseEnter={() => setHover(i)} />
                ))}
            </svg>

            {hover !== null && (
                <div className="absolute top-2 right-2 bg-white rounded-xl border border-gray-200 shadow-lg px-3 py-2 text-[12px] pointer-events-none">
                    <p className="font-bold text-gray-900 mb-1">{fmtBucket(data[hover].bucket)}</p>
                    {active.map(s => (
                        <div key={s.key} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                            <span className="text-gray-500">{s.label}</span>
                            <span className="ml-auto font-semibold text-gray-900 tabular-nums">{data[hover][s.key]}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════
const AdminDashboard = () => {
    const { isAuthenticated, isLoading: authLoading, user, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();
    const isAdmin = isAuthenticated && user?.sub === ADMIN_USER_ID;

    const [nav, setNav] = useState('overview');
    const [users, setUsers] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [series, setSeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [seriesLoading, setSeriesLoading] = useState(false);
    const [error, setError] = useState(null);

    const [range, setRange] = useState('30d');
    const [granularity, setGranularity] = useState('day');
    const [visible, setVisible] = useState({ signups: true, quicksoap: true, petsoap: true, petquery: true });

    const [subscriptionFilter, setSubscriptionFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [searchQuery, setSearchQuery] = useState('');
    const [displayCount, setDisplayCount] = useState(40);
    const [copied, setCopied] = useState(null);
    const [selected, setSelected] = useState(null); // user drill-down

    const getAuthHeaders = useCallback(async () => {
        const token = await getAccessTokenSilently();
        return { Authorization: `Bearer ${token}` };
    }, [getAccessTokenSilently]);

    const fetchCore = useCallback(async () => {
        try {
            setLoading(true);
            const headers = await getAuthHeaders();
            const [u, m] = await Promise.all([
                axios.get(`${API_URL}/admin/users`, { headers }),
                axios.get(`${API_URL}/admin-metrics`, { headers }),
            ]);
            setUsers(u.data.users || []);
            setMetrics(m.data);
            setError(null);
        } catch (err) {
            setError('Failed to load: ' + (err.response?.data?.error || err.message));
        } finally { setLoading(false); }
    }, [getAuthHeaders]);

    const fetchSeries = useCallback(async () => {
        try {
            setSeriesLoading(true);
            const { start, end } = rangeToDates(range);
            const headers = await getAuthHeaders();
            const res = await axios.get(`${API_URL}/admin/analytics/timeseries`, {
                headers,
                params: { granularity, start: start.toISOString(), end: end.toISOString(), tz: BROWSER_TZ },
            });
            setSeries(res.data.series || []);
        } catch (err) {
            console.error('Series error:', err);
            setSeries([]);
        } finally { setSeriesLoading(false); }
    }, [getAuthHeaders, range, granularity]);

    useEffect(() => { if (isAdmin) fetchCore(); }, [isAdmin, fetchCore]);
    useEffect(() => { if (isAdmin) fetchSeries(); }, [isAdmin, fetchSeries]);

    const refresh = () => { fetchCore(); fetchSeries(); };

    const pickRange = (key) => {
        setRange(key);
        const g = RANGES.find(r => r.key === key)?.gran;
        if (g) setGranularity(g);
    };

    // ── Derived ──────────────────────────────────────────────────────────────
    const rangeStart = useMemo(() => rangeToDates(range).start, [range]);

    const rangeUsers = useMemo(() => {
        if (range === 'all') return users;
        return users.filter(u => new Date(u.created_at) >= rangeStart);
    }, [users, range, rangeStart]);

    const seriesTotals = useMemo(() => {
        const t = { signups: 0, quicksoap: 0, petsoap: 0, petquery: 0 };
        series.forEach(d => SERIES.forEach(s => { t[s.key] += d[s.key] || 0; }));
        return t;
    }, [series]);

    const tierCounts = useMemo(() => {
        const c = { total: users.length, paid: 0, free: 0, student: 0, canceling: 0 };
        users.forEach(u => {
            const t = tierOf(u);
            c[t] = (c[t] || 0) + 1;
            if (u.cancel_at_period_end) c.canceling++;
        });
        return c;
    }, [users]);

    const filterCounts = useMemo(() => {
        const base = rangeUsers;
        return {
            all: base.length,
            free: base.filter(u => tierOf(u) === 'free').length,
            monthly: base.filter(u => tierOf(u) === 'paid' && u.subscription_interval === 'monthly').length,
            yearly: base.filter(u => tierOf(u) === 'paid' && u.subscription_interval === 'yearly').length,
            paid: base.filter(u => tierOf(u) === 'paid').length,
            student: base.filter(u => tierOf(u) === 'student').length,
            canceling: base.filter(u => u.cancel_at_period_end).length,
            not_onboarded: base.filter(u => !isOnboarded(u)).length,
        };
    }, [rangeUsers]);

    const filtered = useMemo(() => {
        let f = [...rangeUsers];
        const fns = {
            free: u => tierOf(u) === 'free',
            monthly: u => tierOf(u) === 'paid' && u.subscription_interval === 'monthly',
            yearly: u => tierOf(u) === 'paid' && u.subscription_interval === 'yearly',
            paid: u => tierOf(u) === 'paid',
            student: u => tierOf(u) === 'student',
            canceling: u => u.cancel_at_period_end === true,
            not_onboarded: u => !isOnboarded(u),
        };
        if (fns[subscriptionFilter]) f = f.filter(fns[subscriptionFilter]);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            f = f.filter(u => (u.email || '').toLowerCase().includes(q) || (u.dvm_name || '').toLowerCase().includes(q) || (u.nickname || '').toLowerCase().includes(q));
        }
        const sorts = {
            newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
            oldest: (a, b) => new Date(a.created_at) - new Date(b.created_at),
            most_quicksoap: (a, b) => (b.quicksoap_count || 0) - (a.quicksoap_count || 0),
            most_petquery: (a, b) => (b.petquery_count || 0) - (a.petquery_count || 0),
            most_petsoap: (a, b) => (b.petsoap_count || 0) - (a.petsoap_count || 0),
        };
        f.sort(sorts[sortBy] || sorts.newest);
        return f;
    }, [rangeUsers, subscriptionFilter, searchQuery, sortBy]);

    const visibleUsers = useMemo(() => filtered.slice(0, displayCount), [filtered, displayCount]);

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—';

    const copyField = (field) => {
        const vals = filtered.map(u => field === 'emails' ? u.email : (u.dvm_name || u.nickname || '')).filter(Boolean);
        navigator.clipboard.writeText(vals.join(', '));
        setCopied(field);
        setTimeout(() => setCopied(null), 2000);
    };

    // ═══ Auth gates ═══════════════════════════════════════════════════════════
    if (authLoading) return <Spinner label="Authenticating…" />;

    if (!isAuthenticated) {
        return (
            <div className="min-h-[100dvh] bg-[#f7f8fb] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-sm text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: BRAND }}>
                        <FaLock className="text-white text-lg" />
                    </div>
                    <h1 className="text-xl font-extrabold text-gray-900 mb-1">PetWise Admin</h1>
                    <p className="text-[13px] text-gray-500 mb-6">Sign in with your admin account to continue</p>
                    <button onClick={() => loginWithRedirect({ appState: { returnTo: '/admin' } })}
                        className="w-full py-3 text-white font-semibold rounded-xl transition-colors" style={{ background: BRAND }}>
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-[100dvh] bg-[#f7f8fb] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-sm text-center">
                    <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <FaTimes className="text-red-500 text-lg" />
                    </div>
                    <h1 className="text-xl font-extrabold text-gray-900 mb-1">Access Denied</h1>
                    <p className="text-[13px] text-gray-500 mb-6">This account doesn't have admin access.</p>
                    <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                        className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors">
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    if (loading) return <Spinner label="Loading dashboard…" />;

    const NAV = [
        { id: 'overview', label: 'Overview', icon: FaChartPie },
        { id: 'analytics', label: 'Analytics', icon: FaChartLine },
        { id: 'users', label: 'Users', icon: FaUsers },
    ];

    return (
        <div className="min-h-[100dvh] bg-[#f7f8fb]">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Admin</h1>
                        <p className="text-[13px] text-gray-500 mt-0.5">{tierCounts.total} users · {tierCounts.paid} paid · {tierCounts.free} free</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={refresh} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-[13px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                            <FaSyncAlt className="text-xs" /> Refresh
                        </button>
                        <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold text-gray-500 hover:bg-gray-100 transition-colors">
                            <FaSignOutAlt className="text-xs" /> Logout
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-center justify-between">
                        <p className="text-red-700 text-[13px]">{error}</p>
                        <button onClick={fetchCore} className="ml-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200">Retry</button>
                    </div>
                )}

                <div className="grid md:grid-cols-[210px,1fr] gap-8">
                    {/* Sidebar */}
                    <nav className="flex md:flex-col gap-1.5 overflow-x-auto scrollbar-none">
                        {NAV.map(({ id, label, icon: Icon }) => {
                            const activeItem = nav === id;
                            return (
                                <button key={id} onClick={() => setNav(id)}
                                    className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-colors ${activeItem ? 'text-[#3468bd]' : 'text-gray-500 hover:text-gray-800'}`}>
                                    {activeItem && (
                                        <motion.span layoutId="admin-active-pill"
                                            className="absolute inset-0 rounded-xl bg-blue-50 border border-blue-100"
                                            transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                                    )}
                                    <Icon className={`relative text-xs ${activeItem ? 'text-[#3468bd]' : 'text-gray-400'}`} />
                                    <span className="relative">{label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Content */}
                    <div className="min-w-0">
                        {/* Range control — shared across Overview & Analytics */}
                        {nav !== 'users' && (
                            <div className="flex flex-wrap gap-1.5 mb-5">
                                {RANGES.map(r => (
                                    <button key={r.key} onClick={() => pickRange(r.key)}
                                        className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${range === r.key ? 'bg-[#3468bd] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* ═══ OVERVIEW ═══ */}
                        {nav === 'overview' && (
                            <div className="space-y-6">
                                <div>
                                    <SectionHeader title="This period" subtitle={`New activity in the selected range (${BROWSER_TZ})`} />
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        <StatCard label="New signups" value={seriesLoading ? '…' : seriesTotals.signups} accent />
                                        <StatCard label="QuickSOAP" value={seriesLoading ? '…' : seriesTotals.quicksoap} />
                                        <StatCard label="PetSOAP" value={seriesLoading ? '…' : seriesTotals.petsoap} />
                                        <StatCard label="PetQuery" value={seriesLoading ? '…' : seriesTotals.petquery} />
                                    </div>
                                </div>

                                <div>
                                    <SectionHeader title="All-time totals" subtitle="Current account base" />
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        <StatCard label="Total users" value={tierCounts.total} />
                                        <StatCard label="Paid" value={tierCounts.paid} sub={`${metrics?.subscriptionsByType?.monthly ?? 0} mo · ${metrics?.subscriptionsByType?.yearly ?? 0} yr`} />
                                        <StatCard label="Free" value={tierCounts.free} />
                                        <StatCard label="Growth (MoM)" value={metrics ? `${metrics.growthRate > 0 ? '+' : ''}${metrics.growthRate.toFixed(0)}%` : '—'} />
                                    </div>
                                </div>

                                {/* Subscription breakdown */}
                                <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
                                    <h3 className="text-sm font-bold text-gray-900 mb-4">Subscriptions</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                        {[
                                            { label: 'Monthly', v: metrics?.subscriptionsByType?.monthly, c: 'text-emerald-600' },
                                            { label: 'Yearly', v: metrics?.subscriptionsByType?.yearly, c: 'text-purple-600' },
                                            { label: 'Student', v: metrics?.subscriptionsByType?.student, c: 'text-purple-600' },
                                            { label: 'Free', v: metrics?.subscriptionsByType?.free, c: 'text-gray-500' },
                                            { label: 'Canceling', v: metrics?.subscriptionsByType?.canceling, c: 'text-amber-600' },
                                        ].map(s => (
                                            <div key={s.label} className="rounded-xl bg-gray-50 p-3.5 text-center">
                                                <p className={`text-2xl font-extrabold tabular-nums ${s.c}`}>{s.v ?? 0}</p>
                                                <p className="text-[11px] text-gray-500 mt-0.5">{s.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {tierCounts.total > 0 && (
                                        <p className="text-[12px] text-gray-400 mt-4">
                                            {((tierCounts.paid / tierCounts.total) * 100).toFixed(1)}% paid conversion ·
                                            {' '}{tierCounts.paid > 0 ? (((metrics?.subscriptionsByType?.yearly || 0) / tierCounts.paid) * 100).toFixed(0) : 0}% of paid on yearly
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ═══ ANALYTICS ═══ */}
                        {nav === 'analytics' && (
                            <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
                                <SectionHeader
                                    title="Trends"
                                    subtitle="Signups & feature usage over time"
                                    right={
                                        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                                            {['day', 'week', 'month'].map(g => (
                                                <button key={g} onClick={() => setGranularity(g)}
                                                    className={`px-3 py-1.5 rounded-md text-[12px] font-semibold capitalize transition-colors ${granularity === g ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                                                    {g}
                                                </button>
                                            ))}
                                        </div>
                                    }
                                />

                                {/* legend / toggles with per-series totals */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {SERIES.map(s => (
                                        <button key={s.key} onClick={() => setVisible(v => ({ ...v, [s.key]: !v[s.key] }))}
                                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-all ${visible[s.key] ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-50 border-gray-100 text-gray-300'}`}>
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: visible[s.key] ? s.color : '#d1d5db' }} />
                                            {s.label}
                                            <span className="tabular-nums text-gray-400">{seriesTotals[s.key]}</span>
                                        </button>
                                    ))}
                                </div>

                                {seriesLoading
                                    ? <div className="h-[320px] flex items-center justify-center text-gray-400 text-sm">Loading…</div>
                                    : <TrendChart data={series} granularity={granularity} visible={visible} />}
                            </div>
                        )}

                        {/* ═══ USERS ═══ */}
                        {nav === 'users' && (
                            <div className="space-y-4">
                                <SectionHeader title="Users" subtitle={`${filtered.length} matching · click a row for usage detail`}
                                    right={
                                        <div className="flex gap-1.5">
                                            <button onClick={() => copyField('emails')}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${copied === 'emails' ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                                {copied === 'emails' ? <FaCheck className="text-[10px]" /> : <FaCopy className="text-[10px]" />} Emails
                                            </button>
                                            <button onClick={() => copyField('names')}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${copied === 'names' ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                                {copied === 'names' ? <FaCheck className="text-[10px]" /> : <FaCopy className="text-[10px]" />} Names
                                            </button>
                                        </div>
                                    }
                                />

                                {/* filters */}
                                <div className="flex flex-wrap gap-1.5">
                                    {FILTERS.map(f => (
                                        <button key={f.key} onClick={() => setSubscriptionFilter(f.key)}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${subscriptionFilter === f.key ? 'bg-[#3468bd] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                            {f.label}
                                            <span className={`tabular-nums ${subscriptionFilter === f.key ? 'text-white/70' : 'text-gray-400'}`}>{filterCounts[f.key]}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* search + sort + signup range */}
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative flex-1">
                                        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search name or email…"
                                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#3468bd]/20" />
                                    </div>
                                    <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                                        className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#3468bd]/20">
                                        <option value="newest">Newest first</option>
                                        <option value="oldest">Oldest first</option>
                                        <option value="most_quicksoap">Most QuickSOAP</option>
                                        <option value="most_petsoap">Most PetSOAP</option>
                                        <option value="most_petquery">Most PetQuery</option>
                                    </select>
                                    <select value={range} onChange={e => setRange(e.target.value)}
                                        className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#3468bd]/20">
                                        {RANGES.map(r => <option key={r.key} value={r.key}>Joined: {r.label}</option>)}
                                    </select>
                                </div>

                                {/* table */}
                                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-[13px]">
                                            <thead>
                                                <tr className="text-left border-b border-gray-100 bg-gray-50/60">
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Name</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Email</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Status</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide text-right">QuickSOAP</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide text-right">PetSOAP</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide text-right">PetQuery</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Onboarding</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Joined</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {visibleUsers.map(u => (
                                                    <tr key={u.id} onClick={() => setSelected(u)}
                                                        className="hover:bg-blue-50/40 cursor-pointer transition-colors">
                                                        <td className="px-4 py-3 font-semibold text-gray-900 max-w-[160px] truncate">{u.dvm_name || u.nickname || '—'}</td>
                                                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{u.email}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[statusLabel(u)] || 'bg-gray-100 text-gray-500'}`}>{statusLabel(u)}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#3468bd]">{u.quicksoap_count || 0}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">{u.petsoap_count || 0}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">{u.petquery_count || 0}</td>
                                                        <td className="px-4 py-3 text-[12px]">
                                                            {isOnboarded(u) ? <span className="text-emerald-600 font-medium">Done</span>
                                                                : u.onboarding_step ? <span className="text-amber-600 font-medium">{u.onboarding_step}</span>
                                                                    : <span className="text-gray-300">—</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-400 text-[12px] tabular-nums">{formatDate(u.created_at)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {filtered.length === 0 && (
                                        <div className="text-center py-16">
                                            <p className="text-gray-500 font-medium">No users found</p>
                                            <button onClick={() => { setSubscriptionFilter('all'); setSearchQuery(''); }}
                                                className="mt-2 text-[#3468bd] text-[13px] font-semibold hover:underline">Clear filters</button>
                                        </div>
                                    )}
                                </div>

                                {filtered.length > displayCount && (
                                    <button onClick={() => setDisplayCount(c => c + 40)}
                                        className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-[13px] font-semibold hover:bg-gray-50 transition-colors">
                                        Load more ({filtered.length - displayCount} remaining)
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ Per-user drill-down drawer ═══ */}
            <AnimatePresence>
                {selected && (
                    <UserDrawer user={selected} onClose={() => setSelected(null)}
                        getAuthHeaders={getAuthHeaders} formatDate={formatDate} />
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Drawer ──────────────────────────────────────────────────────────────────
const UserDrawer = ({ user, onClose, getAuthHeaders, formatDate }) => {
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                const headers = await getAuthHeaders();
                const res = await axios.get(`${API_URL}/admin/user-usage`, { headers, params: { sub: user.auth0_user_id } });
                if (alive) setUsage(res.data.usage);
            } catch (e) { if (alive) setUsage(null); }
            finally { if (alive) setLoading(false); }
        })();
        return () => { alive = false; };
    }, [user.auth0_user_id, getAuthHeaders]);

    const row = (label, value) => (
        <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
            <span className="text-[13px] font-medium text-gray-500">{label}</span>
            <span className="text-[13px] font-semibold text-gray-800 text-right">{value}</span>
        </div>
    );

    const usageCard = (label, color, u) => (
        <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span className="text-[13px] font-bold text-gray-900">{label}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-lg font-extrabold text-gray-900 tabular-nums">{u?.total ?? 0}</p><p className="text-[10px] text-gray-400">Lifetime</p></div>
                <div><p className="text-lg font-extrabold text-gray-900 tabular-nums">{u?.last30d ?? 0}</p><p className="text-[10px] text-gray-400">30 days</p></div>
                <div><p className="text-lg font-extrabold text-gray-900 tabular-nums">{u?.last7d ?? 0}</p><p className="text-[10px] text-gray-400">7 days</p></div>
            </div>
        </div>
    );

    return (
        <>
            <motion.div className="fixed inset-0 bg-black/30 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
            <motion.div className="fixed top-0 right-0 h-full w-full sm:max-w-md bg-white z-50 shadow-2xl overflow-y-auto"
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 420, damping: 40 }}>
                <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-900 truncate">{user.dvm_name || user.nickname || user.email}</h3>
                    <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100"><FaTimes /></button>
                </div>

                <div className="p-5 space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ background: BRAND }}>
                            {(user.dvm_name || user.nickname || user.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-gray-900 truncate">{user.email}</p>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[statusLabel(user)] || 'bg-gray-100 text-gray-500'}`}>{statusLabel(user)}</span>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 p-4">
                        {row('Joined', formatDate(user.created_at))}
                        {row('Plan', user.subscription_interval || 'Free')}
                        {row('Renews / expires', formatDate(user.subscription_end_date))}
                        {row('Onboarding', isOnboarded(user) ? 'Completed' : (user.onboarding_step || '—'))}
                        {row('Auth0 ID', <span className="font-mono text-[11px]">{user.auth0_user_id}</span>)}
                    </div>

                    <div>
                        <p className="text-sm font-bold text-gray-900 mb-3">Usage</p>
                        {loading ? (
                            <div className="py-8 text-center text-gray-400 text-[13px]">Loading usage…</div>
                        ) : (
                            <div className="space-y-3">
                                {usageCard('QuickSOAP', '#10b981', usage?.quicksoap)}
                                {usageCard('PetSOAP', '#f59e0b', usage?.petsoap)}
                                {usageCard('PetQuery', '#8b5cf6', usage?.petquery)}
                                <p className="text-[11px] text-gray-400">PetSOAP & PetQuery counts started when event logging shipped; QuickSOAP lifetime includes historical data.</p>
                            </div>
                        )}
                    </div>

                    {user.email && (
                        <button onClick={() => navigator.clipboard.writeText(user.email)}
                            className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-[13px] font-semibold hover:bg-gray-200 transition-colors">
                            Copy email
                        </button>
                    )}
                </div>
            </motion.div>
        </>
    );
};

export default AdminDashboard;
