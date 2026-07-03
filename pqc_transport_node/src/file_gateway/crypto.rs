//! Derives the AES-256-GCM session key used to encrypt files in transit
//! to the application layer.
//!
//! Combines two independent secrets via HKDF so that compromise of
//! either alone is insufficient to recover the session key:
//!   1. The ML-KEM-768 shared secret (established with the requesting
//!      side during `RequestSecureFile`).
//!   2. A quantum key acquired from the orchestrator's fairness-governed
//!      pool (real QKD-derived when a KME is live; QRNG fallback bytes
//!      otherwise — this module does not know or care which, by design).

use hkdf::Hkdf;
use sha2::Sha256;
use zeroize::Zeroize;

use crate::error::NodeError;

pub struct SessionKey {
    pub bytes: [u8; 32], // AES-256 key
}

impl Drop for SessionKey {
    fn drop(&mut self) {
        self.bytes.zeroize();
    }
}

/// `transfer_id` is used as the HKDF "info" parameter so the same two
/// input secrets can never produce the same session key for two
/// different transfers.
pub fn derive_session_key(
    mlkem_shared_secret: &[u8],
    quantum_key_bytes: &[u8],
    transfer_id: &str,
) -> Result<SessionKey, NodeError> {
    // Concatenate the two secrets as HKDF input key material. Order is
    // fixed and documented since HKDF output depends on it.
    let mut ikm = Vec::with_capacity(mlkem_shared_secret.len() + quantum_key_bytes.len());
    ikm.extend_from_slice(mlkem_shared_secret);
    ikm.extend_from_slice(quantum_key_bytes);

    let hk = Hkdf::<Sha256>::new(None, &ikm);
    let mut okm = [0u8; 32];
    hk.expand(transfer_id.as_bytes(), &mut okm)
        .map_err(|e| NodeError::Pqc(format!("HKDF expand failed: {e}")))?;

    ikm.zeroize();
    Ok(SessionKey { bytes: okm })
}
