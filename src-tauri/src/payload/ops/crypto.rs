//! Cryptographic primitives for OPS and OFP decryption.
//!
//! - **OPS**: Custom S-box cipher (NOT standard AES). Ported from opscrypto.py.
//! - **OFP-QC**: Standard AES-128-CFB via RustCrypto crates.
//! - **OFP-MTK**: AES-128-CFB + nibble-swap obfuscation (mtk_shuffle).

use aes::Aes128;
use aes::cipher::AsyncStreamCipher;
use cfb_mode::cipher::KeyIvInit;
use md5::{Digest as Md5Digest, Md5};

type Aes128Cfb = cfb_mode::Decryptor<Aes128>;

// ─── OPS Custom Cipher ───────────────────────────────────────────────────────

/// Fixed 128-bit key used by all OPS variants: d1b5e39e5eea049d671dd5abd2afcbaf
/// In Python: key = unpack("<4I", bytes.fromhex("d1b5e39e5eea049d671dd5abd2afcbaf"))
const OPS_KEY: [u32; 4] = [0x9EE3_B5D1, 0x9D04_EA5E, 0xABD5_1D67, 0xAFCB_AFD2];

/// The 3 known mbox key schedule variants for OPS decryption.
#[derive(Debug, Clone, Copy)]
pub enum MboxVariant {
    /// guacamolet (OnePlus 7 era)
    Mbox4,
    /// guacamoles (OnePlus 7/7T era) — most common
    Mbox5,
    /// instantnoodlev (OnePlus 8/8T era)
    Mbox6,
}

impl MboxVariant {
    pub const ALL: [MboxVariant; 3] = [Self::Mbox5, Self::Mbox6, Self::Mbox4];

    pub fn label(&self) -> &'static str {
        match self {
            Self::Mbox4 => "mbox4",
            Self::Mbox5 => "mbox5",
            Self::Mbox6 => "mbox6",
        }
    }
}

/// Build the mbox array exactly like Python: a list of 62 byte-sized integers.
/// In Python: mbox5 = [0x60, 0x8a, 0x3f, ... 0x0a, 0x00]
/// key_update accesses asbox[i] as a single integer (not packed u32).
fn mbox_array(variant: MboxVariant) -> [u32; 62] {
    let mut buf = [0u32; 62];
    let prefix: [u8; 16] = match variant {
        MboxVariant::Mbox5 => [
            0x60, 0x8a, 0x3f, 0x2d, 0x68, 0x6b, 0xd4, 0x23, 0x51, 0x0c, 0xd0, 0x95, 0xbb, 0x40,
            0xe9, 0x76,
        ],
        MboxVariant::Mbox6 => [
            0xAA, 0x69, 0x82, 0x9E, 0x5D, 0xDE, 0xB1, 0x3D, 0x30, 0xBB, 0x81, 0xA3, 0x46, 0x65,
            0xa3, 0xe1,
        ],
        MboxVariant::Mbox4 => [
            0xC4, 0x5D, 0x05, 0x71, 0x99, 0xDD, 0xBB, 0xEE, 0x29, 0xA1, 0x6D, 0xC7, 0xAD, 0xBF,
            0xA4, 0x3F,
        ],
    };
    for (i, &b) in prefix.iter().enumerate() {
        buf[i] = b as u32;
    }
    // bytes 16..59 are all 0 (already initialized)
    buf[60] = 0x0a; // rounds indicator
    // buf[61] = 0x00 (already 0)
    buf
}

/// Convert the sbox bytes (2048 bytes) to a list of 256 u32 values,
/// matching Python's list-of-integers representation.
/// In Python: sbox is a bytes object, gsbox reads 4 bytes as LE u32.
/// key_update accesses sbox[i] as a byte-value integer when used as the
/// residual block "asbox".
fn sbox_as_u32_array() -> [u32; 2048] {
    let mut arr = [0u32; 2048];
    for (i, val) in arr.iter_mut().enumerate() {
        *val = SBOX[i] as u32;
    }
    arr
}

