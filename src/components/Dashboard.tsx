import React, { useState, useEffect } from 'react';
import PatientVerification from './PatientVerification';
import HospitalSelection from './HospitalSelection';
import QKDProgress from './QKDProgress';
import MedicalRecords from './MedicalRecords';
import EmergencyAccess from './EmergencyAccess';

interface Session {
  isLoggedIn: boolean;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
  loginTime: number;
  expiresAt: number;
}

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

interface DashboardProps {
  session: Session;
  onLogout: () => void;
}

type DashboardStep = 'verification' | 'hospital-selection' | 'qkd-progress' | 'records' | 'emergency';

const Dashboard: React.FC<DashboardProps> = ({ session, onLogout }) => {
  const [currentStep, setCurrentStep] = useState<DashboardStep>('verification');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(0);

  useEffect(() => {
    // Check for existing patient data
    const savedPatient = localStorage.getItem('qkd_patient');
    if (savedPatient) {
      const patientData = JSON.parse(savedPatient);
      setPatient(patientData);
      if (patientData.verified) {
        setCurrentStep('hospital-selection');
      }
    }

    // Session timer
    const timer = setInterval(() => {
      const timeLeft = Math.max(0, session.expiresAt - Date.now());
      setSessionTimeLeft(timeLeft);
      
      if (timeLeft === 0) {
        onLogout();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [session.expiresAt, onLogout]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePatientVerified = (patientData: Patient) => {
    setPatient(patientData);
    localStorage.setItem('qkd_patient', JSON.stringify(patientData));
    setCurrentStep('hospital-selection');
  };

  const handleHospitalSelected = (hospitalId: string) => {
    setSelectedHospital(hospitalId);
    setCurrentStep('qkd-progress');
  };

  const handleQKDComplete = () => {
    setCurrentStep('records');
  };

  const handleEmergencyAccess = () => {
    setCurrentStep('emergency');
  };

  const handleEmergencyComplete = () => {
    setCurrentStep('records');
  };

  const handleBackToVerification = () => {
    setPatient(null);
    localStorage.removeItem('qkd_patient');
    setCurrentStep('verification');
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="gov-logo-small">[GOV]</div>
          <div className="portal-info">
            <h1>ABDM QKD Medical Records Portal</h1>
            <p>Ministry of Health & Family Welfare</p>
          </div>
        </div>
        
        <div className="header-right">
          <div className="session-info">
            <div className="doctor-info">
              <span className="doctor-name">{session.doctorName}</span>
              <span className="hospital-name">{session.hospitalName}</span>
            </div>
            <div className="session-timer">
              <span className="timer-label">Session:</span>
              <span className="timer-value">{formatTime(sessionTimeLeft)}</span>
            </div>
          </div>
          <button onClick={onLogout} className="btn btn-secondary logout-btn">
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-container">
          {/* Progress Indicator */}
          <div className="progress-steps">
            <div className={`step ${currentStep === 'verification' ? 'active' : patient ? 'completed' : ''}`}>
              <div className="step-number">1</div>
              <span>Patient Verification</span>
            </div>
            <div className={`step ${currentStep === 'hospital-selection' ? 'active' : selectedHospital ? 'completed' : ''}`}>
              <div className="step-number">2</div>
              <span>Hospital Selection</span>
            </div>
            <div className={`step ${currentStep === 'qkd-progress' ? 'active' : currentStep === 'records' ? 'completed' : ''}`}>
              <div className="step-number">3</div>
              <span>QKD Protocol</span>
            </div>
            <div className={`step ${currentStep === 'records' ? 'active' : ''}`}>
              <div className="step-number">4</div>
              <span>Medical Records</span>
            </div>
          </div>

          {/* Step Content */}
          <div className="step-content">
            {currentStep === 'verification' && (
              <PatientVerification onPatientVerified={handlePatientVerified} />
            )}
            
            {currentStep === 'hospital-selection' && patient && (
              <HospitalSelection 
                patient={patient}
                onHospitalSelected={handleHospitalSelected}
                onEmergencyAccess={handleEmergencyAccess}
                onBack={handleBackToVerification}
              />
            )}
            
            {currentStep === 'qkd-progress' && (
              <QKDProgress 
                hospitalId={selectedHospital}
                onComplete={handleQKDComplete}
              />
            )}
            
            {currentStep === 'records' && patient && (
              <MedicalRecords 
                patient={patient}
                hospitalId={selectedHospital}
                onBack={() => setCurrentStep('hospital-selection')}
              />
            )}
            
            {currentStep === 'emergency' && patient && (
              <EmergencyAccess 
                patient={patient}
                onComplete={handleEmergencyComplete}
                onCancel={() => setCurrentStep('hospital-selection')}
              />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="dashboard-footer">
        <div className="security-indicators">
          <span className="security-item">
            <span className="security-icon">🔒</span>
            Secured Connection
          </span>
          <span className="security-item">
            <span className="security-icon">🛡️</span>
            End-to-End Encrypted
          </span>
          <span className="security-item">
            <span className="security-icon">📋</span>
            Audit Trail: All access logged
          </span>
        </div>
        <p>Secured with Quantum Key Distribution Protocol (BB84) | National Health Authority | Government of India</p>
      </footer>
    </div>
  );
};

export default Dashboard;