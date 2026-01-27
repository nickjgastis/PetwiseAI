import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import axios from 'axios';

// ============================================
// CHANGE THIS ACCESS CODE TO WHATEVER YOU WANT
// ============================================
const ADMIN_ACCESS_CODE = 'petwise8975247';

// Chart component with Tailwind
const MonthlyChart = ({ data }) => {
    if (!data || data.length === 0) {
        return <div className="text-gray-500 text-center py-8">No data available</div>;
    }

    const maxUsers = Math.max(...data.map(d => d.newUsers));
    const maxReports = Math.max(...data.map(d => d.newReports));
    const maxValue = Math.max(maxUsers, maxReports);
    const scale = maxValue > 0 ? 180 / maxValue : 1;

    return (
        <div className="flex flex-col items-center w-full">
            <div className="flex justify-around items-end w-full h-56 pb-4">
                {data.map((month, i) => (
                    <div key={i} className="flex flex-col items-center">
                        <div className="flex gap-1 h-48 items-end">
                            <div className="relative flex flex-col items-center">
                                <span className="text-xs text-gray-600 mb-1">{month.newUsers}</span>
                                <div
                                    className="w-6 bg-blue-500 rounded-t transition-all duration-300"
                                    style={{ height: `${Math.max(month.newUsers * scale, 4)}px` }}
                                />
                            </div>
                            <div className="relative flex flex-col items-center">
                                <span className="text-xs text-gray-600 mb-1">{month.newReports}</span>
                                <div
                                    className="w-6 bg-amber-500 rounded-t transition-all duration-300"
                                    style={{ height: `${Math.max(month.newReports * scale, 4)}px` }}
                                />
                            </div>
                        </div>
                        <span className="text-xs text-gray-500 mt-2">{month.month}</span>
                    </div>
                ))}
            </div>
            <div className="flex gap-6 mt-4">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded" />
                    <span className="text-sm text-gray-600">New Users</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-amber-500 rounded" />
                    <span className="text-sm text-gray-600">Reports</span>
                </div>
            </div>
        </div>
    );
};

// Collapsible Section Component
const Section = ({ title, isOpen, onToggle, children }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
            <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </button>
        {isOpen && <div className="border-t border-gray-100">{children}</div>}
    </div>
);

// Metric Card Component
const MetricCard = ({ title, value, color = 'blue', subtitle }) => (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
        <p className={`text-3xl font-bold ${color === 'green' ? 'text-green-600' : 'text-gray-900'}`}>
            {value}
        </p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
);