/// S-box table (2048 bytes) from opscrypto.py.
/// Each 8-byte entry is a pair of identical u32 LE values.
#[rustfmt::skip]
static SBOX: &[u8; 2048] = include_bytes!("sbox.bin");

/// Read a u32 from 4 bytes at the given offset in the raw SBOX bytes (little-endian).
/// This is how Python's `gsbox()` works: `int.from_bytes(sbox[offset:offset+4], 'little')`
fn gsbox(offset: usize) -> u32 {
    if offset + 4 > SBOX.len() {
        return 0;
    }
    u32::from_le_bytes(SBOX[offset..offset + 4].try_into().unwrap_or([0; 4]))
}

/// Port of Python `key_update(iv1, asbox)`.
///
/// In Python, `asbox` is a list of integers (byte values 0-255).
/// `asbox[0]` gives a single byte-value integer, NOT a packed u32.
/// So `iv1[0] ^ asbox[0]` is XOR of a u32 with a byte-range value.
fn key_update(iv1: [u32; 4], asbox: &[u32]) -> [u32; 4] {
    let d = iv1[0] ^ asbox[0];
    let a = iv1[1] ^ asbox[1];
    let b = iv1[2] ^ asbox[2];
    let c = iv1[3] ^ asbox[3];

    let mut e = gsbox(((b >> 0x10) & 0xff) as usize * 8 + 2)
        ^ gsbox(((a >> 8) & 0xff) as usize * 8 + 3)
        ^ gsbox((c >> 0x18) as usize * 8 + 1)
        ^ gsbox((d & 0xff) as usize * 8)
        ^ asbox[4];

    let mut h = gsbox(((c >> 0x10) & 0xff) as usize * 8 + 2)
        ^ gsbox(((b >> 8) & 0xff) as usize * 8 + 3)
        ^ gsbox((d >> 0x18) as usize * 8 + 1)
        ^ gsbox((a & 0xff) as usize * 8)
        ^ asbox[5];

    let mut i = gsbox(((d >> 0x10) & 0xff) as usize * 8 + 2)
        ^ gsbox(((c >> 8) & 0xff) as usize * 8 + 3)
        ^ gsbox((a >> 0x18) as usize * 8 + 1)
        ^ gsbox((b & 0xff) as usize * 8)
        ^ asbox[6];

    let mut a = gsbox(((d >> 8) & 0xff) as usize * 8 + 3)
        ^ gsbox(((a >> 0x10) & 0xff) as usize * 8 + 2)
        ^ gsbox((b >> 0x18) as usize * 8 + 1)
        ^ gsbox((c & 0xff) as usize * 8)
        ^ asbox[7];

    let mut g: usize = 8;
    let rounds = asbox[0x3c] as usize; // index 60

    if rounds >= 2 {
        for _ in 0..rounds - 2 {
            let d_val = e >> 0x18;
            let m = h >> 0x10;
            let s = h >> 0x18;
            let z = e >> 0x10;
            let l = i >> 0x18;
            let t = e >> 8;

            let new_e = gsbox(((i >> 0x10) & 0xff) as usize * 8 + 2)
                ^ gsbox(((h >> 8) & 0xff) as usize * 8 + 3)
                ^ gsbox((a >> 0x18) as usize * 8 + 1)
                ^ gsbox((e & 0xff) as usize * 8)
                ^ asbox[g];

            let new_h = gsbox(((a >> 0x10) & 0xff) as usize * 8 + 2)
                ^ gsbox(((i >> 8) & 0xff) as usize * 8 + 3)
                ^ gsbox((d_val & 0xff) as usize * 8 + 1)
                ^ gsbox((h & 0xff) as usize * 8)
                ^ asbox[g + 1];

            let new_i = gsbox((z & 0xff) as usize * 8 + 2)
                ^ gsbox(((a >> 8) & 0xff) as usize * 8 + 3)
                ^ gsbox((s & 0xff) as usize * 8 + 1)
                ^ gsbox((i & 0xff) as usize * 8)
                ^ asbox[g + 2];

            let new_a = gsbox((t & 0xff) as usize * 8 + 3)
                ^ gsbox((m & 0xff) as usize * 8 + 2)
                ^ gsbox((l & 0xff) as usize * 8 + 1)
                ^ gsbox((a & 0xff) as usize * 8)
                ^ asbox[g + 3];

            e = new_e;
            h = new_h;
            i = new_i;
            a = new_a;
            g += 4;
        }
    }

    // Final round — Python operator precedence is tricky here.
    // Line 346: `gsbox(...) & 0xFF ^ asbox[g]`
    // In Python: `& 0xFF` binds tighter than `^`, so:
    //   (gsbox(...) & 0xFF) ^ asbox[g]
    // But the WHOLE expression is also XOR'd with the earlier terms.
    // Python evaluation (left to right with precedence):
    //   `A ^ B ^ C ^ D & 0xFF ^ asbox[g]`
    //   = `A ^ B ^ C ^ (D & 0xFF) ^ asbox[g]`

    let r0 = (gsbox(((i >> 0x10) & 0xff) as usize * 8) & 0xff_0000)
        ^ (gsbox(((h >> 8) & 0xff) as usize * 8 + 1) & 0xff00)
        ^ (gsbox((a >> 0x18) as usize * 8 + 3) & 0xff00_0000)
        ^ (gsbox((e & 0xff) as usize * 8 + 2) & 0xFF)
        ^ asbox[g];

    let r1 = (gsbox(((a >> 0x10) & 0xff) as usize * 8) & 0xff_0000)
        ^ (gsbox(((i >> 8) & 0xff) as usize * 8 + 1) & 0xff00)
        ^ (gsbox((e >> 0x18) as usize * 8 + 3) & 0xff00_0000)
        ^ (gsbox((h & 0xff) as usize * 8 + 2) & 0xFF)
        ^ asbox[g + 3];

    let r2 = (gsbox(((e >> 0x10) & 0xff) as usize * 8) & 0xff_0000)
        ^ (gsbox(((a >> 8) & 0xff) as usize * 8 + 1) & 0xff00)
        ^ (gsbox((h >> 0x18) as usize * 8 + 3) & 0xff00_0000)
        ^ (gsbox((i & 0xff) as usize * 8 + 2) & 0xFF)
        ^ asbox[g + 2];

    let r3 = (gsbox(((h >> 0x10) & 0xff) as usize * 8) & 0xff_0000)
        ^ (gsbox(((e >> 8) & 0xff) as usize * 8 + 1) & 0xff00)
        ^ (gsbox((i >> 0x18) as usize * 8 + 3) & 0xff00_0000)
        ^ (gsbox((a & 0xff) as usize * 8 + 2) & 0xFF)
        ^ asbox[g + 1];

    [r0, r1, r2, r3]
}

