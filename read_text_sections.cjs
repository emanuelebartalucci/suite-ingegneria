const fs = require('fs');
const text = fs.readFileSync('scratch_legrand_text.txt', 'utf8');
const lines = text.split('\n');

function printRange(start, count, label) {
    console.log(`\n=== ${label} (Lines ${start} - ${start+count}) ===`);
    lines.slice(start, start + count).forEach((l, idx) => {
        console.log(`${start + idx}: ${l.trim()}`);
    });
}

printRange(800, 100, "Around line 800 (SWL Table)");
printRange(7670, 100, "Around line 7670 (CEI EN 61537 Load tests)");
