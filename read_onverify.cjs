const fs = require('fs');
const content = fs.readFileSync('src/tools/ToolVerificaRiempimentoCanalizzazioni.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
    if (line.includes('onVerifyPozzetto')) {
        console.log(`L${i+1}: ${line.trim()}`);
    }
});
