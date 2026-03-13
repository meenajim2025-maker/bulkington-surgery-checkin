import React, { useState, useEffect, useRef } from 'react';
import { getCheckins, updateCheckinStatus } from '../db';

function StaffDashboard() {
    const [checkins, setCheckins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastCount, setLastCount] = useState(0);
    const audioRef = useRef(null);

    const fetchCheckins = async () => {
        try {
            const data = await getCheckins();
            // Filter out 'Seen' unless we want an archive view later
            const active = data.filter(c => c.status !== 'Seen');
            const sorted = active.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setCheckins(sorted);

            // Notify if new check-in
            if (active.length > lastCount) {
                playNotifySound();
            }
            setLastCount(active.length);
        } catch (err) {
            console.error("Failed to fetch check-ins:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCheckins();
        const interval = setInterval(fetchCheckins, 5000);
        return () => clearInterval(interval);
    }, [lastCount]);

    const playNotifySound = () => {
        // Use a built-in browser beep or a short silent-ish audio if needed
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, context.currentTime); // A5
        gainNode.gain.setValueAtTime(0.1, context.currentTime);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.1);
    };

    const handleAction = async (id, status) => {
        try {
            await updateCheckinStatus(id, status);
            fetchCheckins();
        } catch (err) {
            alert("Failed to update status: " + err.message);
        }
    };

    const formatTime = (isoString) => {
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <main className="dashboard">
            <header className="dashboard-header">
                <div>
                    <h2>Patient Arrival Dashboard</h2>
                    <p style={{ fontSize: '0.8rem', color: '#666' }}>Currently {checkins.length} patients waiting</p>
                </div>
                <span className="live-indicator">● LIVE MONITORING</span>
            </header>

            {loading ? (
                <p>Loading arrivals...</p>
            ) : checkins.length === 0 ? (
                <div className="empty-state">
                    <p>No patients are currently in the waiting area.</p>
                </div>
            ) : (
                <div className="checkin-list">
                    <table>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Patient Name</th>
                                <th>Purpose</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {checkins.map((checkin) => (
                                <tr key={checkin.id} className={`checkin-row ${checkin.status === 'Calling' ? 'calling-row' : ''}`}>
                                    <td className="time-cell">{formatTime(checkin.timestamp)}</td>
                                    <td className="name-cell">
                                        <strong>{checkin.name}</strong>
                                        <div style={{ fontSize: '0.7rem', color: '#888' }}>DOB: {checkin.dob}</div>
                                    </td>
                                    <td className="purpose-cell">{checkin.purpose}</td>
                                    <td>
                                        <span className={`status-badge ${checkin.status.toLowerCase()}`}>
                                            {checkin.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-btns">
                                            <button
                                                className="action-btn call-btn"
                                                onClick={() => handleAction(checkin.id, 'Calling')}
                                                disabled={checkin.status === 'Calling'}
                                            >
                                                {checkin.status === 'Calling' ? 'Calling...' : 'Call'}
                                            </button>
                                            <button
                                                className="action-btn seen-btn"
                                                onClick={() => handleAction(checkin.id, 'Seen')}
                                            >
                                                Seen
                                            </button>
                                        </div>
                                    </td>
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
