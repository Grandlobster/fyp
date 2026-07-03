"""
tests/test_quantum_key_orchestrator.py
───────────────────────────────────────
Unit + integration tests for the quantum_key_orchestrator control plane.

Run with:
    pytest tests/test_quantum_key_orchestrator.py -v
"""

from __future__ import annotations

import asyncio
import math
import secrets
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import numpy as np

# ── Module imports ────────────────────────────────────────────────────────────

from quantum_key_orchestrator.fairness.jains_allocator import (
    jains_fairness_index,
    weighted_jains_index,
    max_min_fair_allocate,
    KeyFairnessAllocator,
    RouterRecord,
)
from quantum_key_orchestrator.etsi_client.etsi_qkd_014_client import ETSIKey
from quantum_key_orchestrator.etsi_client.key_pool_manager import (
    ETSIKeyPoolManager,
    PooledKey,
    KeySource,
)
from quantum_key_orchestrator.sequence_backbone.backbone import (
    QubitState,
    BellPair,
    TickingQubitHandshake,
    apply_clifford_sequence,
    clifford_encode_key_bit,
    pump_entanglement,
    nested_pump_entanglement,
    CLIFFORD_GROUP_1Q,
    QKDProtocol,
    QuantumBackbone,
    MS,
)


# ═══════════════════════════════════════════════════════════════════════════════
# Jain's Fairness Index
# ═══════════════════════════════════════════════════════════════════════════════

class TestJainsFairnessIndex:
    def test_perfect_equality(self):
        assert math.isclose(jains_fairness_index([1, 1, 1]), 1.0, rel_tol=1e-9)

    def test_single_router(self):
        assert math.isclose(jains_fairness_index([5]), 1.0, rel_tol=1e-9)

    def test_extreme_inequality(self):
        # One router gets everything
        j = jains_fairness_index([100, 0, 0])
        assert math.isclose(j, 1 / 3, rel_tol=1e-6)

    def test_two_equal(self):
        assert math.isclose(jains_fairness_index([4, 4]), 1.0, rel_tol=1e-9)

    def test_two_unequal(self):
        j = jains_fairness_index([3, 1])
        # (3+1)^2 / (2*(9+1)) = 16/20 = 0.8
        assert math.isclose(j, 0.8, rel_tol=1e-6)

    def test_all_zero(self):
        assert jains_fairness_index([0, 0, 0]) == 1.0

    def test_empty(self):
        assert jains_fairness_index([]) == 1.0

    def test_three_routers_partial(self):
        j = jains_fairness_index([3, 3, 1])
        assert 0.9 < j < 1.0

    def test_weighted_equal_normalised(self):
        # Router A gets 2× the keys but also has weight 2 → equally fair
        j = weighted_jains_index([200, 100], [2.0, 1.0])
        assert math.isclose(j, 1.0, rel_tol=1e-6)

    def test_weighted_unequal(self):
        j = weighted_jains_index([200, 50], [2.0, 1.0])
        # normalised: [100, 50] → not equal → J < 1
        assert j < 1.0


class TestMaxMinFairAllocate:
    def test_all_satisfied(self):
        allocs = max_min_fair_allocate([10, 10, 10], capacity=100)
        assert allocs == [10.0, 10.0, 10.0]

    def test_capacity_constrained(self):
        allocs = max_min_fair_allocate([100, 100], capacity=100)
        assert math.isclose(sum(allocs), 100.0, rel_tol=1e-6)
        assert math.isclose(allocs[0], allocs[1], rel_tol=1e-6)

    def test_one_router_bottleneck(self):
        # Router A wants 10, B wants 200; capacity 100
        allocs = max_min_fair_allocate([10, 200], capacity=100)
        assert allocs[0] == 10.0
        assert math.isclose(allocs[1], 90.0, rel_tol=1e-6)

    def test_weighted_allocation(self):
        allocs = max_min_fair_allocate([100, 100], capacity=60, weights=[2.0, 1.0])
        # Weight 2 router gets 40, weight 1 router gets 20
        assert math.isclose(allocs[0], 40.0, rel_tol=1e-6)
        assert math.isclose(allocs[1], 20.0, rel_tol=1e-6)

    def test_zero_capacity(self):
        allocs = max_min_fair_allocate([10, 20], capacity=0)
        assert allocs == [0.0, 0.0]

    def test_empty_demands(self):
        assert max_min_fair_allocate([], capacity=100) == []


