const fs = require('fs');

const text = fs.readFileSync('scratch_legrand_text.txt', 'utf8');
const lines = text.split('\n');

console.log("Searching for P31+, SWL, 1420, 1800, etc.");

const searchTerms = ['P31+', 'SWL', 'CEI EN 61537', '1420', '1800', 'Pag. 58', 'Pag. 84', 'Tabella'];

searchTerms.forEach(term => {
    console.log(`\n=== SEARCH: ${term} ===`);
    let matches = 0;
    lines.forEach((line, i) => {
        if (line.toLowerCase().includes(term.toLowerCase())) {
            if (matches < 15) {
                console.log(`Line ${i}: ${line.trim().slice(0, 120)}`);
            }
            matches++;
        }
    });
    console.log(`Total matches for '${term}': ${matches}`);
});
