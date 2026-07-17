#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// Same transitive graph as the lib crate; see lib.rs.
#![allow(clippy::multiple_crate_versions)]

fn main() {
    adb_gui_next_lib::run();
}
