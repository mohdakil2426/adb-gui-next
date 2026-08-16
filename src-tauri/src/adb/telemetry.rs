//! Structured device telemetry: **numbers, not display strings**.
//!
//! The legacy `DeviceInfo` returned pre-formatted text (`"87%"`, `"12G used of 64G"`,
//! `"5.6 GB"`) over twelve sequential `adb` spawns. Nothing downstream could chart it and
//! every read cost 0.4–1.8 s. [`collect`] gathers the same data — plus security, network,
//! and uptime — as typed numbers in **one** `adb shell` round-trip.
//!
//! Formatting is a frontend concern. Every field is optional or zero-defaulted: a device
//! that lacks one property still returns a complete snapshot.

use super::{AdbClient, CmdOutput, parse};
use crate::CmdResult;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceIdentity {
    pub brand: Option<String>,
    pub model: Option<String>,
    pub codename: Option<String>,
    pub device_name: Option<String>,
    pub serial: Option<String>,
    pub android_version: Option<String>,
    pub sdk_int: Option<u32>,
    pub build_id: Option<String>,
    pub arch: Option<String>,
    pub manufacturer: Option<String>,
    pub hardware: Option<String>,
    pub fingerprint: Option<String>,
    pub incremental: Option<String>,
    pub locale: Option<String>,
    pub timezone: Option<String>,
    pub radio: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryInfo {
    pub level_pct: Option<u8>,
    pub status: Option<String>,
    pub health: Option<String>,
    pub temperature_c: Option<f32>,
    pub voltage_mv: Option<u32>,
    pub is_charging: bool,
}

/// Zero `total_bytes` means the device did not report memory at all.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInfo {
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub used_bytes: u64,
}