class TestKeyFairnessAllocator:
    def _make_allocator(self, total=100):
        a = KeyFairnessAllocator(total_keys_per_epoch=total)
        a.register_router("r1", weight=1.0)
        a.register_router("r2", weight=1.0)
        return a

    def test_equal_demand_equal_allocation(self):
        a = self._make_allocator(100)
        a.set_demand("r1", 50)
        a.set_demand("r2", 50)
        result = a.allocate()
        assert result["r1"] == result["r2"]

    def test_total_does_not_exceed_capacity(self):
        a = self._make_allocator(100)
        a.set_demand("r1", 200)
        a.set_demand("r2", 200)
        result = a.allocate()
        assert sum(result.values()) <= 100

    def test_jfi_updated_after_epoch(self):
        a = self._make_allocator(100)
        a.set_demand("r1", 50)
        a.set_demand("r2", 50)
        a.allocate()
        assert 0.0 < a.jains_index() <= 1.0

    def test_starvation_recovery(self):
        """A starved router must receive at least 1 key after starvation_limit epochs."""
        a = KeyFairnessAllocator(total_keys_per_epoch=100, starvation_limit=2)
        a.register_router("greedy",  weight=100.0)
        a.register_router("starved", weight=0.01)
        a.set_demand("greedy",  100)
        a.set_demand("starved", 10)
        # Run past starvation limit
        for _ in range(3):
            a.allocate()
        result = a.allocate()
        assert result["starved"] >= 1

    def test_history_grows(self):
        a = self._make_allocator()
        a.set_demand("r1", 10)
        a.set_demand("r2", 10)
        a.allocate()
        a.allocate()
        assert len(a.allocation_history()) == 2

    def test_router_stats(self):
        a = self._make_allocator()
        a.set_demand("r1", 30)
        a.set_demand("r2", 20)
        a.allocate()
        stats = a.router_stats()
        assert "r1" in stats
        assert stats["r1"]["total_served"] > 0


# ═══════════════════════════════════════════════════════════════════════════════
# Clifford operations
# ═══════════════════════════════════════════════════════════════════════════════

class TestCliffordOperations:
    def test_identity(self):
        q = QubitState()
        q2 = apply_clifford_sequence(q, ["I"])
        np.testing.assert_allclose(q2.state, q.state, atol=1e-12)

    def test_x_flips_zero(self):
        q = QubitState()   # |0⟩
        q2 = apply_clifford_sequence(q, ["X"])
        # Should be |1⟩
        assert abs(q2.state[1]) > 0.99

    def test_h_creates_superposition(self):
        q = QubitState()
        q2 = apply_clifford_sequence(q, ["H"])
        # |+⟩ = (|0⟩+|1⟩)/√2
        np.testing.assert_allclose(
            abs(q2.state[0]), 1 / math.sqrt(2), atol=1e-9
        )

    def test_hsh_x_equivalence(self):
        """H·S·H maps X→Y (up to global phase); we check the state norm."""
        q = QubitState()
        q2 = apply_clifford_sequence(q, ["H", "S", "H"])
        assert math.isclose(np.linalg.norm(q2.state), 1.0, rel_tol=1e-9)

    def test_z_basis_measurement_reproducible(self):
        """After measurement, the state should collapse to a basis state."""
        import random
        random.seed(42)
        q = QubitState()
        q.apply("H")
        bit = q.measure_z()
        assert bit in (0, 1)
        # State should now be a basis vector
        assert math.isclose(abs(q.state[0]) + abs(q.state[1]), 1.0, rel_tol=1e-9)

    def test_clifford_encode_returns_gate_list(self):
        gates = clifford_encode_key_bit(0)
        assert isinstance(gates, list)
        assert all(g in CLIFFORD_GROUP_1Q for g in gates)

    def test_clifford_randomise_key_length_preserved(self):
        from quantum_key_orchestrator.sequence_backbone.backbone import QuantumBackbone
        bb = QuantumBackbone()
        key = secrets.token_bytes(32)
        randomised = bb.clifford_randomise_key(key)
        assert len(randomised) == len(key)


# ═══════════════════════════════════════════════════════════════════════════════
# Entanglement pumping
# ═══════════════════════════════════════════════════════════════════════════════

class TestEntanglementPumping:
    def _make_pairs(self, n: int, fidelity: float = 0.80) -> list[BellPair]:
        return [BellPair(node_a="A", node_b="B", fidelity=fidelity)
                for _ in range(n)]

    def test_pump_increases_fidelity(self):
        pairs = self._make_pairs(8, fidelity=0.80)
        result = pump_entanglement(pairs, target_fidelity=0.95)
        assert result is not None
        assert result.fidelity > 0.80

    def test_pump_single_pair_no_improvement(self):
        """With a single pair there is nothing to distil from; should return it."""
        pairs = self._make_pairs(1, fidelity=0.90)
        result = pump_entanglement(pairs)
        assert result is not None
        assert result.fidelity >= 0.90

    def test_pump_empty_returns_none(self):
        assert pump_entanglement([]) is None

    def test_pump_marks_purified(self):
        pairs = self._make_pairs(4, fidelity=0.80)
        result = pump_entanglement(pairs)
        assert result.is_purified

    def test_nested_pump_increases_fidelity(self):
        pairs = self._make_pairs(16, fidelity=0.75)
        result = nested_pump_entanglement(
            pairs, nesting_depth=2, pairs_per_round=4, target_fidelity=0.999
        )
        assert result is not None
        assert result.fidelity > 0.75

    def test_nested_pump_level_recorded(self):
        pairs = self._make_pairs(16, fidelity=0.80)
        result = nested_pump_entanglement(pairs, nesting_depth=2, pairs_per_round=4)
        assert result.pump_level > 0

    def test_nested_pump_insufficient_pairs(self):
        """Only 1 pair → should return it gracefully."""
        pairs = self._make_pairs(1, fidelity=0.90)
        result = nested_pump_entanglement(pairs, nesting_depth=2, pairs_per_round=4)
        # May return None or the single pair; must not raise
        assert result is None or isinstance(result, BellPair)


