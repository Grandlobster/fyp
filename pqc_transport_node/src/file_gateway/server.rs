//! Inbound gRPC server: accepts requests from the application layer
//! (e.g. the ABDM-integrated medical portal), acquires a key from the
//! Quantum Key Orchestrator, runs ML-KEM, and streams back an
//! ML-DSA-signed, AES-256-GCM-encrypted file.
//!
//! This is the previously-missing piece: until now, pqc_transport_node
//! was a gRPC CLIENT only. This module makes it also a gRPC SERVER.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_stream::wrappers::ReceiverStream;
use tonic::{Request, Response, Status};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use rand::RngCore;

use crate::file_gateway::crypto::derive_session_key;
use crate::file_gateway::file_resolver::FileResolver;
use crate::grpc_client::keypool::ExternalKeyPool;
use crate::ikev2::nonrepudiation::NonRepudiationEngine;
use crate::pqc::dilithium::DilithiumScheme;
use crate::pqc::mlkem;

pub mod proto {
    tonic::include_proto!("pqc.gateway.v1");
}

use proto::secure_file_gateway_server::{SecureFileGateway, SecureFileGatewayServer};
use proto::{
    FileChunk, FileChunkRequest, SecureFileHandle, SecureFileRequest, TransferStatus,
};

/// State retained between RequestSecureFile and StreamEncryptedFile for a
/// single in-flight transfer. Indexed by transfer_id.
struct TransferSession {
    session_key: crate::file_gateway::crypto::SessionKey,
    file_bytes: Vec<u8>,
    file_name: String,
}

pub struct FileGatewayService<S: DilithiumScheme + Send + Sync + 'static> {
    key_pool: Arc<dyn ExternalKeyPool>,
    nonrepudiation: Arc<NonRepudiationEngine<S>>,
    router_id: String,
    file_resolver: Arc<dyn FileResolver>,
    sessions: RwLock<HashMap<String, TransferSession>>,
}

impl<S: DilithiumScheme + Send + Sync + 'static> FileGatewayService<S> {
    pub fn new(
        key_pool: Arc<dyn ExternalKeyPool>,
        nonrepudiation: Arc<NonRepudiationEngine<S>>,
        router_id: String,
        file_resolver: Arc<dyn FileResolver>,
    ) -> Self {
        Self {
            key_pool,
            nonrepudiation,
            router_id,
            file_resolver,
            sessions: RwLock::new(HashMap::new()),
        }
    }

    pub fn into_server(self) -> SecureFileGatewayServer<Self> {
        SecureFileGatewayServer::new(self)
    }
}

