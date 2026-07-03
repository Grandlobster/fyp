"""
qrng_client.py
──────────────
Async client for the QBCK quantum random number generator (QRNG) REST API.

Fetches hex-encoded entropy blocks and converts them to raw bytes for key
material.  TLS verification uses the project-root ``chain.pem`` CA bundle.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
import structlog
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

log = structlog.get_logger(__name__)

_PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), os.pardir, os.pardir)
)
_DEFAULT_CA_BUNDLE = os.path.join(_PROJECT_ROOT, "chain.pem")
_DEFAULT_BASE = "https://qrng.qbck.io"


def default_ca_bundle() -> str:
    """Return path to the project-root chain.pem used for QRNG TLS verification."""
    return _DEFAULT_CA_BUNDLE


class QBCKQRNGClient:
    """
    QBCK QRNG hex block API client.

    Parameters
    ----------
    api_key : str
        QBCK API key (embedded in the request URL path).
    ca_bundle : str | None
        PEM file for TLS verification (defaults to project ``chain.pem``).
    timeout_s : float
        HTTP request timeout in seconds.
    """

    def __init__(
        self,
        api_key: str,
        *,
        ca_bundle: str | None = None,
        timeout_s: float = 30.0,
    ) -> None:
        if not api_key:
            raise ValueError("QRNG API key is required")
        self._api_key = api_key
        self._ca_bundle = ca_bundle or default_ca_bundle()
        self._timeout = timeout_s
        self._client: httpx.AsyncClient | None = None

    async def _open(self) -> None:
        if self._client is None:
            verify: str | bool = self._ca_bundle
            if not os.path.isfile(self._ca_bundle):
                log.warning(
                    "qrng.ca_bundle_missing",
                    path=self._ca_bundle,
                    hint="falling back to system CA store",
                )
                verify = True
            self._client = httpx.AsyncClient(
                timeout=self._timeout,
                verify=verify,
                headers={"X-API-KEY": self._api_key},
            )

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self) -> "QBCKQRNGClient":
        await self._open()
        return self

    async def __aexit__(self, *_) -> None:
        await self.close()

    def _block_url(self, *, count: int, nbytes: int) -> str:
        return (
            f"{_DEFAULT_BASE}/{self._api_key}/qbck/block/hex"
            f"?size={count}&length={nbytes}"
        )

    @staticmethod
    def _parse_hex_blocks(payload: dict[str, Any]) -> list[bytes]:
        blocks = payload.get("data", {}).get("result", [])
        if not blocks:
            raise ValueError("QRNG response contained no entropy blocks")
        out: list[bytes] = []
        for block in blocks:
            if not isinstance(block, str):
                raise ValueError(f"unexpected QRNG block type: {type(block)!r}")
            out.append(bytes.fromhex(block))
        return out

    @retry(
        retry=retry_if_exception_type((httpx.HTTPError, ValueError)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=10),
        reraise=True,
    )
    async def fetch_bytes(self, *, nbytes: int = 32, count: int = 1) -> list[bytes]:
        """
        Fetch ``count`` random blocks of ``nbytes`` each from the QRNG API.

        Returns a list of raw byte strings (one per block).
        """
        await self._open()
        assert self._client is not None

        url = self._block_url(count=count, nbytes=nbytes)
        resp = await self._client.get(url)
        resp.raise_for_status()
        blocks = self._parse_hex_blocks(resp.json())

        if len(blocks) != count:
            raise ValueError(
                f"QRNG returned {len(blocks)} blocks, expected {count}"
            )
        for block in blocks:
            if len(block) != nbytes:
                raise ValueError(
                    f"QRNG block length {len(block)} != requested {nbytes}"
                )

        log.debug("qrng.fetched", blocks=count, nbytes=nbytes)
        return blocks

    async def fetch_one(self, nbytes: int = 32) -> bytes:
        """Fetch a single entropy block."""
        return (await self.fetch_bytes(nbytes=nbytes, count=1))[0]
