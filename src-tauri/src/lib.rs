mod commands;
mod helpers;
pub mod payload;

use tauri::Manager;

pub type CmdResult<T> = Result<T, String>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(payload::PayloadCache::default())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main")
                && let Some(icon) = app.default_window_icon()
            {
                let _ = window.set_icon(icon.clone());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::cleanup_payload_cache,
            commands::connect_wireless_adb,
            commands::create_directory,
            commands::create_file,
            commands::delete_files,
            commands::disconnect_wireless_adb,
            commands::enable_wireless_adb,
            commands::extract_payload,
            commands::flash_partition,
            commands::get_bootloader_variables,
            commands::get_device_info,
            commands::get_device_mode,
            commands::get_devices,
            commands::get_fastboot_devices,
            commands::get_installed_packages,
            commands::install_package,
            commands::launch_device_manager,
            commands::launch_terminal,
            commands::list_files,
            commands::list_payload_partitions,
            commands::list_payload_partitions_with_details,
            commands::open_folder,
            commands::pull_file,
            commands::push_file,
            commands::rename_file,
            commands::reboot,
            commands::run_adb_host_command,
            commands::run_fastboot_host_command,
            commands::run_shell_command,
            commands::save_log,
            commands::set_active_slot,
            commands::sideload_package,
            commands::uninstall_package,
            commands::wipe_data,
            // Remote URL payload commands (feature: remote_zip)
            #[cfg(feature = "remote_zip")]
            commands::check_remote_payload,
            #[cfg(feature = "remote_zip")]
            commands::get_remote_payload_metadata,
            #[cfg(feature = "remote_zip")]
            commands::list_remote_payload_partitions
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if matches!(event, tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }) {
                let payload_cache = app_handle.state::<payload::PayloadCache>();
                let _ = payload_cache.cleanup();
            }
        });
}
