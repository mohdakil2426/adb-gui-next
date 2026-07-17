// Build scripts: set_var is unsafe in Rust 2024; protoc path is fixed before prost runs.
#![allow(unsafe_code)]
#![allow(clippy::expect_used)]

fn main() {
    let proto = "update_metadata.proto";
    println!("cargo::rustc-check-cfg=cfg(rust_analyzer)");
    println!("cargo:rerun-if-changed={proto}");
    let protoc = protoc_bin_vendored::protoc_bin_path().expect("failed to find protoc");
    // SAFETY: build script is single-threaded; PROTOC is only read by prost-build next.
    unsafe {
        std::env::set_var("PROTOC", protoc);
    }
    prost_build::Config::new()
        .compile_protos(&[proto], &["."])
        .expect("failed to compile payload protobuf");
    tauri_build::build();
}
