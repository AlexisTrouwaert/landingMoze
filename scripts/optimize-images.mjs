import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir    = resolve(__dirname, '../public/assets/images');
const outDir = resolve(__dirname, '../scripts/img-out');

mkdirSync(outDir, { recursive: true });

const tasks = [
  { file: 'cyril.webp',   width: 80,  height: 80  },
  { file: 'ludovic.webp', width: 80,  height: 80  },
  { file: 'fanny.webp',   width: 288, height: 288 },
  { file: 'anthony.webp', width: 288, height: 288 },
];

for (const { file, width, height } of tasks) {
  const input  = resolve(dir, file);
  const output = resolve(outDir, file);
  const info   = await sharp(input).metadata();
  await sharp(input)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82 })
    .toFile(output);
  console.log(`✓ ${file} : ${info.width}x${info.height} → ${width}x${height}`);
}

console.log(`\nFichiers optimisés dans : ${outDir}`);
