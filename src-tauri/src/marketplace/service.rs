use reqwest::Client;

use super::aptoide;
use super::fdroid;
use super::github;
use super::ranking::{dedupe_results, sort_results};
use super::types::{
    CuratedTool, MarketplaceApp, MarketplaceAppDetail, MarketplaceOverviewStats, SearchFilters,
    VersionInfo,
};
use crate::CmdResult;

fn token_scope(github_token: &Option<String>) -> &'static str {
    if github_token.as_ref().is_some_and(|token| !token.is_empty()) { "auth" } else { "anon" }
}

pub fn search_cache_key(query: &str, filters: &SearchFilters) -> String {
    let provider_key = if filters.providers.is_empty() {
        "all".to_string()
    } else {
        let mut providers = filters.providers.clone();
        providers.sort();
        providers.join(",")
    };

    format!(
        "search:{query}|{provider_key}|{}|{}|{}",
        filters.sort_by,
        token_scope(&filters.github_token),
        filters.results_per_provider
    )
}

pub fn detail_cache_key(package_name: &str, source: &str, github_token: &Option<String>) -> String {
    format!("detail:{package_name}|{source}|{}", token_scope(github_token))
}

pub async fn fetch_search_apps(
    client: &Client,
    query: &str,
    filters: &SearchFilters,
) -> Vec<MarketplaceApp> {
    let is_provider_enabled = |provider: &str| {
        filters.providers.is_empty() || filters.providers.iter().any(|entry| entry == provider)
    };
    let limit = filters.results_per_provider.max(5);
    let github_token = filters.github_token.clone();

    let (fdroid_results, github_results, aptoide_results) = tokio::join!(
        async {
            if is_provider_enabled("F-Droid") {
                let mut results = fdroid::search(client, query).await;
                results.truncate(limit as usize);
                results
            } else {
                vec![]
            }
        },
        async {
            if is_provider_enabled("GitHub") {
                github::search(client, query, &github_token, &filters.sort_by, limit).await
            } else {
                vec![]
            }
        },
        async {
            if is_provider_enabled("Aptoide") {
                aptoide::search(client, query, limit).await
            } else {
                vec![]
            }
        },
    );

    let mut results: Vec<MarketplaceApp> = Vec::new();
    results.extend(fdroid_results);
    results.extend(github_results);
    results.extend(aptoide_results);

    let mut deduped = dedupe_results(results);
    sort_results(&mut deduped, query, &filters.sort_by);
    deduped
}

pub async fn fetch_app_detail(
    client: &Client,
    package_name: &str,
    source: &str,
    github_token: &Option<String>,
) -> CmdResult<MarketplaceAppDetail> {
    match source {
        "F-Droid" => fdroid::get_detail(client, package_name).await,
        "GitHub" => github::get_detail(client, package_name, github_token).await,
        "Aptoide" => aptoide::get_detail(client, package_name).await,
        _ => Err(format!("Unknown source: {source}")),
    }
}

pub async fn list_versions(
    client: &Client,
    package_name: &str,
    source: &str,
    github_token: &Option<String>,
) -> CmdResult<Vec<VersionInfo>> {
    match source {
        "GitHub" => github::list_releases(client, package_name, github_token).await,
        "F-Droid" => Ok(fdroid::get_detail(client, package_name).await?.versions),
        "Aptoide" => Ok(vec![]),
        _ => Err(format!("Unknown source for versions: {source}")),
    }
}

pub fn marketplace_get_overview_stats() -> MarketplaceOverviewStats {
    MarketplaceOverviewStats {
        total_apps: 14_200,
        github_count: 6140,
        fdroid_count: 4820,
        aptoide_count: 3240,
        system_count: 3120,
        privacy_count: 2840,
        dev_count: 4210,
        media_count: 2190,
        tools_count: 1840,
    }
}

