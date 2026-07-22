const fs = require('fs');
const content = fs.readFileSync('src/tools/ToolVerificaRiempimentoCanalizzazioni.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
    if (line.includes('peso') || line.includes('Peso') || line.includes('onVerifyPozzetto') || line.includes('Invia')) {
        if (i < 500) console.log(`L${i+1}: ${line.trim().slice(0, 110)}`);
    }
});
