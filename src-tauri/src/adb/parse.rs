//! Pure parsers for the device-shell output that feeds [`super::telemetry`].
//!
//! Everything here is total: unparseable or missing input yields `None` / a zeroed
//! struct, never an error. One absent property must never fail the whole snapshot.

use super::telemetry::{BatteryInfo, MemoryInfo, NetworkInfo, StorageVolume};
use std::collections::HashMap;

/// Partition prefixes Android uses for the duplicated `ro.product.*` namespace.
/// Modern builds leave the bare key empty and populate the per-partition copies.
const PRODUCT_PARTITIONS: &[&str] = &["", "system.", "vendor.", "odm.", "product.", "system_ext."];

/// `getprop` prints one `[key]: [value]` per line.
pub(super) fn parse_getprop(output: &str) -> HashMap<String, String> {
    let mut props = HashMap::new();
    for line in output.lines() {
        let Some(rest) = line.trim().strip_prefix('[') else {
            continue;
        };
        let Some((key, value)) = rest.split_once("]: [") else {
            continue;
        };
        let Some(value) = value.strip_suffix(']') else {
            continue;
        };
        if !value.trim().is_empty() {
            props.insert(key.to_string(), value.trim().to_string());
        }
    }
    props
}

/// First non-empty value among `keys`, in order.
pub(super) fn first_prop(props: &HashMap<String, String>, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| props.get(*key).cloned())
}

/// `ro.product.<suffix>`, falling back to each per-partition copy.
pub(super) fn product_prop(props: &HashMap<String, String>, suffix: &str) -> Option<String> {
    PRODUCT_PARTITIONS
        .iter()
        .find_map(|partition| props.get(&format!("ro.product.{partition}{suffix}")).cloned())
}

fn battery_status_label(code: i64) -> Option<String> {
    Some(
        match code {
            2 => "Charging",
            3 => "Discharging",
            4 => "Not charging",
            5 => "Full",
            _ => return None,
        }
        .to_string(),
    )
}

fn battery_health_label(code: i64) -> Option<String> {
    Some(
        match code {
            2 => "Good",
            3 => "Overheat",
            4 => "Dead",
            5 => "Over voltage",
            6 => "Unspecified failure",
            7 => "Cold",
            _ => return None,
        }
        .to_string(),
    )
}

/// `dumpsys battery` prints indented `key: value` pairs under a header line.
pub(super) fn parse_battery(output: &str) -> BatteryInfo {
    let mut fields: HashMap<String, String> = HashMap::new();
    for line in output.lines() {
        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim().to_ascii_lowercase();
            let value = value.trim();
            if !key.is_empty() && !value.is_empty() {
                fields.insert(key, value.to_string());
            }
        }
    }

    let number = |key: &str| fields.get(key).and_then(|value| value.parse::<i64>().ok());
    let flag = |key: &str| fields.get(key).map(|value| value.eq_ignore_ascii_case("true"));

    let scale = number("scale").filter(|scale| *scale > 0).unwrap_or(100);
    let level_pct = number("level")
        .filter(|level| *level >= 0)
        .map(|level| (level * 100 / scale).clamp(0, 100) as u8);

    let status_code = number("status");
    let is_charging = status_code == Some(2)
        || flag("ac powered").unwrap_or(false)
        || flag("usb powered").unwrap_or(false)
        || flag("wireless powered").unwrap_or(false)
        || flag("dock powered").unwrap_or(false);

    // Most devices report tenths of a degree; a few already report whole degrees.
    let temperature_c = number("temperature").map(|raw| raw as f32 / 10.0);
    // Some vendors report microvolts instead of millivolts.
    let voltage_mv = number("voltage")
        .filter(|voltage| *voltage > 0)
        .map(|voltage| if voltage > 100_000 { voltage / 1000 } else { voltage } as u32);

    BatteryInfo {
        level_pct,
        status: status_code.and_then(battery_status_label),
        health: number("health").and_then(battery_health_label),
        temperature_c,
        voltage_mv,
        is_charging,
    }
}

