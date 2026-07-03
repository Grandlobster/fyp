# Backend Integration Guide - Patient Dashboard

This guide provides complete instructions for integrating this React frontend with a Python FastAPI or Flask backend.

## Overview

The frontend is designed with a clean separation of concerns:
- **Types**: TypeScript interfaces in `/src/types/patient.types.ts` map directly to Pydantic models
- **API Service**: Centralized HTTP client in `/src/services/api.service.ts` handles all backend communication
- **Components**: React components consume data through the API service layer

## Quick Start

### 1. Environment Setup

Create a `.env` file in your project root:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### 2. Install CORS Middleware (Backend)

**FastAPI:**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Flask:**
```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])
```

## API Endpoints Reference

All endpoints follow RESTful conventions with consistent response structures.

### Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "timestamp": "2026-03-24T10:30:00Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "detail": "Optional detailed error info",
  "timestamp": "2026-03-24T10:30:00Z"
}
```

### Endpoint List

#### Patient Information
- `GET /api/v1/patients/{mrn}` - Get patient basic info
- `GET /api/v1/patients/{mrn}/demographics` - Get demographics
- `PUT /api/v1/patients/{mrn}/demographics` - Update demographics

#### Allergies
- `GET /api/v1/patients/{mrn}/allergies` - List all allergies
- `POST /api/v1/patients/{mrn}/allergies` - Add new allergy
- `GET /api/v1/patients/{mrn}/allergies/{allergy_id}` - Get specific allergy
- `PUT /api/v1/patients/{mrn}/allergies/{allergy_id}` - Update allergy
- `DELETE /api/v1/patients/{mrn}/allergies/{allergy_id}` - Delete allergy

#### Medications
- `GET /api/v1/patients/{mrn}/medications?status=Active` - List medications
- `POST /api/v1/patients/{mrn}/medications` - Add medication
- `GET /api/v1/patients/{mrn}/medications/{medication_id}` - Get medication
- `PUT /api/v1/patients/{mrn}/medications/{medication_id}` - Update medication
- `DELETE /api/v1/patients/{mrn}/medications/{medication_id}` - Discontinue medication

#### Problems/Conditions
- `GET /api/v1/patients/{mrn}/problems?status=Active` - List problems
- `POST /api/v1/patients/{mrn}/problems` - Add problem
- `GET /api/v1/patients/{mrn}/problems/{problem_id}` - Get problem
- `PUT /api/v1/patients/{mrn}/problems/{problem_id}` - Update problem

#### Procedures
- `GET /api/v1/patients/{mrn}/procedures` - List procedures
- `POST /api/v1/patients/{mrn}/procedures` - Add procedure

#### Immunizations
- `GET /api/v1/patients/{mrn}/immunizations` - List immunizations
- `POST /api/v1/patients/{mrn}/immunizations` - Add immunization

#### Vitals
- `GET /api/v1/patients/{mrn}/vitals?hours=24` - Get vitals with history
- `POST /api/v1/patients/{mrn}/vitals` - Add vital reading

#### Lab Results
- `GET /api/v1/patients/{mrn}/labs?from_date=2026-01-01&to_date=2026-03-24` - List labs
- `GET /api/v1/patients/{mrn}/labs/{lab_id}` - Get specific lab result

#### Care Plan
- `GET /api/v1/patients/{mrn}/care-plan` - Get care plan
- `PUT /api/v1/patients/{mrn}/care-plan` - Update care plan

#### Emergency Info
- `GET /api/v1/patients/{mrn}/emergency-info` - Get emergency info
- `PUT /api/v1/patients/{mrn}/emergency-info` - Update emergency info

## FastAPI Implementation Example

### 1. Install Dependencies

```bash
pip install fastapi uvicorn pydantic sqlalchemy python-dotenv
```

### 2. Pydantic Models (`models.py`)

```python
from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime

class EmergencyContact(BaseModel):
    name: str
    relationship: str
    phone: str

class Patient(BaseModel):
    mrn: str
    name: str
    dob: str
    age: int
    gender: str
    blood_type: str

class Demographics(BaseModel):
    address: str
    city: str
    state: str
    zip: str
    phone: str
    email: str
    marital_status: str
    language: str
    race: str
    ethnicity: str
    emergency_contact: EmergencyContact

class Allergy(BaseModel):
    id: Optional[str] = None
    substance: str
    reaction: str
    severity: Literal['Critical', 'High', 'Moderate', 'Low']
    onset_date: str
    verified_by: str
    notes: Optional[str] = None

