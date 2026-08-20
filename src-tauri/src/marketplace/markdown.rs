/// Clean and enrich README markdown from GitHub or third-party forges.
///
/// Rewrites relative image paths (`./docs/logo.png`) to raw GitHub CDN URLs,
/// rewrites relative documentation links to GitHub blob views, and flattens
/// HTML `<details>` tags for seamless presentation in the frontend UI.
pub fn enrich_readme_markdown(
    raw_markdown: &str,
    owner: &str,
    repo: &str,
    default_branch: Option<&str>,
) -> String {
    let branch = default_branch.unwrap_or("HEAD");
    let normalized = raw_markdown.replace("\r\n", "\n");

    let raw_base = format!("https://raw.githubusercontent.com/{owner}/{repo}/{branch}");
    let blob_base = format!("https://github.com/{owner}/{repo}/blob/{branch}");

    let mut result = String::with_capacity(normalized.len() + 1024);
    let mut in_code_block = false;

    for line in normalized.lines() {
        let trimmed_start = line.trim_start();
        if trimmed_start.starts_with("```") || trimmed_start.starts_with("~~~") {
            in_code_block = !in_code_block;
            result.push_str(line);
            result.push('\n');
            continue;
        }

        if in_code_block {
            result.push_str(line);
            result.push('\n');
            continue;
        }

        // Flatten HTML <details> and <summary> into clean markdown
        if trimmed_start.starts_with("<details") || trimmed_start.starts_with("</details>") {
            continue;
        }

        let processed_line = if trimmed_start.starts_with("<summary>")
            && trimmed_start.ends_with("</summary>")
        {
            let inner =
                trimmed_start.trim_start_matches("<summary>").trim_end_matches("</summary>").trim();
            format!("### {inner}")
        } else {
            line.to_string()
        };

        // Rewrite relative image and link references in this line
        let rewritten = rewrite_relative_urls(&processed_line, &raw_base, &blob_base);
        result.push_str(&rewritten);
        result.push('\n');
    }

    result.trim().to_string()
}

/// Rewrites relative markdown images `![alt](rel_path)`, HTML `img src`, and markdown links `[text](rel_path)`.
fn rewrite_relative_urls(line: &str, raw_base: &str, blob_base: &str) -> String {
    let mut output = String::with_capacity(line.len() + 64);
    let chars: Vec<char> = line.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        // 1. Check for Markdown image: ![alt](url)
        let link_res = if chars[i] == '!' && i + 1 < len && chars[i + 1] == '[' {
            parse_link(&chars, i + 1).map(|(end_idx, alt, url)| {
                let resolved_url = resolve_url(&url, raw_base);
                (end_idx, format!("![{alt}]({resolved_url})"))
            })
        } else if chars[i] == '[' {
            parse_link(&chars, i).map(|(end_idx, text, url)| {
                let target_base = if is_image_extension(&url) { raw_base } else { blob_base };
                let resolved_url = resolve_url(&url, target_base);
                (end_idx, format!("[{text}]({resolved_url})"))
            })
        } else if chars[i] == '<' && line[i..].to_ascii_lowercase().starts_with("<img") {
            rewrite_html_img(&line[i..], raw_base).map(|(end_idx, tag)| (i + end_idx, tag))
        } else {
            None
        };

        if let Some((end_idx, rewritten)) = link_res {
            output.push_str(&rewritten);
            i = end_idx;
            continue;
        }

        output.push(chars[i]);
        i += 1;
    }

    output
}

/// Parse `[text](url)` starting at `[` index. Returns `Some((next_index, text, url))`.
fn parse_link(chars: &[char], start_bracket: usize) -> Option<(usize, String, String)> {
    let len = chars.len();
    let mut close_bracket = None;
    let mut depth = 0;

    for (idx, &ch) in chars.iter().enumerate().take(len).skip(start_bracket) {
        if ch == '[' {
            depth += 1;
        } else if ch == ']' {
            depth -= 1;
            if depth == 0 {
                close_bracket = Some(idx);
                break;
            }
        }
    }

    let close_b = close_bracket?;
    if close_b + 1 >= len || chars[close_b + 1] != '(' {
        return None;
    }

    let open_p = close_b + 1;
    let mut close_p = None;
    for (idx, &ch) in chars.iter().enumerate().take(len).skip(open_p + 1) {
        if ch == ')' {
            close_p = Some(idx);
            break;
        }
    }

    let close_paren = close_p?;
    let text: String = chars[(start_bracket + 1)..close_b].iter().collect();
    let url: String = chars[(open_p + 1)..close_paren].iter().collect();

    Some((close_paren + 1, text, url.trim().to_string()))
}

