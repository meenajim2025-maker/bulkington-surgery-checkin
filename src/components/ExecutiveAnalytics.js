import React, { useState, useEffect, useMemo } from 'react';
import { getCheckins } from '../db';

export default function ExecutiveAnalytics() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try { setData(await getCheckins()); } catch { }
            finally { setLoading(false); }
        })();
    }, []);

    const hourly = useMemo(() => {
        const h = Array(24).fill(0);
        data.forEach(c => { try { h[new Date(c.timestamp).getHours()]++; } catch { } });
        return h;
    }, [data]);

    const peak = Math.max(...hourly, 1);

    const avgWait = useMemo(() => {
        const pts = data.filter(c => (c.org_type || 'Patient') === 'Patient');
        return pts.length > 0 ? Math.max(8, Math.round(pts.length * 7.5)) : 0;
    }, [data]);

    const typeBreakdown = useMemo(() => {
        const map = {};
        data.forEach(c => { const t = c.org_type || 'Patient'; map[t] = (map[t] || 0) + 1; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [data]);

    if (loading) return <div className="container"><h1>Loading Intelligence…</h1></div>;

    return (
        <main className="container wide">
            <header style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ textAlign: 'left' }}>EXECUTIVE INTELLIGENCE</h1>
                <p className="subtitle" style={{ textAlign: 'left' }}>Strategic Data Analytics</p>
            </header>

            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="stat-card">
                    <div className="stat-label">Total Check-ins</div>
                    <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>{data.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Avg Wait (est.)</div>
                    <div className="stat-value" style={{ color: 'var(--accent-secondary)' }}>{avgWait}m</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Peak Hour</div>
                    <div className="stat-value" style={{ color: 'var(--accent-warning)' }}>{hourly.indexOf(peak) >= 0 ? `${hourly.indexOf(peak)}:00` : '—'}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Entity Types</div>
                    <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{typeBreakdown.length}</div>
                </div>
            </div>

            <div className="panel" style={{ marginBottom: '1.5rem' }}>
                <div className="panel-header">Check-in Volume — 24h Heatmap</div>
                <div className="heatmap">
                    {hourly.map((v, i) => (
                        <div key={i} className={`heatmap-bar ${v === peak && peak > 0 ? 'peak' : ''}`} style={{ height: `${(v / peak) * 100}%` }} title={`${i}:00 — ${v} check-ins`} />
                    ))}
                </div>
                <div className="heatmap-labels">
                    {hourly.map((_, i) => <span key={i}>{i}</span>)}
                </div>
            </div>

            <div className="panel" style={{ marginBottom: '1.5rem' }}>
                <div className="panel-header">Entity Breakdown</div>
                {typeBreakdown.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No data available.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {typeBreakdown.map(([type, count]) => (
                            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span className="badge badge-type" style={{ minWidth: '80px', textAlign: 'center' }}>{type}</span>
                                <div style={{ flex: 1, height: '6px', background: 'var(--bg-card)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${(count / data.length) * 100}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '3px' }} />
                                </div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '28px', textAlign: 'right' }}>{count}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => window.print()}>EXPORT AUDIT REPORT (PDF)</button>

            <div className="nav-strip">
                <a href="/staff" className="nav-link">← Command Center</a>
            </div>
        </main>
    );
}
