use crate::CmdResult;
use crate::commands::run_fastboot_for_serial;
use log::{info, warn};
use tauri::AppHandle;

pub fn verify_erase_confirmation(partition: &str, confirm_phrase: &str) -> Result<(), String> {
    let part = partition.trim();
    if part.is_empty() {
        return Err("Partition name is required for erase operation.".into());
    }

    let confirm = confirm_phrase.trim();
    if confirm != "WIPE" && confirm != part && !confirm.eq_ignore_ascii_case(part) {
        return Err(format!(
            "Erase authorization mismatch: expected 'WIPE' or '{}', received '{}'",
            part, confirm
        ));
    }

    Ok(())
}

pub async fn erase_partition(
    app: AppHandle,
    serial: Option<String>,
    partition: String,
    confirm_phrase: String,
) -> CmdResult<()> {
    verify_erase_confirmation(&partition, &confirm_phrase)?;

    let part_owned = partition.trim().to_string();
    warn!("Erasing partition '{}' via fastboot erase", part_owned);

    tokio::task::spawn_blocking(move || {
        let _ = run_fastboot_for_serial(&app, serial.as_deref(), &["erase", &part_owned])?;
        info!("Partition '{}' erased successfully", part_owned);
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verify_erase_confirmation() {
        assert!(verify_erase_confirmation("boot", "WIPE").is_ok());
        assert!(verify_erase_confirmation("boot", "boot").is_ok());
        assert!(verify_erase_confirmation("boot", "BOOT").is_ok());
        assert!(verify_erase_confirmation("userdata", "WIPE").is_ok());
        assert!(verify_erase_confirmation("userdata", "userdata").is_ok());
        assert!(verify_erase_confirmation("userdata", "wrong").is_err());
        assert!(verify_erase_confirmation("", "WIPE").is_err());
    }
}
