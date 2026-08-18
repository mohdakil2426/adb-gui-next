// Unavoidable: Tauri/plugin/transitive graph pulls multiple major versions of
// common crates (windows-sys, thiserror, hashbrown, …). Cannot unify without
// forking the dependency tree.
#![allow(clippy::multiple_crate_versions)]

pub mod adb;
pub mod app_icons;
mod commands;
pub mod debloat;
pub mod emulator;
mod helpers;
pub mod host_setup;
pub mod marketplace;
pub mod mtp;
pub mod payload;
pub mod scrcpy;
pub mod utilities;

use tauri::Manager;

pub type CmdResult<T> = Result<T, String>;

fn build_log_targets() -> Vec<tauri_plugin_log::Target> {
    #[cfg(debug_assertions)]
    {
        vec![
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
        ]
    }
    #[cfg(not(debug_assertions))]
    {
        // Release builds: no stdout target to prevent console window
        vec![
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
        ]
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
// Bootstrap: process cannot continue if Tauri fails to build the application.
#[allow(clippy::expect_used)]
pub fn run() {
    let _ = fix_path_env::fix();
    tauri::Builder::default()
        // Official single-instance: second launch focuses the existing main window.
        // https://v2.tauri.app/plugin/single-instance/
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets(build_log_targets())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(payload::PayloadCache::default())
        .manage(marketplace::ManagedMarketplaceCache::default())
        .manage(marketplace::ManagedHttpClient::default())
        .manage(debloat::cache::DebloatCache::default())
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
            commands::create_cancellation_token,
            commands::create_directory,
            commands::create_file,
            commands::delete_files,
            commands::transfer_device_files,
            commands::disconnect_wireless_adb,
            commands::enable_wireless_adb,
            commands::extract_payload,
            commands::extract_delta_payload,
            commands::fetch_magisk_stable_release,
            commands::finalize_avd_root,
            commands::flash_partition,
            commands::get_bootloader_variables,
            commands::get_device_info,
            commands::get_device_mode,
            commands::get_device_sdk,
            commands::get_device_telemetry,
            commands::get_devices,
            commands::get_fastboot_devices,
            commands::get_installed_packages,
            commands::get_avd_restore_plan,
            commands::install_package,
            commands::launch_device_manager,
            commands::launch_avd,
            commands::launch_terminal,
            commands::list_avds,
            commands::host_path_kinds,
            commands::list_files,
            commands::list_payload_partitions,
            commands::list_payload_partitions_with_details,
            commands::open_folder,
            commands::prepare_avd_root,
            commands::pull_file,
            commands::push_file,
            commands::rename_file,
            commands::reboot,
            commands::restore_avd_backups,
            commands::root_avd,
            commands::scan_avd_root_readiness,
            commands::verify_avd_root,
            commands::verify_file_root_access,
            commands::run_adb_host_command,
            commands::run_fastboot_host_command,
            commands::run_shell_command,
            commands::save_log,
            commands::set_active_slot,
            commands::sideload_package,
            commands::stop_avd,
            commands::uninstall_package,
            commands::wipe_data,
            commands::check_remote_payload,
            commands::cancel_extraction,
            commands::diagnose_payload,
            commands::get_remote_payload_metadata,
            commands::list_remote_payload_partitions,
            commands::get_ops_metadata,
            commands::marketplace_search,
            commands::marketplace_get_app_detail,
            commands::marketplace_list_versions,
            commands::marketplace_clear_cache,
            commands::marketplace_github_device_start,
            commands::marketplace_github_device_poll,
            commands::marketplace_download_apk,
            commands::marketplace_install_apk,
            // Debloater
            commands::load_debloat_lists,
            commands::get_debloat_packages,
            commands::debloat_packages,
            commands::create_debloat_backup,
            commands::list_debloat_backups,
            commands::restore_debloat_backup,
            commands::get_debloat_device_settings,
            commands::save_debloat_device_settings,
            commands::get_debloat_data,
            commands::refresh_debloat_data,
            commands::scrcpy_status,
            commands::scrcpy_check_update,
            commands::scrcpy_install,
            commands::scrcpy_uninstall,
            commands::scrcpy_launch,
            commands::scrcpy_stop,
            commands::scrcpy_active_sessions,
            commands::scrcpy_presets,
            commands::scrcpy_open_toolbar,
            commands::scrcpy_close_toolbar,
            commands::scrcpy_get_toolbar_state,
            commands::scrcpy_set_toolbar_mode,
            commands::scrcpy_set_toolbar_offset,
            commands::scrcpy_set_toolbar_side,
            commands::scrcpy_send_keyevent,
            commands::scrcpy_send_statusbar,
            commands::scrcpy_rotate_device,
            commands::scrcpy_take_screenshot,
            commands::get_app_icons,
            commands::open_device_file_in_editor,
            commands::reveal_device_path_in_explorer,
            commands::get_logcat_snapshot,
            commands::save_screenshot,
            commands::restart_adb_server,
            commands::kill_adb_server,
            commands::get_host_tool_versions,
            commands::host_setup_status,
            commands::host_setup_install,
            commands::host_setup_install_driver,
            commands::launch_host_setup_terminal,
            commands::host_setup_repair_path,
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
