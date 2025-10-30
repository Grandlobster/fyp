import React, { useState, useEffect } from 'react';

interface QKDProgressProps {
  hospitalId: string;
  onComplete: () => void;
}

interface QKDStep {
  id: number;
  title: string;
  description: string;
  duration: number;
}

const qkdSteps: QKDStep[] = [
  {
    id: 1,
    title: 'Initializing Secure Channel',
    description: 'Establishing quantum communication link',
    duration: 2000
  },
  {
    id: 2,
    title: 'BB84 Protocol Execution',
    description: 'Quantum key generation in progress',
    duration: 2000
  },
  {
    id: 3,
    title: 'Key Sifting and Verification',
    description: 'Verifying quantum key integrity',
    duration: 2000
  },
  {
    id: 4,
    title: 'Securing Medical Records',
    description: 'Encrypting data transmission',
    duration: 2000
  }
];

const QKDProgress: React.FC<QKDProgressProps> = ({ hospitalId, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [qber, setQber] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (currentStep >= qkdSteps.length) {
      setIsComplete(true);
      setTimeout(() => {
        onComplete();
      }, 1500);
      return;
    }

    const step = qkdSteps[currentStep];
    const startTime = Date.now();
    const stepProgress = currentStep * 25;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const stepProgressPercent = Math.min((elapsed / step.duration) * 25, 25);
      const totalProgress = stepProgress + stepProgressPercent;
      
      setProgress(totalProgress);

      // Show QBER during step 3
      if (currentStep === 2 && stepProgressPercent > 12) {
        setQber(0.0423);
      }

      if (elapsed >= step.duration) {
        clearInterval(timer);
        setCurrentStep(prev => prev + 1);
      }
    }, 50);

    return () => clearInterval(timer);
  }, [currentStep, onComplete]);

  const getHospitalName = (id: string) => {
    return id === 'hosp_a' ? 'Ruby Hall Clinic' : 'Sassoon General Hospital';
  };

  return (
    <div className="qkd-progress fade-in">
      <div className="modal-overlay">
        <div className="modal qkd-modal">
          <div className="modal-header">
            <h2 className="modal-title">Quantum Key Distribution in Progress</h2>
            <p className="modal-subtitle">
              Establishing secure connection with {getHospitalName(hospitalId)}
            </p>
          </div>
          
          <div className="modal-body">
            {!isComplete ? (
              <>
                {/* Progress Steps */}
                <div className="qkd-steps">
                  {qkdSteps.map((step, index) => (
                    <div 
                      key={step.id}
                      className={`qkd-step ${
                        index < currentStep ? 'completed' : 
                        index === currentStep ? 'active' : 'pending'
                      }`}
                    >
                      <div className="step-indicator">
                        {index < currentStep ? (
                          <span className="checkmark">✓</span>
                        ) : index === currentStep ? (
                          <div className="spinner-small"></div>
                        ) : (
                          <span className="step-number">{step.id}</span>
                        )}
                      </div>
                      <div className="step-content">
                        <h4>{step.title}</h4>
                        <p>{step.description}</p>
                        {index === currentStep && index === 2 && qber > 0 && (
                          <div className="qber-display">
                            <span className="qber-label">QBER:</span>
                            <span className="qber-value">{qber.toFixed(4)}</span>
                            <span className="qber-status badge badge-success">Normal</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress Bar */}
                <div className="progress-section">
                  <div className="progress-container">
                    <div 
                      className="progress-bar"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    {Math.round(progress)}% Complete
                  </div>
                </div>

                {/* Security Indicators */}
                <div className="security-indicators">
                  <div className="security-item">
                    <span className="security-icon">🔒</span>
                    <span>Quantum Encrypted</span>
                  </div>
                  <div className="security-item">
                    <span className="security-icon">🛡️</span>
                    <span>BB84 Protocol</span>
                  </div>
                  <div className="security-item">
                    <span className="security-icon">⚡</span>
                    <span>Real-time Verification</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="qkd-complete">
                <div className="success-animation">
                  <div className="success-checkmark">✓</div>
                </div>
                <h3>Quantum Key Distribution Complete</h3>
                <p>Secure channel established successfully</p>
                <div className="completion-stats">
                  <div className="stat-item">
                    <span className="stat-label">Security Level:</span>
                    <span className="stat-value badge badge-success">Maximum</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">QBER:</span>
                    <span className="stat-value">{qber.toFixed(4)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Protocol:</span>
                    <span className="stat-value">BB84</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QKDProgress;