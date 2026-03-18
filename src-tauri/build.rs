fn main() {
    let proto = "../docs/adb-gui-kit/refernces/backend/payload/update_metadata.proto";
    println!("cargo:rerun-if-changed={proto}");
    let protoc = protoc_bin_vendored::protoc_bin_path().expect("failed to find protoc");
    unsafe {
        std::env::set_var("PROTOC", protoc);
    }
    prost_build::Config::new()
        .compile_protos(&[proto], &["../docs/adb-gui-kit/refernces/backend/payload"])
        .expect("failed to compile payload protobuf");
    tauri_build::build()
}
