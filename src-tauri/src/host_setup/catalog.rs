//! Parse official Android SDK repository XML from `dl.google.com`.

use crate::CmdResult;

pub const REPOSITORY_XML_URL: &str = "https://dl.google.com/android/repository/repository2-1.xml";
pub const REPOSITORY_XML_V3_URL: &str =
    "https://dl.google.com/android/repository/repository2-3.xml";
pub const ADDON_XML_URL: &str = "https://dl.google.com/android/repository/addon2-1.xml";
pub const REPOSITORY_BASE: &str = "https://dl.google.com/android/repository/";

const PLATFORM_TOOLS_PATH: &str = "platform-tools";
const USB_DRIVER_PATH: &str = "extras;google;usb_driver";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChecksumAlgo {
    Sha1,
    Sha256,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PackageKind {
    PlatformTools,
    UsbDriver,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SdkPackage {
    pub checksum_algo: ChecksumAlgo,
    pub checksum_hex: String,
    pub kind: PackageKind,
    pub url: String,
    pub version: String,
}

#[derive(Clone, Copy, Default)]
struct Revision {
    major: u32,
    micro: u32,
    minor: u32,
}

impl Revision {
    fn display(self) -> String {
        format!("{}.{}.{}", self.major, self.minor, self.micro)
    }
}

#[derive(Default)]
struct ArchiveDraft {
    checksum: String,
    checksum_type: String,
    host_os: String,
    url: String,
}

struct PackageDraft {
    archives: Vec<ArchiveDraft>,
    current: ArchiveDraft,
    kind: Option<PackageKind>,
    revision: Revision,
}

/// Pick the newest Windows archive for platform-tools and the Google USB driver.
pub fn select_windows_packages(packages: &[SdkPackage]) -> CmdResult<(SdkPackage, SdkPackage)> {
    let tools = newest_package(packages, PackageKind::PlatformTools)
        .ok_or_else(|| "Android SDK catalog has no Windows platform-tools package".to_string())?;
    let driver = newest_package(packages, PackageKind::UsbDriver).ok_or_else(|| {
        "Android SDK catalog has no Windows Google USB Driver package".to_string()
    })?;
    Ok((tools, driver))
}

pub fn newest_package(packages: &[SdkPackage], kind: PackageKind) -> Option<SdkPackage> {
    packages
        .iter()
        .filter(|package| package.kind == kind)
        .max_by_key(|package| version_key(&package.version))
        .cloned()
}

fn version_key(version: &str) -> (u32, u32, u32) {
    let mut parts = version.split('.');
    let major = parts.next().and_then(|part| part.parse().ok()).unwrap_or(0);
    let minor = parts.next().and_then(|part| part.parse().ok()).unwrap_or(0);
    let micro = parts.next().and_then(|part| part.parse().ok()).unwrap_or(0);
    (major, minor, micro)
}

pub fn parse_sdk_packages(xml: &str) -> CmdResult<Vec<SdkPackage>> {
    use quick_xml::Reader;
    use quick_xml::events::Event;

    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut packages = Vec::new();
    let mut stack: Vec<Vec<u8>> = Vec::new();
    let mut draft: Option<PackageDraft> = None;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = e.local_name().as_ref().to_vec();
                if name.as_slice() == b"remotePackage" {
                    draft = Some(PackageDraft {
                        archives: Vec::new(),
                        current: ArchiveDraft::default(),
                        kind: package_kind_from_path(attr_value(&e, b"path").as_deref()),
                        revision: Revision::default(),
                    });
                } else if name.as_slice() == b"checksum"
                    && let Some(current) = draft.as_mut()
                    && let Some(kind) = attr_value(&e, b"type")
                {
                    current.current.checksum_type = kind;
                }
                stack.push(name);
            }
            Ok(Event::Text(t)) => {
                let Some(draft) = draft.as_mut() else {
                    continue;
                };
                let Ok(decoded) = reader.decoder().decode(t.as_ref()) else {
                    continue;
                };
                let text = decoded.trim();
                if text.is_empty() {
                    continue;
                }
                match stack.last().map(Vec::as_slice) {
                    Some(b"major") => draft.revision.major = text.parse().unwrap_or(0),
                    Some(b"minor") => draft.revision.minor = text.parse().unwrap_or(0),
                    Some(b"micro") => draft.revision.micro = text.parse().unwrap_or(0),
                    Some(b"host-os") => draft.current.host_os = text.to_ascii_lowercase(),
                    Some(b"url") => draft.current.url = text.to_string(),
                    Some(b"checksum") => draft.current.checksum = text.to_ascii_lowercase(),
                    _ => {}
                }
            }
            Ok(Event::End(e)) => {
                match e.local_name().as_ref() {
                    b"archive" => {
                        if let Some(draft) = draft.as_mut() {
                            let finished = std::mem::take(&mut draft.current);
                            draft.archives.push(finished);
                        }
                    }
                    b"remotePackage" => {
                        if let Some(finished) = draft.take() {
                            packages.extend(windows_packages_from_draft(finished)?);
                        }
                    }
                    _ => {}
                }
                stack.pop();
            }
            Ok(Event::Eof) => break,
            Err(error) => return Err(format!("failed to parse Android SDK catalog: {error}")),
            _ => {}
        }
        buf.clear();
    }

    Ok(packages)
}