/// Port of Python `key_custom(inp, rkey, outlength=0, encrypt=False)` — decrypt mode.
///
/// This is the main OPS decryption routine. It processes the input in 16-byte blocks,
/// applying `key_update` with the global `mbox` array to evolve the key schedule.
pub fn ops_decrypt(inp: &[u8], variant: MboxVariant) -> Vec<u8> {
    let mbox = mbox_array(variant);
    let mut rkey = OPS_KEY;

    let mut outp = Vec::with_capacity(inp.len());
    let length = inp.len();
    let pos: usize = 0; // outlength=0, so pos starts at 0
    let mut ptr = 0;
    let mut remaining = length;

    // Main loop: process 16-byte blocks
    // Python: if length > 0xF: for ptr in range(0, length, 0x10):
    if remaining > 0xF {
        let block_count = remaining / 0x10;
        for block in 0..block_count {
            ptr = block * 0x10;
            rkey = key_update(rkey, &mbox);

            if pos < 0x10 {
                let slen = ((0xf - pos) >> 2) + 1; // = 4 when pos=0
                for (j, rkey_slot) in rkey.iter_mut().enumerate().take(slen) {
                    let offset = pos + j * 4 + ptr;
                    if offset + 4 <= inp.len() {
                        let inp_word = u32::from_le_bytes(
                            inp[offset..offset + 4].try_into().unwrap_or([0; 4]),
                        );
                        let dec = *rkey_slot ^ inp_word;
                        outp.extend_from_slice(&dec.to_le_bytes());
                        // In decrypt mode: rkey = input words (not decrypted)
                        *rkey_slot = inp_word;
                    }
                }
            }
            remaining -= 0x10;
        }
        ptr += 0x10; // advance past the last block
    }

    // Residual bytes (< 16 bytes remaining)
    // Python: if length != 0: rkey = key_update(rkey, sbox)
    if remaining != 0 {
        let sbox_arr = sbox_as_u32_array();
        rkey = key_update(rkey, &sbox_arr);
        let mut j = pos;
        let mut m = 0;
        let mut rem = remaining as isize;
        while rem > 0 {
            let offset = j + ptr;
            let mut data_bytes = [0u8; 4];
            let copy_len = (inp.len() - offset).min(4);
            if copy_len > 0 {
                data_bytes[..copy_len].copy_from_slice(&inp[offset..offset + copy_len]);
            }
            let tmp = u32::from_le_bytes(data_bytes);
            let dec = tmp ^ rkey[m];
            let dec_bytes = dec.to_le_bytes();
            let out_len = (rem as usize).min(4);
            outp.extend_from_slice(&dec_bytes[..out_len]);
            // In decrypt mode: rkey[m] = input word
            rkey[m] = tmp;
            rem -= 4;
            j += 4;
            m += 1;
        }
    }

    outp
}