# ═══════════════════════════════════════════════════════════════════════════════
# Ticking-qubit handshake
# ═══════════════════════════════════════════════════════════════════════════════

class TestTickingQubitHandshake:
    def test_sync_within_tolerance(self):
        from quantum_key_orchestrator.sequence_backbone.backbone import NS
        delay = 10 * NS   # 10 ns one-way
        hs = TickingQubitHandshake("A", "B", channel_delay_ps=delay,
                                   tolerance_ps=500 * NS)
        tick = hs.emit_tick(current_time_ps=0)
        hs.receive_and_ack(tick, arrival_time_ps=delay)
        synced = hs.verify_ack(ack_time_ps=2 * delay)
        assert synced

    def test_sync_fails_outside_tolerance(self):
        from quantum_key_orchestrator.sequence_backbone.backbone import NS
        delay = 10 * NS
        hs = TickingQubitHandshake("A", "B", channel_delay_ps=delay,
                                   tolerance_ps=1)  # 1 ps tolerance
        tick = hs.emit_tick(current_time_ps=0)
        hs.receive_and_ack(tick, arrival_time_ps=delay)
        # Inject a large jitter
        synced = hs.verify_ack(ack_time_ps=5 * delay)
        assert not synced


# ═══════════════════════════════════════════════════════════════════════════════
# ETSI Key Pool Manager (mocked KME)
# ═══════════════════════════════════════════════════════════════════════════════

class TestETSIKeyPoolManager:
    def _fake_etsi_key(self) -> ETSIKey:
        return ETSIKey(
            key_ID=str(uuid.uuid4()),
            key=secrets.token_bytes(32),
        )

    @pytest.mark.asyncio
    async def test_acquire_returns_key(self):
        """Pool pre-seeded with 5 keys; acquire should succeed."""
        manager = ETSIKeyPoolManager(
            kme_id="kme-test",
            kme_base_url="https://kme.example.com",
            slave_sae_id="sae-bob",
            qrng_fallback=True,
        )
        # Manually seed pool (bypass KME HTTP)
        from quantum_key_orchestrator.etsi_client.key_pool_manager import PooledKey, KeySource
        for _ in range(5):
            manager._pool.append(
                PooledKey(
                    key_id=str(uuid.uuid4()),
                    key_material=secrets.token_bytes(32),
                    size_bits=256,
                    source=KeySource.QKD,
                )
            )
        key = await manager.acquire()
        assert isinstance(key, PooledKey)
        assert key.source == KeySource.QKD

    @pytest.mark.asyncio
    async def test_qrng_fallback_when_pool_empty(self):
        manager = ETSIKeyPoolManager(
            kme_id="kme-test",
            kme_base_url="https://kme.example.com",
            slave_sae_id="sae-bob",
            qrng_fallback=True,
        )
        # Pool is empty – should fall back to QRNG
        key = await manager.acquire()
        assert key.source == KeySource.QRNG

    @pytest.mark.asyncio
    async def test_no_fallback_raises(self):
        manager = ETSIKeyPoolManager(
            kme_id="kme-test",
            kme_base_url="https://kme.example.com",
            slave_sae_id="sae-bob",
            qrng_fallback=False,
        )
        with pytest.raises(RuntimeError, match="exhausted"):
            await manager.acquire()

    @pytest.mark.asyncio
    async def test_pool_depth(self):
        manager = ETSIKeyPoolManager(
            kme_id="kme-test",
            kme_base_url="https://kme.example.com",
            slave_sae_id="sae-bob",
            qrng_fallback=True,
        )
        from quantum_key_orchestrator.etsi_client.key_pool_manager import PooledKey, KeySource
        for _ in range(3):
            manager._pool.append(PooledKey(
                key_id=str(uuid.uuid4()),
                key_material=secrets.token_bytes(32),
                size_bits=256,
                source=KeySource.QKD,
            ))
        depth = await manager.pool_depth()
        assert depth == 3
