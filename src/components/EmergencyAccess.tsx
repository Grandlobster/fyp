import React, { useState } from 'react';

interface Patient {
  abhaId: string;
  name: string;
  email: string;
  phone: string;
  verified: boolean;
  nominee: {
    name: string;
    phone: string;
    relation: string;
  };
}

interface EmergencyAccessProps {
  patient: Patient;
  onComplete: () => void;
  onCancel: () => void;
}

const EmergencyAccess: React.FC<EmergencyAccessProps> = ({ patient, onComplete, onCancel }) => {
  const [showGmailLogin, setShowGmailLogin] = useState(true);
  const [gmailEmail, setGmailEmail] = useState('');
  const [gmailPassword, setGmailPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!gmailEmail || !gmailPassword) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Accept any Gmail credentials for demo
    if (gmailEmail.includes('@gmail.com')) {
      // Log emergency access
      const logs = JSON.parse(localStorage.getItem('qkd_access_logs') || '[]');
      logs.push({
        timestamp: new Date().toISOString(),
        action: 'EMERGENCY_ACCESS',
        patientId: patient.abhaId,
        guardianEmail: gmailEmail,
        status: 'GRANTED'
      });
      localStorage.setItem('qkd_access_logs', JSON.stringify(logs));

      setIsLoading(false);
      onComplete();
    } else {
      setError('Please use a valid Gmail address');
      setIsLoading(false);
    }
  };

  return (
    <div className="emergency-access fade-in">
      <div className="modal-overlay">
        <div className="modal emergency-modal">
          <div className="modal-header">
            <h2 className="modal-title emergency-title">
              🚨 EMERGENCY ACCESS PROTOCOL
            </h2>
            <p className="modal-subtitle">
              Guardian Gmail Authentication Required
            </p>
          </div>
          
          <div className="modal-body">
            <div className="emergency-warning">
              <div className="warning-content">
                <h3>Emergency Medical Access</h3>
                <p>
                  You are requesting emergency access to {patient.name}'s medical records 
                  without patient consent. This requires guardian authentication.
                </p>
                
                <div className="nominee-details">
                  <h4>Nominated Guardian:</h4>
                  <div className="nominee-info">
                    <div className="nominee-item">
                      <span className="nominee-label">Name:</span>
                      <span className="nominee-value">{patient.nominee.name}</span>
                    </div>
                    <div className="nominee-item">
                      <span className="nominee-label">Relation:</span>
                      <span className="nominee-value">{patient.nominee.relation}</span>
                    </div>
                  </div>
                </div>

                <div className="compliance-notice">
                  <strong>⚠️ Compliance Notice:</strong> This emergency access bypasses patient 
                  consent and will be permanently logged for regulatory audit. Guardian must 
                  authenticate via Gmail to proceed.
                </div>
              </div>
            </div>

            <form onSubmit={handleGmailLogin} className="gmail-login-form">
              <h4>Guardian Gmail Login</h4>
              
              <div className="form-group">
                <label htmlFor="gmail-email" className="form-label">
                  Gmail Address
                </label>
                <input
                  type="email"
                  id="gmail-email"
                  className="form-input"
                  value={gmailEmail}
                  onChange={(e) => setGmailEmail(e.target.value)}
                  placeholder="guardian@gmail.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="gmail-password" className="form-label">
                  Gmail Password
                </label>
                <input
                  type="password"
                  id="gmail-password"
                  className="form-input"
                  value={gmailPassword}
                  onChange={(e) => setGmailPassword(e.target.value)}
                  placeholder="Enter Gmail password"
                  required
                />
              </div>

              {error && (
                <div className="error-message">
                  <span className="error-icon">⚠</span>
                  {error}
                </div>
              )}

              <div className="emergency-actions">
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="spinner-small"></div>
                      Authenticating...
                    </>
                  ) : (
                    'Grant Emergency Access'
                  )}
                </button>
                
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyAccess;