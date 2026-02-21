import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import axios from 'axios';
import '../styles/AdminDashboard.css';

const ADMIN_ACCESS_CODE = 'petwise8975247';

const FILTERS = [
    { key: 'all', label: 'All', color: 'bg-gray-800', ring: 'ring-gray-800' },
    { key: 'trial', label: 'Trial', color: 'bg-blue-500', ring: 'ring-blue-500' },
    { key: 'monthly', label: 'Monthly', color: 'bg-green-500', ring: 'ring-green-500' },
    { key: 'yearly', label: 'Yearly', color: 'bg-purple-500', ring: 'ring-purple-500' },
    { key: 'paid', label: 'All Paid', color: 'bg-emerald-600', ring: 'ring-emerald-600' },
    { key: 'canceling', label: 'Canceling', color: 'bg-amber-500', ring: 'ring-amber-500' },
    { key: 'inactive', label: 'Inactive', color: 'bg-gray-500', ring: 'ring-gray-500' },
    { key: 'not_onboarded', label: 'Not Onboarded', color: 'bg-red-500', ring: 'ring-red-500' },
];

// ─── Icons (inline SVGs for zero deps) ──────────────────────────────────────
const CopyIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);
const CheckIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);
const RefreshIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
);
const SearchIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);
const ChevronIcon = ({ open }) => (
    <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
);

// ─── Collapsible Section ─────────────────────────────────────────────────────
const Section = ({ title, isOpen, onToggle, children, badge, noPad }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between px-4 py-3.5 sm:p-4 active:bg-gray-50 transition-colors"
        >
            <div className="flex items-center gap-2">
                <h2 className="text-[15px] sm:text-lg font-semibold text-gray-900">{title}</h2>
                {badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-bold tabular-nums">
                        {badge}
                    </span>
                )}
            </div>
            <ChevronIcon open={isOpen} />
        </button>
        {isOpen && <div className={`border-t border-gray-100 ${noPad ? '' : ''}`}>{children}</div>}
    </div>
);