/// `/proc/meminfo` reports kibibytes: `MemTotal:  7654321 kB`.
pub(super) fn parse_meminfo(output: &str) -> MemoryInfo {
    let kib = |name: &str| -> Option<u64> {
        output
            .lines()
            .find(|line| line.trim_start().starts_with(name))
            .and_then(|line| line.split_whitespace().nth(1)?.parse::<u64>().ok())
    };

    let total_bytes = kib("MemTotal:").unwrap_or(0).saturating_mul(1024);
    let available_bytes =
        kib("MemAvailable:").or_else(|| kib("MemFree:")).unwrap_or(0).saturating_mul(1024);

    MemoryInfo {
        total_bytes,
        available_bytes,
        used_bytes: total_bytes.saturating_sub(available_bytes),
    }
}

/// Mount-point prefixes that are never user-facing storage, even when `df` reports a
/// plausible size for them: APEX bind mounts, system/vendor/product images, and
/// pseudo-filesystems. Checked against the path *we* asked `df` about (see
/// [`parse_df`]) — `df`'s own "Mounted on" column is not trustworthy enough to gate
/// on; it is exactly what goes wrong on some devices.
const NON_USER_STORAGE_PREFIXES: &[&str] =
    &["/apex", "/system", "/vendor", "/product", "/metadata", "/dev", "/proc", "/sys"];

/// Whether `path` starts with `prefix` as a full path segment: `/system` matches
/// `/system` and `/system/app`, but not `/systemx`.
fn has_path_prefix(path: &str, prefix: &str) -> bool {
    path == prefix || path.strip_prefix(prefix).is_some_and(|rest| rest.starts_with('/'))
}

/// Whether `path` is a plausible user-storage mount, not a system/pseudo path.
fn is_user_storage_path(path: &str) -> bool {
    path.starts_with('/')
        && !NON_USER_STORAGE_PREFIXES.iter().any(|prefix| has_path_prefix(path, prefix))
}

/// One parsed `df -k <path>` data row: `<filesystem> <1K-blocks> <used> <available> <use%> <mount>`.
struct DfRow {
    /// The `Filesystem` column, e.g. `/dev/block/dm-5` or `/dev/fuse` — identifies the
    /// real backing device, unlike the mount column.
    filesystem: String,
    total_kib: u64,
    used_kib: u64,
    free_kib: u64,
    /// `df`'s own "Mounted on" column. Not authoritative — see [`parse_df`].
    raw_mount: String,
}

/// The first line that parses as a numeric `df -k` data row: skips the header and any
/// blank/warning lines toybox prints before it. A single-path query should only ever
/// produce one such row.
fn parse_df_row(output: &str) -> Option<DfRow> {
    output.lines().find_map(|line| {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() < 6 {
            return None;
        }
        let total_kib = fields[1].parse::<u64>().ok()?;
        let used_kib = fields[2].parse::<u64>().ok()?;
        let free_kib = fields[3].parse::<u64>().ok()?;
        let raw_mount = *fields.last()?;
        if !raw_mount.starts_with('/') {
            return None;
        }
        Some(DfRow {
            filesystem: fields[0].to_string(),
            total_kib,
            used_kib,
            free_kib,
            raw_mount: raw_mount.to_string(),
        })
    })
}

