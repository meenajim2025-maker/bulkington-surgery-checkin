import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import CheckInForm from './components/CheckInForm';
import StaffDashboard from './components/StaffDashboard';
import './index.css';

function App() {
    return (
        <Router>
            <div className="container">
                <header>
                    <h1>Bulkington Surgery</h1>
                </header>

                <Switch>
                    <Route exact path="/" component={CheckInForm} />
                    <Route path="/staff" component={StaffDashboard} />
                </Switch>
            </div>
        </Router>
    );
}

export default App;
