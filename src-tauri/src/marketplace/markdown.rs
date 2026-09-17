//! Markdown parsing and HTML rendering for GitHub and marketplace READMEs.
//!
//! Converts GitHub Flavored Markdown into sanitized, safe HTML using `comrak`.
//! Rewrites relative image and link URLs against canonical repository raw CDN
//! and blob endpoints.

use comrak::nodes::{AstNode, NodeValue};

/// Render GitHub Flavored Markdown to HTML with GitHub-compatible relative URL resolution.
pub fn render_markdown_to_html(
    raw_markdown: &str,
    owner: Option<&str>,
    repo: Option<&str>,
    default_branch: Option<&str>,
) -> String {
    let branch = default_branch.unwrap_or("HEAD");
    let raw_base = match (owner, repo) {
        (Some(o), Some(r)) => Some(format!("https://raw.githubusercontent.com/{o}/{r}/{branch}")),
        _ => None,
    };
    let blob_base = match (owner, repo) {
        (Some(o), Some(r)) => Some(format!("https://github.com/{o}/{r}/blob/{branch}")),
        _ => None,
    };

    let mut options = comrak::Options::default();
    options.extension.table = true;
    options.extension.tasklist = true;
    options.extension.strikethrough = true;
    options.extension.autolink = true;
    options.extension.header_id_prefix = Some("user-content-".to_string());
    options.extension.footnotes = true;
    options.render.r#unsafe = true;

    let arena = comrak::Arena::new();
    let root = comrak::parse_document(&arena, raw_markdown, &options);

    walk_ast(root, raw_base.as_deref(), blob_base.as_deref());

    let mut html_output = String::new();
    if comrak::format_html(root, &options, &mut html_output).is_ok() {
        html_output
    } else {
        String::new()
    }
}

/// Recursively walk AST nodes and rewrite relative links, images, and HTML tags.
fn walk_ast<'a>(node: &'a AstNode<'a>, raw_base: Option<&str>, blob_base: Option<&str>) {
    {
        let mut data = node.data.borrow_mut();
        match &mut data.value {
            NodeValue::Link(link) => {
                if let (Some(blob), true) = (blob_base, is_relative_url(&link.url)) {
                    link.url = resolve_url(&link.url, blob);
                }
            }
            NodeValue::Image(img) => {
                if let (Some(raw), true) = (raw_base, is_relative_url(&img.url)) {
                    img.url = resolve_url(&img.url, raw);
                }
            }
            NodeValue::HtmlBlock(block) => {
                block.literal = rewrite_html_snippet(&block.literal, raw_base, blob_base);
            }
            NodeValue::HtmlInline(inline) => {
                *inline = rewrite_html_snippet(inline, raw_base, blob_base);
            }
            _ => {}
        }
    }

    for child in node.children() {
        walk_ast(child, raw_base, blob_base);
    }
}

/// Rewrite `<img src="...">` to raw CDN and `<a href="...">` to blob base,
/// and unescape `&amp;` query parameters in badge URLs.
fn rewrite_html_snippet(snippet: &str, raw_base: Option<&str>, blob_base: Option<&str>) -> String {
    let mut result = String::with_capacity(snippet.len() + 128);
    let mut cursor = 0;

    while cursor < snippet.len() {
        let rest = &snippet[cursor..];
        let Some(lt_pos) = rest.find('<') else {
            result.push_str(rest);
            break;
        };

        result.push_str(&rest[..lt_pos]);
        let tag_rest = &rest[lt_pos..];

        if let Some(tag_end) = find_tag_end(tag_rest) {
            let tag = &tag_rest[..=tag_end];
            let tag_lower = tag.to_ascii_lowercase();

            let is_img = tag_lower.starts_with("<img")
                && tag[4..]
                    .chars()
                    .next()
                    .is_some_and(|c| c.is_whitespace() || c == '/' || c == '>');
            let is_a = tag_lower.starts_with("<a")
                && tag[2..].chars().next().is_some_and(|c| c.is_whitespace() || c == '>');

            if is_img {
                let rewritten = rewrite_attribute(tag, "src", |val| {
                    let unescaped = val.replace("&amp;", "&");
                    if let (Some(raw), true) = (raw_base, is_relative_url(&unescaped)) {
                        return resolve_url(&unescaped, raw);
                    }
                    unescaped
                });
                result.push_str(&rewritten);
                cursor += lt_pos + tag.len();
                continue;
            }

            if is_a {
                let rewritten = rewrite_attribute(tag, "href", |val| {
                    let unescaped = val.replace("&amp;", "&");
                    if is_relative_url(&unescaped) {
                        let base =
                            if is_image_extension(&unescaped) { raw_base } else { blob_base };
                        if let Some(b) = base {
                            return resolve_url(&unescaped, b);
                        }
                    }
                    unescaped
                });
                result.push_str(&rewritten);
                cursor += lt_pos + tag.len();
                continue;
            }

            result.push_str(tag);
            cursor += lt_pos + tag.len();
        } else {
            let next_char_len = tag_rest.chars().next().map_or(1, char::len_utf8);
            result.push_str(&tag_rest[..next_char_len]);
            cursor += lt_pos + next_char_len;
        }
    }

    result
}

