# quantum_key_orchestrator

**Key Management Control Plane** — generates, pools, and distributes quantum keys
to an external Rust transport layer via gRPC.

---

## Architecture

```
quantum_key_orchestrator/
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
```

---

## Quick Start

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

### 3. Run the orchestrator

```bash
KME_BASE_URL=https://kme.example.com \
SLAVE_SAE_ID=sae-bob-01 \
GRPC_PORT=50051 \
TOTAL_KEYS_EPOCH=1000 \
QRNG_FALLBACK=1 \
python -m quantum_key_orchestrator.orchestrator
```

### 4. Run tests

```bash
pytest tests/ -v
```

---

## Module reference

### `etsi_client/etsi_qkd_014_client.py`

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

---

## Strict non-goals

- ❌ No IKEv2 / PQC algorithms (ML-DSA / ML-KEM)
- ❌ No user interface
- ❌ No SQLite / persistent storage (all state is in-memory)
