use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::CmdResult;

const KEYRING_SERVICE: &str = "com.astrixforge.adbguinext";
const KEYRING_ACCOUNT_TOKEN: &str = "github_token";
const KEYRING_ACCOUNT_HOST_TOKENS: &str = "host_tokens_v1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StoredGithubToken {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "tokenType")]
    pub token_type: String,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(rename = "savedAtEpochMillis")]
    pub saved_at_epoch_millis: Option<u64>,
    #[serde(default)]
    pub login: Option<String>,
}

impl StoredGithubToken {
    pub fn is_expired(&self, expires_in_secs: Option<u64>) -> bool {
        if let (Some(saved), Some(exp)) = (self.saved_at_epoch_millis, expires_in_secs) {
            let now =
                SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
            saved + exp * 1000 < now
        } else {
            false
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HostToken {
    pub host: String,
    pub token: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(rename = "createdAtEpochMillis")]
    pub created_at_epoch_millis: u64,
}

fn now_millis() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64
}

fn keyring_entry(account: &str) -> CmdResult<keyring::Entry> {
    keyring::Entry::new(KEYRING_SERVICE, account).map_err(|e| format!("Keyring init failed: {e}"))
}

pub struct TokenStoreInner {
    token_cache: Option<StoredGithubToken>,
    host_tokens_cache: Option<Vec<HostToken>>,
}

impl Default for TokenStoreInner {
    fn default() -> Self {
        Self { token_cache: None, host_tokens_cache: None }
    }
}

pub struct ManagedTokenStore(pub Mutex<TokenStoreInner>);

impl Default for ManagedTokenStore {
    fn default() -> Self {
        Self(Mutex::new(TokenStoreInner::default()))
    }
}

impl ManagedTokenStore {
    pub fn get_token(&self) -> CmdResult<Option<StoredGithubToken>> {
        let mut guard = self.0.lock().map_err(|_| "TokenStore lock poisoned".to_string())?;
        if let Some(cached) = guard.token_cache.clone() {
            return Ok(Some(cached));
        }
        // Load from keyring
        let entry = keyring_entry(KEYRING_ACCOUNT_TOKEN)?;
        match entry.get_password() {
            Ok(raw) => {
                let token: StoredGithubToken = serde_json::from_str(&raw)
                    .map_err(|e| format!("Token JSON parse failed: {e}"))?;
                guard.token_cache = Some(token.clone());
                Ok(Some(token))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Keyring read failed: {e}")),
        }
    }

    pub fn blocking_current_token(&self) -> Option<StoredGithubToken> {
        self.get_token().ok().flatten()
    }

    pub fn save_token(&self, mut token: StoredGithubToken) -> CmdResult<()> {
        if token.saved_at_epoch_millis.is_none() {
            token.saved_at_epoch_millis = Some(now_millis());
        }
        let raw = serde_json::to_string(&token).map_err(|e| e.to_string())?;
        let entry = keyring_entry(KEYRING_ACCOUNT_TOKEN)?;
        entry.set_password(&raw).map_err(|e| format!("Keyring save failed: {e}"))?;
        let mut guard = self.0.lock().map_err(|_| "TokenStore lock poisoned".to_string())?;
        guard.token_cache = Some(token);
        Ok(())
    }

    pub fn clear_token(&self) -> CmdResult<()> {
        let entry = keyring_entry(KEYRING_ACCOUNT_TOKEN)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(e) => return Err(format!("Keyring delete failed: {e}")),
        }
        let mut guard = self.0.lock().map_err(|_| "TokenStore lock poisoned".to_string())?;
        guard.token_cache = None;
        Ok(())
    }

