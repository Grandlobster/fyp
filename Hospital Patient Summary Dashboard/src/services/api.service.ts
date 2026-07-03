/**
 * API Service Layer for Python FastAPI/Flask Backend Integration
 *
 * This service handles all HTTP requests to the backend API.
 * Configure the API_BASE_URL in your environment variables.
 */

import type {
  Patient,
  Demographics,
  Allergy,
  Medication,
  Problem,
  Procedure,
  Immunization,
  Vital,
  LabResult,
  CarePlan,
  EmergencyInfo,
  ApiResponse,
  ApiError,
} from '../types/patient.types';

// Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const API_TIMEOUT = 10000; // 10 seconds

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}

/**
 * Patient API endpoints
 */
export const PatientAPI = {
  /**
   * GET /patients/{mrn}
   * Fetch patient basic information
   */
  getPatient: async (mrn: string): Promise<Patient> => {
    const response = await apiFetch<ApiResponse<Patient>>(`/patients/${mrn}`);
    return response.data;
  },

  /**
   * GET /patients/{mrn}/demographics
   * Fetch patient demographics
   */
  getDemographics: async (mrn: string): Promise<Demographics> => {
    const response = await apiFetch<ApiResponse<Demographics>>(
      `/patients/${mrn}/demographics`
    );
    return response.data;
  },

  /**
   * PUT /patients/{mrn}/demographics
   * Update patient demographics
   */
  updateDemographics: async (
    mrn: string,
    demographics: Partial<Demographics>
  ): Promise<Demographics> => {
    const response = await apiFetch<ApiResponse<Demographics>>(
      `/patients/${mrn}/demographics`,
      {
        method: 'PUT',
        body: JSON.stringify(demographics),
      }
    );
    return response.data;
  },
};

/**
 * Allergy API endpoints
 */