/// Resolve per-path `df -k <path>` results into user-facing storage volumes.
///
/// `queries` pairs each candidate path with that single `df -k <path>` command's
/// stdout (`None` when the command failed or printed nothing — see
/// [`CmdOutput::ok_stdout`](super::CmdOutput::ok_stdout)). Every row is labelled by the
/// path **telemetry asked `df` about** (`requested_path`), never by `df`'s own
/// "Mounted on" column: on a real Pixel 7a (Android 16), that column resolved to
/// `/apex/com.android.art/bin/dex2oat64` — an APEX bind mount of a single binary —
/// instead of the queried path, which would otherwise render as a nonsense "storage
/// volume". The raw column is kept on the returned volume for developers, but never
/// used to identify it.
///
/// Filtering and deduplication, in order:
/// - `requested_path` must be a plausible user-storage path ([`is_user_storage_path`]).
/// - Rows with fewer than six whitespace fields, unparseable numeric columns, a zero
///   total, or a `tmpfs` filesystem are skipped rather than guessed at.
/// - Two rows are the same physical storage — and only the first is kept — when they
///   report the same `Filesystem` column *and* the same total size. `/storage/emulated`
///   and `/sdcard` are commonly just views over the same backing partition as `/data`.
///   Matching on `Filesystem` alone would be too broad: `/dev/fuse` legitimately backs
///   several distinct emulated volumes, so both device *and* size must agree.
pub(super) fn parse_df(queries: &[(&str, Option<&str>)]) -> Vec<StorageVolume> {
    let mut candidates: Vec<(&str, DfRow)> = Vec::new();

    for (requested_path, output) in queries.iter().copied() {
        if !is_user_storage_path(requested_path) {
            continue;
        }
        let Some(output) = output else { continue };
        let Some(row) = parse_df_row(output) else { continue };
        if row.total_kib == 0 || row.filesystem == "tmpfs" {
            continue;
        }
        let is_duplicate = candidates
            .iter()
            .any(|(_, seen)| seen.filesystem == row.filesystem && seen.total_kib == row.total_kib);
        if is_duplicate {
            continue;
        }
        candidates.push((requested_path, row));
    }

    candidates
        .into_iter()
        .map(|(requested_path, row)| StorageVolume {
            mount: requested_path.to_string(),
            raw_mount: row.raw_mount,
            total_bytes: row.total_kib.saturating_mul(1024),
            used_bytes: row.used_kib.saturating_mul(1024),
            free_bytes: row.free_kib.saturating_mul(1024),
        })
        .collect()
}

/// `ip addr show wlan0` — pull the IPv4 address and hardware address.
pub(super) fn parse_ip_addr(output: &str) -> NetworkInfo {
    let mut ip_address = None;
    let mut mac_address = None;

    for line in output.lines() {
        let mut fields = line.split_whitespace();
        while let Some(field) = fields.next() {
            match field {
                "inet" if ip_address.is_none() => {
                    ip_address = fields
                        .next()
                        .map(|value| value.split('/').next().unwrap_or(value).to_string());
                }
                "link/ether" if mac_address.is_none() => {
                    mac_address = fields
                        .next()
                        .filter(|mac| *mac != "00:00:00:00:00:00")
                        .map(std::string::ToString::to_string);
                }
                _ => {}
            }
        }
    }

    NetworkInfo { ip_address, wifi_ssid: None, mac_address }
}

/// `/proc/uptime` — `<uptime seconds> <idle seconds>`.
pub(super) fn parse_uptime_seconds(output: &str) -> Option<u64> {
    let seconds = output.split_whitespace().next()?.parse::<f64>().ok()?;
    (seconds.is_finite() && seconds >= 0.0).then_some(seconds as u64)
}

/// `getenforce` — `Enforcing` / `Permissive` / `Disabled`.
pub(super) fn parse_selinux_enforcing(output: &str) -> Option<bool> {
    match output.trim().to_ascii_lowercase().as_str() {
        "enforcing" => Some(true),
        "permissive" | "disabled" => Some(false),
        _ => None,
    }
}

const SSID_PLACEHOLDERS: &[&str] = &["unknown ssid", "null", "none"];

