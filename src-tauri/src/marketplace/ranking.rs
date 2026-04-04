use std::cmp::Reverse;
use std::collections::HashMap;

use super::types::MarketplaceApp;

fn provider_priority(source: &str) -> u32 {
    match source {
        "F-Droid" => 40,
        "Aptoide" => 25,
        "GitHub" => 20,
        _ => 10,
    }
}

fn normalized_key(app: &MarketplaceApp) -> String {
    let package = app.package_name.trim().to_lowercase();
    if package.is_empty() { app.name.trim().to_lowercase() } else { package }
}

fn merge_preferred(primary: &MarketplaceApp, candidate: &MarketplaceApp) -> bool {
    let primary_score = (
        primary.installable as u8,
        provider_priority(&primary.source),
        primary.downloads_count.unwrap_or(0),
    );
    let candidate_score = (
        candidate.installable as u8,
        provider_priority(&candidate.source),
        candidate.downloads_count.unwrap_or(0),
    );
    candidate_score > primary_score
}

pub fn dedupe_results(results: Vec<MarketplaceApp>) -> Vec<MarketplaceApp> {
    let mut deduped: HashMap<String, MarketplaceApp> = HashMap::new();

    for app in results {
        let key = normalized_key(&app);
        match deduped.get_mut(&key) {
            Some(existing) => {
                if !existing.available_sources.iter().any(|source| source == &app.source) {
                    existing.available_sources.push(app.source.clone());
                    existing.available_sources.sort();
                }

                if existing.download_url.is_none() {
                    existing.download_url = app.download_url.clone();
                }
                if existing.repo_url.is_none() {
                    existing.repo_url = app.repo_url.clone();
                }
                if existing.icon_url.is_none() {
                    existing.icon_url = app.icon_url.clone();
                }
                if existing.summary.is_empty() && !app.summary.is_empty() {
                    existing.summary = app.summary.clone();
                }
                if existing.updated_at.is_none() {
                    existing.updated_at = app.updated_at.clone();
                }
                if existing.language.is_none() {
                    existing.language = app.language.clone();
                }
                existing.installable = existing.installable || app.installable;

                if merge_preferred(existing, &app) {
                    existing.name = app.name.clone();
                    existing.package_name = app.package_name.clone();
                    existing.version = app.version.clone();
                    existing.source = app.source.clone();
                    existing.download_url =
                        app.download_url.clone().or_else(|| existing.download_url.clone());
                    existing.repo_url = app.repo_url.clone().or_else(|| existing.repo_url.clone());
                    existing.icon_url = app.icon_url.clone().or_else(|| existing.icon_url.clone());
                    existing.size = app.size.or(existing.size);
                    existing.rating = app.rating.or(existing.rating);
                    existing.downloads_count = app.downloads_count.or(existing.downloads_count);
                    existing.malware_status =
                        app.malware_status.clone().or_else(|| existing.malware_status.clone());
                    existing.categories = if app.categories.is_empty() {
                        existing.categories.clone()
                    } else {
                        app.categories.clone()
                    };
                    existing.updated_at =
                        app.updated_at.clone().or_else(|| existing.updated_at.clone());
                    existing.language = app.language.clone().or_else(|| existing.language.clone());
                }
            }
            None => {
                let mut app = app;
                if app.available_sources.is_empty() {
                    app.available_sources.push(app.source.clone());
                }
                deduped.insert(key, app);
            }
        }
    }

    deduped.into_values().collect()
}

/// Heuristic-based relevance scoring engine.
///
/// Signals (weighted, descending priority):
/// 1. String matching: exact package/name match, prefix match, substring match
/// 2. Installability: verified APK availability is the strongest quality signal
/// 3. Topic scoring: android-related topics boost (GitHub-Store parity)
/// 4. Language bias: Kotlin/Java/Dart repos are likely Android apps
/// 5. Freshness: recently updated repos score higher than abandoned ones
/// 6. Provider priority: F-Droid > Aptoide > GitHub for same-name results
/// 7. Engagement: capped download/star count
/// 8. Rating: existing rating signal (Aptoide)
fn relevance_score(app: &MarketplaceApp, query: &str) -> u64 {
    let q = query.trim().to_lowercase();
    let name = app.name.to_lowercase();
    let package = app.package_name.to_lowercase();
    let mut score = provider_priority(&app.source) as u64;

    // ─── String matching (exact > prefix > contains) ──────────
    if package == q {
        score += 1_000;
    } else if name == q {
        score += 900;
    }
    // Prefix bonus (non-exclusive to allow stacking with exact)
    if name.starts_with(&q) || package.starts_with(&q) {
        score += 500;
    }
    if name.contains(&q) || package.contains(&q) {
        score += 250;
    }

    // ─── Installability (CRITICAL — raised from 120) ──────────
    // Verified APK availability is the strongest quality signal.
    if app.installable {
        score += 200;
    }

    // ─── Topic scoring (GitHub-Store parity) ──────────────────
    for topic in &app.categories {
        match topic.to_lowercase().as_str() {
            "android" | "android-app" | "android-application" => score += 80,
            "apk" | "mobile" | "mobile-app" => score += 50,
            "app" | "gui" | "application" | "open-source" => score += 20,
            _ => {}
        }
    }

    // ─── Language bias ────────────────────────────────────────
    // Kotlin/Java repos are overwhelmingly Android apps.
    if let Some(lang) = &app.language {
        match lang.to_lowercase().as_str() {
            "kotlin" | "java" => score += 40,
            "dart" => score += 30,
            "javascript" | "typescript" => score += 15,
            _ => {}
        }
    }

    // ─── Freshness signal ────────────────────────────────────
    // ISO 8601 string comparison works for chronological ordering.
    if let Some(updated) = &app.updated_at {
        if updated.as_str() > "2026-01-01" {
            score += 40;
        } else if updated.as_str() > "2025-06-01" {
            score += 20;
        } else if updated.as_str() > "2025-01-01" {
            score += 10;
        }
    }

    // ─── Rating signal (Aptoide) ─────────────────────────────
    if let Some(rating) = app.rating {
        score += (rating * 10.0).min(50.0) as u64;
    }

    // ─── Engagement (capped — prevents gaming) ───────────────
    score += app.downloads_count.unwrap_or(0).min(250);

    score
}