class Medication(BaseModel):
    id: Optional[str] = None
    name: str
    dose: str
    route: str
    frequency: str
    start_date: str
    end_date: Optional[str] = None
    status: Literal['Active', 'Discontinued', 'On Hold']
    prescriber: str
    indication: Optional[str] = None

class Problem(BaseModel):
    id: Optional[str] = None
    condition: str
    icd10: str
    status: Literal['Active', 'Chronic', 'Resolved', 'Inactive']
    onset_date: str
    resolved_date: Optional[str] = None
    diagnosed_by: str
    notes: Optional[str] = None

class VitalDataPoint(BaseModel):
    timestamp: str
    value: float

class Vital(BaseModel):
    name: str
    current: str
    unit: str
    status: Literal['Critical', 'High', 'Normal', 'Low']
    data: List[VitalDataPoint]
    reference_range: Optional[str] = None

class LabResult(BaseModel):
    id: Optional[str] = None
    test: str
    loinc_code: Optional[str] = None
    value: str
    unit: str
    reference_range: str
    status: Literal['Critical', 'High', 'Normal', 'Low']
    date: str
    interpretation: Optional[str] = None

class ApiResponse(BaseModel):
    success: bool = True
    data: any
    message: Optional[str] = None
    timestamp: str = datetime.utcnow().isoformat()
```

### 3. API Routes (`main.py`)

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import *
from datetime import datetime
import uuid

app = FastAPI(title="Patient Dashboard API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function for success responses
def success_response(data, message=None):
    return {
        "success": True,
        "data": data,
        "message": message,
        "timestamp": datetime.utcnow().isoformat()
    }

# Patient endpoints
@app.get("/api/v1/patients/{mrn}")
async def get_patient(mrn: str):
    # TODO: Query database for patient
    # Example mock response:
    patient = {
        "mrn": mrn,
        "name": "Johnson, Maria Elena",
        "dob": "1965-03-14",
        "age": 61,
        "gender": "Female",
        "blood_type": "O+"
    }
    return success_response(patient)

@app.get("/api/v1/patients/{mrn}/demographics")
async def get_demographics(mrn: str):
    # TODO: Query database for demographics
    demographics = {
        "address": "4582 Maple Avenue",
        "city": "Springfield",
        "state": "IL",
        "zip": "62704",
        "phone": "(217) 555-0198",
        "email": "maria.johnson@email.com",
        "marital_status": "Married",
        "language": "English",
        "race": "White",
        "ethnicity": "Hispanic/Latino",
        "emergency_contact": {
            "name": "Johnson, Robert",
            "relationship": "Spouse",
            "phone": "(217) 555-0199"
        }
    }
    return success_response(demographics)

@app.put("/api/v1/patients/{mrn}/demographics")
async def update_demographics(mrn: str, demographics: Demographics):
    # TODO: Update database
    return success_response(demographics.dict(), "Demographics updated successfully")

# Allergy endpoints
@app.get("/api/v1/patients/{mrn}/allergies")
async def get_allergies(mrn: str):
    # TODO: Query database for allergies
    allergies = [
        {
            "id": str(uuid.uuid4()),
            "substance": "Penicillin",
            "reaction": "Anaphylaxis",
            "severity": "Critical",
            "onset_date": "2003-05-12",
            "verified_by": "Dr. Sarah Chen"
        }
    ]
    return success_response(allergies)

@app.post("/api/v1/patients/{mrn}/allergies")
async def add_allergy(mrn: str, allergy: Allergy):
    # TODO: Insert into database
    allergy.id = str(uuid.uuid4())
    return success_response(allergy.dict(), "Allergy added successfully")

@app.get("/api/v1/patients/{mrn}/allergies/{allergy_id}")
async def get_allergy(mrn: str, allergy_id: str):
    # TODO: Query database
    allergy = {
        "id": allergy_id,
        "substance": "Penicillin",
        "reaction": "Anaphylaxis",
        "severity": "Critical",
        "onset_date": "2003-05-12",
        "verified_by": "Dr. Sarah Chen",
        "notes": "Patient has documented severe allergic reaction"
    }
    return success_response(allergy)

@app.put("/api/v1/patients/{mrn}/allergies/{allergy_id}")
async def update_allergy(mrn: str, allergy_id: str, allergy: Allergy):
    # TODO: Update database
    allergy.id = allergy_id
    return success_response(allergy.dict(), "Allergy updated successfully")

@app.delete("/api/v1/patients/{mrn}/allergies/{allergy_id}")
async def delete_allergy(mrn: str, allergy_id: str):
    # TODO: Delete from database
    return success_response(None, "Allergy deleted successfully")

# Medication endpoints
@app.get("/api/v1/patients/{mrn}/medications")
async def get_medications(mrn: str, status: Optional[str] = None):
    # TODO: Query database, filter by status if provided
    medications = [
        {
            "id": str(uuid.uuid4()),
            "name": "Metformin",
            "dose": "1000mg",
            "route": "PO",
            "frequency": "BID",
            "start_date": "2018-01-15",
            "status": "Active",
            "prescriber": "Dr. Sarah Chen"
        }
    ]
    return success_response(medications)

@app.post("/api/v1/patients/{mrn}/medications")
async def add_medication(mrn: str, medication: Medication):
    # TODO: Insert into database
    medication.id = str(uuid.uuid4())
    return success_response(medication.dict(), "Medication added successfully")

# Vitals endpoints
@app.get("/api/v1/patients/{mrn}/vitals")
async def get_vitals(mrn: str, hours: Optional[int] = 24):
    # TODO: Query database for vitals within time range
    vitals = [
        {
            "name": "Blood Pressure",
            "current": "138/86",
            "unit": "mmHg",
            "status": "High",
            "reference_range": "<120/80",
            "data": [
                {"timestamp": "08:00", "value": 135},
                {"timestamp": "10:00", "value": 138}
            ]
        }
    ]
    return success_response(vitals)

@app.post("/api/v1/patients/{mrn}/vitals")
async def add_vital_reading(mrn: str, vital: dict):
    # TODO: Insert vital reading into database
    return success_response(vital, "Vital reading recorded")

# Lab Results endpoints
@app.get("/api/v1/patients/{mrn}/labs")
async def get_lab_results(
    mrn: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
):
    # TODO: Query database with date filters
    labs = [
        {
            "id": str(uuid.uuid4()),
            "test": "Hemoglobin A1c",
            "value": "7.2",
            "unit": "%",
            "reference_range": "<5.7",
            "status": "High",
            "date": "2026-03-20"
        }
    ]
    return success_response(labs)

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return {
        "success": False,
        "error": exc.detail,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return {
        "success": False,
        "error": "Internal server error",
        "detail": str(exc),
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 4. Run the Backend

```bash
uvicorn main:app --reload
```

Visit `http://localhost:8000/docs` for interactive API documentation.

