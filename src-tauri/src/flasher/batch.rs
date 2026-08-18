use crate::CmdResult;
use crate::commands::run_fastboot_for_serial;
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchFlashItem {
    pub id: Option<String>,
    pub partition: String,
    pub file_path: String,
    pub file_name: Option<String>,
    pub file_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchFlashProgress {
    pub current_index: usize,
    pub total_items: usize,
    pub current_partition: String,
    pub current_file: String,
    pub stage: String, // "queued" | "flashing" | "success" | "failed" | "done"
    pub progress_percent: f32,
    pub message: String,
    pub error: Option<String>,
}

pub const BATCH_PROGRESS_EVENT: &str = "flasher:batch-progress";

pub fn partition_priority(partition: &str) -> u32 {
    let clean = partition.to_lowercase();
    let base = clean
        .trim_end_matches("_a")
        .trim_end_matches("_b")
        .trim_end_matches("-a")
        .trim_end_matches("-b");

    match base {
        "boot" => 10,
        "init_boot" => 20,
        "vendor_boot" => 30,
        "dtbo" => 40,
        "vbmeta" => 50,
        "vbmeta_system" => 52,
        "vbmeta_vendor" => 54,
        "recovery" => 60,
        "super" => 70,
        "system" => 80,
        "vendor" => 90,
        "product" => 100,
        "system_ext" => 110,
        "odm" => 120,
        "modem" => 130,
        "radio" => 140,
        "bluetooth" => 150,
        "dsp" => 160,
        "persist" => 170,
        "metadata" => 180,
        "cache" => 190,
        "userdata" => 200,
        _ => 999,
    }
}

pub fn sort_batch_items(items: &mut [BatchFlashItem]) {
    items.sort_by_key(|item| partition_priority(&item.partition));
}

fn emit_batch_progress(app: &AppHandle, payload: &BatchFlashProgress) {
    if let Err(e) = app.emit(BATCH_PROGRESS_EVENT, payload) {
        error!("Failed to emit batch flash progress: {e}");
    }
}

pub async fn flash_partition_batch(
    app: AppHandle,
    serial: Option<String>,
    mut items: Vec<BatchFlashItem>,
) -> CmdResult<()> {
    if items.is_empty() {
        return Err("No partition items provided to flash.".into());
    }

    for item in &items {
        let part = item.partition.trim();
        let path_str = item.file_path.trim();
        if part.is_empty() || path_str.is_empty() {
            return Err("Each batch item must have a valid partition name and image path.".into());
        }
        let p = Path::new(path_str);
        if !p.exists() {
            return Err(format!("Partition image file not found: '{}'", path_str));
        }
    }

    sort_batch_items(&mut items);
    let total = items.len();
    info!("Starting batch flash for {} partitions", total);

    tokio::task::spawn_blocking(move || {
        for (idx, item) in items.iter().enumerate() {
            let part_name = item.partition.trim().to_string();
            let file_str = item.file_path.trim().to_string();
            let file_name = item.file_name.clone().unwrap_or_else(|| {
                Path::new(&file_str)
                    .file_name()
                    .map_or_else(|| "image.img".to_string(), |f| f.to_string_lossy().to_string())
            });

            let current_percent = (idx as f32 / total as f32) * 100.0;

            emit_batch_progress(
                &app,
                &BatchFlashProgress {
                    current_index: idx + 1,
                    total_items: total,
                    current_partition: part_name.clone(),
                    current_file: file_name.clone(),
                    stage: "flashing".to_string(),
                    progress_percent: current_percent,
                    message: format!("Flashing partition '{}' ({}/{})", part_name, idx + 1, total),
                    error: None,
                },
            );

            info!(
                "Batch flash [{}/{}]: flashing '{}' with '{}'",
                idx + 1,
                total,
                part_name,
                file_str
            );

            let flash_res =
                run_fastboot_for_serial(&app, serial.as_deref(), &["flash", &part_name, &file_str]);

            match flash_res {
                Ok(_) => {
                    let completed_percent = ((idx + 1) as f32 / total as f32) * 100.0;
                    emit_batch_progress(
                        &app,
                        &BatchFlashProgress {
                            current_index: idx + 1,
                            total_items: total,
                            current_partition: part_name.clone(),
                            current_file: file_name.clone(),
                            stage: "success".to_string(),
                            progress_percent: completed_percent,
                            message: format!("Successfully flashed '{}'", part_name),
                            error: None,
                        },
                    );
                }
                Err(err) => {
                    emit_batch_progress(
                        &app,
                        &BatchFlashProgress {
                            current_index: idx + 1,
                            total_items: total,
                            current_partition: part_name.clone(),
                            current_file: file_name.clone(),
                            stage: "failed".to_string(),
                            progress_percent: current_percent,
                            message: format!("Failed to flash '{}'", part_name),
                            error: Some(err.clone()),
                        },
                    );
                    return Err(format!("Batch flashing aborted on '{}': {}", part_name, err));
                }
            }
        }

        emit_batch_progress(
            &app,
            &BatchFlashProgress {
                current_index: total,
                total_items: total,
                current_partition: String::new(),
                current_file: String::new(),
                stage: "done".to_string(),
                progress_percent: 100.0,
                message: format!("Batch flash completed successfully ({} partitions)", total),
                error: None,
            },
        );

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_partition_topological_sort() {
        let mut items = vec![
            BatchFlashItem {
                id: None,
                partition: "userdata".to_string(),
                file_path: "/tmp/userdata.img".to_string(),
                file_name: None,
                file_size: None,
            },
            BatchFlashItem {
                id: None,
                partition: "system_a".to_string(),
                file_path: "/tmp/system.img".to_string(),
                file_name: None,
                file_size: None,
            },
            BatchFlashItem {
                id: None,
                partition: "vbmeta".to_string(),
                file_path: "/tmp/vbmeta.img".to_string(),
                file_name: None,
                file_size: None,
            },
            BatchFlashItem {
                id: None,
                partition: "boot_a".to_string(),
                file_path: "/tmp/boot.img".to_string(),
                file_name: None,
                file_size: None,
            },
            BatchFlashItem {
                id: None,
                partition: "dtbo".to_string(),
                file_path: "/tmp/dtbo.img".to_string(),
                file_name: None,
                file_size: None,
            },
            BatchFlashItem {
                id: None,
                partition: "super".to_string(),
                file_path: "/tmp/super.img".to_string(),
                file_name: None,
                file_size: None,
            },
            BatchFlashItem {
                id: None,
                partition: "init_boot".to_string(),
                file_path: "/tmp/init_boot.img".to_string(),
                file_name: None,
                file_size: None,
            },
        ];

        sort_batch_items(&mut items);

        let partitions: Vec<String> = items.into_iter().map(|i| i.partition).collect();
        assert_eq!(
            partitions,
            vec!["boot_a", "init_boot", "dtbo", "vbmeta", "super", "system_a", "userdata"]
        );
    }
}
