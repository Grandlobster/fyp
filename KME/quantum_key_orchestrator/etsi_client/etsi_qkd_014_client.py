"""
etsi_qkd_014_client.py
──────────────────────
Thin async client that speaks the ETSI GS QKD 014 v1 REST schema.

Endpoints implemented
  GET  /api/v1/keys/{slave_SAE_ID}/status
  POST /api/v1/keys/{slave_SAE_ID}/enc_keys      (fetch N key containers)
  POST /api/v1/keys/{slave_SAE_ID}/dec_keys      (fetch by key-ID list)

Reference: ETSI GS QKD 014 V1.1.1 (2019-02), §7.
"""

from __future__ import annotations

import asyncio
import base64
import os
import uuid
from dataclasses import dataclass, field
from typing import Any

import httpx
import structlog

log = structlog.get_logger(__name__)

# ── Data classes matching the ETSI JSON schema ────────────────────────────────

@dataclass(frozen=True)
class ETSIKey:
    """A single quantum key container as returned by the KME."""
    key_ID: str          # UUID string
    key: bytes           # raw key material (decoded from Base64)
    key_ID_extension: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_json(cls, obj: dict[str, Any]) -> "ETSIKey":
        raw = base64.b64decode(obj["key"])
        return cls(
            key_ID=obj["key_ID"],
            key=raw,
            key_ID_extension=obj.get("key_ID_extension", {}),
        )

    def to_hex(self) -> str:
        return self.key.hex()


@dataclass
class KMEStatus:
    source_KME_ID: str
    target_KME_ID: str
    master_SAE_ID: str
    slave_SAE_ID: str
    key_size: int          # bits
    stored_key_count: int
    max_key_count: int
    max_key_per_request: int
    max_key_size: int
    min_key_size: int
    max_SAE_ID_count: int

    @classmethod
    def from_json(cls, obj: dict[str, Any]) -> "KMEStatus":
        return cls(**{k: obj[k] for k in cls.__dataclass_fields__})  # type: ignore[attr-defined]


# ── Client ────────────────────────────────────────────────────────────────────

class ETSIQKD014Client:
    """
    Async ETSI QKD 014 client.

    Parameters
    ----------
    kme_base_url : str
        Base URL of the Key Management Entity, e.g. ``https://kme1.example.com``
    slave_sae_id : str
        The SAE ID of the remote (slave) peer.
    cert : tuple[str, str] | None
        (client_cert_path, client_key_path) for mutual TLS.
    ca_bundle : str | None
        Path to CA bundle for server-certificate verification.
    timeout : float
        HTTP request timeout in seconds.
    """

    _API_PREFIX = "/api/v1/keys"

    def __init__(
        self,
        kme_base_url: str,
        slave_sae_id: str,
        *,
        cert: tuple[str, str] | None = None,
        ca_bundle: str | None = None,
        timeout: float = 10.0,
    ) -> None:
        self._base = kme_base_url.rstrip("/")
        self._slave = slave_sae_id
        self._timeout = httpx.Timeout(timeout)
        self._client: httpx.AsyncClient | None = None
        self._cert = cert
        self._ca = ca_bundle

    # ── lifecycle ─────────────────────────────────────────────────────────────

    async def __aenter__(self) -> "ETSIQKD014Client":
        await self._open()
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.close()

    async def _open(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=self._base,
            cert=self._cert,
            verify=self._ca if self._ca else True,
            timeout=self._timeout,
            http2=True,
        )

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    def _c(self) -> httpx.AsyncClient:
        if self._client is None:
            raise RuntimeError("Client not opened – use async-with or call _open()")
        return self._client

    # ── ETSI endpoints ────────────────────────────────────────────────────────

    async def get_status(self) -> KMEStatus:
        """GET /api/v1/keys/{slave_SAE_ID}/status"""
        url = f"{self._API_PREFIX}/{self._slave}/status"
        resp = await self._c().get(url)
        resp.raise_for_status()
        return KMEStatus.from_json(resp.json())

    async def get_enc_keys(
        self,
        number: int = 1,
        size: int = 256,
        additional_slave_sae_ids: list[str] | None = None,
        extension_mandatory: list[dict] | None = None,
    ) -> list[ETSIKey]:
        """
        POST /api/v1/keys/{slave_SAE_ID}/enc_keys

        Fetch *number* key containers of *size* bits each.
        Returns a list of :class:`ETSIKey`.
        """
        payload: dict[str, Any] = {"number": number, "size": size}
        if additional_slave_sae_ids:
            payload["additional_slave_SAE_IDs"] = additional_slave_sae_ids
        if extension_mandatory:
            payload["extension_mandatory"] = extension_mandatory

        url = f"{self._API_PREFIX}/{self._slave}/enc_keys"
        resp = await self._c().post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        keys = [ETSIKey.from_json(k) for k in data["keys"]]
        log.info("etsi.enc_keys_fetched", count=len(keys), size_bits=size)
        return keys

    async def get_dec_keys(self, key_ids: list[str]) -> list[ETSIKey]:
        """
        POST /api/v1/keys/{slave_SAE_ID}/dec_keys

        Fetch key material by key-ID (used by the decrypting / slave side).
        """
        payload = {"key_IDs": [{"key_ID": kid} for kid in key_ids]}
        url = f"{self._API_PREFIX}/{self._slave}/dec_keys"
        resp = await self._c().post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        keys = [ETSIKey.from_json(k) for k in data["keys"]]
        log.info("etsi.dec_keys_fetched", count=len(keys))
        return keys