/// Try to decrypt the OPS XML manifest with a given mbox variant.
/// Returns `Some(xml_string)` if the decrypted data contains valid XML.
pub fn try_decrypt_ops_xml(data: &[u8], variant: MboxVariant) -> Option<String> {
    let decrypted = ops_decrypt(data, variant);

    // Python check: `if b"xml " not in outp: return None`
    // Only check the first 256 bytes for the XML marker to avoid
    // false negatives from invalid UTF-8 in the padding region.
    let check_len = decrypted.len().min(256);
    let header = &decrypted[..check_len];

    // Check raw bytes for "xml " pattern (handles BOM + encoding variations)
    if header.windows(4).any(|w| w == b"xml ") {
        // Return the full decrypted buffer as lossy UTF-8
        // (padding bytes after actual XML will be trimmed by the caller)
        return Some(String::from_utf8_lossy(&decrypted).into_owned());
    }

    None
}

// ─── OFP AES-CFB Cipher ─────────────────────────────────────────────────────

/// OFP Qualcomm AES-128-CFB cipher.
#[derive(Debug, Clone)]
pub struct OfpCipher {
    pub key: [u8; 16],
    pub iv: [u8; 16],
}

impl OfpCipher {
    pub fn decrypt(&self, data: &[u8]) -> Vec<u8> {
        let mut buf = data.to_vec();
        let cipher = Aes128Cfb::new(&self.key.into(), &self.iv.into());
        cipher.decrypt(&mut buf);
        buf
    }
}

/// Rotate left by n bits in an 8-bit value.
fn rol8(x: u8, n: u32) -> u8 {
    x.rotate_left(n)
}

/// Swap nibbles: ((ch & 0xF) << 4) + ((ch & 0xF0) >> 4)
fn swap_nibble(ch: u8) -> u8 {
    ((ch & 0xF) << 4) | ((ch & 0xF0) >> 4)
}

