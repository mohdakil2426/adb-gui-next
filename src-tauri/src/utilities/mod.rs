//! Safe, typed helpers for the Utilities view.
//!
//! The UI must not send arbitrary host argv for these operations. Slot letters,
//! logcat bounds, wipe confirmation, and ADB server lifecycle live here so the
//! command layer stays thin.

use serde::Serialize;

pub const WIPE_CONFIRM_PHRASE: &str = "WIPE";
pub const LOGCAT_LINES_MIN: u32 = 20;
pub const LOGCAT_LINES_MAX: u32 = 2000;
pub const LOGCAT_LINES_DEFAULT: u32 = 200;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostToolVersions {
    pub adb: String,
    pub fastboot: String,
}

/// Accepts only A/B boot slots (`a` / `b`), case-insensitive.
pub fn parse_ab_slot(slot: &str) -> Result<&'static str, String> {
    match slot.trim().to_ascii_lowercase().as_str() {
        "a" => Ok("a"),
        "b" => Ok("b"),
        other => Err(format!("invalid boot slot '{other}'; expected a or b")),
    }
}

pub fn clamp_logcat_lines(lines: Option<u32>) -> u32 {
    lines.unwrap_or(LOGCAT_LINES_DEFAULT).clamp(LOGCAT_LINES_MIN, LOGCAT_LINES_MAX)
}

pub fn require_wipe_confirm(confirm: &str) -> Result<(), String> {
    if confirm.trim() == WIPE_CONFIRM_PHRASE {
        Ok(())
    } else {
        Err("wipe confirmation must be WIPE".into())
    }
}

/// First non-empty line of `adb version` output, or a short fallback.
pub fn parse_tool_version_line(output: &str, fallback: &str) -> String {
    output
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map_or_else(|| fallback.to_string(), ToOwned::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_ab_slot_accepts_a_and_b() {
        assert_eq!(parse_ab_slot("a").unwrap(), "a");
        assert_eq!(parse_ab_slot("B").unwrap(), "b");
        assert_eq!(parse_ab_slot("  A  ").unwrap(), "a");
    }

    #[test]
    fn parse_ab_slot_rejects_other_values() {
        assert!(parse_ab_slot("c").is_err());
        assert!(parse_ab_slot("all").is_err());
        assert!(parse_ab_slot("").is_err());
        assert!(parse_ab_slot("--slot=a").is_err());
    }

    #[test]
    fn clamp_logcat_lines_bounds_request() {
        assert_eq!(clamp_logcat_lines(None), LOGCAT_LINES_DEFAULT);
        assert_eq!(clamp_logcat_lines(Some(1)), LOGCAT_LINES_MIN);
        assert_eq!(clamp_logcat_lines(Some(50_000)), LOGCAT_LINES_MAX);
        assert_eq!(clamp_logcat_lines(Some(400)), 400);
    }

    #[test]
    fn require_wipe_confirm_is_exact() {
        assert!(require_wipe_confirm("WIPE").is_ok());
        assert!(require_wipe_confirm(" wipe ").is_err());
        assert!(require_wipe_confirm("YES").is_err());
    }

    #[test]
    fn parse_tool_version_line_takes_first_nonempty() {
        let adb = "\nAndroid Debug Bridge version 1.0.41\nVersion 36.0.0\n";
        assert_eq!(
            parse_tool_version_line(adb, "adb unavailable"),
            "Android Debug Bridge version 1.0.41"
        );
        assert_eq!(parse_tool_version_line("   \n", "adb unavailable"), "adb unavailable");
    }
}
