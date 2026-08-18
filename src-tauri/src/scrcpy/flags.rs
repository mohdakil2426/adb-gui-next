use crate::CmdResult;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
const CODECS: &[&str] = &["h264", "h265", "av1", "vp8", "vp9"];
const KEYBOARDS: &[&str] = &["sdk", "uhid", "aoa", "disabled"];
const AUDIO_SOURCES: &[&str] = &[
    "output",
    "playback",
    "mic",
    "mic-unprocessed",
    "mic-camcorder",
    "mic-voice-recognition",
    "mic-voice-communication",
    "voice-call",
    "voice-call-uplink",
    "voice-call-downlink",
    "voice-performance",
];
const RECORD_FORMATS: &[&str] = &["mp4", "mkv", "m4a", "mka", "opus", "aac", "flac", "wav"];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrcpyPresetOption<T> {
    pub label: String,
    pub value: Option<T>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrcpyPresetsCatalog {
    pub audio_sources: Vec<String>,
    pub keyboards: Vec<String>,
    pub max_fps: Vec<ScrcpyPresetOption<u32>>,
    pub max_size: Vec<ScrcpyPresetOption<u32>>,
    pub record_formats: Vec<String>,
    pub video_bit_rate: Vec<ScrcpyPresetOption<String>>,
    pub video_codecs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScrcpyFlagExplanation {
    pub flag: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScrcpyCommandPreview {
    pub command: String,
    pub args: Vec<String>,
    pub flags: Vec<ScrcpyFlagExplanation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrcpyQualityProfile {
    pub id: String,
    pub label: String,
    pub description: String,
    pub badge: String,
    pub specs: Vec<String>,
    pub options: ScrcpyLaunchOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BandwidthMetrics {
    pub bitrate_mbps: f64,
    pub mb_per_min: f64,
    pub rating: String,
    pub rating_color: String,
    pub fraction: f64,
    pub max_scale_mbps: f64,
}

pub fn get_presets_catalog() -> ScrcpyPresetsCatalog {
    ScrcpyPresetsCatalog {
        max_size: vec![
            ScrcpyPresetOption { label: "Original (Device default)".into(), value: None },
            ScrcpyPresetOption { label: "720p HD (720)".into(), value: Some(720) },
            ScrcpyPresetOption { label: "1080p FHD (1080)".into(), value: Some(1080) },
            ScrcpyPresetOption { label: "1440p QHD (1440)".into(), value: Some(1440) },
            ScrcpyPresetOption { label: "1920 (FHD Max)".into(), value: Some(1920) },
            ScrcpyPresetOption { label: "2560 2K (2560)".into(), value: Some(2560) },
            ScrcpyPresetOption { label: "3840 4K (3840)".into(), value: Some(3840) },
        ],
        video_bit_rate: vec![
            ScrcpyPresetOption {
                label: "2 Mbps (2M - Low bandwidth)".into(),
                value: Some("2M".into()),
            },
            ScrcpyPresetOption { label: "4 Mbps (4M - Balanced)".into(), value: Some("4M".into()) },
            ScrcpyPresetOption { label: "8 Mbps (8M - Default)".into(), value: Some("8M".into()) },
            ScrcpyPresetOption {
                label: "16 Mbps (16M - High quality)".into(),
                value: Some("16M".into()),
            },
            ScrcpyPresetOption {
                label: "32 Mbps (32M - Ultra quality)".into(),
                value: Some("32M".into()),
            },
            ScrcpyPresetOption {
                label: "64 Mbps (64M - Lossless/Local)".into(),
                value: Some("64M".into()),
            },
        ],
        max_fps: vec![
            ScrcpyPresetOption { label: "Max / Native (Default)".into(), value: None },
            ScrcpyPresetOption { label: "30 FPS".into(), value: Some(30) },
            ScrcpyPresetOption { label: "60 FPS".into(), value: Some(60) },
            ScrcpyPresetOption { label: "90 FPS".into(), value: Some(90) },
            ScrcpyPresetOption { label: "120 FPS".into(), value: Some(120) },
            ScrcpyPresetOption { label: "144 FPS".into(), value: Some(144) },
        ],
        record_formats: RECORD_FORMATS.iter().map(|&s| s.to_string()).collect(),
        video_codecs: CODECS.iter().map(|&s| s.to_string()).collect(),
        keyboards: KEYBOARDS.iter().map(|&s| s.to_string()).collect(),
        audio_sources: AUDIO_SOURCES.iter().map(|&s| s.to_string()).collect(),
    }
}

pub fn resolve_device_record_path(base_path: &str, serial: Option<&str>) -> PathBuf {
    let path = PathBuf::from(base_path.trim());
    let Some(serial) = serial.map(str::trim).filter(|s| !s.is_empty()) else {
        return path;
    };

    if let (Some(parent), Some(stem), Some(ext)) = (
        path.parent(),
        path.file_stem().and_then(|s| s.to_str()),
        path.extension().and_then(|e| e.to_str()),
    ) {
        let clean_serial = serial.replace([':', '/', '\\', '*', '?', '"', '<', '>', '|'], "_");
        let new_filename = format!("{stem}-{clean_serial}.{ext}");
        parent.join(new_filename)
    } else {
        path
    }
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrcpyLaunchOptions {
    pub always_on_top: bool,
    pub audio_source: Option<String>,
    pub borderless: bool,
    pub fullscreen: bool,
    pub keyboard: Option<String>,
    pub max_fps: Option<u32>,
    pub max_size: Option<u32>,
    pub no_audio: bool,
    pub no_control: bool,
    pub record_format: Option<String>,
    pub record_path: Option<String>,
    pub show_touches: bool,
    pub stay_awake: bool,
    pub turn_screen_off: bool,
    pub video_bit_rate: Option<String>,
    pub video_codec: Option<String>,
}

fn allowlisted<'a>(value: &'a str, allowed: &[&str], field: &str) -> Result<&'a str, String> {
    let trimmed = value.trim();
    if allowed.contains(&trimmed) {
        Ok(trimmed)
    } else {
        Err(format!("unsupported {field}: {trimmed}"))
    }
}

fn bit_rate_ok(value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return false;
    }
    let (digits, _suffix) = match trimmed.chars().last() {
        Some('K' | 'k' | 'M' | 'm' | 'G' | 'g') => (&trimmed[..trimmed.len() - 1], true),
        Some(ch) if ch.is_ascii_digit() => (trimmed, false),
        _ => return false,
    };
    !digits.is_empty() && digits.chars().all(|ch| ch.is_ascii_digit())
}
/// Build argv **after** the executable. Serial is optional (single-device hosts).
pub fn build_args(
    options: &ScrcpyLaunchOptions,
    serial: Option<&str>,
) -> Result<Vec<String>, String> {
    let mut args = Vec::new();
    if let Some(serial) = serial.map(str::trim).filter(|value| !value.is_empty()) {
        args.push("-s".into());
        args.push(serial.to_string());
    }
    if let Some(max_size) = options.max_size.filter(|value| *value > 0) {
        args.push("-m".into());
        args.push(max_size.to_string());
    }
    if let Some(bit_rate) =
        options.video_bit_rate.as_deref().map(str::trim).filter(|v| !v.is_empty())
    {
        if !bit_rate_ok(bit_rate) {
            return Err(format!("invalid video bit rate: {bit_rate}"));
        }
        args.push("-b".into());
        args.push(bit_rate.to_string());
    }
    if let Some(fps) = options.max_fps.filter(|value| *value > 0) {
        args.push("--max-fps".into());
        args.push(fps.to_string());
    }
    if let Some(codec) = options.video_codec.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
        let codec = allowlisted(codec, CODECS, "video codec")?;
        args.push(format!("--video-codec={codec}"));
    }
    if options.no_audio {
        args.push("--no-audio".into());
    }
    if let Some(source) = options.audio_source.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
        let source = allowlisted(source, AUDIO_SOURCES, "audio source")?;
        args.push(format!("--audio-source={source}"));
    }
    if options.stay_awake {
        args.push("--stay-awake".into());
    }
    if options.turn_screen_off {
        args.push("--turn-screen-off".into());
    }
    if options.show_touches {
        args.push("--show-touches".into());
    }
    if options.fullscreen {
        args.push("--fullscreen".into());
    }
    if options.always_on_top {
        args.push("--always-on-top".into());
    }
    if options.borderless {
        args.push("--window-borderless".into());
    }
    if let Some(path) = options.record_path.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
        let resolved = resolve_device_record_path(path, serial);
        args.push("--record".into());
        args.push(resolved.to_string_lossy().into_owned());
    }
    if let Some(format) = options.record_format.as_deref().map(str::trim).filter(|v| !v.is_empty())
    {
        let format = allowlisted(format, RECORD_FORMATS, "record format")?;
        args.push(format!("--record-format={format}"));
    }
    if let Some(keyboard) = options.keyboard.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
        let keyboard = allowlisted(keyboard, KEYBOARDS, "keyboard")?;
        args.push(format!("--keyboard={keyboard}"));
    }
    if options.no_control {
        args.push("--no-control".into());
    }
    Ok(args)
}

