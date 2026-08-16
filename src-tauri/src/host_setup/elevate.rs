//! Elevated copy / PATH / `pnputil` for Windows host setup.

use std::fs;
use std::path::Path;
use std::process::Command;

use crate::CmdResult;

use super::paths::INSTALL_DIR;
use super::windows_state::machine_path_contains_install_dir;

const ERROR_CANCELLED: i32 = 1223;

pub struct ElevateResult {
    pub driver_installed: bool,
    pub driver_message: Option<String>,
    pub path_updated: bool,
}

pub fn elevate_install_tools(tools_src: &Path) -> CmdResult<ElevateResult> {
    let tools_src = tools_src
        .canonicalize()
        .map_err(|e| format!("cannot canonicalize extracted platform-tools: {e}"))?;
    let src = ps_quote(&tools_src.to_string_lossy());
    let dest = ps_quote(INSTALL_DIR);
    let path_block = machine_path_powershell_block();
    let inner = format!(
        r#"$ErrorActionPreference = 'Stop'
$src = {src}
$dest = {dest}
$parent = Split-Path -Parent $dest
New-Item -ItemType Directory -Force -Path $parent | Out-Null
if (Test-Path -LiteralPath $dest) {{
  Remove-Item -LiteralPath $dest -Recurse -Force
}}
Copy-Item -LiteralPath $src -Destination $dest -Recurse
{path_block}
$driverInstalled = 'false'
$driverMessage = 'platform-tools only'
"#,
    );
    run_elevated(
        "adb-gui-host-tools-",
        &inner,
        &format!(
            "elevated platform-tools installer exited with code {{status}}. Check that you can write {INSTALL_DIR}."
        ),
    )
}

pub fn elevate_install_driver(inf: &Path) -> CmdResult<ElevateResult> {
    let inf =
        fs::canonicalize(inf).map_err(|e| format!("cannot canonicalize USB driver INF: {e}"))?;
    let inf_quoted = ps_quote(&inf.to_string_lossy());
    let inner = format!(
        r#"$ErrorActionPreference = 'Stop'
$pathUpdated = 'false'
{driver_block}
"#,
        driver_block = pnputil_driver_block(&inf_quoted),
    );
    run_elevated(
        "adb-gui-host-driver-",
        &inner,
        "elevated USB driver installer exited with code {status}",
    )
}

fn pnputil_driver_block(inf_quoted: &str) -> String {
    format!(
        r#"
$driverInstalled = 'false'
$driverMessage = ''
try {{
  $pnputil = Join-Path $env:SystemRoot 'system32\pnputil.exe'
  $pnp = & $pnputil /add-driver {inf_quoted} /install 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 259 -or $LASTEXITCODE -eq 3010) {{
    $driverInstalled = 'true'
    $driverMessage = $pnp.Trim()
  }} else {{
    $driverMessage = "pnputil exited $($LASTEXITCODE): $($pnp.Trim())"
  }}
}} catch {{
  $driverMessage = $_.Exception.Message
}}
"#
    )
}

fn run_elevated(prefix: &str, inner_body: &str, fail_template: &str) -> CmdResult<ElevateResult> {
    let work = tempfile::Builder::new().prefix(prefix).tempdir().map_err(|e| e.to_string())?;
    let inner = work.path().join("inner.ps1");
    let outer = work.path().join("outer.ps1");
    let result_path = work.path().join("result.txt");
    let result = ps_quote(&result_path.to_string_lossy());
    let script = format!(
        r#"{inner_body}
@(
  "pathUpdated=$pathUpdated"
  "driverInstalled=$driverInstalled"
  "driverMessage=$driverMessage"
) | Set-Content -LiteralPath {result} -Encoding UTF8
"#
    );
    fs::write(&inner, script).map_err(|e| e.to_string())?;
    write_outer_script(&outer, &inner)?;
    let status = run_powershell(&outer)?;
    if status == ERROR_CANCELLED {
        return Err("Administrator permission was declined.".into());
    }
    if status != 0 {
        return Err(fail_template.replace("{status}", &status.to_string()));
    }
    parse_result_file(&result_path)
}

