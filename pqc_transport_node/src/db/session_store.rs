//! Session-state and non-repudiation audit logging.
//!
//! Two backends are supported (feature-gated): MySQL (via sqlx) and
//! MongoDB. SQLite is intentionally never used — this store is meant to
//! back a multi-node, networked deployment, not an embedded/local one.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::error::NodeError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureAuditRecord {
    pub initiator_spi: u64,
    pub responder_spi: u64,
    pub message_id: u32,
    pub signer_key_id: String,
    pub verified: bool,
    pub error_detail: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRecord {
    pub session_id: String,
    pub initiator_spi: u64,
    pub responder_spi: u64,
    pub state: String, // e.g. "INIT", "AUTH_PENDING", "ESTABLISHED", "CLOSED"
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Storage-agnostic interface used by the rest of the node. Swap MySQL for
/// Mongo (or vice versa) by changing only the constructor wired up in
/// main.rs.
#[async_trait]
pub trait SessionStateStore: Send + Sync {
    async fn upsert_session(&self, record: SessionRecord) -> Result<(), NodeError>;
    async fn get_session(&self, session_id: &str) -> Result<Option<SessionRecord>, NodeError>;
    async fn record_signature_event(&self, record: SignatureAuditRecord) -> Result<(), NodeError>;
}

// ---------------------------------------------------------------------
// MySQL backend
// ---------------------------------------------------------------------

pub mod mysql_backend {
    use super::*;
    use sqlx::mysql::MySqlPool;
    use sqlx::Row;

    pub struct MySqlSessionStore {
        pool: MySqlPool,
    }

    impl MySqlSessionStore {
        pub async fn connect(database_url: &str) -> Result<Self, NodeError> {
            let pool = MySqlPool::connect(database_url)
                .await
                .map_err(|e| NodeError::Db(format!("MySQL connect failed: {e}")))?;
            Ok(Self { pool })
        }

        /// Run once at deploy time / migration step.
        pub async fn ensure_schema(&self) -> Result<(), NodeError> {
            sqlx::query(
                r#"
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id VARCHAR(64) PRIMARY KEY,
                    initiator_spi BIGINT UNSIGNED NOT NULL,
                    responder_spi BIGINT UNSIGNED NOT NULL,
                    state VARCHAR(32) NOT NULL,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
                "#,
            )
            .execute(&self.pool)
            .await
            .map_err(|e| NodeError::Db(format!("schema create (sessions) failed: {e}")))?;

            sqlx::query(
                r#"
                CREATE TABLE IF NOT EXISTS signature_audit (
                    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    initiator_spi BIGINT UNSIGNED NOT NULL,
                    responder_spi BIGINT UNSIGNED NOT NULL,
                    message_id INT UNSIGNED NOT NULL,
                    signer_key_id VARCHAR(128) NOT NULL,
                    verified BOOLEAN NOT NULL,
                    error_detail TEXT NULL,
                    ts DATETIME NOT NULL
                )
                "#,
            )
            .execute(&self.pool)
            .await
            .map_err(|e| NodeError::Db(format!("schema create (signature_audit) failed: {e}")))?;

            Ok(())
        }
    }

    #[async_trait]
    impl SessionStateStore for MySqlSessionStore {
        async fn upsert_session(&self, record: SessionRecord) -> Result<(), NodeError> {
            sqlx::query(
                r#"
                INSERT INTO sessions (session_id, initiator_spi, responder_spi, state, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    state = VALUES(state),
                    updated_at = VALUES(updated_at)
                "#,
            )
            .bind(&record.session_id)
            .bind(record.initiator_spi)
            .bind(record.responder_spi)
            .bind(&record.state)
            .bind(record.created_at)
            .bind(record.updated_at)
            .execute(&self.pool)
            .await
            .map_err(|e| NodeError::Db(format!("upsert_session failed: {e}")))?;
            Ok(())
        }

        async fn get_session(&self, session_id: &str) -> Result<Option<SessionRecord>, NodeError> {
            let row = sqlx::query(
                "SELECT session_id, initiator_spi, responder_spi, state, created_at, updated_at FROM sessions WHERE session_id = ?",
            )
            .bind(session_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| NodeError::Db(format!("get_session failed: {e}")))?;

            Ok(row.map(|r| SessionRecord {
                session_id: r.get("session_id"),
                initiator_spi: r.get("initiator_spi"),
                responder_spi: r.get("responder_spi"),
                state: r.get("state"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            }))
        }

        async fn record_signature_event(&self, record: SignatureAuditRecord) -> Result<(), NodeError> {
            sqlx::query(
                r#"
                INSERT INTO signature_audit
                    (initiator_spi, responder_spi, message_id, signer_key_id, verified, error_detail, ts)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(record.initiator_spi)
            .bind(record.responder_spi)
            .bind(record.message_id)
            .bind(&record.signer_key_id)
            .bind(record.verified)
            .bind(&record.error_detail)
            .bind(record.timestamp)
            .execute(&self.pool)
            .await
            .map_err(|e| NodeError::Db(format!("record_signature_event failed: {e}")))?;
            Ok(())
        }
    }
}

// ---------------------------------------------------------------------
// MongoDB backend
// ---------------------------------------------------------------------

#[cfg(feature = "mongo-backend")]
pub mod mongo_backend {
    use super::*;
    use mongodb::bson::doc;
    use mongodb::options::ClientOptions;
    use mongodb::{Client, Collection};

    pub struct MongoSessionStore {
        sessions: Collection<SessionRecord>,
        signature_audit: Collection<SignatureAuditRecord>,
    }

    impl MongoSessionStore {
        pub async fn connect(uri: &str, db_name: &str) -> Result<Self, NodeError> {
            let opts = ClientOptions::parse(uri)
                .await
                .map_err(|e| NodeError::Db(format!("Mongo options parse failed: {e}")))?;
            let client = Client::with_options(opts)
                .map_err(|e| NodeError::Db(format!("Mongo client init failed: {e}")))?;
            let db = client.database(db_name);
            Ok(Self {
                sessions: db.collection("sessions"),
                signature_audit: db.collection("signature_audit"),
            })
        }
    }

    #[async_trait]
    impl SessionStateStore for MongoSessionStore {
        async fn upsert_session(&self, record: SessionRecord) -> Result<(), NodeError> {
            let filter = doc! { "session_id": &record.session_id };
            self.sessions
                .replace_one(filter, &record)
                .upsert(true)
                .await
                .map_err(|e| NodeError::Db(format!("Mongo upsert_session failed: {e}")))?;
            Ok(())
        }

        async fn get_session(&self, session_id: &str) -> Result<Option<SessionRecord>, NodeError> {
            self.sessions
                .find_one(doc! { "session_id": session_id })
                .await
                .map_err(|e| NodeError::Db(format!("Mongo get_session failed: {e}")))
        }

        async fn record_signature_event(&self, record: SignatureAuditRecord) -> Result<(), NodeError> {
            self.signature_audit
                .insert_one(&record)
                .await
                .map_err(|e| NodeError::Db(format!("Mongo record_signature_event failed: {e}")))?;
            Ok(())
        }
    }
}
