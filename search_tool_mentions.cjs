const fs = require('fs');
const path = require('path');

function searchDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            searchDir(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                const lower = line.toLowerCase();
                if (lower.includes('tool 1') || lower.includes('tool 2') || lower.includes('tool 3') || lower.includes('tool 4') || lower.includes('tool 5') || lower.includes('tool 6') || lower.includes('tool1') || lower.includes('tool2') || lower.includes('tool3')) {
                    console.log(`${fullPath}:${idx + 1}: ${line.trim()}`);
                }
            });
        }
    });
}

searchDir('src');