fn attr_value(tag: &quick_xml::events::BytesStart<'_>, key: &[u8]) -> Option<String> {
    tag.attributes().with_checks(false).find_map(|attr| {
        let attr = attr.ok()?;
        if attr.key.local_name().as_ref() == key {
            String::from_utf8(attr.value.into_owned()).ok()
        } else {
            None
        }
    })
}

fn package_kind_from_path(path: Option<&str>) -> Option<PackageKind> {
    match path? {
        PLATFORM_TOOLS_PATH => Some(PackageKind::PlatformTools),
        USB_DRIVER_PATH => Some(PackageKind::UsbDriver),
        other if other.ends_with("usb_driver") && other.contains("google") => {
            Some(PackageKind::UsbDriver)
        }
        _ => None,
    }
}

fn windows_packages_from_draft(draft: PackageDraft) -> CmdResult<Vec<SdkPackage>> {
    let Some(kind) = draft.kind else {
        return Ok(Vec::new());
    };
    let mut out = Vec::new();
    for archive in draft.archives {
        if !archive_is_windows(&archive.host_os) {
            continue;
        }
        if archive.url.is_empty() || archive.checksum.is_empty() {
            continue;
        }
        out.push(SdkPackage {
            checksum_algo: parse_algo(&archive.checksum_type),
            checksum_hex: archive.checksum,
            kind,
            url: absolute_repository_url(&archive.url)?,
            version: draft.revision.display(),
        });
    }
    Ok(out)
}

fn archive_is_windows(host_os: &str) -> bool {
    host_os.is_empty() || host_os == "windows"
}

pub fn absolute_repository_url(url: &str) -> CmdResult<String> {
    let trimmed = url.trim();
    if trimmed.starts_with("https://") {
        ensure_google_repository_url(trimmed)?;
        return Ok(trimmed.to_string());
    }
    if trimmed.contains("://") {
        return Err(format!("refusing non-HTTPS SDK archive URL: {trimmed}"));
    }
    let joined = format!("{REPOSITORY_BASE}{trimmed}");
    ensure_google_repository_url(&joined)?;
    Ok(joined)
}

pub fn ensure_google_repository_url(url: &str) -> CmdResult<()> {
    let parsed = url::Url::parse(url).map_err(|e| e.to_string())?;
    if parsed.scheme() != "https" {
        return Err("SDK downloads must be HTTPS".into());
    }
    if parsed.host_str() != Some("dl.google.com") {
        return Err(format!("SDK catalog URL is not dl.google.com: {url}"));
    }
    if !parsed.path().starts_with("/android/repository/") {
        return Err(format!("SDK catalog path is not /android/repository/: {url}"));
    }
    Ok(())
}

