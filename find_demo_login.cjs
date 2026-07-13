const fs = require('fs');
const content = fs.readFileSync('c:/Users/e.bartalucci.INGEGNO.001/Documents/Antigravity/suite-ingegneria/src/components/Login.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('onLoginDemo') || line.includes('Demo') || line.includes('Accedi come Demo') || line.includes('Accedi come Ospite')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