## Flask Implementation Example

### 1. Install Dependencies

```bash
pip install flask flask-cors
```

### 2. Flask App (`app.py`)

```python
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime
import uuid

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])

def success_response(data, message=None):
    return jsonify({
        "success": True,
        "data": data,
        "message": message,
        "timestamp": datetime.utcnow().isoformat()
    })

def error_response(error, detail=None, status_code=400):
    return jsonify({
        "success": False,
        "error": error,
        "detail": detail,
        "timestamp": datetime.utcnow().isoformat()
    }), status_code

@app.route('/api/v1/patients/<mrn>', methods=['GET'])
def get_patient(mrn):
    # TODO: Query database
    patient = {
        "mrn": mrn,
        "name": "Johnson, Maria Elena",
        "dob": "1965-03-14",
        "age": 61,
        "gender": "Female",
        "blood_type": "O+"
    }
    return success_response(patient)

@app.route('/api/v1/patients/<mrn>/allergies', methods=['GET'])
def get_allergies(mrn):
    # TODO: Query database
    allergies = [
        {
            "id": str(uuid.uuid4()),
            "substance": "Penicillin",
            "reaction": "Anaphylaxis",
            "severity": "Critical",
            "onset_date": "2003-05-12",
            "verified_by": "Dr. Sarah Chen"
        }
    ]
    return success_response(allergies)

@app.route('/api/v1/patients/<mrn>/allergies', methods=['POST'])
def add_allergy(mrn):
    data = request.get_json()
    # TODO: Validate and insert into database
    data['id'] = str(uuid.uuid4())
    return success_response(data, "Allergy added successfully")

# Add more routes following the same pattern...

@app.errorhandler(404)
def not_found(error):
    return error_response("Resource not found", status_code=404)

@app.errorhandler(500)
def internal_error(error):
    return error_response("Internal server error", str(error), status_code=500)

if __name__ == '__main__':
    app.run(debug=True, port=8000)
```

