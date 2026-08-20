use reqwest::Client;
use serde_json::Value;

/// Extract GitHub `owner/repo` from any GitHub or forge URL.
///
/// Supports:
/// - `https://github.com/owner/repo`
/// - `https://github.com/owner/repo/releases/...`
/// - `https://github.com/owner/repo/blob/main/...`
/// - `https://raw.githubusercontent.com/owner/repo/main/...`
/// - `https://api.github.com/repos/owner/repo`
/// - `git@github.com:owner/repo.git`
pub fn extract_repo_from_url(url: &str) -> Option<String> {
    let trimmed = url.trim();
    let lower = trimmed.to_ascii_lowercase();

    // 1. Standard https://github.com/owner/repo
    if let Some(rest) = lower
        .strip_prefix("https://github.com/")
        .or_else(|| lower.strip_prefix("http://github.com/"))
        .or_else(|| lower.strip_prefix("git@github.com:"))
    {
        let original_rest = &trimmed[trimmed.len() - rest.len()..];
        let parts: Vec<&str> = original_rest.split('/').filter(|s| !s.is_empty()).collect();
        if parts.len() >= 2 {
            let owner = parts[0];
            let repo = parts[1].trim_end_matches(".git");
            if !owner.is_empty() && !repo.is_empty() {
                return Some(format!("{owner}/{repo}"));
            }
        }
    }

    // 2. Raw GitHub CDN: https://raw.githubusercontent.com/owner/repo/...
    if let Some(rest) = lower.strip_prefix("https://raw.githubusercontent.com/") {
        let original_rest = &trimmed[trimmed.len() - rest.len()..];
        let parts: Vec<&str> = original_rest.split('/').filter(|s| !s.is_empty()).collect();
        if parts.len() >= 2 {
            let owner = parts[0];
            let repo = parts[1].trim_end_matches(".git");
            if !owner.is_empty() && !repo.is_empty() {
                return Some(format!("{owner}/{repo}"));
            }
        }
    }

    // 3. GitHub API: https://api.github.com/repos/owner/repo
    if let Some(rest) = lower.strip_prefix("https://api.github.com/repos/") {
        let original_rest = &trimmed[trimmed.len() - rest.len()..];
        let parts: Vec<&str> = original_rest.split('/').filter(|s| !s.is_empty()).collect();
        if parts.len() >= 2 {
            let owner = parts[0];
            let repo = parts[1].trim_end_matches(".git");
            if !owner.is_empty() && !repo.is_empty() {
                return Some(format!("{owner}/{repo}"));
            }
        }
    }

    None
}

/// Checks if a string looks like a valid GitHub repository slug (`owner/repo`).
pub fn is_github_slug(s: &str) -> bool {
    let parts: Vec<&str> = s.split('/').collect();
    if parts.len() != 2 {
        return false;
    }
    let (owner, repo) = (parts[0], parts[1]);
    !owner.is_empty()
        && !repo.is_empty()
        && !owner.contains(' ')
        && !repo.contains(' ')
        && !owner.contains('.')
        && !owner.contains('@')
}

/// Synchronous local resolver: resolves from slugs and fallback URLs directly.
pub fn resolve_github_repo(
    identifier: &str,
    download_url: Option<&str>,
    repo_url: Option<&str>,
) -> Option<String> {
    let trimmed = identifier.trim();

    // 1. If identifier is already a valid owner/repo
    if is_github_slug(trimmed) {
        return Some(trimmed.to_string());
    }

    // 2. Try extracting from repo_url
    if let Some(extracted) = repo_url.and_then(extract_repo_from_url) {
        return Some(extracted);
    }

    // 3. Try extracting from download_url
    if let Some(extracted) = download_url.and_then(extract_repo_from_url) {
        return Some(extracted);
    }

    None
}

