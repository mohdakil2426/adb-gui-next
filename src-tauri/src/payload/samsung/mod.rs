//! Samsung Odin firmware (.tar / .tar.md5) extraction support.

pub mod tar_md5;

pub use tar_md5::{HashingReader, SamsungTarMd5Extractor, unpack_samsung_tar};
