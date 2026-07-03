"""
grpc_server.py
──────────────
gRPC Control-Plane Server
──────────────────────────
Exposes the ``QuantumKeyService`` to the external Rust transport layer.

Implements
  • AcquireKeys       – pop N keys from the ETSI pool (JFI-governed)
  • GetPoolStatus     – pool depth + current JFI for each KME
  • RegisterRouter    – register a quantum router with a priority weight
  • DeregisterRouter  – remove a router
  • SetRouterDemand   – declare keys/epoch demand before an allocation epoch
  • StreamKeys        – bidirectional streaming key feed for the Rust layer

BellGenT integration
  Each AcquireKeys call fires the ``BellGenTBroker.on_key_issued`` hook
  asynchronously so BellGenT can update its entanglement scheduling tables.

Architecture note
  The gRPC servicer runs inside an ``asyncio`` event loop.  The ETSI pool
  manager and fairness allocator are passed in at construction time (DI).

Startup
  python -m quantum_key_orchestrator.api.grpc_server
  (or imported and called from an orchestration entry-point)
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from typing import AsyncIterator

import grpc
import structlog
from grpc import aio as grpc_aio

# ── Protobuf generated stubs (generated via grpc_tools.protoc) ────────────────
# These are imported from the generated files.  If you haven't generated them
# yet, run:
#   python -m grpc_tools.protoc -I proto \
#       --python_out=api --grpc_python_out=api \
#       proto/key_service.proto
try:
    from . import key_service_pb2 as pb2
    from . import key_service_pb2_grpc as pb2_grpc
except ImportError:  # allow the module to load even without generated stubs
    pb2 = None          # type: ignore
    pb2_grpc = None     # type: ignore

from ..etsi_client.key_pool_manager import ETSIKeyPoolManager, PooledKey, KeySource
from ..fairness.jains_allocator import KeyFairnessAllocator, jains_fairness_index

log = structlog.get_logger(__name__)


# ── BellGenT integration broker (stub) ────────────────────────────────────────

class BellGenTBroker:
    """
    Thin integration layer for BellGenT entanglement scheduling.

    In production this would publish to the BellGenT gRPC / REST endpoint.
    Here we provide a typed stub that logs the event and is easily replaced.
    """

    def __init__(self, bellgent_endpoint: str | None = None) -> None:
        self._endpoint = bellgent_endpoint

    async def on_key_issued(
        self,
        router_id: str,
        key: PooledKey,
        jfi: float,
    ) -> None:
        """Called after a key is issued to a router."""
        log.debug(
            "bellgent.key_issued",
            router=router_id,
            key_id=key.key_id,
            source=key.source.name,
            jfi=round(jfi, 4),
        )
        # TODO: POST to self._endpoint when BellGenT REST API is available

    async def on_epoch_allocated(self, allocation: dict[str, int], jfi: float) -> None:
        """Called after each fairness-allocation epoch."""
        log.info(
            "bellgent.epoch_allocated",
            allocation=allocation,
            jfi=round(jfi, 4),
        )
        # TODO: publish entanglement scheduling hints to BellGenT


# ── gRPC Servicer ─────────────────────────────────────────────────────────────

class QuantumKeyServicer:
    """
    Implements the ``QuantumKeyService`` protobuf service.

    Parameters
    ----------
    pools : dict[str, ETSIKeyPoolManager]
        Mapping of kme_id → pool manager.  Multiple KMEs can be registered.
    allocator : KeyFairnessAllocator
        Jain's fairness allocator governing per-router key budgets.
    bellgent : BellGenTBroker | None
        BellGenT integration hook.
    stream_interval_s : float
        Delay between keys in the StreamKeys RPC (default 0.1 s).
    """

    def __init__(
        self,
        pools: dict[str, ETSIKeyPoolManager],
        allocator: KeyFairnessAllocator,
        bellgent: BellGenTBroker | None = None,
        stream_interval_s: float = 0.1,
    ) -> None:
        self._pools = pools
        self._allocator = allocator
        self._bellgent = bellgent or BellGenTBroker()
        self._stream_interval = stream_interval_s

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _pick_pool(self) -> ETSIKeyPoolManager:
        """Round-robin across registered KME pools (simple load balance)."""
        pools = list(self._pools.values())
        if not pools:
            raise RuntimeError("No key pools registered")
        # deterministic round-robin via epoch counter
        epoch = self._allocator._epoch
        return pools[epoch % len(pools)]

    def _pooled_key_to_pb(self, key: PooledKey, jfi: float) -> "pb2.KeyMaterial":
        if pb2 is None:
            raise RuntimeError("protobuf stubs not generated")
        return pb2.KeyMaterial(
            key_id=key.key_id,
            key_data=key.key_material,
            size_bits=key.size_bits,
            source="qkd" if key.source == KeySource.QKD else "qrng",
            jfi_at_issue=jfi,
        )

    # ── RPCs ──────────────────────────────────────────────────────────────────

    async def AcquireKeys(
        self,
        request: "pb2.AcquireKeyRequest",
        context: grpc.aio.ServicerContext,
    ) -> "pb2.AcquireKeyResponse":
        router_id = request.router_id
        count     = max(1, request.count)

        # Ensure router is registered (auto-register with default weight)
        if router_id not in self._allocator._routers:
            self._allocator.register_router(router_id, weight=1.0)

        # Fairness gate: update demand and run an allocation epoch
        self._allocator.set_demand(router_id, count)
        allocation = self._allocator.allocate()
        granted    = allocation.get(router_id, 0)
        jfi        = self._allocator.jains_index()

        if granted == 0:
            log.warning("grpc.acquire_denied_by_allocator",
                        router=router_id, requested=count, jfi=jfi)
            await context.abort(
                grpc.StatusCode.RESOURCE_EXHAUSTED,
                f"Allocator granted 0 keys to router '{router_id}' "
                f"(JFI={jfi:.4f}). Try again next epoch.",
            )

        pool = self._pick_pool()
        keys_pb = []
        for _ in range(granted):
            key = await pool.acquire()
            keys_pb.append(self._pooled_key_to_pb(key, jfi))
            await self._bellgent.on_key_issued(router_id, key, jfi)

        await self._bellgent.on_epoch_allocated(allocation, jfi)

        log.info("grpc.keys_issued",
                 router=router_id, requested=count,
                 granted=granted, jfi=round(jfi, 4))

        return pb2.AcquireKeyResponse(
            keys=keys_pb,
            jfi=jfi,
            epoch_id=str(uuid.uuid4()),
        )

    async def GetPoolStatus(
        self,
        request: "pb2.PoolStatusRequest",
        context: grpc.aio.ServicerContext,
    ) -> "pb2.PoolStatusResponse":
        kme_filter = request.kme_id or None
        pools_pb = []
        depths   = []

        for kme_id, pool in self._pools.items():
            if kme_filter and kme_id != kme_filter:
                continue
            depth = await pool.pool_depth()
            depths.append(float(depth))
            pools_pb.append(pb2.PoolStatusResponse.KMEPool(
                kme_id=kme_id,
                sae_pair=f"{kme_id}:{pool._slave}",
                depth=depth,
                jfi=self._allocator.jains_index(),
            ))

        overall = jains_fairness_index(depths)
        return pb2.PoolStatusResponse(pools=pools_pb, overall_jfi=overall)

    async def RegisterRouter(
        self,
        request: "pb2.RegisterRouterRequest",
        context: grpc.aio.ServicerContext,
    ) -> "pb2.RegisterRouterResponse":
        try:
            self._allocator.register_router(
                request.router_id,
                weight=request.weight if request.weight > 0 else 1.0,
            )
            return pb2.RegisterRouterResponse(success=True, message="registered")
        except Exception as exc:
            return pb2.RegisterRouterResponse(success=False, message=str(exc))

    async def DeregisterRouter(
        self,
        request: "pb2.RegisterRouterRequest",
        context: grpc.aio.ServicerContext,
    ) -> "pb2.RegisterRouterResponse":
        self._allocator.deregister_router(request.router_id)
        return pb2.RegisterRouterResponse(success=True, message="deregistered")

    async def SetRouterDemand(
        self,
        request: "pb2.SetDemandRequest",
        context: grpc.aio.ServicerContext,
    ) -> "pb2.SetDemandResponse":
        try:
            self._allocator.set_demand(request.router_id, request.keys_per_epoch)
            return pb2.SetDemandResponse(success=True)
        except KeyError as exc:
            await context.abort(grpc.StatusCode.NOT_FOUND, str(exc))

    async def StreamKeys(
        self,
        request: "pb2.AcquireKeyRequest",
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator["pb2.KeyMaterial"]:
        """
        Streaming RPC: continuously push keys to the Rust transport layer.
        The stream runs until the client cancels or the server shuts down.
        """
        router_id = request.router_id
        if router_id not in self._allocator._routers:
            self._allocator.register_router(router_id, weight=1.0)

        pool = self._pick_pool()
        jfi  = self._allocator.jains_index()

        while True:
            if context.cancelled():
                log.info("grpc.stream_cancelled", router=router_id)
                return
            try:
                key = await pool.acquire()
                yield self._pooled_key_to_pb(key, jfi)
                await self._bellgent.on_key_issued(router_id, key, jfi)
            except Exception as exc:
                log.error("grpc.stream_error", error=str(exc))
                await context.abort(grpc.StatusCode.INTERNAL, str(exc))
                return
            await asyncio.sleep(self._stream_interval)


# ── Server factory ────────────────────────────────────────────────────────────

async def create_server(
    pools: dict[str, ETSIKeyPoolManager],
    allocator: KeyFairnessAllocator,
    *,
    host: str = "0.0.0.0",
    port: int = 50051,
    bellgent_endpoint: str | None = None,
    tls_cert_chain: str | None = None,
    tls_private_key: str | None = None,
) -> grpc_aio.Server:
    """
    Build and configure the gRPC server.

    Parameters
    ----------
    pools, allocator
        Injected dependencies (already started).
    host, port
        Listen address for the Rust transport client.
    bellgent_endpoint
        Optional BellGenT REST/gRPC endpoint URL.
    tls_cert_chain / tls_private_key
        Paths to PEM files for mTLS.  If omitted, server runs in plaintext
        (acceptable inside a private quantum backbone network).
    """
    if pb2_grpc is None:
        raise RuntimeError(
            "gRPC stubs not found.  Run:\n"
            "  python -m grpc_tools.protoc -I proto \\\n"
            "      --python_out=api --grpc_python_out=api \\\n"
            "      proto/key_service.proto"
        )

    bellgent = BellGenTBroker(bellgent_endpoint)
    servicer = QuantumKeyServicer(pools, allocator, bellgent)

    # ── TLS credentials ───────────────────────────────────────────────────────
    if tls_cert_chain and tls_private_key:
        with open(tls_cert_chain, "rb") as f:
            cert_chain = f.read()
        with open(tls_private_key, "rb") as f:
            private_key = f.read()
        credentials = grpc.ssl_server_credentials([(private_key, cert_chain)])
        server = grpc_aio.server()
        server.add_secure_port(f"{host}:{port}", credentials)
        log.info("grpc.tls_enabled", host=host, port=port)
    else:
        server = grpc_aio.server()
        server.add_insecure_port(f"{host}:{port}")
        log.warning("grpc.plaintext_mode", host=host, port=port)

    pb2_grpc.add_QuantumKeyServiceServicer_to_server(servicer, server)
    return server


async def serve(
    pools: dict[str, ETSIKeyPoolManager],
    allocator: KeyFairnessAllocator,
    **kwargs,
) -> None:
    """Start the server and block until interrupted."""
    server = await create_server(pools, allocator, **kwargs)
    await server.start()
    log.info("grpc.server_started",
             port=kwargs.get("port", 50051))
    try:
        await server.wait_for_termination()
    except (KeyboardInterrupt, asyncio.CancelledError):
        log.info("grpc.server_stopping")
        await server.stop(grace=5)


# ── Entry-point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    structlog.configure(
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    )

    # Minimal demo: one in-memory pool (no real KME) + allocator
    from ..etsi_client.key_pool_manager import ETSIKeyPoolManager

    # For a real deployment, replace with actual KME URLs and SAE IDs.
    # demo_pool = ETSIKeyPoolManager(
    #     kme_id="kme-1",
    #     kme_base_url=os.environ["KME_BASE_URL"],
    #     slave_sae_id=os.environ["SLAVE_SAE_ID"],
    #     qrng_fallback=True,
    # )

    alloc = KeyFairnessAllocator(total_keys_per_epoch=1000)
    alloc.register_router("rust-transport-1", weight=1.0)
    alloc.register_router("rust-transport-2", weight=1.0)

    print("Start a real pool by setting KME_BASE_URL and SLAVE_SAE_ID env vars.")
    print("Exiting demo entry-point.")
    sys.exit(0)
