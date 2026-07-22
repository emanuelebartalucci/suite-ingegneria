const fs = require('fs');
const path = require('path');

const toolsDir = 'src/tools';
const files = fs.readdirSync(toolsDir);

files.forEach(file => {
    if (file.endsWith('.tsx')) {
        const fullPath = path.join(toolsDir, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            if (/\btool\b/i.test(line)) {
                console.log(`${file}:${idx+1}: ${line.trim().slice(0, 100)}`);
            }
        });
    }
});
