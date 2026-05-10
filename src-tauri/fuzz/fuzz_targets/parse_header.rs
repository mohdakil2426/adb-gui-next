#![no_main]

use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    let _ = adb_gui_next_lib::payload::parse_header(data);
});