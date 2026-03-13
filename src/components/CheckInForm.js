import React, { useState, useEffect } from 'react';
import { saveCheckin, getCheckins } from '../db';

const SURGERY_COORDS = { lat: 52.476995, lng: -1.423161 };
const CHECKIN_RADIUS_METERS = 200;
const BUILD_VERSION = "1.0.4 - Phase 3 Admin/Auto";

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

function CheckInForm() {
    const [location, setLocation] = useState(null);
    const [distance, setDistance] = useState(null);
    const [accuracy, setAccuracy] = useState(null);
    const [canCheckIn, setCanCheckIn] = useState(false);
    const [formData, setFormData] = useState({
        name: localStorage.getItem('pref_name') || '',
        dob: localStorage.getItem('pref_dob') || '',
        purpose: ''
    });
    const [status, setStatus] = useState('');
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const [redFlagState, setRedFlagState] = useState('none'); // none, screening, emergency
    const [autoCheckin, setAutoCheckin] = useState(localStorage.getItem('auto_checkin') === 'true');
    const [queueCount, setQueueCount] = useState(0);

    useEffect(() => {
        const fetchQueue = async () => {
            const all = await getCheckins();
            const waiting = all.filter(c => c.status === 'Waiting' || c.status === 'Calling').length;
            setQueueCount(waiting);
        };
        fetchQueue();
    }, []);

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

                const inRange = d <= CHECKIN_RADIUS_METERS;
                setCanCheckIn(inRange);

                // Auto Check-in logic
                if (inRange && autoCheckin && formData.name && formData.dob && !status.includes('successful')) {
                    handleAutoSubmit();
                }
            },
            (error) => {
                setStatus(`Error getting location: ${error.message}`);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [autoCheckin, formData, status]);

    const handleAutoSubmit = async () => {
        try {
            await saveCheckin({ ...formData, purpose: 'Auto-Arrival' });
            setStatus('Auto Check-in successful!');
        } catch (err) {
            console.error("Auto check-in failed", err);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Save preferences
        if (name === 'name') localStorage.setItem('pref_name', value);
        if (name === 'dob') localStorage.setItem('pref_dob', value);
    };

    const toggleAutoCheckin = (e) => {
        const val = e.target.checked;
        setAutoCheckin(val);
        localStorage.setItem('auto_checkin', val);
    };

    const handleRefresh = () => {
        window.location.reload(true);
    };

    const startCheckIn = () => {
        setRedFlagState('screening');
    };

    const handleRedFlagResponse = (hasEmergency) => {
        if (hasEmergency) {
            setRedFlagState('emergency');
        } else {
            setRedFlagState('none');
        }
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
            setFormData(prev => ({ ...prev, purpose: '' }));
        } catch (err) {
            setStatus(`Failed to check in: ${err.message}`);
        }
    };

    if (redFlagState === 'emergency') {
        return (
            <main className="red-flag-alert">
                <h3>⚠️ MEDICAL EMERGENCY</h3>
                <p>Based on your symptoms, please <strong>DO NOT</strong> continue with this check-in.</p>
                <p><strong>Go directly to reception now</strong> or dial <strong>999</strong> if you are in severe distress.</p>
                <button className="emergency-btn" onClick={() => setRedFlagState('none')}>I am OK, go back</button>
            </main>
        );
    }

    if (redFlagState === 'screening') {
        return (
            <main className="red-flag-alert">
                <h3>Safety Screening</h3>
                <p>Do you have any of the following?</p>
                <ul style={{ textAlign: 'left', display: 'inline-block' }}>
                    <li>Sudden chest pain</li>
                    <li>Severe difficulty breathing</li>
                    <li>Heavy, uncontrollable bleeding</li>
                    <li>Symptoms of a stroke (FACE/ARMS/SPEECH)</li>
                </ul>
                <div className="button-group" style={{ marginTop: '1.5rem' }}>
                    <button className="seen-btn action-btn" onClick={() => handleRedFlagResponse(true)}>YES - I have these</button>
                    <button className="secondary-btn" onClick={() => handleRedFlagResponse(false)}>NO - Continue</button>
                </div>
            </main>
        );
    }

    return (
        <main>
            <section className="location-info">
                {distance !== null ? (
                    <>
                        <div className="wait-time">
                            Estimated Wait: <strong>{queueCount * 10}-{(queueCount + 1) * 15} mins</strong>
                            <br />({queueCount} patients currently waiting)
                        </div>
                        <p className={canCheckIn ? 'within-range' : 'out-of-range'}>
                            Distance: {distance.toFixed(0)}m
                            {canCheckIn ? ' (In range)' : ' (Too far)'}
                        </p>
                        <div className="button-group">
                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => setShowDiagnostics(!showDiagnostics)}
                            >
                                {showDiagnostics ? 'Hide Info' : 'Show Info'}
                            </button>
                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={handleRefresh}
                            >
                                Force Refresh
                            </button>
                        </div>
                        {showDiagnostics && (
                            <div className="diagnostics">
                                <p>Your Lat: {location?.lat.toFixed(6)}</p>
                                <p>Your Lng: {location?.lng.toFixed(6)}</p>
                                <p>Target Lat: {SURGERY_COORDS.lat.toFixed(6)}</p>
                                <p>Target Lng: {SURGERY_COORDS.lng.toFixed(6)}</p>
                                <p>GPS Accuracy: {accuracy?.toFixed(0)}m</p>
                                <p className="version-info">Build: {BUILD_VERSION}</p>
                            </div>
                        )}
                        <div className="auto-checkin-opt">
                            <input
                                type="checkbox"
                                id="autoCheckin"
                                checked={autoCheckin}
                                onChange={toggleAutoCheckin}
                            />
                            <label htmlFor="autoCheckin">Enable Automatic Check-in on Arrival</label>
                        </div>
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
                        placeholder="Required for Auto Check-in"
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
                        placeholder="Doctor/Nurse name if known"
                        value={formData.purpose}
                        onChange={handleInputChange}
                        required
                    />
                </div>
                <button type="button" onClick={startCheckIn} disabled={!canCheckIn || status.includes('successful')}>
                    {canCheckIn ? 'Check In' : 'Arrive at Surgery to Check In'}
                </button>
                {/* Real submit is triggered after screening */}
                {redFlagState === 'screening' && <button type="submit" id="hidden-submit" style={{ display: 'none' }}></button>}
            </form>

            <button
                type="button"
                onClick={handleSubmit}
                style={{ display: redFlagState === 'none' && canCheckIn && !status.includes('suc') ? 'none' : 'none' }}
            >
                Submit
            </button>

            {status && <p className="status-message">{status}</p>}
        </main>
    );
}

export default CheckInForm;
