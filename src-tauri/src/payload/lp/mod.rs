//! Complete AOSP Logical Partition (liblp) Dynamic Partition Metadata Parser & Extractor.
//!
//! Canonical references: AOSP `system/core/fs_mgr/liblp/include/liblp/metadata_format.h`
//! and `system/core/fs_mgr/liblp/utility/lpunpack.cc`.

use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::Path;

use anyhow::{Context, Result, anyhow, bail};
use byteorder::{LittleEndian, ReadBytesExt};
use sha2::{Digest, Sha256};

pub const LP_METADATA_GEOMETRY_MAGIC: u32 = 0x616c_4467;
pub const LP_METADATA_HEADER_MAGIC: u32 = 0x414c_5030;
pub const LP_METADATA_GEOMETRY_SIZE: usize = 4096;
pub const LP_SECTOR_SIZE: u64 = 512;
pub const LP_TARGET_TYPE_LINEAR: u32 = 0;
pub const LP_TARGET_TYPE_ZERO: u32 = 1;

pub const LP_PARTITION_ATTR_NONE: u32 = 0x0;
pub const LP_PARTITION_ATTR_READONLY: u32 = 0x1;
pub const LP_PARTITION_ATTR_SLOT_UPDATED: u32 = 0x2;
pub const LP_PARTITION_ATTR_UPDATED: u32 = 0x4;
pub const LP_PARTITION_ATTR_DISABLED: u32 = 0x8;

