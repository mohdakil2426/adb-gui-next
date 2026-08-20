use base64::Engine;
use rand::RngCore;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone)]
pub struct PkceChallenge {
    pub state: String,
    pub code_verifier: String,
    pub code_challenge: String,
}

fn base64url_encode(input: &[u8]) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(input)
}

fn random_url_safe_string(byte_len: usize) -> String {
    let mut bytes = vec![0u8; byte_len];
    rand::thread_rng().fill_bytes(&mut bytes);
    base64url_encode(&bytes)
}

/// Generate PKCE triple: state, verifier, S256 challenge.
pub fn generate_pkce() -> PkceChallenge {
    let state = random_url_safe_string(32);
    let code_verifier = random_url_safe_string(64);
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let hash = hasher.finalize();
    let code_challenge = base64url_encode(&hash);
    PkceChallenge { state, code_verifier, code_challenge }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_generates_url_safe() {
        let pkce = generate_pkce();
        assert!(pkce.state.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_'));
        assert!(pkce.code_challenge.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_'));
        // verifier 64 bytes -> ~86 chars, challenge is SHA256 32 bytes -> 43 chars
        assert!(pkce.code_verifier.len() >= 43);
        assert_eq!(pkce.code_challenge.len(), 43);
    }

    #[test]
    fn pkce_deterministic_challenge() {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let mut hasher = Sha256::new();
        hasher.update(verifier.as_bytes());
        let hash = hasher.finalize();
        let challenge = base64url_encode(&hash);
        assert_eq!(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }
}
