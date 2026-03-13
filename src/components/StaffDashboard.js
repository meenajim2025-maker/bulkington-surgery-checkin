import React, { useState, useEffect } from 'react';
import { getCheckins, updateCheckinStatus, subscribeToCheckins } from '../db';

function StaffDashboard() {
    const [checkins, setCheckins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastCount, setLastCount] = useState(0);

    const fetchCheckins = async () => {
        try {
            const data = await getCheckins();
            setCheckins(data);
            setLastCount(data.length);
        } catch (err) {
            console.error("Failed to fetch check-ins:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCheckins();

        // Subscribe to real-time updates
        const subscription = subscribeToCheckins((payload) => {
            console.log('Real-time update:', payload);
            fetchCheckins(); // Refresh on any change

            if (payload.eventType === 'INSERT') {
                playNotifySound();
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const playNotifySound = () => {
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
            // Local update for immediate feedback
            setCheckins(prev => prev.map(c => c.id === id ? { ...c, status } : c));
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
                <span className="live-indicator">● LIVE CLOUD MONITORING</span>
            </header>

            {loading ? (
                <p>Connecting to Cloud...</p>
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