#[repr(C, packed)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LpMetadataGeometry {
    pub magic: u32,
    pub struct_size: u32,
    pub checksum: [u8; 32],
    pub metadata_max_size: u32,
    pub metadata_slot_count: u32,
    pub logical_block_size: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LpMetadataTableDescriptor {
    pub offset: u32,
    pub num_entries: u32,
    pub entry_size: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LpMetadataHeader {
    pub magic: u32,
    pub major_version: u16,
    pub minor_version: u16,
    pub header_size: u32,
    pub header_checksum: [u8; 32],
    pub tables_size: u32,
    pub tables_checksum: [u8; 32],
    pub partitions: LpMetadataTableDescriptor,
    pub extents: LpMetadataTableDescriptor,
    pub groups: LpMetadataTableDescriptor,
    pub block_devices: LpMetadataTableDescriptor,
    pub flags: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LpMetadataPartition {
    pub name: String,
    pub attributes: u32,
    pub first_extent_index: u32,
    pub num_extents: u32,
    pub group_index: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LpMetadataExtent {
    pub num_sectors: u64,
    pub target_type: u32,
    pub target_data: u64,
    pub target_source: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LpMetadataGroup {
    pub name: String,
    pub flags: u32,
    pub maximum_size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LpMetadataBlockDevice {
    pub first_logical_sector: u64,
    pub alignment: u32,
    pub alignment_offset: u32,
    pub size: u64,
    pub partition_name: String,
    pub flags: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LpMetadata {
    pub geometry: LpMetadataGeometry,
    pub header: LpMetadataHeader,
    pub partitions: Vec<LpMetadataPartition>,
    pub extents: Vec<LpMetadataExtent>,
    pub groups: Vec<LpMetadataGroup>,
    pub block_devices: Vec<LpMetadataBlockDevice>,
}

impl LpMetadata {
    /// Parse LP metadata from a stream reader.
    /// Validates both geometry and metadata header/table SHA-256 checksums.
    pub fn parse<R: Read + Seek>(reader: &mut R) -> Result<Self> {
        let geometry = Self::parse_geometry(reader)?;

        let mut last_err = None;
        for slot in 0..geometry.metadata_slot_count.max(1) {
            match Self::parse_slot(reader, &geometry, slot) {
                Ok(metadata) => return Ok(metadata),
                Err(e) => last_err = Some(e),
            }
        }

        Err(last_err.unwrap_or_else(|| anyhow!("Failed to parse LP metadata from any slot")))
    }

    fn parse_geometry<R: Read + Seek>(reader: &mut R) -> Result<LpMetadataGeometry> {
        let mut geom_buf = [0u8; LP_METADATA_GEOMETRY_SIZE];

        // Try primary geometry at offset 0
        reader.seek(SeekFrom::Start(0))?;
        reader.read_exact(&mut geom_buf)?;

        let check_sparse = u32::from_le_bytes(geom_buf[0..4].try_into().unwrap_or([0; 4]));
        if check_sparse == 0xED26_FF3A {
            bail!(
                "Image is an Android sparse image (0xED26FF3A); unsparse before extracting LP metadata"
            );
        }

        match Self::validate_and_build_geometry(&geom_buf) {
            Ok(geom) => Ok(geom),
            Err(primary_err) => {
                // Try backup geometry at offset LP_METADATA_GEOMETRY_SIZE (4096)
                reader.seek(SeekFrom::Start(LP_METADATA_GEOMETRY_SIZE as u64))?;
                if reader.read_exact(&mut geom_buf).is_ok() {
                    if let Ok(geom) = Self::validate_and_build_geometry(&geom_buf) {
                        return Ok(geom);
                    }
                }
                Err(primary_err)
            }
        }
    }

    fn validate_and_build_geometry(
        buf: &[u8; LP_METADATA_GEOMETRY_SIZE],
    ) -> Result<LpMetadataGeometry> {
        let magic = (&buf[0..4]).read_u32::<LittleEndian>()?;
        if magic != LP_METADATA_GEOMETRY_MAGIC {
            bail!(
                "Invalid LpMetadataGeometry magic: {:#010X} (expected {:#010X})",
                magic,
                LP_METADATA_GEOMETRY_MAGIC
            );
        }

        let struct_size = (&buf[4..8]).read_u32::<LittleEndian>()?;
        if struct_size < 52 || (struct_size as usize) > LP_METADATA_GEOMETRY_SIZE {
            bail!("Invalid LpMetadataGeometry struct_size: {}", struct_size);
        }

        let mut checksum = [0u8; 32];
        checksum.copy_from_slice(&buf[8..40]);

        let metadata_max_size = (&buf[40..44]).read_u32::<LittleEndian>()?;
        let metadata_slot_count = (&buf[44..48]).read_u32::<LittleEndian>()?;
        let logical_block_size = (&buf[48..52]).read_u32::<LittleEndian>()?;

        let mut check_buf = [0u8; LP_METADATA_GEOMETRY_SIZE];
        check_buf[..struct_size as usize].copy_from_slice(&buf[..struct_size as usize]);
        check_buf[8..40].fill(0);

        let calculated_geom_sha = Sha256::digest(&check_buf[..struct_size as usize]);
        if calculated_geom_sha.as_slice() != checksum {
            bail!("LpMetadataGeometry SHA-256 checksum mismatch");
        }

        Ok(LpMetadataGeometry {
            magic,
            struct_size,
            checksum,
            metadata_max_size,
            metadata_slot_count,
            logical_block_size,
        })
    }

    fn parse_slot<R: Read + Seek>(
        reader: &mut R,
        geometry: &LpMetadataGeometry,
        slot: u32,
    ) -> Result<Self> {
        let header_offset = (LP_METADATA_GEOMETRY_SIZE * 2) as u64
            + (slot as u64 * geometry.metadata_max_size as u64);

        reader.seek(SeekFrom::Start(header_offset))?;

        let mut header_preview = [0u8; 128];
        reader.read_exact(&mut header_preview)?;

        let header_magic = (&header_preview[0..4]).read_u32::<LittleEndian>()?;
        if header_magic != LP_METADATA_HEADER_MAGIC {
            bail!(
                "Invalid LpMetadataHeader magic in slot {}: {:#010X} (expected {:#010X})",
                slot,
                header_magic,
                LP_METADATA_HEADER_MAGIC
            );
        }

        let major_version = (&header_preview[4..6]).read_u16::<LittleEndian>()?;
        let minor_version = (&header_preview[6..8]).read_u16::<LittleEndian>()?;
        let header_size = (&header_preview[8..12]).read_u32::<LittleEndian>()?;

        if header_size < 128 || (header_size as usize) > LP_METADATA_GEOMETRY_SIZE {
            bail!("Invalid LpMetadataHeader header_size: {}", header_size);
        }

        let mut header_buf = vec![0u8; header_size as usize];
        reader.seek(SeekFrom::Start(header_offset))?;
        reader.read_exact(&mut header_buf)?;

        let mut header_checksum = [0u8; 32];
        header_checksum.copy_from_slice(&header_buf[12..44]);

        let tables_size = (&header_buf[44..48]).read_u32::<LittleEndian>()?;
        let mut tables_checksum = [0u8; 32];
        tables_checksum.copy_from_slice(&header_buf[48..80]);

        // Verify header SHA-256 checksum (computed with checksum field zeroed)
        let mut check_header = header_buf.clone();
        check_header[12..44].fill(0);
        let calculated_header_sha = Sha256::digest(&check_header);
        if calculated_header_sha.as_slice() != header_checksum {
            bail!("LpMetadataHeader SHA-256 checksum mismatch in slot {}", slot);
        }

        let partitions_desc = LpMetadataTableDescriptor {
            offset: (&header_buf[80..84]).read_u32::<LittleEndian>()?,
            num_entries: (&header_buf[84..88]).read_u32::<LittleEndian>()?,
            entry_size: (&header_buf[88..92]).read_u32::<LittleEndian>()?,
        };
        let extents_desc = LpMetadataTableDescriptor {
            offset: (&header_buf[92..96]).read_u32::<LittleEndian>()?,
            num_entries: (&header_buf[96..100]).read_u32::<LittleEndian>()?,
            entry_size: (&header_buf[100..104]).read_u32::<LittleEndian>()?,
        };
        let groups_desc = LpMetadataTableDescriptor {
            offset: (&header_buf[104..108]).read_u32::<LittleEndian>()?,
            num_entries: (&header_buf[108..112]).read_u32::<LittleEndian>()?,
            entry_size: (&header_buf[112..116]).read_u32::<LittleEndian>()?,
        };
        let block_devices_desc = LpMetadataTableDescriptor {
            offset: (&header_buf[116..120]).read_u32::<LittleEndian>()?,
            num_entries: (&header_buf[120..124]).read_u32::<LittleEndian>()?,
            entry_size: (&header_buf[124..128]).read_u32::<LittleEndian>()?,
        };

        let flags = if header_size >= 132 && minor_version >= 2 {
            (&header_buf[128..132]).read_u32::<LittleEndian>()?
        } else {
            0
        };

        let header = LpMetadataHeader {
            magic: header_magic,
            major_version,
            minor_version,
            header_size,
            header_checksum,
            tables_size,
            tables_checksum,
            partitions: partitions_desc,
            extents: extents_desc,
            groups: groups_desc,
            block_devices: block_devices_desc,
            flags,
        };

        let tables_start = header_offset + header.header_size as u64;
        let mut tables_buf = vec![0u8; header.tables_size as usize];
        reader.seek(SeekFrom::Start(tables_start))?;
        reader.read_exact(&mut tables_buf)?;

        let calc_tables_sha = Sha256::digest(&tables_buf);
        if calc_tables_sha.as_slice() != header.tables_checksum {
            bail!("LpMetadata tables SHA-256 checksum mismatch in slot {}", slot);
        }

        // Parse partitions
        let mut partitions = Vec::with_capacity(header.partitions.num_entries as usize);
        for i in 0..header.partitions.num_entries {
            let offset = (header.partitions.offset + i * header.partitions.entry_size) as usize;
            let end = offset + header.partitions.entry_size as usize;
            if end > tables_buf.len() {
                bail!("Partition table entry {} exceeds tables buffer", i);
            }
            let entry_bytes = &tables_buf[offset..end];
            let name_raw = &entry_bytes[0..36.min(entry_bytes.len())];
            let name_len = name_raw.iter().position(|&b| b == 0).unwrap_or(name_raw.len());
            let name = String::from_utf8_lossy(&name_raw[..name_len]).to_string();
            let attributes = (&entry_bytes[36..40]).read_u32::<LittleEndian>()?;
            let first_extent_index = (&entry_bytes[40..44]).read_u32::<LittleEndian>()?;
            let num_extents = (&entry_bytes[44..48]).read_u32::<LittleEndian>()?;
            let group_index = (&entry_bytes[48..52]).read_u32::<LittleEndian>()?;

            partitions.push(LpMetadataPartition {
                name,
                attributes,
                first_extent_index,
                num_extents,
                group_index,
            });
        }

        // Parse extents
        let mut extents = Vec::with_capacity(header.extents.num_entries as usize);
        for i in 0..header.extents.num_entries {
            let offset = (header.extents.offset + i * header.extents.entry_size) as usize;
            let end = offset + header.extents.entry_size as usize;
            if end > tables_buf.len() {
                bail!("Extent table entry {} exceeds tables buffer", i);
            }
            let entry_bytes = &tables_buf[offset..end];
            let num_sectors = (&entry_bytes[0..8]).read_u64::<LittleEndian>()?;
            let target_type = (&entry_bytes[8..12]).read_u32::<LittleEndian>()?;
            let target_data = (&entry_bytes[12..20]).read_u64::<LittleEndian>()?;
            let target_source = (&entry_bytes[20..24]).read_u32::<LittleEndian>()?;

            extents.push(LpMetadataExtent { num_sectors, target_type, target_data, target_source });
        }

        // Parse groups
        let mut groups = Vec::with_capacity(header.groups.num_entries as usize);
        for i in 0..header.groups.num_entries {
            let offset = (header.groups.offset + i * header.groups.entry_size) as usize;
            let end = offset + header.groups.entry_size as usize;
            if end <= tables_buf.len() {
                let entry_bytes = &tables_buf[offset..end];
                let name_raw = &entry_bytes[0..36.min(entry_bytes.len())];
                let name_len = name_raw.iter().position(|&b| b == 0).unwrap_or(name_raw.len());
                let name = String::from_utf8_lossy(&name_raw[..name_len]).to_string();
                let flags = if entry_bytes.len() >= 40 {
                    (&entry_bytes[36..40]).read_u32::<LittleEndian>()?
                } else {
                    0
                };
                let maximum_size = if entry_bytes.len() >= 48 {
                    (&entry_bytes[40..48]).read_u64::<LittleEndian>()?
                } else {
                    0
                };
                groups.push(LpMetadataGroup { name, flags, maximum_size });
            }
        }

        // Parse block devices
        let mut block_devices = Vec::with_capacity(header.block_devices.num_entries as usize);
        for i in 0..header.block_devices.num_entries {
            let offset =
                (header.block_devices.offset + i * header.block_devices.entry_size) as usize;
            let end = offset + header.block_devices.entry_size as usize;
            if end > tables_buf.len() {
                bail!("Block device entry {} exceeds tables buffer", i);
            }
            let entry_bytes = &tables_buf[offset..end];
            let first_logical_sector = (&entry_bytes[0..8]).read_u64::<LittleEndian>()?;
            let alignment = (&entry_bytes[8..12]).read_u32::<LittleEndian>()?;
            let alignment_offset = (&entry_bytes[12..16]).read_u32::<LittleEndian>()?;
            let size = (&entry_bytes[16..24]).read_u64::<LittleEndian>()?;
            let name_raw = &entry_bytes[24..60.min(entry_bytes.len())];
            let name_len = name_raw.iter().position(|&b| b == 0).unwrap_or(name_raw.len());
            let partition_name = String::from_utf8_lossy(&name_raw[..name_len]).to_string();
            let flags = if entry_bytes.len() >= 64 {
                (&entry_bytes[60..64]).read_u32::<LittleEndian>()?
            } else {
                0
            };

            block_devices.push(LpMetadataBlockDevice {
                first_logical_sector,
                alignment,
                alignment_offset,
                size,
                partition_name,
                flags,
            });
        }

        Ok(Self { geometry: *geometry, header, partitions, extents, groups, block_devices })
    }

    /// Extract a single logical partition by name into a writer.
    /// Handles both linear slice offsets and zero extents.
    /// Returns total bytes written.
    pub fn extract_partition<R: Read + Seek, W: Write>(
        &self,
        super_reader: &mut R,
        partition_name: &str,
        writer: &mut W,
    ) -> Result<u64> {
        let part =
            self.partitions.iter().find(|p| p.name == partition_name).ok_or_else(|| {
                anyhow!("Partition '{}' not found in super metadata", partition_name)
            })?;

        if part.num_extents == 0 {
            return Ok(0);
        }

        let start_idx = part.first_extent_index as usize;
        let end_idx = start_idx + part.num_extents as usize;

        if end_idx > self.extents.len() {
            bail!(
                "Partition '{}' extent range {}..{} out of bounds (total extents: {})",
                partition_name,
                start_idx,
                end_idx,
                self.extents.len()
            );
        }

        let mut total_bytes = 0u64;
        let mut buffer = vec![0u8; 1024 * 1024];

        for extent in &self.extents[start_idx..end_idx] {
            let extent_bytes = extent
                .num_sectors
                .checked_mul(LP_SECTOR_SIZE)
                .ok_or_else(|| anyhow!("Extent sector calculation overflow"))?;

            match extent.target_type {
                LP_TARGET_TYPE_LINEAR => {
                    let disk_offset = extent
                        .target_data
                        .checked_mul(LP_SECTOR_SIZE)
                        .ok_or_else(|| anyhow!("Target data sector calculation overflow"))?;

                    super_reader.seek(SeekFrom::Start(disk_offset))?;

                    let mut remaining = extent_bytes;
                    while remaining > 0 {
                        let to_read = (remaining as usize).min(buffer.len());
                        super_reader.read_exact(&mut buffer[..to_read])?;
                        writer.write_all(&buffer[..to_read])?;
                        remaining -= to_read as u64;
                    }
                }
                LP_TARGET_TYPE_ZERO => {
                    let mut remaining = extent_bytes;
                    buffer.fill(0);
                    while remaining > 0 {
                        let to_write = (remaining as usize).min(buffer.len());
                        writer.write_all(&buffer[..to_write])?;
                        remaining -= to_write as u64;
                    }
                }
                other => bail!("Unsupported lp extent target type: {}", other),
            }
            total_bytes += extent_bytes;
        }

        writer.flush()?;
        Ok(total_bytes)
    }

    /// Extract all active (non-disabled) logical partitions to `.img` files in `output_dir`.
    /// Returns vector of `(partition_name, bytes_written)` tuples.
    pub fn extract_all<R: Read + Seek>(
        &self,
        super_reader: &mut R,
        output_dir: &Path,
    ) -> Result<Vec<(String, u64)>> {
        fs::create_dir_all(output_dir)?;
        let mut results = Vec::new();

        for part in &self.partitions {
            if part.num_extents == 0 || (part.attributes & LP_PARTITION_ATTR_DISABLED) != 0 {
                continue;
            }
            let out_file_path = output_dir.join(format!("{}.img", part.name));
            let mut out_file = BufWriter::new(File::create(&out_file_path).with_context(|| {
                format!("Failed to create output file {}", out_file_path.display())
            })?);
            let written = self.extract_partition(super_reader, &part.name, &mut out_file)?;
            results.push((part.name.clone(), written));
        }

        Ok(results)
    }
}

/// Unpack all logical partitions from a monolithic `super.img` into `output_dir`.
pub fn unpack_super_image(super_path: &Path, output_dir: &Path) -> Result<Vec<(String, u64)>> {
    let mut file = BufReader::new(
        File::open(super_path)
            .with_context(|| format!("Failed to open super image at {}", super_path.display()))?,
    );
    let metadata = LpMetadata::parse(&mut file)?;
    metadata.extract_all(&mut file, output_dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    use byteorder::WriteBytesExt;
    use std::io::Cursor;

    #[test]
    fn test_struct_sizes() {
        assert_eq!(std::mem::size_of::<LpMetadataGeometry>(), 52);
        assert_eq!(std::mem::size_of::<LpMetadataExtent>(), 24);
    }

    #[test]
    fn test_lp_metadata_parse_and_extract() {
        // Construct a synthetic super image in memory
        let mut image_data = vec![0u8; 1024 * 1024]; // 1 MiB container

        // 1. Geometry (offset 0..4096)
        let geom_struct_size = 52u32;
        let metadata_max_size = 65536u32;
        let metadata_slot_count = 2u32;
        let logical_block_size = 4096u32;

        let mut geom_raw = [0u8; LP_METADATA_GEOMETRY_SIZE];
        (&mut geom_raw[0..4]).write_u32::<LittleEndian>(LP_METADATA_GEOMETRY_MAGIC).unwrap();
        (&mut geom_raw[4..8]).write_u32::<LittleEndian>(geom_struct_size).unwrap();
        // Checksum at 8..40 remains 0 for hash calculation
        (&mut geom_raw[40..44]).write_u32::<LittleEndian>(metadata_max_size).unwrap();
        (&mut geom_raw[44..48]).write_u32::<LittleEndian>(metadata_slot_count).unwrap();
        (&mut geom_raw[48..52]).write_u32::<LittleEndian>(logical_block_size).unwrap();

        let geom_hash = Sha256::digest(&geom_raw[..geom_struct_size as usize]);
        geom_raw[8..40].copy_from_slice(&geom_hash);
        image_data[0..LP_METADATA_GEOMETRY_SIZE].copy_from_slice(&geom_raw);

        // 2. Tables buffer
        let mut tables_buf = Vec::new();

        // Partition 0: system (1 extent, linear)
        let mut p0 = vec![0u8; 52];
        p0[..6].copy_from_slice(b"system");
        (&mut p0[36..40]).write_u32::<LittleEndian>(LP_PARTITION_ATTR_READONLY).unwrap();
        (&mut p0[40..44]).write_u32::<LittleEndian>(0).unwrap(); // first extent = 0
        (&mut p0[44..48]).write_u32::<LittleEndian>(1).unwrap(); // num extents = 1
        (&mut p0[48..52]).write_u32::<LittleEndian>(0).unwrap(); // group = 0
        tables_buf.extend_from_slice(&p0);

        // Partition 1: vendor (1 extent, zero)
        let mut p1 = vec![0u8; 52];
        p1[..6].copy_from_slice(b"vendor");
        (&mut p1[36..40]).write_u32::<LittleEndian>(LP_PARTITION_ATTR_READONLY).unwrap();
        (&mut p1[40..44]).write_u32::<LittleEndian>(1).unwrap(); // first extent = 1
        (&mut p1[44..48]).write_u32::<LittleEndian>(1).unwrap(); // num extents = 1
        (&mut p1[48..52]).write_u32::<LittleEndian>(0).unwrap(); // group = 0
        tables_buf.extend_from_slice(&p1);

        let partitions_offset = 0u32;
        let partitions_num = 2u32;
        let partitions_entry_sz = 52u32;

        // Extents:
        let extents_offset = tables_buf.len() as u32;
        // Extent 0 for system: linear, 8 sectors (4096 bytes) at sector 256 (offset 131072)
        let mut e0 = vec![0u8; 24];
        (&mut e0[0..8]).write_u64::<LittleEndian>(8).unwrap(); // 8 sectors = 4096 bytes
        (&mut e0[8..12]).write_u32::<LittleEndian>(LP_TARGET_TYPE_LINEAR).unwrap();
        (&mut e0[12..20]).write_u64::<LittleEndian>(256).unwrap(); // sector 256
        (&mut e0[20..24]).write_u32::<LittleEndian>(0).unwrap(); // target source 0
        tables_buf.extend_from_slice(&e0);

        // Extent 1 for vendor: zero, 4 sectors (2048 bytes)
        let mut e1 = vec![0u8; 24];
        (&mut e1[0..8]).write_u64::<LittleEndian>(4).unwrap(); // 4 sectors = 2048 bytes
        (&mut e1[8..12]).write_u32::<LittleEndian>(LP_TARGET_TYPE_ZERO).unwrap();
        (&mut e1[12..20]).write_u64::<LittleEndian>(0).unwrap();
        (&mut e1[20..24]).write_u32::<LittleEndian>(0).unwrap();
        tables_buf.extend_from_slice(&e1);

        let extents_num = 2u32;
        let extents_entry_sz = 24u32;

        // Groups:
        let groups_offset = tables_buf.len() as u32;
        let mut g0 = vec![0u8; 48];
        g0[..7].copy_from_slice(b"default");
        (&mut g0[36..40]).write_u32::<LittleEndian>(0).unwrap();
        (&mut g0[40..48]).write_u64::<LittleEndian>(1024 * 1024).unwrap();
        tables_buf.extend_from_slice(&g0);

        let groups_num = 1u32;
        let groups_entry_sz = 48u32;

        // Block devices:
        let block_devices_offset = tables_buf.len() as u32;
        let mut b0 = vec![0u8; 64];
        (&mut b0[0..8]).write_u64::<LittleEndian>(2048).unwrap();
        (&mut b0[8..12]).write_u32::<LittleEndian>(4096).unwrap();
        (&mut b0[12..16]).write_u32::<LittleEndian>(0).unwrap();
        (&mut b0[16..24]).write_u64::<LittleEndian>(1024 * 1024).unwrap();
        b0[24..29].copy_from_slice(b"super");
        (&mut b0[60..64]).write_u32::<LittleEndian>(0).unwrap();
        tables_buf.extend_from_slice(&b0);

        let block_devices_num = 1u32;
        let block_devices_entry_sz = 64u32;

        let tables_checksum = Sha256::digest(&tables_buf);

        // 3. Header at slot 0 (offset 8192)
        let header_offset = (LP_METADATA_GEOMETRY_SIZE * 2) as usize;
        let header_size = 128u32;
        let mut header_raw = vec![0u8; header_size as usize];

        (&mut header_raw[0..4]).write_u32::<LittleEndian>(LP_METADATA_HEADER_MAGIC).unwrap();
        (&mut header_raw[4..6]).write_u16::<LittleEndian>(10).unwrap(); // major
        (&mut header_raw[6..8]).write_u16::<LittleEndian>(0).unwrap(); // minor
        (&mut header_raw[8..12]).write_u32::<LittleEndian>(header_size).unwrap();
        // header_checksum at 12..44 remains 0 for hash calculation
        (&mut header_raw[44..48]).write_u32::<LittleEndian>(tables_buf.len() as u32).unwrap();
        header_raw[48..80].copy_from_slice(&tables_checksum);

        // descriptors:
        (&mut header_raw[80..84]).write_u32::<LittleEndian>(partitions_offset).unwrap();
        (&mut header_raw[84..88]).write_u32::<LittleEndian>(partitions_num).unwrap();
        (&mut header_raw[88..92]).write_u32::<LittleEndian>(partitions_entry_sz).unwrap();

        (&mut header_raw[92..96]).write_u32::<LittleEndian>(extents_offset).unwrap();
        (&mut header_raw[96..100]).write_u32::<LittleEndian>(extents_num).unwrap();
        (&mut header_raw[100..104]).write_u32::<LittleEndian>(extents_entry_sz).unwrap();

        (&mut header_raw[104..108]).write_u32::<LittleEndian>(groups_offset).unwrap();
        (&mut header_raw[108..112]).write_u32::<LittleEndian>(groups_num).unwrap();
        (&mut header_raw[112..116]).write_u32::<LittleEndian>(groups_entry_sz).unwrap();

        (&mut header_raw[116..120]).write_u32::<LittleEndian>(block_devices_offset).unwrap();
        (&mut header_raw[120..124]).write_u32::<LittleEndian>(block_devices_num).unwrap();
        (&mut header_raw[124..128]).write_u32::<LittleEndian>(block_devices_entry_sz).unwrap();

        let header_hash = Sha256::digest(&header_raw);
        header_raw[12..44].copy_from_slice(&header_hash);

        // Copy header and tables into image_data
        image_data[header_offset..header_offset + header_size as usize]
            .copy_from_slice(&header_raw);
        let tables_start = header_offset + header_size as usize;
        image_data[tables_start..tables_start + tables_buf.len()].copy_from_slice(&tables_buf);

        // Write synthetic payload data at sector 256 (offset 256 * 512 = 131072)
        let disk_data_offset = 256 * 512;
        image_data[disk_data_offset..disk_data_offset + 4096].fill(0xAA);

        // Test parsing
        let mut cursor = Cursor::new(&image_data);
        let metadata = LpMetadata::parse(&mut cursor).expect("Failed to parse valid LpMetadata");

        assert_eq!(metadata.partitions.len(), 2);
        assert_eq!(metadata.partitions[0].name, "system");
        assert_eq!(metadata.partitions[1].name, "vendor");
        assert_eq!(metadata.extents.len(), 2);
        assert_eq!(metadata.groups.len(), 1);
        assert_eq!(metadata.groups[0].name, "default");
        assert_eq!(metadata.block_devices.len(), 1);
        assert_eq!(metadata.block_devices[0].partition_name, "super");

        // Test extraction
        let mut system_out = Vec::new();
        let written_sys = metadata
            .extract_partition(&mut cursor, "system", &mut system_out)
            .expect("Extract system partition failed");
        assert_eq!(written_sys, 4096);
        assert_eq!(system_out.len(), 4096);
        assert!(system_out.iter().all(|&b| b == 0xAA));

        let mut vendor_out = Vec::new();
        let written_ven = metadata
            .extract_partition(&mut cursor, "vendor", &mut vendor_out)
            .expect("Extract vendor partition failed");
        assert_eq!(written_ven, 2048);
        assert_eq!(vendor_out.len(), 2048);
        assert!(vendor_out.iter().all(|&b| b == 0));
    }

    #[test]
    fn test_corrupt_checksum_fails() {
        let mut geom_raw = [0u8; LP_METADATA_GEOMETRY_SIZE];
        (&mut geom_raw[0..4]).write_u32::<LittleEndian>(LP_METADATA_GEOMETRY_MAGIC).unwrap();
        (&mut geom_raw[4..8]).write_u32::<LittleEndian>(52).unwrap();
        // Bad checksum
        geom_raw[8..40].fill(0xFF);

        let mut cursor = Cursor::new(geom_raw);
        let res = LpMetadata::parse(&mut cursor);
        assert!(res.is_err());
    }

    #[test]
    fn test_sparse_magic_detected() {
        let mut sparse_raw = [0u8; 4096];
        (&mut sparse_raw[0..4]).write_u32::<LittleEndian>(0xED26_FF3A).unwrap();
        let mut cursor = Cursor::new(sparse_raw);
        let err = LpMetadata::parse(&mut cursor).unwrap_err();
        assert!(err.to_string().contains("Android sparse image"));
    }
}
