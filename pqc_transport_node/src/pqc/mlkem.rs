//! ML-KEM (FIPS 203 / Kyber) key encapsulation for IKEv2 key exchange.
//!
//! This module performs encapsulation/decapsulation only. It does NOT
//! generate the long-lived quantum-safe identity material — per project
//! boundaries, raw quantum key generation is owned by the external Key
//! Management layer. What this module DOES generate are ephemeral KEM
//! keypairs for a single IKE_SA negotiation, which is a standard part of
//! the KEM protocol itself (analogous to ephemeral DH in classic IKEv2)
//! and distinct from "quantum key generation."

use crate::error::NodeError;
use pqcrypto_mlkem::mlkem768;
use pqcrypto_traits::kem::{Ciphertext, PublicKey, SecretKey, SharedSecret};
use zeroize::Zeroize;

pub struct KemKeypair {
    pub public_key: Vec<u8>,
    secret_key: Vec<u8>,
}

impl Drop for KemKeypair {
    fn drop(&mut self) {
        self.secret_key.zeroize();
    }
}

pub struct EncapsulatedSecret {
    pub ciphertext: Vec<u8>,
    pub shared_secret: Vec<u8>,
}

/// Generate an ephemeral ML-KEM-768 keypair for one IKE_SA exchange.
pub fn generate_ephemeral_keypair() -> KemKeypair {
    let (pk, sk) = mlkem768::keypair();
    KemKeypair {
        public_key: pk.as_bytes().to_vec(),
        secret_key: sk.as_bytes().to_vec(),
    }
}

/// Initiator/responder side that received a peer public key: encapsulate
/// and produce a shared secret + ciphertext to send back.
pub fn encapsulate(peer_public_key: &[u8]) -> Result<EncapsulatedSecret, NodeError> {
    let pk = mlkem768::PublicKey::from_bytes(peer_public_key)
        .map_err(|e| NodeError::Pqc(format!("invalid peer ML-KEM public key: {e:?}")))?;
    let (ss, ct) = mlkem768::encapsulate(&pk);
    Ok(EncapsulatedSecret {
        ciphertext: ct.as_bytes().to_vec(),
        shared_secret: ss.as_bytes().to_vec(),
    })
}

/// Decapsulate a received ciphertext using our ephemeral secret key.
pub fn decapsulate(keypair: &KemKeypair, ciphertext: &[u8]) -> Result<Vec<u8>, NodeError> {
    let sk = mlkem768::SecretKey::from_bytes(&keypair.secret_key)
        .map_err(|e| NodeError::Pqc(format!("invalid local ML-KEM secret key: {e:?}")))?;
    let ct = mlkem768::Ciphertext::from_bytes(ciphertext)
        .map_err(|e| NodeError::Pqc(format!("invalid ML-KEM ciphertext: {e:?}")))?;
    let ss = mlkem768::decapsulate(&ct, &sk);
    Ok(ss.as_bytes().to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_kem() {
        let responder_kp = generate_ephemeral_keypair();
        let enc = encapsulate(&responder_kp.public_key).expect("encapsulate failed");
        let decapped = decapsulate(&responder_kp, &enc.ciphertext).expect("decapsulate failed");
        assert_eq!(enc.shared_secret, decapped);
    }
}
