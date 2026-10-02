const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const query = process.argv[2];
if (!query) {
    console.error("Usage: node vibe-query.js \"search term\"");
    process.exit(1);
}

// .vibe-rag.json is in the workspace root, and this script is in .agents/
const rootPath = path.join(__dirname, '..');
const dbPath = path.join(rootPath, '.vibe-rag.json');

if (!fs.existsSync(dbPath)) {
    console.error("Error: .vibe-rag.json not found. Make sure to run 'Vibe: Index to RAG' first.");
    process.exit(1);
}

try {
    const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    // Check for vault key
    const keyPath = path.join(rootPath, '.vibe-vault.key');
    let vaultKey = null;
    if (fs.existsSync(keyPath)) {
        const rawContent = fs.readFileSync(keyPath, 'utf8');
        const lines = rawContent.split(/\r?\n/);
        let extractedKey = '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
                extractedKey = trimmed;
                break;
            }
        }
        if (extractedKey.length > 0 && extractedKey.length <= 256 && !/[\x00-\x1F\x7F]/.test(extractedKey)) {
            if (/^[0-9a-fA-F]{64}$/.test(extractedKey)) {
                vaultKey = Buffer.from(extractedKey, 'hex');
            } else {
                vaultKey = crypto.createHash('sha256').update(extractedKey, 'utf8').digest();
            }
        }
    }

    const results = [];
    const searchTerms = query.toLowerCase().split(' ');

    for (const doc of dbData) {
        let textContent = doc.content || '';
        
        // Decrypt if needed
        if (doc.isEncrypted) {
            if (vaultKey) {
                try {
                    const parts = textContent.split(':');
                    if (parts.length === 3) {
                        const iv = Buffer.from(parts[0], 'hex');
                        const authTag = Buffer.from(parts[1], 'hex');
                        const encrypted = parts[2];
                        const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey, iv);
                        decipher.setAuthTag(authTag);
                        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
                        decrypted += decipher.final('utf8');
                        textContent = decrypted;
                    }
                } catch (e) {
                    textContent = '[Decryption Failed - Invalid Key]';
                }
            } else {
                textContent = '[Encrypted Note - Missing .vibe-vault.key]';
            }
        }

        const contentLower = textContent.toLowerCase();
        const summaryLower = (doc.summary || '').toLowerCase();
        const pathLower = (doc.path || doc.id || '').toLowerCase();
        const tagsList = (doc.tags || []).map(t => t.toLowerCase());

        let score = 0;
        let primaryMatchIndex = -1;

        for (const term of searchTerms) {
            if (!term) continue;

            // 1. Tag Match (Weight: 5)
            if (tagsList.some(t => t === term || t.includes(term))) {
                score += 5;
            }

            // 2. Path / Filename Match (Weight: 4)
            if (pathLower.includes(term)) {
                score += 4;
            }

            // 3. Summary Match (Weight: 3)
            if (summaryLower.includes(term)) {
                score += 3;
            }

            // 4. Content Match (Weight: 1 per occurrence, capped at 3)
            if (contentLower.includes(term)) {
                const occurrences = contentLower.split(term).length - 1;
                score += Math.min(occurrences, 3);
                if (primaryMatchIndex === -1) {
                    primaryMatchIndex = contentLower.indexOf(term);
                }
            }
        }

        if (score > 0) {
            let snippet = '';
            if (primaryMatchIndex !== -1) {
                const start = Math.max(0, primaryMatchIndex - 80);
                const end = Math.min(textContent.length, primaryMatchIndex + 220);
                snippet = textContent.substring(start, end).replace(/\n+/g, ' ');
                if (start > 0) snippet = '...' + snippet;
                if (end < textContent.length) snippet = snippet + '...';
            } else if (doc.summary) {
                snippet = doc.summary;
            } else {
                snippet = textContent.substring(0, 150).replace(/\n+/g, ' ') + '...';
            }

            results.push({ id: doc.id, score, snippet, dependsOn: doc.dependsOn, isEncrypted: doc.isEncrypted });
        }
    }

    if (results.length === 0) {
        console.log(`No results found for "${query}"`);
    } else {
        results.sort((a, b) => b.score - a.score);
        console.log(`--- RAG Results for "${query}" ---`);
        for (const res of results.slice(0, 3)) {
            const lockIcon = res.isEncrypted ? '🔒 ' : '';
            console.log(`\nDocument: ${lockIcon}${res.id} (Score: ${res.score})`);
            if (res.dependsOn && res.dependsOn.length > 0) {
                console.log(`Depends On: ${res.dependsOn.join(', ')}`);
            }
            console.log(`Snippet: ${res.snippet}`);
        }
    }
} catch (e) {
    console.error("Error querying database:", e.message);
}
