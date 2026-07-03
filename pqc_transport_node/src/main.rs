use std::sync::Arc;

use pqc_transport_node::db::session_store::mysql_backend::MySqlSessionStore;
use pqc_transport_node::db::session_store::SessionStateStore;
use pqc_transport_node::error::NodeError;
use pqc_transport_node::grpc_client::keypool::{ExternalKeyPool, GrpcKeyPoolClient};
use pqc_transport_node::ikev2::handlers::{
    CreateChildSaHandler, IkeAuthHandler, IkeSaInitHandler, Ikev2Dispatcher, InformationalHandler,
};
use pqc_transport_node::ikev2::nonrepudiation::NonRepudiationEngine;
use pqc_transport_node::pqc::dilithium::{DilithiumLevel, QbDilithium, SigningKey};

#[tokio::main]
async fn main() -> Result<(), NodeError> {
    tracing_subscriber::fmt::init();

    // --- Session state DB (MySQL; switch to MongoSessionStore for Mongo) ---
    let db_url = std::env::var("PQC_NODE_MYSQL_URL")
        .unwrap_or_else(|_| "mysql://pqc_node:changeme@127.0.0.1:3306/pqc_transport".into());
    let mysql_store = MySqlSessionStore::connect(&db_url).await?;
    mysql_store.ensure_schema().await?;
    let session_store: Arc<dyn SessionStateStore> = Arc::new(mysql_store);

    // --- External Quantum Key Orchestrator (gRPC) ---
    let orchestrator_endpoint = std::env::var("PQC_NODE_ORCHESTRATOR_ENDPOINT")
        .unwrap_or_else(|_| "http://127.0.0.1:50051".into());
    let key_pool: Arc<dyn ExternalKeyPool> =
        Arc::new(GrpcKeyPoolClient::connect(&orchestrator_endpoint).await?);

    // This node identifies itself as a router to the orchestrator's
    // fairness allocator. Register once at startup, then declare demand
    // and acquire keys as sessions need them.
    let router_id = std::env::var("PQC_NODE_ROUTER_ID").unwrap_or_else(|_| "pqc-transport-node-01".into());
    key_pool.register_router(&router_id, 1.0).await?;

    // Example: acquire a small batch of keys to seed SA protection. The
    // allocator may grant fewer than requested — handle that, don't
    // assume a full grant.
    match key_pool.acquire_keys(&router_id, 4).await {
        Ok(result) => {
            tracing::info!(
                granted = result.keys.len(),
                jfi = result.jfi,
                epoch_id = %result.epoch_id,
                "acquired keys from quantum key orchestrator"
            );
        }
        Err(e) => {
            tracing::warn!(error = %e, "key acquisition failed this epoch; continuing startup");
        }
    }

    // --- Non-repudiation engine ---
    // The signing key bytes themselves must come from provisioned identity
    // material (HSM, sealed storage, or the orchestrator) — this node does
    // not generate them.
    let local_signing_key_bytes = load_local_identity_key_bytes()?;
    let local_signing_key =
        SigningKey::from_provisioned_bytes(DilithiumLevel::MlDsa65, local_signing_key_bytes);

    let nonrepudiation = Arc::new(NonRepudiationEngine::new(
        QbDilithium,
        local_signing_key,
        "node-01.identity.ml-dsa-65".to_string(),
        session_store.clone(),
    ));

    // --- IKEv2 dispatcher wiring ---
    // Not yet driven by a real transport loop (no UDP listener exists yet)
    // — kept here as the integration point for when one is added.
    let _dispatcher = Ikev2Dispatcher::new(vec![
        Arc::new(IkeSaInitHandler),
        Arc::new(IkeAuthHandler {
            nonrepudiation: nonrepudiation.clone(),
        }),
        Arc::new(CreateChildSaHandler {
            nonrepudiation: nonrepudiation.clone(),
        }),
        Arc::new(InformationalHandler),
    ]);

    tracing::info!("pqc_transport_node initialized; dispatcher ready");

    // --- Inbound file gateway server ---
    // This is the "door to knock on" for the application layer (e.g. the
    // ABDM-integrated medical portal): it calls RequestSecureFile with
    // CareContext metadata, then StreamEncryptedFile to receive the file.
    let gateway_addr = std::env::var("PQC_NODE_GATEWAY_LISTEN_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:50061".into())
        .parse()
        .map_err(|e| NodeError::Codec(format!("invalid PQC_NODE_GATEWAY_LISTEN_ADDR: {e}")))?;

    // Maps study_uid -> real filename via {PQC_NODE_FILE_ROOT}/file_map.json.
    // See file_resolver.rs for the mapping format.
    let file_root = std::env::var("PQC_NODE_FILE_ROOT").unwrap_or_else(|_| ".".into());
    let resolver: Arc<dyn pqc_transport_node::file_gateway::file_resolver::FileResolver> =
        Arc::new(pqc_transport_node::file_gateway::file_resolver::MappedDiskResolver {
            root: std::path::PathBuf::from(file_root),
        });

    let gateway_service = pqc_transport_node::file_gateway::server::FileGatewayService::new(
        key_pool.clone(),
        nonrepudiation.clone(),
        router_id.clone(),
        resolver,
    );

    tracing::info!(addr = %gateway_addr, "starting SecureFileGateway server");
    tonic::transport::Server::builder()
        .add_service(gateway_service.into_server())
        .serve(gateway_addr)
        .await
        .map_err(|e| NodeError::KeyPool(format!("gateway server failed: {e}")))?;

    Ok(())
}

fn load_local_identity_key_bytes() -> Result<Vec<u8>, NodeError> {
    // Placeholder: load from sealed file / HSM / orchestrator-provisioned
    // path in production. Never generate identity keys in this node.
    std::env::var("PQC_NODE_IDENTITY_KEY_PATH")
        .map_err(|_| NodeError::Pqc("PQC_NODE_IDENTITY_KEY_PATH not set".into()))
        .and_then(|path| {
            std::fs::read(&path).map_err(|e| NodeError::Pqc(format!("failed reading identity key at {path}: {e}")))
        })
}
