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

fn relevance_score(app: &MarketplaceApp, query: &str) -> u64 {
    let q = query.trim().to_lowercase();
    let name = app.name.to_lowercase();
    let package = app.package_name.to_lowercase();

    let mut score = provider_priority(&app.source) as u64;

    if package == q {
        score += 1_000;
    }
    if name == q {
        score += 900;
    }
    if name.starts_with(&q) || package.starts_with(&q) {
        score += 500;
    }
    if name.contains(&q) || package.contains(&q) {
        score += 250;
    }
    if app.installable {
        score += 120;
    }
    if app.rating.is_some() {
        score += 40;
    }
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
            results.sort_by_key(|app| Reverse(relevance_score(app, query)));
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
}
