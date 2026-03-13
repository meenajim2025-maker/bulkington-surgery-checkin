import React, { useState, useEffect } from 'react';
import { saveCheckin } from './db';
import './index.css';

const SURGERY_COORDS = { lat: 52.47706623357887, lng: -1.4231060516278988 };
const CHECKIN_RADIUS_METERS = 200;

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function App() {
    const [location, setLocation] = useState(null);
    const [distance, setDistance] = useState(null);
    const [accuracy, setAccuracy] = useState(null);
    const [canCheckIn, setCanCheckIn] = useState(false);
    const [formData, setFormData] = useState({ name: '', dob: '', purpose: '' });
    const [status, setStatus] = useState('');
    const [showDiagnostics, setShowDiagnostics] = useState(false);

    useEffect(() => {
        if (!navigator.geolocation) {
            setStatus('Geolocation is not supported by your browser');
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                setLocation({ lat: latitude, lng: longitude });
                setAccuracy(accuracy);
                const d = calculateDistance(latitude, longitude, SURGERY_COORDS.lat, SURGERY_COORDS.lng);
                setDistance(d);
                setCanCheckIn(d <= CHECKIN_RADIUS_METERS);
            },
            (error) => {
                setStatus(`Error getting location: ${error.message}`);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canCheckIn) {
            setStatus('You are too far from the surgery to check in.');
            return;
        }

        try {
            await saveCheckin(formData);
            setStatus('Check-in successful!');
            setFormData({ name: '', dob: '', purpose: '' });
        } catch (err) {
            setStatus(`Failed to check in: ${err.message}`);
        }
    };

    return (
        <div className="container">
            <header>
                <h1>Bulkington Surgery Check-in</h1>
            </header>

            <main>
                <section className="location-info">
                    {distance !== null ? (
                        <>
                            <p className={canCheckIn ? 'within-range' : 'out-of-range'}>
                                Distance: {distance.toFixed(0)}m
                                {canCheckIn ? ' (In range)' : ' (Too far)'}
                            </p>
                            <button
                                type="button"
                                className="diag-btn"
                                onClick={() => setShowDiagnostics(!showDiagnostics)}
                            >
                                {showDiagnostics ? 'Hide Diagnostics' : 'Show Diagnostics'}
                            </button>
                            {showDiagnostics && (
                                <div className="diagnostics">
                                    <p>Lat: {location?.lat.toFixed(6)}</p>
                                    <p>Lng: {location?.lng.toFixed(6)}</p>
                                    <p>Accuracy: {accuracy?.toFixed(0)}m</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <p>Locating...</p>
                    )}
                </section>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="name">Full Name</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="dob">Date of Birth</label>
                        <input
                            type="date"
                            id="dob"
                            name="dob"
                            value={formData.dob}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="purpose">Purpose of Visit</label>
                        <textarea
                            id="purpose"
                            name="purpose"
                            value={formData.purpose}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <button type="submit" disabled={!canCheckIn}>
                        {canCheckIn ? 'Check In' : 'Arrive at Surgery to Check In'}
                    </button>
                </form>

                {status && <p className="status-message">{status}</p>}
            </main>
        </div>
    );
}

export default App;
