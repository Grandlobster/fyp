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

interface PatientVerificationProps {
  onPatientVerified: (patient: Patient) => void;
}

const PatientVerification: React.FC<PatientVerificationProps> = ({ onPatientVerified }) => {
  const [abhaId, setAbhaId] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const formatABHA = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const formatted = numbers.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3');
    return formatted.substring(0, 14);
  };

  const handleABHASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (abhaId !== '1234-5678-9012') {
      setError('ABHA ID not found. Please verify the ID and try again.');
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    setShowOTP(true);
    startResendTimer();
  };

  const startResendTimer = () => {
    setResendTimer(30);
    const timer = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleOTPChange = (index: number, value: string) => {
    if (value.length > 1) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
      nextInput?.focus();
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpValue = otp.join('');
    
    if (otpValue.length !== 6) {
      setError('Please enter complete OTP');
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Accept any 6-digit OTP
    const patientData: Patient = {
      abhaId: '1234-5678-9012',
      name: 'Payal Lawande',
      email: 'inf***@gmail.com',
      phone: '+9190***',
      verified: true,
      nominee: {
        name: 'Aadesh Lawande',
        phone: '+9190***',
        relation: 'Spouse'
      }
    };

    onPatientVerified(patientData);
    setIsLoading(false);
  };

  const handleQRScan = () => {
    // Simulate QR scan
    setAbhaId('1234-5678-9012');
    setTimeout(() => {
      setShowOTP(true);
      startResendTimer();
    }, 1000);
  };

  if (showOTP) {
    return (
      <div className="verification-section fade-in">
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">OTP Verification</h2>
              <p className="modal-subtitle">
                An OTP has been sent to registered email/mobile
              </p>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleOTPSubmit}>
                <div className="otp-container">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      className="otp-input"
                      value={digit}
                      onChange={(e) => handleOTPChange(index, e.target.value)}
                      maxLength={1}
                      pattern="[0-9]"
                    />
                  ))}
                </div>

                {error && (
                  <div className="error-message">
                    <span className="error-icon">⚠</span>
                    {error}
                  </div>
                )}

                <div className="otp-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <div className="spinner-small"></div>
                        Verifying...
                      </>
                    ) : (
                      'Verify OTP'
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={resendTimer > 0}
                    onClick={() => {
                      setOtp(['', '', '', '', '', '']);
                      startResendTimer();
                    }}
                  >
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="verification-section fade-in">
      <div className="section-header">
        <h2>Patient Verification</h2>
        <p>Enter patient's ABHA ID to access medical records</p>
      </div>

      <div className="verification-card card">
        <form onSubmit={handleABHASubmit} className="verification-form">
          <div className="form-group">
            <label htmlFor="abhaId" className="form-label">
              ABHA ID
            </label>
            <input
              type="text"
              id="abhaId"
              className="form-input"
              value={abhaId}
              onChange={(e) => setAbhaId(formatABHA(e.target.value))}
              placeholder="XXXX-XXXX-XXXX"
              maxLength={14}
              required
            />
            <small className="form-help">
              Enter 12-digit ABHA ID in format: XXXX-XXXX-XXXX
            </small>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠</span>
              {error}
            </div>
          )}

          <div className="verification-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="spinner-small"></div>
                  Verifying...
                </>
              ) : (
                'Verify Patient'
              )}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleQRScan}
            >
              📱 Scan ABHA QR Code
            </button>
          </div>
        </form>

        <div className="verification-info">
          <div className="info-item">
            <span className="info-icon">🔒</span>
            <div>
              <strong>Secure Verification</strong>
              <p>Patient identity verified using ABDM standards</p>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">📱</span>
            <div>
              <strong>OTP Authentication</strong>
              <p>Two-factor authentication for enhanced security</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientVerification;