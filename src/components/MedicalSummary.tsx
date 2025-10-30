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

interface MedicalRecord {
  id: string;
  fileName: string;
  type: string;
  date: string;
  hospital: string;
  size: string;
}

interface MedicalSummaryProps {
  record: MedicalRecord;
  patient: Patient;
  onClose: () => void;
}

const MedicalSummary: React.FC<MedicalSummaryProps> = ({ record, patient, onClose }) => {
  const [activeTab, setActiveTab] = useState<'heart' | 'xray' | 'mental'>('heart');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="medical-summary">
      <div className="modal-overlay">
        <div className="modal summary-modal">
          <div className="modal-header">
            <h2 className="modal-title">{record.fileName}</h2>
            <p className="modal-subtitle">{record.hospital} • {record.date}</p>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          
          <div className="modal-body">
            {/* Patient Info Header */}
            <div className="summary-patient-header">
              <div className="patient-id-section">
                <div className="id-row">
                  <span className="id-label">Patient Name:</span>
                  <span className="id-value">{patient.name}</span>
                </div>
                <div className="id-row">
                  <span className="id-label">ABHA ID:</span>
                  <span className="id-value">{patient.abhaId}</span>
                </div>
                <div className="id-row">
                  <span className="id-label">Date:</span>
                  <span className="id-value">15 December 2024</span>
                </div>
                <div className="id-row">
                  <span className="id-label">Hospital:</span>
                  <span className="id-value">Ruby Hall Clinic, Pune</span>
                </div>
              </div>
              <div className="security-stamps">
                <span className="badge badge-success">VERIFIED</span>
                <span className="badge badge-info">QKD SECURED</span>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="medical-tabs">
              <button 
                className={`tab-btn ${activeTab === 'heart' ? 'active' : ''}`}
                onClick={() => setActiveTab('heart')}
              >
                Heart Function
              </button>
              <button 
                className={`tab-btn ${activeTab === 'xray' ? 'active' : ''}`}
                onClick={() => setActiveTab('xray')}
              >
                X-Rays
              </button>
              <button 
                className={`tab-btn ${activeTab === 'mental' ? 'active' : ''}`}
                onClick={() => setActiveTab('mental')}
              >
                Mental Health
              </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
              {activeTab === 'heart' && (
                <div className="medical-section fade-in">
                  <h3 className="section-title">CARDIOVASCULAR ASSESSMENT</h3>
                  
                  <div className="data-grid">
                    <div className="data-card">
                      <div className="data-label">Blood Pressure</div>
                      <div className="data-value">120/80 mmHg</div>
                      <div className="data-status normal">Normal</div>
                    </div>
                    <div className="data-card">
                      <div className="data-label">Heart Rate</div>
                      <div className="data-value">72 bpm</div>
                      <div className="data-status normal">Normal</div>
                    </div>
                    <div className="data-card">
                      <div className="data-label">SpO2</div>
                      <div className="data-value">98%</div>
                      <div className="data-status normal">Normal</div>
                    </div>
                    <div className="data-card">
                      <div className="data-label">Temperature</div>
                      <div className="data-value">98.4°F</div>
                      <div className="data-status normal">Normal</div>
                    </div>
                  </div>

                  <div className="lab-section">
                    <h4>Lipid Profile</h4>
                    <table className="lab-table">
                      <thead>
                        <tr>
                          <th>Parameter</th>
                          <th>Value</th>
                          <th>Normal Range</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Total Cholesterol</td>
                          <td>180 mg/dL</td>
                          <td>&lt;200 mg/dL</td>
                          <td><span className="status-badge normal">Normal</span></td>
                        </tr>
                        <tr>
                          <td>HDL Cholesterol</td>
                          <td>55 mg/dL</td>
                          <td>&gt;40 mg/dL</td>
                          <td><span className="status-badge normal">Normal</span></td>
                        </tr>
                        <tr>
                          <td>LDL Cholesterol</td>
                          <td>110 mg/dL</td>
                          <td>&lt;130 mg/dL</td>
                          <td><span className="status-badge normal">Normal</span></td>
                        </tr>
                        <tr>
                          <td>Triglycerides</td>
                          <td>120 mg/dL</td>
                          <td>&lt;150 mg/dL</td>
                          <td><span className="status-badge normal">Normal</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="assessment-box">
                    <h4>Clinical Assessment</h4>
                    <p>Patient presents with stable cardiovascular parameters. All vital signs within normal reference ranges. No acute pathological findings identified. Cardiovascular health parameters are stable.</p>
                  </div>

                  <div className="recommendations-box">
                    <h4>Recommendations</h4>
                    <ul>
                      <li>Continue current medication regimen</li>
                      <li>Follow-up consultation in 3 months</li>
                      <li>Maintain healthy diet and regular exercise</li>
                      <li>Monthly blood pressure monitoring advised</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'xray' && (
                <div className="medical-section fade-in">
                  <h3 className="section-title">RADIOLOGY REPORT - CHEST X-RAY PA VIEW</h3>
                  
                  <div className="xray-findings">
                    <div className="finding-card">
                      <h4>Examination Details</h4>
                      <div className="finding-row">
                        <span className="finding-label">Examination:</span>
                        <span className="finding-value">Chest X-Ray PA View</span>
                      </div>
                      <div className="finding-row">
                        <span className="finding-label">Date:</span>
                        <span className="finding-value">10 December 2024</span>
                      </div>
                      <div className="finding-row">
                        <span className="finding-label">Technique:</span>
                        <span className="finding-value">Digital Radiography</span>
                      </div>
                    </div>

                    <div className="finding-card">
                      <h4>Findings</h4>
                      <div className="findings-list">
                        <div className="finding-item">
                          <span className="finding-icon">✓</span>
                          <span>Lungs: Clear bilateral lung fields. No infiltrates, consolidation, or pleural effusion.</span>
                        </div>
                        <div className="finding-item">
                          <span className="finding-icon">✓</span>
                          <span>Heart: Normal cardiac silhouette. Cardiothoracic ratio within normal limits.</span>
                        </div>
                        <div className="finding-item">
                          <span className="finding-icon">✓</span>
                          <span>Mediastinum: Normal mediastinal contours. No widening or masses.</span>
                        </div>
                        <div className="finding-item">
                          <span className="finding-icon">✓</span>
                          <span>Bones: No acute fractures or bony abnormalities visualized.</span>
                        </div>
                        <div className="finding-item">
                          <span className="finding-icon">✓</span>
                          <span>Soft Tissues: Normal soft tissue appearance.</span>
                        </div>
                      </div>
                    </div>

                    <div className="impression-box">
                      <h4>Impression</h4>
                      <p><strong>Normal chest radiograph.</strong> No acute cardiopulmonary abnormality detected.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'mental' && (
                <div className="medical-section fade-in">
                  <h3 className="section-title">MENTAL HEALTH ASSESSMENT</h3>
                  
                  <div className="mental-health-grid">
                    <div className="assessment-card">
                      <h4>Psychological Screening</h4>
                      <div className="screening-item">
                        <span className="screening-label">PHQ-9 Score:</span>
                        <span className="screening-value">3/27</span>
                        <span className="status-badge normal">Minimal Depression</span>
                      </div>
                      <div className="screening-item">
                        <span className="screening-label">GAD-7 Score:</span>
                        <span className="screening-value">2/21</span>
                        <span className="status-badge normal">Minimal Anxiety</span>
                      </div>
                      <div className="screening-item">
                        <span className="screening-label">Stress Level:</span>
                        <span className="screening-value">Low</span>
                        <span className="status-badge normal">Normal</span>
                      </div>
                    </div>

                    <div className="assessment-card">
                      <h4>Sleep Quality</h4>
                      <div className="screening-item">
                        <span className="screening-label">Sleep Duration:</span>
                        <span className="screening-value">7-8 hours</span>
                        <span className="status-badge normal">Adequate</span>
                      </div>
                      <div className="screening-item">
                        <span className="screening-label">Sleep Quality:</span>
                        <span className="screening-value">Good</span>
                        <span className="status-badge normal">Normal</span>
                      </div>
                      <div className="screening-item">
                        <span className="screening-label">Insomnia Severity:</span>
                        <span className="screening-value">None</span>
                        <span className="status-badge normal">Normal</span>
                      </div>
                    </div>
                  </div>

                  <div className="mental-assessment-box">
                    <h4>Clinical Observations</h4>
                    <div className="observation-grid">
                      <div className="observation-item">
                        <strong>Mood:</strong> Stable and appropriate
                      </div>
                      <div className="observation-item">
                        <strong>Affect:</strong> Full range, congruent
                      </div>
                      <div className="observation-item">
                        <strong>Thought Process:</strong> Logical and organized
                      </div>
                      <div className="observation-item">
                        <strong>Cognition:</strong> Alert and oriented x3
                      </div>
                      <div className="observation-item">
                        <strong>Insight:</strong> Good
                      </div>
                      <div className="observation-item">
                        <strong>Judgment:</strong> Intact
                      </div>
                    </div>
                  </div>

                  <div className="recommendations-box">
                    <h4>Mental Health Recommendations</h4>
                    <ul>
                      <li>Continue current stress management techniques</li>
                      <li>Maintain regular sleep schedule</li>
                      <li>Engage in regular physical activity</li>
                      <li>Practice mindfulness and relaxation exercises</li>
                      <li>Follow-up assessment in 6 months</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Doctor Signature */}
            <div className="doctor-signature">
              <div className="signature-line"></div>
              <div className="signature-details">
                <p><strong>Examined By:</strong> Dr. Rajesh Sharma, MD</p>
                <p><strong>Registration No:</strong> MH-MED-12345</p>
                <p><strong>Digital Signature:</strong> <span className="badge badge-success">Verified</span></p>
              </div>
            </div>

            {/* Actions */}
            <div className="document-actions">
              <button className="btn btn-primary" onClick={handlePrint}>
                Print Report
              </button>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicalSummary;