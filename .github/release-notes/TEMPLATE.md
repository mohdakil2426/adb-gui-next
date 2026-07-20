# ADB GUI Next vX.Y.Z

Copy this file to `vX.Y.Z.md` when cutting a release. Publish workflow requires
`.github/release-notes/v{version}.md` to match `package.json` version.

## Downloads

Recommended:

- Windows x64: `ADB-GUI-Next-vX.Y.Z-windows-x86_64-setup.exe`
- Linux x64: `ADB-GUI-Next-vX.Y.Z-linux-x86_64.deb`
- Linux x64 AppImage: `ADB-GUI-Next-vX.Y.Z-linux-x86_64.AppImage`

Also available: MSI, portable zip, x86/ARM Windows, linux-aarch64 (if shipped).

Verify with `SHA256SUMS.txt`.

## Highlights

- …

## Platform support

| Platform | Status |
| --- | --- |
| Windows x86_64 | First-class |
| Windows i686 / aarch64 | Shipped when CI matrix includes them |
| Linux x86_64 | First-class |
| Linux aarch64 | App builds; bundled platform-tools may be PATH-only |
| macOS | Builds paused by product policy |

## Notes

- Builds are **not code-signed** (SmartScreen may warn).
- App id: `com.astrixforge.adbguinext`. Display name: **ADB GUI Next**.
- Portable: extract locally (not OneDrive cloud-only), run `ADB GUI Next.exe`.
- Bump: `package.json` + `Cargo.toml` (run `bun scripts/sync-cargo-version.mjs`).
