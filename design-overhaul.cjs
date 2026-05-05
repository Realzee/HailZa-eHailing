const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Design overhaul replacements
  content = content.replace(/font-black/g, 'font-semibold');
  content = content.replace(/text-\[9px\]/g, 'text-xs');
  content = content.replace(/text-\[10px\]/g, 'text-xs');
  content = content.replace(/text-\[11px\]/g, 'text-sm');
  content = content.replace(/tracking-widest/g, 'tracking-normal');
  content = content.replace(/tracking-\[0.2em\]/g, 'tracking-wide');
  content = content.replace(/rounded-\[2\.5rem\]/g, 'rounded-3xl');
  content = content.replace(/\buppercase\b/g, ''); // Removed full uppercase
  content = content.replace(/bg-hail-green/g, 'bg-secondary');
  content = content.replace(/text-hail-green/g, 'text-secondary');
  content = content.replace(/border-hail-green/g, 'border-secondary');
  
  fs.writeFileSync(filePath, content, 'utf8');
}

const componentsDir = path.join(__dirname, 'src', 'components');
const files = fs.readdirSync(componentsDir);

files.forEach(file => {
  if (file.endsWith('.tsx')) {
    replaceInFile(path.join(componentsDir, file));
  }
});

console.log('Design overhaul script complete.');
