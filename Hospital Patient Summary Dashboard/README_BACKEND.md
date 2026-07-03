# Patient Dashboard - Backend Integration

This patient dashboard is now fully configured for easy integration with Python FastAPI or Flask backends.

## 🚀 Quick Start

### Option 1: Use the Quick Start Script (Recommended)

```bash
python quickstart.py
```

This will:
- Install all Python dependencies
- Create your .env file
- Start the FastAPI backend on port 8000
- Start the React frontend on port 5173

### Option 2: Manual Setup

1. **Start the Backend:**
```bash
pip install fastapi uvicorn pydantic
python backend_example.py
```

2. **Configure Frontend:**
```bash
cp .env.example .env
# Edit .env and set VITE_USE_MOCK_DATA=false
```

3. **Start the Frontend:**
```bash
pnpm run dev
```

## 📁 Project Structure

```
├── src/
│   ├── types/
│   │   └── patient.types.ts          # TypeScript types matching backend models
│   ├── services/
│   │   ├── api.service.ts            # Real API client
│   │   ├── mock-data.service.ts      # Mock data for development
│   │   └── data.service.ts           # Unified service layer
│   └── app/
│       ├── App.tsx                    # Main app (now uses DataService)
│       └── components/                # UI components
├── backend_example.py                 # Complete FastAPI example
├── BACKEND_INTEGRATION.md             # Detailed integration guide
├── quickstart.py                      # Auto-start script
└── .env.example                       # Environment configuration
```

## 🔧 Configuration

Edit `.env` to configure:

```env
# Backend API URL
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Use mock data (true) or real API (false)
VITE_USE_MOCK_DATA=true
```

## 📖 Key Features

### Type-Safe API Integration
- All API endpoints have TypeScript types that match Python Pydantic models
- Snake_case (Python) automatically converts to camelCase (TypeScript)
- Full type safety from database to UI

### API Service Layer
- Centralized HTTP client in `api.service.ts`
- Automatic error handling and timeouts
- Easy to extend with new endpoints

### Development Mode
- Use mock data during development
- Switch to real API by changing environment variable
- No code changes needed

### Production Ready
- Proper error handling and loading states
- CORS configured
- RESTful endpoint design
- Follows ISO 27269 standards

## 🏥 API Endpoints

All endpoints follow the pattern: `/api/v1/patients/{mrn}/...`

- **Patient**: `/patients/{mrn}` - Basic patient info
- **Demographics**: `/patients/{mrn}/demographics` - Demographics & emergency contact
- **Allergies**: `/patients/{mrn}/allergies` - CRUD operations
- **Medications**: `/patients/{mrn}/medications` - Active medications
- **Problems**: `/patients/{mrn}/problems` - Conditions/diagnoses
- **Vitals**: `/patients/{mrn}/vitals` - Current + historical vitals
- **Labs**: `/patients/{mrn}/labs` - Lab results with reference ranges

See `BACKEND_INTEGRATION.md` for complete API documentation.

## 🔐 Security Considerations

Before deploying to production:

1. **Add Authentication**: Implement JWT or session-based auth
2. **Enable HTTPS**: Use TLS/SSL certificates
3. **Validate Input**: Backend validates all user input
4. **Rate Limiting**: Prevent API abuse
5. **HIPAA Compliance**: If handling real patient data
6. **Audit Logging**: Track all data access

See the security checklist in `BACKEND_INTEGRATION.md`.

## 🧪 Testing

The API includes:
- Interactive API docs at `http://localhost:8000/docs`
- Mock data for all endpoints
- Standardized response format

## 📚 Documentation

- `BACKEND_INTEGRATION.md` - Complete integration guide with FastAPI & Flask examples
- `backend_example.py` - Working FastAPI implementation
- `src/services/api.service.ts` - Frontend API client
- `src/types/patient.types.ts` - TypeScript interfaces

## 🔄 Switching from Mock to Real API

1. Start your backend: `python backend_example.py`
2. Update `.env`: Set `VITE_USE_MOCK_DATA=false`
3. Restart frontend: `pnpm run dev`

That's it! The frontend automatically uses the real API.

## 💡 Next Steps

1. **Database Setup**: Replace mock data with PostgreSQL/MySQL
2. **Add Authentication**: Secure endpoints with JWT
3. **Deploy Backend**: Host on AWS, GCP, or Azure
4. **Add Features**: Implement care plans, procedures, immunizations
5. **Testing**: Add unit and integration tests

For detailed implementation examples, see `BACKEND_INTEGRATION.md`.