/// OFP-QC key shuffle: swap(hkey[i] ^ key[i]) for each byte.
fn keyshuffle(key: &mut [u8; 16], hkey: &[u8; 16]) {
    for i in (0..16).step_by(4) {
        key[i] = swap_nibble(hkey[i] ^ key[i]);
        key[i + 1] = swap_nibble(hkey[i + 1] ^ key[i + 1]);
        key[i + 2] = swap_nibble(hkey[i + 2] ^ key[i + 2]);
        key[i + 3] = swap_nibble(hkey[i + 3] ^ key[i + 3]);
    }
}

/// Deobfuscate OFP-QC key data: ROL(data[i] ^ mask[i], 4, 8).
fn deobfuscate(data: &[u8; 16], mask: &[u8; 16]) -> Vec<u8> {
    data.iter().zip(mask.iter()).map(|(&d, &m)| rol8(d ^ m, 4)).collect()
}

/// Known OFP-QC key triplets: [mask, encrypted_key, encrypted_iv].
const OFP_QC_KEYS: &[[[u8; 16]; 3]] = &[
    // V1.6.6/1.6.9/1.6.17/1.6.24/1.6.26/1.7.6
    [
        hex16("3C2D518D9BF2E4279DC758CD535147C3"),
        hex16("87C74A29709AC1BF2382276C4E8DF232"),
        hex16("598D92E967265E9BCABE2469FE4A915E"),
    ],
    // V1.7.2
    [
        hex16("8FB8FB261930260BE945B841AEFA9FD4"),
        hex16("E529E82B28F5A2F8831D860AE39E425D"),
        hex16("8A09DA60ED36F125D64709973372C1CF"),
    ],
    // V1.4.17/1.4.27
    [
        hex16("27827963787265EF89D126B69A495A21"),
        hex16("82C50203285A2CE7D8C3E198383CE94C"),
        hex16("422DD5399181E223813CD8ECDF2E4D72"),
    ],
    // V1.6.17 (a3s)
    [
        hex16("E11AA7BB558A436A8375FD15DDD4651F"),
        hex16("77DDF6A0696841F6B74782C097835169"),
        hex16("A739742384A44E8BA45207AD5C3700EA"),
    ],
    // V1.5.13
    [
        hex16("67657963787565E837D226B69A495D21"),
        hex16("F6C50203515A2CE7D8C3E1F938B7E94C"),
        hex16("42F2D5399137E2B2813CD8ECDF2F4D72"),
    ],
    // V2.0.3
    [
        hex16("E8AE288C0192C54BF10C5707E9C4705B"),
        hex16("D64FC385DCD52A3C9B5FBA8650F92EDA"),
        hex16("79051FD8D8B6297E2E4559E997F63B7F"),
    ],
];

/// Derive an OFP-QC cipher from a key triplet.
fn derive_ofp_qc_cipher(triplet: &[[u8; 16]; 3]) -> OfpCipher {
    let mc = triplet[0];
    let userkey = triplet[1];
    let ivec = triplet[2];

    let deob_key = deobfuscate(&userkey, &mc);
    let deob_iv = deobfuscate(&ivec, &mc);

    let key_md5 = md5_hex(&deob_key);
    let iv_md5 = md5_hex(&deob_iv);

    let mut key = [0u8; 16];
    let mut iv = [0u8; 16];
    key.copy_from_slice(&key_md5.as_bytes()[..16]);
    iv.copy_from_slice(&iv_md5.as_bytes()[..16]);

    OfpCipher { key, iv }
}

