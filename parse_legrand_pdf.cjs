const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const pdfPath = `C:\\Users\\e.bartalucci.INGEGNO.001\\Documents\\Antigravity\\suite-ingegneria\\File utili\\Impianti Elettrici\\Database\\Canali Legrand.pdf`;

console.log("Reading PDF file...");
const dataBuffer = fs.readFileSync(pdfPath);
const uint8Array = new Uint8Array(dataBuffer);

const parser = new PDFParse(uint8Array);
parser.getText().then(function(result) {
    console.log("Extraction finished!");
    const text = typeof result === 'string' ? result : (result.text || JSON.stringify(result));
    console.log("Extracted text length:", text.length, "characters.");
    fs.writeFileSync('extracted_legrand_pdf_text.txt', text, 'utf8');

    const lines = text.split('\n');
    let matchingLines = [];
    lines.forEach((line, idx) => {
        if (/P31|61537|carico|ammissibil|distanza|spaziatura|piastra|daN|N\/m/i.test(line)) {
            matchingLines.push(`L${idx+1}: ${line.trim()}`);
        }
    });
    console.log(`Found ${matchingLines.length} matching lines.`);
    console.log("Sample matching lines (first 40):");
    matchingLines.slice(0, 40).forEach(l => console.log(l));
}).catch(err => {
    console.error("Error with PDFParse:", err);
});
