import React from 'react';

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

interface Hospital {
  id: string;
  name: string;
  location: string;
  recordsAvailable: boolean;
}

interface HospitalSelectionProps {
  patient: Patient;
  onHospitalSelected: (hospitalId: string) => void;
  onEmergencyAccess: () => void;
  onBack: () => void;
}

const hospitals: Hospital[] = [
  {
    id: 'hosp_a',
    name: 'Ruby Hall Clinic',
    location: 'Pune, Maharashtra',
    recordsAvailable: true
  },
  {
    id: 'hosp_b',
    name: 'Sassoon General Hospital',
    location: 'Pune, Maharashtra',
    recordsAvailable: true
  }
];

const HospitalSelection: React.FC<HospitalSelectionProps> = ({
  patient,
  onHospitalSelected,
  onEmergencyAccess,
  onBack
}) => {
  return (
    <div className="hospital-selection fade-in">
      <div className="section-header">
        <h2>Hospital Selection</h2>
        <p>Select hospital to access {patient.name}'s medical records</p>
      </div>

      {/* Patient Info */}
      <div className="patient-info card">
        <div className="patient-header">
          <h3>Verified Patient</h3>
          <span className="badge badge-success">Verified</span>
        </div>
        <div className="patient-details">
          <div className="detail-item">
            <span className="detail-label">Name:</span>
            <span className="detail-value">{patient.name}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">ABHA ID:</span>
            <span className="detail-value">{patient.abhaId}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Email:</span>
            <span className="detail-value">{patient.email}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Phone:</span>
            <span className="detail-value">{patient.phone}</span>
          </div>
        </div>
      </div>

      {/* Hospital Cards */}
      <div className="hospitals-grid">
        {hospitals.map((hospital) => (
          <div key={hospital.id} className="hospital-card card">
            <div className="hospital-header">
              <h3>{hospital.name}</h3>
              <span className="badge badge-success">Records Available</span>
            </div>
            
            <div className="hospital-details">
              <div className="detail-item">
                <span className="detail-label">Hospital ID:</span>
                <span className="detail-value">{hospital.id}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Location:</span>
                <span className="detail-value">{hospital.location}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Records Status:</span>
                <span className="badge badge-success">Available</span>
              </div>
            </div>

            <div className="hospital-actions">
              <button
                className="btn btn-primary"
                onClick={() => onHospitalSelected(hospital.id)}
              >
                Access Records
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Emergency Access */}
      <div className="emergency-section">
        <div className="emergency-card card">
          <div className="emergency-header">
            <h3>Emergency Access Protocol</h3>
            <span className="badge badge-error">Emergency</span>
          </div>
          <p>
            Access patient records in emergency situations. This action will notify 
            the patient's nominated guardian and require additional verification.
          </p>
          <div className="nominee-info">
            <strong>Nominated Guardian:</strong> {patient.nominee.name} ({patient.nominee.relation})
          </div>
          <button
            className="btn btn-danger emergency-btn"
            onClick={onEmergencyAccess}
          >
            Emergency Access
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="section-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          Back to Verification
        </button>
      </div>
    </div>
  );
};

export default HospitalSelection;