fn parse_algo(value: &str) -> ChecksumAlgo {
    if value.eq_ignore_ascii_case("sha256") { ChecksumAlgo::Sha256 } else { ChecksumAlgo::Sha1 }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"
<sdk-repository>
  <remotePackage path="platform-tools">
    <revision><major>36</major><minor>0</minor><micro>0</micro></revision>
    <archives>
      <archive>
        <complete>
          <checksum type="sha256">aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</checksum>
          <url>platform-tools_r36.0.0-windows.zip</url>
        </complete>
        <host-os>windows</host-os>
      </archive>
      <archive>
        <complete>
          <checksum type="sha256">bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb</checksum>
          <url>platform-tools_r36.0.0-linux.zip</url>
        </complete>
        <host-os>linux</host-os>
      </archive>
    </archives>
  </remotePackage>
  <remotePackage path="extras;google;usb_driver">
    <revision><major>13</major><minor>0</minor><micro>0</micro></revision>
    <archives>
      <archive>
        <complete>
          <checksum type="sha1">0123456789abcdef0123456789abcdef01234567</checksum>
          <url>usb_driver_r13-windows.zip</url>
        </complete>
        <host-os>windows</host-os>
      </archive>
    </archives>
  </remotePackage>
</sdk-repository>
"#;

    #[test]
    fn parse_picks_windows_platform_tools_and_usb_driver() {
        let packages = parse_sdk_packages(SAMPLE).unwrap();
        let (tools, driver) = select_windows_packages(&packages).unwrap();
        assert_eq!(tools.kind, PackageKind::PlatformTools);
        assert_eq!(tools.version, "36.0.0");
        assert_eq!(
            tools.url,
            "https://dl.google.com/android/repository/platform-tools_r36.0.0-windows.zip"
        );
        assert_eq!(tools.checksum_algo, ChecksumAlgo::Sha256);
        assert_eq!(driver.kind, PackageKind::UsbDriver);
        assert_eq!(driver.version, "13.0.0");
        assert!(driver.url.ends_with("usb_driver_r13-windows.zip"));
        assert_eq!(driver.checksum_algo, ChecksumAlgo::Sha1);
    }

    #[test]
    fn newer_revision_wins() {
        let xml = r#"
<sdk-repository>
  <remotePackage path="platform-tools">
    <revision><major>35</major><minor>0</minor><micro>2</micro></revision>
    <archives><archive>
      <complete>
        <checksum type="sha256">aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</checksum>
        <url>old.zip</url>
      </complete>
      <host-os>windows</host-os>
    </archive></archives>
  </remotePackage>
  <remotePackage path="platform-tools">
    <revision><major>36</major><minor>0</minor><micro>0</micro></revision>
    <archives><archive>
      <complete>
        <checksum type="sha256">bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb</checksum>
        <url>new.zip</url>
      </complete>
      <host-os>windows</host-os>
    </archive></archives>
  </remotePackage>
  <remotePackage path="extras;google;usb_driver">
    <revision><major>13</major><minor>0</minor><micro>0</micro></revision>
    <archives><archive>
      <complete>
        <checksum type="sha1">0123456789abcdef0123456789abcdef01234567</checksum>
        <url>usb.zip</url>
      </complete>
      <host-os>windows</host-os>
    </archive></archives>
  </remotePackage>
</sdk-repository>
"#;
        let packages = parse_sdk_packages(xml).unwrap();
        let (tools, _) = select_windows_packages(&packages).unwrap();
        assert_eq!(tools.version, "36.0.0");
        assert!(tools.url.ends_with("new.zip"));
    }

    #[test]
    fn rejects_non_google_absolute_url() {
        assert!(absolute_repository_url("https://evil.example/android/repository/x.zip").is_err());
    }
}