pub fn scrcpy_preview_command(
    options: ScrcpyLaunchOptions,
    serial: Option<String>,
) -> CmdResult<ScrcpyCommandPreview> {
    let args = build_args(&options, serial.as_deref())?;
    let mut flags = Vec::new();

    if let Some(s) = serial.as_deref().filter(|s| !s.trim().is_empty()) {
        flags.push(ScrcpyFlagExplanation {
            flag: format!("-s {s}"),
            description: format!("Target device serial: {s}"),
        });
    }
    if let Some(max_size) = options.max_size.filter(|v| *v > 0) {
        flags.push(ScrcpyFlagExplanation {
            flag: format!("-m {max_size}"),
            description: format!("Scale display to maximum dimension of {max_size}px"),
        });
    }
    if let Some(bit_rate) = options.video_bit_rate.as_deref().filter(|v| !v.trim().is_empty()) {
        flags.push(ScrcpyFlagExplanation {
            flag: format!("-b {bit_rate}"),
            description: format!("Video stream target bit rate: {bit_rate}"),
        });
    }
    if let Some(fps) = options.max_fps.filter(|v| *v > 0) {
        flags.push(ScrcpyFlagExplanation {
            flag: format!("--max-fps={fps}"),
            description: format!("Cap maximum frame rate to {fps} fps"),
        });
    }
    if let Some(codec) = options.video_codec.as_deref().filter(|v| !v.trim().is_empty()) {
        flags.push(ScrcpyFlagExplanation {
            flag: format!("--video-codec={codec}"),
            description: format!("Encode video stream using {codec} codec"),
        });
    }
    if options.no_audio {
        flags.push(ScrcpyFlagExplanation {
            flag: "--no-audio".into(),
            description: "Disable audio forwarding from device".into(),
        });
    }
    if let Some(source) = options.audio_source.as_deref().filter(|v| !v.trim().is_empty()) {
        flags.push(ScrcpyFlagExplanation {
            flag: format!("--audio-source={source}"),
            description: format!("Forward audio from {source} output"),
        });
    }
    if options.stay_awake {
        flags.push(ScrcpyFlagExplanation {
            flag: "--stay-awake".into(),
            description: "Keep device display awake while connected".into(),
        });
    }
    if options.turn_screen_off {
        flags.push(ScrcpyFlagExplanation {
            flag: "--turn-screen-off".into(),
            description: "Blank physical device screen while mirroring".into(),
        });
    }
    if options.show_touches {
        flags.push(ScrcpyFlagExplanation {
            flag: "--show-touches".into(),
            description: "Show physical touch point visual circles on screen".into(),
        });
    }
    if options.fullscreen {
        flags.push(ScrcpyFlagExplanation {
            flag: "--fullscreen".into(),
            description: "Launch scrcpy directly in fullscreen mode".into(),
        });
    }
    if options.always_on_top {
        flags.push(ScrcpyFlagExplanation {
            flag: "--always-on-top".into(),
            description: "Keep window floating above other windows".into(),
        });
    }
    if options.borderless {
        flags.push(ScrcpyFlagExplanation {
            flag: "--window-borderless".into(),
            description: "Disable native window title bar and border decorations".into(),
        });
    }
    if let Some(path) = options.record_path.as_deref().filter(|v| !v.trim().is_empty()) {
        let resolved = resolve_device_record_path(path, serial.as_deref());
        flags.push(ScrcpyFlagExplanation {
            flag: format!("--record \"{}\"", resolved.display()),
            description: format!("Record screen mirroring stream to {}", resolved.display()),
        });
    }
    if let Some(format) = options.record_format.as_deref().filter(|v| !v.trim().is_empty()) {
        flags.push(ScrcpyFlagExplanation {
            flag: format!("--record-format={format}"),
            description: format!("Save recording using {format} container"),
        });
    }
    if let Some(keyboard) = options.keyboard.as_deref().filter(|v| !v.trim().is_empty()) {
        flags.push(ScrcpyFlagExplanation {
            flag: format!("--keyboard={keyboard}"),
            description: format!("Simulate keyboard input via {keyboard} mode"),
        });
    }
    if options.no_control {
        flags.push(ScrcpyFlagExplanation {
            flag: "--no-control".into(),
            description: "Read-only mode: do not forward mouse and keyboard events".into(),
        });
    }

    let mut cmd_parts = vec!["scrcpy".to_string()];
    for arg in &args {
        if arg.contains(' ') && !arg.starts_with('"') {
            cmd_parts.push(format!("\"{arg}\""));
        } else {
            cmd_parts.push(arg.clone());
        }
    }
    let command = cmd_parts.join(" ");

    Ok(ScrcpyCommandPreview { command, args, flags })
}

