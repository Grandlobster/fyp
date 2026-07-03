//! Client for the external Quantum Key Orchestrator
//! (`quantum_key_orchestrator/api/grpc_server.py`).
//!
//! This node never generates quantum key material. All symmetric key
//! material is *acquired* from the orchestrator's ETSI-pool-backed,
//! Jain's-fairness-governed allocator, via the `ExternalKeyPool` trait
//! defined here. `GrpcKeyPoolClient` is the production implementation
//! talking to the real Python servicer; tests/dev can supply an
//! in-memory fake implementing the same trait.
//!
//! Important semantic difference from a plain "fetch by ID" store: the
//! orchestrator runs a fairness allocator across registered routers. A
//! call to `acquire_keys` can legitimately return FEWER keys than
//! requested (or be rejected outright with RESOURCE_EXHAUSTED) if the
//! allocator's current epoch hasn't granted this router enough budget.
//! Callers must handle partial grants, not just hard errors.

use async_trait::async_trait;
use std::time::Duration;
use tonic::transport::Channel;
use tonic::Status;
use zeroize::Zeroize;

use crate::error::NodeError;

pub mod proto {
    tonic::include_proto!("qko.v1");
}

use proto::quantum_key_service_client::QuantumKeyServiceClient;
use proto::{
    AcquireKeyRequest, PoolStatusRequest, RegisterRouterRequest, SetDemandRequest,
};

#[derive(Debug, Clone)]
pub struct QuantumKey {
    pub key_id: String,
    pub bytes: Vec<u8>,
    pub size_bits: u32,
    pub source: String, // "qkd" or "qrng"
    pub jfi_at_issue: f64,
}

impl Drop for QuantumKey {
    fn drop(&mut self) {
        self.bytes.zeroize();
    }
}

#[derive(Debug, Clone)]
pub struct AcquireResult {
    pub keys: Vec<QuantumKey>,
    pub jfi: f64,
    pub epoch_id: String,
}

#[derive(Debug, Clone)]
pub struct KmePoolStatus {
    pub kme_id: String,
    pub sae_pair: String,
    pub depth: u32,
    pub jfi: f64,
}

#[derive(Debug, Clone)]
pub struct PoolStatus {
    pub pools: Vec<KmePoolStatus>,
    pub overall_jfi: f64,
}

/// Extensibility point: any external quantum key source implementing this
/// fairness-aware contract can be plugged in here. The IKEv2 / pqc layers
/// depend only on this trait, never on a concrete transport.
#[async_trait]
pub trait ExternalKeyPool: Send + Sync {
    /// Request up to `count` keys for `router_id`. The allocator may grant
    /// fewer than requested — check `AcquireResult.keys.len()` against
    /// `count`, don't assume a full grant.
    async fn acquire_keys(&self, router_id: &str, count: u32) -> Result<AcquireResult, NodeError>;

    async fn get_pool_status(&self, kme_id_filter: Option<&str>) -> Result<PoolStatus, NodeError>;

    async fn register_router(&self, router_id: &str, weight: f64) -> Result<(), NodeError>;

    async fn deregister_router(&self, router_id: &str) -> Result<(), NodeError>;

    /// Declare expected demand before an allocation epoch runs. Call this
    /// before `acquire_keys` if you want the fairness allocator to account
    /// for this router's needs in the next epoch.
    async fn set_router_demand(&self, router_id: &str, keys_per_epoch: u32) -> Result<(), NodeError>;
}

/// Production gRPC-backed implementation talking to the orchestrator.
pub struct GrpcKeyPoolClient {
    client: QuantumKeyServiceClient<Channel>,
}

impl GrpcKeyPoolClient {
    /// Connect to the orchestrator, e.g. "http://127.0.0.1:50051" for the
    /// plaintext dev server, or "https://..." once TLS is configured on
    /// the Python side (see `create_server(tls_cert_chain=...)`).
    pub async fn connect(endpoint: &str) -> Result<Self, NodeError> {
        let channel = Channel::from_shared(endpoint.to_string())
            .map_err(|e| NodeError::KeyPool(format!("invalid endpoint: {e}")))?
            .timeout(Duration::from_secs(5))
            .connect()
            .await
            .map_err(|e| NodeError::KeyPool(format!("gRPC connect failed: {e}")))?;

        Ok(Self {
            client: QuantumKeyServiceClient::new(channel),
        })
    }
}

fn map_status(rpc_name: &str, status: Status) -> NodeError {
    // RESOURCE_EXHAUSTED from AcquireKeys means "the fairness allocator
    // granted 0 keys this epoch" per grpc_server.py — surface that
    // distinctly so callers can decide whether to retry next epoch rather
    // than treating it as a hard failure.
    if status.code() == tonic::Code::ResourceExhausted {
        NodeError::KeyPool(format!(
            "{rpc_name}: allocator denied request this epoch (RESOURCE_EXHAUSTED): {}",
            status.message()
        ))
    } else {
        NodeError::KeyPool(format!("{rpc_name} RPC failed: {status}"))
    }
}

