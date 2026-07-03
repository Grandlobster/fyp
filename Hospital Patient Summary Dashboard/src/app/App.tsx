import React, { useState, useEffect } from 'react';
import { PatientHeader } from './components/PatientHeader';
import { Sidebar } from './components/Sidebar';
import { DemographicsSection } from './components/DemographicsSection';
import { AllergiesSection } from './components/AllergiesSection';
import { MedicationsSection } from './components/MedicationsSection';
import { ProblemsSection } from './components/ProblemsSection';
import { VitalsSection } from './components/VitalsSection';
import { LabResultsSection } from './components/LabResultsSection';
import { DetailDrawer } from './components/DetailDrawer';
import { LoginPage } from './components/LoginPage';
import { PatientSearch } from './components/PatientSearch';
import { OTPVerification } from './components/OTPVerification';
import { PatientFiles } from './components/PatientFiles';
import { DataService } from '../services/data.service';
import type { Patient, Demographics, Allergy, Medication, Problem, Vital, LabResult } from '../types/patient.types';

type AppScreen = 'login' | 'search' | 'otp' | 'dashboard';

interface Doctor {
  doctor_id: string;
  name: string;
  username: string;
  hospital_id: string;
}

interface PatientData {
  name?: string;
  patientDisplay?: string;
  patientMobile?: string;
  patientReference?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  careContexts?: Array<{ referenceNumber: string; display: string }>;
  [key: string]: unknown;
}

// Transform API snake_case to UI camelCase
function transformPatient(patient: Patient) {
  return {
    mrn: patient.mrn,
    name: patient.name,
    dob: patient.dob,
    age: patient.age,
    gender: patient.gender,
    bloodType: patient.blood_type,
  };
}
function transformDemographics(demographics: Demographics) {
  return {
    address: demographics.address,
    city: demographics.city,
    state: demographics.state,
    zip: demographics.zip,
    phone: demographics.phone,
    email: demographics.email,
    maritalStatus: demographics.marital_status,
    language: demographics.language,
    race: demographics.race,
    ethnicity: demographics.ethnicity,
    emergencyContact: {
      name: demographics.emergency_contact.name,
      relationship: demographics.emergency_contact.relationship,
      phone: demographics.emergency_contact.phone,
    },
  };
}
function transformAllergy(allergy: Allergy) {
  return {
    id: allergy.id,
    substance: allergy.substance,
    reaction: allergy.reaction,
    severity: allergy.severity,
    onsetDate: allergy.onset_date,
    verifiedBy: allergy.verified_by,
  };
}
function transformMedication(medication: Medication) {
  return {
    id: medication.id,
    name: medication.name,
    dose: medication.dose,
    route: medication.route,
    frequency: medication.frequency,
    startDate: medication.start_date,
    status: medication.status,
    prescriber: medication.prescriber,
  };
}
function transformProblem(problem: Problem) {
  return {
    id: problem.id,
    condition: problem.condition,
    icd10: problem.icd10,
    status: problem.status,
    onsetDate: problem.onset_date,
    diagnosedBy: problem.diagnosed_by,
  };
}
function transformLabResult(lab: LabResult) {
  return {
    id: lab.id,
    test: lab.test,
    value: lab.value,
    unit: lab.unit,
    referenceRange: lab.reference_range,
    status: lab.status,
    date: lab.date,
  };
}

