import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';
import '../styles/AdminDashboard.css';

// Chart component (placeholder - you can replace with a real chart library)
const MonthlyChart = ({ data }) => {
    if (!data || data.length === 0) return <div>No data available</div>;

    const maxUsers = Math.max(...data.map(d => d.newUsers));
    const maxReports = Math.max(...data.map(d => d.newReports));
    const scale = 200 / (maxUsers > maxReports ? maxUsers : maxReports);

    return (
        <div className="monthly-chart">
            <div className="chart-bars">
                {data.map((month, i) => (
                    <div key={i} className="chart-month">
                        <div className="chart-column">
                            <div
                                className="chart-bar users"
                                style={{ height: `${month.newUsers * scale}px` }}
                            >
                                <span className="chart-value">{month.newUsers}</span>
                            </div>
                            <div
                                className="chart-bar reports"
                                style={{ height: `${month.newReports * scale}px` }}
                            >
                                <span className="chart-value">{month.newReports}</span>
                            </div>
                        </div>
                        <div className="chart-label">{month.month}</div>
                    </div>
                ))}
            </div>
            <div className="chart-legend">
                <div className="legend-item">
                    <span className="legend-color users"></span>
                    <span>New Users</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color reports"></span>
                    <span>Reports</span>
                </div>
            </div>
        </div>
    );
};