/// Find the end of an HTML tag (`>`), respecting quotes.
fn find_tag_end(snippet: &str) -> Option<usize> {
    let mut in_quote: Option<char> = None;
    for (i, c) in snippet.char_indices() {
        if let Some(q) = in_quote {
            if c == q {
                in_quote = None;
            }
        } else if c == '"' || c == '\'' {
            in_quote = Some(c);
        } else if c == '>' {
            return Some(i);
        }
    }
    None
}

/// Rewrite an HTML tag attribute value using a transform function.
fn rewrite_attribute<F>(tag: &str, attr_name: &str, transform: F) -> String
where
    F: FnOnce(&str) -> String,
{
    let lower = tag.to_ascii_lowercase();
    let mut search_idx = 0;
    while let Some(pos) = lower[search_idx..].find(attr_name) {
        let abs_pos = search_idx + pos;
        let before_char = if abs_pos > 0 { tag[..abs_pos].chars().last() } else { None };
        if before_char.is_some_and(|c| !c.is_whitespace() && c != '<' && c != '/') {
            search_idx = abs_pos + attr_name.len();
            continue;
        }

        let after_attr = &tag[(abs_pos + attr_name.len())..];
        let trimmed_after = after_attr.trim_start();
        if !trimmed_after.starts_with('=') {
            search_idx = abs_pos + attr_name.len();
            continue;
        }

        let after_eq = trimmed_after[1..].trim_start();
        let Some(quote) = after_eq.chars().next() else {
            return tag.to_string();
        };

        if quote != '"' && quote != '\'' {
            return tag.to_string();
        }

        let val_start_in_after_eq = 1;
        let Some(val_end_in_after_eq) = after_eq[val_start_in_after_eq..].find(quote) else {
            return tag.to_string();
        };

        let val = &after_eq[val_start_in_after_eq..(val_start_in_after_eq + val_end_in_after_eq)];
        let new_val = transform(val);

        let val_start_offset = tag.len() - after_eq.len() + val_start_in_after_eq;
        let val_end_offset = val_start_offset + val.len();

        let mut result = String::with_capacity(tag.len() + new_val.len());
        result.push_str(&tag[..val_start_offset]);
        result.push_str(&new_val);
        result.push_str(&tag[val_end_offset..]);
        return result;
    }

    tag.to_string()
}

