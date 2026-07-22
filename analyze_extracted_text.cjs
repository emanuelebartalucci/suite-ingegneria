const fs = require('fs');

const text = fs.readFileSync('extracted_legrand_pdf_text.txt', 'utf8');

const lines = text.split('\n');

console.log("Searching for diagram / curve / table lines in extracted text...");

lines.forEach((line, idx) => {
    if (/daN|N\/m|kg\/m|carico ammissibile|distanza tra i supporti|diagramm|grafic|curva|tassell|piastra di allineamento/i.test(line)) {
        console.log(`Line ${idx+1}: ${line.trim()}`);
    }
});
