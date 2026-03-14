import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import CheckInForm from './components/CheckInForm';
import StaffDashboard from './components/StaffDashboard';
import ExecutiveAnalytics from './components/ExecutiveAnalytics';
import EmergencyAlert from './components/EmergencyAlert';
import './index.css';

function SecureRoute({ component: Component, path }) {
    const [auth, setAuth] = useState(localStorage.getItem('staff_auth') === 'true');
    const [pin, setPin] = useState('');
    const [shake, setShake] = useState(false);

    const tryAuth = (e) => {
        e.preventDefault();
        if (pin === '0000') {
            setAuth(true);
            localStorage.setItem('staff_auth', 'true');
        } else {
            setShake(true);
            setTimeout(() => setShake(false), 500);
            setPin('');
        }
    };

    if (!auth) {
        return (
            <Route path={path}>
                <div className="container" style={{ textAlign: 'center', maxWidth: '400px' }}>
                    <h1 style={{ letterSpacing: '6px', fontSize: '1.3rem' }}>SECURE ACCESS</h1>
                    <p className="subtitle">Restricted Dataset</p>
                    <form onSubmit={tryAuth}>
                        <div className="input-group">
                            <label>Staff PIN</label>
                            <input
                                type="password"
                                className="pin-input"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                maxLength={4}
                                autoFocus
                                placeholder="••••"
                                style={shake ? { animation: 'shake 0.4s ease-in-out', borderColor: 'var(--emergency)' } : {}}
                            />
                        </div>
                        <button type="submit">AUTHORIZE</button>
                    </form>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '2rem', opacity: 0.5 }}>Default: 0000</p>
                </div>
            </Route>
        );
    }

    return <Route path={path} component={Component} />;
}

export default function App() {
    return (
        <Router>
            <EmergencyAlert />
            <Switch>
                <Route exact path="/" component={CheckInForm} />
                <SecureRoute path="/staff" component={StaffDashboard} />
                <SecureRoute path="/analytics" component={ExecutiveAnalytics} />
            </Switch>
        </Router>
    );
}
