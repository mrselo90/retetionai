const fs = require('fs');

const code = fs.readFileSync('/Users/sboyuk/Desktop/retention-agent-ai/packages/shopify-app/app/routes/app.products._index.tsx', 'utf8');

const lines = code.split('\n');
const start = lines.findIndex(l => l.startsWith('function SetupPanel({'));

let braceCount = 0;
let started = false;
let end = -1;

for (let i = start; i < lines.length; i++) {
  const line = lines[i];
  for (let char of line) {
    if (char === '{') {
      braceCount++;
      started = true;
    }
    if (char === '}') {
      braceCount--;
    }
  }
  if (started && braceCount === 0) {
    end = i;
    break;
  }
}

console.log(lines.slice(start, end + 1).join('\n'));
