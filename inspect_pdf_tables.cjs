const fs = require('fs');

const text = fs.readFileSync('extracted_legrand_pdf_text.txt', 'utf8');
const lines = text.split('\n');

function printSection(startLine, count, title) {
    console.log(`\n=================== ${title} (Lines ${startLine} to ${startLine + count}) ===================`);
    for (let i = startLine - 1; i < Math.min(lines.length, startLine + count); i++) {
        console.log(`L${i + 1}: ${lines[i]}`);
    }
}

printSection(1840, 45, "Diagrammi Carichi P31+ Section 1");
printSection(4324, 45, "Diagrammi Carichi P31+ Section 2");
printSection(7690, 45, "Diagrammi Carichi P31+ Section 3");
printSection(11520, 50, "Diagrammi Carichi P31+ & Tabella SWL");
printSection(11800, 50, "Tabella SWL N/m");
printSection(12750, 50, "Diagrammi Carichi ZF31 / Cablofil");