pub fn scrcpy_profiles() -> Vec<ScrcpyQualityProfile> {
    vec![
        ScrcpyQualityProfile {
            id: "gaming".into(),
            label: "Ultra Low Latency (Gaming)".into(),
            badge: "60 FPS · 16M".into(),
            description: "Optimized for high-framerate, ultra-low input latency mobile gaming with direct UHID inputs.".into(),
            specs: vec![
                "1080p FHD Max Resolution".into(),
                "60 FPS Fluid Refresh".into(),
                "16 Mbps High Bitrate".into(),
                "UHID Direct Keyboard & Mouse".into(),
            ],
            options: ScrcpyLaunchOptions {
                max_size: Some(1920),
                video_bit_rate: Some("16M".into()),
                max_fps: Some(60),
                video_codec: Some("h264".into()),
                keyboard: Some("uhid".into()),
                stay_awake: true,
                turn_screen_off: false,
                show_touches: false,
                fullscreen: false,
                always_on_top: false,
                borderless: false,
                no_audio: false,
                no_control: false,
                audio_source: None,
                record_path: None,
                record_format: None,
            },
        },
        ScrcpyQualityProfile {
            id: "productivity".into(),
            label: "Productivity & Office".into(),
            badge: "Balanced · 8M".into(),
            description: "Balanced display profile for document review, typing, and notifications with physical screen turned off.".into(),
            specs: vec![
                "Native Display Resolution".into(),
                "Standard Framerate".into(),
                "8 Mbps Balanced Stream".into(),
                "Physical Device Display Off".into(),
            ],
            options: ScrcpyLaunchOptions {
                max_size: None,
                video_bit_rate: Some("8M".into()),
                max_fps: None,
                video_codec: Some("h264".into()),
                keyboard: Some("uhid".into()),
                stay_awake: true,
                turn_screen_off: true,
                show_touches: false,
                fullscreen: false,
                always_on_top: false,
                borderless: false,
                no_audio: false,
                no_control: false,
                audio_source: None,
                record_path: None,
                record_format: None,
            },
        },
        ScrcpyQualityProfile {
            id: "battery".into(),
            label: "Battery Saver / Low Bandwidth".into(),
            badge: "720p · 2M · 30FPS".into(),
            description: "Conserves device battery, CPU power, and USB bandwidth with reduced bitrate and framerate caps.".into(),
            specs: vec![
                "720p Scaled Down".into(),
                "30 FPS Energy Efficient Cap".into(),
                "2 Mbps Low Bandwidth".into(),
                "Physical Device Display Off".into(),
            ],
            options: ScrcpyLaunchOptions {
                max_size: Some(1280),
                video_bit_rate: Some("2M".into()),
                max_fps: Some(30),
                video_codec: Some("h264".into()),
                keyboard: Some("uhid".into()),
                stay_awake: false,
                turn_screen_off: true,
                show_touches: false,
                fullscreen: false,
                always_on_top: false,
                borderless: false,
                no_audio: false,
                no_control: false,
                audio_source: None,
                record_path: None,
                record_format: None,
            },
        },
        ScrcpyQualityProfile {
            id: "creator".into(),
            label: "Content Creator / High Quality".into(),
            badge: "2K · 24M · H.265".into(),
            description: "Maximum visual fidelity with modern H.265 encoding and touch point visualization for tutorials and captures.".into(),
            specs: vec![
                "Original 2K+ High Resolution".into(),
                "60 FPS Recording Standard".into(),
                "24 Mbps High Bitrate".into(),
                "H.265 / HEVC Next-Gen Codec".into(),
            ],
            options: ScrcpyLaunchOptions {
                max_size: None,
                video_bit_rate: Some("24M".into()),
                max_fps: Some(60),
                video_codec: Some("h265".into()),
                keyboard: Some("uhid".into()),
                stay_awake: true,
                turn_screen_off: false,
                show_touches: true,
                fullscreen: false,
                always_on_top: false,
                borderless: false,
                no_audio: false,
                no_control: false,
                audio_source: None,
                record_path: None,
                record_format: None,
            },
        },
    ]
}

