const fs = require('fs');
const content = fs.readFileSync('src/tools/ToolDimensionamentoPozzettiElettrici.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
    if (line.includes('bending') || line.includes('R_min') || line.includes('Curvatura') || line.includes('cavidotto')) {
        console.log(`L${i+1}: ${line.trim().slice(0, 100)}`);
    }
});
