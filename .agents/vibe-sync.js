#!/usr/bin/env node

/**
 * Vibe Code System — Codebase Sync & RAG Ingestion CLI
 * Usage: node .agents/vibe-sync.js
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const ignoreDirs = new Set(['.git', 'node_modules', 'out', 'dist', 'scratch', '.vscode-test']);
const binaryExtensions = new Set([
    '.png', '.webp', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.vsix',
    '.zip', '.tar', '.gz', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3'
]);

function getAllFiles(dir, fileList = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(rootDir, fullPath).split(path.sep).join('/');
        
        if (entry.isDirectory()) {
            if (!ignoreDirs.has(entry.name)) {
                getAllFiles(fullPath, fileList);
            }
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!binaryExtensions.has(ext) && 
                entry.name !== '.vibe-tracker.md' && 
                entry.name !== '.vibe-rag.json' &&
                entry.name !== '.vibe-vault-unlocked.json') {
                fileList.push(relPath);
            }
        }
    }
    return fileList;
}

// 1. Read existing RAG database to preserve custom scratch notes & secrets
const dbPath = path.join(rootDir, '.vibe-rag.json');
let existingScratchNotes = [];
if (fs.existsSync(dbPath)) {
    try {
        const existingData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (Array.isArray(existingData)) {
            existingScratchNotes = existingData.filter(item => item.path === 'scratch_notes');
        }
    } catch (e) {
        console.warn('Vibe Sync: Could not parse existing .vibe-rag.json, starting fresh.', e.message);
    }
}

// 2. Discover all workspace files
const allFiles = getAllFiles(rootDir).sort();

// 3. Generate .vibe-tracker.md
let trackerMd = `# Vibe Codebase Ingestion Tracker\n\n`;
let currentDir = '';

for (const file of allFiles) {
    const dir = path.dirname(file);
    if (dir !== currentDir) {
        currentDir = dir;
        trackerMd += `\n### \`${dir === '.' ? 'Root' : dir}\`\n`;
    }
    trackerMd += `- [x] COMPLETE \`${file}\`\n`;
}

fs.writeFileSync(path.join(rootDir, '.vibe-tracker.md'), trackerMd, 'utf8');

// 4. Generate .vibe-rag.json
const ragEntries = [];

// Add preserved scratch notes first
for (const note of existingScratchNotes) {
    ragEntries.push(note);
}

// Add workspace files
for (const file of allFiles) {
    const fullPath = path.join(rootDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    
    let summary = `Project file ${file}.`;
    let tags = ['workspace'];
    let dependsOn = [];

    if (file.endsWith('.md')) {
        tags = ['documentation', 'markdown'];
        const firstHeading = content.match(/^#+\s+(.+)$/m);
        if (firstHeading) {
            summary = firstHeading[1];
        }
    } else if (file.startsWith('.agents/')) {
        tags = ['governance', 'agents'];
    } else if (file.startsWith('src/')) {
        tags = ['source', 'code'];
    }

    ragEntries.push({
        id: file,
        path: file,
        summary: summary,
        tags: tags,
        dependsOn: dependsOn,
        content: content
    });
}

fs.writeFileSync(dbPath, JSON.stringify(ragEntries, null, 2), 'utf8');

console.log(`\n==================================================`);
console.log(` ⟳ VIBE SYNC COMPLETE`);
console.log(`==================================================`);
console.log(` Indexed Workspace Files: ${allFiles.length}`);
console.log(` Preserved Scratch Notes: ${existingScratchNotes.length}`);
console.log(` Total RAG Entries:      ${ragEntries.length}`);
console.log(` Updated: .vibe-rag.json & .vibe-tracker.md`);
console.log(`==================================================\n`);
