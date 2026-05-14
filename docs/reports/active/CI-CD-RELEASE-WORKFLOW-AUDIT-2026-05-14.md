# CI/CD and Release Workflow Audit - Adb Gui Next

**Audit date:** 2026-05-14  
**Repository:** `mohdakil2426/adb-gui-next`  
**Release target:** `v0.2.0`  
**Scope:** GitHub Actions CI, manual GitHub release builds, x64 installer artifacts, portable Windows package, version consistency, caching/performance, and release documentation.

## Executive Summary

The project now has a production-oriented CI/release baseline for the first public release:

```text
1. Every branch push runs CI and uploads temporary x64 Windows/Linux artifacts.
2. Public release is manual only.
3. Manual release is guarded to main only.
4. v0.2.0 is the first public release.
5. Public release assets are x64 only.
6. Windows portable zip is included and contains the executable plus bundled platform tools.
7. Installed app display name is Adb Gui Next.
8. Public asset names use clean PascalCase release names.
```

This avoids artifact spam while still giving every branch a reproducible build artifact for testing. The release workflow produces a draft GitHub release, not an immediately public release. That is the correct safety gate for unsigned desktop binaries.

## Implemented Workflow Data Model

### Branch CI Artifacts

Temporary workflow artifacts are produced on every branch push:

```text
AdbGuiNext-linux-x64-<run_number>
AdbGuiNext-windows-x64-<run_number>
```

Retention:

```text
14 days
```

Compression:

```text
0
```

Reason: installers and zips are already compressed enough. Recompressing large binary payloads wastes CPU and slows CI with no concrete payoff.

### Public Release Assets

The manual release workflow creates a draft release containing:

```text
AdbGuiNext-v0.2.0-windows-x64-setup.exe
AdbGuiNext-v0.2.0-windows-x64.msi
AdbGuiNext-v0.2.0-windows-x64-portable.zip
AdbGuiNext-v0.2.0-linux-x64.deb
AdbGuiNext-v0.2.0-linux-x64.AppImage
SHA256SUMS.txt
```

The installed app/window title is:

```text
Adb Gui Next
```

## Current Files Changed

| File | Purpose |
| --- | --- |
| `.github/workflows/ci.yml` | CI on every branch push and PR to main, plus temporary x64 artifacts |
| `.github/workflows/publish.yml` | Manual-only release from main, draft release, checksums |
| `.github/release-notes/v0.2.0.md` | Release notes used by `gh release create` |
| `scripts/verify-release-version.mjs` | Verifies `package.json`, `Cargo.toml`, and `tauri.conf.json` versions match |
| `scripts/collect-release-assets.ps1` | Normalizes Tauri output names and creates the Windows portable zip |
| `package.json` | Adds `release:verify` script |
| `src-tauri/tauri.conf.json` | Sets version `0.2.0` and product/window title `Adb Gui Next` |
| `README.md` | Updates install naming, release asset names, and current project structure |

## CI Workflow Review

### Trigger Policy

Current CI trigger:

```yaml
on:
  push:
    branches:
      - '**'
  pull_request:
    branches: [main]
```

This matches the requested policy: every push on every branch gets artifacts. Pull requests to `main` still run the same quality gate.

### CI Quality Gate

Each matrix job runs:

```text
1. bun ci
2. bun run release:verify
3. bun run format:check
4. bun run lint
5. bun run test
6. cargo test --manifest-path src-tauri/Cargo.toml
7. bun run build
8. bun run tauri build
9. scripts/collect-release-assets.ps1
10. actions/upload-artifact
```

This is intentionally strict. A branch artifact should mean the code can package, not just type-check.

### CI Matrix

```text
linux-x64    -> ubuntu-22.04
windows-x64  -> windows-latest
```

ARM and 32-bit targets are intentionally not included. Shipping untested architecture builds would be broken crap. The app bundles platform tools, so every shipped architecture must have matching bundled binaries and install/run verification.

## Manual Release Workflow Review

### Release Trigger

Current release trigger:

```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        default: '0.2.0'
```

No tag push and no branch push can publish a release. This matches the requested manual-only release policy.

### Main Branch Guard

The first release preflight step fails unless:

```text
GITHUB_REF == refs/heads/main
```

This is deliberately simple. The workflow can be clicked from GitHub, but it will not proceed unless it is run against `main`.

### Release Jobs

```text
preflight -> build matrix -> publish-draft
```

Preflight validates version and frontend quality once. Build jobs package each OS. Publish downloads artifacts, generates `SHA256SUMS.txt`, and creates the draft release.

### Draft Release Policy

The workflow uses:

```text
gh release create v<version> ... --draft --target main
```

This keeps the human review step before public publication. For a first public desktop binary, direct auto-publish would be too risky.

## Portable Windows Package Review

The portable zip is not an exe-only archive. It contains:

```text
Adb Gui Next.exe
README-portable.txt
resources/windows/adb.exe
resources/windows/fastboot.exe
resources/windows/*.dll
resources/windows/other bundled platform tools
```

This matches the backend resolver, which looks for tools under the runtime resource directory and `resources/windows`. The portable build is therefore aligned with the app's binary resolution model.

Recommended user-facing rule:

```text
Normal users: use AdbGuiNext-v0.2.0-windows-x64-setup.exe
Advanced/no-installer users: use AdbGuiNext-v0.2.0-windows-x64-portable.zip
```

## Caching and Performance Review

Implemented:

```text
- Bun is pinned to 1.3.13.
- CI uses bun ci instead of bun install.
- Rust cache uses swatinem/rust-cache with cache-on-failure.
- Artifact upload uses compression-level: 0 for binary installers.
```

Why this is the right baseline:

```text
1. bun ci enforces the committed lockfile and prevents hidden dependency drift.
2. Rust cache handles the heavy Cargo build graph without custom cache-key voodoo.
3. cache-on-failure keeps partial Rust build work when a later step fails.
4. compression-level: 0 avoids wasting runner CPU on already-compressed artifacts.
```

Not implemented yet:

```text
- SHA-pinned actions
- Dependabot for action/dependency updates
- GitHub artifact attestations
- CodeQL/security workflow
- Windows code signing
```

These are valid next steps, but they are separate hardening work. Adding them into the first release patch would risk turning a simple release pipeline into enterprise sludge.

## Naming Decision

Installed app name:

```text
Adb Gui Next
```

Release asset prefix:

```text
AdbGuiNext-v<version>
```

Reasoning:

```text
1. Installed app names should be human-readable with spaces.
2. File names should avoid spaces for terminal/script friendliness.
3. PascalCase is cleaner than lower-case snake names for public release files.
4. The version is explicit in every public artifact name.
```

## Risk Register

| Risk | Status | Recommendation |
| --- | --- | --- |
| Unsigned Windows installer | Accepted for v0.2.0 draft | Add signing later through a dedicated release-hardening pass |
| No artifact attestations | Accepted for v0.2.0 draft | Add after the draft release flow is proven |
| No updater metadata | Accepted | Do not add updater until signing and updater keys are planned |
| Linux build not locally verified on Windows | Expected | GitHub Linux matrix will verify `.deb` and `.AppImage` packaging |
| Windows `cargo test` can fail in some local environments | Known | Keep CI strict unless GitHub runners prove the loader issue reproduces there |

## Best-Practice References Used

- Tauri GitHub release pipeline: https://v2.tauri.app/distribute/pipelines/github/
- Tauri Windows installer/signing guidance: https://v2.tauri.app/distribute/windows-installer/ and https://v2.tauri.app/distribute/sign/windows/
- Tauri updater signing constraints: https://v2.tauri.app/plugin/updater/
- Bun CI frozen lockfile guidance: https://bun.sh/docs/pm/cli/install
- Bun GitHub Actions setup guidance: https://bun.com/guides/runtime/cicd
- GitHub workflow syntax and permissions: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- GitHub secure use and least-privilege guidance: https://docs.github.com/en/actions/reference/security/secure-use
- GitHub artifact upload behavior: https://github.com/actions/upload-artifact
- GitHub dependency caching reference: https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching

## Verification Evidence

Local verification already performed:

```text
bun run release:verify
PowerShell parser check for scripts/collect-release-assets.ps1
go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/ci.yml .github/workflows/publish.yml
bun run format:web:check
bun run lint:web
bun run test
bun run build
bun run format:rust:check
bun run lint:rust
bun run tauri build
scripts/collect-release-assets.ps1 -Version 0.2.0 -Platform windows -OutputDir artifacts/local-windows-test -Release
portable zip contents inspected
```

Observed Windows release build outputs from Tauri:

```text
src-tauri/target/release/bundle/msi/Adb Gui Next_0.2.0_x64_en-US.msi
src-tauri/target/release/bundle/nsis/Adb Gui Next_0.2.0_x64-setup.exe
```

Observed normalized Windows artifacts from `collect-release-assets.ps1`:

```text
AdbGuiNext-v0.2.0-windows-x64-setup.exe
AdbGuiNext-v0.2.0-windows-x64.msi
AdbGuiNext-v0.2.0-windows-x64-portable.zip
build-info-windows.json
```

Observed portable zip contents include:

```text
Adb Gui Next.exe
README-portable.txt
resources/windows/adb.exe
resources/windows/fastboot.exe
resources/windows/AdbWinApi.dll
resources/windows/AdbWinUsbApi.dll
```

## Verdict

The release workflow is now shaped around a clear data model: x64-only public assets, one manual release path from `main`, one version verifier, one artifact collector, one checksum manifest, and one draft GitHub release. This is boring code, which is what release automation should be.
