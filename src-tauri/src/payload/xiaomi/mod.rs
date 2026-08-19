//! Xiaomi firmware format unpacking (Fastboot TGZ, Recovery `transfer.list` & `dat.br`).

pub mod dat_br;

pub use dat_br::{
    BLOCK_SIZE, DEFAULT_CHUNK_SIZE, Range, TransferCommand, TransferList, XiaomiDatExtractor,
    extract_xiaomi_dat,
};
