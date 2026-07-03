"""
key_pool_manager.py
───────────────────
ETSI 014 Key Pool Manager  – the central in-memory key store for the control plane.

Responsibilities
  • Maintains a per-(KME, SAE-pair) deque of pre-fetched ETSIKey objects.
  • Replenishes the pool in the background when it falls below ``low_watermark``.
  • Falls back to real QRNG (QBCK hex API) when the KME is unreachable, or
    uses QRNG exclusively when no KME URL is configured.
  • Optionally falls back to ``secrets.token_bytes`` if the QRNG API also fails.
  • Exposes ``acquire()`` – the single entry point for the gRPC layer.
  • Emits Prometheus metrics for pool depth, hit/miss, and replenish latency.

Design notes
  • No SQLite / persistent storage – state is ephemeral and rebuilt on startup.
  • Thread-safe via asyncio.Lock; safe to call from multiple gRPC coroutines.
  • BellGenT integration hooks are in ``_on_key_acquired()`` (see below).
"""

from __future__ import annotations

import asyncio
import os
import secrets
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Callable, Awaitable

import structlog
from prometheus_client import Counter, Gauge, Histogram
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from .etsi_qkd_014_client import ETSIQKD014Client, ETSIKey
from .qrng_client import QBCKQRNGClient

log = structlog.get_logger(__name__)

# ── Prometheus metrics ────────────────────────────────────────────────────────

