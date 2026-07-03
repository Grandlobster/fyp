//! Resolves a SecureFileRequest's study_uid to real file bytes + the
//! original filename (so callers know what extension to save with).
//!
//! Uses a simple JSON mapping file, `file_map.json`, in the configured
//! root directory:
//!   { "1.2.840.113619.001": "IMG-0001-00001.dcm",
//!     "some-other-uid":     "record_2.pdf" }
//!
//! This is the pragmatic stand-in for a real PACS lookup — a real PACS
//! (e.g. Orthanc) does conceptually the same UID -> file resolution
//! internally, just over a different transport (DICOM C-FIND or its own
//! REST API) and against its own internal storage rather than a JSON
//! file. Swapping this resolver for a real PACS client later does not
//! require changing anything else in file_gateway — only this file.

use async_trait::async_trait;
use std::collections::HashMap;
use std::path::PathBuf;

use crate::error::NodeError;
use crate::file_gateway::server::proto::SecureFileRequest;

#[async_trait]
pub trait FileResolver: Send + Sync {
    /// Returns Ok(None) for "no such file" (not an error — the caller
    /// returns a clean FAILED status for this case), Err for actual
    /// infrastructure failures (e.g. mapping file unreadable/corrupt).
    async fn resolve(&self, req: &SecureFileRequest) -> Result<Option<(Vec<u8>, String)>, NodeError>;
}

pub struct MappedDiskResolver {
    pub root: PathBuf,
}

impl MappedDiskResolver {
    async fn load_map(&self) -> Result<HashMap<String, String>, NodeError> {
        let map_path = self.root.join("file_map.json");
        let raw = tokio::fs::read_to_string(&map_path).await.map_err(|e| {
            NodeError::Pqc(format!(
                "failed reading {}: {e} (create this file — see SKILL/README)",
                map_path.display()
            ))
        })?;
        serde_json::from_str(&raw)
            .map_err(|e| NodeError::Pqc(format!("file_map.json is not valid JSON: {e}")))
    }
}

#[async_trait]
impl FileResolver for MappedDiskResolver {
    async fn resolve(&self, req: &SecureFileRequest) -> Result<Option<(Vec<u8>, String)>, NodeError> {
        let map = self.load_map().await?;
        let Some(filename) = map.get(&req.study_uid) else {
            return Ok(None);
        };

        let file_path = self.root.join(filename);
        if !file_path.exists() {
            return Err(NodeError::Pqc(format!(
                "file_map.json points study_uid '{}' at '{}', but that file does not exist at {}",
                req.study_uid,
                filename,
                file_path.display()
            )));
        }

        let bytes = tokio::fs::read(&file_path)
            .await
            .map_err(|e| NodeError::Pqc(format!("failed reading mapped file: {e}")))?;

        Ok(Some((bytes, filename.clone())))
    }
}
