use serde_json::Value;

/// Classify Android ABI / Architecture from an APK filename.
/// Returns `(priority_score, abi_label)`.
/// Higher priority score = better candidate for modern 64-bit Android devices.
pub fn classify_abi(filename: &str) -> (i32, &'static str) {
    let lower = filename.to_ascii_lowercase();

    // 1. 64-bit ARM (Primary standard for Android devices)
    if lower.contains("arm64-v8a")
        || lower.contains("arm64_v8a")
        || lower.contains("arm64")
        || lower.contains("aarch64")
        || lower.contains("v8a")
    {
        return (100, "arm64-v8a");
    }

    // 2. Explicit Universal / Multi-arch APK
    if lower.contains("universal")
        || lower.contains("all-arch")
        || lower.contains("fat")
        || lower.contains("multiarch")
        || lower.contains("full")
    {
        return (80, "universal");
    }

    // 3. 32-bit ARM (Legacy fallback)
    if lower.contains("armeabi-v7a")
        || lower.contains("armeabi_v7a")
        || lower.contains("armv7a")
        || lower.contains("armv7")
        || lower.contains("armeabi")
        || lower.contains("arm32")
    {
        return (60, "armeabi-v7a");
    }

    // 4. x86_64 (Emulator / Intel Chromebooks)
    if lower.contains("x86_64")
        || lower.contains("x86-64")
        || lower.contains("x64")
        || lower.contains("amd64")
    {
        return (40, "x86_64");
    }

    // 5. x86 32-bit (Legacy emulator)
    if lower.contains("x86") || lower.contains("i686") || lower.contains("i386") {
        return (20, "x86");
    }

    // 6. Generic APK without architecture in filename (assumed universal / single build)
    (70, "universal")
}

/// Determine if a GitHub release asset is a valid, installable Android APK.
///
/// Filters out:
/// - Non-APK extensions (`.aab`, `.xapk`, `.apks`, `.zip`, `.tar.gz`, `.json`, `.sha256`)
/// - Alpine Linux APK packages (`.apk` targeting alpine packaging systems)
/// - Pure development test builds unless it is the only APK asset published
pub fn is_apk_asset(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();

    if !lower.ends_with(".apk") {
        return false;
    }

    // Exclude bundles and archives that happen to match substring
    if lower.ends_with(".aab")
        || lower.ends_with(".xapk")
        || lower.ends_with(".apks")
        || lower.ends_with(".zip")
        || lower.ends_with(".tar.gz")
        || lower.ends_with(".tar.xz")
        || lower.ends_with(".sig")
        || lower.ends_with(".asc")
        || lower.ends_with(".sha256")
        || lower.ends_with(".md5")
    {
        return false;
    }

    // Exclude Alpine Linux package manager APKs (e.g., alpine-keys.apk, package-r1.apk)
    if lower.starts_with("alpine-")
        || lower.contains("_alpine")
        || lower.contains("apk-tools")
        || lower.contains("alpine-sdk")
    {
        return false;
    }

    // Exclude test / runner / benchmark helper artifacts if they are obvious test harnesses
    if lower.contains("androidTest.apk")
        || lower.contains("-androidTest")
        || lower.contains("_test_runner")
    {
        return false;
    }

    true
}

/// Filter and rank release APK assets, picking the best asset for Android devices.
pub fn rank_and_select_best_apk<'a>(assets: &'a [Value]) -> Option<&'a Value> {
    let mut apk_assets: Vec<(&'a Value, i32)> = assets
        .iter()
        .filter(|asset| asset["name"].as_str().is_some_and(is_apk_asset))
        .map(|asset| {
            let name = asset["name"].as_str().unwrap_or("");
            let (mut score, _) = classify_abi(name);

            let lower = name.to_ascii_lowercase();
            // Penalize dev debug builds slightly compared to release builds
            if lower.contains("debug") && !lower.contains("github-debug") {
                score -= 15;
            }
            // Reward clean release naming
            if lower.contains("release") || lower.contains("stable") {
                score += 10;
            }

            (asset, score)
        })
        .collect();

    // Sort descending by score
    apk_assets.sort_by_key(|entry| std::cmp::Reverse(entry.1));
    apk_assets.first().map(|(asset, _)| *asset)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_is_apk_asset_valid() {
        assert!(is_apk_asset("app-release.apk"));
        assert!(is_apk_asset("termux-app_v0.118.1+github-debug_arm64-v8a.apk"));
        assert!(is_apk_asset("ViPER4AndroidFX.apk"));
        assert!(is_apk_asset("Shizuku-v13.5.4.apk"));
    }

    #[test]
    fn test_is_apk_asset_invalid() {
        assert!(!is_apk_asset("app.aab"));
        assert!(!is_apk_asset("source.zip"));
        assert!(!is_apk_asset("app.apk.sha256"));
        assert!(!is_apk_asset("alpine-keys.apk"));
        assert!(!is_apk_asset("app-androidTest.apk"));
    }

    #[test]
    fn test_classify_abi() {
        assert_eq!(classify_abi("app-arm64-v8a.apk").1, "arm64-v8a");
        assert_eq!(classify_abi("app-universal.apk").1, "universal");
        assert_eq!(classify_abi("app-armeabi-v7a.apk").1, "armeabi-v7a");
        assert_eq!(classify_abi("app-x86_64.apk").1, "x86_64");
    }

    #[test]
    fn test_rank_and_select_best_apk() {
        let assets = vec![
            json!({ "name": "app-x86.apk", "browser_download_url": "https://example.com/x86.apk" }),
            json!({ "name": "app-arm64-v8a.apk", "browser_download_url": "https://example.com/arm64.apk" }),
            json!({ "name": "app-armeabi-v7a.apk", "browser_download_url": "https://example.com/v7a.apk" }),
        ];

        let best = rank_and_select_best_apk(&assets).unwrap();
        assert_eq!(best["name"], "app-arm64-v8a.apk");
    }
}
