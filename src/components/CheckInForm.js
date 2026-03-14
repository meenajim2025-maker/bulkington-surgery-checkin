import React, { useState, useEffect } from 'react';
import { saveCheckin, getCheckins } from '../db';

const SURGERY = { lat: 52.476995, lng: -1.423161 };
const RADIUS = 200;
const VERSION = "2.1.0 — Enterprise";

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * p / 2) ** 2 +
        Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin((lon2 - lon1) * p / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CheckInForm() {
    const [loc, setLoc] = useState(null);
    const [dist, setDist] = useState(null);
    const [acc, setAcc] = useState(null);
    const [inRange, setInRange] = useState(false);
    const [diag, setDiag] = useState(false);
    const [status, setStatus] = useState('');
    const [queue, setQueue] = useState(0);
    const [screen, setScreen] = useState('form'); // form | screening | emergency
    const [auto, setAuto] = useState(localStorage.getItem('auto_checkin') === 'true');

    const params = new URLSearchParams(window.location.search);
    const orgType = params.get('type') || 'Patient';

    const [form, setForm] = useState({
        name: localStorage.getItem('pref_name') || '',
        dob: orgType === 'Patient' ? (localStorage.getItem('pref_dob') || '') : '',
        phone_number: localStorage.getItem('pref_phone') || '',
        purpose: params.get('purpose') || '',
        org_type: orgType
    });

    // Queue polling
    useEffect(() => {
        const f = async () => { try { setQueue((await getCheckins()).length); } catch { } };
        f(); const i = setInterval(f, 15000); return () => clearInterval(i);
    }, []);

    // Geolocation
    useEffect(() => {
        if (!navigator.geolocation) { setStatus('Geolocation not supported'); return; }
        const id = navigator.geolocation.watchPosition(
            ({ coords }) => {
                setLoc({ lat: coords.latitude, lng: coords.longitude });
                setAcc(coords.accuracy);
                const d = haversine(coords.latitude, coords.longitude, SURGERY.lat, SURGERY.lng);
                setDist(d);
                const ok = d <= RADIUS;
                setInRange(ok);
                if (ok && auto && form.name && (form.dob || form.phone_number) && !status.includes('success')) {
                    doSubmit({ ...form, purpose: form.purpose || 'Auto-Arrival' });
                }
            },
            (e) => setStatus(`Location: ${e.message}`),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
        return () => navigator.geolocation.clearWatch(id);
    }, [auto, form.name, form.dob, form.phone_number, status]);

    const doSubmit = async (data) => {
        if (!inRange) { setStatus('Move within surgery perimeter'); return; }
        try {
            setStatus('Registering presence…');
            await saveCheckin(data || form);
            setStatus('✓ Presence recorded successfully');
        } catch (err) {
            setStatus(`Error: ${err.message}`);
        }
    };

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm(p => ({ ...p, [name]: value }));
        if (name === 'name') localStorage.setItem('pref_name', value);
        if (name === 'dob') localStorage.setItem('pref_dob', value);
        if (name === 'phone_number') localStorage.setItem('pref_phone', value);
    };

    // ─── EMERGENCY SCREEN ─────────────────────────────
    if (screen === 'emergency') return (
        <main className="container red-flag-alert">
            <h1>⚠️ CRITICAL EMERGENCY</h1>
            <p style={{ marginBottom: '1rem' }}>High-risk symptoms detected.</p>
            <p><strong>REPORT TO RECEPTION NOW</strong> or dial <strong>999</strong></p>
            <button className="btn btn-danger" style={{ width: '100%', marginTop: '2rem' }} onClick={() => setScreen('form')}>RETURN</button>
        </main>
    );

    // ─── SAFETY SCREENING ─────────────────────────────
    if (screen === 'screening') return (
        <main className="container">
            <h1 style={{ color: 'var(--emergency)' }}>Safety Screening</h1>
            <p className="subtitle" style={{ marginBottom: '1.5rem' }}>ARE YOU EXPERIENCING ANY OF THE FOLLOWING?</p>
            <ul className="red-flag-list">
                <li>Acute chest pressure or pain</li>
                <li>Extreme difficulty breathing</li>
                <li>Major uncontrollable bleeding</li>
                <li>Sudden neurological weakness (Stroke)</li>
            </ul>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => setScreen('emergency')}>YES — I NEED URGENT CARE</button>
                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => { setScreen('form'); doSubmit(); }}>NO — CONTINUE CHECK-IN</button>
            </div>
        </main>
    );

    // ─── MAIN FORM ────────────────────────────────────
    return (
        <main className="container">
            <h1>BULKINGTON</h1>
            <p className="subtitle">Enterprise Presence System</p>

            <div className="location-panel">
                {dist !== null ? (
                    <>
                        <div className={`perimeter-status ${inRange ? 'perimeter-in' : 'perimeter-out'}`}>
                            {inRange ? '✓ WITHIN SECURE PERIMETER' : `✗ ${Math.round(dist)}m FROM PERIMETER`}
                        </div>

                        {orgType === 'Patient' && (
                            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                Est. Wait: <strong style={{ color: 'var(--accent-primary)' }}>{queue * 10}–{(queue + 1) * 15}m</strong>
                                {' '}({queue} waiting)
                            </p>
                        )}

                        <div className="btn-group" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setDiag(!diag)}>{diag ? 'HIDE' : 'DIAGNOSTICS'}</button>
                            <button className="btn btn-secondary" onClick={() => window.location.reload(true)}>REFRESH</button>
                        </div>

                        {diag && (
                            <div className="diagnostics">
                                <p>LAT: {loc?.lat.toFixed(6)} | LNG: {loc?.lng.toFixed(6)}</p>
                                <p>DIST: {dist.toFixed(1)}m | ACC: ±{acc?.toFixed(0)}m</p>
                                <p>BUILD: {VERSION}</p>
                            </div>
                        )}

                        <div className="toggle-row">
                            <input type="checkbox" id="auto" checked={auto} onChange={(e) => { setAuto(e.target.checked); localStorage.setItem('auto_checkin', e.target.checked); }} />
                            <label htmlFor="auto">Auto-register on arrival</label>
                        </div>
                    </>
                ) : (
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Acquiring location…</p>
                )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); orgType === 'Patient' ? setScreen('screening') : doSubmit(); }}>
                <div className="input-group">
                    <label>Full name</label>
                    <input type="text" name="name" value={form.name} onChange={onChange} placeholder="As registered" required />
                </div>

                {orgType === 'Patient' ? (
                    <div className="input-group">
                        <label>Date of birth</label>
                        <input type="date" name="dob" value={form.dob} onChange={onChange} required />
                    </div>
                ) : (
                    <div className="input-group">
                        <label>Contact phone (safety req.)</label>
                        <input type="tel" name="phone_number" value={form.phone_number} onChange={onChange} placeholder="+44…" required />
                    </div>
                )}

                <div className="input-group">
                    <label>{orgType === 'Patient' ? 'Purpose of visit' : 'Organisation / reference'}</label>
                    <textarea name="purpose" value={form.purpose} onChange={onChange} placeholder={orgType === 'Patient' ? 'Doctor or nurse name if known' : 'Contract ref or company name'} required />
                </div>

                <button type="submit" disabled={!inRange || status.includes('success')}>
                    {inRange ? `REGISTER ${(orgType || 'PATIENT').toUpperCase()}` : 'APPROACH SURGERY TO REGISTER'}
                </button>
            </form>

            {status && <div className="status-message">{status}</div>}
        </main>
    );
}
