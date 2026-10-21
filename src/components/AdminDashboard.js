import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCopy, FaCheck, FaSearch, FaTimes, FaSignOutAlt, FaLock } from 'react-icons/fa';
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
const LIVE_INTERVAL_MS = 30000;

// Effective plan, mirrors server/usage.js getTier (past due counts as free).
function planOf(u) {
    const now = Date.now();
    const end = u.subscription_end_date ? new Date(u.subscription_end_date).getTime() : 0;
    if (u.plan_label === 'student' && end > now) return 'Student';
    if (u.subscription_status === 'past_due') return 'Past due';
    if (u.subscription_status === 'active') {
        if (u.subscription_interval === 'monthly') return 'Monthly';
        if (u.subscription_interval === 'yearly') return 'Yearly';
        if (['trial', 'stripe_trial'].includes(u.subscription_interval) && end > now) return 'Trial';
    }
    return 'Free';
}

const isPaying = (u) => ['Monthly', 'Yearly'].includes(planOf(u));
const soapsOf = (u) => (u.quicksoap_count || 0) + (u.petsoap_count || 0);

const PLAN_STYLES = {
    Monthly: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Yearly: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    Trial: 'bg-sky-50 text-sky-700 ring-sky-200',
    'Past due': 'bg-red-50 text-red-700 ring-red-200',
    Student: 'bg-purple-50 text-purple-700 ring-purple-200',
    Free: 'bg-gray-50 text-gray-500 ring-gray-200'
};

const FILTERS = [
    { key: 'all', label: 'All', test: () => true },
    { key: 'paying', label: 'Paying', test: isPaying },
    { key: 'trial', label: 'Trial', test: (u) => planOf(u) === 'Trial' },
    { key: 'free', label: 'Free', test: (u) => planOf(u) === 'Free' },
    { key: 'past_due', label: 'Past due', test: (u) => planOf(u) === 'Past due' }
];