_POOL_DEPTH = Gauge(
    "qko_key_pool_depth",
    "Number of pre-fetched keys currently in the pool",
    ["kme_id", "sae_pair"],
)
_ACQUIRE_TOTAL = Counter(
    "qko_key_acquire_total",
    "Total key acquire calls",
    ["kme_id", "sae_pair", "source"],   # source: pool | qrng
)
_REPLENISH_LATENCY = Histogram(
    "qko_pool_replenish_seconds",
    "Latency of pool replenishment calls to the KME",
    ["kme_id"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)


# ── Key wrapper ───────────────────────────────────────────────────────────────

class KeySource(Enum):
    QKD  = auto()   # fetched from a real / simulated KME
    QRNG = auto()   # QRNG fallback


@dataclass(frozen=True)
class PooledKey:
    key_id: str
    key_material: bytes          # raw key bytes
    size_bits: int
    source: KeySource
    acquired_at: float = field(default_factory=time.monotonic)
    metadata: dict = field(default_factory=dict)

    @classmethod
    def from_etsi(cls, ek: ETSIKey) -> "PooledKey":
        return cls(
            key_id=ek.key_ID,
            key_material=ek.key,
            size_bits=len(ek.key) * 8,
            source=KeySource.QKD,
            metadata=ek.key_ID_extension,
        )

    @classmethod
    def from_qrng(cls, key_material: bytes, *, size_bits: int | None = None) -> "PooledKey":
        bits = size_bits if size_bits is not None else len(key_material) * 8
        return cls(
            key_id=str(uuid.uuid4()),
            key_material=key_material,
            size_bits=bits,
            source=KeySource.QRNG,
        )

    @classmethod
    def from_secrets(cls, size_bits: int = 256) -> "PooledKey":
        """Last-resort pseudo-random key when QRNG and KME are both unavailable."""
        n_bytes = size_bits // 8
        return cls(
            key_id=str(uuid.uuid4()),
            key_material=secrets.token_bytes(n_bytes),
            size_bits=size_bits,
            source=KeySource.QRNG,
        )


# ── Pool manager ──────────────────────────────────────────────────────────────

class ETSIKeyPoolManager:
    """
    Async key pool manager for a single (KME, slave-SAE) pair.

    Parameters
    ----------
    kme_id : str
        Human-readable identifier for the KME (used in logs and metrics).
    kme_base_url : str
        ETSI 014 KME base URL.
    slave_sae_id : str
        SAE ID of the remote peer we are fetching keys for.
    key_size_bits : int
        Requested key size in bits (default 256).
    high_watermark : int
        Maximum keys to hold in pool (caps replenishment batch).
    low_watermark : int
        Trigger background replenishment when pool falls below this.
    replenish_batch : int
        How many keys to request from the KME in each replenishment call.
    qrng_fallback : bool
        If True, use QRNG (then optionally ``secrets``) when KME is down.
    qrng_client : QBCKQRNGClient | None
        Real QRNG client; required when ``use_kme`` is False.
    use_kme : bool
        When False, skip ETSI KME HTTP and replenish from QRNG only.
    on_key_acquired : async callable | None
        Optional BellGenT integration hook – called after every successful
        ``acquire()`` with the :class:`PooledKey`.
    cert / ca_bundle : passed through to :class:`ETSIQKD014Client`.
    """

    _PLACEHOLDER_KME_HOSTS = frozenset(
        {"", "none", "disabled", "qrng-only", "https://kme.example.com"}
    )

    @classmethod
    def kme_url_enabled(cls, kme_base_url: str | None) -> bool:
        url = (kme_base_url or "").strip().rstrip("/")
        return url.lower() not in cls._PLACEHOLDER_KME_HOSTS

    def __init__(
        self,
        *,
        kme_id: str,
        kme_base_url: str,
        slave_sae_id: str,
        key_size_bits: int = 256,
        high_watermark: int = 512,
        low_watermark: int = 64,
        replenish_batch: int = 128,
        qrng_fallback: bool = True,
        qrng_client: QBCKQRNGClient | None = None,
        use_kme: bool | None = None,
        on_key_acquired: Callable[[PooledKey], Awaitable[None]] | None = None,
        cert: tuple[str, str] | None = None,
        ca_bundle: str | None = None,
    ) -> None:
        self._kme_id = kme_id
        self._slave = slave_sae_id
        self._key_size = key_size_bits
        self._high = high_watermark
        self._low = low_watermark
        self._batch = min(replenish_batch, high_watermark)
        self._qrng_fallback = qrng_fallback
        self._qrng_client = qrng_client
        self._use_kme = (
            use_kme if use_kme is not None else self.kme_url_enabled(kme_base_url)
        )
        self._on_key_acquired = on_key_acquired

        sae_pair = f"{kme_id}:{slave_sae_id}"
        self._metric_labels = {"kme_id": kme_id, "sae_pair": sae_pair}

        self._pool: deque[PooledKey] = deque()
        self._lock = asyncio.Lock()
        self._replenish_event = asyncio.Event()
        self._running = False
        self._bg_task: asyncio.Task | None = None

        self._client = ETSIQKD014Client(
            kme_base_url,
            slave_sae_id,
            cert=cert,
            ca_bundle=ca_bundle,
        )

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def start(self) -> None:
        """Open the HTTP client and seed the pool, then launch the background
        replenishment loop."""
        if self._use_kme:
            await self._client._open()
        elif self._qrng_client is None:
            raise RuntimeError(
                "QRNG-only mode requires a configured QBCKQRNGClient "
                "(set QRNG_API_KEY)."
            )
        else:
            await self._qrng_client._open()

        self._running = True
        # Initial fill
        await self._replenish()
        self._bg_task = asyncio.create_task(
            self._replenishment_loop(), name=f"pool-replenish-{self._kme_id}"
        )
        log.info(
            "key_pool.started",
            kme=self._kme_id,
            depth=len(self._pool),
            use_kme=self._use_kme,
        )

    async def stop(self) -> None:
        """Graceful shutdown."""
        self._running = False
        if self._bg_task:
            self._bg_task.cancel()
            try:
                await self._bg_task
            except asyncio.CancelledError:
                pass
        if self._use_kme:
            await self._client.close()
        if self._qrng_client is not None:
            await self._qrng_client.close()
        log.info("key_pool.stopped", kme=self._kme_id)

    async def __aenter__(self) -> "ETSIKeyPoolManager":
        await self.start()
        return self

    async def __aexit__(self, *_) -> None:
        await self.stop()

    # ── Public API ────────────────────────────────────────────────────────────

    async def acquire(self) -> PooledKey:
        """
        Pop one key from the pool.

        Falls back to QRNG synthesis if the pool is empty and ``qrng_fallback``
        is enabled.  Signals the background loop to replenish.
        """
        key: PooledKey | None = None
        source_label = "pool"

        async with self._lock:
            if self._pool:
                key = self._pool.popleft()
            elif not self._qrng_fallback:
                raise RuntimeError(
                    f"Key pool for KME '{self._kme_id}' is exhausted and QRNG "
                    "fallback is disabled."
                )

        if key is None:
            key = await self._synthesise_qrng_key()
            source_label = "qrng"
            log.warning("key_pool.qrng_fallback", kme=self._kme_id)

        async with self._lock:
            _ACQUIRE_TOTAL.labels(**self._metric_labels, source=source_label).inc()
            _POOL_DEPTH.labels(**self._metric_labels).set(len(self._pool))

            if len(self._pool) < self._low:
                self._replenish_event.set()

        # BellGenT integration hook (outside lock to avoid blocking)
        if self._on_key_acquired:
            try:
                await self._on_key_acquired(key)
            except Exception as exc:
                log.warning("bellgent.hook_error", error=str(exc))

        return key

    async def pool_depth(self) -> int:
        async with self._lock:
            return len(self._pool)

    async def drain(self) -> list[PooledKey]:
        """Return and clear all pooled keys (e.g. for re-keying events)."""
        async with self._lock:
            keys = list(self._pool)
            self._pool.clear()
            _POOL_DEPTH.labels(**self._metric_labels).set(0)
        return keys

    # ── Background replenishment ──────────────────────────────────────────────

    async def _replenishment_loop(self) -> None:
        while self._running:
            await self._replenish_event.wait()
            self._replenish_event.clear()
            async with self._lock:
                current = len(self._pool)
                want = min(self._batch, self._high - current)
            if want > 0:
                await self._replenish(want)

    async def _synthesise_qrng_key(self) -> PooledKey:
        """Fetch one key from the real QRNG API, with optional secrets fallback."""
        n_bytes = self._key_size // 8
        if self._qrng_client is not None:
            try:
                material = await self._qrng_client.fetch_one(n_bytes)
                return PooledKey.from_qrng(material, size_bits=self._key_size)
            except Exception as exc:
                log.warning("key_pool.qrng_fetch_failed", error=str(exc))
        return PooledKey.from_secrets(self._key_size)

    async def _synthesise_qrng_keys(self, count: int) -> list[PooledKey]:
        n_bytes = self._key_size // 8
        if self._qrng_client is not None:
            try:
                pooled: list[PooledKey] = []
                remaining = count
                while remaining > 0:
                    batch = min(32, remaining)
                    blocks = await self._qrng_client.fetch_bytes(
                        nbytes=n_bytes, count=batch
                    )
                    pooled.extend(
                        PooledKey.from_qrng(block, size_bits=self._key_size)
                        for block in blocks
                    )
                    remaining -= batch
                return pooled
            except Exception as exc:
                log.warning("key_pool.qrng_batch_fetch_failed", error=str(exc))
        return [PooledKey.from_secrets(self._key_size) for _ in range(count)]

    async def _extend_pool(self, pooled: list[PooledKey]) -> None:
        async with self._lock:
            self._pool.extend(pooled)
            _POOL_DEPTH.labels(**self._metric_labels).set(len(self._pool))

    async def _replenish(self, count: int | None = None) -> None:
        """Fetch keys from the KME and/or QRNG and push them into the pool."""
        async with self._lock:
            current = len(self._pool)
            want = count if count is not None else min(self._batch, self._high - current)
            if want <= 0:
                return

        if not self._use_kme:
            pooled = await self._synthesise_qrng_keys(want)
            await self._extend_pool(pooled)
            depth = await self.pool_depth()
            log.info(
                "key_pool.replenished_qrng",
                kme=self._kme_id,
                added=len(pooled),
                pool_depth=depth,
            )
            return

        t0 = time.monotonic()
        try:
            etsi_keys = await self._replenish_from_kme(want)
        except Exception as exc:
            log.warning(
                "key_pool.replenish_failed",
                kme=self._kme_id,
                error=str(exc),
            )
            if not self._qrng_fallback:
                raise
            log.warning(
                "key_pool.replenish_qrng_fallback",
                kme=self._kme_id,
                count=want,
            )
            pooled = await self._synthesise_qrng_keys(want)
            await self._extend_pool(pooled)
            return

        elapsed = time.monotonic() - t0
        _REPLENISH_LATENCY.labels(kme_id=self._kme_id).observe(elapsed)

        pooled = [PooledKey.from_etsi(ek) for ek in etsi_keys]
        await self._extend_pool(pooled)
        depth = await self.pool_depth()

        log.info(
            "key_pool.replenished",
            kme=self._kme_id,
            added=len(pooled),
            pool_depth=depth,
            latency_s=round(elapsed, 3),
        )

    @retry(
        retry=retry_if_exception_type(Exception),
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=30),
        reraise=True,
    )
    async def _replenish_from_kme(self, want: int) -> list[ETSIKey]:
        return await self._client.get_enc_keys(number=want, size=self._key_size)
