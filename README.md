<div align="center">

#  Quantum-Encrypted ABDM-Integrated Hospital Data Management System


---

## Table of Contents

- [About](#about)
- [System Layers](#system-layers)
- [Run Order](#run-order)
- [Quick Start](#quick-start)
  - [1. KME (Python)](#1-kme--quantum-key-orchestrator-start-first)
  - [2. pqc_transport_node (Rust)](#2-pqc_transport_node-rust--start-second)
  - [3. Frontend (React/Next.js)](#3-frontend--patient-summary-dashboard-start-last)
- [End-to-End Data Flow](#end-to-end-data-flow)
- [Project Structure](#project-structure)
- [Module Reference](#module-reference)
- [Diagrams](#diagrams)
- [Academic Submission](#academic-submission)
- [License](#license)

---

## About

This project implements a quantum-encrypted, ABDM-integrated hospital data management system, combining post-quantum cryptography, simulated quantum key distribution, and India's Ayushman Bharat Digital Mission (ABDM) framework to enable secure, auditable transfer of clinical records between healthcare providers.

The system is composed of four coordinated layers — QKD simulation, key management, PQC-secured transport, and an ABDM-integrated clinical dashboard — described below.

## System Layers

| # | Layer | Stack | Responsibility |
|---|-------|-------|-----------------|
| 1 | **QKD Simulation & Tiered Network** | SeQUeNCe | Three-tier network modelling **BB84**, **MDI-QKD**, **Twin-Field QKD**; nested Bennett-style entanglement purification; ticking-qubit sync handshake |
| 2 | **Key Management Entity (KME)** | Flask, ETSI GS QKD 014 | REST endpoints for enc/dec key retrieval, conformant with the ETSI 014 spec |
| 3 | **PQC Fallback** | liboqs | **ML-KEM (Kyber-1024)** key encapsulation + **CRYSTALS-Dilithium** (Level 3, randomised signing) when live QKD hardware is unavailable |
| 4 | **Secure Transport Layer** | Rust, gRPC | `SecureFileGateway` service — **ML-KEM-768** encapsulation, **HKDF-SHA256** session key derivation, **ML-DSA-65** segment signing, FIPS 203/204 conformant |
| 5 | **Quantum Key Orchestrator** | Python, gRPC | Supplies symmetric key material to the Rust node via a `QuantumKeyService` protobuf contract; Jain's Fairness Index allocation; QRNG → CSPRNG fallback chain |
| 6 | **ABDM Wrapper** | Docker Compose, MongoDB | Patient discovery, consent workflows, care context management via a Mock Gateway |
| 7 | **Doctor Dashboard** | React/Next.js | AI-generated patient summaries; side-by-side source/summary review per ISO 26271:69 |

---

## Run Order

>  **Components must be started in this exact order.** The Rust transport node connects to KME via gRPC on startup, and the frontend depends on the transport layer — starting anything out of order causes connection failures.

```
① KME (Python)  →  ② pqc_transport_node (Rust)  →  ③ Frontend (React/Next.js + Express)
```

---

## Quick Start

### 1. KME — Quantum Key Orchestrator (start first)

**Install dependencies**
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

**Generate gRPC stubs**
```bash
python -m grpc_tools.protoc \
    -I proto \
    --python_out=quantum_key_orchestrator/api \
    --grpc_python_out=quantum_key_orchestrator/api \
    proto/key_service.proto
```

**Set the QRNG API key**

KME requires a QRNG API key for fallback key generation when the KME REST endpoint is unavailable.

| Shell | Command |
|---|---|
| Linux / macOS | `export QRNG_API_KEY=your_api_key_here` |
| Windows (cmd) | `set QRNG_API_KEY=your_api_key_here` |
| Windows (PowerShell) | `$env:QRNG_API_KEY="your_api_key_here"` |

> If `QRNG_API_KEY` is unset, KME cannot fall back to QRNG when the REST endpoint is down. Keep the key in a local, gitignored `.env` file — never commit it.
### We have used Quantum Blockchain's QRNG API
**Run the orchestrator**
```bash
KME_BASE_URL=https://kme.example.com \
SLAVE_SAE_ID=sae-bob-01 \
GRPC_PORT=50051 \
TOTAL_KEYS_EPOCH=1000 \
QRNG_FALLBACK=1 \
python -m quantum_key_orchestrator.orchestrator
```

**Run tests**
```bash
pytest tests/ -v
```

---

### 2. pqc_transport_node (Rust) — start second

Post-quantum secure transport layer implementing **ML-KEM-768** (key encapsulation) and **ML-DSA-65** (digital signatures), communicating with KME over gRPC.

**Install Rust** via [rustup](https://rustup.rs/):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
Windows: download and run [rustup-init.exe](https://www.rust-lang.org/tools/install).

**Build**
```bash
cd pqc_transport_node
cargo build --release
```

**Run** — make sure KME is already running and reachable:
```bash
cargo run --release
```

> Configuration (KME gRPC endpoint, ports, etc.) is read from `pqc_transport_node/config` — set the KME host/port there to match what you started KME with.

---

### 3. Frontend — Patient Summary Dashboard (start last)

Backend (Express.js) and frontend (React/Next.js) run separately.

**Start the backend server**
```bash
cd PATIENT_SUMMARY_DASHBOARD/server
npm install
npm run dev
```

**Start the frontend** — from the root of `PATIENT_SUMMARY_DASHBOARD`:
```bash
npm install
npm run dev:frontend
```

<p align="center">
  <img width="367" alt="Dashboard UI" src="https://github.com/user-attachments/assets/69f1d79f-3975-42fe-801c-005a00af0fe2" />
</p>

---

## End-to-End Data Flow

**1. Patient resolution**
The dashboard resolves an ABHA Address to a patient record through the ABDM Wrapper, which returns one or more CareContexts. Each CareContext carries hospital-specific routing metadata — a PACS endpoint, a KME endpoint reference, and a QKD node identifier — forwarded verbatim to the secure transport layer. The application tier deliberately excludes cryptographic and key-management logic, in line with the system's separation-of-concerns design.

**2. Secure file delivery** (`pqc_transport_node`)
- Resolves the requested study to its underlying file representation
- Acquires symmetric key material from the orchestrator's fairness-governed allocation pool
- Generates an ML-KEM-768 (FIPS 203) ephemeral key encapsulation
- Derives a 256-bit session key via HKDF-SHA256 over the orchestrator-supplied key material concatenated with the ML-KEM shared secret — so that compromise of either individual secret alone is insufficient to recover the session key
- Segments and encrypts the file under AES-256-GCM
- Signs each ciphertext segment with ML-DSA-65 (FIPS 204 / CRYSTALS-Dilithium) for non-repudiation
- Persists control-plane signature verification outcomes to a MySQL audit store

**3. Key orchestration** (Python)
- Manages a fairness-governed symmetric key supply for one or more registered transport-layer routers
- Allocation via a Jain's Fairness Index max-min fair allocator with starvation recovery
- Models a QKD backbone via SeQUeNCe (BB84, MDI-QKD, TF-QKD) with nested Bennett-style entanglement purification
- Key supply sourced through an ETSI GS QKD 014-conformant REST client; degrades to Quantum Blockchain QRNG, then CSPRNG, when live QKD hardware is unavailable
- All cross-component communication mediated through the `QuantumKeyService` protobuf contract

---

## Project Structure

```
quantum_key_orchestrator/
├── etsi_client/
│   ├── etsi_qkd_014_client.py   # Async ETSI GS QKD 014 REST client
│   └── key_pool_manager.py      # Pre-fetched key pool with QRNG fallback
├── sequence_backbone/
│   └── backbone.py              # SeQUeNCe sim: BB84 · MDI · TF-QKD
│                                 #   + Clifford ops, entanglement pumping,
│                                 #   nested pumping, ticking-qubit handshake
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
```

---

## Module Reference

### `etsi_client/etsi_qkd_014_client.py`
`ETSIQKD014Client` — async HTTP/2 client implementing the ETSI 014 endpoints:

| Method | Endpoint |
|---|---|
| `GET`  | `/api/v1/keys/{slave_SAE_ID}/status` |
| `POST` | `/api/v1/keys/{slave_SAE_ID}/enc_keys` |
| `POST` | `/api/v1/keys/{slave_SAE_ID}/dec_keys` |

### `etsi_client/key_pool_manager.py`
`ETSIKeyPoolManager` — in-memory deque-backed pool:
- Background replenishment loop with exponential-backoff retry (`tenacity`)
- QRNG fallback (`secrets.token_bytes`) when KME is unavailable
- Prometheus metrics: `qko_key_pool_depth`, `qko_pool_replenish_seconds`
- `on_key_acquired` BellGenT hook

### `sequence_backbone/backbone.py`
`QuantumBackbone` — SeQUeNCe simulation harness:
- **BB84** — `pair_bb84_protocols` + `pair_cascade_protocols`
- **MDI-QKD** — two BB84 half-links fused at the relay node
- **TF-QKD** — twin-field phase-matched BB84 sessions, XOR-combined post-measurement
- `apply_clifford_sequence(qubit, gates)` — stabiliser-formalism gate application
- `pump_entanglement(pairs)` — Bennett bilateral CNOT purification model
- `nested_pump_entanglement(pairs, depth)` — Deutsch-Ekert hierarchical distillation
- `TickingQubitHandshake` — distributed sync via H-prepared qubit + classical ACK

### `fairness/jains_allocator.py`
- `jains_fairness_index(allocations)` — pure function, O(n)
- `weighted_jains_index(allocations, weights)` — weight-normalised JFI
- `max_min_fair_allocate(demands, capacity, weights)` — water-filling algorithm
- `KeyFairnessAllocator` — epoch-based allocator with starvation recovery, Prometheus `qko_jains_fairness_index` gauge, BellGenT hook

### `api/grpc_server.py`
`QuantumKeyServicer` implements:

| RPC | Description |
|---|---|
| `AcquireKeys` | Pop N JFI-governed keys, fire BellGenT hook |
| `GetPoolStatus` | Pool depth + JFI per KME |
| `RegisterRouter` / `DeregisterRouter` | Router lifecycle |
| `SetRouterDemand` | Declare keys/epoch before allocation |
| `StreamKeys` | Continuous key push to Rust transport (server-streaming) |

---

## Diagrams

<p align="center">
  <img width="500" alt="Full DFD" src="https://github.com/user-attachments/assets/e39770eb-7b18-4901-8459-7acaef4c14cc" />
  <img width="400" alt="Architecture Diagram" src="https://github.com/user-attachments/assets/9378e86a-8f3b-471c-b6d8-7ad0c3a5a047" />
</p>
<p align="center">
  <img width="400" alt="Activity Diagram" src="https://github.com/user-attachments/assets/0e20e557-d2e8-486a-b1d3-2915d7ecde2a" />
</p>

---

## Academic Submission

This project was submitted to **Savitribai Phule Pune University** in partial fulfillment for the award of the degree of **Bachelor of Engineering in Artificial Intelligence and Data Science**.

**By:**
- Aadesh Lawande — B400530659
- Kashyap Kamble — B400530653
- Saurabh Salunkhe — B400530676
- Stavan Shere — B400530681

**Under the guidance of:**
Dr. Manju Pawar, Department of Artificial Intelligence and Data Science

**Zeal Education Society's Zeal College of Engineering and Research**, Narhe, Pune – 411041
<img width="300" height="150" alt="image" align="center" src="https://github.com/user-attachments/assets/5c293e30-4a99-4d84-b373-3495f5c2127b" />

---

## License

Released under the [MIT License](LICENSE). Third-party components (ABDM Wrapper, SeQUeNCe simulation framework, ETSI GS QKD 014 client) retain their original licenses — refer to their respective source repositories.
