const fs = require('fs');

const content = fs.readFileSync('./scratch_extracted_text.txt', 'utf8');
const sections = content.split('\nFILE: ');

const targetFiles = [
    '12S1YVI.pdf', 
    'F-UTP cat. 6.pdf', 
    'F-UTP cat.6A.pdf', 
    'SF225RZ.pdf', 
    'Cavidotti.pdf', 
    'TUBO FLESSIBILE 25.pdf', 
    'TUBO FLESSIBILE 32.pdf', 
    'TUBO FLESSIBILE 40.pdf', 
    'TUBO FLRSSIBILE 20.pdf', 
    'Tubazioni TAZ.pdf'
];

for (const file of targetFiles) {
    const section = sections.find(s => s.startsWith(file));
    if (!section) {
        console.log(`Could not find section for ${file}`);
        continue;
    }
    console.log(`\n=============================================`);
    console.log(`FULL TEXT FOR: ${file}`);
    console.log(`=============================================`);
    console.log(section.substring(0, 4000));
}
