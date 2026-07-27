//! Single entry point for `adb` process invocation.
//!
//! Two problems this module exists to solve:
//!
//! 1. **Path re-resolution.** `helpers::resolve_binary_path` + `binary_working_directory`
//!    cost 4–8 syscalls (`resource_dir()`, several `exists()`, `fs::metadata`, possibly a
//!    full `PATH` walk) and used to run before *every* spawn. [`AdbClient`] resolves both
//!    exactly once per process into a [`OnceLock`].
//! 2. **Duplicated exit-marker parsing.** Three separate copies of "append
//!    `; echo MARKER:$?`, parse it back" existed. [`AdbClient::shell`] and
//!    [`AdbClient::shell_batch`] are the single implementation.
//!
//! [`AdbClient::shell_batch`] runs N device-shell commands in **one** `adb` process and
//! recovers a per-command exit code from a per-batch nonce marker.

pub mod telemetry;

mod parse;

use crate::CmdResult;
use crate::helpers::{binary_working_directory, resolve_binary_path};
use log::{debug, warn};
use std::{
    path::PathBuf,
    process::Command,
    sync::{
        OnceLock,
        atomic::{AtomicU64, Ordering},
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::AppHandle;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Resolved `adb` invocation context. Populated once, then read for the process lifetime.
struct AdbBinary {
    exe: PathBuf,
    cwd: Option<PathBuf>,
}

static ADB_BINARY: OnceLock<AdbBinary> = OnceLock::new();

/// Resolve `adb` (and its working directory) once per process.
fn adb_binary(app: &AppHandle) -> CmdResult<&'static AdbBinary> {
    if let Some(cached) = ADB_BINARY.get() {
        return Ok(cached);
    }

    let exe = resolve_binary_path(app, "adb")?;
    let cwd = binary_working_directory(Some(app));
    debug!("adb binary resolved once for this process: {exe:?}");

    // A concurrent caller may have won the race; either value is equivalent.
    let _ = ADB_BINARY.set(AdbBinary { exe, cwd });
    ADB_BINARY.get().ok_or_else(|| "Failed to cache the resolved adb binary path.".to_string())
}

/// Raw result of one `adb` process.
struct RawOutput {
    success: bool,
    stdout: String,
    stderr: String,
}

impl RawOutput {
    /// stdout and stderr in the order `helpers::run_command_capture` produced them,
    /// so error text stays byte-identical to the pre-`AdbClient` behaviour.
    fn combined(&self) -> String {
        match (self.stdout.is_empty(), self.stderr.is_empty()) {
            (false, false) => format!("{}\n{}", self.stdout, self.stderr),
            (false, true) => self.stdout.clone(),
            (true, false) => self.stderr.clone(),
            (true, true) => String::new(),
        }
    }

    /// Mirror of `helpers::run_binary_command`'s failure mapping.
    fn into_failure(self, args: &[&str]) -> String {
        if !self.stderr.is_empty() {
            self.stderr
        } else {
            let combined = self.combined();
            if combined.is_empty() { format!("adb {args:?} failed (no output)") } else { combined }
        }
    }
}

/// One command's slice of a [`AdbClient::shell_batch`] run.
#[derive(Debug, Clone)]
pub struct CmdOutput {
    /// The device-shell command as submitted.
    pub command: String,
    /// `None` when the command's marker never appeared — the shell aborted before
    /// reaching it, so neither the output nor the status can be trusted.
    pub exit_code: Option<i32>,
    /// Trimmed stdout captured between this command's marker and the previous one.
    pub stdout: String,
}

impl CmdOutput {
    #[must_use]
    pub fn is_success(&self) -> bool {
        self.exit_code == Some(0)
    }

    /// Trimmed stdout, but only when the command actually succeeded and printed something.
    #[must_use]
    pub fn ok_stdout(&self) -> Option<&str> {
        if self.is_success() {
            let trimmed = self.stdout.trim();
            (!trimmed.is_empty()).then_some(trimmed)
        } else {
            None
        }
    }
}

/// Per-batch nonce marker. A nonce (not a fixed literal) so device output that happens
/// to contain the marker text cannot forge a command boundary.
fn next_marker() -> String {
    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    let sequence = SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |since| since.as_nanos());
    format!("__ADB_GUI_EXIT_{:x}_{sequence:x}_{nanos:x}__:", std::process::id())
}

/// Parse `<marker><index>:<code>` back into `(prefix, index, code)`.
///
/// The marker is located with `rfind`, not `strip_prefix`: when the preceding
/// command's stdout has no trailing newline, `echo <marker>…` lands on the *same*
/// physical line. `prefix` is that command's real output and must be preserved —
/// stripping the whole line loses it, and refusing to parse loses the exit code
/// (which surfaced as the bogus "Missing ADB shell exit marker" error for
/// commands that had in fact succeeded).
fn parse_marker_line<'a>(line: &'a str, marker: &str) -> Option<(&'a str, usize, Option<i32>)> {
    let trimmed = line.trim_end();
    let at = trimmed.rfind(marker)?;
    let rest = &trimmed[at + marker.len()..];
    let (index, code) = rest.split_once(':')?;
    let index = index.trim().parse::<usize>().ok()?;
    Some((&trimmed[..at], index, code.trim().parse::<i32>().ok()))
}

