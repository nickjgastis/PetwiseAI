import React, { useEffect, useState } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import '../styles/SavedReports.css';

const SavedReports = () => {
    const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
    const [reports, setReports] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);
    const [newReportName, setNewReportName] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchReports = async () => {
            if (isAuthenticated) {
                try {
                    const token = await getAccessTokenSilently();
                    // Replace this with your actual API endpoint
                    const response = await fetch('https://your-api-endpoint.com/reports', {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    });
                    if (!response.ok) {
                        throw new Error('Failed to fetch reports');
                    }
                    const data = await response.json();
                    setReports(data);
                } catch (error) {
                    console.error("Error fetching reports:", error);
                    setError("Failed to fetch reports. Please try again.");
                }
            }
        };

        fetchReports();
    }, [isAuthenticated, getAccessTokenSilently]);

    const handleReportClick = (report) => {
        setSelectedReport(selectedReport === report ? null : report);
    };

    const handleDeleteReport = async (id) => {
        if (isAuthenticated) {
            try {
                const token = await getAccessTokenSilently();
                // Replace this with your actual API endpoint
                const response = await fetch(`https://your-api-endpoint.com/reports/${id}`, {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                if (!response.ok) {
                    throw new Error('Failed to delete report');
                }
                setReports(reports.filter(report => report.id !== id));
                setSelectedReport(null);
            } catch (error) {
                console.error("Error deleting report:", error);
                setError("Failed to delete report. Please try again.");
            }
        }
    };

    const handleEditClick = (index) => {
        setEditingIndex(index);
        setNewReportName(reports[index].report_name);
    };

    const handleNameChange = (e) => {
        setNewReportName(e.target.value);
    };

    const handleNameBlur = async (id) => {
        if (isAuthenticated) {
            try {
                const token = await getAccessTokenSilently();
                // Replace this with your actual API endpoint
                const response = await fetch(`https://your-api-endpoint.com/reports/${id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ report_name: newReportName })
                });
                if (!response.ok) {
                    throw new Error('Failed to update report name');
                }
                setReports(reports.map(report =>
                    report.id === id ? { ...report, report_name: newReportName } : report
                ));
                setEditingIndex(null);
            } catch (error) {
                console.error("Error updating report name:", error);
                setError("Failed to update report name. Please try again.");
            }
        }
    };

    if (!isAuthenticated) {
        return <div>Please log in to view your saved reports.</div>;
    }

    return (
        <div className="saved-reports">
            <h2>Saved Reports</h2>
            {error && <div className="error-message">{error}</div>}
            <div className="report-list">
                {reports.length > 0 ? (
                    reports.map((report, index) => (
                        <div key={report.id} className="report-item">
                            {editingIndex === index ? (
                                <input
                                    type="text"
                                    value={newReportName}
                                    onChange={handleNameChange}
                                    onBlur={() => handleNameBlur(report.id)}
                                    autoFocus
                                />
                            ) : (
                                <span onClick={() => handleReportClick(report)}>{report.report_name}</span>
                            )}
                            <div className="button-group">
                                <button className="edit-button" onClick={() => handleEditClick(index)}>Edit Name</button>
                                <button className="delete-button" onClick={() => handleDeleteReport(report.id)}>Delete</button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p>No saved reports available.</p>
                )}
            </div>
            {selectedReport && (
                <div className="report-card">
                    <h3>Report: {selectedReport.report_name}</h3>
                    <div className="report-content">
                        {selectedReport.report_text.split('\n').map((paragraph, index) => (
                            <p key={index}>{paragraph}</p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SavedReports;