// Stat Box Component
const StatBox = ({ title, value, color, breakdown }) => {
    const colorClasses = {
        green: 'bg-gradient-to-br from-green-500 to-green-600',
        blue: 'bg-gradient-to-br from-blue-500 to-blue-600',
        amber: 'bg-gradient-to-br from-amber-500 to-amber-600',
        gray: 'bg-gradient-to-br from-gray-500 to-gray-600',
    };

    return (
        <div className={`${colorClasses[color]} rounded-xl p-5 text-white`}>
            <h3 className="text-sm font-medium opacity-90">{title}</h3>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {breakdown && (
                <div className="mt-3 space-y-1 text-sm opacity-80">
                    {breakdown.map((item, i) => (
                        <div key={i}>{item}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

const AdminDashboard = () => {
    // Access code authentication
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return sessionStorage.getItem('adminAuth') === 'true';
    });
    const [accessCode, setAccessCode] = useState('');
    const [authError, setAuthError] = useState('');

    const handleAccessSubmit = (e) => {
        e.preventDefault();
        if (accessCode === ADMIN_ACCESS_CODE) {
            sessionStorage.setItem('adminAuth', 'true');
            setIsAuthenticated(true);
            setAuthError('');
        } else {
            setAuthError('Invalid access code');
            setAccessCode('');
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('adminAuth');
        setIsAuthenticated(false);
    };

    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [totalReports, setTotalReports] = useState(0);
    const [totalQuickQueries, setTotalQuickQueries] = useState(0);
    const [newTrialsThisMonth, setNewTrialsThisMonth] = useState(0);
    const [newSubscriptionsThisMonth, setNewSubscriptionsThisMonth] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeframe, setTimeframe] = useState('month');
    const [userFilter, setUserFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [subscriptionStats, setSubscriptionStats] = useState({
        active: 0,
        trial: 0,
        canceled: 0,
        inactive: 0
    });
    const [advancedMetrics, setAdvancedMetrics] = useState(null);
    const [showSection, setShowSection] = useState({
        overview: true,
        subscriptions: true,
        users: true,
        charts: true
    });

    const reportColumn = 'weekly_reports_count';
    const quicksoapColumn = 'quicksoap_count';
    const queryColumn = 'quick_query_messages_count';

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
            fetchServerMetrics();
        }
    }, [timeframe, isAuthenticated]);

    useEffect(() => {
        filterAndSortUsers();
    }, [userFilter, sortBy, users]);

    const filterAndSortUsers = () => {
        if (!users.length) return;

        let filtered = [...users];

        // Apply filter
        switch (userFilter) {
            case 'active':
                filtered = filtered.filter(u =>
                    u.subscription_status === 'active' &&
                    u.subscription_interval !== 'trial'
                );
                break;
            case 'inactive':
                filtered = filtered.filter(u =>
                    u.subscription_status === 'inactive'
                );
                break;
            case 'trial':
                filtered = filtered.filter(u =>
                    u.subscription_status === 'active' &&
                    u.subscription_interval === 'trial'
                );
                break;
            case 'canceling':
                filtered = filtered.filter(u =>
                    u.cancel_at_period_end === true
                );
                break;
            default:
                break;
        }

        // Apply sort
        switch (sortBy) {
            case 'most_queries':
                filtered.sort((a, b) => (b[queryColumn] || 0) - (a[queryColumn] || 0));
                break;
            case 'most_quicksoap':
                filtered.sort((a, b) => (b[quicksoapColumn] || 0) - (a[quicksoapColumn] || 0));
                break;
            case 'most_records':
                filtered.sort((a, b) => (b[reportColumn] || 0) - (a[reportColumn] || 0));
                break;
            case 'oldest':
                filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                break;
            case 'newest':
            default:
                filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
        }

        setFilteredUsers(filtered);
    };

    const fetchServerMetrics = async () => {
        try {
            const apiUrl = process.env.NODE_ENV === 'production'
                ? 'https://api.petwise.vet/admin-metrics'
                : 'http://localhost:3001/admin-metrics';

            const checkEndpoint = await fetch(apiUrl, {
                method: 'HEAD',
                headers: { 'Content-Type': 'application/json' }
            }).catch(() => ({ ok: false }));

            if (!checkEndpoint.ok) {
                console.log('Server metrics endpoint not available, using client-side metrics only.');
                return;
            }

            const response = await axios.get(apiUrl, {
                params: { admin_access: 'true' }
            });

            setAdvancedMetrics(response.data);
        } catch (err) {
            console.error('Error fetching server metrics:', err);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (userError) throw userError;

            const now = new Date();
            let filteredTimeframeUsers = [...userData];

            if (timeframe !== 'all') {
                let cutoffDate = new Date();

                if (timeframe === 'today') {
                    cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                } else if (timeframe === 'week') {
                    cutoffDate.setDate(now.getDate() - 7);
                } else if (timeframe === 'month') {
                    cutoffDate.setMonth(now.getMonth() - 1);
                } else if (timeframe === 'year') {
                    cutoffDate.setFullYear(now.getFullYear() - 1);
                }

                filteredTimeframeUsers = userData.filter(user =>
                    new Date(user.created_at) >= cutoffDate
                );
            }

            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            let newTrials = 0;
            let newSubscriptions = 0;
            let reportCount = 0;
            let queryCount = 0;

            filteredTimeframeUsers.forEach(user => {
                reportCount += user[reportColumn] || 0;
                queryCount += user[queryColumn] || 0;

                if (user.subscription_interval === 'trial' &&
                    new Date(user.created_at) >= firstDayOfMonth) {
                    newTrials++;
                }

                if (user.subscription_interval !== 'trial' &&
                    user.subscription_status === 'active' &&
                    new Date(user.created_at) >= firstDayOfMonth) {
                    newSubscriptions++;
                }
            });

            const activeSubscriptions = filteredTimeframeUsers.filter(
                user => user.subscription_status === 'active' && user.subscription_interval !== 'trial'
            ).length;

            const activeTrials = filteredTimeframeUsers.filter(
                user => user.subscription_status === 'active' && user.subscription_interval === 'trial'
            ).length;

            const canceledSubscriptions = filteredTimeframeUsers.filter(
                user => user.cancel_at_period_end === true
            ).length;

            const inactiveUsers = filteredTimeframeUsers.filter(
                user => user.subscription_status === 'inactive'
            ).length;

            setUsers(userData);
            setFilteredUsers(userData);
            setTotalUsers(filteredTimeframeUsers.length);
            setTotalReports(reportCount);
            setTotalQuickQueries(queryCount);
            setNewTrialsThisMonth(newTrials);
            setNewSubscriptionsThisMonth(newSubscriptions);
            setSubscriptionStats({
                active: activeSubscriptions,
                trial: activeTrials,
                canceled: canceledSubscriptions,
                inactive: inactiveUsers
            });

        } catch (err) {
            console.error('Error fetching admin data:', err);
            setError('Failed to load admin data: ' + (err.message || JSON.stringify(err)));
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString();
    };

    const toggleSection = (section) => {
        setShowSection({
            ...showSection,
            [section]: !showSection[section]
        });
    };

    const getStatusColor = (status, interval, canceling) => {
        if (canceling) return 'text-amber-600';
        if (status === 'active' && interval !== 'trial') return 'text-green-600';
        if (status === 'active' && interval === 'trial') return 'text-blue-600';
        return 'text-gray-500';
    };

    // Login Screen
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Admin Access</h1>
                        <p className="text-gray-500 mt-1">Enter your access code to continue</p>
                    </div>
                    <form onSubmit={handleAccessSubmit} className="space-y-4">
                        <input
                            type="password"
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value)}
                            placeholder="Access code"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-lg"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30"
                        >
                            Access Dashboard
                        </button>
                    </form>
                    {authError && (
                        <p className="text-red-500 text-center mt-4 text-sm">{authError}</p>
                    )}
                </div>
            </div>
        );
    }

    // Loading Screen
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    // Main Dashboard
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">PetWise Admin</h1>
                                <p className="text-xs text-gray-500">Dashboard</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* Error Banner */}
                {error && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                        <p className="text-amber-800 text-sm">{error}</p>
                        <button
                            onClick={fetchData}
                            className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-sm hover:bg-amber-200 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={timeframe}
                        onChange={e => setTimeframe(e.target.value)}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                        <option value="today">Today</option>
                        <option value="week">Last Week</option>
                        <option value="month">Last Month</option>
                        <option value="year">Last Year</option>
                        <option value="all">All Time</option>
                    </select>
                    <button
                        onClick={() => {
                            fetchData();
                            fetchServerMetrics();
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                    <span className="text-sm text-gray-500 ml-auto">
                        {timeframe === 'all' ? 'All time' : timeframe === 'today' ? 'Today' : `Last ${timeframe}`}
                    </span>
                </div>

                {/* Overview Section */}
                <Section
                    title="Overview"
                    isOpen={showSection.overview}
                    onToggle={() => toggleSection('overview')}
                >
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        <MetricCard
                            title="Total Users"
                            value={advancedMetrics?.totalUsers || totalUsers}
                        />
                        <MetricCard
                            title="Records Generated"
                            value={totalReports}
                        />
                        <MetricCard
                            title="Pet Queries"
                            value={advancedMetrics?.totalQuickQueries || totalQuickQueries}
                        />
                        <MetricCard
                            title="New Trials"
                            value={newTrialsThisMonth}
                            subtitle="This month"
                        />
                        <MetricCard
                            title="New Subs"
                            value={newSubscriptionsThisMonth}
                            subtitle="This month"
                        />
                        {advancedMetrics && (
                            <MetricCard
                                title="User Growth"
                                value={`${advancedMetrics.growthRate > 0 ? '+' : ''}${advancedMetrics.growthRate.toFixed(1)}%`}
                                color="green"
                            />
                        )}
                    </div>
                </Section>

                {/* Subscriptions Section */}
                <Section
                    title="Subscriptions"
                    isOpen={showSection.subscriptions}
                    onToggle={() => toggleSection('subscriptions')}
                >
                    <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatBox
                            title="Active Subscriptions"
                            value={advancedMetrics?.subscriptionsByType?.monthly + advancedMetrics?.subscriptionsByType?.yearly || subscriptionStats.active}
                            color="green"
                            breakdown={advancedMetrics ? [
                                `Monthly: ${advancedMetrics.subscriptionsByType.monthly}`,
                                `Yearly: ${advancedMetrics.subscriptionsByType.yearly}`
                            ] : null}
                        />
                        <StatBox
                            title="Active Trials"
                            value={advancedMetrics?.subscriptionsByType?.trial || subscriptionStats.trial}
                            color="blue"
                        />
                        <StatBox
                            title="Canceling Soon"
                            value={advancedMetrics?.subscriptionsByType?.canceling || subscriptionStats.canceled}
                            color="amber"
                        />
                        <StatBox
                            title="Inactive"
                            value={advancedMetrics?.subscriptionsByType?.inactive || subscriptionStats.inactive}
                            color="gray"
                        />
                    </div>
                </Section>

                {/* Monthly Growth Chart */}
                {advancedMetrics?.monthlyMetrics && (
                    <Section
                        title="Monthly Growth"
                        isOpen={showSection.charts}
                        onToggle={() => toggleSection('charts')}
                    >
                        <div className="p-6">
                            <MonthlyChart data={advancedMetrics.monthlyMetrics.slice().reverse()} />
                        </div>
                    </Section>
                )}

                {/* Users Table Section */}
                <Section
                    title="User Details"
                    isOpen={showSection.users}
                    onToggle={() => toggleSection('users')}
                >
                    <div className="p-4">
                        {/* Filter & Sort Controls */}
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            <span className="text-sm text-gray-600">Filter:</span>
                            <select
                                value={userFilter}
                                onChange={e => setUserFilter(e.target.value)}
                                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                                <option value="all">All Users</option>
                                <option value="active">Active Subscriptions</option>
                                <option value="trial">Active Trials</option>
                                <option value="canceling">Canceling Soon</option>
                                <option value="inactive">Inactive</option>
                            </select>
                            
                            <span className="text-sm text-gray-600 ml-4">Sort:</span>
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="most_queries">Most Queries</option>
                                <option value="most_quicksoap">Most QuickSOAP</option>
                                <option value="most_records">Most Records</option>
                            </select>
                            
                            <span className="text-sm text-gray-400 ml-auto">
                                {filteredUsers.length} of {users.length} users
                            </span>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Records</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">QuickSOAP</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Queries</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Joined</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Expires</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredUsers.map(user => (
                                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                {user.dvm_name || user.nickname || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{user.email}</td>
                                            <td className={`px-4 py-3 font-medium ${getStatusColor(user.subscription_status, user.subscription_interval, user.cancel_at_period_end)}`}>
                                                {user.subscription_status}
                                                {user.subscription_interval !== 'trial' && ` (${user.subscription_interval})`}
                                                {user.cancel_at_period_end && ' ⚠️'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{user[reportColumn] || 0}</td>
                                            <td className="px-4 py-3 text-gray-600">{user[quicksoapColumn] || 0}</td>
                                            <td className="px-4 py-3 text-gray-600">{user[queryColumn] || 0}</td>
                                            <td className="px-4 py-3 text-gray-600">{formatDate(user.created_at)}</td>
                                            <td className="px-4 py-3 text-gray-600">{formatDate(user.subscription_end_date)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Section>

                {/* Footer */}
                <div className="text-center text-sm text-gray-400 py-4">
                    Last updated: {new Date().toLocaleString()}
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