/// A device-scoped `adb` invoker.
///
/// Cheap to construct — the binary path is process-global, and `AppHandle` is a handle,
/// not a resource. Build one per operation rather than threading it through call stacks.
pub struct AdbClient {
    app: AppHandle,
    serial: Option<String>,
}

impl AdbClient {
    /// Blank or whitespace-only serials are treated as "no device selected", matching
    /// `commands::device::selected_serial`.
    #[must_use]
    pub fn new(app: &AppHandle, serial: Option<&str>) -> Self {
        let serial = serial
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(std::string::ToString::to_string);
        Self { app: app.clone(), serial }
    }

    /// Run one device-shell command with strict exit-code checking.
    ///
    /// Host success is not device success: `adb shell false` exits 0 on the host.
    pub fn shell(&self, cmd: &str) -> CmdResult<String> {
        self.shell_checked(false, cmd)
    }

    /// [`Self::shell`], optionally wrapped in `su -c` for root operations.
    pub fn shell_checked(&self, access_root: bool, cmd: &str) -> CmdResult<String> {
        let marker = next_marker();
        let wrapped = format!("{cmd}; echo {marker}0:$?");

        let mut args: Vec<&str> = vec!["shell"];
        if access_root {
            args.push("su");
            args.push("-c");
        }
        args.push(&wrapped);

        let raw = self.run(&args)?;
        let output = raw.combined();

        let Some(code) = output
            .lines()
            .rev()
            .find_map(|line| parse_marker_line(line, &marker).and_then(|(_, _, code)| code))
        else {
            return Err(format!(
                "Missing ADB shell exit marker. The shell command may have aborted:\n  cmd: {cmd}\n  output: {output}"
            ));
        };

        // Strip the bookkeeping text so callers never have to filter it out. Only
        // the marker itself is removed — anything before it on the same line is
        // the command's own unterminated output.
        let mut cleaned_lines: Vec<&str> = Vec::new();
        for line in output.lines() {
            match parse_marker_line(line, &marker) {
                Some((prefix, _, _)) => {
                    if !prefix.is_empty() {
                        cleaned_lines.push(prefix);
                    }
                }
                None => cleaned_lines.push(line),
            }
        }
        let cleaned = cleaned_lines.join("\n");

        if code != 0 {
            return Err(format!(
                "ADB shell command failed (exit {code}):\n  cmd: {cmd}\n  output: {cleaned}"
            ));
        }
        Ok(cleaned)
    }

    /// Run N device-shell commands in **one** `adb` process.
    ///
    /// Commands are joined with `;` and each is followed by an `echo <marker><i>:$?`, so
    /// every command's stdout and exit status are recovered independently. A non-zero
    /// command does **not** fail the batch — inspect [`CmdOutput::exit_code`]. Only a
    /// host-level failure (device offline, adb missing) returns `Err`.
    ///
    /// The joined script travels as a single argv entry, so keep batches to tens of
    /// commands rather than thousands.
    pub fn shell_batch(&self, cmds: &[&str]) -> CmdResult<Vec<CmdOutput>> {
        if cmds.is_empty() {
            return Ok(Vec::new());
        }

        let marker = next_marker();
        let mut script = String::new();
        for (index, cmd) in cmds.iter().enumerate() {
            script.push_str(cmd);
            script.push_str("; echo ");
            script.push_str(&marker);
            script.push_str(&index.to_string());
            script.push_str(":$?; ");
        }

        let raw = self.run(&["shell", &script])?;
        Ok(split_batch_output(cmds, &raw.stdout, &marker))
    }

    /// Run `adb [-s serial] <args>`, mapping a non-zero host exit to `Err` exactly as
    /// `helpers::run_binary_command` does.
    fn run(&self, args: &[&str]) -> CmdResult<RawOutput> {
        let raw = self.run_raw(args)?;
        if raw.success { Ok(raw) } else { Err(raw.into_failure(args)) }
    }

    fn run_raw(&self, args: &[&str]) -> CmdResult<RawOutput> {
        let binary = adb_binary(&self.app)?;

        let mut command = Command::new(&binary.exe);
        if let Some(serial) = &self.serial {
            command.args(["-s", serial]);
        }
        command.args(args);
        if let Some(cwd) = &binary.cwd {
            command.current_dir(cwd);
        }

        #[cfg(target_os = "windows")]
        command.creation_flags(CREATE_NO_WINDOW);

        let output = command.output().map_err(|error| {
            warn!("Failed to execute adb {args:?}: {error}");
            error.to_string()
        })?;

        Ok(RawOutput {
            success: output.status.success(),
            stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
        })
    }
}