// ─── KPI Card (horizontal-scroll friendly) ──────────────────────────────────
const KPICard = ({ title, value, subtitle, trend, accent }) => (
    <div className={`
        flex-shrink-0 w-[140px] sm:w-auto sm:flex-1
        bg-white rounded-2xl p-4 shadow-sm border border-gray-100
        ${accent ? 'ring-1 ring-inset ring-blue-100' : ''}
    `}>
        <p className="text-[11px] font-medium text-gray-500 leading-tight">{title}</p>
        <p className="text-[22px] sm:text-3xl font-bold text-gray-900 mt-1 tabular-nums leading-none">{value}</p>
        {subtitle && <p className="text-[10px] text-gray-400 mt-1.5">{subtitle}</p>}
        {trend !== undefined && trend !== null && (
            <p className={`text-[11px] font-semibold mt-1.5 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
            </p>
        )}
    </div>
);

// ─── Stat Pill (subscription type) ──────────────────────────────────────────
const StatPill = ({ title, value, gradient }) => (
    <div className={`flex-shrink-0 bg-gradient-to-br ${gradient} rounded-2xl px-5 py-4 text-white min-w-[120px] sm:flex-1`}>
        <p className="text-[11px] font-medium opacity-80">{title}</p>
        <p className="text-2xl font-bold mt-0.5 tabular-nums">{value}</p>
    </div>
);

// ─── Chart Component ─────────────────────────────────────────────────────────
const MonthlyChart = ({ data }) => {
    if (!data || data.length === 0) {
        return <div className="text-gray-500 text-center py-8">No data available</div>;
    }
    const maxVal = Math.max(...data.map(d => Math.max(d.newUsers, d.newReports)));
    const scale = maxVal > 0 ? 160 / maxVal : 1;

    return (
        <div className="flex flex-col items-center w-full">
            <div className="flex justify-around items-end w-full h-52 pb-4 overflow-x-auto scrollbar-none">
                {data.map((month, i) => (
                    <div key={i} className="flex flex-col items-center min-w-[48px]">
                        <div className="flex gap-1 h-44 items-end">
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] text-gray-500 mb-1">{month.newUsers}</span>
                                <div className="w-5 sm:w-6 bg-blue-500 rounded-t" style={{ height: `${Math.max(month.newUsers * scale, 4)}px` }} />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] text-gray-500 mb-1">{month.newReports}</span>
                                <div className="w-5 sm:w-6 bg-amber-500 rounded-t" style={{ height: `${Math.max(month.newReports * scale, 4)}px` }} />
                            </div>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-2">{month.month}</span>
                    </div>
                ))}
            </div>
            <div className="flex gap-6 mt-3">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded" /><span className="text-xs text-gray-500">Users</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded" /><span className="text-xs text-gray-500">Reports</span></div>
            </div>
        </div>
    );
};

// ─── Expandable User Card (mobile CRM style) ────────────────────────────────
const UserCard = ({ user, rCol, sCol, qCol, formatDate, getStatusBadge, getOnboardingBadge }) => {
    const [open, setOpen] = useState(false);

    return (
        <div
            className={`bg-white rounded-2xl border transition-all duration-200 ${open ? 'border-blue-200 shadow-md' : 'border-gray-100 shadow-sm'}`}
        >
            <button
                onClick={() => setOpen(!open)}
                className="w-full text-left p-4 active:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {/* Avatar circle */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-blue-600">
                            {(user.dvm_name || user.nickname || user.email || '?')[0].toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                            {user.dvm_name || user.nickname || '—'}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {getStatusBadge(user)}
                        {getOnboardingBadge(user)}
                    </div>
                </div>

                {/* Always-visible stats row */}
                <div className="flex gap-4 mt-3 ml-[52px]">
                    <div>
                        <span className="text-base font-bold text-gray-900 tabular-nums">{user[sCol] || 0}</span>
                        <span className="text-[10px] text-gray-400 ml-1">SOAP</span>
                    </div>
                    <div>
                        <span className="text-base font-bold text-gray-900 tabular-nums">{user[rCol] || 0}</span>
                        <span className="text-[10px] text-gray-400 ml-1">Recs</span>
                    </div>
                    <div>
                        <span className="text-base font-bold text-gray-900 tabular-nums">{user[qCol] || 0}</span>
                        <span className="text-[10px] text-gray-400 ml-1">Queries</span>
                    </div>
                </div>
            </button>

            {/* Expandable detail */}
            {open && (
                <div className="px-4 pb-4 pt-0 space-y-2 animate-[fadeIn_150ms_ease-out]">
                    <div className="h-px bg-gray-100" />
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] ml-[52px]">
                        <div>
                            <span className="text-gray-400">Joined</span>
                            <p className="font-medium text-gray-700">{formatDate(user.created_at)}</p>
                        </div>
                        <div>
                            <span className="text-gray-400">Expires</span>
                            <p className="font-medium text-gray-700">{formatDate(user.subscription_end_date)}</p>
                        </div>
                        <div>
                            <span className="text-gray-400">Plan</span>
                            <p className="font-medium text-gray-700 capitalize">{user.subscription_interval || '—'}</p>
                        </div>
                        <div>
                            <span className="text-gray-400">Onboarding</span>
                            <p className="font-medium text-gray-700">
                                {user.has_completed_onboarding || user.onboarding_status === 'completed'
                                    ? 'Completed'
                                    : user.onboarding_step || '—'
                                }
                            </p>
                        </div>
                    </div>
                    {user.email && (
                        <button
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(user.email); }}
                            className="ml-[52px] text-[11px] text-blue-600 font-medium active:text-blue-800"
                        >
                            Copy email
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
const AdminDashboard = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(() =>
        sessionStorage.getItem('adminAuth') === 'true'
    );
    const [accessCode, setAccessCode] = useState('');
    const [authError, setAuthError] = useState('');

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeframe, setTimeframe] = useState('all');
    const [subscriptionFilter, setSubscriptionFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [minQuickSOAP, setMinQuickSOAP] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [advancedMetrics, setAdvancedMetrics] = useState(null);
    const [showSection, setShowSection] = useState({
        overview: true,
        subscriptions: false,
        users: true,
        charts: false,
    });
    const [userDisplayCount, setUserDisplayCount] = useState(30);
    const [copiedField, setCopiedField] = useState(null);

    const pillStripRef = useRef(null);

    const rCol = 'weekly_reports_count';
    const sCol = 'quicksoap_count';
    const qCol = 'quick_query_messages_count';

    // ─── Auth ────────────────────────────────────────────────────────────────
    const handleAccessSubmit = (e) => {
        e.preventDefault();
        if (accessCode === ADMIN_ACCESS_CODE) {
            sessionStorage.setItem('adminAuth', 'true');
            setIsAuthenticated(true);
        } else {
            setAuthError('Invalid access code');
            setAccessCode('');
        }
    };

    // ─── Data ────────────────────────────────────────────────────────────────
    const fetchServerMetrics = async () => {
        try {
            const apiUrl = process.env.NODE_ENV === 'production'
                ? 'https://api.petwise.vet/admin-metrics'
                : 'http://localhost:3001/admin-metrics';
            const check = await fetch(apiUrl, { method: 'HEAD', headers: { 'Content-Type': 'application/json' } }).catch(() => ({ ok: false }));
            if (!check.ok) return;
            const res = await axios.get(apiUrl, { params: { admin_access: 'true' } });
            setAdvancedMetrics(res.data);
        } catch (err) { console.error('Server metrics error:', err); }
    };

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [usersRes, onboardingRes] = await Promise.all([
                supabase.from('users').select('*').order('created_at', { ascending: false }),
                supabase.from('onboarding').select('auth0_user_id, status, current_step'),
            ]);
            if (usersRes.error) throw usersRes.error;

            const obMap = {};
            (onboardingRes.data || []).forEach(o => { obMap[o.auth0_user_id] = o; });

            setUsers((usersRes.data || []).map(u => ({
                ...u,
                onboarding_status: obMap[u.auth0_user_id]?.status || null,
                onboarding_step: obMap[u.auth0_user_id]?.current_step || null,
            })));
        } catch (err) {
            setError('Failed to load: ' + (err.message || JSON.stringify(err)));
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (isAuthenticated) { fetchData(); fetchServerMetrics(); }
    }, [isAuthenticated, fetchData]);

    const refresh = () => { fetchData(); fetchServerMetrics(); };

    // ─── Derived data ────────────────────────────────────────────────────────
    const timeframeUsers = useMemo(() => {
        if (timeframe === 'all') return users;
        const now = new Date();
        let cutoff = new Date();
        if (timeframe === 'today') cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        else if (timeframe === 'week') cutoff.setDate(now.getDate() - 7);
        else if (timeframe === 'month') cutoff.setMonth(now.getMonth() - 1);
        else if (timeframe === 'year') cutoff.setFullYear(now.getFullYear() - 1);
        return users.filter(u => new Date(u.created_at) >= cutoff);
    }, [users, timeframe]);

    const counts = useMemo(() => {
        const all = timeframeUsers;
        const trial = all.filter(u => u.subscription_status === 'active' && (u.subscription_interval === 'trial' || u.subscription_interval === 'stripe_trial'));
        const monthly = all.filter(u => u.subscription_status === 'active' && u.subscription_interval === 'monthly');
        const yearly = all.filter(u => u.subscription_status === 'active' && u.subscription_interval === 'yearly');
        const canceling = all.filter(u => u.cancel_at_period_end === true);
        const inactive = all.filter(u => u.subscription_status === 'inactive');
        const notOnboarded = all.filter(u => u.has_completed_onboarding !== true && u.onboarding_status !== 'completed');

        const now = new Date();
        const fom = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            total: all.length,
            trial: trial.length,
            monthly: monthly.length,
            yearly: yearly.length,
            paid: monthly.length + yearly.length,
            canceling: canceling.length,
            inactive: inactive.length,
            notOnboarded: notOnboarded.length,
            totalReports: all.reduce((s, u) => s + (u[rCol] || 0), 0),
            totalSOAP: all.reduce((s, u) => s + (u[sCol] || 0), 0),
            totalQueries: all.reduce((s, u) => s + (u[qCol] || 0), 0),
            newTrials: all.filter(u => (u.subscription_interval === 'trial' || u.subscription_interval === 'stripe_trial') && new Date(u.created_at) >= fom).length,
            newSubs: all.filter(u => (u.subscription_interval === 'monthly' || u.subscription_interval === 'yearly') && u.subscription_status === 'active' && new Date(u.created_at) >= fom).length,
        };
    }, [timeframeUsers]);

    const filterCounts = useMemo(() => ({
        all: counts.total, trial: counts.trial, monthly: counts.monthly,
        yearly: counts.yearly, paid: counts.paid, canceling: counts.canceling,
        inactive: counts.inactive, not_onboarded: counts.notOnboarded,
    }), [counts]);

    const filteredUsers = useMemo(() => {
        let f = [...timeframeUsers];
        const filterFns = {
            trial: u => u.subscription_status === 'active' && (u.subscription_interval === 'trial' || u.subscription_interval === 'stripe_trial'),
            monthly: u => u.subscription_status === 'active' && u.subscription_interval === 'monthly',
            yearly: u => u.subscription_status === 'active' && u.subscription_interval === 'yearly',
            paid: u => u.subscription_status === 'active' && (u.subscription_interval === 'monthly' || u.subscription_interval === 'yearly'),
            canceling: u => u.cancel_at_period_end === true,
            inactive: u => u.subscription_status === 'inactive',
            not_onboarded: u => u.has_completed_onboarding !== true && u.onboarding_status !== 'completed',
        };
        if (filterFns[subscriptionFilter]) f = f.filter(filterFns[subscriptionFilter]);
        if (minQuickSOAP > 0) f = f.filter(u => (u[sCol] || 0) >= minQuickSOAP);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            f = f.filter(u => (u.email || '').toLowerCase().includes(q) || (u.dvm_name || '').toLowerCase().includes(q) || (u.nickname || '').toLowerCase().includes(q));
        }
        const sorts = {
            most_queries: (a, b) => (b[qCol] || 0) - (a[qCol] || 0),
            most_quicksoap: (a, b) => (b[sCol] || 0) - (a[sCol] || 0),
            most_records: (a, b) => (b[rCol] || 0) - (a[rCol] || 0),
            oldest: (a, b) => new Date(a.created_at) - new Date(b.created_at),
            newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
        };
        f.sort(sorts[sortBy] || sorts.newest);
        return f;
    }, [timeframeUsers, subscriptionFilter, sortBy, minQuickSOAP, searchQuery]);

    const visibleUsers = useMemo(() => filteredUsers.slice(0, userDisplayCount), [filteredUsers, userDisplayCount]);

    // ─── Helpers ─────────────────────────────────────────────────────────────
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—';
    const toggleSection = (s) => setShowSection(p => ({ ...p, [s]: !p[s] }));

    const copyField = (field) => {
        const vals = filteredUsers.map(u => field === 'emails' ? u.email : (u.dvm_name || u.nickname || '')).filter(Boolean);
        navigator.clipboard.writeText(vals.join(', '));
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const getStatusBadge = (user) => {
        const base = 'px-2 py-0.5 rounded-full text-[10px] font-bold leading-tight';
        if (user.cancel_at_period_end) return <span className={`${base} bg-amber-100 text-amber-700`}>Canceling</span>;
        if (user.subscription_status === 'active') {
            if (user.subscription_interval === 'trial' || user.subscription_interval === 'stripe_trial')
                return <span className={`${base} bg-blue-100 text-blue-700`}>Trial</span>;
            if (user.subscription_interval === 'monthly')
                return <span className={`${base} bg-green-100 text-green-700`}>Monthly</span>;
            if (user.subscription_interval === 'yearly')
                return <span className={`${base} bg-purple-100 text-purple-700`}>Yearly</span>;
            return <span className={`${base} bg-green-100 text-green-700`}>Active</span>;
        }
        return <span className={`${base} bg-gray-100 text-gray-500`}>Inactive</span>;
    };

    const getOnboardingBadge = (user) => {
        if (user.has_completed_onboarding || user.onboarding_status === 'completed') return null;
        if (user.onboarding_step)
            return <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold leading-tight">{user.onboarding_step}</span>;
        return null;
    };

    const getStatusColor = (user) => {
        if (user.cancel_at_period_end) return 'text-amber-600';
        if (user.subscription_status === 'active' && user.subscription_interval === 'monthly') return 'text-green-600';
        if (user.subscription_status === 'active' && user.subscription_interval === 'yearly') return 'text-purple-600';
        if (user.subscription_status === 'active' && (user.subscription_interval === 'trial' || user.subscription_interval === 'stripe_trial')) return 'text-blue-600';
        return 'text-gray-400';
    };

    const getStatusLabel = (user) => {
        if (user.cancel_at_period_end) return 'Canceling';
        if (user.subscription_status === 'active') {
            const labels = { trial: 'Trial', stripe_trial: 'Stripe Trial', monthly: 'Monthly', yearly: 'Yearly' };
            return labels[user.subscription_interval] || 'Active';
        }
        return 'Inactive';
    };

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═════════════════════════════════════════════════════════════════════════

    // ─── Login ───────────────────────────────────────────────────────────────
    if (!isAuthenticated) {
        return (
            <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
                    <div className="text-center mb-6">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900">PetWise Admin</h1>
                    </div>
                    <form onSubmit={handleAccessSubmit} className="space-y-3">
                        <input
                            type="password"
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value)}
                            placeholder="Access code"
                            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-base"
                            autoFocus
                        />
                        <button type="submit" className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/30">
                            Continue
                        </button>
                    </form>
                    {authError && <p className="text-red-500 text-center mt-3 text-sm">{authError}</p>}
                </div>
            </div>
        );
    }

    // ─── Loading ─────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Loading...</p>
                </div>
            </div>
        );
    }

    // ─── Dashboard ───────────────────────────────────────────────────────────
    return (
        <div className="min-h-[100dvh] bg-gray-50 pb-20 sm:pb-6">
            {/* ── Sticky Header ──────────────────────────────────────────── */}
            <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/60 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center justify-between h-14 sm:h-16">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <div className="leading-tight">
                                <h1 className="text-[15px] font-bold text-gray-900">PetWise</h1>
                                <p className="text-[10px] text-gray-400 font-medium">{counts.total} users</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={refresh} className="p-2.5 rounded-xl text-gray-400 active:bg-gray-100 transition-colors" title="Refresh">
                                <RefreshIcon />
                            </button>
                            <button
                                onClick={() => { sessionStorage.removeItem('adminAuth'); setIsAuthenticated(false); }}
                                className="px-3 py-2 text-[13px] text-gray-500 active:bg-gray-100 rounded-xl transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </div>

                    {/* Timeframe strip — always visible under header */}
                    <div className="flex gap-1 pb-3 -mx-4 px-4 overflow-x-auto scrollbar-none">
                        {[
                            { value: 'today', label: 'Today' },
                            { value: 'week', label: '7d' },
                            { value: 'month', label: '30d' },
                            { value: 'year', label: '1y' },
                            { value: 'all', label: 'All Time' },
                        ].map(t => (
                            <button
                                key={t.value}
                                onClick={() => setTimeframe(t.value)}
                                className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all whitespace-nowrap ${
                                    timeframe === t.value
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-500 active:bg-gray-100'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4 sm:space-y-5">
                {error && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-3 flex items-center justify-between">
                        <p className="text-red-700 text-xs flex-1">{error}</p>
                        <button onClick={fetchData} className="ml-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium active:bg-red-200 flex-shrink-0">
                            Retry
                        </button>
                    </div>
                )}

                {/* ── Overview ─────────────────────────────────────────────── */}
                <Section title="Overview" isOpen={showSection.overview} onToggle={() => toggleSection('overview')}>
                    {/* Horizontal scroll on mobile, grid on desktop */}
                    <div className="p-3 sm:p-4">
                        <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 snap-x snap-mandatory">
                            <KPICard title="Total Users" value={counts.total} accent />
                            <KPICard title="Paid" value={counts.paid} subtitle={`${counts.monthly} mo · ${counts.yearly} yr`} />
                            <KPICard title="Trials" value={counts.trial} />
                            <KPICard title="Records" value={counts.totalReports} />
                            <KPICard title="QuickSOAPs" value={counts.totalSOAP} />
                            <KPICard title="Growth" value={advancedMetrics ? `${advancedMetrics.growthRate > 0 ? '+' : ''}${advancedMetrics.growthRate.toFixed(1)}%` : '—'} trend={advancedMetrics?.growthRate} />
                        </div>
                    </div>

                    {/* Highlight badges */}
                    <div className="px-3 sm:px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
                        <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-full px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {counts.newTrials} new trials
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 rounded-full px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            {counts.newSubs} new subs
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 rounded-full px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {counts.canceling} canceling
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 rounded-full px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            {counts.notOnboarded} not onboarded
                        </span>
                    </div>
                </Section>

                {/* ── Subscriptions ────────────────────────────────────────── */}
                <Section title="Subscriptions" isOpen={showSection.subscriptions} onToggle={() => toggleSection('subscriptions')}>
                    <div className="p-3 sm:p-4">
                        <div className="flex sm:grid sm:grid-cols-5 gap-3 overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 snap-x snap-mandatory">
                            <StatPill title="Monthly" value={advancedMetrics?.subscriptionsByType?.monthly ?? counts.monthly} gradient="from-green-500 to-green-600" />
                            <StatPill title="Yearly" value={advancedMetrics?.subscriptionsByType?.yearly ?? counts.yearly} gradient="from-purple-500 to-purple-600" />
                            <StatPill title="Trials" value={advancedMetrics?.subscriptionsByType?.trial ?? counts.trial} gradient="from-blue-500 to-blue-600" />
                            <StatPill title="Canceling" value={advancedMetrics?.subscriptionsByType?.canceling ?? counts.canceling} gradient="from-amber-500 to-amber-600" />
                            <StatPill title="Inactive" value={advancedMetrics?.subscriptionsByType?.inactive ?? counts.inactive} gradient="from-gray-500 to-gray-600" />
                        </div>
                    </div>
                    {counts.total > 0 && (
                        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                            <div className="bg-gray-50 rounded-2xl p-4">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Conversion</p>
                                <div className="grid grid-cols-4 gap-2 text-center">
                                    {[
                                        { val: ((counts.paid / counts.total) * 100).toFixed(1), label: 'Paid' },
                                        { val: ((counts.trial / counts.total) * 100).toFixed(1), label: 'Trial' },
                                        { val: ((counts.inactive / counts.total) * 100).toFixed(1), label: 'Churned' },
                                        { val: counts.paid > 0 ? ((counts.yearly / counts.paid) * 100).toFixed(0) : '0', label: 'Yr/Paid' },
                                    ].map(s => (
                                        <div key={s.label}>
                                            <p className="text-lg sm:text-xl font-bold text-gray-900 tabular-nums">{s.val}%</p>
                                            <p className="text-[10px] text-gray-400">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </Section>

                {/* ── Chart ────────────────────────────────────────────────── */}
                {advancedMetrics?.monthlyMetrics && (
                    <Section title="Growth Chart" isOpen={showSection.charts} onToggle={() => toggleSection('charts')}>
                        <div className="p-4 overflow-x-auto">
                            <MonthlyChart data={advancedMetrics.monthlyMetrics.slice().reverse()} />
                        </div>
                    </Section>
                )}

                {/* ── Users ────────────────────────────────────────────────── */}
                <Section title="Users" isOpen={showSection.users} onToggle={() => toggleSection('users')} badge={filteredUsers.length}>
                    <div className="space-y-0">
                        {/* Filter pill strip — horizontal scroll */}
                        <div className="px-3 sm:px-4 pt-3 sm:pt-4">
                            <div ref={pillStripRef} className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 pb-2">
                                {FILTERS.map(f => (
                                    <button
                                        key={f.key}
                                        onClick={() => setSubscriptionFilter(f.key)}
                                        className={`
                                            inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold
                                            whitespace-nowrap transition-all active:scale-95
                                            ${subscriptionFilter === f.key
                                                ? `${f.color} text-white shadow-sm`
                                                : 'bg-gray-100 text-gray-600'
                                            }
                                        `}
                                    >
                                        {f.label}
                                        <span className={`
                                            min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold
                                            inline-flex items-center justify-center
                                            ${subscriptionFilter === f.key ? 'bg-white/20 text-white' : 'bg-gray-200/80 text-gray-600'}
                                        `}>
                                            {filterCounts[f.key]}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search + controls */}
                        <div className="px-3 sm:px-4 space-y-2 pb-3">
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon /></div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search name or email..."
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-colors"
                                />
                            </div>

                            <div className="flex gap-2">
                                <select
                                    value={sortBy}
                                    onChange={e => setSortBy(e.target.value)}
                                    className="flex-1 px-3 py-2.5 bg-gray-50 border-0 rounded-xl text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none"
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="oldest">Oldest First</option>
                                    <option value="most_quicksoap">Most QuickSOAP</option>
                                    <option value="most_queries">Most Queries</option>
                                    <option value="most_records">Most Records</option>
                                </select>
                                <div className="flex items-center bg-gray-50 rounded-xl px-3 gap-2">
                                    <span className="text-[11px] text-gray-400 whitespace-nowrap">Min SOAP</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={minQuickSOAP}
                                        onChange={e => setMinQuickSOAP(parseInt(e.target.value) || 0)}
                                        className="w-12 text-[13px] text-center bg-transparent border-0 focus:outline-none tabular-nums"
                                    />
                                </div>
                            </div>

                            {/* Count + copy row */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-[11px] text-gray-400 tabular-nums">
                                    {Math.min(userDisplayCount, filteredUsers.length)} of {filteredUsers.length}
                                </p>
                                <div className="flex gap-1.5 ml-auto">
                                    <button
                                        onClick={() => copyField('emails')}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-95 ${
                                            copiedField === 'emails' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        {copiedField === 'emails' ? <CheckIcon /> : <CopyIcon />}
                                        {copiedField === 'emails' ? 'Copied!' : 'Emails'}
                                    </button>
                                    <button
                                        onClick={() => copyField('names')}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-95 ${
                                            copiedField === 'names' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        {copiedField === 'names' ? <CheckIcon /> : <CopyIcon />}
                                        {copiedField === 'names' ? 'Copied!' : 'Names'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ── Desktop Table ──────────────────────────────────── */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50/80 text-left border-y border-gray-100">
                                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Name</th>
                                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Email</th>
                                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Status</th>
                                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs text-right">Records</th>
                                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs text-right">SOAP</th>
                                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs text-right">Queries</th>
                                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Onboarding</th>
                                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Joined</th>
                                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Expires</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {visibleUsers.map(user => (
                                        <tr key={user.id} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{user.dvm_name || user.nickname || '—'}</td>
                                            <td className="px-4 py-3 text-gray-600 max-w-[220px] truncate">{user.email}</td>
                                            <td className={`px-4 py-3 font-semibold text-xs ${getStatusColor(user)}`}>{getStatusLabel(user)}</td>
                                            <td className="px-4 py-3 text-gray-600 text-right tabular-nums">{user[rCol] || 0}</td>
                                            <td className="px-4 py-3 text-blue-700 font-semibold text-right tabular-nums">{user[sCol] || 0}</td>
                                            <td className="px-4 py-3 text-gray-600 text-right tabular-nums">{user[qCol] || 0}</td>
                                            <td className="px-4 py-3 text-xs">
                                                {user.has_completed_onboarding || user.onboarding_status === 'completed'
                                                    ? <span className="text-green-600 font-medium">Done</span>
                                                    : user.onboarding_step
                                                        ? <span className="text-amber-600 font-medium">{user.onboarding_step}</span>
                                                        : <span className="text-gray-300">—</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3 text-gray-400 text-xs tabular-nums">{formatDate(user.created_at)}</td>
                                            <td className="px-4 py-3 text-gray-400 text-xs tabular-nums">{formatDate(user.subscription_end_date)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* ── Mobile / Tablet Cards ──────────────────────────── */}
                        <div className="lg:hidden px-3 sm:px-4 pb-3 space-y-2">
                            {visibleUsers.map(user => (
                                <UserCard
                                    key={user.id}
                                    user={user}
                                    rCol={rCol}
                                    sCol={sCol}
                                    qCol={qCol}
                                    formatDate={formatDate}
                                    getStatusBadge={getStatusBadge}
                                    getOnboardingBadge={getOnboardingBadge}
                                />
                            ))}
                        </div>

                        {/* Load more */}
                        {filteredUsers.length > userDisplayCount && (
                            <div className="text-center py-3 px-3">
                                <button
                                    onClick={() => setUserDisplayCount(p => p + 30)}
                                    className="w-full sm:w-auto px-8 py-3 bg-gray-100 text-gray-700 rounded-2xl text-sm font-medium active:bg-gray-200 transition-colors"
                                >
                                    Load more ({filteredUsers.length - userDisplayCount} remaining)
                                </button>
                            </div>
                        )}

                        {filteredUsers.length === 0 && (
                            <div className="text-center py-16 px-4">
                                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                                    <SearchIcon />
                                </div>
                                <p className="text-gray-500 font-medium">No users found</p>
                                <button
                                    onClick={() => { setSubscriptionFilter('all'); setMinQuickSOAP(0); setSearchQuery(''); }}
                                    className="mt-2 text-blue-600 text-sm font-medium active:underline"
                                >
                                    Clear all filters
                                </button>
                            </div>
                        )}
                    </div>
                </Section>

                <p className="text-center text-[10px] text-gray-300 pb-2">
                    Updated {new Date().toLocaleTimeString()}
                </p>
            </main>

            {/* ── Mobile Bottom Bar (copy actions) ─────────────────────── */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-200/60 px-4 py-2.5 z-20 safe-area-bottom">
                <div className="flex gap-2">
                    <button
                        onClick={refresh}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 rounded-xl text-[13px] font-semibold text-gray-700 active:bg-gray-200 transition-colors"
                    >
                        <RefreshIcon /> Refresh
                    </button>
                    <button
                        onClick={() => copyField('emails')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-[0.97] ${
                            copiedField === 'emails' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                        }`}
                    >
                        {copiedField === 'emails' ? <><CheckIcon /> Copied!</> : <><CopyIcon /> Copy Emails</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
