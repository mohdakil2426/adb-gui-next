//! Cross-platform native sparse file IOCTL manager.
//!
//! Provides the [`SparseFileExt`] trait for [`std::fs::File`] to tag files as
//! sparse and punch holes (deallocating disk space for zero extents).
#![allow(unsafe_code)]

use std::io::Result;

/// Extension trait for [`File`] providing native sparse file capabilities.
pub trait SparseFileExt {
    /// Mark the file as sparse on supported filesystems (e.g., NTFS `FSCTL_SET_SPARSE`).
    ///
    /// On Linux, macOS, and other Unix systems, files with holes or unwritten extents
    /// are sparse by default, so this operation is a no-op returning `Ok(())`.
    fn mark_sparse(&self) -> Result<()>;

    /// Punch a hole in the file from `offset` for `length` bytes, deallocating
    /// backing storage blocks on supported sparse filesystems and ensuring
    /// subsequent reads return zeros.
    ///
    /// If `length == 0`, this operation is a no-op returning `Ok(())`.
    fn punch_hole(&self, offset: u64, length: u64) -> Result<()>;
}

#[cfg(windows)]
mod windows_impl {
    use super::SparseFileExt;
    use std::fs::File;
    use std::io::{Error, ErrorKind, Result};
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::System::IO::DeviceIoControl;
    use windows_sys::Win32::System::Ioctl::{
        FILE_SET_SPARSE_BUFFER, FILE_ZERO_DATA_INFORMATION, FSCTL_SET_SPARSE, FSCTL_SET_ZERO_DATA,
    };

    impl SparseFileExt for File {
        fn mark_sparse(&self) -> Result<()> {
            let handle = self.as_raw_handle() as HANDLE;
            let mut set_sparse_buf = FILE_SET_SPARSE_BUFFER { SetSparse: true };
            let mut bytes_returned = 0u32;

            let success = unsafe {
                DeviceIoControl(
                    handle,
                    FSCTL_SET_SPARSE,
                    &mut set_sparse_buf as *mut _ as *mut _,
                    std::mem::size_of::<FILE_SET_SPARSE_BUFFER>() as u32,
                    std::ptr::null_mut(),
                    0,
                    &mut bytes_returned,
                    std::ptr::null_mut(),
                )
            };

            if success == 0 { Err(Error::last_os_error()) } else { Ok(()) }
        }

        fn punch_hole(&self, offset: u64, length: u64) -> Result<()> {
            if length == 0 {
                return Ok(());
            }

            let beyond_final_zero = offset.checked_add(length).ok_or_else(|| {
                Error::new(ErrorKind::InvalidInput, "offset + length overflowed u64")
            })?;

            let handle = self.as_raw_handle() as HANDLE;
            let zero_data = FILE_ZERO_DATA_INFORMATION {
                FileOffset: offset as i64,
                BeyondFinalZero: beyond_final_zero as i64,
            };
            let mut bytes_returned = 0u32;

            let success = unsafe {
                DeviceIoControl(
                    handle,
                    FSCTL_SET_ZERO_DATA,
                    &zero_data as *const _ as *const _,
                    std::mem::size_of::<FILE_ZERO_DATA_INFORMATION>() as u32,
                    std::ptr::null_mut(),
                    0,
                    &mut bytes_returned,
                    std::ptr::null_mut(),
                )
            };

            if success == 0 { Err(Error::last_os_error()) } else { Ok(()) }
        }
    }
}

#[cfg(target_os = "linux")]
mod linux_impl {
    use super::SparseFileExt;
    use std::fs::File;
    use std::io::{Error, Result};
    use std::os::unix::io::AsRawFd;

    impl SparseFileExt for File {
        fn mark_sparse(&self) -> Result<()> {
            // Linux filesystems (ext4, btrfs, xfs) create sparse extents implicitly.
            Ok(())
        }

        fn punch_hole(&self, offset: u64, length: u64) -> Result<()> {
            if length == 0 {
                return Ok(());
            }

            let fd = self.as_raw_fd();
            let ret = unsafe {
                libc::fallocate(
                    fd,
                    libc::FALLOC_FL_PUNCH_HOLE | libc::FALLOC_FL_KEEP_SIZE,
                    offset as libc::off_t,
                    length as libc::off_t,
                )
            };

            if ret != 0 { Err(Error::last_os_error()) } else { Ok(()) }
        }
    }
}

