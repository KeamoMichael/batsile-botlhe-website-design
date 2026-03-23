import sharp from 'sharp';
import { readdirSync, statSync, renameSync } from 'fs';
import { join, extname, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const TARGET_DIRS = ['Web Resources', 'Web Icons'];
const SKIP_BELOW_KB = 100; // skip files already under 100KB

function getFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getFiles(full));
    } else {
      const ext = extname(entry.name).toLowerCase();
      if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        results.push(full);
      }
    }
  }
  return results;
}

function formatKB(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

let totalBefore = 0;
let totalAfter = 0;
let skipped = 0;
let processed = 0;

for (const dir of TARGET_DIRS) {
  const fullDir = join(ROOT, dir);
  const files = getFiles(fullDir);

  for (const file of files) {
    const sizeBefore = statSync(file).size;

    if (sizeBefore < SKIP_BELOW_KB * 1024) {
      skipped++;
      continue;
    }

    const ext = extname(file).toLowerCase();
    const tmpFile = file + '.tmp';

    try {
      const img = sharp(file);

      if (ext === '.png') {
        await img.png({ compressionLevel: 9, quality: 80 }).toFile(tmpFile);
      } else {
        await img.jpeg({ quality: 75, mozjpeg: true }).toFile(tmpFile);
      }

      const sizeAfter = statSync(tmpFile).size;

      if (sizeAfter < sizeBefore) {
        renameSync(tmpFile, file);
        const rel = relative(ROOT, file);
        const saved = ((1 - sizeAfter / sizeBefore) * 100).toFixed(0);
        console.log(`✓ ${rel}`);
        console.log(`  ${formatKB(sizeBefore)} → ${formatKB(sizeAfter)} (${saved}% smaller)\n`);
        totalBefore += sizeBefore;
        totalAfter += sizeAfter;
        processed++;
      } else {
        // compressed version is larger, keep original
        renameSync(tmpFile, file);
        skipped++;
      }
    } catch (err) {
      console.error(`✗ Failed: ${file} — ${err.message}`);
      try { renameSync(tmpFile, file); } catch {}
    }
  }
}

const savedMB = ((totalBefore - totalAfter) / 1024 / 1024).toFixed(2);
console.log(`\nDone! Compressed ${processed} images, skipped ${skipped}.`);
console.log(`Total saved: ${savedMB} MB`);
