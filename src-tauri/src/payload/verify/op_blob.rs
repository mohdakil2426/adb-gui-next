//! Per-operation blob verification (L3).
//!
//! AOSP `InstallOperation.data_sha256_hash` is the SHA-256 of the **payload-stored**
//! op bytes (`raw_data`): compressed for REPLACE_XZ / REPLACE_BZ / ZSTD, and the
//! raw extent bytes for REPLACE. Always hash before decompress.

use sha2::{Digest, Sha256};

/// SHA-256 of the install-op blob as stored in the payload.
pub fn hash_op_blob(raw_data: &[u8]) -> [u8; 32] {
    let digest = Sha256::digest(raw_data);
    let mut out = [0u8; 32];
    out.copy_from_slice(digest.as_slice());
    out
}

/// Returns true when `expected` is empty or equals SHA-256 of `raw_data`.
pub fn op_blob_matches(raw_data: &[u8], expected: &[u8]) -> bool {
    if expected.is_empty() {
        return true;
    }
    hash_op_blob(raw_data).as_slice() == expected
}
