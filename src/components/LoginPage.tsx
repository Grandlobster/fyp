import React, { useState } from 'react';
import './LoginPage.css';

interface LoginPageProps {
  onLogin: (loginData: {
    doctorId: string;
    doctorName: string;
    hospitalId: string;
    hospitalName: string;
  }) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (username === 'superkk' && password === 'superkk') {
      onLogin({
        doctorId: 'doc1001',
        doctorName: 'Dr. Kamble',
        hospitalId: 'hosp_a',
        hospitalName: 'Ruby Hall Clinic'
      });
    } else {
      setError('Invalid credentials. Please check your username and password.');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-header">
        <div className="gov-logo">
          <div className="logo-placeholder">[GOV LOGO]</div>
        </div>
        <div className="portal-title">
          <h1>ABDM QKD Medical Records Portal</h1>
          <p>Ministry of Health & Family Welfare, Government of India</p>
        </div>
      </div>

      <div className="login-container">
        <div className="login-card card fade-in">
          <div className="login-form-header">
            <h2>Secure Login</h2>
            <p>Access to authorized healthcare professionals only</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username" className="form-label">
                Username
              </label>
              <input
                type="text"
                id="username"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                type="password"
                id="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary login-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="spinner-small"></div>
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="security-notice">
            <div className="security-icon">🔒</div>
            <div>
              <p><strong>Security Notice:</strong></p>
              <p>This portal uses Quantum Key Distribution (QKD) for secure data transmission. All access is logged and monitored.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="login-footer">
        <p>Secured with Quantum Key Distribution Protocol (BB84)</p>
        <p>National Health Authority | Ministry of Health & Family Welfare</p>
        <p>Government of India | © 2025 All Rights Reserved</p>
      </div>
    </div>
  );
};

export default LoginPage;