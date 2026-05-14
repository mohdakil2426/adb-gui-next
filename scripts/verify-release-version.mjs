#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { exit } from 'node:process';

const expected = process.argv[2];

const readJsonVersion = (path) => JSON.parse(readFileSync(path, 'utf8')).version;

const readCargoVersion = (path) => {
  const text = readFileSync(path, 'utf8');
  const match = text.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error(`Could not find package version in ${path}`);
  }
  return match[1];
};

const versions = {
  packageJson: readJsonVersion('package.json'),
  cargoToml: readCargoVersion('src-tauri/Cargo.toml'),
  tauriConfig: readJsonVersion('src-tauri/tauri.conf.json'),
};

const unique = new Set(Object.values(versions));

if (unique.size !== 1) {
  console.error('Release version mismatch:');
  for (const [source, version] of Object.entries(versions)) {
    console.error(`- ${source}: ${version}`);
  }
  exit(1);
}

const version = versions.packageJson;

if (expected && version !== expected) {
  console.error(`Release version ${version} does not match expected ${expected}.`);
  exit(1);
}

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Release version is not valid semver: ${version}`);
  exit(1);
}

console.log(`Release version verified: ${version}`);
