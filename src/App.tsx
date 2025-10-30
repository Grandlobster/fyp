import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import './App.css';

interface Session {
  isLoggedIn: boolean;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
  loginTime: number;
  expiresAt: number;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedSession = localStorage.getItem('qkd_session');
    if (savedSession) {
      const sessionData = JSON.parse(savedSession);
      if (Date.now() < sessionData.expiresAt) {
        setSession(sessionData);
      } else {
        localStorage.removeItem('qkd_session');
      }
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (loginData: Omit<Session, 'isLoggedIn' | 'loginTime' | 'expiresAt'>) => {
    const sessionData: Session = {
      ...loginData,
      isLoggedIn: true,
      loginTime: Date.now(),
      expiresAt: Date.now() + 3600000 // 1 hour
    };
    
    localStorage.setItem('qkd_session', JSON.stringify(sessionData));
    setSession(sessionData);
    
    // Log access
    const logs = JSON.parse(localStorage.getItem('qkd_access_logs') || '[]');
    logs.push({
      timestamp: new Date().toISOString(),
      action: 'LOGIN',
      doctorId: sessionData.doctorId,
      status: 'SUCCESS'
    });
    localStorage.setItem('qkd_access_logs', JSON.stringify(logs));
  };

  const handleLogout = () => {
    if (session) {
      // Log access
      const logs = JSON.parse(localStorage.getItem('qkd_access_logs') || '[]');
      logs.push({
        timestamp: new Date().toISOString(),
        action: 'LOGOUT',
        doctorId: session.doctorId,
        status: 'SUCCESS'
      });
      localStorage.setItem('qkd_access_logs', JSON.stringify(logs));
    }
    
    localStorage.removeItem('qkd_session');
    localStorage.removeItem('qkd_patient');
    setSession(null);
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading ABDM QKD Portal...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {session ? (
        <Dashboard session={session} onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;