/// Check if a URL is relative (does not start with http://, https://, mailto:, #, or data:).
fn is_relative_url(url: &str) -> bool {
    let lower = url.trim().to_ascii_lowercase();
    !lower.starts_with("http://")
        && !lower.starts_with("https://")
        && !lower.starts_with("//")
        && !lower.starts_with("mailto:")
        && !lower.starts_with('#')
        && !lower.starts_with("data:")
        && !url.trim().is_empty()
}

/// Resolve a possibly relative URL against a base URL.
fn resolve_url(url: &str, base: &str) -> String {
    let trimmed = url.trim();
    if !is_relative_url(trimmed) {
        return trimmed.to_string();
    }

    let clean_path = trimmed.trim_start_matches("./").trim_start_matches('/');
    format!("{base}/{clean_path}")
}

/// Check if a path has an image extension.
fn is_image_extension(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    let clean = lower.split('?').next().unwrap_or(&lower);
    clean.ends_with(".png")
        || clean.ends_with(".jpg")
        || clean.ends_with(".jpeg")
        || clean.ends_with(".gif")
        || clean.ends_with(".webp")
        || clean.ends_with(".svg")
        || clean.ends_with(".ico")
}

/// Rewrite `<img ... src="..." ...>` with relative src to raw_base.
fn rewrite_html_img(snippet: &str, raw_base: &str) -> Option<(usize, String)> {
    let close_tag = snippet.find('>')?;
    let tag_content = &snippet[..=close_tag];

    let lower = tag_content.to_ascii_lowercase();
    let src_pos = lower.find("src=")?;
    let after_src = &tag_content[(src_pos + 4)..];
    let quote = after_src.chars().next()?;
    if quote != '"' && quote != '\'' {
        return None;
    }

    let end_quote = after_src[1..].find(quote)?;
    let src_val = &after_src[1..=end_quote];
    if !is_relative_url(src_val) {
        return None;
    }

    let resolved = resolve_url(src_val, raw_base);
    let prefix = &tag_content[..(src_pos + 5)];
    let suffix = &after_src[(end_quote + 1)..];
    Some((close_tag + 1, format!("{prefix}{resolved}{suffix}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_enrich_readme_relative_images() {
        let md = "# App\n\n![Screenshot](./docs/screenshot.png)\n\n<img src=\"assets/logo.png\" width=\"100\">\n";
        let enriched = enrich_readme_markdown(md, "v4a-re", "ViPER4Android-FX", Some("master"));

        assert!(enriched.contains("![Screenshot](https://raw.githubusercontent.com/v4a-re/ViPER4Android-FX/master/docs/screenshot.png)"));
        assert!(enriched.contains("<img src=\"https://raw.githubusercontent.com/v4a-re/ViPER4Android-FX/master/assets/logo.png\" width=\"100\">"));
    }

    #[test]
    fn test_enrich_readme_relative_links() {
        let md = "See [Installation Guide](docs/INSTALL.md) or [License](LICENSE).";
        let enriched = enrich_readme_markdown(md, "RikkaApps", "Shizuku", Some("main"));

        assert!(enriched.contains(
            "[Installation Guide](https://github.com/RikkaApps/Shizuku/blob/main/docs/INSTALL.md)"
        ));
        assert!(
            enriched.contains("[License](https://github.com/RikkaApps/Shizuku/blob/main/LICENSE)")
        );
    }

    #[test]
    fn test_preserves_absolute_urls() {
        let md = "[Website](https://shizuku.rikka.app) and ![Badge](https://img.shields.io/badge/test-v1-blue.svg)";
        let enriched = enrich_readme_markdown(md, "RikkaApps", "Shizuku", Some("main"));

        assert!(enriched.contains("[Website](https://shizuku.rikka.app)"));
        assert!(enriched.contains("![Badge](https://img.shields.io/badge/test-v1-blue.svg)"));
    }

    #[test]
    fn test_preserves_code_blocks() {
        let md = "```bash\n![NotImage](relative/path.png)\n```";
        let enriched = enrich_readme_markdown(md, "test", "repo", Some("main"));

        assert!(enriched.contains("![NotImage](relative/path.png)"));
    }
}