#[async_trait]
impl ExternalKeyPool for GrpcKeyPoolClient {
    async fn acquire_keys(&self, router_id: &str, count: u32) -> Result<AcquireResult, NodeError> {
        let mut client = self.client.clone();
        let req = AcquireKeyRequest {
            router_id: router_id.to_string(),
            count,
            size_bits: 256, // matches the orchestrator's default key_size_bits
        };

        let resp = client
            .acquire_keys(req)
            .await
            .map_err(|s| map_status("AcquireKeys", s))?
            .into_inner();

        let keys = resp
            .keys
            .into_iter()
            .map(|k| QuantumKey {
                key_id: k.key_id,
                bytes: k.key_data,
                size_bits: k.size_bits,
                source: k.source,
                jfi_at_issue: k.jfi_at_issue,
            })
            .collect();

        Ok(AcquireResult {
            keys,
            jfi: resp.jfi,
            epoch_id: resp.epoch_id,
        })
    }

    async fn get_pool_status(&self, kme_id_filter: Option<&str>) -> Result<PoolStatus, NodeError> {
        let mut client = self.client.clone();
        let req = PoolStatusRequest {
            kme_id: kme_id_filter.unwrap_or_default().to_string(),
        };

        let resp = client
            .get_pool_status(req)
            .await
            .map_err(|s| map_status("GetPoolStatus", s))?
            .into_inner();

        let pools = resp
            .pools
            .into_iter()
            .map(|p| KmePoolStatus {
                kme_id: p.kme_id,
                sae_pair: p.sae_pair,
                depth: p.depth,
                jfi: p.jfi,
            })
            .collect();

        Ok(PoolStatus {
            pools,
            overall_jfi: resp.overall_jfi,
        })
    }

    async fn register_router(&self, router_id: &str, weight: f64) -> Result<(), NodeError> {
        let mut client = self.client.clone();
        let req = RegisterRouterRequest {
            router_id: router_id.to_string(),
            weight,
        };

        let resp = client
            .register_router(req)
            .await
            .map_err(|s| map_status("RegisterRouter", s))?
            .into_inner();

        if resp.success {
            Ok(())
        } else {
            Err(NodeError::KeyPool(format!(
                "RegisterRouter rejected: {}",
                resp.message
            )))
        }
    }

    async fn deregister_router(&self, router_id: &str) -> Result<(), NodeError> {
        let mut client = self.client.clone();
        let req = RegisterRouterRequest {
            router_id: router_id.to_string(),
            weight: 0.0, // ignored by DeregisterRouter per grpc_server.py
        };

        let resp = client
            .deregister_router(req)
            .await
            .map_err(|s| map_status("DeregisterRouter", s))?
            .into_inner();

        if resp.success {
            Ok(())
        } else {
            Err(NodeError::KeyPool(format!(
                "DeregisterRouter rejected: {}",
                resp.message
            )))
        }
    }

    async fn set_router_demand(&self, router_id: &str, keys_per_epoch: u32) -> Result<(), NodeError> {
        let mut client = self.client.clone();
        let req = SetDemandRequest {
            router_id: router_id.to_string(),
            keys_per_epoch,
        };

        let resp = client
            .set_router_demand(req)
            .await
            .map_err(|s| map_status("SetRouterDemand", s))?
            .into_inner();

        if resp.success {
            Ok(())
        } else {
            Err(NodeError::KeyPool("SetRouterDemand returned success=false".into()))
        }
    }
}

#[cfg(test)]
pub mod test_support {
    use super::*;
    use std::collections::HashMap;
    use tokio::sync::Mutex;

    /// In-memory fake for unit tests, mimicking grpc_server.py's
    /// allocator behavior loosely (no real Jain's Index math — just
    /// enough to exercise the trait contract, including partial grants).
    pub struct FakeKeyPool {
        pub available: Mutex<HashMap<String, Vec<u8>>>,
        pub grant_fraction: f64, // 0.0..=1.0, simulates fairness-limited grants
    }

    #[async_trait]
    impl ExternalKeyPool for FakeKeyPool {
        async fn acquire_keys(&self, router_id: &str, count: u32) -> Result<AcquireResult, NodeError> {
            let granted = ((count as f64) * self.grant_fraction).floor() as u32;
            if granted == 0 {
                return Err(NodeError::KeyPool(format!(
                    "allocator denied request this epoch (RESOURCE_EXHAUSTED) for router '{router_id}'"
                )));
            }
            let keys = (0..granted)
                .map(|i| QuantumKey {
                    key_id: format!("{router_id}-key-{i}"),
                    bytes: vec![0u8; 32], // fake-only
                    size_bits: 256,
                    source: "qrng".into(),
                    jfi_at_issue: self.grant_fraction,
                })
                .collect();
            Ok(AcquireResult {
                keys,
                jfi: self.grant_fraction,
                epoch_id: "fake-epoch".into(),
            })
        }

        async fn get_pool_status(&self, _kme_id_filter: Option<&str>) -> Result<PoolStatus, NodeError> {
            Ok(PoolStatus {
                pools: vec![],
                overall_jfi: self.grant_fraction,
            })
        }

        async fn register_router(&self, _router_id: &str, _weight: f64) -> Result<(), NodeError> {
            Ok(())
        }

        async fn deregister_router(&self, _router_id: &str) -> Result<(), NodeError> {
            Ok(())
        }

        async fn set_router_demand(&self, _router_id: &str, _keys_per_epoch: u32) -> Result<(), NodeError> {
            Ok(())
        }
    }
}
