"""
orchestrator.py
───────────────
Top-level orchestration entry point.

Wires together:
  • ETSI QKD 014 key pool manager(s)
  • SeQUeNCe quantum backbone simulator
  • Jain's Fairness allocator
  • gRPC server (control plane interface for Rust transport layer)
  • BellGenT integration broker

Usage
─────
  python -m quantum_key_orchestrator.orchestrator

Environment variables
─────────────────────
  KME_BASE_URL     – ETSI KME HTTP base URL (omit for QRNG-only mode)
  SLAVE_SAE_ID     – SAE ID of the remote peer
  QRNG_API_KEY     – QBCK QRNG API key (required unless KME is configured)
  QRNG_CA_BUNDLE   – PEM file for QRNG TLS verify (default: ./chain.pem)
  GRPC_PORT        – port for the gRPC server (default 50051)
  TOTAL_KEYS_EPOCH – keys to distribute per allocation epoch (default 1000)
  QRNG_FALLBACK    – "1" to enable QRNG/secrets fallback when KME is down (default "1")
  SIM_DURATION_MS  – backbone simulation duration in ms (default 100)
  BELLGENT_ENDPOINT – BellGenT REST endpoint URL (optional)
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys

import structlog

from .etsi_client.key_pool_manager import ETSIKeyPoolManager
from .etsi_client.qrng_client import QBCKQRNGClient, default_ca_bundle
from .fairness.jains_allocator import KeyFairnessAllocator
from .sequence_backbone.backbone import (
    QuantumBackbone,
    QKDProtocol,
    pump_entanglement,
    nested_pump_entanglement,
)

log = structlog.get_logger(__name__)


def _configure_logging() -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )


async def run_backbone_simulation(duration_ms: float = 100.0) -> list[bytes]:
    """
    Spin up the SeQUeNCe backbone, run the simulation, and return
    raw key bytes.  Also exercises entanglement pumping and TF-QKD.
    """
    bb = QuantumBackbone(sim_duration_ms=duration_ms)

   # IMPORTANT: SeQUeNCe's protocol pairing (pair_bb84_protocols) can only
    # be called once per node. Each protocol below therefore gets its own
    # fully separate set of nodes — none are shared across BB84 / MDI /
    # TF-QKD. Reusing a node across two configure_protocol() calls leaves
    # protocol_stack[0].role unset on the second pairing, which crashes
    # node.init() with an AssertionError.

    # BB84 direct link
    bb.add_node("alice", role="endpoint")
    bb.add_node("charlie", role="endpoint")
    bb.add_link("alice", "charlie", distance_km=10)
    bb.configure_protocol(QKDProtocol.BB84, "alice", "charlie", keylen=256)

    # MDI-QKD via its own relay
    '''bb.add_node("mdi_a", role="endpoint")
    bb.add_node("mdi_relay", role="relay")
    bb.add_node("mdi_b", role="endpoint")
    bb.add_link("mdi_a", "mdi_relay", distance_km=50)
    bb.add_link("mdi_b", "mdi_relay", distance_km=50)
   # bb.configure_protocol(QKDProtocol.MDI, "mdi_a", "mdi_b",
                           relay="mdi_relay", keylen=512)

    # TF-QKD via its own separate relay
    bb.add_node("dave", role="endpoint")
    bb.add_node("tf_relay", role="relay")
    bb.add_node("eve", role="endpoint")
    bb.add_link("dave", "tf_relay", distance_km=50)
    bb.add_link("eve",  "tf_relay", distance_km=50)
 #   bb.configure_protocol(QKDProtocol.TF_QKD, "dave", "eve",
                           relay="tf_relay", keylen=512)'''
    # Ticking handshake (synchronise alice ↔ charlie)
    from .sequence_backbone.backbone import NS
    synced = bb.run_ticking_handshake("alice", "charlie", channel_delay_ps=250 * NS)
    log.info("ticking_handshake", synced=synced)

    # Generate Bell pairs and run nested pumping
    raw_pairs = bb.generate_bell_pairs("alice", "charlie", count=32, base_fidelity=0.78)
    purified  = nested_pump_entanglement(
        raw_pairs, nesting_depth=2, pairs_per_round=8, target_fidelity=0.999
    )
    if purified:
        log.info("nested_pump.result", fidelity=round(purified.fidelity, 6))

    # Run discrete-event simulation
    keys = bb.run()
    log.info("backbone.keys_generated", count=len(keys))
    return keys


async def main() -> None:
    _configure_logging()

    kme_url     = os.environ.get("KME_BASE_URL",     "")
    slave_sae   = os.environ.get("SLAVE_SAE_ID",     "sae-bob-01")
    grpc_port   = int(os.environ.get("GRPC_PORT",    "50051"))
    total_keys  = int(os.environ.get("TOTAL_KEYS_EPOCH", "1000"))
    qrng_fb     = os.environ.get("QRNG_FALLBACK",   "1") == "1"
    sim_ms      = float(os.environ.get("SIM_DURATION_MS", "100"))
    bellgent_ep = os.environ.get("BELLGENT_ENDPOINT", None)
    qrng_api_key = os.environ.get("QRNG_API_KEY", "")
    qrng_ca      = os.environ.get("QRNG_CA_BUNDLE", default_ca_bundle())
    use_kme      = ETSIKeyPoolManager.kme_url_enabled(kme_url)

    if not use_kme and not qrng_api_key:
        log.error(
            "orchestrator.missing_qrng_key",
            hint="Set QRNG_API_KEY or configure KME_BASE_URL to a real KME",
        )
        sys.exit(1)

    qrng_client = QBCKQRNGClient(qrng_api_key, ca_bundle=qrng_ca) if qrng_api_key else None

    # Run backbone simulation concurrently so QRNG pool startup is not blocked.
    backbone_task = asyncio.create_task(run_backbone_simulation(sim_ms))

    # ── 2. ETSI / QRNG key pool ────────────────────────────────────────────────
    pool = ETSIKeyPoolManager(
        kme_id="kme-primary",
        kme_base_url=kme_url or "qrng-only",
        slave_sae_id=slave_sae,
        key_size_bits=256,
        high_watermark=512,
        low_watermark=64,
        replenish_batch=128,
        qrng_fallback=qrng_fb,
        qrng_client=qrng_client,
        use_kme=use_kme,
    )

    # ── 3. Fairness allocator ──────────────────────────────────────────────────
    allocator = KeyFairnessAllocator(
        total_keys_per_epoch=total_keys,
        epoch_duration_s=1.0,
    )
    # Pre-register the Rust transport layer routers
    allocator.register_router("rust-transport-primary",   weight=1.0)
    allocator.register_router("rust-transport-secondary", weight=1.0)

    # ── 4. gRPC server ─────────────────────────────────────────────────────────
    try:
        from .api.grpc_server import serve
        async with pool:
            try:
                sim_keys = await backbone_task
                log.info("orchestrator.backbone_complete", keys=len(sim_keys))
            except Exception as exc:
                import traceback
                log.warning(
                    "orchestrator.backbone_failed",
                    error=str(exc),
                    full_traceback=traceback.format_exc(),
                )
            log.info("orchestrator.pool_started")
            await serve(
                {"kme-primary": pool},
                allocator,
                port=grpc_port,
                bellgent_endpoint=bellgent_ep,
            )
    except ImportError as exc:
        log.warning("orchestrator.grpc_stubs_missing",
                    hint="Run grpc_tools.protoc to generate stubs",
                    error=str(exc))
        # Keep running without gRPC for testing
        async with pool:
            log.info("orchestrator.running_without_grpc_stubs")
            await asyncio.sleep(3600)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("orchestrator.shutdown")
        sys.exit(0)
