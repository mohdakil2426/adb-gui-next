//! Staged remote load progress events for partition listing.
//!
//! Event name: `payload:load-progress`
//! Phases: verifyConnection | locateIndex | detectFormat | readPartitions | done | error

use tauri::{AppHandle, Emitter};

/// Emit a `payload:load-progress` event when an app handle is available.
pub fn emit_load_progress(
    app: Option<&AppHandle>,
    phase: &str,
    message: &str,
    detail: Option<&str>,
    step: u32,
    total_steps: u32,
) {
    let Some(handle) = app else {
        return;
    };
    let _ = handle.emit(
        "payload:load-progress",
        serde_json::json!({
            "phase": phase,
            "message": message,
            "detail": detail,
            "step": step,
            "totalSteps": total_steps,
        }),
    );
}