/// Fully dynamic asynchronous resolver:
/// When given an Android reverse-DNS package ID (`com.example.app`), resolves the
/// corresponding GitHub repository slug by:
/// 1. Synchronous URL extraction from provided parameters.
/// 2. Querying F-Droid package metadata (`sourceCode` repository link).
/// 3. Querying GitHub search API (`q={package_id} topic:android`).
pub async fn resolve_github_repo_dynamic(
    client: &Client,
    identifier: &str,
    download_url: Option<&str>,
    repo_url: Option<&str>,
    token: &Option<String>,
) -> Option<String> {
    // 1. Try immediate sync resolution first
    if let Some(resolved) = resolve_github_repo(identifier, download_url, repo_url) {
        return Some(resolved);
    }

    let trimmed = identifier.trim();
    if !trimmed.contains('.') {
        return None;
    }

    // 2. Dynamic lookup via F-Droid metadata (F-Droid index contains upstream sourceCode URL)
    if let Some(extracted) = fetch_fdroid_source_repo(client, trimmed).await {
        return Some(extracted);
    }

    // 3. Dynamic lookup via GitHub Repository Search API
    search_github_repo_for_package(client, trimmed, token).await
}

async fn fetch_fdroid_source_repo(client: &Client, package_id: &str) -> Option<String> {
    let fdroid_url = format!("https://f-droid.org/api/v1/packages/{package_id}");
    let resp = client.get(&fdroid_url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let pkg = resp.json::<Value>().await.ok()?;
    if let Some(extracted) = pkg["sourceCode"].as_str().and_then(extract_repo_from_url) {
        return Some(extracted);
    }
    if let Some(extracted) = pkg["issueTracker"].as_str().and_then(extract_repo_from_url) {
        return Some(extracted);
    }
    None
}

async fn search_github_repo_for_package(
    client: &Client,
    package_id: &str,
    token: &Option<String>,
) -> Option<String> {
    let q = format!("\"{package_id}\" topic:android fork:false");
    let search_url = format!(
        "https://api.github.com/search/repositories?q={}&sort=stars&per_page=3",
        urlencoding::encode(&q)
    );

    let mut req = client.get(&search_url).header("User-Agent", "ADB-GUI-Next-Marketplace");
    if let Some(tok) = token {
        let tok_trimmed = tok.trim();
        if !tok_trimmed.is_empty() {
            req = req.header("Authorization", format!("Bearer {tok_trimmed}"));
        }
    }

    let resp = req.send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body = resp.json::<Value>().await.ok()?;
    let items = body["items"].as_array()?;
    let first_item = items.first()?;
    let full_name = first_item["full_name"].as_str()?;
    Some(full_name.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_repo_from_various_urls() {
        assert_eq!(
            extract_repo_from_url(
                "https://github.com/v4a-re/ViPER4Android-FX/releases/latest/download/app.apk"
            ),
            Some("v4a-re/ViPER4Android-FX".into())
        );
        assert_eq!(
            extract_repo_from_url("https://github.com/RikkaApps/Shizuku.git"),
            Some("RikkaApps/Shizuku".into())
        );
        assert_eq!(
            extract_repo_from_url(
                "https://raw.githubusercontent.com/topjohnwu/Magisk/master/README.md"
            ),
            Some("topjohnwu/Magisk".into())
        );
        assert_eq!(
            extract_repo_from_url("git@github.com:termux/termux-app.git"),
            Some("termux/termux-app".into())
        );
        assert_eq!(
            extract_repo_from_url("https://api.github.com/repos/LawnchairLauncher/lawnchair"),
            Some("LawnchairLauncher/lawnchair".into())
        );
    }

    #[test]
    fn test_is_github_slug() {
        assert!(is_github_slug("owner/repo"));
        assert!(is_github_slug("v4a-re/ViPER4Android-FX"));
        assert!(!is_github_slug("com.example.app"));
        assert!(!is_github_slug("https://github.com/owner/repo"));
        assert!(!is_github_slug("invalid slug with spaces/repo"));
    }
}