#[tonic::async_trait]
impl<S: DilithiumScheme + Send + Sync + 'static> SecureFileGateway for FileGatewayService<S> {
    async fn request_secure_file(
        &self,
        request: Request<SecureFileRequest>,
    ) -> Result<Response<SecureFileHandle>, Status> {
        let req = request.into_inner();
        let transfer_id = uuid::Uuid::new_v4().to_string();

        tracing::info!(
            transfer_id = %transfer_id,
            abha_address = %req.abha_address,
            study_uid = %req.study_uid,
            hospital_id = %req.hospital_id,
            "RequestSecureFile received"
        );

        // 1. Resolve the actual file. If this fails, fail fast with a
        // clear status rather than proceeding to spend a key acquisition
        // on a request that can't be served anyway.
        let (file_bytes, file_name) = match self.file_resolver.resolve(&req).await {
            Ok(Some((bytes, name))) => (bytes, name),
            Ok(None) => {
                return Ok(Response::new(SecureFileHandle {
                    transfer_id,
                    status: TransferStatus::Failed as i32,
                    detail: format!(
                        "no file resolvable for study_uid='{}' hospital_id='{}'",
                        req.study_uid, req.hospital_id
                    ),
                    mlkem_public_key: vec![],
                    signer_key_id: String::new(),
                    session_key: vec![],
                    file_name: String::new(),
                }));
            }
            Err(e) => {
                return Ok(Response::new(SecureFileHandle {
                    transfer_id,
                    status: TransferStatus::Failed as i32,
                    detail: format!("file resolution error: {e}"),
                    mlkem_public_key: vec![],
                    signer_key_id: String::new(),
                    session_key: vec![],
                    file_name: String::new(),
                }));
            }
        };

        // 2. Acquire a key from the orchestrator's fairness-governed pool.
        let acquire_result = self
            .key_pool
            .acquire_keys(&self.router_id, 1)
            .await
            .map_err(|e| Status::resource_exhausted(format!("key acquisition failed: {e}")))?;

        let quantum_key = acquire_result.keys.into_iter().next().ok_or_else(|| {
            Status::resource_exhausted("allocator granted 0 keys for this transfer")
        })?;

        // 3. ML-KEM: generate an ephemeral keypair for this transfer and
        // self-encapsulate to derive a shared secret. (In a fuller
        // protocol the caller would supply their own ML-KEM public key
        // and we'd encapsulate to THEM; here, since the caller in this
        // flow is a thin application layer rather than a peer running
        // its own KEM, we generate both sides locally — this still
        // exercises the real ML-KEM primitive but is a simplification
        // worth revisiting if the application layer ever needs to
        // independently verify the shared secret.)
        let kem_keypair = mlkem::generate_ephemeral_keypair();
        let encapsulated = mlkem::encapsulate(&kem_keypair.public_key)
            .map_err(|e| Status::internal(format!("ML-KEM encapsulation failed: {e}")))?;

        // 4. Derive the AES-256 session key from both secrets.
        let session_key = derive_session_key(
            &encapsulated.shared_secret,
            &quantum_key.bytes,
            &transfer_id,
        )
        .map_err(|e| Status::internal(format!("session key derivation failed: {e}")))?;

        let session_key_bytes_for_response = session_key.bytes;

        self.sessions.write().await.insert(
            transfer_id.clone(),
            TransferSession {
                session_key,
                file_bytes,
                file_name: file_name.clone(),
            },
        );

        Ok(Response::new(SecureFileHandle {
            transfer_id,
            status: TransferStatus::Ready as i32,
            detail: "session established".to_string(),
            mlkem_public_key: kem_keypair.public_key.clone(),
            signer_key_id: "node-01.identity.ml-dsa-65".to_string(), // matches main.rs wiring
            session_key: session_key_bytes_for_response.to_vec(),
            file_name,
        }))
    }

    type StreamEncryptedFileStream = ReceiverStream<Result<FileChunk, Status>>;

    async fn stream_encrypted_file(
        &self,
        request: Request<FileChunkRequest>,
    ) -> Result<Response<Self::StreamEncryptedFileStream>, Status> {
        let transfer_id = request.into_inner().transfer_id;

        let (session_key_bytes, file_bytes) = {
            let sessions = self.sessions.read().await;
            let session = sessions
                .get(&transfer_id)
                .ok_or_else(|| Status::not_found("unknown or expired transfer_id"))?;
            (session.session_key.bytes, session.file_bytes.clone())
        };

        let cipher = Aes256Gcm::new_from_slice(&session_key_bytes)
            .map_err(|e| Status::internal(format!("cipher init failed: {e}")))?;

        let (tx, rx) = tokio::sync::mpsc::channel(8);
        let nonrepudiation = self.nonrepudiation.clone();

        // CHUNK_SIZE chosen conservatively for gRPC message-size limits;
        // tune per deployment if files are large.
        const CHUNK_SIZE: usize = 64 * 1024;
        let chunks: Vec<Vec<u8>> = file_bytes
            .chunks(CHUNK_SIZE)
            .map(|c| c.to_vec())
            .collect();
        let total = chunks.len().max(1);

        tokio::spawn(async move {
            for (i, chunk) in chunks.into_iter().enumerate() {
                let mut nonce_bytes = [0u8; 12];
                rand::thread_rng().fill_bytes(&mut nonce_bytes);
                let nonce = Nonce::from_slice(&nonce_bytes);

                let ciphertext = match cipher.encrypt(nonce, chunk.as_slice()) {
                    Ok(ct) => ct,
                    Err(e) => {
                        let _ = tx
                            .send(Err(Status::internal(format!("encryption failed: {e}"))))
                            .await;
                        return;
                    }
                };

                // Sign (ciphertext || nonce || sequence) for non-repudiation
                // of file delivery, mirroring the IKEv2 packet-signing
                // approach used elsewhere in this codebase.
                let mut to_sign = ciphertext.clone();
                to_sign.extend_from_slice(&nonce_bytes);
                to_sign.extend_from_slice(&(i as u32).to_be_bytes());

                // NOTE: signing here reuses the same local identity key
                // as IKEv2 packet signing (see nonrepudiation.rs). If you
                // want a SEPARATE key scoped to file-transfer signing
                // only, add a second SigningKey and a second
                // NonRepudiationEngine instance rather than overloading
                // this one — left as-is for now to avoid a second dummy
                // key file in an already-incomplete demo setup.
                let signature_bytes = nonrepudiation
                    .sign_outbound_raw(&to_sign)
                    .unwrap_or_else(|e| {
                        tracing::warn!(error = %e, "file chunk signing failed; sending unsigned chunk");
                        vec![]
                    });

                let is_final = i + 1 == total;
                let chunk_msg = FileChunk {
                    ciphertext,
                    nonce: nonce_bytes.to_vec(),
                    sequence: i as u32,
                    is_final,
                    signature: signature_bytes,
                };

                if tx.send(Ok(chunk_msg)).await.is_err() {
                    break; // receiver dropped
                }
            }
        });

        Ok(Response::new(ReceiverStream::new(rx)))
    }
}