/// `cmd wifi status` / `dumpsys wifi` — extract the connected SSID.
///
/// Android redacts the SSID without location permission and reports `<unknown ssid>`.
/// Angle-bracket values are Android's "not available" convention, so any of them —
/// `<unknown ssid>`, `<none>`, `<unknown>` — is treated as absent, not as a name.
pub(super) fn parse_wifi_ssid(output: &str) -> Option<String> {
    for line in output.lines() {
        let Some((_, rest)) = line.split_once("SSID:").or_else(|| line.split_once("connected to"))
        else {
            continue;
        };
        let rest = rest.trim();

        // Unquoted values run to the next comma — a bare `<unknown ssid>` contains a
        // space, so splitting on whitespace here would leave a truncated `<unknown`.
        let ssid = if let Some(quoted) = rest.strip_prefix('"') {
            quoted.split('"').next().unwrap_or_default()
        } else {
            rest.split(',').next().unwrap_or_default()
        }
        .trim();

        let is_placeholder = ssid.starts_with('<')
            || SSID_PLACEHOLDERS.contains(&ssid.to_ascii_lowercase().as_str());
        if !ssid.is_empty() && !is_placeholder {
            return Some(ssid.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_getprop_reads_bracketed_pairs_and_drops_empties() {
        let props = parse_getprop(
            "[ro.product.model]: [Pixel 7]\n[ro.build.id]: [UQ1A.240205.004]\n[ro.empty]: []\ngarbage\n",
        );

        assert_eq!(props.get("ro.product.model").map(String::as_str), Some("Pixel 7"));
        assert_eq!(props.get("ro.build.id").map(String::as_str), Some("UQ1A.240205.004"));
        assert!(!props.contains_key("ro.empty"));
    }

    #[test]
    fn product_prop_falls_back_to_partition_copies() {
        let props = parse_getprop("[ro.product.system.model]: [Pixel 7]\n");

        assert_eq!(product_prop(&props, "model").as_deref(), Some("Pixel 7"));
        assert_eq!(product_prop(&props, "brand"), None);
    }

    #[test]
    fn first_prop_returns_the_first_present_key() {
        let props = parse_getprop("[ro.boot.serialno]: [1A2B3C4D]\n");

        assert_eq!(
            first_prop(&props, &["ro.serialno", "ro.boot.serialno"]).as_deref(),
            Some("1A2B3C4D")
        );
        assert_eq!(first_prop(&props, &["ro.missing"]), None);
    }

    #[test]
    fn parse_battery_reads_numbers_not_display_strings() {
        let battery = parse_battery(
            "Current Battery Service state:\n  AC powered: false\n  USB powered: true\n  status: 2\n  health: 2\n  level: 87\n  scale: 100\n  voltage: 4102\n  temperature: 324\n",
        );

        assert_eq!(battery.level_pct, Some(87));
        assert_eq!(battery.status.as_deref(), Some("Charging"));
        assert_eq!(battery.health.as_deref(), Some("Good"));
        assert_eq!(battery.temperature_c, Some(32.4));
        assert_eq!(battery.voltage_mv, Some(4102));
        assert!(battery.is_charging);
    }

    #[test]
    fn parse_battery_normalizes_scale_and_microvolts() {
        let battery = parse_battery("level: 128\nscale: 255\nvoltage: 4102000\nstatus: 3\n");

        assert_eq!(battery.level_pct, Some(50));
        assert_eq!(battery.voltage_mv, Some(4102));
        assert_eq!(battery.status.as_deref(), Some("Discharging"));
        assert!(!battery.is_charging);
    }

    #[test]
    fn parse_battery_tolerates_missing_fields() {
        let battery = parse_battery("");

        assert_eq!(battery.level_pct, None);
        assert_eq!(battery.status, None);
        assert_eq!(battery.temperature_c, None);
        assert!(!battery.is_charging);
    }

    #[test]
    fn parse_meminfo_converts_kib_to_bytes() {
        let memory = parse_meminfo("MemTotal:        8000000 kB\nMemAvailable:    2000000 kB\n");

        assert_eq!(memory.total_bytes, 8_000_000 * 1024);
        assert_eq!(memory.available_bytes, 2_000_000 * 1024);
        assert_eq!(memory.used_bytes, 6_000_000 * 1024);
    }

    #[test]
    fn parse_meminfo_falls_back_to_memfree_and_zeroes_when_absent() {
        let memory = parse_meminfo("MemTotal: 1000 kB\nMemFree: 400 kB\n");
        assert_eq!(memory.available_bytes, 400 * 1024);

        let empty = parse_meminfo("nothing here");
        assert_eq!(empty.total_bytes, 0);
        assert_eq!(empty.used_bytes, 0);
    }

    #[test]
    fn parse_df_reads_numeric_columns_and_skips_headers() {
        let volumes = parse_df(&[
            (
                "/data",
                Some(
                    "Filesystem     1K-blocks    Used Available Use% Mounted on\n/dev/block/dm-5 110000000 47000000 62000000 44% /data",
                ),
            ),
            (
                "/storage/emulated",
                Some(
                    "Filesystem 1K-blocks    Used Available Use% Mounted on\n/dev/fuse   58000000 20000000 38000000 35% /storage/emulated",
                ),
            ),
        ]);

        assert_eq!(volumes.len(), 2);
        assert_eq!(volumes[0].mount, "/data");
        assert_eq!(volumes[0].raw_mount, "/data");
        assert_eq!(volumes[0].total_bytes, 110_000_000 * 1024);
        assert_eq!(volumes[0].used_bytes, 47_000_000 * 1024);
        assert_eq!(volumes[0].free_bytes, 62_000_000 * 1024);
        assert_eq!(volumes[1].mount, "/storage/emulated");
    }

    /// Real Pixel 7a (Android 16) capture: `df -k /data` resolved its own "Mounted on"
    /// column to an APEX bind mount, not `/data`. The row must surface labelled by the
    /// path telemetry actually asked for, using the (correct) numbers `df` reported —
    /// not vanish, and not render the APEX path as a "storage volume".
    #[test]
    fn parse_df_labels_rows_by_the_requested_path_not_dfs_own_mount_column() {
        let volumes = parse_df(&[
            (
                "/data",
                Some(
                    "Filesystem      1K-blocks    Used Available Use% Mounted on\n/dev/block/dm-5 115294552 44275712 70889216 39% /apex/com.android.art/bin/dex2oat64",
                ),
            ),
            (
                "/storage/emulated",
                Some(
                    "Filesystem 1K-blocks   Used     Available Use% Mounted on\n/dev/fuse  58720256   20000000 38720256  35%  /storage/emulated",
                ),
            ),
        ]);

        assert_eq!(volumes.len(), 2);
        assert_eq!(volumes[0].mount, "/data");
        assert_eq!(volumes[0].raw_mount, "/apex/com.android.art/bin/dex2oat64");
        assert_eq!(volumes[0].total_bytes, 115_294_552 * 1024);
        assert_eq!(volumes[1].mount, "/storage/emulated");
        assert_eq!(volumes[1].raw_mount, "/storage/emulated");
    }

    /// `/storage/emulated` and `/sdcard` are commonly bind-mounted onto the very same
    /// backing partition as `/data` — same `Filesystem`, same size. Listing that
    /// partition three times would make a 110 GB disk look like 330 GB.
    #[test]
    fn parse_df_deduplicates_same_filesystem_and_size_keeping_the_first() {
        let volumes = parse_df(&[
            (
                "/data",
                Some(
                    "Filesystem      1K-blocks Used     Available Use% Mounted on\n/dev/block/dm-5 115294552 44275712 70889216 39%   /data",
                ),
            ),
            (
                "/storage/emulated",
                Some(
                    "Filesystem      1K-blocks Used     Available Use% Mounted on\n/dev/block/dm-5 115294552 44275712 70889216 39%   /storage/emulated",
                ),
            ),
            (
                "/sdcard",
                Some(
                    "Filesystem      1K-blocks Used     Available Use% Mounted on\n/dev/block/dm-5 115294552 44275712 70889216 39%   /storage/emulated/0",
                ),
            ),
        ]);

        assert_eq!(volumes.len(), 1);
        assert_eq!(volumes[0].mount, "/data");
    }

    /// `/dev/fuse` is not a unique identity by itself — several distinct emulated
    /// volumes can report it — so the dedup rule must also require matching size.
    #[test]
    fn parse_df_keeps_distinct_fuse_volumes_with_different_sizes() {
        let volumes = parse_df(&[
            (
                "/storage/emulated",
                Some(
                    "Filesystem 1K-blocks Used     Available Use% Mounted on\n/dev/fuse  58720256  20000000 38720256  35%  /storage/emulated",
                ),
            ),
            (
                "/sdcard",
                Some(
                    "Filesystem 1K-blocks  Used      Available Use% Mounted on\n/dev/fuse  500000000 100000000 400000000 20%  /storage/1234-5678",
                ),
            ),
        ]);

        assert_eq!(volumes.len(), 2);
    }

    #[test]
    fn parse_df_skips_missing_output_and_unparseable_lines() {
        let volumes = parse_df(&[
            ("/data", None),
            ("/storage/emulated", Some("")),
            ("/sdcard", Some("df: /sdcard: No such file or directory\ntmpfs abc def ghi 0% /tmp")),
        ]);

        assert!(volumes.is_empty());
    }

    #[test]
    fn parse_df_skips_zero_size_rows() {
        let volumes = parse_df(&[(
            "/data",
            Some(
                "Filesystem 1K-blocks Used Available Use% Mounted on\n/dev/block/dm-5 0 0 0 0% /data",
            ),
        )]);

        assert!(volumes.is_empty());
    }

    #[test]
    fn parse_df_rejects_tmpfs_filesystem_even_with_a_plausible_path() {
        let volumes = parse_df(&[(
            "/data",
            Some(
                "Filesystem 1K-blocks Used    Available Use% Mounted on\ntmpfs      2000000   1000000 1000000   50%  /data",
            ),
        )]);

        assert!(volumes.is_empty());
    }

    /// Defensive: even if the candidate path list ever grew to include a system or
    /// pseudo-filesystem path, none of it may surface as a "storage volume".
    #[test]
    fn parse_df_rejects_system_and_pseudo_paths_leaving_nothing() {
        let volumes = parse_df(&[
            (
                "/system",
                Some(
                    "Filesystem      1K-blocks Used    Available Use% Mounted on\n/dev/block/dm-1 2000000   1000000 1000000   50%  /system",
                ),
            ),
            (
                "/apex/com.android.art",
                Some(
                    "Filesystem       1K-blocks Used  Available Use% Mounted on\n/dev/block/loop3 40000     20000 20000     50%  /apex/com.android.art",
                ),
            ),
            (
                "/proc",
                Some(
                    "Filesystem 1K-blocks Used Available Use% Mounted on\nproc       0         0    0         0%   /proc",
                ),
            ),
        ]);

        assert!(volumes.is_empty());
    }

    #[test]
    fn parse_ip_addr_reads_ipv4_and_mac() {
        let network = parse_ip_addr(
            "23: wlan0: <BROADCAST,UP> mtu 1500\n    link/ether aa:bb:cc:dd:ee:ff brd ff:ff:ff:ff:ff:ff\n    inet 192.168.1.14/24 brd 192.168.1.255 scope global wlan0\n    inet6 fe80::1/64 scope link\n",
        );

        assert_eq!(network.ip_address.as_deref(), Some("192.168.1.14"));
        assert_eq!(network.mac_address.as_deref(), Some("aa:bb:cc:dd:ee:ff"));
    }

    #[test]
    fn parse_ip_addr_returns_none_when_interface_is_down() {
        let network = parse_ip_addr("");

        assert_eq!(network.ip_address, None);
        assert_eq!(network.mac_address, None);
    }

    #[test]
    fn parse_uptime_seconds_reads_the_first_column() {
        assert_eq!(parse_uptime_seconds("12345.67 98765.43"), Some(12_345));
        assert_eq!(parse_uptime_seconds(""), None);
        assert_eq!(parse_uptime_seconds("not-a-number"), None);
    }

    #[test]
    fn parse_selinux_enforcing_maps_all_three_modes() {
        assert_eq!(parse_selinux_enforcing("Enforcing\n"), Some(true));
        assert_eq!(parse_selinux_enforcing("Permissive"), Some(false));
        assert_eq!(parse_selinux_enforcing("Disabled"), Some(false));
        assert_eq!(parse_selinux_enforcing("su: not found"), None);
    }

    #[test]
    fn parse_wifi_ssid_handles_quoted_and_redacted_values() {
        assert_eq!(parse_wifi_ssid("Wifi is connected to \"Home 5G\"").as_deref(), Some("Home 5G"));
        assert_eq!(parse_wifi_ssid("SSID: \"Home 5G\", BSSID: 00:11").as_deref(), Some("Home 5G"));
        assert_eq!(parse_wifi_ssid("SSID: <unknown ssid>"), None);
        assert_eq!(parse_wifi_ssid("mWifiInfo SSID: <unknown ssid>, BSSID: 02:00"), None);
        assert_eq!(parse_wifi_ssid("SSID: <none>"), None);
        assert_eq!(parse_wifi_ssid("SSID: Cafe Wifi, BSSID: 02:00").as_deref(), Some("Cafe Wifi"));
        assert_eq!(parse_wifi_ssid(""), None);
    }
}
