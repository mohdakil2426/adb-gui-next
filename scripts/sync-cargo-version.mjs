#!/usr/bin/env node
/**
 * Sync src-tauri/Cargo.toml package version from package.json (app SoT).
 * Official: tauri.conf.json uses "version": "../package.json".
 * Cargo still requires its own version field — keep it equal on every release.
 *
 * Usage: bun scripts/sync-cargo-version.mjs
 * Exit 0 if already in sync or after writing; 1 on error.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const version = packageJson.version;
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`Invalid package.json version: ${version}`);
  process.exit(1);
}

const cargoPath = 'src-tauri/Cargo.toml';
const cargo = readFileSync(cargoPath, 'utf8');
const next = cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
if (next === cargo) {
  const match = cargo.match(/^version\s*=\s*"([^"]+)"/m);
  if (match?.[1] === version) {
    console.log(`Cargo.toml already at ${version}`);
    process.exit(0);
  }
  console.error('Could not find package version line in Cargo.toml');
  process.exit(1);
}
writeFileSync(cargoPath, next, 'utf8');
console.log(`Cargo.toml version set to ${version}`);
