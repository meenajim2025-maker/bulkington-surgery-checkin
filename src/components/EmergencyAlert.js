import React, { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeToEmergencies, resolveAllEmergencies } from '../db';

function EmergencyAlert() {
    const [alert, setAlert] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [stopping, setStopping] = useState(false);
    const intervalRef = useRef(null);

    const playSiren = useCallback(() => {
        if (isMuted) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o1 = ctx.createOscillator();
            const o2 = ctx.createOscillator();
            const g = ctx.createGain();
            o1.type = 'square'; o2.type = 'sawtooth';
            o1.frequency.setValueAtTime(850, ctx.currentTime);
            o1.frequency.exponentialRampToValueAtTime(950, ctx.currentTime + 0.5);
            o1.frequency.exponentialRampToValueAtTime(850, ctx.currentTime + 1.0);
            o2.frequency.setValueAtTime(440, ctx.currentTime);
            g.gain.setValueAtTime(0, ctx.currentTime);
            g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.1);
            g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);
            o1.connect(g); o2.connect(g); g.connect(ctx.destination);
            o1.start(); o2.start();
            o1.stop(ctx.currentTime + 1.1); o2.stop(ctx.currentTime + 1.1);
        } catch (e) { }
    }, [isMuted]);

    const stopAll = useCallback(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        setAlert(null);
        setIsMuted(false);
    }, []);

    const handleStopBroadcast = async () => {
        try {
            setStopping(true);
            await resolveAllEmergencies();
            stopAll();
        } catch (e) {
            alert("Failed to stop: " + e.message);
        } finally {
            setStopping(false);
        }
    };

    useEffect(() => {
        let sub;
        try {
            sub = subscribeToEmergencies((payload) => {
                // INSERT = new alert
                if (payload.eventType === 'INSERT' && payload.new.is_active) {
                    setAlert(payload.new);
                    playSiren();
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    intervalRef.current = setInterval(playSiren, 2500);
                }
                // UPDATE with is_active=false = STOP signal from staff
                if (payload.eventType === 'UPDATE' && !payload.new.is_active) {
                    stopAll();
                }
            });
        } catch (err) {
            console.warn("Emergency channel unavailable:", err.message);
        }
        return () => {
            if (sub) sub.unsubscribe();
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [playSiren, stopAll]);

    if (!alert) return null;

    return (
        <div className="emergency-takeover">
            <div className="alert-card">
                <div className="alert-badge">🚨 EMERGENCY PROTOCOL</div>
                <div className="alert-type">{(alert.type || 'ALERT').toUpperCase()}</div>
                <div className="alert-message">{alert.message}</div>
                <p className="alert-instruction">FOLLOW ON-SITE STAFF DIRECTIONS IMMEDIATELY</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '2rem' }}>
                    {/* ─── STOP BUTTON (Staff Only) ─── */}
                    <button
                        className="btn"
                        onClick={handleStopBroadcast}
                        disabled={stopping}
                        style={{
                            background: '#fff', color: '#000',
                            fontSize: '1.1rem', fontWeight: 900,
                            border: '3px solid var(--emergency)',
                            width: '100%', padding: '1rem'
                        }}
                    >
                        ■ STOP ALL ALERTS
                    </button>

                    <div className="btn-group" style={{ justifyContent: 'center' }}>
                        <button className="btn btn-secondary" onClick={() => setIsMuted(!isMuted)}>
                            {isMuted ? '🔊 UNMUTE' : '🔇 MUTE SIREN'}
                        </button>
                        <button className="btn btn-secondary" onClick={() => { stopAll(); }}>
                            DISMISS (LOCAL)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EmergencyAlert;
