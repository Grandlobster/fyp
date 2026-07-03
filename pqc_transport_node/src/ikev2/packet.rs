//! Minimal IKEv2 (RFC 7296) packet model — enough structure to carry PQC
//! key-exchange payloads and a non-repudiation signature payload.
//! This is not a full IKEv2 stack; it's the data-plane packet layer this
//! node needs to demonstrate handler dispatch + signing/verification.

use bytes::{Buf, BufMut, Bytes, BytesMut};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ExchangeType {
    IkeSaInit = 34,
    IkeAuth = 35,
    CreateChildSa = 36,
    Informational = 37,
}

impl ExchangeType {
    pub fn from_u8(v: u8) -> Option<Self> {
        match v {
            34 => Some(Self::IkeSaInit),
            35 => Some(Self::IkeAuth),
            36 => Some(Self::CreateChildSa),
            37 => Some(Self::Informational),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ikev2Header {
    pub initiator_spi: u64,
    pub responder_spi: u64,
    pub next_payload: u8,
    pub major_version: u8,
    pub minor_version: u8,
    pub exchange_type: u8,
    pub flags: u8,
    pub message_id: u32,
}

pub const FLAG_INITIATOR: u8 = 0b0000_1000;
pub const FLAG_RESPONSE: u8 = 0b0010_0000;

impl Ikev2Header {
    pub const ENCODED_LEN: usize = 28;

    pub fn encode(&self, length_field: u32) -> BytesMut {
        let mut buf = BytesMut::with_capacity(Self::ENCODED_LEN);
        buf.put_u64(self.initiator_spi);
        buf.put_u64(self.responder_spi);
        buf.put_u8(self.next_payload);
        buf.put_u8((self.major_version << 4) | (self.minor_version & 0x0F));
        buf.put_u8(self.exchange_type);
        buf.put_u8(self.flags);
        buf.put_u32(self.message_id);
        buf.put_u32(length_field);
        buf
    }

    pub fn decode(mut buf: Bytes) -> Result<Self, crate::error::NodeError> {
        if buf.len() < Self::ENCODED_LEN {
            return Err(crate::error::NodeError::Codec("IKEv2 header truncated".into()));
        }
        let initiator_spi = buf.get_u64();
        let responder_spi = buf.get_u64();
        let next_payload = buf.get_u8();
        let version_byte = buf.get_u8();
        let exchange_type = buf.get_u8();
        let flags = buf.get_u8();
        let message_id = buf.get_u32();
        Ok(Self {
            initiator_spi,
            responder_spi,
            next_payload,
            major_version: version_byte >> 4,
            minor_version: version_byte & 0x0F,
            exchange_type,
            flags,
            message_id,
        })
    }
}

/// Non-standard, vendor "Notify"-style payload (private use range) carrying
/// a Dilithium signature over the canonicalized packet body, used to
/// enforce non-repudiation: every IKE_AUTH and CREATE_CHILD_SA exchange
/// must be signed by the originating peer's long-term ML-DSA identity key.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NonRepudiationPayload {
    pub signer_key_id: String,
    pub dilithium_level: u8,
    pub signature: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct Ikev2Packet {
    pub header: Ikev2Header,
    pub body: Bytes,
    pub non_repudiation: Option<NonRepudiationPayload>,
}

impl Ikev2Packet {
    /// Bytes that get signed / verified for non-repudiation: header fields
    /// (excluding the length, which is computed last) + the body, but
    /// excluding the non-repudiation payload itself.
    pub fn signable_bytes(&self) -> BytesMut {
        let mut buf = self.header.encode(0);
        buf.extend_from_slice(&self.body);
        buf
    }
}