function calculateAge(dob?: string) {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

function transformAbdmDemographics(patient: PatientData | null) {
  return {
    address: 'Not provided by ABDM',
    city: '-',
    state: '-',
    zip: '-',
    phone: patient?.patientMobile || patient?.phone || '-',
    email: patient?.email || '-',
    maritalStatus: '-',
    language: '-',
    race: '-',
    ethnicity: '-',
    emergencyContact: {
      name: '-',
      relationship: '-',
      phone: '-',
    },
  };
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('login');
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [abhaAddress, setAbhaAddress] = useState('');
  const [abdmPatient, setAbdmPatient] = useState<PatientData | null>(null);

  const [activeSection, setActiveSection] = useState('demographics');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState<{ title: string; content: React.ReactNode }>({ title: '', content: null });

  // Clinical data state
  const [patientData, setPatientData] = useState<any>(null);
  const [demographicsData, setDemographicsData] = useState<any>(null);
  const [allergiesData, setAllergiesData] = useState<any[]>([]);
  const [medicationsData, setMedicationsData] = useState<any[]>([]);
  const [problemsData, setProblemsData] = useState<any[]>([]);
  const [vitalsData, setVitalsData] = useState<any[]>([]);
  const [labResultsData, setLabResultsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (doc: Doctor) => {
    setDoctor(doc);
    setScreen('search');
  };

  const handlePatientFound = (abha: string, data: PatientData) => {
    setAbhaAddress(abha);
    setAbdmPatient(data);
    setScreen('otp');
  };

  const handleOtpVerified = async () => {
    setScreen('dashboard');
    // Load ISO clinical data from mock/API in parallel
    setLoading(true);
    setError(null);
    try {
      const PATIENT_MRN = 'MRN-2024-789456';
      const [patient, demographics, allergies, medications, problems, vitals, labResults] =
        await Promise.all([
          DataService.getPatient(PATIENT_MRN),
          DataService.getDemographics(PATIENT_MRN),
          DataService.getAllergies(PATIENT_MRN),
          DataService.getMedications(PATIENT_MRN),
          DataService.getProblems(PATIENT_MRN),
          DataService.getVitals(PATIENT_MRN),
          DataService.getLabResults(PATIENT_MRN),
        ]);
      setPatientData(transformPatient(patient));
      setDemographicsData(transformDemographics(demographics));
      setAllergiesData(allergies.map(transformAllergy));
      setMedicationsData(medications.map(transformMedication));
      setProblemsData(problems.map(transformProblem));
      setVitalsData(vitals);
      setLabResultsData(labResults.map(transformLabResult));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patient data');
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (type: string, item: any) => {
    let content: React.ReactNode;
    let title = '';

    switch (type) {
      case 'allergy':
        title = 'Allergy Details';
        content = (
          <div className="space-y-4">
            <div><div className="text-[12px] text-[#6B7280] mb-1">Substance</div><div className="text-[16px] text-[#1F2937] font-semibold">{item.substance}</div></div>
            <div><div className="text-[12px] text-[#6B7280] mb-1">Reaction</div><div className="text-[14px] text-[#1F2937]">{item.reaction}</div></div>
            <div>
              <div className="text-[12px] text-[#6B7280] mb-1">Severity</div>
              <span className={`inline-block px-2 py-1 text-[12px] font-medium ${item.severity === 'Critical' ? 'bg-[#DC2626] text-white' : 'bg-[#6B7280] text-white'}`}>{item.severity}</span>
            </div>
            <div><div className="text-[12px] text-[#6B7280] mb-1">Onset Date</div><div className="text-[14px] text-[#1F2937]">{item.onsetDate}</div></div>
            <div><div className="text-[12px] text-[#6B7280] mb-1">Verified By</div><div className="text-[14px] text-[#1F2937]">{item.verifiedBy}</div></div>
            <div className="border-t border-[#E5E7EB] pt-4">
              <div className="text-[13px] font-semibold text-[#1F2937] mb-2">Clinical Notes</div>
              <div className="text-[13px] text-[#6B7280] leading-relaxed">Patient has documented severe allergic reaction requiring immediate avoidance. EpiPen prescribed and patient educated on recognition and management of allergic reactions.</div>
            </div>
          </div>
        );
        break;
      case 'medication':
        title = 'Medication Details';
        content = (
          <div className="space-y-4">
            <div><div className="text-[12px] text-[#6B7280] mb-1">Medication</div><div className="text-[16px] text-[#1F2937] font-semibold">{item.name}</div></div>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-[12px] text-[#6B7280] mb-1">Dose</div><div className="text-[14px] text-[#1F2937]">{item.dose}</div></div>
              <div><div className="text-[12px] text-[#6B7280] mb-1">Route</div><div className="text-[14px] text-[#1F2937]">{item.route}</div></div>
            </div>
            <div><div className="text-[12px] text-[#6B7280] mb-1">Frequency</div><div className="text-[14px] text-[#1F2937]">{item.frequency}</div></div>
            <div><div className="text-[12px] text-[#6B7280] mb-1">Start Date</div><div className="text-[14px] text-[#1F2937]">{item.startDate}</div></div>
            <div><div className="text-[12px] text-[#6B7280] mb-1">Status</div><span className="inline-block px-2 py-1 text-[12px] font-medium bg-[#16A34A] text-white">{item.status}</span></div>
            <div><div className="text-[12px] text-[#6B7280] mb-1">Prescriber</div><div className="text-[14px] text-[#1F2937]">{item.prescriber}</div></div>
          </div>
        );
        break;
      case 'problem':
        title = 'Problem Details';
        content = (
          <div className="space-y-4">
            <div><div className="text-[12px] text-[#6B7280] mb-1">Condition</div><div className="text-[16px] text-[#1F2937] font-semibold">{item.condition}</div></div>
            <div><div className="text-[12px] text-[#6B7280] mb-1">ICD-10 Code</div><div className="text-[14px] text-[#1F2937]">{item.icd10}</div></div>
            <div><div className="text-[12px] text-[#6B7280] mb-1">Status</div><span className="inline-block px-2 py-1 text-[12px] font-medium bg-[#D97706] text-white">{item.status}</span></div>
            <div><div className="text-[12px] text-[#6B7280] mb-1">Onset Date</div><div className="text-[14px] text-[#1F2937]">{item.onsetDate}</div></div>
            <div><div className="text-[12px] text-[#6B7280] mb-1">Diagnosed By</div><div className="text-[14px] text-[#1F2937]">{item.diagnosedBy}</div></div>
          </div>
        );
        break;
      case 'lab':
        title = 'Lab Result Details';
        content = (
          <div className="space-y-4">
            <div><div className="text-[12px] text-[#6B7280] mb-1">Test</div><div className="text-[16px] text-[#1F2937] font-semibold">{item.test}</div></div>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-[12px] text-[#6B7280] mb-1">Value</div><div className="text-[20px] text-[#1F2937] font-semibold">{item.value}</div></div>
              <div><div className="text-[12px] text-[#6B7280] mb-1">Unit</div><div className="text-[14px] text-[#1F2937]">{item.unit}</div></div>
            </div>
            <div><div className="text-[12px] text-[#6B7280] mb-1">Reference Range</div><div className="text-[14px] text-[#1F2937]">{item.referenceRange}</div></div>
            <div>
              <div className="text-[12px] text-[#6B7280] mb-1">Status</div>
              <span className={`inline-block px-2 py-1 text-[12px] font-medium ${item.status === 'High' || item.status === 'Low' ? 'bg-[#D97706] text-white' : 'bg-[#16A34A] text-white'}`}>{item.status}</span>
            </div>
            <div><div className="text-[12px] text-[#6B7280] mb-1">Date</div><div className="text-[14px] text-[#1F2937]">{item.date}</div></div>
          </div>
        );
        break;
    }

    setDrawerContent({ title, content });
    setDrawerOpen(true);
  };

  const renderSection = () => {
    if (loading) {
      return <div className="border border-[#E5E7EB] bg-white p-8 text-center"><div className="text-[14px] text-[#6B7280]">Loading patient data...</div></div>;
    }
    if (error) {
      return (
        <div className="border border-[#E5E7EB] bg-white p-8 text-center">
          <div className="text-[14px] text-[#DC2626] mb-2">Error loading data</div>
          <div className="text-[13px] text-[#6B7280]">{error}</div>
          <button onClick={() => handleOtpVerified()} className="mt-4 px-4 py-2 bg-[#2563EB] text-white text-[13px] hover:bg-[#1D4ED8]">Retry</button>
        </div>
      );
    }

    if (activeSection === 'records') {
      return <PatientFiles abhaAddress={abhaAddress} patientData={abdmPatient || {}} />;
    }

    switch (activeSection) {
      case 'demographics': return <DemographicsSection demographics={abdmPatient ? transformAbdmDemographics(abdmPatient) : demographicsData} />;
      case 'allergies': return <AllergiesSection allergies={allergiesData} onRowClick={(item) => handleItemClick('allergy', item)} />;
      case 'medications': return <MedicationsSection medications={medicationsData} onRowClick={(item) => handleItemClick('medication', item)} />;
      case 'problems': return <ProblemsSection problems={problemsData} onRowClick={(item) => handleItemClick('problem', item)} />;
      case 'vitals': return <VitalsSection vitals={vitalsData} />;
      case 'labs': return <LabResultsSection results={labResultsData} onRowClick={(item) => handleItemClick('lab', item)} />;
      default:
        return <div className="border border-[#E5E7EB] bg-white p-8 text-center"><div className="text-[14px] text-[#6B7280]">Section under development</div></div>;
    }
  };

  // Pre-auth screens
  if (screen === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (screen === 'search') {
    return <PatientSearch doctorName={doctor?.name || ''} onPatientFound={handlePatientFound} />;
  }

  if (screen === 'otp' && abdmPatient) {
    return (
      <OTPVerification
        abhaAddress={abhaAddress}
        patientData={abdmPatient}
        onVerified={handleOtpVerified}
      />
    );
  }

  // Dashboard (existing layout, preserved exactly)
  const displayPatient = abdmPatient ? {
    mrn: abdmPatient.patientReference || abhaAddress,
    name: abdmPatient.patientDisplay || abdmPatient.name || 'Loading...',
    dob: abdmPatient.dateOfBirth || '',
    age: calculateAge(abdmPatient.dateOfBirth),
    gender: abdmPatient.gender || '',
    bloodType: '',
  } : patientData || {
    mrn: abhaAddress,
    name: 'Loading...',
    dob: '',
    age: 0,
    gender: '',
    bloodType: '',
  };

  const criticalAllergyCount = abdmPatient ? 0 : allergiesData.filter((allergy) => allergy.severity === 'Critical').length;

  return (
    <div className="h-screen flex flex-col bg-[#F7F9FB]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <PatientHeader patient={displayPatient} criticalAllergyCount={criticalAllergyCount} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1400px] mx-auto space-y-4">
            {renderSection()}
          </div>
        </main>
      </div>
      <DetailDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={drawerContent.title}>
        {drawerContent.content}
      </DetailDrawer>
    </div>
  );
}
