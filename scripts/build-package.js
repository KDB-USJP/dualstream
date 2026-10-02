/**
 * DualStream — Build & Packaging Script
 *
 * Creates a clean production distribution directory and a ready-to-upload
 * ZIP package (for Chrome Web Store or manual distribution).
 *
 * Usage:
 *   node scripts/build-package.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const STAGING_DIR = path.join(DIST_DIR, 'dualstream');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  console.log('📦 DualStream: Building packed extension...');

  // 1. Read manifest.json
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ Error: manifest.json not found in root.');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const version = manifest.version || '1.0.0';
  console.log(`ℹ️  Extension Version: ${version}`);

  // 2. Prepare dist directories
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(STAGING_DIR, { recursive: true });

  // 3. Copy production files
  console.log('📋 Copying production assets...');
  fs.copyFileSync(manifestPath, path.join(STAGING_DIR, 'manifest.json'));
  copyDirRecursive(path.join(ROOT_DIR, 'icons'), path.join(STAGING_DIR, 'icons'));
  copyDirRecursive(path.join(ROOT_DIR, 'src'), path.join(STAGING_DIR, 'src'));

  if (fs.existsSync(path.join(ROOT_DIR, 'LICENSE'))) {
    fs.copyFileSync(path.join(ROOT_DIR, 'LICENSE'), path.join(STAGING_DIR, 'LICENSE'));
  }

  // 4. Create ZIP archive
  const zipFileName = `dualstream-v${version}.zip`;
  const zipPath = path.join(DIST_DIR, zipFileName);

  console.log(`🗜️  Compressing into ${zipFileName}...`);
  try {
    // Use PowerShell Compress-Archive on Windows
    const psCmd = `Compress-Archive -Path "${STAGING_DIR}\\*" -DestinationPath "${zipPath}" -Force`;
    execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Error creating ZIP archive:', err);
    process.exit(1);
  }

  const stats = fs.statSync(zipPath);
  const sizeKb = (stats.size / 1024).toFixed(1);

  console.log('\n✅ Pack complete!');
  console.log(`📁 Production Staging Folder: ${STAGING_DIR}`);
  console.log(`📦 Distribution Package:     ${zipPath} (${sizeKb} KB)`);
  console.log('\nNext steps:');
  console.log('1. Chrome Web Store: Upload "dist/' + zipFileName + '" directly to developer dashboard.');
  console.log('2. Offline / CRX: Open chrome://extensions, enable "Developer mode", click "Pack extension", and select:');
  console.log('   ' + STAGING_DIR);
}

main();