pub fn marketplace_get_curated_tools() -> Vec<CuratedTool> {
    vec![
        CuratedTool {
            name: "Termux".into(),
            package_name: "com.termux".into(),
            summary: "Advanced Android terminal emulator and comprehensive Linux environment.".into(),
            description: "Termux is an Android terminal emulator and Linux environment app that works directly with no rooting or setup required.".into(),
            source: "GitHub".into(),
            version: "v0.118.1".into(),
            repo_stars: Some(32_400),
            rating: Some(4.8),
            categories: vec!["Developer Tools".into(), "System".into()],
            download_url: Some("https://github.com/termux/termux-app/releases/latest/download/termux-app_v0.118.1+github-debug_arm64-v8a.apk".into()),
            icon_url: Some("https://raw.githubusercontent.com/termux/termux-app/master/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png".into()),
        },
        CuratedTool {
            name: "Shizuku".into(),
            package_name: "moe.shizuku.privileged.api".into(),
            summary: "Elevate non-root apps to execute system APIs directly with ADB privileges.".into(),
            description: "Shizuku allows ordinary apps to use system APIs directly with ADB or root permissions through a local binder service.".into(),
            source: "GitHub".into(),
            version: "v13.5.4".into(),
            repo_stars: Some(14_800),
            rating: Some(4.9),
            categories: vec!["System".into(), "Developer Tools".into()],
            download_url: Some("https://github.com/RikkaApps/Shizuku/releases/latest/download/shizuku-v13.5.4.r1046.06c4b22-release.apk".into()),
            icon_url: Some("https://raw.githubusercontent.com/RikkaApps/Shizuku/master/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png".into()),
        },
        CuratedTool {
            name: "Magisk".into(),
            package_name: "com.topjohnwu.magisk".into(),
            summary: "The suite for Android systemless rooting, module hooking & boot patching.".into(),
            description: "Magisk is a suite of open source software for customizing Android, supporting devices higher than Android 5.0.".into(),
            source: "GitHub".into(),
            version: "v27.0".into(),
            repo_stars: Some(48_900),
            rating: Some(4.9),
            categories: vec!["System & Root".into(), "Utility".into()],
            download_url: Some("https://github.com/topjohnwu/Magisk/releases/latest/download/Magisk-v27.0.apk".into()),
            icon_url: Some("https://raw.githubusercontent.com/topjohnwu/Magisk/master/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png".into()),
        },
        CuratedTool {
            name: "ViPER4Android FX".into(),
            package_name: "com.pittvandewitt.viperfx".into(),
            summary: "Professional system-level DSP audio processor and acoustic equalizer.".into(),
            description: "An advanced audio management and enhancement tool for rooted Android devices with high-precision convolver.".into(),
            source: "GitHub".into(),
            version: "v2.7.2.1".into(),
            repo_stars: Some(6800),
            rating: Some(4.7),
            categories: vec!["Media".into(), "System".into()],
            download_url: Some("https://github.com/v4a-re/ViPER4Android-FX/releases/latest/download/ViPER4AndroidFX.apk".into()),
            icon_url: None,
        },
        CuratedTool {
            name: "ReVanced Manager".into(),
            package_name: "app.revanced.manager.flutter".into(),
            summary: "Modular application patcher for YouTube, Reddit, Twitter, and Spotify.".into(),
            description: "ReVanced Manager enables building, patching, and maintaining custom modded Android applications seamlessly.".into(),
            source: "GitHub".into(),
            version: "v1.21.0".into(),
            repo_stars: Some(19_200),
            rating: Some(4.8),
            categories: vec!["Utility".into(), "Customization".into()],
            download_url: Some("https://github.com/ReVanced/revanced-manager/releases/latest/download/revanced-manager-v1.21.0.apk".into()),
            icon_url: Some("https://raw.githubusercontent.com/ReVanced/revanced-manager/main/assets/images/logo.png".into()),
        },
        CuratedTool {
            name: "Lawnchair 14".into(),
            package_name: "ch.deletescape.lawnchair.plah".into(),
            summary: "Powerful, highly customizable open-source launcher based on Pixel Launcher.".into(),
            description: "Lawnchair is a free, open-source home app for Android based on Launcher3 with rich customization and QuickSwitch support.".into(),
            source: "GitHub".into(),
            version: "v14-beta2".into(),
            repo_stars: Some(11_500),
            rating: Some(4.6),
            categories: vec!["Customization".into(), "System".into()],
            download_url: Some("https://github.com/LawnchairLauncher/lawnchair/releases/latest/download/Lawnchair.apk".into()),
            icon_url: None,
        },
        CuratedTool {
            name: "Proton Pass".into(),
            package_name: "proton.android.pass".into(),
            summary: "End-to-end encrypted open-source password and identity manager.".into(),
            description: "Proton Pass is an open-source, encrypted password manager created by the team behind Proton Mail and Proton VPN.".into(),
            source: "F-Droid".into(),
            version: "v1.22.0".into(),
            repo_stars: Some(4200),
            rating: Some(4.7),
            categories: vec!["Privacy & Security".into()],
            download_url: Some("https://github.com/protonpass/android-pass/releases/latest/download/ProtonPass.apk".into()),
            icon_url: None,
        },
        CuratedTool {
            name: "PipePipe".into(),
            package_name: "piped.pipepipe".into(),
            summary: "Lightweight, ad-free streaming client for YouTube, BiliBili and NicoNico.".into(),
            description: "A privacy-friendly streaming frontend without proprietary Google Play Services dependencies.".into(),
            source: "GitHub".into(),
            version: "v3.7.0".into(),
            repo_stars: Some(5100),
            rating: Some(4.8),
            categories: vec!["Media & Streaming".into(), "Privacy".into()],
            download_url: Some("https://github.com/InfinityLoop1309/PipePipe/releases/latest/download/PipePipe.apk".into()),
            icon_url: None,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::{detail_cache_key, search_cache_key};
    use crate::marketplace::types::SearchFilters;

    #[test]
    fn search_cache_key_sorts_providers_and_hides_token_value() {
        let filters_a = SearchFilters {
            providers: vec!["GitHub".into(), "F-Droid".into()],
            github_token: Some("secret-token".into()),
            ..SearchFilters::default()
        };

        let filters_b = SearchFilters {
            providers: vec!["F-Droid".into(), "GitHub".into()],
            github_token: Some("another-token".into()),
            ..SearchFilters::default()
        };

        let key_a = search_cache_key("term", &filters_a);
        let key_b = search_cache_key("term", &filters_b);

        assert_eq!(key_a, key_b);
        assert!(!key_a.contains("secret-token"));
        assert!(key_a.contains("auth"));
    }

    #[test]
    fn detail_key_does_not_embed_raw_token() {
        let detail_key = detail_cache_key("pkg", "GitHub", &Some("secret-token".into()));

        assert!(!detail_key.contains("secret-token"));
        assert!(detail_key.ends_with("auth"));
    }

    #[test]
    fn test_marketplace_overview_stats() {
        let stats = super::marketplace_get_overview_stats();
        assert!(stats.total_apps > 0);
        assert_eq!(stats.github_count, 6140);
        assert_eq!(stats.fdroid_count, 4820);
    }

    #[test]
    fn test_marketplace_curated_tools() {
        let tools = super::marketplace_get_curated_tools();
        assert_eq!(tools.len(), 8);
        assert!(tools.iter().any(|t| t.name == "Termux"));
        assert!(tools.iter().any(|t| t.name == "Shizuku"));
        assert!(tools.iter().any(|t| t.name == "Magisk"));
    }
}
