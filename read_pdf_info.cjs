const fs = require('fs');
const path = require('path');

const pdfPath = `C:\\Users\\e.bartalucci.INGEGNO.001\\Documents\\Antigravity\\suite-ingegneria\\File utili\\Impianti Elettrici\\Database\\Canali Legrand.pdf`;

console.log("Exists:", fs.existsSync(pdfPath));
if (fs.existsSync(pdfPath)) {
    const stats = fs.statSync(pdfPath);
    console.log("Size:", stats.size);
}
