import React, { useState } from 'react';
import MedicalSummary from './MedicalSummary';

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

interface MedicalRecordsProps {
  patient: Patient;
  hospitalId: string;
  onBack: () => void;
}

const medicalRecords: MedicalRecord[] = [
  {
    id: 'rec001',
    fileName: 'Blood_Test_Report.pdf',
    type: 'LAB_REPORT',
    date: '2024-12-15',
    hospital: 'Ruby Hall Clinic',
    size: '245 KB'
  },
  {
    id: 'rec002',
    fileName: 'XRay_Chest_PA.pdf',
    type: 'RADIOLOGY',
    date: '2024-12-10',
    hospital: 'Ruby Hall Clinic',
    size: '1.2 MB'
  },
  {
    id: 'rec003',
    fileName: 'Prescription_Dec2024.pdf',
    type: 'PRESCRIPTION',
    date: '2024-12-20',
    hospital: 'Sassoon Hospital',
    size: '89 KB'
  }
];

const MedicalRecords: React.FC<MedicalRecordsProps> = ({ patient, hospitalId, onBack }) => {
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);

  const getHospitalName = (id: string) => {
    return id === 'hosp_a' ? 'Ruby Hall Clinic' : 'Sassoon General Hospital';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'LAB_REPORT': return 'badge-info';
      case 'RADIOLOGY': return 'badge-warning';
      case 'PRESCRIPTION': return 'badge-success';
      default: return 'badge-info';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleViewSummary = (record: MedicalRecord) => {
    setSelectedRecord(record);
  };

  const handleCloseSummary = () => {
    setSelectedRecord(null);
  };

  return (
    <div className="medical-records fade-in">
      <div className="section-header">
        <h2>Medical Records</h2>
        <p>Secure access to {patient.name}'s medical records from {getHospitalName(hospitalId)}</p>
      </div>

      {/* Patient Summary */}
      <div className="patient-summary card">
        <div className="summary-header">
          <h3>Patient Information</h3>
          <div className="security-badges">
            <span className="badge badge-success">🔒 End-to-End Encrypted</span>
            <span className="badge badge-info">🛡️ Digitally Signed</span>
          </div>
        </div>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">Patient Name:</span>
            <span className="summary-value">{patient.name}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">ABHA ID:</span>
            <span className="summary-value">{patient.abhaId}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Hospital:</span>
            <span className="summary-value">{getHospitalName(hospitalId)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Access Time:</span>
            <span className="summary-value">{new Date().toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Records List */}
      <div className="records-section">
        <h3>Available Medical Records</h3>
        <div className="records-grid">
          {medicalRecords.map((record) => (
            <div key={record.id} className="record-card card">
              <div className="record-header">
                <div className="record-icon">📄</div>
                <div className="record-info">
                  <h4>{record.fileName}</h4>
                  <span className={`badge ${getTypeColor(record.type)}`}>
                    {record.type.replace('_', ' ')}
                  </span>
                </div>
              </div>
              
              <div className="record-details">
                <div className="detail-row">
                  <span className="detail-label">Date:</span>
                  <span className="detail-value">{formatDate(record.date)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Hospital:</span>
                  <span className="detail-value">{record.hospital}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">File Size:</span>
                  <span className="detail-value">{record.size}</span>
                </div>
              </div>

              <div className="record-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => handleViewSummary(record)}
                >
                  View Summary
                </button>
                <button
                  className="btn btn-secondary"
                  disabled
                  title="Download requires additional authorization"
                >
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Access Log */}
      <div className="access-log card">
        <h3>Access Audit Trail</h3>
        <div className="log-entries">
          <div className="log-entry">
            <span className="log-time">{new Date().toLocaleString('en-IN')}</span>
            <span className="log-action">Medical records accessed</span>
            <span className="log-status badge badge-success">Authorized</span>
          </div>
          <div className="log-entry">
            <span className="log-time">{new Date(Date.now() - 60000).toLocaleString('en-IN')}</span>
            <span className="log-action">QKD protocol completed</span>
            <span className="log-status badge badge-success">Success</span>
          </div>
          <div className="log-entry">
            <span className="log-time">{new Date(Date.now() - 120000).toLocaleString('en-IN')}</span>
            <span className="log-action">Patient verification completed</span>
            <span className="log-status badge badge-success">Verified</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="section-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          Back to Hospital Selection
        </button>
      </div>

      {/* Medical Summary Modal */}
      {selectedRecord && (
        <MedicalSummary
          record={selectedRecord}
          patient={patient}
          onClose={handleCloseSummary}
        />
      )}
    </div>
  );
};

export default MedicalRecords;