/// Try all known OFP-QC key sets against data. Returns cipher if XML decrypts.
pub fn try_ofp_qc_keys(encrypted_xml: &[u8]) -> Option<(OfpCipher, Vec<u8>)> {
    // Also try the V1 key generation method
    let v1_cipher = {
        let key1 = hex16("42F2D5399137E2B2813CD8ECDF2F4D72");
        let key2_orig = hex16("F6C50203515A2CE7D8C3E1F938B7E94C");
        let key3 = hex16("67657963787565E837D226B69A495D21");
        let mut key2 = key2_orig;
        keyshuffle(&mut key2, &key3);
        let aeskey_md5 = md5_hex(&key2);
        let mut key1_mut = key1;
        keyshuffle(&mut key1_mut, &key3);
        let iv_md5 = md5_hex(&key1_mut);

        let mut key = [0u8; 16];
        let mut iv = [0u8; 16];
        key.copy_from_slice(&aeskey_md5.as_bytes()[..16]);
        iv.copy_from_slice(&iv_md5.as_bytes()[..16]);
        OfpCipher { key, iv }
    };

    // Try V1 first, then all V2 key sets
    let all_ciphers: Vec<OfpCipher> =
        std::iter::once(v1_cipher).chain(OFP_QC_KEYS.iter().map(derive_ofp_qc_cipher)).collect();

    for cipher in all_ciphers {
        let dec = cipher.decrypt(encrypted_xml);
        if dec.starts_with(b"<?xml") {
            return Some((cipher, dec));
        }
    }
    None
}

// ─── OFP-MTK Cipher ─────────────────────────────────────────────────────────

/// MTK shuffle: nibble swap then XOR with key.
pub fn mtk_shuffle(key: &[u8], data: &mut [u8]) {
    for (i, byte) in data.iter_mut().enumerate() {
        let k = key[i % key.len()];
        *byte = k ^ swap_nibble(*byte);
    }
}

/// MTK shuffle variant 2: XOR then nibble swap.
pub fn mtk_shuffle2(key: &[u8], data: &mut [u8]) {
    for (i, byte) in data.iter_mut().enumerate() {
        let tmp = key[i % key.len()] ^ *byte;
        *byte = swap_nibble(tmp);
    }
}

/// Known OFP-MTK key tables.
/// Each entry is either [mask, key, iv] (3 items) or [key, iv] (2 items).
const OFP_MTK_KEYS: &[&[&str]] = &[
    &[
        "67657963787565E837D226B69A495D21",
        "F6C50203515A2CE7D8C3E1F938B7E94C",
        "42F2D5399137E2B2813CD8ECDF2F4D72",
    ],
    &[
        "9E4F32639D21357D37D226B69A495D21",
        "A3D8D358E42F5A9E931DD3917D9A3218",
        "386935399137416B67416BECF22F519A",
    ],
    &[
        "892D57E92A4D8A975E3C216B7C9DE189",
        "D26DF2D9913785B145D18C7219B89F26",
        "516989E4A1BFC78B365C6BC57D944391",
    ],
    &[
        "27827963787265EF89D126B69A495A21",
        "82C50203285A2CE7D8C3E198383CE94C",
        "422DD5399181E223813CD8ECDF2E4D72",
    ],
    &[
        "3C4A618D9BF2E4279DC758CD535147C3",
        "87B13D29709AC1BF2382276C4E8DF232",
        "59B7A8E967265E9BCABE2469FE4A915E",
    ],
    &[
        "1C3288822BF824259DC852C1733127D3",
        "E7918D22799181CF2312176C9E2DF298",
        "3247F889A7B6DECBCA3E28693E4AAAFE",
    ],
    &[
        "1E4F32239D65A57D37D2266D9A775D43",
        "A332D3C3E42F5A3E931DD991729A321D",
        "3F2A35399A373377674155ECF28FD19A",
    ],
    &[
        "122D57E92A518AFF5E3C786B7C34E189",
        "DD6DF2D9543785674522717219989FB0",
        "12698965A132C76136CC88C5DD94EE91",
    ],
    &["ab3f76d7989207f2", "2bf515b3a9737835"],
];

