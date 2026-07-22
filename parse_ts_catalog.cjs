const fs = require('fs');

const content = fs.readFileSync('src/data/supportCatalog.ts', 'utf8');

const regex = /id:\s*'([^']+)'[\s\S]*?altezza_mm:\s*(\d+)[\s\S]*?larghezza_mm:\s*(\d+)[\s\S]*?makePoints\(\[([^\]]+)\]\)/g;

let match;
console.log("Extracted supportCatalog values:");
while ((match = regex.exec(content)) !== null) {
    const id = match[1];
    const h = match[2];
    const w = match[3];
    const loads = match[4].split(',').map(n => parseInt(n.trim()));
    // index 4 is 2000mm (1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000)
    console.log(`${id} (H${h}xW${w}): 1000mm=${loads[0]}, 2000mm=${loads[4]}, 3000mm=${loads[8]}`);
}