pub fn scrcpy_calculate_bandwidth_metrics(bitrate: Option<String>) -> BandwidthMetrics {
    let raw = bitrate.as_deref().unwrap_or("8M").trim();
    let bitrate_mbps = if let Some(stripped) = raw.strip_suffix(['m', 'M']) {
        stripped.parse::<f64>().unwrap_or(8.0)
    } else if let Some(stripped) = raw.strip_suffix(['k', 'K']) {
        stripped.parse::<f64>().unwrap_or(8000.0) / 1000.0
    } else {
        raw.parse::<f64>().unwrap_or(8.0)
    };

    let mb_per_min = (bitrate_mbps / 8.0) * 60.0;
    let max_scale_mbps = 64.0;
    let fraction = (bitrate_mbps / max_scale_mbps).clamp(0.0, 1.0);

    let (rating, rating_color) = if bitrate_mbps <= 4.0 {
        ("Low Bandwidth / Battery Saver", "emerald")
    } else if bitrate_mbps <= 12.0 {
        ("Balanced HD", "blue")
    } else if bitrate_mbps <= 24.0 {
        ("High Quality Pro", "purple")
    } else {
        ("Ultra Quality / Lossless", "rose")
    };

    BandwidthMetrics {
        bitrate_mbps,
        mb_per_min,
        rating: rating.to_string(),
        rating_color: rating_color.to_string(),
        fraction,
        max_scale_mbps,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serial_and_common_flags() {
        let options = ScrcpyLaunchOptions {
            max_size: Some(1920),
            video_bit_rate: Some("8M".into()),
            no_audio: true,
            stay_awake: true,
            video_codec: Some("h265".into()),
            ..ScrcpyLaunchOptions::default()
        };
        let args = build_args(&options, Some("emulator-5554")).expect("args");
        assert_eq!(
            args,
            vec![
                "-s",
                "emulator-5554",
                "-m",
                "1920",
                "-b",
                "8M",
                "--video-codec=h265",
                "--no-audio",
                "--stay-awake",
            ]
        );
    }

    #[test]
    fn rejects_unknown_codec() {
        let options = ScrcpyLaunchOptions {
            video_codec: Some("mpeg2".into()),
            ..ScrcpyLaunchOptions::default()
        };
        assert!(build_args(&options, None).is_err());
    }

    #[test]
    fn rejects_garbage_bitrate() {
        let options = ScrcpyLaunchOptions {
            video_bit_rate: Some("fast".into()),
            ..ScrcpyLaunchOptions::default()
        };
        assert!(build_args(&options, None).is_err());
    }

    #[test]
    fn resolves_per_device_record_path() {
        let base = if cfg!(windows) { "C:\\Videos\\session.mp4" } else { "/tmp/session.mp4" };
        let resolved = resolve_device_record_path(base, Some("DEVICE123"));
        let path_str = resolved.to_string_lossy();
        assert!(path_str.contains("session-DEVICE123.mp4"));
    }

    #[test]
    fn resolves_unmodified_path_when_serial_absent() {
        let base = if cfg!(windows) { "C:\\Videos\\session.mp4" } else { "/tmp/session.mp4" };
        let resolved = resolve_device_record_path(base, None);
        assert_eq!(resolved, PathBuf::from(base));
    }

    #[test]
    fn test_scrcpy_preview_command() {
        let options = ScrcpyLaunchOptions {
            max_size: Some(1080),
            video_bit_rate: Some("16M".into()),
            stay_awake: true,
            fullscreen: true,
            ..ScrcpyLaunchOptions::default()
        };
        let preview = scrcpy_preview_command(options, Some("serial123".into())).expect("preview");
        assert!(preview.command.starts_with("scrcpy -s serial123 -m 1080 -b 16M"));
        assert!(preview.flags.iter().any(|f| f.flag == "-s serial123"));
        assert!(preview.flags.iter().any(|f| f.flag == "--stay-awake"));
        assert!(preview.flags.iter().any(|f| f.flag == "--fullscreen"));
    }

    #[test]
    fn test_scrcpy_profiles() {
        let profiles = scrcpy_profiles();
        assert_eq!(profiles.len(), 4);
        let ids: Vec<_> = profiles.iter().map(|p| p.id.as_str()).collect();
        assert_eq!(ids, vec!["gaming", "productivity", "battery", "creator"]);
    }

    #[test]
    fn test_scrcpy_calculate_bandwidth_metrics() {
        let m1 = scrcpy_calculate_bandwidth_metrics(Some("2M".into()));
        assert_eq!(m1.bitrate_mbps, 2.0);
        assert_eq!(m1.rating_color, "emerald");

        let m2 = scrcpy_calculate_bandwidth_metrics(Some("8M".into()));
        assert_eq!(m2.bitrate_mbps, 8.0);
        assert_eq!(m2.rating_color, "blue");

        let m3 = scrcpy_calculate_bandwidth_metrics(Some("16M".into()));
        assert_eq!(m3.bitrate_mbps, 16.0);
        assert_eq!(m3.rating_color, "purple");

        let m4 = scrcpy_calculate_bandwidth_metrics(Some("32M".into()));
        assert_eq!(m4.bitrate_mbps, 32.0);
        assert_eq!(m4.rating_color, "rose");
    }
}
