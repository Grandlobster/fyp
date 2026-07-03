import express from 'express';
import { MongoClient } from 'mongodb';
import nodemailer from 'nodemailer';
import cors from 'cors';
import crypto from 'crypto';

const app = express();

app.use(express.json({
  verify: (req, res, buf) => {
    console.log("RAW BODY:", buf.toString());
  }
}));
app.use(cors());
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
console.log("Mongo URI =", MONGODB_URI);
const DB_NAME = 'central_server';

// Gmail credentials — paste yours in .env or set as environment variables
const EMAIL_ADDRESS = 'aadeshlawande22@gmail.com';
const EMAIL_APP_PASSWORD = 'rmrsbjmyqbswlfav';

// In-memory OTP store: { email: { otp, expires } }
const otpStore = new Map();

let mongoClient;
async function getDb() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const result = await mongoClient.db("central_server").command({ ping: 1 });
    console.log("Ping:", result);

    const admin = mongoClient.db("admin").admin();
    console.log("Server info:");
    console.log(await admin.serverStatus().then(s => ({
        host: s.host,
        process: s.process,
        version: s.version
    })));

    console.log("===== DATABASES =====");
    console.log(await admin.listDatabases());

    console.log("===== DEFAULT DB =====");
    console.log(mongoClient.db().databaseName);

    console.log("===== CENTRAL SERVER COLLECTIONS =====");
    console.log(await mongoClient.db("central_server").listCollections().toArray());
  }
  return mongoClient.db(DB_NAME);
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const body = req.body || {};

    console.log("Headers:", req.headers);
    console.log("Body:", body);

    const { username, password } = body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const db = await getDb();
    console.log("Database Name:", db.databaseName);

    const collections = await db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));
    const doctor = await db.collection('doctors').findOne({ username });
    console.log("Doctor found:", doctor);

    if (!doctor) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordHash = sha256(password);
    console.log("SHA:",passwordHash);

    console.log("Username:", username);
    console.log("Password entered:", JSON.stringify(password));
    console.log("Computed hash :", passwordHash);
    console.log("Stored hash   :", doctor.password_hash);

    if (doctor.password_hash !== passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      success: true,
      doctor: {
        doctor_id: doctor.doctor_id,
        name: doctor.name,
        username: doctor.username,
        hospital_id: doctor.hospital_id,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/otp/send
app.post('/api/otp/send', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const otp = generateOtp();
    const expires = Date.now() + 5 * 60 * 1000;
    otpStore.set(email, { otp, expires });

    if (!EMAIL_ADDRESS || !EMAIL_APP_PASSWORD) {
      // Dev mode: log OTP to console and return it in response
      console.log(`[DEV MODE] OTP for ${email}: ${otp}`);
      return res.json({ success: true, dev_otp: otp });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: EMAIL_ADDRESS, pass: EMAIL_APP_PASSWORD },
    });

    const body = `
      <html>
      <body style="font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
          <h2 style="color: white; text-align: center;">OTP Verification</h2>
          <div style="background: white; padding: 30px; border-radius: 8px; margin-top: 20px;">
            <p style="font-size: 16px; color: #333;">Your One-Time Password (OTP):</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px;">${otp}</span>
            </div>
            <p style="color: #666; font-size: 14px;">Valid for 5 minutes. Quantum-Secured</p>
          </div>
        </div>
      </body>
      </html>`;

    await transporter.sendMail({
      from: EMAIL_ADDRESS,
      to: email,
      subject: 'QKD Medical Portal - OTP Verification',
      html: body,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('OTP send error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/otp/verify
app.post('/api/otp/verify', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

  const record = otpStore.get(email);
  if (!record) return res.status(400).json({ error: 'No OTP found for this email' });

  if (Date.now() > record.expires) {
    otpStore.delete(email);
    return res.status(400).json({ error: 'OTP expired' });
  }

  if (record.otp !== String(otp)) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  otpStore.delete(email);
  res.json({ success: true });
});

// GET /api/patient/:abhaAddress — proxy to ABDM Wrapper
app.get('/api/patient/:abhaAddress', async (req, res) => {
  try {
    const { abhaAddress } = req.params;
    console.log("================================");
    console.log("ABHA received:", abhaAddress);
    console.log("HIP ID:", req.query.hipId);
    console.log("================================");
    const hipId = req.query.hipId || 'my-hip';
    const url = `http://localhost:8082/v3/patient/${abhaAddress}?hipId=${hipId}`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: `ABDM Wrapper returned ${response.status}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('ABDM proxy error:', err);
    res.status(502).json({ error: 'Could not reach ABDM Wrapper at localhost:8082' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`QKD Medical Backend running on http://localhost:${PORT}`);
});

// =============================================================================
// PQC gRPC FILE GATEWAY — integration layer
// Adds two REST endpoints the browser can call; all gRPC + decryption happens
// here on the server. The session_key NEVER leaves this process.
// =============================================================================

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Load the proto and create a gRPC client pointed at the Rust node
// ---------------------------------------------------------------------------
const PROTO_PATH  = path.join(__dirname, 'file_gateway.proto');
const GRPC_TARGET = '127.0.0.1:50061';

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDesc   = grpc.loadPackageDefinition(packageDef);
const GatewayStub = protoDesc.pqc.gateway.v1.SecureFileGateway;

function createGrpcClient() {
  return new GatewayStub(GRPC_TARGET, grpc.credentials.createInsecure());
}

// ---------------------------------------------------------------------------
// In-process session store  { transferId -> { sessionKey: Buffer, status, detail } }
// Keys are kept in server memory only — never serialised, never sent to client.
// ---------------------------------------------------------------------------
const sessionStore = new Map();

// ---------------------------------------------------------------------------
// Helper: promisify the unary RequestSecureFile call
// ---------------------------------------------------------------------------
function requestSecureFileRpc(client, request) {
  return new Promise((resolve, reject) => {
    client.RequestSecureFile(request, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });
}

// ---------------------------------------------------------------------------
// POST /api/files/request
//
// Body (JSON) — map these directly from the ABDM CareContext JSON your
// frontend already has:
//   abha_address, care_context_reference, study_uid, hospital_id,
//   pacs_endpoint, kme_endpoint, qkd_node_id
//
// Response (JSON):
//   { transfer_id, status, detail }
//   — session_key is stored server-side only, NOT returned.
// ---------------------------------------------------------------------------
app.post('/api/files/request', async (req, res) => {
  const {
    abha_address,
    care_context_reference,
    study_uid,
    hospital_id,
    pacs_endpoint,
    kme_endpoint,
    qkd_node_id,
  } = req.body || {};

  // Basic input validation
  if (!abha_address || !care_context_reference || !study_uid || !hospital_id) {
    return res.status(400).json({
      error: 'Missing required fields: abha_address, care_context_reference, study_uid, hospital_id',
    });
  }

  const client = createGrpcClient();

  try {
    const handle = await requestSecureFileRpc(client, {
      abha_address,
      care_context_reference,
      study_uid,
      hospital_id,
      pacs_endpoint:  pacs_endpoint  || '',
      kme_endpoint:   kme_endpoint   || '',
      qkd_node_id:    qkd_node_id    || '',
    });

    console.log('[files/request] gRPC handle:', {
      transfer_id: handle.transfer_id,
      status: handle.status,
      detail: handle.detail || '',
      signer_key_id: handle.signer_key_id || null,
    });

    if (handle.status !== 'READY') {
      // Propagate PENDING / FAILED without storing a bad key
      return res.status(502).json({
        error:  `Transfer not READY: ${handle.status}`,
        detail: handle.detail || '',
      });
    }

    // session_key arrives as bytes (Buffer) — store it; never send it out
    const sessionKey = Buffer.isBuffer(handle.session_key)
      ? handle.session_key
      : Buffer.from(handle.session_key);   // handles base64 string fallback

    sessionStore.set(handle.transfer_id, {
      sessionKey,
      status: handle.status,
      detail: handle.detail,
    });

    // Return only what the browser needs to kick off step 2
    return res.json({
      transfer_id: handle.transfer_id,
      status:      handle.status,
      detail:      handle.detail || '',
      // mlkem_public_key and signer_key_id are informational; include if
      // the UI ever wants to display them, as hex strings (not the raw key)
      mlkem_public_key_hex: handle.mlkem_public_key
        ? Buffer.from(handle.mlkem_public_key).toString('hex')
        : null,
      signer_key_id: handle.signer_key_id || null,
    });
  } catch (err) {
    console.error('[files/request] gRPC error:', err);
    return res.status(502).json({ error: 'gRPC call to pqc_transport_node failed', detail: err.message });
  } finally {
    client.close();
  }
});

// ---------------------------------------------------------------------------
// GET /api/files/stream/:transferId
//
// Decrypts every chunk server-side (AES-256-GCM), reassembles in sequence
// order, and pipes the plaintext binary stream to the browser.
//
// The Content-Type is set to application/octet-stream; the browser (or your
// React component) should use the URL as an href / window.open() target so
// the browser's native file-save dialog handles it.
//
// Optional query param: ?filename=myfile.dcm  — forwarded as
// Content-Disposition so the browser suggests that filename when saving.
//
// NOTE: Signature verification is NOT implemented (see README section below).
// ---------------------------------------------------------------------------
app.get('/api/files/stream/:transferId', async (req, res) => {
  const { transferId } = req.params;
  const filename       = req.query.filename || `transfer_${transferId}.bin`;

  const session = sessionStore.get(transferId);
  if (!session) {
    return res.status(404).json({ error: 'Unknown transfer_id. Call /api/files/request first.' });
  }

  const { sessionKey } = session;

  const client = createGrpcClient();

  // Set response headers before streaming starts
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('X-Transfer-Id', transferId);

  // We collect chunks keyed by sequence number so we can emit in order
  // even if gRPC delivers them slightly out-of-order (rare but possible).
  const chunkBuffer = new Map(); // sequence -> plaintext Buffer
  let expectedSeq   = 0;
  let streamEnded   = false;
  let grpcError     = null;

  // Flush in-order chunks to the response stream
  function flushInOrder() {
    while (chunkBuffer.has(expectedSeq)) {
      const plain = chunkBuffer.get(expectedSeq);
      chunkBuffer.delete(expectedSeq);
      res.write(plain);
      expectedSeq++;
    }
    if (streamEnded && chunkBuffer.size === 0) {
      res.end();
      sessionStore.delete(transferId); // clean up — key no longer needed
    }
  }

  const call = client.StreamEncryptedFile({ transfer_id: transferId });

  call.on('data', (chunk) => {
    const { ciphertext, nonce, sequence, is_final } = chunk;

    const ct    = Buffer.isBuffer(ciphertext) ? ciphertext : Buffer.from(ciphertext);
    const iv    = Buffer.isBuffer(nonce)      ? nonce      : Buffer.from(nonce);

    // AES-256-GCM: last 16 bytes of ciphertext are the auth tag
    if (ct.length < 16) {
      console.error(`[files/stream] chunk ${sequence} too short (${ct.length} bytes), skipping`);
      return;
    }

    const authTag    = ct.slice(ct.length - 16);
    const cipherOnly = ct.slice(0, ct.length - 16);

    let plaintext;
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey, iv);
      decipher.setAuthTag(authTag);
      plaintext = Buffer.concat([decipher.update(cipherOnly), decipher.final()]);
    } catch (decErr) {
      console.error(`[files/stream] AES-GCM auth failed on chunk ${sequence}:`, decErr.message);
      // Abort the stream — auth failure means data is corrupt or tampered
      if (!res.headersSent) {
        res.status(500).json({ error: 'AES-GCM authentication failed', sequence });
      } else {
        res.destroy();
      }
      call.cancel();
      client.close();
      return;
    }

    chunkBuffer.set(sequence, plaintext);
    if (is_final) streamEnded = true;
    flushInOrder();
  });

  call.on('error', (err) => {
    grpcError = err;
    console.error('[files/stream] gRPC stream error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'gRPC stream failed', detail: err.message });
    } else {
      res.destroy(); // headers already sent, hard-close the socket
    }
    client.close();
  });

  call.on('end', () => {
    if (!grpcError) {
      streamEnded = true;
      flushInOrder();
    }
    client.close();
  });
});

// NOTE: Signature verification skipped — see README in output files.

// =============================================================================
// CLINICAL DATA API — /api/v1/patients/:mrn/*
// Matches the exact shape api.service.ts expects (ApiResponse<T> wrapper).
// Data is seeded here; swap the in-memory objects for real DB queries later.
// =============================================================================

function apiOk(res, data) {
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// In-memory patient store — one patient, keyed by MRN.
// Replace with MongoDB queries when you have a real clinical DB.
// ---------------------------------------------------------------------------
const PATIENTS = {
  'MRN-2024-789456': {
    patient: {
      mrn: 'MRN-2024-789456',
      name: 'Johnson, Maria Elena',
      dob: '1965-03-14',
      age: 61,
      gender: 'Female',
      blood_type: 'O+',
    },
    demographics: {
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
    },
    allergies: [
      { id: '1', substance: 'Penicillin', reaction: 'Anaphylaxis', severity: 'Critical', onset_date: '2003-05-12', verified_by: 'Dr. Sarah Chen' },
      { id: '2', substance: 'Sulfa drugs (Sulfonamides)', reaction: 'Stevens-Johnson syndrome', severity: 'Critical', onset_date: '2008-11-28', verified_by: 'Dr. Michael Roberts' },
      { id: '3', substance: 'Latex', reaction: 'Contact dermatitis, urticaria', severity: 'Moderate', onset_date: '2015-02-03', verified_by: 'Dr. Sarah Chen' },
    ],
    medications: [
      { id: '1', name: 'Metformin',    dose: '1000mg', route: 'PO', frequency: 'BID', start_date: '2018-01-15', status: 'Active', prescriber: 'Dr. Sarah Chen' },
      { id: '2', name: 'Lisinopril',   dose: '20mg',   route: 'PO', frequency: 'QD',  start_date: '2019-06-22', status: 'Active', prescriber: 'Dr. Sarah Chen' },
      { id: '3', name: 'Atorvastatin', dose: '40mg',   route: 'PO', frequency: 'QHS', start_date: '2020-03-10', status: 'Active', prescriber: 'Dr. Michael Roberts' },
      { id: '4', name: 'Aspirin',      dose: '81mg',   route: 'PO', frequency: 'QD',  start_date: '2020-03-10', status: 'Active', prescriber: 'Dr. Michael Roberts' },
    ],
    problems: [
      { id: '1', condition: 'Type 2 Diabetes Mellitus',    icd10: 'E11.9', status: 'Chronic', onset_date: '2018-01-15', diagnosed_by: 'Dr. Sarah Chen' },
      { id: '2', condition: 'Essential Hypertension',       icd10: 'I10',   status: 'Chronic', onset_date: '2019-06-22', diagnosed_by: 'Dr. Sarah Chen' },
      { id: '3', condition: 'Hyperlipidemia',               icd10: 'E78.5', status: 'Active',  onset_date: '2020-03-10', diagnosed_by: 'Dr. Michael Roberts' },
      { id: '4', condition: 'Chronic Kidney Disease, Stage 3', icd10: 'N18.3', status: 'Chronic', onset_date: '2022-08-14', diagnosed_by: 'Dr. James Park' },
    ],
    vitals: [
      {
        name: 'Blood Pressure', current: '138/86', unit: 'mmHg', status: 'High', reference_range: '<120/80',
        data: [{ timestamp: '08:00', value: 135 }, { timestamp: '10:00', value: 138 }, { timestamp: '12:00', value: 142 }, { timestamp: '14:00', value: 138 }, { timestamp: '16:00', value: 136 }],
      },
      {
        name: 'Heart Rate', current: '76', unit: 'bpm', status: 'Normal', reference_range: '60-100',
        data: [{ timestamp: '08:00', value: 74 }, { timestamp: '10:00', value: 76 }, { timestamp: '12:00', value: 78 }, { timestamp: '14:00', value: 75 }, { timestamp: '16:00', value: 76 }],
      },
      {
        name: 'Temperature', current: '98.2', unit: '°F', status: 'Normal', reference_range: '97.0-99.0',
        data: [{ timestamp: '08:00', value: 98.1 }, { timestamp: '10:00', value: 98.2 }, { timestamp: '12:00', value: 98.3 }, { timestamp: '14:00', value: 98.2 }, { timestamp: '16:00', value: 98.2 }],
      },
      {
        name: 'SpO2', current: '97', unit: '%', status: 'Normal', reference_range: '>95',
        data: [{ timestamp: '08:00', value: 98 }, { timestamp: '10:00', value: 97 }, { timestamp: '12:00', value: 98 }, { timestamp: '14:00', value: 97 }, { timestamp: '16:00', value: 97 }],
      },
    ],
    labs: [
      { id: '1', test: 'Hemoglobin A1c',    value: '7.2',  unit: '%',              reference_range: '<5.7',   status: 'High',   date: '2026-03-20' },
      { id: '2', test: 'Creatinine',         value: '1.4',  unit: 'mg/dL',          reference_range: '0.6-1.2', status: 'High',   date: '2026-03-20' },
      { id: '3', test: 'eGFR',               value: '52',   unit: 'mL/min/1.73m²', reference_range: '>60',    status: 'Low',    date: '2026-03-20' },
      { id: '4', test: 'Total Cholesterol',  value: '198',  unit: 'mg/dL',          reference_range: '<200',   status: 'Normal', date: '2026-03-20' },
      { id: '5', test: 'LDL Cholesterol',    value: '118',  unit: 'mg/dL',          reference_range: '<100',   status: 'High',   date: '2026-03-20' },
      { id: '6', test: 'HDL Cholesterol',    value: '52',   unit: 'mg/dL',          reference_range: '>40',    status: 'Normal', date: '2026-03-20' },
    ],
  },
};

function getPatientOr404(req, res) {
  const record = PATIENTS[req.params.mrn];
  if (!record) {
    res.status(404).json({ success: false, error: `Patient ${req.params.mrn} not found`, timestamp: new Date().toISOString() });
    return null;
  }
  return record;
}

// GET /api/v1/patients/:mrn
app.get('/api/v1/patients/:mrn', (req, res) => {
  const r = getPatientOr404(req, res); if (!r) return;
  apiOk(res, r.patient);
});

// GET /api/v1/patients/:mrn/demographics
app.get('/api/v1/patients/:mrn/demographics', (req, res) => {
  const r = getPatientOr404(req, res); if (!r) return;
  apiOk(res, r.demographics);
});

// GET /api/v1/patients/:mrn/allergies
app.get('/api/v1/patients/:mrn/allergies', (req, res) => {
  const r = getPatientOr404(req, res); if (!r) return;
  apiOk(res, r.allergies);
});

// GET /api/v1/patients/:mrn/allergies/:id
app.get('/api/v1/patients/:mrn/allergies/:id', (req, res) => {
  const r = getPatientOr404(req, res); if (!r) return;
  const item = r.allergies.find(a => a.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, error: 'Allergy not found', timestamp: new Date().toISOString() });
  apiOk(res, item);
});

// GET /api/v1/patients/:mrn/medications
app.get('/api/v1/patients/:mrn/medications', (req, res) => {
  const r = getPatientOr404(req, res); if (!r) return;
  const { status } = req.query;
  const data = status ? r.medications.filter(m => m.status === status) : r.medications;
  apiOk(res, data);
});

// GET /api/v1/patients/:mrn/medications/:id
app.get('/api/v1/patients/:mrn/medications/:id', (req, res) => {
  const r = getPatientOr404(req, res); if (!r) return;
  const item = r.medications.find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, error: 'Medication not found', timestamp: new Date().toISOString() });
  apiOk(res, item);
});

// GET /api/v1/patients/:mrn/problems
app.get('/api/v1/patients/:mrn/problems', (req, res) => {
  const r = getPatientOr404(req, res); if (!r) return;
  const { status } = req.query;
  const data = status ? r.problems.filter(p => p.status === status) : r.problems;
  apiOk(res, data);
});

// GET /api/v1/patients/:mrn/problems/:id
app.get('/api/v1/patients/:mrn/problems/:id', (req, res) => {
  const r = getPatientOr404(req, res); if (!r) return;
  const item = r.problems.find(p => p.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, error: 'Problem not found', timestamp: new Date().toISOString() });
  apiOk(res, item);
});

// GET /api/v1/patients/:mrn/vitals
app.get('/api/v1/patients/:mrn/vitals', (req, res) => {
  const r = getPatientOr404(req, res); if (!r) return;
  apiOk(res, r.vitals);
});

// GET /api/v1/patients/:mrn/labs
app.get('/api/v1/patients/:mrn/labs', (req, res) => {
  const r = getPatientOr404(req, res); if (!r) return;
  let data = r.labs;
  const { from_date, to_date } = req.query;
  if (from_date) data = data.filter(l => l.date >= from_date);
  if (to_date)   data = data.filter(l => l.date <= to_date);
  apiOk(res, data);
});

// GET /api/v1/patients/:mrn/labs/:id
app.get('/api/v1/patients/:mrn/labs/:id', (req, res) => {
  const r = getPatientOr404(req, res); if (!r) return;
  const item = r.labs.find(l => l.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, error: 'Lab result not found', timestamp: new Date().toISOString() });
  apiOk(res, item);
});