pub fn sort_results(results: &mut [MarketplaceApp], query: &str, sort_by: &str) {
    match sort_by {
        "name" => {
            results.sort_by_cached_key(|app| app.name.to_lowercase());
        }
        "downloads" => {
            results.sort_by_key(|app| Reverse(app.downloads_count.unwrap_or(0)));
        }
        "recentlyUpdated" => {
            results.sort_by_key(|app| Reverse(app.updated_at.clone().unwrap_or_default()));
        }
        _ => {
            // Use cached key to avoid recomputing heuristic score per comparison
            results.sort_by_cached_key(|app| Reverse(relevance_score(app, query)));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_app(
        name: &str,
        package_name: &str,
        source: &str,
        downloads_count: u64,
    ) -> MarketplaceApp {
        MarketplaceApp {
            name: name.to_string(),
            package_name: package_name.to_string(),
            source: source.to_string(),
            downloads_count: Some(downloads_count),
            installable: true,
            ..Default::default()
        }
    }

    #[test]
    fn dedupe_merges_available_sources() {
        let results = vec![
            build_app("Signal", "org.signal", "F-Droid", 100),
            build_app("Signal", "org.signal", "GitHub", 80),
        ];

        let deduped = dedupe_results(results);

        assert_eq!(deduped.len(), 1);
        assert_eq!(deduped[0].available_sources.len(), 2);
    }

    #[test]
    fn exact_package_match_ranks_highest() {
        let mut results = vec![
            build_app("Signal", "org.signal", "F-Droid", 100),
            build_app("Signal Beta", "org.signal.beta", "GitHub", 1_000),
        ];

        sort_results(&mut results, "org.signal", "relevance");

        assert_eq!(results[0].package_name, "org.signal");
    }

    #[test]
    fn installable_boost_outranks_stars() {
        let mut installable = build_app("App A", "com.app.a", "GitHub", 50);
        installable.installable = true;

        let mut repo_only = build_app("App B", "com.app.b", "GitHub", 200);
        repo_only.installable = false;

        let mut results = vec![repo_only, installable];
        sort_results(&mut results, "app", "relevance");

        assert_eq!(results[0].package_name, "com.app.a");
    }

    #[test]
    fn topic_android_provides_boost() {
        let mut with_topic = build_app("MyApp", "com.myapp", "GitHub", 50);
        with_topic.categories = vec!["android".to_string(), "apk".to_string()];

        let without_topic = build_app("MyApp2", "com.myapp2", "GitHub", 50);

        let score_with = relevance_score(&with_topic, "myapp");
        let score_without = relevance_score(&without_topic, "myapp");

        assert!(score_with > score_without, "Topic boost should increase score");
    }

    #[test]
    fn language_kotlin_provides_boost() {
        let mut kotlin_app = build_app("KotlinApp", "com.kotlin", "GitHub", 50);
        kotlin_app.language = Some("Kotlin".to_string());

        let plain_app = build_app("PlainApp", "com.plain", "GitHub", 50);

        let score_kotlin = relevance_score(&kotlin_app, "app");
        let score_plain = relevance_score(&plain_app, "app");

        assert!(score_kotlin > score_plain, "Kotlin language should boost score");
    }

    #[test]
    fn freshness_provides_boost() {
        let mut recent = build_app("Recent", "com.recent", "GitHub", 50);
        recent.updated_at = Some("2026-03-15T00:00:00Z".to_string());

        let mut stale = build_app("Stale", "com.stale", "GitHub", 50);
        stale.updated_at = Some("2024-01-01T00:00:00Z".to_string());

        let score_recent = relevance_score(&recent, "app");
        let score_stale = relevance_score(&stale, "app");

        assert!(score_recent > score_stale, "Recent update should boost score");
    }

    #[test]
    fn dedupe_preserves_language_from_github() {
        let mut github = build_app("MyApp", "com.myapp", "GitHub", 50);
        github.language = Some("Kotlin".to_string());

        let fdroid = build_app("MyApp", "com.myapp", "F-Droid", 100);

        let deduped = dedupe_results(vec![fdroid, github]);

        assert_eq!(deduped.len(), 1);
        assert_eq!(deduped[0].language.as_deref(), Some("Kotlin"));
    }
}
