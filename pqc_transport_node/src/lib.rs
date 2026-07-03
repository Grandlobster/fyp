pub mod ikev2;
pub mod pqc;
pub mod db;
pub mod grpc_client;
pub mod file_gateway;

pub mod error {
    use thiserror::Error;

    #[derive(Debug, Error)]
    pub enum NodeError {
        #[error("IKEv2 packet error: {0}")]
        Ikev2(String),

        #[error("PQC operation failed: {0}")]
        Pqc(String),

        #[error("Non-repudiation check failed: {0}")]
        NonRepudiation(String),

        #[error("Database error: {0}")]
        Db(String),

        #[error("Key pool gRPC error: {0}")]
        KeyPool(String),

        #[error("Codec error: {0}")]
        Codec(String),
    }
}
