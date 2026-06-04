const fs = require('fs');
const c = fs.readFileSync('src/components/chat/account-dialog/components/overview-tab.tsx', 'utf8');
const lines = c.split('\n');

let inStr = false;
let strChar = '';
let inTmpl = false;
let inBlockComment = false;
let inLineComment = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  inLineComment = false;

  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    const next = line[j + 1];

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        j++;
      }
      continue;
    }

    if (inLineComment) break;

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      j++;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      break;
    }

    if (ch === '`' && !inStr) {
      inTmpl = !inTmpl;
      continue;
    }

    if ((ch === '"' || ch === "'") && !inTmpl) {
      if (!inStr) {
        inStr = true;
        strChar = ch;
      } else if (strChar === ch && line[j - 1] !== '\\') {
        inStr = false;
        strChar = '';
      }
      continue;
    }

    if (!inStr && !inTmpl && !inBlockComment) {
      // Check for template literals inside strings
      if (ch === '(') {
        console.log('OPEN PAREN at line ' + (i + 1) + ' col ' + j + ': ' + line.substring(Math.max(0, j - 5), j + 10));
      }
      if (ch === ')') {
        console.log('CLOSE PAREN at line ' + (i + 1) + ' col ' + j + ': ' + line.substring(Math.max(0, j - 5), j + 10));
      }
      if (ch === '[') {
        console.log('OPEN BRACK at line ' + (i + 1) + ' col ' + j + ': ' + line.substring(Math.max(0, j - 5), j + 10));
      }
      if (ch === ']') {
        console.log('CLOSE BRACK at line ' + (i + 1) + ' col ' + j + ': ' + line.substring(Math.max(0, j - 5), j + 10));
      }
      if (ch === '{') {
        console.log('OPEN CURLY at line ' + (i + 1) + ' col ' + j + ': ' + line.substring(Math.max(0, j - 5), j + 10));
      }
      if (ch === '}') {
        console.log('CLOSE CURLY at line ' + (i + 1) + ' col ' + j + ': ' + line.substring(Math.max(0, j - 5), j + 10));
      }
    }
  }
}
