# Testing the Backend Integration

## Quick Integration Test

Follow these steps to verify the backend integration is working correctly.

## Test 1: Verify Files Exist

```bash
# Check all integration files are present
ls -l backend_example.py database_models.py database_schema.sql
ls -l src/services/api.service.ts src/services/data.service.ts
ls -l BACKEND_INTEGRATION.md README_BACKEND.md
```

Expected: All files should exist ✅

## Test 2: Test Mock Data (Development Mode)

```bash
# Verify .env is set for mock data
cat .env
# Should show: VITE_USE_MOCK_DATA=true

# Start frontend
pnpm run dev

# Open browser to http://localhost:5173
# Expected: Dashboard loads instantly with Maria Elena Johnson's data ✅
```

## Test 3: Start FastAPI Backend

```bash
# Terminal 1: Install dependencies
pip install fastapi uvicorn pydantic

# Start backend
python backend_example.py

# Expected output:
# INFO:     Started server process
# INFO:     Waiting for application startup.
# INFO:     Application startup complete.
# INFO:     Uvicorn running on http://0.0.0.0:8000
```

## Test 4: Test API Endpoints

```bash
# Open browser to http://localhost:8000/docs
# Expected: Interactive Swagger documentation ✅

# Test patient endpoint
curl http://localhost:8000/api/v1/patients/MRN-2024-789456

# Expected response:
{
  "success": true,
  "data": {
    "mrn": "MRN-2024-789456",
    "name": "Johnson, Maria Elena",
    "dob": "1965-03-14",
    "age": 61,
    "gender": "Female",
    "blood_type": "O+"
  },
  "timestamp": "2026-03-24T..."
}
```

## Test 5: Test All Endpoints

```bash
# Test allergies
curl http://localhost:8000/api/v1/patients/MRN-2024-789456/allergies

# Test medications
curl http://localhost:8000/api/v1/patients/MRN-2024-789456/medications

# Test problems
curl http://localhost:8000/api/v1/patients/MRN-2024-789456/problems

# Test vitals
curl http://localhost:8000/api/v1/patients/MRN-2024-789456/vitals

# Test labs
curl http://localhost:8000/api/v1/patients/MRN-2024-789456/labs

# All should return success: true ✅
```

## Test 6: Connect Frontend to Real API

```bash
# Terminal 1: Make sure backend is running
python backend_example.py

# Terminal 2: Update .env
echo "VITE_USE_MOCK_DATA=false" > .env
echo "VITE_API_BASE_URL=http://localhost:8000/api/v1" >> .env

# Terminal 3: Restart frontend
pnpm run dev

# Open browser to http://localhost:5173
# Expected: Dashboard now loads from real API ✅
# Check browser console - should see API requests to localhost:8000
```

## Test 7: Verify Type Safety

```bash
# Open src/app/App.tsx in your editor
# Try to access a non-existent field like patient.invalidField
# Expected: TypeScript error ✅

# The types in patient.types.ts match backend_example.py models
# This ensures type safety across the entire stack
```

## Test 8: Test Error Handling

```bash
# Stop the backend (Ctrl+C)

# Refresh the frontend
# Expected: Error message displayed with retry button ✅
```

## Test 9: Database Setup (Optional)

```bash
# Install PostgreSQL client
# Mac: brew install postgresql
# Ubuntu: sudo apt-get install postgresql-client

# Create database
psql -U postgres -c "CREATE DATABASE patient_dashboard;"

# Run schema
psql -U postgres -d patient_dashboard -f database_schema.sql

# Expected: All tables created with sample data ✅
```

## Test 10: Use Quick Start Script

```bash
# Run automated setup
python quickstart.py

# Expected:
# ✅ Python dependencies installed
# ✅ .env file created
# 🚀 Backend started on http://localhost:8000
# 🚀 Frontend started on http://localhost:5173
# Press Ctrl+C to stop all services
```

## Verification Checklist

- [ ] All files exist
- [ ] Mock data works in development mode
- [ ] FastAPI backend starts successfully
- [ ] API docs accessible at /docs
- [ ] All API endpoints return valid responses
- [ ] Frontend connects to real API
- [ ] TypeScript types work correctly
- [ ] Error handling works
- [ ] Database schema creates successfully
- [ ] Quick start script works

## Troubleshooting

### Issue: "Module not found: fastapi"
**Solution:**
```bash
pip install fastapi uvicorn pydantic
```

### Issue: "CORS error in browser"
**Solution:** Make sure backend is running and CORS is configured for http://localhost:5173

### Issue: "Cannot find module 'src/services/api.service'"
**Solution:** Check that all service files were created in src/services/

### Issue: "Port 8000 already in use"
**Solution:**
```bash
# Kill existing process
lsof -ti:8000 | xargs kill -9

# Or use different port
uvicorn backend_example:app --port 8001
```

### Issue: "Database connection failed"
**Solution:** Update DATABASE_URL in database_models.py with correct credentials

## Success Indicators

If you can complete all tests successfully, your integration is working perfectly! You now have:

✅ A type-safe connection between React and Python
✅ Mock data for rapid development
✅ Real API for production
✅ Complete database schema
✅ Interactive API documentation
✅ Error handling and loading states
✅ ISO 27269 compliant data structures

## Next Steps After Testing

1. Replace mock data with real database queries
2. Add JWT authentication
3. Implement audit logging
4. Add unit tests
5. Deploy to production

See `BACKEND_INTEGRATION.md` for detailed implementation guides.
