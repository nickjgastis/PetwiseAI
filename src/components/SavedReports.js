import React, { useEffect, useState } from 'react';
import '../styles/SavedReports.css';

const SavedReports = () => {
    const [reports, setReports] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);
    const [newReportName, setNewReportName] = useState('');

    useEffect(() => {
        const savedReports = JSON.parse(localStorage.getItem('savedReports')) || [];
        setReports(savedReports);
    }, []);

    const handleReportClick = (report) => {
        if (selectedReport === report) {
            setSelectedReport(null); // Deselect if already selected
        } else {
            setSelectedReport(report);
        }
    };

    const handleDeleteReport = (index) => {
        const updatedReports = reports.filter((_, i) => i !== index);
        setReports(updatedReports);
        localStorage.setItem('savedReports', JSON.stringify(updatedReports));
        setSelectedReport(null);
    };

    const handleEditClick = (index) => {
        setEditingIndex(index);
        setNewReportName(reports[index].date);
    };

    const handleNameChange = (e) => {
        setNewReportName(e.target.value);
    };

    const handleNameBlur = (index) => {
        const updatedReports = reports.map((report, i) =>
            i === index ? { ...report, date: newReportName } : report
        );
        setReports(updatedReports);
        localStorage.setItem('savedReports', JSON.stringify(updatedReports));
        setEditingIndex(null);
    };

    return (
        <div className="saved-reports">
            <h2>Saved Reports</h2>
            <div className="report-list">
                {reports.length > 0 ? (
                    reports.map((report, index) => (
                        <div key={index} className="report-item">
                            {editingIndex === index ? (
                                <input
                                    type="text"
                                    value={newReportName}
                                    onChange={handleNameChange}
                                    onBlur={() => handleNameBlur(index)}
                                    autoFocus
                                />
                            ) : (
                                <span onClick={() => handleReportClick(report)}>{report.date}</span>
                            )}
                            <div className="button-group">
                                <button className="edit-button" onClick={() => handleEditClick(index)}>Edit Name</button>
                                <button className="delete-button" onClick={() => handleDeleteReport(index)}>Delete</button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p>No saved reports available.</p>
                )}
            </div>
            {selectedReport && (
                <div className="report-card">
                    <h3>Report from {selectedReport.date}</h3>
                    <div className="report-content">
                        {selectedReport.text.split('\n').map((paragraph, index) => (
                            <p key={index}>{paragraph}</p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SavedReports;
