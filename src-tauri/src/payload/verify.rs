use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

#[derive(Debug, Clone, Copy)]
pub struct VerifyMode {
    pub layer3_enabled: bool,
    pub layer4_enabled: bool,
}

impl Default for VerifyMode {
    fn default() -> Self {
        Self { layer3_enabled: true, layer4_enabled: true }
    }
}

impl VerifyMode {
    #[allow(dead_code)]
    pub fn layer3_enabled(&self) -> bool {
        self.layer3_enabled
    }

    #[allow(dead_code)]
    pub fn layer4_enabled(&self) -> bool {
        self.layer4_enabled
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct VerificationResult {
    pub success: bool,
    pub errors: Vec<String>,
}

#[allow(dead_code)]
pub fn verify_sha256(path: &Path, expected: &[u8]) -> Result<bool, std::io::Error> {
    let file = File::open(path)?;
    let mut reader = BufReader::with_capacity(1024 * 1024, file);
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    let digest = hasher.finalize();
    Ok(digest.as_slice() == expected)
}

#[allow(dead_code)]
pub fn compute_file_sha256(path: &Path) -> std::io::Result<Vec<u8>> {
    let file = File::open(path)?;
    let mut reader = BufReader::with_capacity(1024 * 1024, file);
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher.finalize().to_vec())
}

#[allow(dead_code)]
pub fn plausibility_check(path: &Path) -> Result<bool, std::io::Error> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut buf = [0u8; 8192];
    let mut first_chunk = true;
    let mut all_zero = true;
    let mut repeating_count = 0u32;

    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        if first_chunk {
            all_zero = buf[..n].iter().all(|&b| b == 0);
            first_chunk = false;
        }
        for window in buf[..n].windows(4) {
            if window.iter().all(|&b| b == window[0]) && window[0] != 0 {
                repeating_count += 1;
            }
        }
    }
    Ok(!all_zero && repeating_count < 100)
}
