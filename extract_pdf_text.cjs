const fs = require('fs');

const pdfPath = `C:\\Users\\e.bartalucci.INGEGNO.001\\Documents\\Antigravity\\suite-ingegneria\\File utili\\Impianti Elettrici\\Database\\Canali Legrand.pdf`;

const fd = fs.openSync(pdfPath, 'r');
const buffer = Buffer.alloc(1024 * 1024 * 10); // read first 10MB
fs.readSync(fd, buffer, 0, buffer.length, 0);
fs.closeSync(fd);

const text = buffer.toString('binary');
console.log("PDF header:", text.substring(0, 200));

// Find occurrences of TJ or Tj (PDF text streams) or text strings
const streamRegex = /stream[\r\n]+([\s\S]*?)endstream/g;
let match;
let foundStreams = 0;
while ((match = streamRegex.exec(text)) !== null && foundStreams < 20) {
    foundStreams++;
    const streamContent = match[1];
    // check if uncompressed text
    if (streamContent.includes('P31') || streamContent.includes('Legrand') || streamContent.includes('N/m') || streamContent.includes('daN/m')) {
        console.log(`Stream ${foundStreams}:`, streamContent.substring(0, 300));
    }
}
console.log("Finished initial check.");