    pub fn get_host_tokens(&self) -> CmdResult<Vec<HostToken>> {
        let mut guard = self.0.lock().map_err(|_| "TokenStore lock poisoned".to_string())?;
        if let Some(cached) = guard.host_tokens_cache.clone() {
            return Ok(cached);
        }
        let entry = keyring_entry(KEYRING_ACCOUNT_HOST_TOKENS)?;
        match entry.get_password() {
            Ok(raw) => {
                let tokens: Vec<HostToken> = serde_json::from_str(&raw)
                    .map_err(|e| format!("HostTokens parse failed: {e}"))?;
                guard.host_tokens_cache = Some(tokens.clone());
                Ok(tokens)
            }
            Err(keyring::Error::NoEntry) => Ok(vec![]),
            Err(e) => Err(format!("Keyring read failed: {e}")),
        }
    }

    pub fn save_host_token(
        &self,
        host: String,
        token: String,
        display_name: Option<String>,
    ) -> CmdResult<Vec<HostToken>> {
        let mut tokens = self.get_host_tokens()?;
        let normalized = normalize_host(&host);
        tokens.retain(|t| t.host != normalized);
        tokens.push(HostToken {
            host: normalized,
            token,
            display_name,
            created_at_epoch_millis: now_millis(),
        });
        let raw = serde_json::to_string(&tokens).map_err(|e| e.to_string())?;
        let entry = keyring_entry(KEYRING_ACCOUNT_HOST_TOKENS)?;
        entry.set_password(&raw).map_err(|e| format!("Keyring save failed: {e}"))?;
        let mut guard = self.0.lock().map_err(|_| "TokenStore lock poisoned".to_string())?;
        guard.host_tokens_cache = Some(tokens.clone());
        Ok(tokens)
    }

    pub fn remove_host_token(&self, host: &str) -> CmdResult<Vec<HostToken>> {
        let normalized = normalize_host(host);
        let mut tokens = self.get_host_tokens()?;
        tokens.retain(|t| t.host != normalized);
        let raw = serde_json::to_string(&tokens).map_err(|e| e.to_string())?;
        let entry = keyring_entry(KEYRING_ACCOUNT_HOST_TOKENS)?;
        if tokens.is_empty() {
            let _ = entry.delete_credential();
        } else {
            entry.set_password(&raw).map_err(|e| format!("Keyring save failed: {e}"))?;
        }
        let mut guard = self.0.lock().map_err(|_| "TokenStore lock poisoned".to_string())?;
        guard.host_tokens_cache = Some(tokens.clone());
        Ok(tokens)
    }

    /// Try to read PAT from `gh` CLI as fallback (user authorized).
    pub fn try_gh_cli_token(&self) -> Option<String> {
        let output = std::process::Command::new("gh").args(["auth", "token"]).output().ok()?;
        if !output.status.success() {
            return None;
        }
        let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if token.len() >= 20 && !token.contains(char::is_whitespace) { Some(token) } else { None }
    }
}

fn normalize_host(input: &str) -> String {
    let mut s = input.trim().to_ascii_lowercase();
    for prefix in ["https://", "http://"] {
        if let Some(rest) = s.strip_prefix(prefix) {
            s = rest.to_string();
            break;
        }
    }
    s = s.split('/').next().unwrap_or(&s).to_string();
    for strip in ["www.", "api."] {
        if let Some(rest) = s.strip_prefix(strip) {
            s = rest.to_string();
        }
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_host_strips() {
        assert_eq!(normalize_host("https://api.github.com/"), "github.com");
        assert_eq!(normalize_host("https://codeberg.org/api/v1"), "codeberg.org");
        assert_eq!(normalize_host("WWW.GITHUB.COM"), "github.com");
    }

    #[test]
    fn stored_token_expiry() {
        let mut t = StoredGithubToken {
            access_token: "tok".into(),
            token_type: "Bearer".into(),
            scope: None,
            saved_at_epoch_millis: Some(0),
            login: None,
        };
        assert!(t.is_expired(Some(3600)));
        t.saved_at_epoch_millis = Some(now_millis());
        assert!(!t.is_expired(Some(3600)));
    }
}
