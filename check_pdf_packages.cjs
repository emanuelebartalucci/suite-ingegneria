const fs = require('fs');
const path = require('path');

const nmPath = 'node_modules';
if (fs.existsSync(nmPath)) {
    const pkgs = fs.readdirSync(nmPath).filter(p => p.includes('pdf'));
    console.log("PDF packages in node_modules:", pkgs);
}
