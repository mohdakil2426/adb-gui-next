//! Maps a validated launch DTO onto official scrcpy CLI flags. No custom protocol.

use serde::{Deserialize, Serialize};

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
    pub video_bit_rate: Vec<ScrcpyPresetOption<String>>,
    pub video_codecs: Vec<String>,
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
        video_codecs: CODECS.iter().map(|&s| s.to_string()).collect(),
        keyboards: KEYBOARDS.iter().map(|&s| s.to_string()).collect(),
        audio_sources: AUDIO_SOURCES.iter().map(|&s| s.to_string()).collect(),
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
        args.push("--record".into());
        args.push(path.to_string());
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
}
