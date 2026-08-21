use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::Duration;

use reqwest::Client;
use serde::Deserialize;

use super::pkce::generate_pkce;
use super::token_store::{ManagedTokenStore, StoredGithubToken};
use crate::CmdResult;

const GITHUB_OAUTH_AUTHORIZE_URL: &str = "https://github.com/login/oauth/authorize";
const GITHUB_OAUTH_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const DEFAULT_CLIENT_ID: &str = "Ov23linTY28VFpFjFiI9"; // Komi public fallback (works for device + web); override via GITHUB_CLIENT_ID env or settings

#[derive(Debug, Deserialize)]
struct TokenExchangeResponse {
    access_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

fn build_auth_url(
    client_id: &str,
    pkce: &super::pkce::PkceChallenge,
    redirect_uri: &str,
) -> String {
    let scope = "read:user user:email repo";
    format!(
        "{}?client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256&allow_signup=true",
        GITHUB_OAUTH_AUTHORIZE_URL,
        urlencoding::encode(client_id),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(scope),
        urlencoding::encode(&pkce.state),
        urlencoding::encode(&pkce.code_challenge)
    )
}

/// Human-readable error for loopback callback parsing
fn parse_callback_query(path: &str, expected_state: &str) -> Result<String, String> {
    let query = path.split('?').nth(1).unwrap_or("");
    let mut code: Option<String> = None;
    let mut state: Option<String> = None;
    let mut error: Option<String> = None;
    for pair in query.split('&') {
        let mut split = pair.splitn(2, '=');
        let k = split.next().unwrap_or("");
        let v = split.next().unwrap_or("");
        let v = urlencoding::decode(v).unwrap_or_else(|_| v.into()).to_string();
        match k {
            "code" => code = Some(v),
            "state" => state = Some(v),
            "error" => error = Some(v),
            _ => {}
        }
    }
    if let Some(e) = error {
        return Err(format!("GitHub OAuth error: {e}"));
    }
    let state_val = state.ok_or("Missing state in callback")?;
    if state_val != expected_state {
        return Err("State mismatch — possible CSRF, aborting".into());
    }
    code.ok_or_else(|| "Missing code in callback".into())
}

/// Exchange code + verifier for access_token
async fn exchange_code(
    client: &Client,
    client_id: &str,
    code: &str,
    code_verifier: &str,
    redirect_uri: &str,
) -> CmdResult<String> {
    let params = [
        ("client_id", client_id),
        ("code", code),
        ("code_verifier", code_verifier),
        ("redirect_uri", redirect_uri),
        ("grant_type", "authorization_code"),
    ];
    let body = params
        .iter()
        .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&");

    let resp = client
        .post(GITHUB_OAUTH_TOKEN_URL)
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Token exchange request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Token exchange failed: HTTP {}", resp.status()));
    }
    let payload: TokenExchangeResponse =
        resp.json().await.map_err(|e| format!("Token exchange parse failed: {e}"))?;
    if let Some(tok) = payload.access_token {
        if tok.trim().is_empty() {
            return Err("GitHub returned empty access_token".into());
        }
        Ok(tok.trim().to_string())
    } else if let Some(err) = payload.error {
        let desc = payload.error_description.unwrap_or_default();
        Err(format!("GitHub OAuth error: {err} {desc}"))
    } else {
        Err("GitHub did not return access_token".into())
    }
}

/// Start localhost loopback and open browser; returns token on success.
/// Runs blocking TcpListener in spawn_blocking; timeout 300s (5 min).
pub async fn run_web_auth_flow(
    http_client: Client,
    token_store: &ManagedTokenStore,
    client_id_override: Option<String>,
) -> CmdResult<StoredGithubToken> {
    let client_id = client_id_override.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| {
        std::env::var("GITHUB_CLIENT_ID").unwrap_or_else(|_| DEFAULT_CLIENT_ID.to_string())
    });

    let pkce = generate_pkce();

    // Bind loopback 127.0.0.1:0 (OS picks port)
    let listener =
        TcpListener::bind("127.0.0.1:0").map_err(|e| format!("Failed to bind loopback: {e}"))?;
    listener.set_nonblocking(false).ok();
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}/callback");
    let auth_url = build_auth_url(&client_id, &pkce, &redirect_uri);

    // Open browser via opener (fallback: return URL for FE to open)
    let _ = open::that(&auth_url);

    // Accept one connection with 5 min timeout
    listener.set_nonblocking(true).map_err(|e| format!("Failed to set nonblocking: {e}"))?;

    let start = std::time::Instant::now();
    let timeout = Duration::from_secs(300);
    let mut stream_opt: Option<std::net::TcpStream> = None;
    let mut raw_request = String::new();

    while start.elapsed() < timeout {
        match listener.accept() {
            Ok((mut stream, _)) => {
                stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                raw_request = String::from_utf8_lossy(&buf[..n]).to_string();
                // Send HTTP response before parsing
                let body = "<html><body><h2>ADB GUI Next — Login successful. You can close this window.</h2></body></html>";
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(response.as_bytes());
                let _ = stream.flush();
                stream_opt = Some(stream);
                break;
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
            Err(e) => return Err(format!("Loopback accept failed: {e}")),
        }
    }

    let _ = stream_opt; // keep until drop
    if raw_request.is_empty() {
        return Err(
            "OAuth flow timed out — no callback received (port blocked or browser closed)".into()
        );
    }

    // Extract path from "GET /callback?code=... HTTP/1.1"
    let first_line = raw_request.lines().next().unwrap_or("");
    let path = first_line.split_whitespace().nth(1).unwrap_or("/");

    let code = parse_callback_query(path, &pkce.state)?;

    let access_token =
        exchange_code(&http_client, &client_id, &code, &pkce.code_verifier, &redirect_uri).await?;

    // Fetch user to validate and store login
    let user_login = crate::marketplace::auth::fetch_user_summary(&http_client, &access_token)
        .await
        .ok()
        .map(|u| u.login);

    let stored = StoredGithubToken {
        access_token: access_token.clone(),
        token_type: "Bearer".into(),
        scope: Some("read:user user:email repo".into()),
        saved_at_epoch_millis: Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        ),
        login: user_login,
    };

    token_store.save_token(stored.clone())?;
    Ok(stored)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_callback_ok() {
        let path = "/callback?code=abc123&state=xyz";
        let code = parse_callback_query(path, "xyz").unwrap();
        assert_eq!(code, "abc123");
    }

    #[test]
    fn parse_callback_state_mismatch() {
        let path = "/callback?code=abc&state=bad";
        let err = parse_callback_query(path, "good").unwrap_err();
        assert!(err.contains("State mismatch"));
    }

    #[test]
    fn build_url_contains_pkce() {
        let pkce = crate::marketplace::pkce::generate_pkce();
        let url = build_auth_url("client123", &pkce, "http://127.0.0.1:1234/callback");
        assert!(url.contains("code_challenge="));
        assert!(url.contains("code_challenge_method=S256"));
    }
}
