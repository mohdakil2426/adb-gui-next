#![cfg_attr(not(windows), allow(dead_code))]

//! Read Machine PATH and Google USB driver presence without elevation.

use std::process::Command;

use super::paths::{INSTALL_DIR, USB_INF_NAME, path_contains_dir};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub fn machine_path_contains_install_dir() -> bool {
    machine_path().is_some_and(|value| path_contains_dir(&value, INSTALL_DIR))
}

pub fn machine_path() -> Option<String> {
    #[cfg(windows)]
    {
        let output = run_hidden(
            "reg.exe",
            &[
                "query",
                r"HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
                "/v",
                "Path",
            ],
        )?;
        parse_reg_query_path(&output)
    }
    #[cfg(not(windows))]
    {
        None
    }
}

pub fn google_usb_driver_status() -> (bool, String) {
    #[cfg(windows)]
    {
        let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into());
        let pnputil = std::path::Path::new(&system_root).join("System32").join("pnputil.exe");
        let output = run_hidden(&pnputil, &["/enum-drivers"]).unwrap_or_default();
        if let Some(label) = parse_google_usb_driver(&output) {
            return (true, label);
        }
        (false, "Not installed".into())
    }
    #[cfg(not(windows))]
    {
        (false, "Windows only".into())
    }
}

fn run_hidden(program: impl AsRef<std::path::Path>, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new(program.as_ref());
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd.output().ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    if stdout.is_empty() { Some(stderr) } else { Some(stdout) }
}

/// Parse `reg query ... /v Path` stdout.
pub fn parse_reg_query_path(output: &str) -> Option<String> {
    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("HKEY_") || trimmed.starts_with("End of") {
            continue;
        }
        let lower = trimmed.to_ascii_lowercase();
        let Some(idx) = lower.find("reg_expand_sz").or_else(|| lower.find("reg_sz")) else {
            continue;
        };
        let value = trimmed[idx..]
            .split_once(char::is_whitespace)
            .map(|(_, rest)| rest.trim())
            .filter(|rest| !rest.is_empty())?;
        return Some(value.to_string());
    }
    None
}

/// Parse `pnputil /enum-drivers` for the official Google USB driver package.
pub fn parse_google_usb_driver(output: &str) -> Option<String> {
    let mut published = String::new();
    let mut original = String::new();
    let mut provider = String::new();
    let mut class_name = String::new();
    let mut version = String::new();

    for raw in output.lines().chain(std::iter::once("")) {
        let line = raw.trim();
        if line.is_empty() {
            if is_google_usb_package(&original, &provider, &class_name) {
                return Some(format_driver_label(&published, &provider, &version));
            }
            published.clear();
            original.clear();
            provider.clear();
            class_name.clear();
            version.clear();
            continue;
        }
        if let Some(rest) = value_after(line, "Published Name:") {
            published = rest;
        } else if let Some(rest) = value_after(line, "Original Name:") {
            original = rest;
        } else if let Some(rest) = value_after(line, "Provider Name:") {
            provider = rest;
        } else if let Some(rest) = value_after(line, "Class Name:") {
            class_name = rest;
        } else if let Some(rest) = value_after(line, "Driver Version:") {
            version = rest;
        }
    }
    None
}

fn is_google_usb_package(original: &str, provider: &str, class_name: &str) -> bool {
    let original_l = original.to_ascii_lowercase();
    if original_l.contains(&USB_INF_NAME.to_ascii_lowercase()) {
        return true;
    }
    let provider_l = provider.to_ascii_lowercase();
    let class_l = class_name.to_ascii_lowercase();
    provider_l.contains("google") && class_l.contains("android") && class_l.contains("usb")
}

fn format_driver_label(published: &str, provider: &str, version: &str) -> String {
    let mut parts = Vec::new();
    if !published.is_empty() {
        parts.push(published.to_string());
    }
    if !provider.is_empty() {
        parts.push(provider.to_string());
    }
    if !version.is_empty() {
        parts.push(version.to_string());
    }
    if parts.is_empty() {
        "Installed".into()
    } else {
        format!("Installed ({})", parts.join(" · "))
    }
}

fn value_after(line: &str, header: &str) -> Option<String> {
    let stripped =
        if line.len() >= header.len() && line[..header.len()].eq_ignore_ascii_case(header) {
            line[header.len()..].trim().to_string()
        } else {
            return None;
        };
    Some(stripped)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_reg_query_path_reads_expand_sz() {
        let output = r"
HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\Environment
    Path    REG_EXPAND_SZ    C:\Windows\system32;%SystemRoot%;C:\Android\platform-tools
";
        let path = parse_reg_query_path(output).unwrap();
        assert!(path_contains_dir(&path, INSTALL_DIR));
    }

    #[test]
    fn parse_google_usb_driver_from_pnputil() {
        let output = r"
Microsoft PnP Utility

Published Name:     oem42.inf
Original Name:      netvwifibus.inf
Provider Name:      Microsoft
Class Name:         Net

Published Name:     oem7.inf
Original Name:      android_winusb.inf
Provider Name:      Google, Inc.
Class Name:         Android Usb Device Class
Driver Version:     08/28/2014 11.0.0000.00000
Signer Name:        Microsoft Windows Hardware Compatibility Publisher
";
        let label = parse_google_usb_driver(output).unwrap();
        assert!(label.contains("oem7.inf"));
        assert!(label.contains("Google"));
        assert!(label.starts_with("Installed"));
    }

    #[test]
    fn parse_google_usb_driver_absent() {
        let output = "Published Name: oem1.inf\nOriginal Name: net.inf\nProvider Name: Microsoft\n";
        assert!(parse_google_usb_driver(output).is_none());
    }
}
