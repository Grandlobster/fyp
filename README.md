# KME
# quantum_key_orchestrator

**Key Management Control Plane** — generates, pools, and distributes quantum keys
to an external Rust transport layer via gRPC.

---

## System Components & Run Order

This project has three components that must be started **in this order**:

1. **KME (Quantum Key Orchestrator)** — Python control plane. Must be running first, since the Rust transport layer connects to it via gRPC.
2. **pqc_transport_node (Rust)** — Post-quantum secure transport layer (ML-KEM-768, ML-DSA-65). Connects to KME on startup.
3. **Frontend (Patient Summary Dashboard)** — React/Next.js dashboard + Express.js server.

> ⚠️ Starting the Rust node or frontend before KME is up will cause connection failures — KME must always be started first.
## About This Project

**Secure and Distributed Hospital Data System with Quantum Encryption and ABHA**

This project implements a quantum-encrypted, ABDM-integrated hospital data management system, combining post-quantum cryptography, simulated quantum key distribution, and India's Ayushman Bharat Digital Mission (ABDM) framework to enable secure, auditable transfer of clinical records between healthcare providers.

The system is composed of four coordinated layers:

### 1. QKD Simulation & Tiered Network (SeQUeNCe)
The QKD protocol is prototyped using SeQUeNCe. Alice prepares qubits in random basis/bit combinations; Bob measures in a random basis. The sifted key and QBER (Quantum Bit Error Rate) are computed classically after basis reconciliation.

A three-tier network topology is modelled implementing **BB84**, **MDI-QKD**, and **Twin-Field QKD** protocols. The orchestrator additionally implements entanglement purification via nested Bennett-style pumping and a distributed ticking-qubit synchronisation handshake between quantum routers.

### 2. Key Management Entity (ETSI GS QKD 014)
A Flask-based KME exposes ETSI 014-compliant REST endpoints:
- `GET /api/v1/keys/{slave_SAE_ID}/enc_keys`
- `GET /api/v1/keys/{master_SAE_ID}/dec_keys`

### 3. PQC Fallback (liboqs)
The Open Quantum Safe (liboqs) library provides **ML-KEM (Kyber-1024)** for key encapsulation and **CRYSTALS-Dilithium** (randomised signing mode, Level 3 parameters) for digital signatures, used when live QKD hardware is unavailable.

### 4. Secure Transport Layer — `pqc_transport_node` (Rust)
Exposes a gRPC `SecureFileGateway` service. It implements **ML-KEM-768** for key encapsulation, derives a 256-bit session key via **HKDF-SHA256** over the concatenation of orchestrator-supplied key material and the ML-KEM shared secret, and signs all file-transfer segments using **ML-DSA-65** for cryptographic non-repudiation, conformant with **NIST FIPS 203/204**. Every IKE control-plane message is signed and verified, with results persisted to a MySQL audit store.

### 5. Quantum Key Orchestrator (Python/gRPC)
Supplies symmetric key material to the Rust transport node via a strongly-typed Protocol Buffers contract (`QuantumKeyService`). Implements a **Jain's Fairness Index** allocator for equitable key distribution across multiple transport nodes, with a QRNG fallback (QuantumBlockchains API, degrading further to CSPRNG) when QKD hardware is unavailable.

### 6. ABDM Wrapper
Deployed via Docker Compose alongside a Mock Gateway and MongoDB. Exposes simplified REST APIs for patient discovery, consent workflows, and care context management.

### 7. Doctor Dashboard (React)
Provides AI-generated patient summaries. Interface design follows the **ISO 26271:69** standard for medical document summarisation and draws on an HCI interface study, where the source document and AI summary are displayed side-by-side for clinician review.

---

## End-to-End Data Flow

1. **Patient resolution** — The dashboard resolves an ABHA Address to a patient record through the ABDM Wrapper, which returns one or more CareContexts. Each CareContext carries hospital-specific routing metadata including a PACS endpoint, a KME endpoint reference, and a QKD node identifier. This metadata is forwarded verbatim by the application layer to the secure transport layer without independent processing or storage — in line with the system's separation-of-concerns design, which deliberately excludes cryptographic and key-management logic from the application tier.

