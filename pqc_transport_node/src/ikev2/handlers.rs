//! Core IKEv2 packet handler trait + per-exchange implementations.
//!
//! Every inbound packet is run through:
//!   1. `decode` (packet.rs)
//! 2. `Ikev2PacketHandler::handle` — exchange-specific logic
//! 3. Non-repudiation verification (handlers call into `nonrepudiation.rs`)
//!
//! Outbound packets that require non-repudiation are signed before being
//! handed back to the transport layer.

use async_trait::async_trait;
use std::sync::Arc;

use crate::error::NodeError;
use crate::ikev2::nonrepudiation::NonRepudiationEngine;
use crate::ikev2::packet::{ExchangeType, Ikev2Packet};
use crate::pqc::dilithium::QbDilithium;

/// Implemented once per IKEv2 exchange type (IKE_SA_INIT, IKE_AUTH, ...).
#[async_trait]
pub trait Ikev2PacketHandler: Send + Sync {
    fn exchange_type(&self) -> ExchangeType;

    /// Handle an inbound packet. Implementations MUST verify the
    /// non-repudiation signature before acting on packet contents for any
    /// exchange that mutates SA state (IKE_AUTH, CREATE_CHILD_SA).
    async fn handle(&self, packet: Ikev2Packet) -> Result<Ikev2Packet, NodeError>;
}

/// Dispatches inbound packets to the correct handler by exchange type.
pub struct Ikev2Dispatcher {
    handlers: Vec<Arc<dyn Ikev2PacketHandler>>,
}

impl Ikev2Dispatcher {
    pub fn new(handlers: Vec<Arc<dyn Ikev2PacketHandler>>) -> Self {
        Self { handlers }
    }

    pub async fn dispatch(&self, packet: Ikev2Packet) -> Result<Ikev2Packet, NodeError> {
        let exch = ExchangeType::from_u8(packet.header.exchange_type)
            .ok_or_else(|| NodeError::Ikev2("unknown exchange type".into()))?;

        for h in &self.handlers {
            if h.exchange_type() == exch {
                return h.handle(packet).await;
            }
        }
        Err(NodeError::Ikev2(format!("no handler registered for {exch:?}")))
    }
}

/// IKE_SA_INIT: ML-KEM public key exchange. No non-repudiation requirement
/// here per RFC 7296 semantics (identity isn't established yet) — this is
/// the unauthenticated DH-equivalent step, now PQC-backed.
pub struct IkeSaInitHandler;

#[async_trait]
impl Ikev2PacketHandler for IkeSaInitHandler {
    fn exchange_type(&self) -> ExchangeType {
        ExchangeType::IkeSaInit
    }

    async fn handle(&self, packet: Ikev2Packet) -> Result<Ikev2Packet, NodeError> {
        tracing::info!(
            initiator_spi = packet.header.initiator_spi,
            "IKE_SA_INIT received; expecting ML-KEM public key / ciphertext payload"
        );
        // ML-KEM encapsulate/decapsulate happens at the caller via
        // crate::pqc::mlkem, keyed off payload contents not modeled here.
        Ok(packet)
    }
}

/// IKE_AUTH: identity + authentication. MUST be non-repudiable — every
/// IKE_AUTH packet must carry a valid ML-DSA signature from the peer's
/// long-term identity key, and we persist proof of that verification to
/// the session-state store (db module) so it can't be disputed later.
pub struct IkeAuthHandler {
    pub nonrepudiation: Arc<NonRepudiationEngine<QbDilithium>>,
}

#[async_trait]
impl Ikev2PacketHandler for IkeAuthHandler {
    fn exchange_type(&self) -> ExchangeType {
        ExchangeType::IkeAuth
    }

    async fn handle(&self, packet: Ikev2Packet) -> Result<Ikev2Packet, NodeError> {
        let payload = packet.non_repudiation.as_ref().ok_or_else(|| {
            NodeError::NonRepudiation("IKE_AUTH packet missing signature payload".into())
        })?;

        let verified = self
            .nonrepudiation
            .verify(&packet, payload)
            .await?;

        if !verified {
            return Err(NodeError::NonRepudiation(
                "ML-DSA signature verification failed for IKE_AUTH packet".into(),
            ));
        }

        tracing::info!(
            initiator_spi = packet.header.initiator_spi,
            signer = %payload.signer_key_id,
            "IKE_AUTH non-repudiation check passed"
        );

        Ok(packet)
    }
}

/// CREATE_CHILD_SA: rekeying / additional child SAs. Also non-repudiable,
/// since it changes traffic-protecting key material.
pub struct CreateChildSaHandler {
    pub nonrepudiation: Arc<NonRepudiationEngine<QbDilithium>>,
}

#[async_trait]
impl Ikev2PacketHandler for CreateChildSaHandler {
    fn exchange_type(&self) -> ExchangeType {
        ExchangeType::CreateChildSa
    }

    async fn handle(&self, packet: Ikev2Packet) -> Result<Ikev2Packet, NodeError> {
        let payload = packet.non_repudiation.as_ref().ok_or_else(|| {
            NodeError::NonRepudiation("CREATE_CHILD_SA packet missing signature payload".into())
        })?;

        if !self.nonrepudiation.verify(&packet, payload).await? {
            return Err(NodeError::NonRepudiation(
                "ML-DSA signature verification failed for CREATE_CHILD_SA packet".into(),
            ));
        }

        Ok(packet)
    }
}

/// INFORMATIONAL: liveness checks, deletes, error notifications. No
/// non-repudiation requirement, but still logged for session-state audit.
pub struct InformationalHandler;

#[async_trait]
impl Ikev2PacketHandler for InformationalHandler {
    fn exchange_type(&self) -> ExchangeType {
        ExchangeType::Informational
    }

    async fn handle(&self, packet: Ikev2Packet) -> Result<Ikev2Packet, NodeError> {
        tracing::debug!(
            initiator_spi = packet.header.initiator_spi,
            "INFORMATIONAL exchange handled"
        );
        Ok(packet)
    }
}
