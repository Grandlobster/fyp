//! Non-repudiation enforcement layer.
//!
//! Signs outbound IKE_AUTH / CREATE_CHILD_SA packets with the local ML-DSA
//! identity key, verifies inbound ones against the peer's known
//! VerifyingKey, and writes an immutable audit record of every
//! verification outcome to session-state storage so signed packets can't
//! later be disputed by either party.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::db::session_store::{SessionStateStore, SignatureAuditRecord};
use crate::error::NodeError;
use crate::ikev2::packet::{Ikev2Packet, NonRepudiationPayload};
use crate::pqc::dilithium::{DilithiumScheme, DilithiumSigner, SigningKey, VerifyingKey, Signature};

pub struct NonRepudiationEngine<S: DilithiumScheme> {
    signer: DilithiumSigner<S>,
    local_signing_key: SigningKey,
    local_key_id: String,
    /// Trust store of known peer verifying keys, keyed by key ID. In a real
    /// deployment this would be populated from a PKI / external orchestrator,
    /// not hardcoded.
    peer_keys: RwLock<HashMap<String, VerifyingKey>>,
    audit_store: Arc<dyn SessionStateStore>,
}

impl<S: DilithiumScheme> NonRepudiationEngine<S> {
    pub fn new(
        scheme: S,
        local_signing_key: SigningKey,
        local_key_id: String,
        audit_store: Arc<dyn SessionStateStore>,
    ) -> Self {
        Self {
            signer: DilithiumSigner::new(scheme),
            local_signing_key,
            local_key_id,
            peer_keys: RwLock::new(HashMap::new()),
            audit_store,
        }
    }

    pub async fn register_peer_key(&self, key_id: String, key: VerifyingKey) {
        self.peer_keys.write().await.insert(key_id, key);
    }

    /// Sign arbitrary bytes with the local identity key, outside the
    /// IKEv2 packet context (e.g. file-transfer chunk signing in the
    /// file_gateway module). Returns raw signature bytes, or an empty
    /// Vec on failure — callers that need a hard failure on signing
    /// error should call the underlying signer directly instead.
    pub fn sign_outbound_raw(&self, bytes: &[u8]) -> Result<Vec<u8>, NodeError> {
        let sig = self.signer.sign_packet(&self.local_signing_key, bytes)?;
        Ok(sig.bytes)
    }

    /// Sign an outbound packet, producing the payload to attach before
    /// transmission.
    pub fn sign_outbound(
        &self,
        packet: &Ikev2Packet,
        dilithium_level: u8,
    ) -> Result<NonRepudiationPayload, NodeError> {
        let signable = packet.signable_bytes();
        let sig: Signature = self.signer.sign_packet(&self.local_signing_key, &signable)?;
        Ok(NonRepudiationPayload {
            signer_key_id: self.local_key_id.clone(),
            dilithium_level,
            signature: sig.bytes,
        })
    }

    /// Verify an inbound packet's signature and persist the audit record
    /// regardless of outcome (failures are evidence too).
    pub async fn verify(
        &self,
        packet: &Ikev2Packet,
        payload: &NonRepudiationPayload,
    ) -> Result<bool, NodeError> {
        let vk = {
            let keys = self.peer_keys.read().await;
            keys.get(&payload.signer_key_id).cloned()
        }
        .ok_or_else(|| {
            NodeError::NonRepudiation(format!(
                "unknown signer key id '{}': peer key not in trust store",
                payload.signer_key_id
            ))
        })?;

        let signable = packet.signable_bytes();
        let sig = Signature {
            bytes: payload.signature.clone(),
        };

        let result = self.signer.verify_packet(&vk, &signable, &sig);

        let (verified, error_detail) = match &result {
            Ok(v) => (*v, None),
            Err(e) => (false, Some(e.to_string())),
        };

        self.audit_store
            .record_signature_event(SignatureAuditRecord {
                initiator_spi: packet.header.initiator_spi,
                responder_spi: packet.header.responder_spi,
                message_id: packet.header.message_id,
                signer_key_id: payload.signer_key_id.clone(),
                verified,
                error_detail,
                timestamp: chrono::Utc::now(),
            })
            .await?;

        result
    }
}