2. **Secure file delivery (`pqc_transport_node`)** — On request, the transport node:
   - Resolves the requested study to its underlying file representation
   - Acquires symmetric key material from the Quantum Key Orchestrator's fairness-governed allocation pool
   - Generates an ML-KEM-768 (FIPS 203) ephemeral key encapsulation
   - Derives a 256-bit session key via HKDF-SHA256 over the orchestrator-supplied key material concatenated with the ML-KEM shared secret — a construction chosen so that compromise of either individual secret alone is insufficient to recover the session key
   - Segments and encrypts the file under AES-256-GCM
   - Signs each ciphertext segment with ML-DSA-65 (FIPS 204, CRYSTALS-Dilithium) for non-repudiation
   - Persists control-plane signature verification outcomes to a MySQL audit store

3. **Key orchestration (Python)** — Manages a fairness-governed symmetric key supply for one or more registered transport-layer routers. Allocation is governed by a Jain's Fairness Index-based max-min fair allocator with starvation recovery, ensuring equitable key distribution across routers under heterogeneous demand. The orchestrator models a QKD backbone via SeQUeNCe (BB84, MDI-QKD, TF-QKD topologies) with nested Bennett-style entanglement purification. Key supply is sourced through an ETSI GS QKD 014-conformant REST client capable of interfacing with a real KME; in the absence of live QKD hardware, the system degrades gracefully to a Quantum Blockchain QRNG fallback, with further fallback to a cryptographically-secure entropy source for resilience. Cross-component communication is mediated entirely through the `QuantumKeyService` Protocol Buffers contract.

---
---


## Architecture
uantum_key_orchestrator/
├── etsi_client/
│   ├── etsi_qkd_014_client.py   # Async ETSI GS QKD 014 REST client
│   └── key_pool_manager.py      # Pre-fetched key pool with QRNG fallback
├── sequence_backbone/
│   └── backbone.py              # SeQUeNCe sim: BB84 · MDI · TF-QKD
│                                # + Clifford ops, entanglement pumping,
│                                #   nested pumping, ticking-qubit handshake
├── fairness/
│   └── jains_allocator.py       # Jain's Fairness Index · max-min allocation
├── api/
│   └── grpc_server.py           # gRPC control-plane (Rust transport interface)
├── proto/
│   └── key_service.proto        # Protobuf service definition
├── orchestrator.py              # Top-level entry point
├── requirements.txt
└── tests/
└── test_quantum_key_orchestrator.py
---

## Quick Start — KME (start this first)

### 1. Install dependencies

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Generate gRPC stubs

```bash
python -m grpc_tools.protoc \
    -I proto \
    --python_out=quantum_key_orchestrator/api \
    --grpc_python_out=quantum_key_orchestrator/api \
    proto/key_service.proto
```

### 3. Set the QRNG API key

KME requires a QRNG API key for fallback key generation when the KME REST endpoint is unavailable. Set it as an environment variable before running:

**Linux / macOS:**
```bash
export QRNG_API_KEY=your_api_key_here
```

**Windows (cmd):**
```cmd
set QRNG_API_KEY=your_api_key_here
```

**Windows (PowerShell):**
```powershell
$env:QRNG_API_KEY="your_api_key_here"
```

> If `QRNG_API_KEY` is not set, KME will fail to fall back to QRNG when the KME REST endpoint is down. Get an API key from your QRNG provider and never commit it — keep it in a local `.env` file (already gitignored) or set it per-session as above.

### 4. Run the orchestrator

```bash
KME_BASE_URL=https://kme.example.com \
SLAVE_SAE_ID=sae-bob-01 \
GRPC_PORT=50051 \
TOTAL_KEYS_EPOCH=1000 \
QRNG_FALLBACK=1 \
python -m quantum_key_orchestrator.orchestrator
```

### 5. Run tests

```bash
pytest tests/ -v
```

---

## Module reference

### `etsi_client/etsi_qkd_014_client.py`
Read about ETSI 
`ETSIQKD014Client` — async HTTP/2 client implementing the three ETSI 014 endpoints:
- `GET  /api/v1/keys/{slave_SAE_ID}/status`
- `POST /api/v1/keys/{slave_SAE_ID}/enc_keys`
- `POST /api/v1/keys/{slave_SAE_ID}/dec_keys`

### `etsi_client/key_pool_manager.py`

`ETSIKeyPoolManager` — in-memory deque-backed pool:
- Background replenishment loop with exponential-backoff retry (tenacity)
- QRNG fallback (`secrets.token_bytes`) when KME is unavailable
- Prometheus metrics: `qko_key_pool_depth`, `qko_pool_replenish_seconds`
- BellGenT `on_key_acquired` hook