fn write_outer_script(path: &Path, inner: &Path) -> CmdResult<()> {
    let inner_quoted = ps_quote(&inner.to_string_lossy());
    let script = format!(
        r#"$ErrorActionPreference = 'Stop'
try {{
  $p = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
    -Verb RunAs -Wait -PassThru -WindowStyle Hidden `
    -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File', {inner_quoted})
  if ($null -eq $p) {{ exit {ERROR_CANCELLED} }}
  exit $p.ExitCode
}} catch {{
  exit {ERROR_CANCELLED}
}}
"#
    );
    fs::write(path, script).map_err(|e| e.to_string())
}

fn run_powershell(script: &Path) -> CmdResult<i32> {
    let mut cmd = Command::new("powershell.exe");
    cmd.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", &script.to_string_lossy()]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let status = cmd.status().map_err(|e| format!("failed to start PowerShell: {e}"))?;
    Ok(status.code().unwrap_or(1))
}

fn parse_result_file(path: &Path) -> CmdResult<ElevateResult> {
    let body = fs::read_to_string(path).map_err(|_| {
        "elevated installer finished but did not write a result file. Try again after accepting UAC."
            .to_string()
    })?;
    let mut path_updated = false;
    let mut driver_installed = false;
    let mut driver_message = None;
    for line in body.lines() {
        if let Some(rest) = line.strip_prefix("pathUpdated=") {
            path_updated = rest.trim().eq_ignore_ascii_case("true");
        } else if let Some(rest) = line.strip_prefix("driverInstalled=") {
            driver_installed = rest.trim().eq_ignore_ascii_case("true");
        } else if let Some(rest) = line.strip_prefix("driverMessage=") {
            let text = rest.trim();
            if !text.is_empty() {
                driver_message = Some(text.to_string());
            }
        }
    }
    if !path_updated {
        path_updated = machine_path_contains_install_dir();
    }
    Ok(ElevateResult { driver_installed, driver_message, path_updated })
}

/// Writes HKLM system Path (REG_EXPAND_SZ) and broadcasts WM_SETTINGCHANGE.
fn machine_path_powershell_block() -> String {
    let dest = ps_quote(INSTALL_DIR);
    format!(
        r#"
$pathUpdated = 'false'
$regKey = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment'
$needle = {dest}.TrimEnd('\')
$key = Get-Item -LiteralPath $regKey
$machinePath = [string]$key.GetValue('Path', '', 'DoNotExpandEnvironmentNames')
if (-not $machinePath) {{ $machinePath = '' }}
$exists = $false
foreach ($part in $machinePath.Split(';')) {{
  $n = ([string]$part).Trim().TrimEnd('\')
  if ($n -and ($n.ToLowerInvariant() -eq $needle.ToLowerInvariant())) {{ $exists = $true }}
}}
if (-not $exists) {{
  $joined = if ([string]::IsNullOrWhiteSpace($machinePath)) {{ $needle }} else {{ "$machinePath;$needle" }}
  $kind = 'ExpandString'
  try {{
    $kindName = (Get-Item -LiteralPath $regKey).GetValueKind('Path').ToString()
    if ($kindName -eq 'String') {{ $kind = 'String' }}
  }} catch {{ }}
  Set-ItemProperty -LiteralPath $regKey -Name Path -Value $joined -Type $kind
  $pathUpdated = 'true'
}}
try {{
  if (-not ('HostSetupEnvBroadcast' -as [type])) {{
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class HostSetupEnvBroadcast {{
  [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
  public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
}}
"@
  }}
  $ignored = [UIntPtr]::Zero
  [void][HostSetupEnvBroadcast]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$ignored)
}} catch {{ }}
"#
    )
}

pub fn elevate_repair_path() -> CmdResult<ElevateResult> {
    let work = tempfile::Builder::new()
        .prefix("adb-gui-host-path-")
        .tempdir()
        .map_err(|e| e.to_string())?;
    let inner = work.path().join("inner.ps1");
    let outer = work.path().join("outer.ps1");
    let result_path = work.path().join("result.txt");
    let result = ps_quote(&result_path.to_string_lossy());
    let path_block = machine_path_powershell_block();
    let script = format!(
        r#"$ErrorActionPreference = 'Stop'
{path_block}
$driverInstalled = 'false'
$driverMessage = 'PATH only'
@(
  "pathUpdated=$pathUpdated"
  "driverInstalled=$driverInstalled"
  "driverMessage=$driverMessage"
) | Set-Content -LiteralPath {result} -Encoding UTF8
"#
    );
    fs::write(&inner, script).map_err(|e| e.to_string())?;
    write_outer_script(&outer, &inner)?;
    let status = run_powershell(&outer)?;
    if status == ERROR_CANCELLED {
        return Err("Administrator permission was declined.".into());
    }
    if status != 0 {
        return Err(format!("elevated PATH update exited with code {status}"));
    }
    parse_result_file(&result_path)
}

fn ps_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ps_quote_escapes_single_quotes() {
        assert_eq!(ps_quote(r"C:\O'Brien"), "'C:\\O''Brien'");
    }
}
