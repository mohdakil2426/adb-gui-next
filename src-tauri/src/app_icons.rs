use apk_info_axml::{ARSC, AXML};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use std::{
    fs::File,
    io::Read,
    path::{Path, PathBuf},
};
use zip::ZipArchive;

fn sanitize_package_name(package_name: &str) -> String {
    package_name
        .chars()
        .map(
            |ch| {
                if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-') { ch } else { '_' }
            },
        )
        .collect()
}

pub fn package_icon_temp_path(package_name: &str) -> PathBuf {
    std::env::temp_dir()
        .join(format!("adb-gui-next-{}-icon.apk", sanitize_package_name(package_name)))
}

pub fn parse_pm_path_output(output: &str) -> Option<String> {
    let paths: Vec<String> = output
        .lines()
        .filter_map(|line| line.trim().strip_prefix("package:"))
        .map(|path| path.trim().to_string())
        .collect();

    paths
        .iter()
        .find(|path| path.ends_with("/base.apk"))
        .cloned()
        .or_else(|| paths.into_iter().next())
}

fn raster_icon_mime(path: &str) -> Option<&'static str> {
    let extension = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())?;

    match extension.as_str() {
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        _ => None,
    }
}

fn icon_density_score(path: &str) -> i32 {
    let normalized = path.replace('\\', "/").to_ascii_lowercase();
    let dir_score = if normalized.contains("/mipmap-") {
        100
    } else if normalized.contains("/drawable-") {
        80
    } else if normalized.contains("/mipmap/") {
        70
    } else if normalized.contains("/drawable/") {
        60
    } else {
        0
    };

    let density_score = [
        ("xxxhdpi", 60),
        ("xxhdpi", 50),
        ("xhdpi", 40),
        ("hdpi", 30),
        ("mdpi", 20),
        ("anydpi", 10),
    ]
    .into_iter()
    .find_map(|(density, score)| normalized.contains(density).then_some(score))
    .unwrap_or(0);

    let extension_score = match Path::new(&normalized)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
    {
        "png" => 6,
        "webp" => 5,
        "jpg" | "jpeg" => 4,
        _ => 0,
    };

    dir_score + density_score + extension_score
}

fn find_raster_icon_candidate<I>(icon_path: &str, entries: I) -> Option<String>
where
    I: IntoIterator,
    I::Item: AsRef<str>,
{
    let icon_stem = Path::new(icon_path).file_stem()?.to_str()?.to_ascii_lowercase();

    entries
        .into_iter()
        .filter_map(|entry| {
            let entry = entry.as_ref().replace('\\', "/");
            let entry_stem = Path::new(&entry)
                .file_stem()
                .and_then(|value| value.to_str())
                .map(|value| value.to_ascii_lowercase())?;

            if entry_stem != icon_stem || raster_icon_mime(&entry).is_none() {
                return None;
            }

            Some(entry)
        })
        .max_by_key(|entry| icon_density_score(entry))
}

fn resolve_raster_icon_path(apk_path: &Path, icon_path: &str) -> Result<Option<String>, String> {
    if raster_icon_mime(icon_path).is_some() {
        return Ok(Some(icon_path.replace('\\', "/")));
    }

    let file = File::open(apk_path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;
    let mut entries = Vec::with_capacity(archive.len());

    for index in 0..archive.len() {
        let name =
            archive.by_index(index).map_err(|error| error.to_string())?.name().replace('\\', "/");
        entries.push(name);
    }

    Ok(find_raster_icon_candidate(icon_path, entries))
}

pub fn extract_package_icon_data_url(apk_path: &Path) -> Result<Option<String>, String> {
    let file = File::open(apk_path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;
    let manifest_bytes =
        read_archive_entry(&mut archive, "AndroidManifest.xml")?.ok_or_else(|| {
            format!("AndroidManifest.xml not found in {}", apk_path.to_string_lossy())
        })?;
    let resources_bytes = read_archive_entry(&mut archive, "resources.arsc")?;

    let arsc = if let Some(resources_bytes) = resources_bytes {
        let mut resources_slice = resources_bytes.as_slice();
        Some(ARSC::new(&mut resources_slice).map_err(|error| error.to_string())?)
    } else {
        None
    };

    let mut manifest_slice = manifest_bytes.as_slice();
    let axml = AXML::new(&mut manifest_slice, arsc.as_ref()).map_err(|error| error.to_string())?;
    let resolved_icon_path = axml
        .get_attribute_value("application", "icon", arsc.as_ref())
        .or_else(|| axml.get_attribute_value("application", "logo", arsc.as_ref()))
        .map(|value| value.replace('\\', "/"));

    let Some(icon_path) = resolved_icon_path else {
        return Ok(None);
    };

    let Some(raster_path) = resolve_raster_icon_path(apk_path, &icon_path)? else {
        return Ok(None);
    };

    let mime = raster_icon_mime(&raster_path)
        .ok_or_else(|| format!("Unsupported package icon format: {raster_path}"))?;
    let bytes = read_archive_entry(&mut archive, &raster_path)?
        .ok_or_else(|| format!("Package icon asset not found: {raster_path}"))?;

    Ok(Some(format!("data:{mime};base64,{}", STANDARD.encode(bytes))))
}

fn read_archive_entry(
    archive: &mut ZipArchive<File>,
    entry_name: &str,
) -> Result<Option<Vec<u8>>, String> {
    match archive.by_name(entry_name) {
        Ok(mut entry) => {
            let mut bytes = Vec::new();
            entry.read_to_end(&mut bytes).map_err(|error| error.to_string())?;
            Ok(Some(bytes))
        }
        Err(zip::result::ZipError::FileNotFound) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_pm_path_output_prefers_base_apk() {
        let output = "package:/data/app/~~split/config.en.apk\npackage:/data/app/~~main/base.apk\n";
        assert_eq!(parse_pm_path_output(output).as_deref(), Some("/data/app/~~main/base.apk"));
    }

    #[test]
    fn find_raster_icon_candidate_prefers_high_density_mipmap_asset() {
        let candidate = find_raster_icon_candidate(
            "res/mipmap-anydpi-v26/ic_launcher.xml",
            [
                "res/drawable-mdpi-v4/ic_launcher.png",
                "res/mipmap-xxhdpi-v4/ic_launcher.png",
                "res/mipmap-xhdpi-v4/ic_launcher.webp",
            ],
        );

        assert_eq!(candidate.as_deref(), Some("res/mipmap-xxhdpi-v4/ic_launcher.png"));
    }

    #[test]
    fn package_icon_temp_path_keeps_generated_name_safe() {
        let path = package_icon_temp_path("com.example/My App");
        let file_name = path.file_name().and_then(|value| value.to_str()).unwrap_or_default();
        assert_eq!(file_name, "adb-gui-next-com.example_My_App-icon.apk");
    }
}