/// Segment a batched run's stdout on its marker lines.
fn split_batch_output(cmds: &[&str], stdout: &str, marker: &str) -> Vec<CmdOutput> {
    let mut outputs: Vec<CmdOutput> = cmds
        .iter()
        .map(|cmd| CmdOutput {
            command: (*cmd).to_string(),
            exit_code: None,
            stdout: String::new(),
        })
        .collect();

    let mut buffer = String::new();
    for line in stdout.lines() {
        if let Some((prefix, index, code)) = parse_marker_line(line, marker) {
            // Output that shares the marker's line (command printed no trailing
            // newline) still belongs to that command.
            buffer.push_str(prefix);
            if let Some(slot) = outputs.get_mut(index) {
                slot.stdout = buffer.trim().to_string();
                slot.exit_code = code;
            }
            buffer.clear();
            continue;
        }
        buffer.push_str(line.trim_end());
        buffer.push('\n');
    }

    outputs
}

#[cfg(test)]
mod tests {
    use super::*;

    const MARKER: &str = "__ADB_GUI_EXIT_1a2b_0_ff__:";

    #[test]
    fn next_marker_is_unique_per_batch() {
        assert_ne!(next_marker(), next_marker());
    }

    #[test]
    fn parse_marker_line_reads_index_and_code() {
        assert_eq!(parse_marker_line(&format!("{MARKER}0:0"), MARKER), Some(("", 0, Some(0))));
        assert_eq!(
            parse_marker_line(&format!("{MARKER}12:127"), MARKER),
            Some(("", 12, Some(127)))
        );
        assert_eq!(
            parse_marker_line(&format!("  {MARKER}3:1  "), MARKER),
            Some(("  ", 3, Some(1)))
        );
        assert_eq!(parse_marker_line("plain output", MARKER), None);
        assert_eq!(parse_marker_line(&format!("{MARKER}x:0"), MARKER), None);
    }

    /// A command whose stdout has no trailing newline puts the marker on the same
    /// physical line. The prefix is that command's output; the code still parses.
    #[test]
    fn parse_marker_line_recovers_marker_appended_to_unterminated_output() {
        assert_eq!(
            parse_marker_line(&format!("no-newline{MARKER}0:0"), MARKER),
            Some(("no-newline", 0, Some(0)))
        );
    }

    #[test]
    fn split_batch_output_keeps_output_sharing_the_marker_line() {
        let cmds = ["printf abc", "echo b"];
        let stdout = format!(
            "abc{MARKER}0:0
b
{MARKER}1:0
"
        );

        let outputs = split_batch_output(&cmds, &stdout, MARKER);

        assert_eq!(outputs[0].stdout, "abc");
        assert_eq!(outputs[0].exit_code, Some(0));
        assert_eq!(outputs[1].stdout, "b");
        assert_eq!(outputs[1].exit_code, Some(0));
    }

    #[test]
    fn split_batch_output_assigns_stdout_and_codes_per_command() {
        let cmds = ["getprop", "id -u", "cat /proc/uptime"];
        let stdout = format!(
            "[ro.product.model]: [Pixel 7]\n{MARKER}0:0\n{MARKER}1:1\n12345.67 900.12\n{MARKER}2:0\n"
        );

        let outputs = split_batch_output(&cmds, &stdout, MARKER);

        assert_eq!(outputs.len(), 3);
        assert_eq!(outputs[0].stdout, "[ro.product.model]: [Pixel 7]");
        assert_eq!(outputs[0].exit_code, Some(0));
        assert!(outputs[0].is_success());

        assert_eq!(outputs[1].stdout, "");
        assert_eq!(outputs[1].exit_code, Some(1));
        assert_eq!(outputs[1].ok_stdout(), None);

        assert_eq!(outputs[2].ok_stdout(), Some("12345.67 900.12"));
    }

    #[test]
    fn split_batch_output_leaves_unreached_commands_unknown() {
        let cmds = ["echo a", "echo b"];
        let stdout = format!("a\n{MARKER}0:0\n");

        let outputs = split_batch_output(&cmds, &stdout, MARKER);

        assert_eq!(outputs[0].exit_code, Some(0));
        assert_eq!(outputs[1].exit_code, None);
        assert!(!outputs[1].is_success());
    }

    #[test]
    fn split_batch_output_tolerates_crlf_and_out_of_range_markers() {
        let cmds = ["echo a"];
        let stdout = format!("a\r\n{MARKER}0:0\r\n{MARKER}9:0\r\n");

        let outputs = split_batch_output(&cmds, &stdout, MARKER);

        assert_eq!(outputs.len(), 1);
        assert_eq!(outputs[0].stdout, "a");
        assert_eq!(outputs[0].exit_code, Some(0));
    }
}
