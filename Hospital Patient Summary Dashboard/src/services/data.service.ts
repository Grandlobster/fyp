/**
 * Data Service Adapter
 *
 * This module provides a unified interface that switches between
 * mock data and real API based on environment configuration.
 */

import { API } from './api.service';
import { MockDataService } from './mock-data.service';
import type {
  Patient,
  Demographics,
  Allergy,
  Medication,
  Problem,
  Vital,
  LabResult,
} from '../types/patient.types';

// Check if we should use mock data
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

/**
 * Unified data service that automatically uses mock or real API
 */
export const DataService = {
  async getPatient(mrn: string): Promise<Patient> {
    if (USE_MOCK_DATA) {
      return MockDataService.getPatient(mrn);
    }
    return API.Patient.getPatient(mrn);
  },

  async getDemographics(mrn: string): Promise<Demographics> {
    if (USE_MOCK_DATA) {
      return MockDataService.getDemographics(mrn);
    }
    return API.Patient.getDemographics(mrn);
  },

  async getAllergies(mrn: string): Promise<Allergy[]> {
    if (USE_MOCK_DATA) {
      return MockDataService.getAllergies(mrn);
    }
    return API.Allergy.getAllergies(mrn);
  },

  async getMedications(mrn: string, status?: string): Promise<Medication[]> {
    if (USE_MOCK_DATA) {
      return MockDataService.getMedications(mrn, status);
    }
    return API.Medication.getMedications(mrn, status);
  },

  async getProblems(mrn: string, status?: string): Promise<Problem[]> {
    if (USE_MOCK_DATA) {
      return MockDataService.getProblems(mrn, status);
    }
    return API.Problem.getProblems(mrn, status);
  },

  async getVitals(mrn: string, hours?: number): Promise<Vital[]> {
    if (USE_MOCK_DATA) {
      return MockDataService.getVitals(mrn, hours);
    }
    return API.Vitals.getVitals(mrn, hours);
  },

  async getLabResults(
    mrn: string,
    fromDate?: string,
    toDate?: string
  ): Promise<LabResult[]> {
    if (USE_MOCK_DATA) {
      return MockDataService.getLabResults(mrn, fromDate, toDate);
    }
    return API.LabResult.getLabResults(mrn, fromDate, toDate);
  },
};

/**
 * Adapter functions to convert between API snake_case and UI camelCase
 * These ensure frontend code uses JavaScript conventions
 */

export function adaptPatient(apiPatient: any): Patient {
  return {
    mrn: apiPatient.mrn,
    name: apiPatient.name,
    dob: apiPatient.dob,
    age: apiPatient.age,
    gender: apiPatient.gender,
    blood_type: apiPatient.blood_type,
  };
}

export function adaptAllergy(apiAllergy: any): Allergy {
  return {
    id: apiAllergy.id,
    substance: apiAllergy.substance,
    reaction: apiAllergy.reaction,
    severity: apiAllergy.severity,
    onset_date: apiAllergy.onset_date,
    verified_by: apiAllergy.verified_by,
    notes: apiAllergy.notes,
  };
}

export function adaptMedication(apiMedication: any): Medication {
  return {
    id: apiMedication.id,
    name: apiMedication.name,
    dose: apiMedication.dose,
    route: apiMedication.route,
    frequency: apiMedication.frequency,
    start_date: apiMedication.start_date,
    end_date: apiMedication.end_date,
    status: apiMedication.status,
    prescriber: apiMedication.prescriber,
    indication: apiMedication.indication,
  };
}

export function adaptProblem(apiProblem: any): Problem {
  return {
    id: apiProblem.id,
    condition: apiProblem.condition,
    icd10: apiProblem.icd10,
    status: apiProblem.status,
    onset_date: apiProblem.onset_date,
    resolved_date: apiProblem.resolved_date,
    diagnosed_by: apiProblem.diagnosed_by,
    notes: apiProblem.notes,
  };
}

export function adaptVital(apiVital: any): Vital {
  return {
    name: apiVital.name,
    current: apiVital.current,
    unit: apiVital.unit,
    status: apiVital.status,
    reference_range: apiVital.reference_range,
    data: apiVital.data || [],
  };
}

export function adaptLabResult(apiLabResult: any): LabResult {
  return {
    id: apiLabResult.id,
    test: apiLabResult.test,
    loinc_code: apiLabResult.loinc_code,
    value: apiLabResult.value,
    unit: apiLabResult.unit,
    reference_range: apiLabResult.reference_range,
    status: apiLabResult.status,
    date: apiLabResult.date,
    interpretation: apiLabResult.interpretation,
  };
}
