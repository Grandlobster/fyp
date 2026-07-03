/**
 * TypeScript types matching Python FastAPI/Flask backend models
 * These interfaces align with ISO 27269 standards for patient data
 */

export interface Patient {
  mrn: string;
  name: string;
  dob: string;
  age: number;
  gender: string;
  blood_type: string;
}

export interface Demographics {
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  marital_status: string;
  language: string;
  race: string;
  ethnicity: string;
  emergency_contact: EmergencyContact;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export type AllergySeverity = 'Critical' | 'High' | 'Moderate' | 'Low';

export interface Allergy {
  id: string;
  substance: string;
  reaction: string;
  severity: AllergySeverity;
  onset_date: string;
  verified_by: string;
  notes?: string;
}

export type MedicationStatus = 'Active' | 'Discontinued' | 'On Hold';

export interface Medication {
  id: string;
  name: string;
  dose: string;
  route: string;
  frequency: string;
  start_date: string;
  end_date?: string;
  status: MedicationStatus;
  prescriber: string;
  indication?: string;
}

export type ProblemStatus = 'Active' | 'Chronic' | 'Resolved' | 'Inactive';

export interface Problem {
  id: string;
  condition: string;
  icd10: string;
  status: ProblemStatus;
  onset_date: string;
  resolved_date?: string;
  diagnosed_by: string;
  notes?: string;
}

export type ProcedureStatus = 'Completed' | 'Scheduled' | 'Cancelled';

export interface Procedure {
  id: string;
  procedure: string;
  cpt_code: string;
  date: string;
  status: ProcedureStatus;
  provider: string;
  facility?: string;
  notes?: string;
}

export interface Immunization {
  id: string;
  vaccine: string;
  cvx_code: string;
  date: string;
  site: string;
  route: string;
  lot_number?: string;
  administrator: string;
}

export type VitalStatus = 'Critical' | 'High' | 'Normal' | 'Low';

export interface VitalDataPoint {
  timestamp: string;
  value: number;
}

export interface Vital {
  name: string;
  current: string;
  unit: string;
  status: VitalStatus;
  data: VitalDataPoint[];
  reference_range?: string;
}

export type LabResultStatus = 'Critical' | 'High' | 'Normal' | 'Low';

export interface LabResult {
  id: string;
  test: string;
  loinc_code?: string;
  value: string;
  unit: string;
  reference_range: string;
  status: LabResultStatus;
  date: string;
  interpretation?: string;
}

export interface CarePlanGoal {
  id: string;
  description: string;
  target_date: string;
  status: 'In Progress' | 'Achieved' | 'Not Achieved' | 'Cancelled';
}

export interface CarePlan {
  id: string;
  goals: CarePlanGoal[];
  interventions: string[];
  last_updated: string;
  updated_by: string;
}

export interface EmergencyInfo {
  advance_directive: boolean;
  code_status: string;
  organ_donor: boolean;
  primary_language: string;
  interpreter_needed: boolean;
  special_needs?: string;
}

/**
 * API Response wrappers
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: string;
  detail?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
