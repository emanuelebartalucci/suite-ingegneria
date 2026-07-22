const fs = require('fs');
const content = fs.readFileSync('src/tools/ToolDimensionamentoPozzettiElettrici.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
    if (line.includes('bending') || line.includes('Curvatura') || line.includes('raggio') || line.includes('8 *') || line.includes('DN')) {
        if (i < 500) {
            console.log(`L${i+1}: ${line.trim().slice(0, 120)}`);
        }
    }
});