#[cfg(target_os = "macos")]
mod macos_impl {
    use super::SparseFileExt;
    use std::fs::File;
    use std::io::{Error, Result};
    use std::os::unix::io::AsRawFd;

    #[repr(C)]
    struct Fpunchhole {
        fp_flags: u32,
        reserved: u32,
        fp_offset: libc::off_t,
        fp_length: libc::off_t,
    }

    // F_PUNCHHOLE is 99 on macOS Darwin sys/fcntl.h
    const F_PUNCHHOLE: libc::c_int = 99;

    impl SparseFileExt for File {
        fn mark_sparse(&self) -> Result<()> {
            // macOS APFS creates sparse extents implicitly.
            Ok(())
        }

        fn punch_hole(&self, offset: u64, length: u64) -> Result<()> {
            if length == 0 {
                return Ok(());
            }

            let punchhole = Fpunchhole {
                fp_flags: 0,
                reserved: 0,
                fp_offset: offset as libc::off_t,
                fp_length: length as libc::off_t,
            };

            let fd = self.as_raw_fd();
            let ret = unsafe { libc::fcntl(fd, F_PUNCHHOLE, &punchhole) };

            if ret < 0 { Err(Error::last_os_error()) } else { Ok(()) }
        }
    }
}

#[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
mod fallback_impl {
    use super::SparseFileExt;
    use std::fs::File;
    use std::io::Result;

    impl SparseFileExt for File {
        fn mark_sparse(&self) -> Result<()> {
            Ok(())
        }

        fn punch_hole(&self, _offset: u64, _length: u64) -> Result<()> {
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Seek, SeekFrom, Write};
    use tempfile::NamedTempFile;

    #[test]
    fn test_mark_sparse_and_punch_hole() {
        let mut temp = NamedTempFile::new().expect("create temp file");
        let file = temp.as_file_mut();

        // 1. Mark sparse
        let res = file.mark_sparse();
        assert!(res.is_ok(), "mark_sparse should succeed: {:?}", res);

        // 2. Write 256 KiB of 0xAA pattern
        let total_size: usize = 256 * 1024;
        let original_data = vec![0xAAu8; total_size];
        file.write_all(&original_data).expect("write initial data");
        file.flush().expect("flush");

        // 3. Punch hole in the middle (from 64 KiB to 192 KiB = 128 KiB hole)
        let hole_offset: u64 = 64 * 1024;
        let hole_length: u64 = 128 * 1024;
        let punch_res = file.punch_hole(hole_offset, hole_length);
        assert!(punch_res.is_ok(), "punch_hole should succeed: {:?}", punch_res);

        // 4. Verify contents:
        // [0..64KiB] == 0xAA
        // [64KiB..192KiB] == 0x00
        // [192KiB..256KiB] == 0xAA
        file.seek(SeekFrom::Start(0)).expect("seek to start");
        let mut read_back = vec![0u8; total_size];
        file.read_exact(&mut read_back).expect("read exact data");

        let prefix = &read_back[..hole_offset as usize];
        let hole = &read_back[hole_offset as usize..(hole_offset + hole_length) as usize];
        let suffix = &read_back[(hole_offset + hole_length) as usize..];

        assert!(prefix.iter().all(|&b| b == 0xAA), "prefix before hole should remain 0xAA");
        assert!(hole.iter().all(|&b| b == 0x00), "punched hole range should read as 0x00");
        assert!(suffix.iter().all(|&b| b == 0xAA), "suffix after hole should remain 0xAA");
    }

    #[test]
    fn test_punch_hole_zero_length() {
        let mut temp = NamedTempFile::new().expect("create temp file");
        let file = temp.as_file_mut();
        file.mark_sparse().expect("mark sparse");
        // Zero length should be a no-op Ok(())
        let res = file.punch_hole(1024, 0);
        assert!(res.is_ok());
    }
}