### `sequence_backbone/backbone.py`

`QuantumBackbone` — SeQUeNCe simulation harness:
- **BB84**: `pair_bb84_protocols` + `pair_cascade_protocols`
- **MDI-QKD**: two BB84 half-links fused at the relay node
- **TF-QKD**: twin-field phase-matched BB84 sessions XOR-combined post-measurement
- `apply_clifford_sequence(qubit, gates)` — stabiliser-formalism gate application
- `pump_entanglement(pairs)` — Bennett bilateral CNOT purification model
- `nested_pump_entanglement(pairs, depth)` — Deutsch-Ekert hierarchical distillation
- `TickingQubitHandshake` — distributed sync via H-prepared qubit + classical ACK

### `fairness/jains_allocator.py`

- `jains_fairness_index(allocations)` — pure function, O(n)
- `weighted_jains_index(allocations, weights)` — weight-normalised JFI
- `max_min_fair_allocate(demands, capacity, weights)` — water-filling algorithm
- `KeyFairnessAllocator` — epoch-based allocator with starvation recovery,
  Prometheus `qko_jains_fairness_index` gauge, BellGenT hook

### `api/grpc_server.py`

`QuantumKeyServicer` implementing:
| RPC | Description |
|-----|-------------|
| `AcquireKeys` | Pop N JFI-governed keys, fire BellGenT hook |
| `GetPoolStatus` | Pool depth + JFI per KME |
| `RegisterRouter` / `DeregisterRouter` | Router lifecycle |
| `SetRouterDemand` | Declare keys/epoch before allocation |
| `StreamKeys` | Continuous key push to Rust transport (server-streaming) |

### Diagrams

<p float="left">
  <img width="500" alt="Full DFD" src="https://github.com/user-attachments/assets/e39770eb-7b18-4901-8459-7acaef4c14cc" />
  <img width="400" alt="Architecture Diagram" src="https://github.com/user-attachments/assets/9378e86a-8f3b-471c-b6d8-7ad0c3a5a047" />
</p>
<p float="left">
  <img width="400" alt="Activity Diagram" src="https://github.com/user-attachments/assets/0e20e557-d2e8-486a-b1d3-2915d7ecde2a" />
</p>

---

## pqc_transport_node (Rust) — start this second

Post-quantum secure transport layer implementing **ML-KEM-768** (key encapsulation) and **ML-DSA-65** (digital signatures), communicating with KME over gRPC.

### 1. Install Rust

Install via [rustup](https://rustup.rs/):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
Windows: download and run [rustup-init.exe](https://www.rust-lang.org/tools/install).

### 2. Build

```bash
cd pqc_transport_node
cargo build --release
```

### 3. Run

Make sure KME is already running and reachable, then:
```bash
cargo run --release
```

> Configuration (KME gRPC endpoint, ports, etc.) is read from `pqc_transport_node/config` — set the KME host/port there to match what you started KME with.

---

## Frontend — Patient Summary Dashboard (start this last)

Backend (Express.js) and frontend (React/Next.js) run separately.

### 1. Start the backend server
```bash
cd PATIENT_SUMMARY_DASHBOARD/server
npm install
npm run dev
```

### 2. Start the frontend
From the root of `PATIENT_SUMMARY_DASHBOARD`:
```bash
npm install
npm run dev:frontend
```

<p float="left">
  <img width="367" alt="UI" src="https://github.com/user-attachments/assets/69f1d79f-3975-42fe-801c-005a00af0fe2" />
</p>

---

## License

This project is released under the [MIT License](LICENSE). See the `LICENSE` file for details. Third-party components (ABDM Wrapper, SeQUeNCe simulation framework, ETSI GS QKD 014 client) retain their original licenses — refer to their respective source repositories.

---

## Academic Submission

This project was submitted to **Savitribai Phule Pune University** in partial fulfillment for the award of the degree of **Bachelor of Engineering in Artificial Intelligence and Data Science**.

**By:**
- Aadesh Lawande — Roll No. B400530659
- Kashyap Kamble — Roll No. B400530653
- Saurabh Salunkhe — Roll No. B400530676
- Stavan Shere — Roll No. B400530681

**Under the guidance of:**
Dr. Manju Pawar
Department of Artificial Intelligence and Data Science

**Zeal Education Society's Zeal College of Engineering and Research**
Narhe, Pune – 411041
