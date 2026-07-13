const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const filePath = 'C:/Users/e.bartalucci.INGEGNO.001/.gemini/antigravity/brain/51a13263-4e0f-4d9e-932c-1cdf1458e090/.system_generated/logs/transcript_full.jsonl';
  if (!fs.existsSync(filePath)) {
    console.log("transcript_full.jsonl does not exist!");
    return;
  }
  const fileStream = fs.createReadStream(filePath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('ProjectStorage.tsx') && (line.includes('collection(db') || line.includes('TargetContent') || line.includes('ReplacementContent'))) {
      console.log(line.substring(0, 500));
    }
  }
}

processLineByLine();