/// One user-facing storage volume, resolved from a single `df -k <path>` query.
///
/// `mount` is the path telemetry asked `df` about — authoritative. `raw_mount` is
/// `df`'s own "Mounted on" text for that same query, kept for developers; it can
/// differ from `mount` (e.g. a resolved symlink) or even be implausible on some
/// builds (observed: an APEX bind-mount path on a real device), so it is never used
/// to identify the volume. See `parse::parse_df`.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageVolume {
    pub mount: String,
    pub raw_mount: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityInfo {
    pub rooted: bool,
    pub bootloader_unlocked: Option<bool>,
    pub verified_boot_state: Option<String>,
    pub encryption_state: Option<String>,
    pub selinux_enforcing: Option<bool>,
    pub security_patch: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInfo {
    pub ip_address: Option<String>,
    pub wifi_ssid: Option<String>,
    pub mac_address: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceTelemetry {
    pub identity: DeviceIdentity,
    pub battery: BatteryInfo,
    pub memory: MemoryInfo,
    pub storage: Vec<StorageVolume>,
    pub security: SecurityInfo,
    pub network: NetworkInfo,
    /// Seconds since boot; `0` when `/proc/uptime` was unreadable.
    pub uptime_seconds: u64,
}

/// Batch slots. Order is load-bearing — it indexes the [`AdbClient::shell_batch`] result.
const CMD_GETPROP: usize = 0;
const CMD_BATTERY: usize = 1;
const CMD_MEMINFO: usize = 2;
const CMD_DF_DATA: usize = 3;
const CMD_DF_STORAGE_EMULATED: usize = 4;
const CMD_DF_SDCARD: usize = 5;
const CMD_IP_ADDR: usize = 6;
const CMD_UPTIME: usize = 7;
const CMD_ROOT: usize = 8;
const CMD_SELINUX: usize = 9;
const CMD_WIFI: usize = 10;

/// One `adb shell` process covers every source below.
///
/// `getprop` with no argument dumps the whole property table, so all nine identity and
/// security properties come from a single command instead of nine spawns. Storage is
/// three independent `df -k <path>` calls rather than one call with three path
/// arguments, so each result can be labelled by the exact path requested instead of
/// trusting `df`'s own (occasionally wrong) "Mounted on" column — see
/// `parse::parse_df`.
const TELEMETRY_COMMANDS: &[&str] = &[
    "getprop",
    "dumpsys battery 2>/dev/null",
    "cat /proc/meminfo 2>/dev/null",
    // `|| true`: a missing path (no /sdcard on some emulators) must not cost us this
    // command's marker/exit-code bookkeeping in the batch.
    "df -k /data 2>/dev/null || true",
    "df -k /storage/emulated 2>/dev/null || true",
    "df -k /sdcard 2>/dev/null || true",
    "ip addr show wlan0 2>/dev/null",
    "cat /proc/uptime 2>/dev/null",
    "su -c id -u 2>/dev/null",
    "getenforce 2>/dev/null",
    "cmd wifi status 2>/dev/null || dumpsys wifi 2>/dev/null | grep -m 1 'SSID:'",
];

fn slot(outputs: &[CmdOutput], index: usize) -> Option<&str> {
    outputs.get(index).and_then(CmdOutput::ok_stdout)
}

/// Collect a full telemetry snapshot in one round-trip.
///
/// `fallback_serial` is the serial the caller selected; it is used when the device does
/// not expose `ro.serialno` (common on emulators).
pub fn collect(client: &AdbClient, fallback_serial: Option<&str>) -> CmdResult<DeviceTelemetry> {
    let outputs = client.shell_batch(TELEMETRY_COMMANDS)?;
    let props = parse::parse_getprop(slot(&outputs, CMD_GETPROP).unwrap_or_default());

    let mut network = parse::parse_ip_addr(slot(&outputs, CMD_IP_ADDR).unwrap_or_default());
    network.wifi_ssid = slot(&outputs, CMD_WIFI).and_then(parse::parse_wifi_ssid);

    // Each candidate path was queried independently (see `TELEMETRY_COMMANDS`), so the
    // path here is what telemetry actually asked `df` about, not `df`'s own report.
    let storage_queries = [
        ("/data", slot(&outputs, CMD_DF_DATA)),
        ("/storage/emulated", slot(&outputs, CMD_DF_STORAGE_EMULATED)),
        ("/sdcard", slot(&outputs, CMD_DF_SDCARD)),
    ];

    Ok(DeviceTelemetry {
        identity: build_identity(&props, fallback_serial),
        battery: parse::parse_battery(slot(&outputs, CMD_BATTERY).unwrap_or_default()),
        memory: parse::parse_meminfo(slot(&outputs, CMD_MEMINFO).unwrap_or_default()),
        storage: parse::parse_df(&storage_queries),
        security: build_security(&props, &outputs),
        network,
        uptime_seconds: slot(&outputs, CMD_UPTIME)
            .and_then(parse::parse_uptime_seconds)
            .unwrap_or(0),
    })
}

fn build_identity(
    props: &HashMap<String, String>,
    fallback_serial: Option<&str>,
) -> DeviceIdentity {
    DeviceIdentity {
        brand: parse::product_prop(props, "brand"),
        model: parse::product_prop(props, "model"),
        codename: parse::product_prop(props, "device"),
        device_name: parse::product_prop(props, "name"),
        serial: parse::first_prop(props, &["ro.serialno", "ro.boot.serialno"])
            .or_else(|| fallback_serial.map(str::to_string)),
        android_version: parse::first_prop(props, &["ro.build.version.release"]),
        sdk_int: parse::first_prop(props, &["ro.build.version.sdk"])
            .and_then(|sdk| sdk.parse::<u32>().ok()),
        build_id: parse::first_prop(props, &["ro.build.id", "ro.build.display.id"]),
        arch: parse::first_prop(props, &["ro.product.cpu.abi", "ro.product.cpu.abilist"]),
        manufacturer: parse::product_prop(props, "manufacturer"),
        hardware: parse::first_prop(props, &["ro.hardware", "ro.boot.hardware"]),
        fingerprint: parse::first_prop(props, &["ro.build.fingerprint"]),
        incremental: parse::first_prop(props, &["ro.build.version.incremental"]),
        locale: parse::first_prop(props, &["ro.product.locale", "persist.sys.locale"]),
        timezone: parse::first_prop(props, &["persist.sys.timezone"]),
        radio: parse::first_prop(props, &["gsm.version.baseband", "ro.baseband"]),
    }
}

/// `ro.boot.flash.locked` is authoritative (`1` = locked). `ro.boot.vbmeta.device_state`
/// and the AVB colour state are fallbacks for devices that omit it.
fn bootloader_unlocked(props: &HashMap<String, String>) -> Option<bool> {
    if let Some(locked) = props.get("ro.boot.flash.locked") {
        return match locked.as_str() {
            "1" => Some(false),
            "0" => Some(true),
            _ => None,
        };
    }
    if let Some(state) = props.get("ro.boot.vbmeta.device_state") {
        return match state.to_ascii_lowercase().as_str() {
            "locked" => Some(false),
            "unlocked" => Some(true),
            _ => None,
        };
    }
    match props.get("ro.boot.verifiedbootstate")?.to_ascii_lowercase().as_str() {
        "green" => Some(false),
        "orange" | "yellow" | "red" => Some(true),
        _ => None,
    }
}

fn build_security(props: &HashMap<String, String>, outputs: &[CmdOutput]) -> SecurityInfo {
    SecurityInfo {
        rooted: slot(outputs, CMD_ROOT).is_some_and(|uid| uid.trim() == "0"),
        bootloader_unlocked: bootloader_unlocked(props),
        verified_boot_state: parse::first_prop(props, &["ro.boot.verifiedbootstate"]),
        encryption_state: parse::first_prop(props, &["ro.crypto.state", "ro.crypto.type"]),
        selinux_enforcing: slot(outputs, CMD_SELINUX).and_then(parse::parse_selinux_enforcing),
        security_patch: parse::first_prop(props, &["ro.build.version.security_patch"]),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn output(command: &str, exit_code: Option<i32>, stdout: &str) -> CmdOutput {
        CmdOutput { command: command.to_string(), exit_code, stdout: stdout.to_string() }
    }

    #[test]
    fn telemetry_commands_indices_match_their_slots() {
        assert_eq!(TELEMETRY_COMMANDS.len(), CMD_WIFI + 1);
        assert_eq!(TELEMETRY_COMMANDS[CMD_GETPROP], "getprop");
        assert!(TELEMETRY_COMMANDS[CMD_BATTERY].starts_with("dumpsys battery"));
        assert!(TELEMETRY_COMMANDS[CMD_ROOT].starts_with("su -c id -u"));
        assert!(TELEMETRY_COMMANDS[CMD_SELINUX].starts_with("getenforce"));
        // Storage is three independently-labelled df calls, not one multi-path call —
        // each must still tolerate its own path being missing.
        assert!(TELEMETRY_COMMANDS[CMD_DF_DATA].starts_with("df -k /data "));
        assert!(TELEMETRY_COMMANDS[CMD_DF_DATA].ends_with("|| true"));
        assert!(
            TELEMETRY_COMMANDS[CMD_DF_STORAGE_EMULATED].starts_with("df -k /storage/emulated ")
        );
        assert!(TELEMETRY_COMMANDS[CMD_DF_STORAGE_EMULATED].ends_with("|| true"));
        assert!(TELEMETRY_COMMANDS[CMD_DF_SDCARD].starts_with("df -k /sdcard "));
        assert!(TELEMETRY_COMMANDS[CMD_DF_SDCARD].ends_with("|| true"));
    }

    #[test]
    fn build_identity_prefers_device_serial_then_falls_back() {
        let props = parse::parse_getprop("[ro.serialno]: [1A2B3C4D]\n");
        assert_eq!(
            build_identity(&props, Some("emulator-5554")).serial.as_deref(),
            Some("1A2B3C4D")
        );

        let empty = parse::parse_getprop("");
        assert_eq!(
            build_identity(&empty, Some("emulator-5554")).serial.as_deref(),
            Some("emulator-5554")
        );
        assert_eq!(build_identity(&empty, None).serial, None);
    }

    #[test]
    fn build_identity_parses_sdk_as_a_number() {
        let props = parse::parse_getprop(
            "[ro.build.version.sdk]: [34]\n[ro.build.version.release]: [15]\n[ro.product.cpu.abi]: [arm64-v8a]\n",
        );
        let identity = build_identity(&props, None);

        assert_eq!(identity.sdk_int, Some(34));
        assert_eq!(identity.android_version.as_deref(), Some("15"));
        assert_eq!(identity.arch.as_deref(), Some("arm64-v8a"));
    }

    #[test]
    fn bootloader_unlocked_prefers_flash_locked_then_vbmeta_then_colour() {
        assert_eq!(
            bootloader_unlocked(&parse::parse_getprop("[ro.boot.flash.locked]: [1]\n")),
            Some(false)
        );
        assert_eq!(
            bootloader_unlocked(&parse::parse_getprop("[ro.boot.flash.locked]: [0]\n")),
            Some(true)
        );
        assert_eq!(
            bootloader_unlocked(&parse::parse_getprop(
                "[ro.boot.vbmeta.device_state]: [unlocked]\n"
            )),
            Some(true)
        );
        assert_eq!(
            bootloader_unlocked(&parse::parse_getprop("[ro.boot.verifiedbootstate]: [green]\n")),
            Some(false)
        );
        assert_eq!(bootloader_unlocked(&parse::parse_getprop("")), None);
    }

    #[test]
    fn build_security_reads_root_and_selinux_from_their_batch_slots() {
        let props = parse::parse_getprop("[ro.build.version.security_patch]: [2026-06-05]\n");
        let mut outputs: Vec<CmdOutput> =
            TELEMETRY_COMMANDS.iter().map(|cmd| output(cmd, Some(1), "")).collect();
        outputs[CMD_ROOT] = output("su", Some(0), "0");
        outputs[CMD_SELINUX] = output("getenforce", Some(0), "Enforcing");

        let security = build_security(&props, &outputs);

        assert!(security.rooted);
        assert_eq!(security.selinux_enforcing, Some(true));
        assert_eq!(security.security_patch.as_deref(), Some("2026-06-05"));
    }

    #[test]
    fn build_security_reports_not_rooted_when_su_is_missing() {
        let outputs: Vec<CmdOutput> =
            TELEMETRY_COMMANDS.iter().map(|cmd| output(cmd, Some(127), "su: not found")).collect();

        let security = build_security(&parse::parse_getprop(""), &outputs);

        assert!(!security.rooted);
        assert_eq!(security.selinux_enforcing, None);
        assert_eq!(security.bootloader_unlocked, None);
    }

    #[test]
    fn slot_ignores_failed_and_unreached_commands() {
        let outputs =
            vec![output("a", Some(0), "value"), output("b", Some(1), "err"), output("c", None, "")];

        assert_eq!(slot(&outputs, 0), Some("value"));
        assert_eq!(slot(&outputs, 1), None);
        assert_eq!(slot(&outputs, 2), None);
        assert_eq!(slot(&outputs, 99), None);
    }
}
