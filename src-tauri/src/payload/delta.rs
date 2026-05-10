use anyhow::{Context, Result};
use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Seek, Write};
use std::path::Path;

#[allow(dead_code)]
pub fn source_copy(source_path: &Path, dest_path: &Path, offset: u64, length: u64) -> Result<u64> {
    let mut source = BufReader::new(File::open(source_path)?);
    source.seek(std::io::SeekFrom::Start(offset))?;
    let mut dest = BufWriter::new(File::create(dest_path)?);
    let mut remaining = length;
    let mut buf = [0u8; 65536];
    while remaining > 0 {
        let to_read = (remaining as usize).min(buf.len());
        let n = source.read(&mut buf[..to_read]).context("Failed to read source")?;
        if n == 0 {
            break;
        }
        dest.write_all(&buf[..n]).context("Failed to write dest")?;
        remaining -= n as u64;
    }
    dest.flush()?;
    Ok(length - remaining)
}
