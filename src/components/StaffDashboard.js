import React, { useState, useEffect } from 'react';
import { getCheckins } from '../db';

function StaffDashboard() {
    const [checkins, setCheckins] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCheckins = async () => {
            try {
                const data = await getCheckins();
                // Sort by timestamp descending
                const sorted = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                setCheckins(sorted);
            } catch (err) {
                console.error("Failed to fetch check-ins:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchCheckins();
        // Poll for new check-ins every 5 seconds for simulation
        const interval = setInterval(fetchCheckins, 5000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (isoString) => {
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <main className="dashboard">
            <header className="dashboard-header">
                <h2>Patient Arrival Dashboard</h2>
                <span className="live-indicator">● LIVE</span>
            </header>

            {loading ? (
                <p>Loading arrivals...</p>
            ) : checkins.length === 0 ? (
                <div className="empty-state">
                    <p>No patients have checked in yet today.</p>
                </div>
            ) : (
                <div className="checkin-list">
                    <table>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Patient Name</th>
                                <th>DOB</th>
                                <th>Purpose</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {checkins.map((checkin, index) => (
                                <tr key={index} className="checkin-row">
                                    <td className="time-cell">{formatTime(checkin.timestamp)}</td>
                                    <td className="name-cell">{checkin.name}</td>
                                    <td>{checkin.dob}</td>
                                    <td className="purpose-cell">{checkin.purpose}</td>
                                    <td><span className="status-badge">Waiting</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );
}

export default StaffDashboard;