const AdminDashboard = () => {
    const { user } = useAuth0();
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
    const [userFilter, setUserFilter] = useState('all'); // 'all', 'active', 'inactive', 'trial'
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

    // Define column names for metrics
    const reportColumn = 'weekly_reports_count';
    const queryColumn = 'quick_query_messages_count';

    useEffect(() => {
        if (user?.sub) {
            fetchData();
            fetchServerMetrics();
        }
    }, [timeframe, user]);

    // Detect mobile devices
    const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobileView(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Apply user filter when it changes or when users change
    useEffect(() => {
        filterUsers();
    }, [userFilter, users]);

    const filterUsers = () => {
        if (!users.length) return;

        let filtered = [...users];

        switch (userFilter) {
            case 'active':
                filtered = users.filter(u =>
                    u.subscription_status === 'active' &&
                    u.subscription_interval !== 'trial'
                );
                break;
            case 'inactive':
                filtered = users.filter(u =>
                    u.subscription_status === 'inactive'
                );
                break;
            case 'trial':
                filtered = users.filter(u =>
                    u.subscription_status === 'active' &&
                    u.subscription_interval === 'trial'
                );
                break;
            case 'canceling':
                filtered = users.filter(u =>
                    u.cancel_at_period_end === true
                );
                break;
            default: // 'all'
                // Keep all users
                break;
        }

        setFilteredUsers(filtered);
    };

    const fetchServerMetrics = async () => {
        try {
            const apiUrl = process.env.NODE_ENV === 'production'
                ? 'https://api.petwise.vet/admin-metrics'
                : 'http://localhost:3001/admin-metrics';

            // Check if the endpoint is reachable first
            const checkEndpoint = await fetch(apiUrl, {
                method: 'HEAD',
                headers: { 'Content-Type': 'application/json' }
            }).catch(() => ({ ok: false }));

            // If server endpoint isn't available, don't try to fetch metrics
            if (!checkEndpoint.ok) {
                console.log('Server metrics endpoint not available, using client-side metrics only.');
                return;
            }

            const response = await axios.get(apiUrl, {
                params: { user_id: user.sub }
            });

            setAdvancedMetrics(response.data);
        } catch (err) {
            console.error('Error fetching server metrics:', err);
            // We'll still show the client-side metrics even if server fails
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);

            // Get users data only
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (userError) throw userError;

            // Filter users based on selected timeframe
            const now = new Date();
            let filteredTimeframeUsers = [...userData];

            if (timeframe !== 'all') {
                let cutoffDate = new Date();

                if (timeframe === 'today') {
                    // Set to beginning of today (midnight)
                    cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                } else if (timeframe === 'week') {
                    cutoffDate.setDate(now.getDate() - 7); // Last 7 days
                } else if (timeframe === 'month') {
                    cutoffDate.setMonth(now.getMonth() - 1); // Last month
                } else if (timeframe === 'year') {
                    cutoffDate.setFullYear(now.getFullYear() - 1); // Last year
                }

                filteredTimeframeUsers = userData.filter(user =>
                    new Date(user.created_at) >= cutoffDate
                );

                console.log(`Filtered to ${filteredTimeframeUsers.length} users created since ${cutoffDate.toLocaleDateString()}`);
            }

            // Calculate metrics from filtered user data
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            let newTrials = 0;
            let newSubscriptions = 0;
            let reportCount = 0;
            let queryCount = 0;

            // Process user data for metrics (using filtered users)
            filteredTimeframeUsers.forEach(user => {
                // Add report counts
                reportCount += user[reportColumn] || 0;

                // Add quick query counts
                queryCount += user[queryColumn] || 0;

                // Check for new trials/subscriptions this month
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

            // Get subscription stats from filtered users
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

            // Update state with all data
            setUsers(userData); // Keep all users for filtering
            setFilteredUsers(userData); // Initial set before user filter is applied
            setTotalUsers(filteredTimeframeUsers.length); // Show count of filtered users
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
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

    const toggleSection = (section) => {
        setShowSection({
            ...showSection,
            [section]: !showSection[section]
        });
    };

    if (loading) return <div className="admin-loading">Loading admin dashboard...</div>;

    // Change error handling to show partial data instead of complete error
    // if (error) return <div className="admin-error">{error}</div>;

    return (
        <div className={`admin-dashboard ${isMobileView ? 'mobile-view' : ''}`}>
            <h1>PetWise Admin Dashboard</h1>

            {error && (
                <div className="admin-warning">
                    <p>Warning: Some data couldn't be loaded. {error}</p>
                    <button onClick={fetchData} className="retry-button">Retry</button>
                </div>
            )}

            <div className="metrics-controls">
                <select
                    value={timeframe}
                    onChange={e => setTimeframe(e.target.value)}
                    className="timeframe-select"
                >
                    <option value="today">Today</option>
                    <option value="week">Last Week</option>
                    <option value="month">Last Month</option>
                    <option value="year">Last Year</option>
                    <option value="all">All Time</option>
                </select>
                <button onClick={() => {
                    fetchData();
                    fetchServerMetrics();
                }} className="refresh-button">
                    Refresh Data
                </button>
                {/* Mobile Admin Note */}
                {isMobileView && (
                    <div className="mobile-admin-note">
                        <p>Scroll horizontally to view all data in tables</p>
                    </div>
                )}
            </div>

            <section className="dashboard-section">
                <div className="section-header" onClick={() => toggleSection('overview')}>
                    <h2>Overview</h2>
                    <span className="toggle-icon">{showSection.overview ? '▼' : '►'}</span>
                </div>

                {showSection.overview && (
                    <div className="metrics-overview">
                        <div className="metrics-timeframe-label">
                            {timeframe === 'all'
                                ? 'Showing metrics for all time'
                                : timeframe === 'today'
                                    ? 'Showing metrics for today'
                                    : `Showing metrics for last ${timeframe}`}
                        </div>

                        <div className="metric-card">
                            <h3>Total Users</h3>
                            <p className="metric-value">{advancedMetrics?.totalUsers || totalUsers}</p>
                        </div>

                        <div className="metric-card">
                            <h3>Records Generated</h3>
                            <p className="metric-value">{totalReports}</p>
                        </div>

                        <div className="metric-card">
                            <h3>Pet Queries</h3>
                            <p className="metric-value">{advancedMetrics?.totalQuickQueries || totalQuickQueries}</p>
                        </div>

                        <div className="metric-card">
                            <h3>New Trials (Month)</h3>
                            <p className="metric-value">{newTrialsThisMonth}</p>
                        </div>

                        <div className="metric-card">
                            <h3>New Subs (Month)</h3>
                            <p className="metric-value">{newSubscriptionsThisMonth}</p>
                        </div>

                        {advancedMetrics && (
                            <div className="metric-card growth">
                                <h3>User Growth</h3>
                                <p className="metric-value">
                                    {advancedMetrics.growthRate > 0 ? '+' : ''}
                                    {advancedMetrics.growthRate.toFixed(1)}%
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </section>

            <section className="dashboard-section">
                <div className="section-header" onClick={() => toggleSection('subscriptions')}>
                    <h2>Subscription Overview</h2>
                    <span className="toggle-icon">{showSection.subscriptions ? '▼' : '►'}</span>
                </div>

                {showSection.subscriptions && (
                    <div className="stats-grid">
                        <div className="stat-box active">
                            <h3>Active Subscriptions</h3>
                            <p>{advancedMetrics?.subscriptionsByType?.monthly +
                                advancedMetrics?.subscriptionsByType?.yearly ||
                                subscriptionStats.active}</p>
                            {advancedMetrics && (
                                <div className="stat-breakdown">
                                    <span>Monthly: {advancedMetrics.subscriptionsByType.monthly}</span>
                                    <span>Yearly: {advancedMetrics.subscriptionsByType.yearly}</span>
                                </div>
                            )}
                        </div>
                        <div className="stat-box trial">
                            <h3>Active Trials</h3>
                            <p>{advancedMetrics?.subscriptionsByType?.trial || subscriptionStats.trial}</p>
                        </div>
                        <div className="stat-box canceled">
                            <h3>Canceling Soon</h3>
                            <p>{advancedMetrics?.subscriptionsByType?.canceling || subscriptionStats.canceled}</p>
                        </div>
                        <div className="stat-box inactive">
                            <h3>Inactive Users</h3>
                            <p>{advancedMetrics?.subscriptionsByType?.inactive || subscriptionStats.inactive}</p>
                        </div>
                    </div>
                )}
            </section>

            {advancedMetrics?.monthlyMetrics && showSection.charts && (
                <section className="dashboard-section">
                    <div className="section-header" onClick={() => toggleSection('charts')}>
                        <h2>Monthly Growth</h2>
                        <span className="toggle-icon">{showSection.charts ? '▼' : '►'}</span>
                    </div>

                    {showSection.charts && (
                        <div className="chart-container">
                            <MonthlyChart data={advancedMetrics.monthlyMetrics.slice().reverse()} />
                        </div>
                    )}
                </section>
            )}

            <section className="dashboard-section">
                <div className="section-header" onClick={() => toggleSection('users')}>
                    <h2>User Details</h2>
                    <span className="toggle-icon">{showSection.users ? '▼' : '►'}</span>
                </div>

                {showSection.users && (
                    <div className="users-table-container">
                        <div className="user-filter-controls">
                            <label>Filter Users:</label>
                            <select
                                value={userFilter}
                                onChange={e => setUserFilter(e.target.value)}
                                className="user-filter-select"
                            >
                                <option value="all">All Users</option>
                                <option value="active">Active Subscriptions</option>
                                <option value="trial">Active Trials</option>
                                <option value="canceling">Canceling Soon</option>
                                <option value="inactive">Inactive Users</option>
                            </select>
                            <span className="user-count">
                                Showing {filteredUsers.length} of {users.length} users
                            </span>
                        </div>

                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Subscription</th>
                                    <th>Records Generated</th>
                                    <th>Pet Queries</th>
                                    <th>Joined</th>
                                    <th>Expires</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => (
                                    <tr key={user.id}>
                                        <td>{user.dvm_name || user.nickname || 'N/A'}</td>
                                        <td>{user.email}</td>
                                        <td className={`status-${user.subscription_status}`}>
                                            {user.subscription_status}
                                            {user.subscription_interval !== 'trial' ?
                                                ` (${user.subscription_interval})` :
                                                ''}
                                            {user.cancel_at_period_end ? ' (canceling)' : ''}
                                        </td>
                                        <td>{user[reportColumn] || 0}</td>
                                        <td>{user[queryColumn] || 0}</td>
                                        <td>{formatDate(user.created_at)}</td>
                                        <td>{formatDate(user.subscription_end_date)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <div className="admin-footer">
                <p>Last updated: {new Date().toLocaleString()}</p>
            </div>
        </div>
    );
};

export default AdminDashboard; 