export const AllergyAPI = {
  /**
   * GET /patients/{mrn}/allergies
   * Fetch all allergies for a patient
   */
  getAllergies: async (mrn: string): Promise<Allergy[]> => {
    const response = await apiFetch<ApiResponse<Allergy[]>>(
      `/patients/${mrn}/allergies`
    );
    return response.data;
  },

  /**
   * POST /patients/{mrn}/allergies
   * Add a new allergy
   */
  addAllergy: async (mrn: string, allergy: Omit<Allergy, 'id'>): Promise<Allergy> => {
    const response = await apiFetch<ApiResponse<Allergy>>(
      `/patients/${mrn}/allergies`,
      {
        method: 'POST',
        body: JSON.stringify(allergy),
      }
    );
    return response.data;
  },

  /**
   * GET /patients/{mrn}/allergies/{allergy_id}
   * Fetch a specific allergy
   */
  getAllergy: async (mrn: string, allergyId: string): Promise<Allergy> => {
    const response = await apiFetch<ApiResponse<Allergy>>(
      `/patients/${mrn}/allergies/${allergyId}`
    );
    return response.data;
  },

  /**
   * PUT /patients/{mrn}/allergies/{allergy_id}
   * Update an allergy
   */
  updateAllergy: async (
    mrn: string,
    allergyId: string,
    allergy: Partial<Allergy>
  ): Promise<Allergy> => {
    const response = await apiFetch<ApiResponse<Allergy>>(
      `/patients/${mrn}/allergies/${allergyId}`,
      {
        method: 'PUT',
        body: JSON.stringify(allergy),
      }
    );
    return response.data;
  },

  /**
   * DELETE /patients/{mrn}/allergies/{allergy_id}
   * Delete an allergy
   */
  deleteAllergy: async (mrn: string, allergyId: string): Promise<void> => {
    await apiFetch(`/patients/${mrn}/allergies/${allergyId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Medication API endpoints
 */
export const MedicationAPI = {
  /**
   * GET /patients/{mrn}/medications
   * Fetch all medications for a patient
   */
  getMedications: async (mrn: string, status?: string): Promise<Medication[]> => {
    const queryParams = status ? `?status=${status}` : '';
    const response = await apiFetch<ApiResponse<Medication[]>>(
      `/patients/${mrn}/medications${queryParams}`
    );
    return response.data;
  },

  /**
   * POST /patients/{mrn}/medications
   * Add a new medication
   */
  addMedication: async (
    mrn: string,
    medication: Omit<Medication, 'id'>
  ): Promise<Medication> => {
    const response = await apiFetch<ApiResponse<Medication>>(
      `/patients/${mrn}/medications`,
      {
        method: 'POST',
        body: JSON.stringify(medication),
      }
    );
    return response.data;
  },

  /**
   * GET /patients/{mrn}/medications/{medication_id}
   * Fetch a specific medication
   */
  getMedication: async (mrn: string, medicationId: string): Promise<Medication> => {
    const response = await apiFetch<ApiResponse<Medication>>(
      `/patients/${mrn}/medications/${medicationId}`
    );
    return response.data;
  },

  /**
   * PUT /patients/{mrn}/medications/{medication_id}
   * Update a medication
   */
  updateMedication: async (
    mrn: string,
    medicationId: string,
    medication: Partial<Medication>
  ): Promise<Medication> => {
    const response = await apiFetch<ApiResponse<Medication>>(
      `/patients/${mrn}/medications/${medicationId}`,
      {
        method: 'PUT',
        body: JSON.stringify(medication),
      }
    );
    return response.data;
  },

  /**
   * DELETE /patients/{mrn}/medications/{medication_id}
   * Discontinue a medication
   */
  deleteMedication: async (mrn: string, medicationId: string): Promise<void> => {
    await apiFetch(`/patients/${mrn}/medications/${medicationId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Problem/Condition API endpoints
 */
export const ProblemAPI = {
  /**
   * GET /patients/{mrn}/problems
   * Fetch all problems for a patient
   */
  getProblems: async (mrn: string, status?: string): Promise<Problem[]> => {
    const queryParams = status ? `?status=${status}` : '';
    const response = await apiFetch<ApiResponse<Problem[]>>(
      `/patients/${mrn}/problems${queryParams}`
    );
    return response.data;
  },

  /**
   * POST /patients/{mrn}/problems
   * Add a new problem
   */
  addProblem: async (mrn: string, problem: Omit<Problem, 'id'>): Promise<Problem> => {
    const response = await apiFetch<ApiResponse<Problem>>(
      `/patients/${mrn}/problems`,
      {
        method: 'POST',
        body: JSON.stringify(problem),
      }
    );
    return response.data;
  },

  /**
   * GET /patients/{mrn}/problems/{problem_id}
   * Fetch a specific problem
   */
  getProblem: async (mrn: string, problemId: string): Promise<Problem> => {
    const response = await apiFetch<ApiResponse<Problem>>(
      `/patients/${mrn}/problems/${problemId}`
    );
    return response.data;
  },

  /**
   * PUT /patients/{mrn}/problems/{problem_id}
   * Update a problem
   */
  updateProblem: async (
    mrn: string,
    problemId: string,
    problem: Partial<Problem>
  ): Promise<Problem> => {
    const response = await apiFetch<ApiResponse<Problem>>(
      `/patients/${mrn}/problems/${problemId}`,
      {
        method: 'PUT',
        body: JSON.stringify(problem),
      }
    );
    return response.data;
  },
};

/**
 * Procedure API endpoints
 */
export const ProcedureAPI = {
  /**
   * GET /patients/{mrn}/procedures
   * Fetch all procedures for a patient
   */
  getProcedures: async (mrn: string): Promise<Procedure[]> => {
    const response = await apiFetch<ApiResponse<Procedure[]>>(
      `/patients/${mrn}/procedures`
    );
    return response.data;
  },

  /**
   * POST /patients/{mrn}/procedures
   * Add a new procedure
   */
  addProcedure: async (
    mrn: string,
    procedure: Omit<Procedure, 'id'>
  ): Promise<Procedure> => {
    const response = await apiFetch<ApiResponse<Procedure>>(
      `/patients/${mrn}/procedures`,
      {
        method: 'POST',
        body: JSON.stringify(procedure),
      }
    );
    return response.data;
  },
};

/**
 * Immunization API endpoints
 */
export const ImmunizationAPI = {
  /**
   * GET /patients/{mrn}/immunizations
   * Fetch all immunizations for a patient
   */
  getImmunizations: async (mrn: string): Promise<Immunization[]> => {
    const response = await apiFetch<ApiResponse<Immunization[]>>(
      `/patients/${mrn}/immunizations`
    );
    return response.data;
  },

  /**
   * POST /patients/{mrn}/immunizations
   * Add a new immunization
   */
  addImmunization: async (
    mrn: string,
    immunization: Omit<Immunization, 'id'>
  ): Promise<Immunization> => {
    const response = await apiFetch<ApiResponse<Immunization>>(
      `/patients/${mrn}/immunizations`,
      {
        method: 'POST',
        body: JSON.stringify(immunization),
      }
    );
    return response.data;
  },
};

/**
 * Vitals API endpoints
 */
export const VitalsAPI = {
  /**
   * GET /patients/{mrn}/vitals
   * Fetch current vitals with historical data
   */
  getVitals: async (mrn: string, hours?: number): Promise<Vital[]> => {
    const queryParams = hours ? `?hours=${hours}` : '';
    const response = await apiFetch<ApiResponse<Vital[]>>(
      `/patients/${mrn}/vitals${queryParams}`
    );
    return response.data;
  },

  /**
   * POST /patients/{mrn}/vitals
   * Add a new vital reading
   */
  addVitalReading: async (
    mrn: string,
    vital: { name: string; value: number; timestamp: string }
  ): Promise<void> => {
    await apiFetch(`/patients/${mrn}/vitals`, {
      method: 'POST',
      body: JSON.stringify(vital),
    });
  },
};

/**
 * Lab Results API endpoints
 */
export const LabResultAPI = {
  /**
   * GET /patients/{mrn}/labs
   * Fetch lab results for a patient
   */
  getLabResults: async (
    mrn: string,
    fromDate?: string,
    toDate?: string
  ): Promise<LabResult[]> => {
    const params = new URLSearchParams();
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const response = await apiFetch<ApiResponse<LabResult[]>>(
      `/patients/${mrn}/labs${queryString}`
    );
    return response.data;
  },

  /**
   * GET /patients/{mrn}/labs/{lab_id}
   * Fetch a specific lab result
   */
  getLabResult: async (mrn: string, labId: string): Promise<LabResult> => {
    const response = await apiFetch<ApiResponse<LabResult>>(
      `/patients/${mrn}/labs/${labId}`
    );
    return response.data;
  },
};

/**
 * Care Plan API endpoints
 */
export const CarePlanAPI = {
  /**
   * GET /patients/{mrn}/care-plan
   * Fetch care plan for a patient
   */
  getCarePlan: async (mrn: string): Promise<CarePlan> => {
    const response = await apiFetch<ApiResponse<CarePlan>>(
      `/patients/${mrn}/care-plan`
    );
    return response.data;
  },

  /**
   * PUT /patients/{mrn}/care-plan
   * Update care plan
   */
  updateCarePlan: async (mrn: string, carePlan: Partial<CarePlan>): Promise<CarePlan> => {
    const response = await apiFetch<ApiResponse<CarePlan>>(
      `/patients/${mrn}/care-plan`,
      {
        method: 'PUT',
        body: JSON.stringify(carePlan),
      }
    );
    return response.data;
  },
};

/**
 * Emergency Info API endpoints
 */
export const EmergencyInfoAPI = {
  /**
   * GET /patients/{mrn}/emergency-info
   * Fetch emergency information
   */
  getEmergencyInfo: async (mrn: string): Promise<EmergencyInfo> => {
    const response = await apiFetch<ApiResponse<EmergencyInfo>>(
      `/patients/${mrn}/emergency-info`
    );
    return response.data;
  },

  /**
   * PUT /patients/{mrn}/emergency-info
   * Update emergency information
   */
  updateEmergencyInfo: async (
    mrn: string,
    info: Partial<EmergencyInfo>
  ): Promise<EmergencyInfo> => {
    const response = await apiFetch<ApiResponse<EmergencyInfo>>(
      `/patients/${mrn}/emergency-info`,
      {
        method: 'PUT',
        body: JSON.stringify(info),
      }
    );
    return response.data;
  },
};

/**
 * Export all API services
 */
export const API = {
  Patient: PatientAPI,
  Allergy: AllergyAPI,
  Medication: MedicationAPI,
  Problem: ProblemAPI,
  Procedure: ProcedureAPI,
  Immunization: ImmunizationAPI,
  Vitals: VitalsAPI,
  LabResult: LabResultAPI,
  CarePlan: CarePlanAPI,
  EmergencyInfo: EmergencyInfoAPI,
};