/// Try to brute-force MTK AES key from the first 16 bytes.
pub fn try_ofp_mtk_keys(first_16: &[u8]) -> Option<OfpCipher> {
    for keyset in OFP_MTK_KEYS {
        let (aeskey, aesiv) = if keyset.len() == 3 {
            let obskey = hex_decode(keyset[0]);
            let mut enckey = hex_decode(keyset[1]);
            let mut enciv = hex_decode(keyset[2]);
            mtk_shuffle2(&obskey, &mut enckey);
            mtk_shuffle2(&obskey, &mut enciv);
            let key_hex = md5_hex(&enckey);
            let iv_hex = md5_hex(&enciv);
            (key_hex.as_bytes()[..16].to_vec(), iv_hex.as_bytes()[..16].to_vec())
        } else {
            (keyset[0].as_bytes().to_vec(), keyset[1].as_bytes().to_vec())
        };

        let mut key = [0u8; 16];
        let mut iv = [0u8; 16];
        key.copy_from_slice(&aeskey[..16]);
        iv.copy_from_slice(&aesiv[..16]);

        let cipher = OfpCipher { key, iv };
        let dec = cipher.decrypt(first_16);
        if dec.starts_with(b"MMM") {
            return Some(cipher);
        }
    }
    None
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Compile-time hex decode for 16-byte arrays.
const fn hex16(s: &str) -> [u8; 16] {
    let bytes = s.as_bytes();
    let mut result = [0u8; 16];
    let mut i = 0;
    while i < 16 {
        let hi = hex_val(bytes[i * 2]);
        let lo = hex_val(bytes[i * 2 + 1]);
        result[i] = (hi << 4) | lo;
        i += 1;
    }
    result
}

const fn hex_val(c: u8) -> u8 {
    match c {
        b'0'..=b'9' => c - b'0',
        b'a'..=b'f' => c - b'a' + 10,
        b'A'..=b'F' => c - b'A' + 10,
        _ => 0,
    }
}

fn hex_decode(s: &str) -> Vec<u8> {
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap_or(0)).collect()
}

/// Compute MD5 and return lowercase hex string.
fn md5_hex(data: &[u8]) -> String {
    let digest = Md5::digest(data);
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mbox_array_basic() {
        let mbox = mbox_array(MboxVariant::Mbox5);
        assert_eq!(mbox[0], 0x60);
        assert_eq!(mbox[1], 0x8a);
        assert_eq!(mbox[16], 0x00);
        assert_eq!(mbox[60], 0x0a);
        assert_eq!(mbox[61], 0x00);
    }

    #[test]
    fn test_gsbox_basic() {
        // First 4 bytes of sbox = c6, 63, 63, a5 = 0xa5636363 in LE
        let val = gsbox(0);
        assert_eq!(
            val,
            0xa563_6363_u32
                .swap_bytes()
                .reverse_bits()
                .count_ones()
                .checked_add(0)
                .map(|_| u32::from_le_bytes([0xc6, 0x63, 0x63, 0xa5]))
                .unwrap()
        );
        // Just check it matches LE interpretation of first 4 sbox bytes
        assert_eq!(val, u32::from_le_bytes([0xc6, 0x63, 0x63, 0xa5]));
    }

    #[test]
    fn test_ops_key_constant() {
        // key = unpack("<4I", bytes.fromhex("d1b5e39e5eea049d671dd5abd2afcbaf"))
        let key_bytes: Vec<u8> = "d1b5e39e5eea049d671dd5abd2afcbaf"
            .as_bytes()
            .chunks(2)
            .map(|c| u8::from_str_radix(std::str::from_utf8(c).unwrap(), 16).unwrap())
            .collect();
        assert_eq!(key_bytes.len(), 16);
        let k0 = u32::from_le_bytes(key_bytes[0..4].try_into().unwrap());
        let k1 = u32::from_le_bytes(key_bytes[4..8].try_into().unwrap());
        let k2 = u32::from_le_bytes(key_bytes[8..12].try_into().unwrap());
        let k3 = u32::from_le_bytes(key_bytes[12..16].try_into().unwrap());
        assert_eq!(k0, OPS_KEY[0]);
        assert_eq!(k1, OPS_KEY[1]);
        assert_eq!(k2, OPS_KEY[2]);
        assert_eq!(k3, OPS_KEY[3]);
    }
}
