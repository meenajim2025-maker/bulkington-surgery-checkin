import React, { useState, useEffect, useCallback } from 'react';
import { subscribeToEmergencies } from '../db';

function EmergencyAlert() {
    const [alert, setAlert] = useState(null);
    const [isMuted, setIsMuted] = useState(false);

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
        } catch (e) { /* AudioContext not available */ }
    }, [isMuted]);

    useEffect(() => {
        let sub, sirenInterval;
        try {
            sub = subscribeToEmergencies((newAlert) => {
                setAlert(newAlert);
                playSiren();
                sirenInterval = setInterval(playSiren, 2500);
            });
        } catch (err) {
            console.warn("Emergency channel unavailable:", err.message);
        }
        return () => {
            if (sub) sub.unsubscribe();
            if (sirenInterval) clearInterval(sirenInterval);
        };
    }, [playSiren]);

    if (!alert) return null;

    return (
        <div className="emergency-takeover">
            <div className="alert-card">
                <div className="alert-badge">🚨 NATIONAL EMERGENCY PROTOCOL</div>
                <div className="alert-type">{(alert.type || 'ALERT').toUpperCase()}</div>
                <div className="alert-message">{alert.message}</div>
                <p className="alert-instruction">IMMEDIATE ACTION REQUIRED — FOLLOW ON-SITE DIRECTIONS</p>
                <div className="btn-group" style={{ justifyContent: 'center', marginTop: '2rem' }}>
                    <button className="btn btn-secondary" onClick={() => setIsMuted(!isMuted)}>
                        {isMuted ? 'UNMUTE' : 'MUTE SIREN'}
                    </button>
                    <button className="btn btn-danger" onClick={() => setAlert(null)}>ACKNOWLEDGE</button>
                </div>
            </div>
        </div>
    );
}

export default EmergencyAlert;
