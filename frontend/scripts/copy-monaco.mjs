import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'node_modules', 'monaco-editor', 'min', 'vs');
const target = path.join(root, 'public', 'monaco', 'vs');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
  return true;
}

if (!fs.existsSync(source)) {
  console.warn('[postinstall] Monaco files not found. Skipping public/monaco copy.');
  console.warn(`[postinstall] Expected: ${source}`);
  process.exit(0);
}

fs.rmSync(target, { recursive: true, force: true });
copyDir(source, target);
console.log('[postinstall] Monaco editor assets copied to public/monaco/vs');
