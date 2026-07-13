const XLSX = require('xlsx');

const file = './File utili/Dimensionamento elettrico/Excel/Cavidotto.xlsm';
const workbook = XLSX.readFile(file);
const sheet = workbook.Sheets['Verifica'];
const range = XLSX.utils.decode_range(sheet['!ref']);

// Look at row 22 for all columns
for (let c = range.s.c; c <= range.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 21, c }); // row 22 is 21 0-indexed
    const cell = sheet[cellRef];
    if (cell) {
        console.log(`Column ${XLSX.utils.encode_col(c)} (Row 22): val="${cell.v}", formula="${cell.f || ''}"`);
    }
}

// Let's search for formulas in the sheet that contain calculations like SQRT or SUM or *1.5 or *2
console.log("\nSearching for calculations...");
for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellRef];
        if (cell && cell.f) {
            if (cell.f.includes('1.5') || cell.f.includes('SUM') || cell.f.includes('SQRT') || cell.f.includes('PI') || cell.f.includes('^') || cell.f.includes('*') || cell.f.includes('/')) {
                console.log(`${cellRef}: formula="${cell.f}"`);
            }
        }
    }
}
