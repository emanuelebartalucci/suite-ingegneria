const fs = require('fs');

const content = fs.readFileSync('./scratch_extracted_text.txt', 'utf8');
const sections = content.split('\nFILE: ');

console.log(`Found ${sections.length} sections.`);

for (let i = 1; i < sections.length; i++) {
    const lines = sections[i].split('\n');
    const title = lines[0];
    console.log(`\n=============================================`);
    console.log(`SECTION: ${title}`);
    console.log(`=============================================`);
    lines.slice(1, 16).forEach((line, index) => {
        console.log(`${index + 1}: ${line}`);
    });
}
