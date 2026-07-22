const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const pdfPath = 'File utili/Impianti Elettrici/Database/Canali Legrand.pdf';

async function main() {
    let dataBuffer = fs.readFileSync(pdfPath);
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();
    console.log("Total text length:", result.text ? result.text.length : 0);
    fs.writeFileSync('scratch_legrand_text.txt', result.text);
    console.log("Saved scratch_legrand_text.txt!");
}

main().catch(err => {
    console.error("Error running parser:", err);
});