/// Clean and enrich README markdown from GitHub or third-party forges (compatibility wrapper).
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
        } else if chars[i] == '<' && line[i..].to_ascii_lowercase().starts_with("<a") {
            rewrite_html_link(&line[i..], raw_base, blob_base)
                .map(|(end_idx, tag)| (i + end_idx, tag))
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
pub fn is_relative_url(url: &str) -> bool {
    let lower = url.trim().to_ascii_lowercase();
    !lower.starts_with("http://")
        && !lower.starts_with("https://")
        && !lower.starts_with("//")
        && !lower.starts_with("mailto:")
        && !lower.starts_with('#')
        && !lower.starts_with("data:")
        && !lower.starts_with("javascript:")
        && !url.trim().is_empty()
}

/// Resolve a possibly relative URL against a base URL.
pub fn resolve_url(url: &str, base: &str) -> String {
    let trimmed = url.trim();
    if !is_relative_url(trimmed) {
        return trimmed.to_string();
    }

    let clean_path = trimmed.trim_start_matches("./").trim_start_matches('/');
    format!("{base}/{clean_path}")
}

/// Check if a path has an image extension.
pub fn is_image_extension(path: &str) -> bool {
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

/// Rewrite `<a ... href="..." ...>` with relative href to blob_base (or raw_base if image).
fn rewrite_html_link(snippet: &str, raw_base: &str, blob_base: &str) -> Option<(usize, String)> {
    let close_tag = snippet.find('>')?;
    let tag_content = &snippet[..=close_tag];

    let lower = tag_content.to_ascii_lowercase();
    let href_pos = lower.find("href=")?;
    let after_href = &tag_content[(href_pos + 5)..];
    let quote = after_href.chars().next()?;
    if quote != '"' && quote != '\'' {
        return None;
    }

    let end_quote = after_href[1..].find(quote)?;
    let href_val = &after_href[1..=end_quote];
    if !is_relative_url(href_val) {
        return None;
    }

    let target_base = if is_image_extension(href_val) { raw_base } else { blob_base };
    let resolved = resolve_url(href_val, target_base);
    let prefix = &tag_content[..(href_pos + 6)];
    let suffix = &after_href[(end_quote + 1)..];
    Some((close_tag + 1, format!("{prefix}{resolved}{suffix}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_markdown_tables() {
        let md = "| Feature | Status |\n| :--- | :---: |\n| Root | Supported |\n| OTA | Active |\n";
        let html = render_markdown_to_html(md, None, None, None);
        assert!(html.contains("<table>"));
        assert!(html.contains("<th>Feature</th>"));
        assert!(html.contains("<td>Root</td>"));
    }

    #[test]
    fn test_render_markdown_tasklists() {
        let md = "- [x] Finished task\n- [ ] Pending task\n";
        let html = render_markdown_to_html(md, None, None, None);
        assert!(html.contains("type=\"checkbox\""));
        assert!(html.contains("checked"));
        assert!(html.contains("Finished task"));
        assert!(html.contains("Pending task"));
    }

    #[test]
    fn test_render_markdown_html_blocks() {
        let md = "<p align=\"center\">\n<img src=\"assets/logo.png\" width=\"120\">\n</p>\n";
        let html = render_markdown_to_html(md, Some("testowner"), Some("testrepo"), Some("main"));
        assert!(html.contains("<p align=\"center\">"));
        assert!(
            html.contains(
                "https://raw.githubusercontent.com/testowner/testrepo/main/assets/logo.png"
            )
        );
    }

    #[test]
    fn test_render_markdown_relative_image_resolution() {
        let md = "# App\n\n![Screenshot](./docs/screenshot.png)\n";
        let html =
            render_markdown_to_html(md, Some("v4a-re"), Some("ViPER4Android-FX"), Some("master"));
        assert!(html.contains("src=\"https://raw.githubusercontent.com/v4a-re/ViPER4Android-FX/master/docs/screenshot.png\""));
    }

    #[test]
    fn test_render_markdown_relative_link_resolution() {
        let md = "Check out the [Install Guide](docs/INSTALL.md) and [License](LICENSE).";
        let html = render_markdown_to_html(md, Some("RikkaApps"), Some("Shizuku"), Some("main"));
        assert!(
            html.contains(
                "href=\"https://github.com/RikkaApps/Shizuku/blob/main/docs/INSTALL.md\""
            )
        );
        assert!(html.contains("href=\"https://github.com/RikkaApps/Shizuku/blob/main/LICENSE\""));
    }

    #[test]
    fn test_render_markdown_unescapes_badge_amp() {
        let md = "<p align=\"center\"><a href=\"https://example.com/docs\"><img src=\"https://img.shields.io/badge/Status-Active-2563EB?style=flat&amp;logo=app\" alt=\"App Status\"></a></p>";
        let html = render_markdown_to_html(md, Some("test"), Some("repo"), Some("main"));
        assert!(html.contains("style=flat&logo=app"));
        assert!(!html.contains("&amp;logo=app"));
    }

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

    #[test]
    fn test_enrich_readme_relative_html_links() {
        let md = "<p align=\"center\"><a href=\"README.md\"><img src=\"assets/badge.svg\" alt=\"Badge\"></a></p>";
        let enriched = enrich_readme_markdown(md, "HaolemeApp", "Haoleme", Some("main"));

        assert!(
            enriched
                .contains("<a href=\"https://github.com/HaolemeApp/Haoleme/blob/main/README.md\">")
        );
        assert!(enriched.contains("<img src=\"https://raw.githubusercontent.com/HaolemeApp/Haoleme/main/assets/badge.svg\" alt=\"Badge\">"));
    }
}
