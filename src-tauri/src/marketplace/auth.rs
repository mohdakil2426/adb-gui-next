use reqwest::Client;
use serde::Deserialize;

use super::types::{
    GithubDeviceFlowChallenge, GithubDeviceFlowPollResult, GithubRateLimitSummary,
    GithubUserSummary,
};
use crate::CmdResult;

const GITHUB_DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL: &str = "https://api.github.com/user";
const GITHUB_RATE_LIMIT_URL: &str = "https://api.github.com/rate_limit";

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    verification_uri_complete: Option<String>,
    expires_in: u64,
    interval: u64,
}

#[derive(Debug, Deserialize)]
struct TokenPollResponse {
    access_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
    interval: Option<u64>,
}

fn encoded_body(pairs: &[(&str, &str)]) -> String {
    pairs
        .iter()
        .map(|(key, value)| format!("{}={}", urlencoding::encode(key), urlencoding::encode(value)))
        .collect::<Vec<_>>()
        .join("&")
}

pub async fn start_device_flow(
    client: &Client,
    client_id: &str,
    scopes: &[String],
) -> CmdResult<GithubDeviceFlowChallenge> {
    let scope = scopes.join(" ");
    let body = encoded_body(&[("client_id", client_id), ("scope", scope.as_str())]);

    let response = client
        .post(GITHUB_DEVICE_CODE_URL)
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("GitHub device flow request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        if let Ok(error_payload) = response.json::<serde_json::Value>().await {
            if let Some(desc) = error_payload.get("error_description").and_then(|v| v.as_str()) {
                return Err(format!("GitHub API Error: {desc}"));
            }
        }
        return Err(format!("GitHub device flow request failed: HTTP {status}"));
    }

    let payload = response
        .json::<DeviceCodeResponse>()
        .await
        .map_err(|e| format!("GitHub device flow parse failed: {e}"))?;

    Ok(GithubDeviceFlowChallenge {
        device_code: payload.device_code,
        user_code: payload.user_code,
        verification_uri: payload.verification_uri,
        verification_uri_complete: payload.verification_uri_complete,
        expires_in: payload.expires_in,
        interval: payload.interval,
    })
}

pub async fn poll_device_flow(
    client: &Client,
    client_id: &str,
    device_code: &str,
) -> CmdResult<GithubDeviceFlowPollResult> {
    let body = encoded_body(&[
        ("client_id", client_id),
        ("device_code", device_code),
        ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
    ]);

    let response = client
        .post(GITHUB_ACCESS_TOKEN_URL)
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("GitHub token polling failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("GitHub token polling failed: HTTP {}", response.status()));
    }

    let payload = response
        .json::<TokenPollResponse>()
        .await
        .map_err(|e| format!("GitHub token polling parse failed: {e}"))?;

    if let Some(access_token) = payload.access_token {
        let user = fetch_user_summary(client, &access_token).await.ok();
        let rate_limit = fetch_rate_limit_summary(client, &access_token).await.ok();

        return Ok(GithubDeviceFlowPollResult {
            status: "authorized".to_string(),
            access_token: Some(access_token),
            interval: payload.interval,
            message: None,
            user,
            rate_limit,
        });
    }

    let error = payload.error.unwrap_or_else(|| "unknown_error".to_string());
    Ok(GithubDeviceFlowPollResult {
        status: error,
        access_token: None,
        interval: payload.interval,
        message: payload.error_description,
        user: None,
        rate_limit: None,
    })
}

pub async fn fetch_user_summary(client: &Client, token: &str) -> CmdResult<GithubUserSummary> {
    let response = client
        .get(GITHUB_USER_URL)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("GitHub user request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("GitHub user request failed: HTTP {}", response.status()));
    }

    let payload: serde_json::Value =
        response.json().await.map_err(|e| format!("GitHub user parse failed: {e}"))?;

    Ok(GithubUserSummary {
        login: payload["login"].as_str().unwrap_or("github-user").to_string(),
        avatar_url: payload["avatar_url"].as_str().map(|value| value.to_string()),
        profile_url: payload["html_url"].as_str().map(|value| value.to_string()),
    })
}

pub async fn fetch_rate_limit_summary(
    client: &Client,
    token: &str,
) -> CmdResult<GithubRateLimitSummary> {
    let response = client
        .get(GITHUB_RATE_LIMIT_URL)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("GitHub rate limit request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("GitHub rate limit request failed: HTTP {}", response.status()));
    }

    let payload: serde_json::Value =
        response.json().await.map_err(|e| format!("GitHub rate limit parse failed: {e}"))?;

    let core = &payload["resources"]["core"];
    Ok(GithubRateLimitSummary {
        limit: core["limit"].as_u64().unwrap_or(0),
        remaining: core["remaining"].as_u64().unwrap_or(0),
        reset_at: core["reset"].as_i64().map(|value| value.to_string()),
    })
}
