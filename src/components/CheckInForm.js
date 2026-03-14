import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { saveCheckin, getCheckins, checkoutPerson } from '../db';

const SURGERY = { lat: 52.476995, lng: -1.423161 };
const RADIUS = 200;
const VERSION = "3.0.0 — Enterprise + QR + BLE";
const BASE_URL = window.location.origin;

// BLE Service UUID — simulates a CGM-style beacon (Libre/Dexcom model)
const SURGERY_BLE_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3; const p = Math.PI / 180;
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
    const [screen, setScreen] = useState('form'); // form | screening | emergency | checkedIn | qrAdmin
    const [auto, setAuto] = useState(localStorage.getItem('auto_checkin') === 'true');
    const [checkinId, setCheckinId] = useState(null);
    const [bleStatus, setBleStatus] = useState('idle'); // idle | scanning | connected | unavailable

    const params = new URLSearchParams(window.location.search);
    const orgType = params.get('type') || 'Patient';
    const qrAction = params.get('action'); // 'checkin' from QR scan

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
                if (ok && auto && form.name && (form.dob || form.phone_number) && !status.includes('success') && screen === 'form') {
                    doSubmit({ ...form, purpose: form.purpose || 'Auto-Arrival' });
                }
            },
            (e) => setStatus(`Location: ${e.message}`),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
        return () => navigator.geolocation.clearWatch(id);
    }, [auto, form.name, form.dob, form.phone_number, status, screen]);

    // ─── BLE PROXIMITY (Libre/Dexcom Model) ───────────
    const bleRef = useRef(null);

    const scanBLE = async () => {
        if (!navigator.bluetooth) {
            setBleStatus('unavailable');
            setStatus('Bluetooth not available on this device');
            return;
        }
        try {
            setBleStatus('scanning');
            setStatus('Scanning for surgery beacon…');
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [SURGERY_BLE_SERVICE] }],
                optionalServices: [SURGERY_BLE_SERVICE]
            });
            bleRef.current = device;
            setBleStatus('connected');
            setInRange(true);
            setStatus(`✓ Connected to beacon: ${device.name || 'Surgery BLE'}`);
        } catch (e) {
            setBleStatus('idle');
            if (e.name !== 'NotFoundError') {
                setStatus(`BLE: ${e.message}`);
            }
        }
    };

    // ─── SUBMIT ───────────────────────────────────────
    const doSubmit = async (data) => {
        if (!inRange) { setStatus('Move within perimeter or connect via Bluetooth'); return; }
        try {
            setStatus('Registering presence…');
            const result = await saveCheckin(data || form);
            const id = result?.[0]?.id;
            setCheckinId(id);
            setScreen('checkedIn');
            setStatus('✓ Presence recorded successfully');
        } catch (err) {
            setStatus(`Error: ${err.message}`);
        }
    };

    // ─── CHECK OUT ────────────────────────────────────
    const doCheckout = async () => {
        if (!checkinId) { setStatus('No active check-in found'); return; }
        try {
            setStatus('Processing checkout…');
            await checkoutPerson(checkinId);
            setStatus('✓ Checked out successfully');
            setCheckinId(null);
            setScreen('form');
        } catch (err) {
            setStatus(`Checkout error: ${err.message}`);
        }
    };

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm(p => ({ ...p, [name]: value }));
        if (name === 'name') localStorage.setItem('pref_name', value);
        if (name === 'dob') localStorage.setItem('pref_dob', value);
        if (name === 'phone_number') localStorage.setItem('pref_phone', value);
    };

    // ─── QR CODE URL ──────────────────────────────────
    const qrCheckinUrl = `${BASE_URL}/?action=checkin&type=${orgType}`;
    const qrContractorUrl = `${BASE_URL}/?action=checkin&type=Contractor`;
    const qrStaffUrl = `${BASE_URL}/?action=checkin&type=Staff`;

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

    // ─── CHECKED IN CONFIRMATION + QR + CHECKOUT ──────
    if (screen === 'checkedIn') return (
        <main className="container" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
            <h1>CHECKED IN</h1>
            <p className="subtitle">YOUR PRESENCE IS REGISTERED</p>

            {checkinId && (
                <div style={{ margin: '2rem 0', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--glass-border)' }}>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Your Check-in QR Code</p>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem', background: '#fff', borderRadius: '12px', display: 'inline-block' }}>
                        <QRCodeSVG value={`CHECKIN:${checkinId}:${form.name}`} size={160} level="H" />
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>Show this to staff if requested</p>
                </div>
            )}

            {orgType === 'Patient' && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    Est. Wait: <strong style={{ color: 'var(--accent-primary)' }}>{queue * 10}–{(queue + 1) * 15}m</strong>
                </p>
            )}

            <button className="btn btn-danger" style={{ width: '100%' }} onClick={doCheckout}>
                CHECK OUT — LEAVING BUILDING
            </button>

            <div className="nav-strip">
                <a href="/" className="nav-link" onClick={() => { setScreen('form'); setStatus(''); }}>NEW CHECK-IN</a>
            </div>

            {status && <div className="status-message">{status}</div>}
        </main>
    );

    // ─── QR ADMIN (Staff generates QR posters) ────────
    if (screen === 'qrAdmin') return (
        <main className="container" style={{ textAlign: 'center' }}>
            <h1>QR CODES</h1>
            <p className="subtitle">PRINT & DISPLAY AT ENTRY POINTS</p>

            <div style={{ display: 'grid', gap: '2rem', marginTop: '2rem' }}>
                {[
                    { label: 'PATIENT CHECK-IN', url: qrCheckinUrl, color: 'var(--accent-primary)' },
                    { label: 'CONTRACTOR', url: qrContractorUrl, color: 'var(--accent-warning)' },
                    { label: 'STAFF', url: qrStaffUrl, color: 'var(--accent-secondary)' }
                ].map(({ label, url, color }) => (
                    <div key={label} style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--glass-border)' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: 800, color, letterSpacing: '0.1em', marginBottom: '1rem' }}>{label}</p>
                        <div style={{ display: 'inline-block', background: '#fff', padding: '1rem', borderRadius: '12px' }}>
                            <QRCodeSVG value={url} size={180} level="H" />
                        </div>
                        <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '0.75rem', wordBreak: 'break-all' }}>{url}</p>
                    </div>
                ))}
            </div>

            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '2rem' }} onClick={() => window.print()}>PRINT QR CODES</button>
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => setScreen('form')}>← BACK</button>
        </main>
    );

    // ─── MAIN FORM ────────────────────────────────────
    return (
        <main className="container">
            <h1>BULKINGTON</h1>
            <p className="subtitle">Enterprise Presence System</p>

            {/* ─── CONNECTIVITY PANEL ────────────────── */}
            <div className="location-panel">
                {/* GPS Status */}
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
                    </>
                ) : (
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Acquiring GPS…</p>
                )}

                {/* ─── BLE PROXIMITY (Libre/Dexcom Style) ─── */}
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)', marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                        📡 Bluetooth Proximity (Libre/Dexcom Model)
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            background: bleStatus === 'connected' ? 'var(--accent-primary)' :
                                bleStatus === 'scanning' ? 'var(--accent-warning)' :
                                    bleStatus === 'unavailable' ? 'var(--emergency)' : 'var(--text-secondary)',
                            boxShadow: bleStatus === 'connected' ? '0 0 8px var(--accent-primary)' : 'none'
                        }} />
                        <span style={{ fontSize: '0.75rem', flex: 1 }}>
                            {bleStatus === 'connected' ? 'Connected to surgery beacon' :
                                bleStatus === 'scanning' ? 'Scanning for beacons…' :
                                    bleStatus === 'unavailable' ? 'Bluetooth unavailable' :
                                        'Tap to scan for surgery beacon'}
                        </span>
                        {bleStatus !== 'connected' && bleStatus !== 'unavailable' && (
                            <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.65rem' }} onClick={scanBLE}>
                                {bleStatus === 'scanning' ? 'SCANNING…' : 'SCAN BLE'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="btn-group" style={{ justifyContent: 'center' }}>
                    <button className="btn btn-secondary" onClick={() => setDiag(!diag)}>{diag ? 'HIDE' : 'DIAGNOSTICS'}</button>
                    <button className="btn btn-secondary" onClick={() => window.location.reload(true)}>REFRESH</button>
                    <button className="btn btn-secondary" onClick={() => setScreen('qrAdmin')}>QR CODES</button>
                </div>

                {diag && (
                    <div className="diagnostics">
                        <p>LAT: {loc?.lat.toFixed(6)} | LNG: {loc?.lng.toFixed(6)}</p>
                        <p>DIST: {dist?.toFixed(1)}m | ACC: ±{acc?.toFixed(0)}m</p>
                        <p>BLE: {bleStatus.toUpperCase()} | BUILD: {VERSION}</p>
                    </div>
                )}

                <div className="toggle-row">
                    <input type="checkbox" id="auto" checked={auto} onChange={(e) => { setAuto(e.target.checked); localStorage.setItem('auto_checkin', e.target.checked); }} />
                    <label htmlFor="auto">Auto-register on arrival (GPS/BLE)</label>
                </div>
            </div>

            {/* ─── CHECK-IN FORM ──────────────────────── */}
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
                    {inRange ? `CHECK IN ${(orgType || 'PATIENT').toUpperCase()}` : 'APPROACH SURGERY OR CONNECT VIA BLE'}
                </button>
            </form>

            {status && <div className="status-message">{status}</div>}
        </main>
    );
}
