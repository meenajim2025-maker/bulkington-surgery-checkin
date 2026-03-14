import React, { useState, useEffect, useMemo } from 'react';
import { getCheckins, updateCheckinStatus, subscribeToCheckins, triggerEmergency } from '../db';

export default function StaffDashboard() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    const [panicBusy, setPanicBusy] = useState(false);

    const load = async () => {
        try { setData(await getCheckins()); } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        load();
        const sub = subscribeToCheckins(() => { load(); notify(); });
        return () => sub.unsubscribe();
    }, []);

    const notify = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'sine'; o.frequency.value = 880;
            g.gain.setValueAtTime(0.04, ctx.currentTime);
            o.start(); o.stop(ctx.currentTime + 0.12);
        } catch { }
    };

    const act = async (id, s) => {
        try { await updateCheckinStatus(id, s); setData(p => p.map(c => c.id === id ? { ...c, status: s } : c)); }
        catch (e) { alert("Error: " + e.message); }
    };

    const panic = async () => {
        const msg = prompt("EMERGENCY BROADCAST MESSAGE:");
        if (!msg) return;
        try { setPanicBusy(true); await triggerEmergency('CRITICAL', msg); alert("BROADCAST SENT"); }
        catch (e) { alert("Failed: " + e.message); }
        finally { setPanicBusy(false); }
    };

    const rows = useMemo(() => {
        const f = filter === 'All' ? data : data.filter(c => (c.org_type || 'Patient') === filter);
        return [...f].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [data, filter]);

    const stats = useMemo(() => ({
        total: data.length,
        patients: data.filter(c => (c.org_type || 'Patient') === 'Patient').length,
        others: data.filter(c => (c.org_type || 'Patient') !== 'Patient').length
    }), [data]);

    const badgeClass = (s) => {
        if (s === 'Calling') return 'badge badge-calling';
        if (s === 'Seen') return 'badge badge-seen';
        return 'badge badge-waiting';
    };

    return (
        <main className="container wide">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ textAlign: 'left', margin: 0, fontSize: '1.5rem' }}>COMMAND CENTER</h1>
                    <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>Enterprise Presence Monitor</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button className="btn btn-danger" onClick={panic} disabled={panicBusy} style={{ fontSize: '0.7rem' }}>
                        🚨 SYSTEM PANIC
                    </button>
                    <span className="live-badge">LIVE STREAM</span>
                </div>
            </header>

            <div className="stat-grid">
                <div className="stat-card">
                    <div className="stat-label">In Building</div>
                    <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>{stats.total}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Patients</div>
                    <div className="stat-value" style={{ color: 'var(--accent-secondary)' }}>{stats.patients}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Contractors</div>
                    <div className="stat-value" style={{ color: 'var(--accent-warning)' }}>{stats.others}</div>
                </div>
            </div>

            <div className="filter-bar">
                {['All', 'Patient', 'Contractor', 'Maintenance', 'Staff'].map(t => (
                    <button key={t} className={`filter-tab ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>{t}</button>
                ))}
            </div>

            {loading ? (
                <div className="empty-state"><p>Connecting…</p></div>
            ) : rows.length === 0 ? (
                <div className="empty-state"><p>No active presence in this sector.</p></div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead><tr>
                            <th>Time</th><th>Identity</th><th>Type</th><th>Purpose</th><th>Status</th><th>Actions</th>
                        </tr></thead>
                        <tbody>
                            {rows.map(c => (
                                <tr key={c.id} className={c.status === 'Calling' ? 'highlight' : ''}>
                                    <td style={{ color: 'var(--text-secondary)' }}>{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                    <td>
                                        <strong>{c.name}</strong>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{c.phone_number || (c.dob ? `DOB: ${c.dob}` : '')}</div>
                                    </td>
                                    <td><span className="badge badge-type">{(c.org_type || 'Patient').toUpperCase()}</span></td>
                                    <td>{c.purpose}</td>
                                    <td><span className={badgeClass(c.status)}>{(c.status || 'Waiting').toUpperCase()}</span></td>
                                    <td>
                                        <div className="btn-group">
                                            <button className="btn btn-secondary" style={{ padding: '4px 10px' }} onClick={() => act(c.id, 'Calling')} disabled={c.status === 'Calling'}>CALL</button>
                                            <button className="btn btn-secondary" style={{ padding: '4px 10px', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }} onClick={() => act(c.id, 'Seen')}>DONE</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="nav-strip">
                <a href="/analytics" className="nav-link">Executive Analytics →</a>
            </div>
        </main>
    );
}
