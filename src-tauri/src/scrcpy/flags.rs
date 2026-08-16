//! Maps a validated launch DTO onto official scrcpy CLI flags. No custom protocol.

use serde::Deserialize;

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

#[derive(Debug, Clone, Default, Deserialize)]
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
    let (digits, suffix) = match trimmed.chars().last() {
        Some('K' | 'k' | 'M' | 'm') => (&trimmed[..trimmed.len() - 1], true),
        Some(ch) if ch.is_ascii_digit() => (trimmed, false),
        _ => return false,
    };
    let _ = suffix;
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
