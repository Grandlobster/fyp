/**
 * Mock Data Service
 *
 * This service provides mock data that matches the API response format.
 * Use this during development before backend is ready.
 *
 * To switch to real API, change USE_MOCK_DATA to false in App.tsx
 */

import type {
  Patient,
  Demographics,
  Allergy,
  Medication,
  Problem,
  Vital,
  LabResult,
} from '../types/patient.types';

// Simulate API delay
const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

export const MockDataService = {
  async getPatient(mrn: string): Promise<Patient> {
    await delay();
    return {
      mrn: mrn,
      name: 'Johnson, Maria Elena',
      dob: '1965-03-14',
      age: 61,
      gender: 'Female',
      blood_type: 'O+',
    };
  },

  async getDemographics(mrn: string): Promise<Demographics> {
    await delay();
    return {
      address: '4582 Maple Avenue',
      city: 'Springfield',
      state: 'IL',
      zip: '62704',
      phone: '(217) 555-0198',
      email: 'maria.johnson@email.com',
      marital_status: 'Married',
      language: 'English',
      race: 'White',
      ethnicity: 'Hispanic/Latino',
      emergency_contact: {
        name: 'Johnson, Robert',
        relationship: 'Spouse',
        phone: '(217) 555-0199',
      },
    };
  },

  async getAllergies(mrn: string): Promise<Allergy[]> {
    await delay();
    return [
      {
        id: '1',
        substance: 'Penicillin',
        reaction: 'Anaphylaxis',
        severity: 'Critical',
        onset_date: '2003-05-12',
        verified_by: 'Dr. Sarah Chen',
      },
      {
        id: '2',
        substance: 'Sulfa drugs (Sulfonamides)',
        reaction: 'Stevens-Johnson syndrome',
        severity: 'Critical',
        onset_date: '2008-11-28',
        verified_by: 'Dr. Michael Roberts',
      },
      {
        id: '3',
        substance: 'Latex',
        reaction: 'Contact dermatitis, urticaria',
        severity: 'Moderate',
        onset_date: '2015-02-03',
        verified_by: 'Dr. Sarah Chen',
      },
    ];
  },

  async getMedications(mrn: string, status?: string): Promise<Medication[]> {
    await delay();
    const medications = [
      {
        id: '1',
        name: 'Metformin',
        dose: '1000mg',
        route: 'PO',
        frequency: 'BID',
        start_date: '2018-01-15',
        status: 'Active' as const,
        prescriber: 'Dr. Sarah Chen',
      },
      {
        id: '2',
        name: 'Lisinopril',
        dose: '20mg',
        route: 'PO',
        frequency: 'QD',
        start_date: '2019-06-22',
        status: 'Active' as const,
        prescriber: 'Dr. Sarah Chen',
      },
      {
        id: '3',
        name: 'Atorvastatin',
        dose: '40mg',
        route: 'PO',
        frequency: 'QHS',
        start_date: '2020-03-10',
        status: 'Active' as const,
        prescriber: 'Dr. Michael Roberts',
      },
      {
        id: '4',
        name: 'Aspirin',
        dose: '81mg',
        route: 'PO',
        frequency: 'QD',
        start_date: '2020-03-10',
        status: 'Active' as const,
        prescriber: 'Dr. Michael Roberts',
      },
    ];

    if (status) {
      return medications.filter(m => m.status === status);
    }
    return medications;
  },

  async getProblems(mrn: string, status?: string): Promise<Problem[]> {
    await delay();
    const problems = [
      {
        id: '1',
        condition: 'Type 2 Diabetes Mellitus',
        icd10: 'E11.9',
        status: 'Chronic' as const,
        onset_date: '2018-01-15',
        diagnosed_by: 'Dr. Sarah Chen',
      },
      {
        id: '2',
        condition: 'Essential Hypertension',
        icd10: 'I10',
        status: 'Chronic' as const,
        onset_date: '2019-06-22',
        diagnosed_by: 'Dr. Sarah Chen',
      },
      {
        id: '3',
        condition: 'Hyperlipidemia',
        icd10: 'E78.5',
        status: 'Active' as const,
        onset_date: '2020-03-10',
        diagnosed_by: 'Dr. Michael Roberts',
      },
      {
        id: '4',
        condition: 'Chronic Kidney Disease, Stage 3',
        icd10: 'N18.3',
        status: 'Chronic' as const,
        onset_date: '2022-08-14',
        diagnosed_by: 'Dr. James Park',
      },
    ];

    if (status) {
      return problems.filter(p => p.status === status);
    }
    return problems;
  },

  async getVitals(mrn: string, hours: number = 24): Promise<Vital[]> {
    await delay();
    return [
      {
        name: 'Blood Pressure',
        current: '138/86',
        unit: 'mmHg',
        status: 'High',
        reference_range: '<120/80',
        data: [
          { timestamp: '08:00', value: 135 },
          { timestamp: '10:00', value: 138 },
          { timestamp: '12:00', value: 142 },
          { timestamp: '14:00', value: 138 },
          { timestamp: '16:00', value: 136 },
        ],
      },
      {
        name: 'Heart Rate',
        current: '76',
        unit: 'bpm',
        status: 'Normal',
        reference_range: '60-100',
        data: [
          { timestamp: '08:00', value: 74 },
          { timestamp: '10:00', value: 76 },
          { timestamp: '12:00', value: 78 },
          { timestamp: '14:00', value: 75 },
          { timestamp: '16:00', value: 76 },
        ],
      },
      {
        name: 'Temperature',
        current: '98.2',
        unit: '°F',
        status: 'Normal',
        reference_range: '97.0-99.0',
        data: [
          { timestamp: '08:00', value: 98.1 },
          { timestamp: '10:00', value: 98.2 },
          { timestamp: '12:00', value: 98.3 },
          { timestamp: '14:00', value: 98.2 },
          { timestamp: '16:00', value: 98.2 },
        ],
      },
      {
        name: 'SpO2',
        current: '97',
        unit: '%',
        status: 'Normal',
        reference_range: '>95',
        data: [
          { timestamp: '08:00', value: 98 },
          { timestamp: '10:00', value: 97 },
          { timestamp: '12:00', value: 98 },
          { timestamp: '14:00', value: 97 },
          { timestamp: '16:00', value: 97 },
        ],
      },
    ];
  },

  async getLabResults(
    mrn: string,
    fromDate?: string,
    toDate?: string
  ): Promise<LabResult[]> {
    await delay();
    return [
      {
        id: '1',
        test: 'Hemoglobin A1c',
        value: '7.2',
        unit: '%',
        reference_range: '<5.7',
        status: 'High',
        date: '2026-03-20',
      },
      {
        id: '2',
        test: 'Creatinine',
        value: '1.4',
        unit: 'mg/dL',
        reference_range: '0.6-1.2',
        status: 'High',
        date: '2026-03-20',
      },
      {
        id: '3',
        test: 'eGFR',
        value: '52',
        unit: 'mL/min/1.73m²',
        reference_range: '>60',
        status: 'Low',
        date: '2026-03-20',
      },
      {
        id: '4',
        test: 'Total Cholesterol',
        value: '198',
        unit: 'mg/dL',
        reference_range: '<200',
        status: 'Normal',
        date: '2026-03-20',
      },
      {
        id: '5',
        test: 'LDL Cholesterol',
        value: '118',
        unit: 'mg/dL',
        reference_range: '<100',
        status: 'High',
        date: '2026-03-20',
      },
      {
        id: '6',
        test: 'HDL Cholesterol',
        value: '52',
        unit: 'mg/dL',
        reference_range: '>40',
        status: 'Normal',
        date: '2026-03-20',
      },
    ];
  },
};