## Database Schema Recommendations

### PostgreSQL Schema Example

```sql
-- Patients table
CREATE TABLE patients (
    mrn VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    gender VARCHAR(20),
    blood_type VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Demographics table
CREATE TABLE demographics (
    mrn VARCHAR(50) PRIMARY KEY REFERENCES patients(mrn),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(2),
    zip VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    marital_status VARCHAR(50),
    language VARCHAR(50),
    race VARCHAR(100),
    ethnicity VARCHAR(100),
    emergency_contact_name VARCHAR(255),
    emergency_contact_relationship VARCHAR(100),
    emergency_contact_phone VARCHAR(20)
);

-- Allergies table
CREATE TABLE allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mrn VARCHAR(50) REFERENCES patients(mrn),
    substance VARCHAR(255) NOT NULL,
    reaction TEXT,
    severity VARCHAR(20) CHECK (severity IN ('Critical', 'High', 'Moderate', 'Low')),
    onset_date DATE,
    verified_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medications table
CREATE TABLE medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mrn VARCHAR(50) REFERENCES patients(mrn),
    name VARCHAR(255) NOT NULL,
    dose VARCHAR(50),
    route VARCHAR(20),
    frequency VARCHAR(50),
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) CHECK (status IN ('Active', 'Discontinued', 'On Hold')),
    prescriber VARCHAR(255),
    indication TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add more tables for problems, procedures, immunizations, vitals, labs, etc.
```

## Frontend Usage Example

### Update `App.tsx` to Use API Service

```typescript
import { useEffect, useState } from 'react';
import { API } from './services/api.service';
import type { Patient, Allergy, Medication } from './types/patient.types';

export default function App() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mrn = 'MRN-2024-789456'; // Get from route params or props

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [patientData, allergiesData] = await Promise.all([
          API.Patient.getPatient(mrn),
          API.Allergy.getAllergies(mrn),
        ]);
        setPatient(patientData);
        setAllergies(allergiesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [mrn]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!patient) return <div>Patient not found</div>;

  return (
    <div>
      <h1>{patient.name}</h1>
      {/* Render components with real data */}
    </div>
  );
}
```

## Authentication & Authorization

### Adding JWT Authentication

**Frontend (`api.service.ts`):**

```typescript
// Add to apiFetch function
const token = localStorage.getItem('access_token');
headers: {
  'Content-Type': 'application/json',
  ...(token && { 'Authorization': `Bearer ${token}` }),
  ...options.headers,
},
```

**Backend (FastAPI):**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    # TODO: Verify JWT token
    if not token_is_valid(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    return token

@app.get("/api/v1/patients/{mrn}", dependencies=[Depends(verify_token)])
async def get_patient(mrn: str):
    # ... implementation
```

## Testing

### Frontend Tests (`api.service.test.ts`)

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { API } from './api.service';

const server = setupServer(
  rest.get('http://localhost:8000/api/v1/patients/:mrn', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: {
        mrn: req.params.mrn,
        name: 'Test Patient',
        // ... more fields
      },
      timestamp: new Date().toISOString()
    }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Patient API', () => {
  it('should fetch patient data', async () => {
    const patient = await API.Patient.getPatient('MRN-123');
    expect(patient.mrn).toBe('MRN-123');
    expect(patient.name).toBe('Test Patient');
  });
});
```

## Performance Considerations

1. **Caching**: Implement response caching for frequently accessed data
2. **Pagination**: Use paginated responses for large datasets
3. **Rate Limiting**: Implement rate limiting on backend
4. **Connection Pooling**: Use database connection pooling
5. **Compression**: Enable gzip compression on backend

## Security Checklist

- [ ] Enable CORS with specific origins (not `*`)
- [ ] Implement JWT or session-based authentication
- [ ] Validate all input data on backend
- [ ] Use parameterized queries to prevent SQL injection
- [ ] Implement rate limiting
- [ ] Enable HTTPS in production
- [ ] Sanitize error messages (don't expose internal details)
- [ ] Implement audit logging for data access
- [ ] Follow HIPAA compliance requirements if applicable

## Next Steps

1. Set up PostgreSQL or MySQL database
2. Implement database models and migrations
3. Add authentication middleware
4. Implement comprehensive error handling
5. Add logging and monitoring
6. Write unit and integration tests
7. Deploy backend to production server
8. Configure production environment variables
