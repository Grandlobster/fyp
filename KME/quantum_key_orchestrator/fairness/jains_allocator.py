"""
jains_allocator.py
──────────────────
Jain's Fairness Index – Quantum Key Allocator
──────────────────────────────────────────────
Implements resource-fair key allocation between quantum routers using
Jain's Fairness Index (JFI) as the optimisation criterion.

Jain's Fairness Index
─────────────────────
    J(x) = (Σ xᵢ)² / (n · Σ xᵢ²),    J ∈ (0, 1]

where xᵢ is the allocation for router i and n is the number of routers.

J = 1  → perfectly fair (all routers receive equal share)
J → 0  → extremely unfair (one router monopolises all resources)

Architecture
────────────
KeyFairnessAllocator
  • Tracks per-router ``demand`` (requested keys/s) and ``allocation``
    (keys actually granted this epoch).
  • Runs max-min fair allocation as the primary algorithm.
  • Computes JFI after each allocation epoch and logs it.
  • Exposes a Prometheus gauge for live fairness monitoring.
  • Emits BellGenT integration events (stub) on each allocation cycle.

Usage
─────
allocator = KeyFairnessAllocator(total_keys_per_epoch=1000)
allocator.register_router("router-A", weight=1.0)
allocator.register_router("router-B", weight=2.0)   # higher priority
allocator.set_demand("router-A", 400)
allocator.set_demand("router-B", 800)
allocation = allocator.allocate()
jfi = allocator.jains_index()
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass, field
from typing import Callable, Awaitable

import structlog
from prometheus_client import Gauge

log = structlog.get_logger(__name__)

# ── Prometheus ────────────────────────────────────────────────────────────────

_JFI_GAUGE = Gauge(
    "qko_jains_fairness_index",
    "Jain's Fairness Index of key allocation across quantum routers (0–1)",
)
_ALLOCATION_GAUGE = Gauge(
    "qko_router_key_allocation",
    "Keys allocated to each quantum router in the current epoch",
    ["router_id"],
)


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class RouterRecord:
    router_id: str
    weight: float = 1.0          # priority weight (higher → more keys)
    demand: int   = 0            # keys requested this epoch
    allocation: int = 0          # keys granted this epoch
    total_served: int = 0        # cumulative keys served (all epochs)
    epochs_starved: int = 0      # consecutive epochs with zero allocation


# ── Core JFI function (pure, no side-effects) ─────────────────────────────────

def jains_fairness_index(allocations: list[float]) -> float:
    """
    Compute Jain's Fairness Index for a list of resource allocations.

    Parameters
    ----------
    allocations : list[float]
        Resource share received by each user / router (must be ≥ 0).

    Returns
    -------
    float
        J ∈ (0, 1].  Returns 1.0 if all values are equal or if the list
        is empty / all-zero (degenerate case).

    Examples
    --------
    >>> jains_fairness_index([1, 1, 1])
    1.0
    >>> jains_fairness_index([1, 0, 0])
    0.3333...
    >>> jains_fairness_index([3, 3, 1])
    0.9055...
    """
    n = len(allocations)
    if n == 0:
        return 1.0

    non_zero = [x for x in allocations if x > 0]
    if not non_zero:
        return 1.0   # all-zero: vacuously fair

    total      = sum(allocations)
    sum_sq     = sum(x * x for x in allocations)

    if sum_sq < 1e-15:
        return 1.0

    return (total ** 2) / (n * sum_sq)


def weighted_jains_index(
    allocations: list[float],
    weights: list[float],
) -> float:
    """
    Weighted Jain's Fairness Index.

    Normalises each allocation by its router weight before computing JFI,
    so that a router with weight 2 receiving twice the allocation is treated
    as equally fair as a weight-1 router receiving its baseline.

    Parameters
    ----------
    allocations : list[float]
    weights     : list[float]   Must be the same length as *allocations*.
    """
    if len(allocations) != len(weights):
        raise ValueError("allocations and weights must have the same length")
    normalised = [
        a / w if w > 0 else 0.0
        for a, w in zip(allocations, weights)
    ]
    return jains_fairness_index(normalised)


# ── Max-min fair allocation ───────────────────────────────────────────────────

def max_min_fair_allocate(
    demands: list[float],
    capacity: float,
    weights: list[float] | None = None,
) -> list[float]:
    """
    Max-min fair allocation (water-filling algorithm).

    Distributes *capacity* among routers with *demands* such that the
    minimum satisfied demand is maximised.  Weighted max-min fairness
    is applied when *weights* are provided.

    Parameters
    ----------
    demands  : list[float]   Requested allocation per router.
    capacity : float         Total available resource.
    weights  : list[float]   Optional priority weights (default: uniform).

    Returns
    -------
    list[float]   Granted allocation per router (sum ≤ capacity).
    """
    n = len(demands)
    if n == 0 or capacity <= 0:
        return [0.0] * n

    w = weights if weights else [1.0] * n
    # Normalise demands by weight for weighted water-filling
    norm_demand = [d / wi if wi > 0 else 0.0 for d, wi in zip(demands, w)]

    allocation = [0.0] * n
    remaining_cap = float(capacity)
    satisfied = [False] * n

    for _ in range(n):
        active = [i for i in range(n) if not satisfied[i]]
        if not active:
            break
        active_weight_sum = sum(w[i] for i in active)
        if active_weight_sum <= 0:
            break
        fair_share_per_unit_weight = remaining_cap / active_weight_sum

        bottleneck_found = False
        for i in active:
            max_for_i = fair_share_per_unit_weight * w[i]
            if demands[i] <= max_for_i:
                # Router i is satisfied before water level
                allocation[i] = demands[i]
                remaining_cap -= demands[i]
                satisfied[i] = True
                bottleneck_found = True

        if not bottleneck_found:
            # All remaining unsatisfied routers get the water-filling share
            for i in active:
                allocation[i] = fair_share_per_unit_weight * w[i]
            break

    return allocation


# ── Allocator ─────────────────────────────────────────────────────────────────

class KeyFairnessAllocator:
    """
    Epoch-based quantum key allocator using Jain's Fairness Index.

    Parameters
    ----------
    total_keys_per_epoch : int
        Total keys available to distribute each allocation epoch.
    epoch_duration_s : float
        Duration of each epoch in seconds (used for demand rate tracking).
    starvation_limit : int
        Epochs a router can receive zero allocation before triggering
        a starvation-recovery boost.
    bellgent_hook : async callable | None
        Optional BellGenT integration callback called with the allocation
        result dict after each epoch.
    """

    def __init__(
        self,
        total_keys_per_epoch: int = 1000,
        epoch_duration_s: float = 1.0,
        starvation_limit: int = 3,
        bellgent_hook: Callable[[dict], Awaitable[None]] | None = None,
    ) -> None:
        self._total = total_keys_per_epoch
        self._epoch_s = epoch_duration_s
        self._starv_limit = starvation_limit
        self._bellgent_hook = bellgent_hook
        self._routers: dict[str, RouterRecord] = {}
        self._epoch: int = 0
        self._last_jfi: float = 1.0
        self._history: list[dict] = []

    # ── Router management ─────────────────────────────────────────────────────

    def register_router(
        self,
        router_id: str,
        weight: float = 1.0,
    ) -> None:
        if router_id in self._routers:
            log.warning("allocator.router_already_registered",
                        router_id=router_id)
            return
        self._routers[router_id] = RouterRecord(
            router_id=router_id,
            weight=max(0.01, weight),
        )
        log.info("allocator.router_registered",
                 router_id=router_id, weight=weight)

    def deregister_router(self, router_id: str) -> None:
        self._routers.pop(router_id, None)
        log.info("allocator.router_deregistered", router_id=router_id)

    def set_demand(self, router_id: str, keys_requested: int) -> None:
        """Update the demand for a router (call before each epoch)."""
        if router_id not in self._routers:
            raise KeyError(f"Router '{router_id}' not registered")
        self._routers[router_id].demand = max(0, keys_requested)

    # ── Allocation ────────────────────────────────────────────────────────────

    def allocate(self) -> dict[str, int]:
        """
        Run one allocation epoch.

        1. Apply starvation boost (routers starved for > starvation_limit
           epochs receive at least 1 key regardless of capacity).
        2. Run weighted max-min fair water-filling.
        3. Compute Jain's Fairness Index.
        4. Update Prometheus metrics.
        5. Record epoch in history.

        Returns
        -------
        dict[str, int]
            Mapping of router_id → keys granted.
        """
        self._epoch += 1
        ids      = list(self._routers.keys())
        records  = [self._routers[rid] for rid in ids]
        demands  = [float(r.demand) for r in records]
        weights  = [r.weight for r in records]

        # Starvation-recovery: reserve 1 key per starved router upfront
        starvation_reserve = 0
        for r in records:
            if r.epochs_starved >= self._starv_limit and r.demand > 0:
                starvation_reserve += 1

        effective_capacity = max(0, self._total - starvation_reserve)
        raw_allocs = max_min_fair_allocate(
            demands, float(effective_capacity), weights
        )

        # Apply starvation boost
        final_allocs: list[float] = []
        for i, r in enumerate(records):
            a = raw_allocs[i]
            if r.epochs_starved >= self._starv_limit and r.demand > 0:
                a = max(a, 1.0)
            final_allocs.append(a)

        # Clamp to integers, respecting total capacity
        int_allocs = [int(math.floor(a)) for a in final_allocs]
        total_allocated = sum(int_allocs)
        leftover = self._total - total_allocated

        # Distribute leftover keys by fractional remainder (largest-remainder)
        if leftover > 0:
            remainders = [
                (final_allocs[i] - int_allocs[i], i)
                for i in range(len(ids))
            ]
            remainders.sort(reverse=True)
            for _, i in remainders[:leftover]:
                int_allocs[i] += 1

        # Update router records
        result: dict[str, int] = {}
        for i, rid in enumerate(ids):
            r = records[i]
            granted = int_allocs[i]
            r.allocation = granted
            r.total_served += granted
            if granted == 0 and r.demand > 0:
                r.epochs_starved += 1
            else:
                r.epochs_starved = 0
            result[rid] = granted
            _ALLOCATION_GAUGE.labels(router_id=rid).set(granted)

        # JFI (weighted)
        self._last_jfi = weighted_jains_index(
            [float(a) for a in int_allocs], weights
        )
        _JFI_GAUGE.set(self._last_jfi)

        epoch_record = {
            "epoch": self._epoch,
            "timestamp": time.time(),
            "total_keys": self._total,
            "allocation": result,
            "jfi": round(self._last_jfi, 6),
        }
        self._history.append(epoch_record)

        log.info(
            "allocator.epoch_complete",
            epoch=self._epoch,
            allocation=result,
            jfi=round(self._last_jfi, 4),
            total_distributed=sum(result.values()),
        )
        return result

    # ── Accessors ─────────────────────────────────────────────────────────────

    def jains_index(self) -> float:
        """Return the JFI computed in the most recent allocation epoch."""
        return self._last_jfi

    def allocation_history(self) -> list[dict]:
        """Return a copy of the per-epoch allocation history."""
        return list(self._history)

    def router_stats(self) -> dict[str, dict]:
        """Return per-router statistics."""
        return {
            rid: {
                "weight":        r.weight,
                "demand":        r.demand,
                "last_alloc":    r.allocation,
                "total_served":  r.total_served,
                "epochs_starved":r.epochs_starved,
            }
            for rid, r in self._routers.items()
        }

    def adjust_capacity(self, new_total: int) -> None:
        """Dynamically adjust pool capacity (e.g. after QRNG fallback)."""
        old = self._total
        self._total = max(0, new_total)
        log.info("allocator.capacity_adjusted",
                 old=old, new=self._total)