const SORTS = {
    newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    soaps: (a, b) => soapsOf(b) - soapsOf(a),
    queries: (a, b) => (b.petquery_count || 0) - (a.petquery_count || 0)
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
const nameOf = (u) => u.dvm_name || u.nickname || u.email || 'Unknown';

const PlanBadge = ({ user }) => {
    const plan = planOf(user);
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${PLAN_STYLES[plan]}`}>
            {plan}
            {user.cancel_at_period_end && isPaying(user) && <span className="ml-1 font-medium opacity-70">· canceling</span>}
        </span>
    );
};

const Stat = ({ label, value, sub, onClick, active }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`text-left rounded-2xl bg-white p-4 sm:p-5 border transition-colors ${active ? 'border-[#3468bd] ring-1 ring-[#3468bd]/20' : 'border-gray-200'} ${onClick ? 'hover:border-[#3468bd]/50' : 'cursor-default'}`}
    >
        <p className="text-[12px] font-medium text-gray-500">{label}</p>
        <p className="text-[28px] font-bold text-gray-900 mt-1 tabular-nums leading-none">{value}</p>
        {sub && <p className="text-[12px] text-gray-400 mt-1.5">{sub}</p>}
    </button>
);

const Gate = ({ icon, title, body, action }) => (
    <div className="min-h-[100dvh] bg-[#f7f8fb] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-sm text-center">
            {icon}
            <h1 className="text-xl font-bold text-gray-900 mb-1">{title}</h1>
            <p className="text-[13px] text-gray-500 mb-6">{body}</p>
            {action}
        </div>
    </div>
);

const AdminDashboard = () => {
    const { isAuthenticated, isLoading: authLoading, user, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();
    const isAdmin = isAuthenticated && user?.sub === ADMIN_USER_ID;

    const [users, setUsers] = useState([]);
    const [today, setToday] = useState({ soaps: 0, queries: 0, signups: 0 });
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(null);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [, setTick] = useState(0);

    const [filter, setFilter] = useState('all');
    const [sort, setSort] = useState('newest');
    const [search, setSearch] = useState('');
    const [shown, setShown] = useState(50);
    const [selected, setSelected] = useState(null);

    const getAuthHeaders = useCallback(async () => {
        const token = await getAccessTokenSilently();
        return { Authorization: `Bearer ${token}` };
    }, [getAccessTokenSilently]);

    const load = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const [u, s] = await Promise.all([
                axios.get(`${API_URL}/admin/users`, { headers }),
                axios.get(`${API_URL}/admin/analytics/timeseries`, {
                    headers,
                    params: { granularity: 'day', start: start.toISOString(), end: new Date().toISOString(), tz: BROWSER_TZ }
                })
            ]);
            setUsers(u.data.users || []);
            const t = { soaps: 0, queries: 0, signups: 0 };
            (s.data.series || []).forEach((d) => {
                t.soaps += (d.quicksoap || 0) + (d.petsoap || 0);
                t.queries += d.petquery || 0;
                t.signups += d.signups || 0;
            });
            setToday(t);
            setUpdatedAt(Date.now());
            setError(null);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoaded(true);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!isAdmin) return undefined;
        load();
        const poll = setInterval(() => document.visibilityState === 'visible' && load(), LIVE_INTERVAL_MS);
        const onFocus = () => load();
        window.addEventListener('focus', onFocus);
        return () => {
            clearInterval(poll);
            window.removeEventListener('focus', onFocus);
        };
    }, [isAdmin, load]);

    useEffect(() => {
        const t = setInterval(() => setTick((n) => n + 1), 5000);
        return () => clearInterval(t);
    }, []);

    const counts = useMemo(() => {
        const c = { all: users.length, paying: 0, monthly: 0, yearly: 0, trial: 0, free: 0, past_due: 0 };
        users.forEach((u) => {
            const p = planOf(u);
            if (p === 'Monthly') { c.paying++; c.monthly++; }
            if (p === 'Yearly') { c.paying++; c.yearly++; }
            if (p === 'Trial') c.trial++;
            if (p === 'Free') c.free++;
            if (p === 'Past due') c.past_due++;
        });
        return c;
    }, [users]);

    const filtered = useMemo(() => {
        const test = FILTERS.find((f) => f.key === filter)?.test || (() => true);
        const q = search.trim().toLowerCase();
        return users
            .filter(test)
            .filter((u) => !q || [u.email, u.dvm_name, u.nickname, u.phone_number].some((v) => (v || '').toLowerCase().includes(q)))
            .sort(SORTS[sort]);
    }, [users, filter, search, sort]);

    if (authLoading) return <Gate title="Loading…" body="" />;

    if (!isAuthenticated) {
        return (
            <Gate
                icon={<div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: BRAND }}><FaLock className="text-white text-lg" /></div>}
                title="PetWise Admin"
                body="Sign in with your admin account to continue"
                action={
                    <button onClick={() => loginWithRedirect({ appState: { returnTo: '/admin' } })}
                        className="w-full py-3 text-white font-semibold rounded-xl" style={{ background: BRAND }}>
                        Sign in
                    </button>
                }
            />
        );
    }

    if (!isAdmin) {
        return (
            <Gate
                icon={<div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><FaTimes className="text-red-500 text-lg" /></div>}
                title="Access denied"
                body="This account doesn't have admin access."
                action={
                    <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                        className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200">
                        Sign out
                    </button>
                }
            />
        );
    }

    if (!loaded) return <Gate title="Loading users…" body="" />;

    const secondsAgo = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt) / 1000)) : null;
    const pick = (key) => { setFilter(key); setShown(50); };

    return (
        <div className="min-h-[100dvh] bg-[#f7f8fb]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
                <div className="flex items-center justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Admin</h1>
                        <p className="mt-1 flex items-center gap-2 text-[12px] text-gray-500">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                            Live · updated {secondsAgo === null ? '-' : secondsAgo < 5 ? 'just now' : `${secondsAgo}s ago`}
                        </p>
                    </div>
                    <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-medium text-gray-500 hover:bg-gray-100">
                        <FaSignOutAlt className="text-xs" /> Log out
                    </button>
                </div>

                {error && (
                    <div className="mb-5 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center justify-between">
                        <p className="text-red-700 text-[13px]">Couldn't refresh: {error}</p>
                        <button onClick={load} className="ml-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200">Retry</button>
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Stat label="Paying" value={counts.paying} sub={`${counts.monthly} monthly · ${counts.yearly} yearly`} onClick={() => pick('paying')} active={filter === 'paying'} />
                    <Stat label="On trial" value={counts.trial} onClick={() => pick('trial')} active={filter === 'trial'} />
                    <Stat label="Free" value={counts.free} sub={counts.past_due ? `+ ${counts.past_due} past due` : null} onClick={() => pick('free')} active={filter === 'free'} />
                    <Stat label="Today" value={today.soaps} sub={`SOAPs · ${today.queries} queries · ${today.signups} signups`} />
                </div>

                <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex flex-wrap gap-1.5">
                        {FILTERS.map((f) => (
                            <button key={f.key} onClick={() => pick(f.key)}
                                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${filter === f.key ? 'bg-[#3468bd] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                {f.label} <span className={`tabular-nums ${filter === f.key ? 'text-white/70' : 'text-gray-400'}`}>{counts[f.key]}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 sm:ml-auto">
                        <div className="relative flex-1 sm:w-56">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search"
                                className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#3468bd]/20" />
                        </div>
                        <select value={sort} onChange={(e) => setSort(e.target.value)}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-[13px] text-gray-700 focus:outline-none">
                            <option value="newest">Newest</option>
                            <option value="soaps">Most SOAPs</option>
                            <option value="queries">Most queries</option>
                        </select>
                    </div>
                </div>

                <div className="mt-3 rounded-2xl border border-gray-200 bg-white overflow-hidden">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                                <th className="px-4 py-3 font-semibold">User</th>
                                <th className="px-4 py-3 font-semibold">Plan</th>
                                <th className="px-4 py-3 font-semibold text-right">SOAPs</th>
                                <th className="px-4 py-3 font-semibold text-right">Queries</th>
                                <th className="px-4 py-3 font-semibold text-right hidden sm:table-cell">Joined</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.slice(0, shown).map((u) => (
                                <tr key={u.id} onClick={() => setSelected(u)} className="hover:bg-blue-50/40 cursor-pointer">
                                    <td className="px-4 py-3 max-w-[220px]">
                                        <p className="font-semibold text-gray-900 truncate">{nameOf(u)}</p>
                                        <p className="text-[12px] text-gray-400 truncate">{u.email}</p>
                                    </td>
                                    <td className="px-4 py-3"><PlanBadge user={u} /></td>
                                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">{soapsOf(u)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{u.petquery_count || 0}</td>
                                    <td className="px-4 py-3 text-right text-[12px] text-gray-400 tabular-nums hidden sm:table-cell">{formatDate(u.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && <p className="text-center py-14 text-gray-400 text-[13px]">No users match.</p>}
                </div>

                {filtered.length > shown && (
                    <button onClick={() => setShown((n) => n + 50)}
                        className="mt-3 w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-[13px] font-semibold hover:bg-gray-50">
                        Show more ({filtered.length - shown})
                    </button>
                )}
            </div>

            <AnimatePresence>
                {selected && (
                    <UserDrawer
                        user={users.find((u) => u.id === selected.id) || selected}
                        refreshedAt={updatedAt}
                        onClose={() => setSelected(null)}
                        getAuthHeaders={getAuthHeaders}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

const PERIODS = [
    { key: 'last24h', label: 'Day' },
    { key: 'last7d', label: 'Week' },
    { key: 'last30d', label: 'Month' },
    { key: 'total', label: 'Total' }
];

const UserDrawer = ({ user, refreshedAt, onClose, getAuthHeaders }) => {
    const [usage, setUsage] = useState(null);
    const [copied, setCopied] = useState(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const headers = await getAuthHeaders();
                const res = await axios.get(`${API_URL}/admin/user-usage`, { headers, params: { sub: user.auth0_user_id } });
                if (alive) setUsage(res.data.usage);
            } catch {
                if (alive) setUsage((u) => u || {});
            }
        })();
        return () => { alive = false; };
    }, [user.auth0_user_id, getAuthHeaders, refreshedAt]);

    const copy = (key, text) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
    };

    const val = (type, period) => {
        const n = usage?.[type]?.[period] || 0;
        // QuickSOAP lifetime also includes the counter from before event logging existed.
        return type === 'quicksoap' && period === 'total' ? Math.max(n, user.quicksoap_count || 0) : n;
    };

    const rows = [
        { label: 'SOAP notes', types: ['quicksoap', 'petsoap'] },
        { label: 'PetQuery questions', types: ['petquery'] }
    ];

    const plan = planOf(user);
    const planLine = isPaying(user)
        ? `${user.cancel_at_period_end ? 'Ends' : 'Renews'} ${formatDate(user.subscription_end_date)}`
        : plan === 'Trial' ? `Trial ends ${formatDate(user.subscription_end_date)}` : null;

    const Copyable = ({ k, text, href }) => text ? (
        <div className="flex items-center justify-between gap-3 py-2.5">
            <a href={href} className="text-[13px] text-[#3468bd] hover:underline truncate">{text}</a>
            <button onClick={() => copy(k, text)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#3468bd] hover:bg-blue-50" title="Copy">
                {copied === k ? <FaCheck className="text-[11px] text-emerald-500" /> : <FaCopy className="text-[11px]" />}
            </button>
        </div>
    ) : null;

    return (
        <>
            <motion.div className="fixed inset-0 bg-black/25 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
            <motion.aside
                className="fixed top-0 right-0 h-full w-full sm:max-w-md bg-white z-50 shadow-2xl overflow-y-auto"
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            >
                <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="text-base font-bold text-gray-900 truncate">{nameOf(user)}</h3>
                        <div className="mt-1.5 flex items-center gap-2 text-[12px] text-gray-500">
                            <PlanBadge user={user} />
                            {planLine && <span>{planLine}</span>}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100"><FaTimes /></button>
                </div>

                <div className="p-5 space-y-6">
                    <section>
                        <p className="text-[12px] font-semibold text-gray-500 mb-2">Usage</p>
                        <div className="rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="grid grid-cols-[1fr_repeat(4,52px)] px-4 py-2.5 bg-gray-50 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                                <span />
                                {PERIODS.map((p) => <span key={p.key} className="text-right">{p.label}</span>)}
                            </div>
                            {rows.map((r) => (
                                <div key={r.label} className="grid grid-cols-[1fr_repeat(4,52px)] items-center px-4 py-3.5 border-t border-gray-100">
                                    <span className="text-[13px] font-medium text-gray-700">{r.label}</span>
                                    {PERIODS.map((p) => (
                                        <span key={p.key} className={`text-right tabular-nums ${p.key === 'total' ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                                            {usage ? r.types.reduce((sum, t) => sum + val(t, p.key), 0) : '…'}
                                        </span>
                                    ))}
                                </div>
                            ))}
                        </div>
                        <p className="mt-2 text-[11px] text-gray-400">Day, week and month are rolling (last 24 hours, 7 days, 30 days).</p>
                    </section>

                    <section>
                        <p className="text-[12px] font-semibold text-gray-500 mb-1">Contact</p>
                        <div className="divide-y divide-gray-100">
                            <Copyable k="email" text={user.email} href={`mailto:${user.email}`} />
                            <Copyable k="phone" text={user.phone_number} href={`tel:${user.phone_number}`} />
                        </div>
                    </section>

                    <section className="grid grid-cols-2 gap-3 text-[13px]">
                        <div className="rounded-xl bg-gray-50 p-3">
                            <p className="text-[11px] text-gray-400">Joined</p>
                            <p className="font-semibold text-gray-800 mt-0.5">{formatDate(user.created_at)}</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-3">
                            <p className="text-[11px] text-gray-400">Stripe</p>
                            {user.stripe_customer_id ? (
                                <button onClick={() => copy('stripe', user.stripe_customer_id)} className="font-mono text-[11px] text-gray-700 mt-1 truncate max-w-full block hover:text-[#3468bd]">
                                    {copied === 'stripe' ? 'Copied' : user.stripe_customer_id}
                                </button>
                            ) : <p className="font-semibold text-gray-800 mt-0.5">-</p>}
                        </div>
                    </section>
                </div>
            </motion.aside>
        </>
    );
};

export default AdminDashboard;
