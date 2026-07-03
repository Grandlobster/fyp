fn main() -> Result<(), Box<dyn std::error::Error>> {
    // key_service.proto: this node is a CLIENT (talks to the orchestrator).
    tonic_build::configure()
        .build_server(false)
        .build_client(true)
        .compile(&["proto/key_service.proto"], &["proto"])?;

    // file_gateway.proto: this node is a SERVER (accepts calls from the
    // application layer) — and also needs the client stub generated so
    // tests / future internal calls can use it too.
    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .compile(&["proto/file_gateway.proto"], &["proto"])?;

    Ok(())
}
